import { supabase } from "@/integrations/supabase/client";
import type { Run, RunEvent, RunEventType, Patch, FileChange, DiffLine } from "@/types/run";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// Database patch row type
interface DbPatch {
  id: string;
  run_id: string;
  summary: string;
  files_changed: Array<{
    path: string;
    additions: number;
    deletions: number;
    diff: Array<{ type: string; content: string; lineNumber?: { old?: number; new?: number } }>;
  }>;
  total_additions: number;
  total_deletions: number;
  reasoning: string | null;
  constraints_used: string[] | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  applied: boolean;
  applied_at: string | null;
  created_at: string;
}

// Database run row type
interface DbRun {
  id: string;
  status: Run["status"];
  created_at: string;
  updated_at: string;
  task: string;
  plan?: Run["plan"];
  tool_calls?: Run["toolCalls"];
  patches?: Run["patches"];
  verification?: Run["verification"];
  approval?: Run["approval"];
  risk_assessment?: Run["riskAssessment"];
  impacted_files?: Run["impactedFiles"];
  impacted_symbols?: Run["impactedSymbols"];
  error?: Run["error"];
}

// Convert database row to Run type
function dbToRun(row: DbRun): Run {
  return {
    runId: row.id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    task: row.task,
    plan: row.plan,
    toolCalls: row.tool_calls || [],
    patches: row.patches || [],
    verification: row.verification,
    approval: row.approval || { required: true },
    riskAssessment: row.risk_assessment,
    impactedFiles: row.impacted_files,
    impactedSymbols: row.impacted_symbols,
    error: row.error,
  };
}

// Convert database patch row to Patch type
function dbToPatch(row: DbPatch): Patch {
  return {
    patchId: row.id,
    summary: row.summary,
    filesChanged: row.files_changed.map((f) => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      diff: f.diff.map((d) => ({
        type: d.type as DiffLine["type"],
        content: d.content,
        lineNumber: d.lineNumber,
      })),
    })),
    totalAdditions: row.total_additions,
    totalDeletions: row.total_deletions,
    createdAt: row.created_at,
    reasoning: row.reasoning || "",
    constraintsUsed: row.constraints_used || [],
  };
}

export async function createRun(task: string): Promise<{ runId: string }> {
  const response = await fetch(`${FUNCTIONS_URL}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ task }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create run");
  }

  return response.json();
}

export async function getRun(runId: string): Promise<Run | null> {
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return dbToRun(data);
}

export async function listRuns(limit = 50): Promise<Run[]> {
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(dbToRun);
}

export async function cancelRun(runId: string): Promise<void> {
  const response = await fetch(`${FUNCTIONS_URL}/runs/${runId}/cancel`, {
    method: "POST",
    headers: {
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to cancel run");
  }
}

export async function approveRun(
  runId: string,
  approved: boolean,
  approvedBy?: string,
  reason?: string
): Promise<void> {
  const response = await fetch(`${FUNCTIONS_URL}/runs/${runId}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ approved, approvedBy, reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to approve run");
  }
}

export async function simulateRun(runId: string): Promise<void> {
  const response = await fetch(`${FUNCTIONS_URL}/runs/${runId}/simulate`, {
    method: "POST",
    headers: {
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to start simulation");
  }
}

export type RunEventHandler = (event: RunEvent) => void;

export function subscribeToRunEvents(
  runId: string,
  onEvent: RunEventHandler,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(
    `${FUNCTIONS_URL}/run-events?runId=${runId}`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Skip heartbeat events
      if (data.type === "HEARTBEAT" || data.type === "CONNECTED") {
        console.log(`SSE ${data.type} for run ${runId}`);
        return;
      }

      onEvent({
        eventId: data.eventId || crypto.randomUUID(),
        runId: data.runId || runId,
        type: data.type as RunEventType,
        timestamp: data.timestamp || new Date().toISOString(),
        payload: data.payload || {},
      });
    } catch (err) {
      console.error("Failed to parse SSE event:", err);
    }
  };

  eventSource.onerror = (error) => {
    console.error("SSE error:", error);
    onError?.(new Error("SSE connection error"));
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

// Subscribe to run state changes via Supabase Realtime
export function subscribeToRunChanges(
  runId: string,
  onUpdate: (run: Run) => void
): () => void {
  const channel = supabase
    .channel(`run-${runId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "runs",
        filter: `id=eq.${runId}`,
      },
      (payload) => {
        onUpdate(dbToRun(payload.new));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============= Patch API =============

export async function getRunPatches(runId: string): Promise<Patch[]> {
  const response = await fetch(`${FUNCTIONS_URL}/runs/${runId}/patches`, {
    headers: {
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch patches");
  }

  const data = await response.json();
  return (data || []).map(dbToPatch);
}

export async function getPatch(patchId: string): Promise<Patch | null> {
  const response = await fetch(`${FUNCTIONS_URL}/patches/${patchId}`, {
    headers: {
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch patch");
  }

  const data = await response.json();
  return dbToPatch(data);
}

export interface ApplyPatchResult {
  success: boolean;
  patchId: string;
  appliedAt: string;
  filesAffected: number;
}

export interface ApplyPatchError {
  error: string;
  message?: string;
  errors?: string[];
}

export async function applyPatch(patchId: string): Promise<ApplyPatchResult> {
  const response = await fetch(`${FUNCTIONS_URL}/patches/${patchId}/apply`, {
    method: "POST",
    headers: {
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to apply patch");
  }

  return data;
}

export interface ValidatePatchResult {
  patchId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  constraints: {
    maxFilesChanged: number;
    maxDiffLines: number;
    pathDenylist: string[];
    binaryExtensions: string[];
  };
}

export async function validatePatch(patchId: string): Promise<ValidatePatchResult> {
  const response = await fetch(`${FUNCTIONS_URL}/patches/${patchId}/validate`, {
    method: "POST",
    headers: {
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to validate patch");
  }

  return response.json();
}
