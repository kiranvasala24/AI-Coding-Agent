/**
 * Supabase Client for Runner
 * 
 * Handles communication with Supabase backend via edge functions.
 * Includes retry logic for network resilience.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

const FUNCTIONS_URL = `${config.supabaseUrl}/functions/v1`;
export const supabase = createClient(config.supabaseUrl, config.supabaseKey);

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.supabaseKey}`,
    "x-runner-token": config.runnerToken,
  };
}

/**
 * Retry wrapper for network calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[supabase] Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

export async function sendHeartbeat(): Promise<void> {
  await withRetry(async () => {
    const response = await fetch(`${FUNCTIONS_URL}/runner/heartbeat`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        runnerId: config.runnerId,
        version: config.version,
        capabilities: {
          repoRead: true,
          patchApply: true,
          dockerVerify: config.dockerEnabled,
          dockerAvailable: config.dockerAvailable,
          ripgrepAvailable: config.ripgrepAvailable,
        },
        os: config.os,
        packageManager: config.packageManager,
        commandTimeoutMs: config.commandTimeoutMs,
        patchConstraints: config.patchConstraints,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Heartbeat failed: ${response.status} - ${body}`);
    }
  }, 3, 500);
}

export async function getQueuedRuns(): Promise<Array<{ id: string; task: string }>> {
  const { data, error } = await supabase
    .from("runs")
    .select("id, task")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  
  if (error) throw error;
  return data || [];
}

export async function claimRun(runId: string): Promise<{ claimed: boolean; run?: any }> {
  const response = await fetch(`${FUNCTIONS_URL}/runner/claim-run`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ runnerId: config.runnerId, runId }),
  });
  
  if (!response.ok) {
    const body = await response.text();
    console.error(`[supabase] Claim run failed: ${response.status} - ${body}`);
    return { claimed: false };
  }
  
  const data = await response.json();
  return { claimed: !!data.run, run: data.run };
}

export interface RunnerEvent {
  type: string;
  payload: Record<string, unknown>;
}

export async function postEvents(runId: string, events: RunnerEvent[]): Promise<void> {
  await withRetry(async () => {
    const response = await fetch(`${FUNCTIONS_URL}/runner/events`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ runId, events }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Post events failed: ${response.status} - ${body}`);
    }
  }, 2, 300);
}

export async function updateRun(runId: string, updates: Record<string, unknown>): Promise<void> {
  await withRetry(async () => {
    const response = await fetch(`${FUNCTIONS_URL}/runner/update-run`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ runId, ...updates }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Update run failed: ${response.status} - ${body}`);
    }
  }, 2, 300);
}

export async function markPatchApplied(runId: string, patchId: string, filesAffected: number): Promise<void> {
  await withRetry(async () => {
    const response = await fetch(`${FUNCTIONS_URL}/runner/patch-applied`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ runId, patchId, filesAffected }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mark patch applied failed: ${response.status} - ${body}`);
    }
  }, 2, 300);
}

export async function createPatch(
  runId: string,
  summary: string,
  filesChanged: Array<{
    path: string;
    additions: number;
    deletions: number;
    diff: Array<{ type: string; content: string; lineNumber?: { old?: number; new?: number } }>;
  }>,
  reasoning?: string
): Promise<{ id: string }> {
  const totalAdditions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = filesChanged.reduce((sum, f) => sum + f.deletions, 0);
  
  const { data, error } = await supabase
    .from("patches")
    .insert({
      run_id: runId,
      summary,
      files_changed: filesChanged,
      total_additions: totalAdditions,
      total_deletions: totalDeletions,
      reasoning: reasoning || null,
      constraints_used: [],
      approved: false,
      applied: false,
    })
    .select("id")
    .single();
  
  if (error) throw error;
  return { id: data.id };
}
