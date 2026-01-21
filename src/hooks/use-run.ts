import { useState, useEffect, useCallback, useRef } from "react";
import type { Run, RunEvent } from "@/types/run";
import {
  createRun,
  getRun,
  approveRun,
  subscribeToRunChanges,
} from "@/lib/runs-client";
import { mockRun } from "@/mocks/runs.mock";

interface UseRunOptions {
  useMock?: boolean;
}

interface UseRunReturn {
  run: Run | null;
  isLoading: boolean;
  error: Error | null;
  events: RunEvent[];
  startRun: (task: string) => Promise<void>;
  approve: () => Promise<void>;
  reject: (reason?: string) => Promise<void>;
  reset: () => void;
}

export function useRun(options: UseRunOptions = {}): UseRunReturn {
  const { useMock = false } = options;
  
  const [run, setRun] = useState<Run | null>(useMock ? mockRun : null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startRun = useCallback(async (task: string) => {
    if (useMock) {
      setRun({ ...mockRun, task, status: "pending" });
      setTimeout(() => setRun(prev => prev ? { ...prev, status: "planning" } : null), 500);
      setTimeout(() => setRun(prev => prev ? { ...prev, status: "executing" } : null), 1500);
      setTimeout(() => setRun(prev => prev ? { ...prev, status: "verifying" } : null), 2500);
      setTimeout(() => setRun(prev => prev ? { ...prev, status: "awaiting_approval" } : null), 3500);
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvents([]);

    try {
      // Create the run (status will be 'queued')
      const { runId } = await createRun(task);
      console.log(`[use-run] Created run ${runId}, waiting for runner to claim it...`);
      
      // Fetch initial state
      const initialRun = await getRun(runId);
      setRun(initialRun);

      // Subscribe to run changes via Realtime
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      unsubscribeRef.current = subscribeToRunChanges(runId, (updatedRun) => {
        console.log(`[use-run] Realtime update: ${updatedRun.status}`);
        setRun(updatedRun);
      });

      // Start polling as fallback (realtime may have delays)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const updatedRun = await getRun(runId);
          if (updatedRun) {
            setRun(prev => {
              // Only update if status changed (avoid unnecessary re-renders)
              if (!prev || prev.status !== updatedRun.status || prev.updatedAt !== updatedRun.updatedAt) {
                console.log(`[use-run] Poll update: ${updatedRun.status}`);
                return updatedRun;
              }
              return prev;
            });
            // Stop polling if run is in a terminal state
            if (['completed', 'failed', 'cancelled'].includes(updatedRun.status)) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            }
          }
        } catch (err) {
          console.error("[use-run] Polling error:", err);
        }
      }, 1000);

      // NOTE: Don't call simulateRun - the real runner will pick up the queued run
      // The run stays as 'queued' until a runner claims it
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to start run"));
    } finally {
      setIsLoading(false);
    }
  }, [useMock]);

  const approve = useCallback(async () => {
    if (!run) return;

    if (useMock) {
      setRun(prev => prev ? {
        ...prev,
        status: "approved",
        approval: {
          ...prev.approval,
          approvedBy: "you",
          approvedAt: new Date().toISOString(),
        },
      } : null);
      return;
    }

    try {
      await approveRun(run.runId, true, "user");
      // Fetch updated state immediately
      const updatedRun = await getRun(run.runId);
      if (updatedRun) setRun(updatedRun);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to approve"));
    }
  }, [run, useMock]);

  const reject = useCallback(async (reason?: string) => {
    if (!run) return;

    if (useMock) {
      setRun(prev => prev ? {
        ...prev,
        status: "failed",
        approval: {
          ...prev.approval,
          rejectedBy: "you",
          rejectedAt: new Date().toISOString(),
          reason: reason || "Rejected by user",
        },
      } : null);
      return;
    }

    try {
      await approveRun(run.runId, false, "user", reason);
      // Fetch updated state immediately
      const updatedRun = await getRun(run.runId);
      if (updatedRun) setRun(updatedRun);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to reject"));
    }
  }, [run, useMock]);

  const reset = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setRun(useMock ? mockRun : null);
    setEvents([]);
    setError(null);
  }, [useMock]);

  return {
    run,
    isLoading,
    error,
    events,
    startRun,
    approve,
    reject,
    reset,
  };
}
