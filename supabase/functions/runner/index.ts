import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-runner-token",
};

// Security constants
const RUNNER_TOKEN = Deno.env.get("RUNNER_TOKEN") || "demo-runner-token";
const MAX_EVENTS_PER_REQUEST = 50;
const MAX_PAYLOAD_SIZE_BYTES = 64 * 1024; // 64KB
const MAX_LOG_CONTENT_LENGTH = 4096; // 4KB per log chunk

function validateRunnerToken(req: Request): boolean {
  const token = req.headers.get("x-runner-token");
  return token === RUNNER_TOKEN;
}

function truncateLogContent(content: string): string {
  if (content.length > MAX_LOG_CONTENT_LENGTH) {
    return content.slice(0, MAX_LOG_CONTENT_LENGTH) + "\n... [truncated]";
  }
  return content;
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      // Truncate long strings
      sanitized[key] = value.length > MAX_LOG_CONTENT_LENGTH
        ? value.slice(0, MAX_LOG_CONTENT_LENGTH) + "..."
        : value;
    } else if (Array.isArray(value)) {
      // Cap array sizes
      sanitized[key] = value.slice(0, 100);
    } else if (typeof value === "object" && value !== null) {
      // Recursively sanitize nested objects (1 level deep)
      sanitized[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .slice(0, 50)
          .map(([k, v]) => [k, typeof v === "string" && v.length > 1000 ? v.slice(0, 1000) + "..." : v])
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check payload size
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE_BYTES) {
    console.warn(`Payload too large: ${contentLength} bytes`);
    return new Response(JSON.stringify({ error: "Payload too large", maxBytes: MAX_PAYLOAD_SIZE_BYTES }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts[1]; // e.g., "heartbeat", "events", "claim-run"

  // Validate runner token for all endpoints
  if (!validateRunnerToken(req)) {
    console.warn("Invalid runner token attempt from:", req.headers.get("x-forwarded-for") || "unknown");
    return new Response(JSON.stringify({ error: "Unauthorized", message: "Invalid or missing x-runner-token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // POST /runner/heartbeat - Runner sends heartbeat
    if (req.method === "POST" && action === "heartbeat") {
      const body = await req.json();
      const {
        runnerId,
        version,
        capabilities,
        os,
        packageManager,
        commandTimeoutMs,
        patchConstraints,
      } = body;

      // Insert heartbeat event (using a special "system" run_id)
      // Preserve camelCase from runner for UI consumption
      const { error } = await supabase.from("run_events").insert({
        run_id: "00000000-0000-0000-0000-000000000000", // System runner ID
        event_type: "RUNNER_HEARTBEAT",
        payload: {
          runnerId,
          version: version || "1.0.0",
          capabilities: capabilities || {
            repoRead: true,
            patchApply: false,
            dockerVerify: false,
          },
          os: os || null,
          packageManager: packageManager || null,
          commandTimeoutMs: commandTimeoutMs || null,
          patchConstraints: patchConstraints || null,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) throw error;

      console.log(`Runner heartbeat from ${runnerId || "unknown"} v${version || "unknown"}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /runner/events - Runner posts events (tool calls, logs, etc.)
    if (req.method === "POST" && action === "events") {
      const body = await req.json();
      const { runId, events } = body;

      if (!Array.isArray(events) || events.length === 0) {
        return new Response(JSON.stringify({ error: "Events array required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: cap events per request
      if (events.length > MAX_EVENTS_PER_REQUEST) {
        console.warn(`Too many events: ${events.length}, capping at ${MAX_EVENTS_PER_REQUEST}`);
        events.length = MAX_EVENTS_PER_REQUEST;
      }

      // Sanitize and insert events
      const eventsToInsert = events.map((e: { type: string; payload?: Record<string, unknown> }) => ({
        run_id: runId,
        event_type: e.type,
        payload: sanitizePayload(e.payload || {}),
      }));

      const { error } = await supabase.from("run_events").insert(eventsToInsert);
      if (error) throw error;

      console.log(`Runner posted ${eventsToInsert.length} events for run ${runId}`);

      return new Response(JSON.stringify({ success: true, count: eventsToInsert.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /runner/claim-run - Runner claims a queued run
    if (req.method === "POST" && action === "claim-run") {
      const body = await req.json();
      const { runnerId, runId } = body;

      // If specific runId provided, claim that one
      if (runId) {
        const { data: run, error: fetchError } = await supabase
          .from("runs")
          .select("*")
          .eq("id", runId)
          .eq("status", "queued")
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!run) {
          return new Response(JSON.stringify({ run: null, error: "Run not found or not queued" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Claim with optimistic lock
        const { data: updated, error: updateError } = await supabase
          .from("runs")
          .update({ status: "running" })
          .eq("id", runId)
          .eq("status", "queued")
          .select()
          .maybeSingle();

        if (updateError) throw updateError;

        if (!updated) {
          return new Response(JSON.stringify({ run: null, error: "Run already claimed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("run_events").insert({
          run_id: runId,
          event_type: "RUN_STARTED",
          payload: { runnerId, claimedAt: new Date().toISOString() },
        });

        console.log(`Runner ${runnerId} claimed run ${runId}`);

        return new Response(JSON.stringify({ run: updated }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Otherwise find oldest queued run
      const { data: run, error: fetchError } = await supabase
        .from("runs")
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!run) {
        return new Response(JSON.stringify({ run: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Claim the run by updating status (optimistic lock via status check)
      const { error: updateError } = await supabase
        .from("runs")
        .update({ status: "running" })
        .eq("id", run.id)
        .eq("status", "queued"); // Ensure still queued (optimistic lock)

      if (updateError) throw updateError;

      // Emit RUN_STARTED event with runner info
      await supabase.from("run_events").insert({
        run_id: run.id,
        event_type: "RUN_STARTED",
        payload: { runnerId, claimedAt: new Date().toISOString() },
      });

      console.log(`Runner ${runnerId} claimed run ${run.id}`);

      return new Response(JSON.stringify({ run }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /runner/update-run - Runner updates run state
    if (req.method === "POST" && action === "update-run") {
      const body = await req.json();
      const { runId, status, plan, verification, patches, riskAssessment, tool_calls, impacted_files, error: runError } = body;

      if (!runId) {
        return new Response(JSON.stringify({ error: "runId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (plan) updates.plan = plan;
      if (verification) updates.verification = verification;
      if (patches) updates.patches = patches;
      if (riskAssessment) updates.risk_assessment = riskAssessment;
      if (tool_calls) updates.tool_calls = tool_calls;
      if (impacted_files) updates.impacted_files = impacted_files;
      if (runError) updates.error = runError;

      const { error } = await supabase
        .from("runs")
        .update(updates)
        .eq("id", runId);

      if (error) throw error;

      console.log(`Runner updated run ${runId}: ${Object.keys(updates).join(", ")}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /runner/pending-approvals - Get runs pending patch application
    if (req.method === "GET" && action === "pending-approvals") {
      const { data, error } = await supabase
        .from("runs")
        .select("id, task, patches")
        .eq("status", "approved")
        .order("updated_at", { ascending: true });

      if (error) throw error;

      // Also get unapplied patches
      const { data: patches, error: patchError } = await supabase
        .from("patches")
        .select("*")
        .eq("approved", true)
        .eq("applied", false);

      if (patchError) throw patchError;

      return new Response(JSON.stringify({ runs: data || [], patches: patches || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /runner/patch-applied - Mark patch as applied
    if (req.method === "POST" && action === "patch-applied") {
      const body = await req.json();
      const { patchId, runId, filesAffected } = body;

      if (!patchId) {
        return new Response(JSON.stringify({ error: "patchId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update patch
      const { error: patchError } = await supabase
        .from("patches")
        .update({ applied: true, applied_at: new Date().toISOString() })
        .eq("id", patchId);

      if (patchError) throw patchError;

      // Emit event
      await supabase.from("run_events").insert({
        run_id: runId,
        event_type: "PATCH_APPLIED",
        payload: { patchId, filesAffected },
      });

      // Update run status to completed if all patches applied
      if (runId) {
        const { data: remainingPatches } = await supabase
          .from("patches")
          .select("id")
          .eq("run_id", runId)
          .eq("applied", false);

        if (!remainingPatches || remainingPatches.length === 0) {
          await supabase
            .from("runs")
            .update({ status: "completed" })
            .eq("id", runId);

          await supabase.from("run_events").insert({
            run_id: runId,
            event_type: "RUN_COMPLETED",
            payload: {},
          });
        }
      }

      console.log(`Patch ${patchId} marked as applied`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Runner endpoint error:", error);
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(JSON.stringify({ error: message, detail: error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
