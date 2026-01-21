import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-runner-token",
};

const RUNNER_TOKEN = Deno.env.get("RUNNER_TOKEN") || "demo-runner-token";

function validateRunnerToken(req: Request): boolean {
  const token = req.headers.get("x-runner-token");
  return !token || token === RUNNER_TOKEN; // Allow non-token requests (from browser) but validate if token is present
}

// Patch constraints
const CONSTRAINTS = {
  maxFilesChanged: 10,
  maxDiffLines: 300,
  pathDenylist: [
    ".env",
    ".env.local",
    ".env.production",
    "secrets",
    "node_modules",
    "dist",
    "build",
    ".git",
    "package-lock.json",
    "bun.lockb",
    "yarn.lock",
    "pnpm-lock.yaml",
  ],
  binaryExtensions: [".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip"],
};

interface PatchRequest {
  runId: string;
  summary: string;
  filesChanged: Array<{
    path: string;
    additions: number;
    deletions: number;
    diff: Array<{ type: string; content: string }>;
  }>;
  reasoning?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validatePatch(patch: PatchRequest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file count
  if (patch.filesChanged.length > CONSTRAINTS.maxFilesChanged) {
    errors.push(`Too many files changed: ${patch.filesChanged.length} > ${CONSTRAINTS.maxFilesChanged}`);
  }

  // Check total diff lines
  let totalLines = 0;
  for (const file of patch.filesChanged) {
    totalLines += file.additions + file.deletions;

    // Check path denylist
    for (const denied of CONSTRAINTS.pathDenylist) {
      if (file.path.includes(denied)) {
        errors.push(`Forbidden path: ${file.path} matches denylist pattern "${denied}"`);
      }
    }

    // Check binary extensions
    for (const ext of CONSTRAINTS.binaryExtensions) {
      if (file.path.endsWith(ext)) {
        errors.push(`Binary file not allowed: ${file.path}`);
      }
    }

    // Warn about sensitive paths
    if (file.path.includes("auth") || file.path.includes("payment") || file.path.includes("security")) {
      warnings.push(`Sensitive path detected: ${file.path} - review carefully`);
    }
  }

  if (totalLines > CONSTRAINTS.maxDiffLines) {
    errors.push(`Diff too large: ${totalLines} lines > ${CONSTRAINTS.maxDiffLines} max`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const patchId = pathParts[1];
  const action = pathParts[2];
  // Validate runner token if provided
  if (!validateRunnerToken(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized", message: "Invalid x-runner-token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // GET /patches - List all patches (optional runId filter)
    if (req.method === "GET" && !patchId) {
      const runId = url.searchParams.get("runId");
      let query = supabase.from("patches").select("*").order("created_at", { ascending: false });

      if (runId) {
        query = query.eq("run_id", runId);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /patches - Create a new patch
    if (req.method === "POST" && !patchId) {
      const body: PatchRequest = await req.json();

      if (!body.runId || !body.summary || !body.filesChanged) {
        return new Response(JSON.stringify({ error: "runId, summary, and filesChanged are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate patch against constraints
      const validation = validatePatch(body);

      if (!validation.valid) {
        // Store the rejection in events
        await supabase.from("run_events").insert({
          run_id: body.runId,
          event_type: "PATCH_REJECTED",
          payload: { errors: validation.errors, warnings: validation.warnings },
        });

        console.log(`Patch rejected for run ${body.runId}:`, validation.errors);

        return new Response(JSON.stringify({
          error: "Patch validation failed",
          errors: validation.errors,
          warnings: validation.warnings,
        }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate totals
      const totalAdditions = body.filesChanged.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = body.filesChanged.reduce((sum, f) => sum + f.deletions, 0);

      const { data: patch, error: patchError } = await supabase
        .from("patches")
        .insert({
          run_id: body.runId,
          summary: body.summary,
          files_changed: body.filesChanged,
          total_additions: totalAdditions,
          total_deletions: totalDeletions,
          reasoning: body.reasoning || "",
          constraints_used: [
            `max_files: ${CONSTRAINTS.maxFilesChanged}`,
            `max_lines: ${CONSTRAINTS.maxDiffLines}`,
            `path_denylist: ${CONSTRAINTS.pathDenylist.length} patterns`,
          ],
        })
        .select()
        .single();

      if (patchError) throw patchError;

      // Emit event
      await supabase.from("run_events").insert({
        run_id: body.runId,
        event_type: "PATCH_PROPOSED",
        payload: {
          patchId: patch.id,
          summary: body.summary,
          filesCount: body.filesChanged.length,
          additions: totalAdditions,
          deletions: totalDeletions,
          warnings: validation.warnings,
        },
      });

      // Update run with patch reference
      const { data: run } = await supabase.from("runs").select("patches").eq("id", body.runId).single();
      const existingPatches = run?.patches || [];
      await supabase.from("runs").update({
        patches: [...existingPatches, { patchId: patch.id, summary: body.summary }]
      }).eq("id", body.runId);

      console.log(`Created patch ${patch.id} for run ${body.runId}`);

      return new Response(JSON.stringify({
        patchId: patch.id,
        warnings: validation.warnings,
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /patches/:id - Get patch by ID
    if (req.method === "GET" && patchId && !action) {
      const { data, error } = await supabase
        .from("patches")
        .select("*")
        .eq("id", patchId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Patch not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /patches/:id/apply - Apply a patch (REQUIRES APPROVAL)
    if (req.method === "POST" && patchId && action === "apply") {
      // Fetch patch with run info
      const { data: patch, error: patchError } = await supabase
        .from("patches")
        .select("*, runs!inner(id, status, approval)")
        .eq("id", patchId)
        .maybeSingle();

      if (patchError) throw patchError;
      if (!patch) {
        return new Response(JSON.stringify({ error: "Patch not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CRITICAL: Check approval status
      if (!patch.approved) {
        await supabase.from("run_events").insert({
          run_id: patch.run_id,
          event_type: "APPLY_BLOCKED",
          payload: { patchId, reason: "Patch not approved" },
        });

        console.log(`Apply blocked for patch ${patchId}: not approved`);

        return new Response(JSON.stringify({
          error: "Patch not approved",
          message: "Cannot apply patch without approval. Run must be in 'approved' state.",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already applied
      if (patch.applied) {
        return new Response(JSON.stringify({
          error: "Patch already applied",
          appliedAt: patch.applied_at,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-validate constraints before applying (in case rules changed)
      const revalidation = validatePatch({
        runId: patch.run_id,
        summary: patch.summary,
        filesChanged: patch.files_changed,
      });

      if (!revalidation.valid) {
        await supabase.from("run_events").insert({
          run_id: patch.run_id,
          event_type: "APPLY_BLOCKED",
          payload: { patchId, reason: "Constraint violation", errors: revalidation.errors },
        });

        return new Response(JSON.stringify({
          error: "Patch violates current constraints",
          errors: revalidation.errors,
        }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as applying
      await supabase.from("run_events").insert({
        run_id: patch.run_id,
        event_type: "APPLY_STARTED",
        payload: { patchId },
      });

      await supabase.from("runs").update({ status: "applying" }).eq("id", patch.run_id);

      // In a real system, this would apply the patch to the filesystem
      // For now, we simulate successful application
      const now = new Date().toISOString();

      await supabase.from("patches").update({
        applied: true,
        applied_at: now,
      }).eq("id", patchId);

      await supabase.from("run_events").insert({
        run_id: patch.run_id,
        event_type: "APPLY_FINISHED",
        payload: { patchId, appliedAt: now },
      });

      await supabase.from("runs").update({ status: "completed" }).eq("id", patch.run_id);

      console.log(`Patch ${patchId} applied successfully`);

      return new Response(JSON.stringify({
        success: true,
        patchId,
        appliedAt: now,
        filesAffected: patch.files_changed.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /patches/:id/validate - Validate patch without applying
    if (req.method === "POST" && patchId && action === "validate") {
      const { data: patch, error } = await supabase
        .from("patches")
        .select("*")
        .eq("id", patchId)
        .maybeSingle();

      if (error) throw error;
      if (!patch) {
        return new Response(JSON.stringify({ error: "Patch not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const validation = validatePatch({
        runId: patch.run_id,
        summary: patch.summary,
        filesChanged: patch.files_changed,
      });

      return new Response(JSON.stringify({
        patchId,
        ...validation,
        constraints: CONSTRAINTS,
      }), {
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
