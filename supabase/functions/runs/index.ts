import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT = {
  maxRunsPerMinute: 10,
  maxTaskLength: 2000,
  windowSeconds: 60,
};

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
         req.headers.get("x-real-ip") || 
         "unknown";
}

// DB-backed rate limiting using atomic upsert
async function checkRateLimit(
  supabase: any, 
  clientIP: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const clientKey = `runs:${clientIP}`;
  
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_client_key: clientKey,
    p_max_requests: RATE_LIMIT.maxRunsPerMinute,
    p_window_seconds: RATE_LIMIT.windowSeconds,
  });
  
  if (error) {
    console.error("Rate limit check failed:", error);
    // Fail open but log - don't block on DB errors
    return { allowed: true, remaining: RATE_LIMIT.maxRunsPerMinute, resetAt: new Date() };
  }
  
  const result = data?.[0] || { allowed: true, remaining: RATE_LIMIT.maxRunsPerMinute, reset_at: new Date() };
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: new Date(result.reset_at),
  };
}

// Cleanup old rate limit entries (called periodically)
async function cleanupRateLimits(supabase: any) {
  try {
    await supabase.rpc("cleanup_rate_limits");
  } catch (e) {
    console.error("Rate limit cleanup failed:", e);
  }
}

interface CreateRunRequest {
  task: string;
}

interface ApproveRequest {
  approved: boolean;
  approvedBy?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Periodic cleanup (non-blocking)
  cleanupRateLimits(supabase);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Remove "runs" from path to get the rest
  const runId = pathParts[1];
  const action = pathParts[2];

  try {
    // GET /runs - List all runs
    if (req.method === "GET" && !runId) {
      const { data, error } = await supabase
        .from("runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /runs - Create a new run
    if (req.method === "POST" && !runId) {
      const clientIP = getClientIP(req);
      const rateCheck = await checkRateLimit(supabase, clientIP);

      if (!rateCheck.allowed) {
        const retryAfter = Math.ceil((rateCheck.resetAt.getTime() - Date.now()) / 1000);
        console.log(`Rate limit exceeded for IP: ${clientIP}`);
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded",
          retryAfter: Math.max(1, retryAfter),
        }), {
          status: 429,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(Math.max(1, retryAfter)),
            "X-RateLimit-Remaining": "0",
          },
        });
      }

      const body: CreateRunRequest = await req.json();
      
