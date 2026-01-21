import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");

  if (!runId) {
    return new Response(JSON.stringify({ error: "runId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify run exists
  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("id")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !run) {
    return new Response(JSON.stringify({ error: "Run not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`Starting SSE stream for run ${runId}`);

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const sendEvent = (event: any) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Send initial connection event
      sendEvent({ type: "CONNECTED", runId });

      // Fetch existing events
      const { data: existingEvents } = await supabase
        .from("run_events")
        .select("*")
        .eq("run_id", runId)
        .order("created_at", { ascending: true });

      // Send all existing events
      if (existingEvents) {
        for (const event of existingEvents) {
          sendEvent({
            eventId: event.id,
            runId: event.run_id,
            type: event.event_type,
            timestamp: event.created_at,
            payload: event.payload,
          });
        }
      }

      // Subscribe to new events via Supabase Realtime
      const channel = supabase
        .channel(`run-events-${runId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "run_events",
            filter: `run_id=eq.${runId}`,
          },
          (payload) => {
            console.log(`New event for run ${runId}:`, payload.new.event_type);
            sendEvent({
              eventId: payload.new.id,
              runId: payload.new.run_id,
              type: payload.new.event_type,
              timestamp: payload.new.created_at,
              payload: payload.new.payload,
            });
          }
        )
        .subscribe();

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          sendEvent({ type: "HEARTBEAT", timestamp: new Date().toISOString() });
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Handle client disconnect
      req.signal.addEventListener("abort", () => {
        console.log(`Client disconnected from run ${runId}`);
        clearInterval(heartbeat);
        supabase.removeChannel(channel);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: corsHeaders,
  });
});
