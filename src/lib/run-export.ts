/**
 * Run Export Utility
 * 
 * Export run data as JSON for debugging and demos.
 */

import type { Run, Patch } from "@/types/run";
import { supabase } from "@/integrations/supabase/client";

export interface RunExport {
  exportedAt: string;
  run: {
    id: string;
    task: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    duration: string;
  };
  plan: Run["plan"] | null;
  toolCalls: Run["toolCalls"];
  patches: {
    id: string;
    summary: string;
    filesChanged: number;
    totalAdditions: number;
    totalDeletions: number;
    approved: boolean;
    applied: boolean;
    reasoning: string;
  }[];
  verification: Run["verification"] | null;
  approval: Run["approval"];
  riskAssessment: Run["riskAssessment"] | null;
  error: Run["error"] | null;
  events: {
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }[];
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export async function exportRun(run: Run): Promise<RunExport> {
  // Fetch events for this run
  const { data: events } = await supabase
    .from("run_events")
    .select("*")
    .eq("run_id", run.runId)
    .order("created_at", { ascending: true });

  // Fetch patches for this run
  const { data: patches } = await supabase
    .from("patches")
    .select("*")
    .eq("run_id", run.runId)
    .order("created_at", { ascending: true });

  return {
    exportedAt: new Date().toISOString(),
    run: {
      id: run.runId,
      task: run.task,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      duration: formatDuration(run.createdAt, run.updatedAt),
    },
    plan: run.plan || null,
    toolCalls: run.toolCalls || [],
    patches: (patches || []).map((p) => ({
      id: p.id,
      summary: p.summary,
      filesChanged: Array.isArray(p.files_changed) ? p.files_changed.length : 0,
      totalAdditions: p.total_additions,
      totalDeletions: p.total_deletions,
      approved: p.approved ?? false,
      applied: p.applied ?? false,
      reasoning: p.reasoning || "",
    })),
    verification: run.verification || null,
    approval: run.approval,
    riskAssessment: run.riskAssessment || null,
    error: run.error || null,
    events: (events || []).map((e) => ({
      type: e.event_type,
      timestamp: e.created_at,
      payload: (e.payload as Record<string, unknown>) || {},
    })),
  };
}

export function downloadRunExport(data: RunExport, filename?: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `run-${data.run.id}-export.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
