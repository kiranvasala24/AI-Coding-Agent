import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for browser requests (set via secret or default to common patterns)
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");

  // For non-browser requests (no Origin header), allow if token is valid
  if (!origin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
    };
  }

  // For browser requests, check allowlist (or allow all if no allowlist configured)
  const isAllowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.some(allowed =>
    origin === allowed || origin.endsWith(`.${allowed.replace(/^https?:\/\//, '')}`)
  );

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Admin token for protected operations
const ADMIN_TOKEN = Deno.env.get("ADMIN_TOKEN") || Deno.env.get("RUNNER_TOKEN");

// Retention settings
const RETENTION = {
  defaultDays: 7,
  maxDays: 30,
  minDays: 1,
};

function validateAdminToken(req: Request): boolean {
  const token = req.headers.get("x-admin-token");
  if (!token || !ADMIN_TOKEN) return false;
  return token === ADMIN_TOKEN;
}

function validateOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");

  // Non-browser requests (curl, scripts) don't send Origin - allow them (token still required)
  if (!origin) return true;

  // If no allowlist configured, allow all origins (token still required)
  if (ALLOWED_ORIGINS.length === 0) return true;

  // Check against allowlist
  return ALLOWED_ORIGINS.some(allowed =>
    origin === allowed || origin.endsWith(`.${allowed.replace(/^https?:\/\//, '')}`)
  );
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean)[1];

  // GET /admin/ping - Simple health check (NO auth required - public endpoint)
  if (req.method === "GET" && action === "ping") {
    return new Response(JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      env: Deno.env.get("APP_ENV") || "production"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate origin for browser requests (all other endpoints)
  if (!validateOrigin(req)) {
    console.log(`Origin rejected: ${req.headers.get("Origin")}`);
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate admin token for all protected operations
  if (!validateAdminToken(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {

    // POST /admin/cleanup - Delete old runs and related data
    if (req.method === "POST" && action === "cleanup") {
      const body = await req.json().catch(() => ({}));
      const retentionDays = Math.min(
        Math.max(body.retentionDays || RETENTION.defaultDays, RETENTION.minDays),
        RETENTION.maxDays
      );

      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      console.log(`Cleanup: deleting data older than ${cutoffDate} (${retentionDays} days)`);

      // Get runs to delete
      const { data: runsToDelete, error: fetchError } = await supabase
        .from("runs")
        .select("id")
        .lt("created_at", cutoffDate);

      if (fetchError) throw fetchError;

      const runIds = runsToDelete?.map((r) => r.id) || [];

      if (runIds.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "No data to clean up",
          deleted: { runs: 0, events: 0, patches: 0 },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete run_events first (no cascade)
      const { count: eventsDeleted } = await supabase
        .from("run_events")
        .delete({ count: "exact" })
        .in("run_id", runIds);

      // Delete patches
      const { count: patchesDeleted } = await supabase
        .from("patches")
        .delete({ count: "exact" })
        .in("run_id", runIds);

      // Delete runs
      const { count: runsDeleted } = await supabase
        .from("runs")
        .delete({ count: "exact" })
        .in("id", runIds);

      // Also cleanup old rate limits
      const { data: rateLimitsResult } = await supabase.rpc("cleanup_rate_limits");
      const rateLimitsDeleted = rateLimitsResult || 0;

      // Get remaining stats for summary
      const [remainingRuns, oldestRemaining] = await Promise.all([
        supabase.from("runs").select("id", { count: "exact", head: true }),
        supabase.from("runs").select("created_at").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      ]);

      console.log(`Cleanup complete: ${runsDeleted} runs, ${eventsDeleted} events, ${patchesDeleted} patches, ${rateLimitsDeleted} rate limits`);

      return new Response(JSON.stringify({
        success: true,
        retentionDays,
        cutoffDate,
        deleted: {
          runs: runsDeleted || 0,
          events: eventsDeleted || 0,
          patches: patchesDeleted || 0,
          rateLimits: rateLimitsDeleted,
        },
        remaining: {
          runs: remainingRuns.count || 0,
          oldestRunDate: oldestRemaining.data?.created_at || null,
        },
        summary: `Deleted ${runsDeleted || 0} runs and ${eventsDeleted || 0} events. ${remainingRuns.count || 0} runs remain.`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /admin/stats - Get database statistics
    if (req.method === "GET" && action === "stats") {
      const [runsResult, eventsResult, patchesResult] = await Promise.all([
        supabase.from("runs").select("id", { count: "exact", head: true }),
        supabase.from("run_events").select("id", { count: "exact", head: true }),
        supabase.from("patches").select("id", { count: "exact", head: true }),
      ]);

      // Get oldest run
      const { data: oldestRun } = await supabase
        .from("runs")
        .select("created_at")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      return new Response(JSON.stringify({
        counts: {
          runs: runsResult.count || 0,
          events: eventsResult.count || 0,
          patches: patchesResult.count || 0,
        },
        oldestRunDate: oldestRun?.created_at || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
