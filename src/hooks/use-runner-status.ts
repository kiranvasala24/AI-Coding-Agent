import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RunnerCapabilities {
  repo_read: boolean;
  patch_apply: boolean;
  docker_verify: boolean;
  docker_available?: boolean;
  ripgrep_available?: boolean;
}

export interface RunnerOsInfo {
  platform: string;
  arch: string;
  release: string;
}

export interface RunnerPatchConstraints {
  maxFilesChanged: number;
  maxDiffLines: number;
  pathDenylist: string[];
  binaryExtensions: string[];
}

export interface RunnerStatus {
  isOnline: boolean;
  lastHeartbeat: string | null;
  version: string | null;
  capabilities: RunnerCapabilities | null;
  runnerId: string | null;
  os: RunnerOsInfo | null;
  packageManager: string | null;
  commandTimeoutMs: number | null;
  patchConstraints: RunnerPatchConstraints | null;
}

const HEARTBEAT_THRESHOLD_MS = 30000; // 30 seconds (generous for network latency)

export function useRunnerStatus() {
  const [status, setStatus] = useState<RunnerStatus>({
    isOnline: false,
    lastHeartbeat: null,
    version: null,
    capabilities: null,
    runnerId: null,
    os: null,
    packageManager: null,
    commandTimeoutMs: null,
    patchConstraints: null,
  });

  const checkStatus = useCallback(async () => {
    try {
      // Query for most recent RUNNER_HEARTBEAT event
      const { data, error } = await supabase
        .from("run_events")
        .select("*")
        .eq("event_type", "RUNNER_HEARTBEAT")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching runner status:", error);
        return;
      }

      if (!data) {
        setStatus({
          isOnline: false,
          lastHeartbeat: null,
          version: null,
          capabilities: null,
          runnerId: null,
          os: null,
          packageManager: null,
          commandTimeoutMs: null,
          patchConstraints: null,
        });
        return;
      }

      const heartbeatTime = new Date(data.created_at).getTime();
      const now = Date.now();
      const isOnline = now - heartbeatTime < HEARTBEAT_THRESHOLD_MS;

      const payload = data.payload as Record<string, unknown> | null;
      
      // Map from payload - handle both camelCase and snake_case from runner/edge function
      const capabilities = payload?.capabilities as Record<string, boolean> | null;
      
      // Handle runner_id vs runnerId naming
      const runnerId = (payload?.runner_id as string) || (payload?.runnerId as string) || null;
      
      // Handle package_manager vs packageManager naming
      const packageManager = (payload?.package_manager as string) || (payload?.packageManager as string) || null;
      
      // Handle command_timeout_ms vs commandTimeoutMs naming
      const commandTimeoutMs = (payload?.command_timeout_ms as number) || (payload?.commandTimeoutMs as number) || null;
      
      // Handle patch_constraints vs patchConstraints naming
      const patchConstraints = (payload?.patch_constraints as RunnerPatchConstraints) || (payload?.patchConstraints as RunnerPatchConstraints) || null;
      
      setStatus({
        isOnline,
        lastHeartbeat: data.created_at,
        version: (payload?.version as string) || null,
        capabilities: capabilities ? {
          repo_read: capabilities.repo_read ?? capabilities.repoRead ?? false,
          patch_apply: capabilities.patch_apply ?? capabilities.patchApply ?? false,
          docker_verify: capabilities.docker_verify ?? capabilities.dockerVerify ?? false,
          docker_available: capabilities.docker_available ?? capabilities.dockerAvailable,
          ripgrep_available: capabilities.ripgrep_available ?? capabilities.ripgrepAvailable,
        } : null,
        runnerId,
        os: (payload?.os as RunnerOsInfo) || null,
        packageManager,
        commandTimeoutMs,
        patchConstraints,
      });
    } catch (err) {
      console.error("Error checking runner status:", err);
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);

    // Subscribe to new heartbeat events
    const channel = supabase
      .channel("runner-heartbeat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "run_events",
          filter: "event_type=eq.RUNNER_HEARTBEAT",
        },
        () => {
          checkStatus();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [checkStatus]);

  return status;
}