      if (!body.task) {
        return new Response(JSON.stringify({ error: "Task is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate task length
      if (body.task.length > RATE_LIMIT.maxTaskLength) {
        return new Response(JSON.stringify({ 
          error: `Task too long. Maximum ${RATE_LIMIT.maxTaskLength} characters allowed.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create the run with 'queued' status so runner can claim it
      const { data: run, error: runError } = await supabase
        .from("runs")
        .insert({
          task: body.task,
          status: "queued",
        })
        .select()
        .single();

      if (runError) throw runError;

      // Create RUN_CREATED event
      await supabase.from("run_events").insert({
        run_id: run.id,
        event_type: "RUN_CREATED",
        payload: { task: body.task },
      });

      console.log(`Created run ${run.id} for task: ${body.task} (IP: ${clientIP}, remaining: ${rateCheck.remaining})`);

      return new Response(JSON.stringify({ runId: run.id }), {
        status: 201,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateCheck.remaining),
        },
      });
    }

    // GET /runs/:id - Get run by ID
    if (req.method === "GET" && runId && !action) {
      const { data, error } = await supabase
        .from("runs")
        .select("*")
        .eq("id", runId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Run not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /runs/:id/cancel - Cancel a run
    if (req.method === "POST" && runId && action === "cancel") {
      const { data: run, error: fetchError } = await supabase
        .from("runs")
        .select("status")
        .eq("id", runId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!run) {
        return new Response(JSON.stringify({ error: "Run not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (["completed", "failed", "cancelled"].includes(run.status)) {
        return new Response(JSON.stringify({ error: "Run already finished" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("runs")
        .update({ status: "cancelled" })
        .eq("id", runId);

      if (updateError) throw updateError;

      await supabase.from("run_events").insert({
        run_id: runId,
        event_type: "RUN_CANCELLED",
        payload: {},
      });

      console.log(`Cancelled run ${runId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /runs/:id/approve - Approve or reject a run
    if (req.method === "POST" && runId && action === "approve") {
      const body: ApproveRequest = await req.json();
      
      const { data: run, error: fetchError } = await supabase
        .from("runs")
        .select("status")
        .eq("id", runId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!run) {
        return new Response(JSON.stringify({ error: "Run not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (run.status !== "awaiting_approval") {
        return new Response(JSON.stringify({ error: "Run is not awaiting approval" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date().toISOString();
      const newStatus = body.approved ? "approved" : "failed";
      const approval = body.approved
        ? { required: true, approvedBy: body.approvedBy || "user", approvedAt: now }
        : { required: true, rejectedBy: body.approvedBy || "user", rejectedAt: now, reason: body.reason };

      const { error: updateError } = await supabase
        .from("runs")
        .update({ status: newStatus, approval })
        .eq("id", runId);

      if (updateError) throw updateError;

      await supabase.from("run_events").insert({
        run_id: runId,
        event_type: body.approved ? "APPROVED" : "REJECTED",
        payload: { approvedBy: body.approvedBy, reason: body.reason },
      });

      // Update patches if approved
      if (body.approved) {
        await supabase
          .from("patches")
          .update({ approved: true, approved_by: body.approvedBy, approved_at: now })
          .eq("run_id", runId);
      }

      console.log(`Run ${runId} ${body.approved ? "approved" : "rejected"}`);

      return new Response(JSON.stringify({ success: true, status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /runs/:id/simulate - Simulate a run for demo purposes
    if (req.method === "POST" && runId && action === "simulate") {
      // Start simulation in background
      simulateRun(supabase, runId);

      return new Response(JSON.stringify({ success: true, message: "Simulation started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /runs/:id/patches - Get patches for a run
    if (req.method === "GET" && runId && action === "patches") {
      const { data, error } = await supabase
        .from("patches")
        .select("*")
        .eq("run_id", runId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Simulate a run with realistic timing
async function simulateRun(supabase: any, runId: string) {
  const emit = async (eventType: string, payload: any, status?: string) => {
    await supabase.from("run_events").insert({
      run_id: runId,
      event_type: eventType,
      payload,
    });
    if (status) {
      await supabase.from("runs").update({ status }).eq("id", runId);
    }
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    // Planning phase
    await emit("PLAN_CREATED", {}, "planning");
    await delay(1000);

    const plan = {
      task: "Add error handling to the API client",
      steps: [
        { id: "1", action: "analyze", target: "src/lib/api.ts", reason: "Understand current error handling", status: "completed" },
        { id: "2", action: "modify", target: "src/lib/api.ts", reason: "Add try-catch and error types", status: "completed" },
        { id: "3", action: "test", target: "src/lib/api.test.ts", reason: "Verify error handling works", status: "completed" },
      ],
      risks: ["Changes to shared API client may affect multiple consumers"],
      affectedExports: ["fetchWithRetry", "ApiError"],
      acceptanceCriteria: ["All API calls handle errors gracefully", "Error messages are user-friendly"],
    };

    await supabase.from("runs").update({ plan }).eq("id", runId);

    for (const step of plan.steps) {
      await emit("PLAN_STEP_STARTED", { stepId: step.id });
      await delay(500);
      await emit("PLAN_STEP_COMPLETED", { stepId: step.id });
    }

    // Execution phase - tool calls
    await emit("TOOL_CALLED", { name: "search", args: { query: "error handling" } }, "executing");
    await delay(800);
    await emit("TOOL_COMPLETED", { name: "search", resultSummary: "Found 3 relevant files" });

    await emit("TOOL_CALLED", { name: "open", args: { file: "src/lib/api.ts" } });
    await delay(600);
    await emit("TOOL_COMPLETED", { name: "open", resultSummary: "File loaded (42 lines)" });

    // Patch proposal
    const patch = {
      patchId: crypto.randomUUID(),
      summary: "Add comprehensive error handling to API client",
      filesChanged: [
        {
          path: "src/lib/api.ts",
          additions: 15,
          deletions: 3,
          diff: [
            { type: "header", content: "@@ -10,6 +10,18 @@" },
            { type: "context", content: "export async function fetchWithRetry(url: string) {" },
            { type: "removed", content: "  const response = await fetch(url);" },
            { type: "removed", content: "  return response.json();" },
            { type: "added", content: "  try {" },
            { type: "added", content: "    const response = await fetch(url);" },
            { type: "added", content: "    if (!response.ok) {" },
            { type: "added", content: "      throw new ApiError(response.status, response.statusText);" },
            { type: "added", content: "    }" },
            { type: "added", content: "    return response.json();" },
            { type: "added", content: "  } catch (error) {" },
            { type: "added", content: "    console.error('API Error:', error);" },
            { type: "added", content: "    throw error;" },
            { type: "added", content: "  }" },
            { type: "context", content: "}" },
          ],
        },
      ],
      totalAdditions: 15,
      totalDeletions: 3,
      reasoning: "Added try-catch block with custom ApiError class for better error messages",
      constraintsUsed: ["max_diff_lines: 300", "file_allowlist: src/"],
    };

    await supabase.from("patches").insert({
      id: patch.patchId,
      run_id: runId,
      summary: patch.summary,
      files_changed: patch.filesChanged,
      total_additions: patch.totalAdditions,
      total_deletions: patch.totalDeletions,
      reasoning: patch.reasoning,
      constraints_used: patch.constraintsUsed,
    });

    await supabase.from("runs").update({ patches: [patch] }).eq("id", runId);
    await emit("PATCH_PROPOSED", { patchId: patch.patchId });

    // Verification phase with streaming logs
    await emit("VERIFY_STARTED", { commands: ["tsc --noEmit", "vitest run"] }, "verifying");
    
    // Initialize verification state with proper types
    const verification: {
      commands: Array<{
        command: string;
        status: string;
        logs: string[];
        startedAt?: string;
        finishedAt?: string;
        exitCode?: number;
      }>;
      overallStatus: string;
      startedAt: string;
      finishedAt?: string;
    } = {
      commands: [
        { command: "tsc --noEmit", status: "running", logs: [], startedAt: new Date().toISOString() },
        { command: "vitest run", status: "pending", logs: [] },
      ],
      overallStatus: "running",
      startedAt: new Date().toISOString(),
    };
    await supabase.from("runs").update({ verification }).eq("id", runId);

    // TypeScript check - stream logs
    await emit("VERIFY_LOG", { command: "tsc --noEmit", log: "$ tsc --noEmit", index: 0 });
    await delay(200);
    await emit("VERIFY_LOG", { command: "tsc --noEmit", log: "Checking src/lib/api.ts...", index: 0 });
    await delay(300);
    await emit("VERIFY_LOG", { command: "tsc --noEmit", log: "Checking src/lib/utils.ts...", index: 0 });
    await delay(200);
    await emit("VERIFY_LOG", { command: "tsc --noEmit", log: "Checking src/components/...", index: 0 });
    await delay(400);
    await emit("VERIFY_LOG", { command: "tsc --noEmit", log: "✓ No type errors found", index: 0 });
    await delay(100);
    await emit("VERIFY_LOG", { command: "tsc --noEmit", log: "Compiled 42 files in 1.2s", index: 0 });
    
    // Update tsc command as passed
    verification.commands[0] = {
      command: "tsc --noEmit",
      status: "passed",
      logs: [
        "$ tsc --noEmit",
        "Checking src/lib/api.ts...",
        "Checking src/lib/utils.ts...",
        "Checking src/components/...",
        "✓ No type errors found",
        "Compiled 42 files in 1.2s"
      ],
      startedAt: verification.commands[0].startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: 0,
    };
    verification.commands[1].status = "running";
    verification.commands[1].startedAt = new Date().toISOString();
    await supabase.from("runs").update({ verification }).eq("id", runId);
    await emit("VERIFY_COMMAND_FINISHED", { command: "tsc --noEmit", status: "passed", exitCode: 0 });

    await delay(300);

    // Vitest - stream logs
    await emit("VERIFY_LOG", { command: "vitest run", log: "$ vitest run", index: 1 });
    await delay(200);
    await emit("VERIFY_LOG", { command: "vitest run", log: " DEV  v1.6.0 /project", index: 1 });
    await delay(150);
    await emit("VERIFY_LOG", { command: "vitest run", log: " ✓ src/lib/api.test.ts (3 tests) 45ms", index: 1 });
    await delay(200);
    await emit("VERIFY_LOG", { command: "vitest run", log: "   ✓ fetchWithRetry > should return data on success", index: 1 });
    await delay(100);
    await emit("VERIFY_LOG", { command: "vitest run", log: "   ✓ fetchWithRetry > should throw ApiError on failure", index: 1 });
    await delay(100);
    await emit("VERIFY_LOG", { command: "vitest run", log: "   ✓ fetchWithRetry > should log errors to console", index: 1 });
    await delay(150);
    await emit("VERIFY_LOG", { command: "vitest run", log: " Test Files  1 passed (1)", index: 1 });
    await emit("VERIFY_LOG", { command: "vitest run", log: "      Tests  3 passed (3)", index: 1 });
    await emit("VERIFY_LOG", { command: "vitest run", log: "   Duration  312ms", index: 1 });
    
    // Update vitest command as passed
    verification.commands[1] = {
      command: "vitest run",
      status: "passed",
      logs: [
        "$ vitest run",
        " DEV  v1.6.0 /project",
        " ✓ src/lib/api.test.ts (3 tests) 45ms",
        "   ✓ fetchWithRetry > should return data on success",
        "   ✓ fetchWithRetry > should throw ApiError on failure",
        "   ✓ fetchWithRetry > should log errors to console",
        " Test Files  1 passed (1)",
        "      Tests  3 passed (3)",
        "   Duration  312ms"
      ],
      startedAt: verification.commands[1].startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: 0,
    };
    verification.overallStatus = "passed";
    verification.finishedAt = new Date().toISOString();
    
    await supabase.from("runs").update({ verification }).eq("id", runId);
    await emit("VERIFY_COMMAND_FINISHED", { command: "vitest run", status: "passed", exitCode: 0 });
    await emit("VERIFY_FINISHED", { status: "passed", duration: "1.5s" });

    // Needs approval
    await emit("NEEDS_APPROVAL", {
      riskScore: "low",
      factors: [{ reason: "Changes only internal implementation", severity: "low" }],
    }, "awaiting_approval");

    await supabase.from("runs").update({
      risk_assessment: {
        score: "low",
        factors: [{ reason: "Changes only internal implementation", severity: "low" }],
      },
    }).eq("id", runId);

    console.log(`Simulation complete for run ${runId} - awaiting approval`);
  } catch (error) {
    console.error("Simulation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    await emit("RUN_FAILED", { error: message }, "failed");
  }
}
