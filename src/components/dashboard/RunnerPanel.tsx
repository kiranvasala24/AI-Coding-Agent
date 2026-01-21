import React from "react";
import { cn } from "@/lib/utils";
import { useRunnerStatus } from "@/hooks/use-runner-status";
import { Wifi, WifiOff, Server, Clock, Settings, Cpu, HardDrive, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RunnerSetupWizard } from "./RunnerSetupWizard";

interface RunnerPanelProps {
  className?: string;
}

export function RunnerPanel({ className }: RunnerPanelProps) {
  const status = useRunnerStatus();

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 1000) return "just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  const formatTimeout = (ms: number | null) => {
    if (!ms) return "N/A";
    return `${Math.floor(ms / 1000)}s`;
  };

  return (
    <div className={cn("rounded-lg border border-terminal-border bg-terminal-bg p-3 md:p-4", className)}>
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <h3 className="text-sm font-medium">Local Runner</h3>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            status.isOnline
              ? "bg-terminal-green/10 text-terminal-green"
              : "bg-muted text-muted-foreground"
          )}
        >
          {status.isOnline ? (
            <>
              <Wifi className="w-3 h-3 flex-shrink-0" />
              <span className="hidden sm:inline">Online</span>
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 flex-shrink-0" />
              <span>Offline</span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2 md:space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">Last heartbeat</span>
            <span className="sm:hidden">Heartbeat</span>
          </span>
          <span className="font-mono text-xs truncate">
            {formatTime(status.lastHeartbeat)}
            {status.lastHeartbeat && (
              <span className="text-muted-foreground ml-1 hidden lg:inline">
                ({formatRelativeTime(status.lastHeartbeat)})
              </span>
            )}
          </span>
        </div>

        {status.version && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono text-xs">{status.version}</span>
          </div>
        )}

        {status.os && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              System
            </span>
            <span className="font-mono text-xs">
              {status.os.platform} ({status.os.arch})
            </span>
          </div>
        )}

        {status.packageManager && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              Package Manager
            </span>
            <span className="font-mono text-xs">{status.packageManager}</span>
          </div>
        )}

        {status.commandTimeoutMs && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Command Timeout
            </span>
            <span className="font-mono text-xs">{formatTimeout(status.commandTimeoutMs)}</span>
          </div>
        )}

        {status.capabilities && (
          <div className="pt-2 border-t border-terminal-border">
            <span className="text-muted-foreground text-xs">Capabilities</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <CapabilityBadge
                label="repo_read"
                enabled={status.capabilities.repo_read}
                color="cyan"
              />
              <CapabilityBadge
                label="patch_apply"
                enabled={status.capabilities.patch_apply}
                color="green"
              />
              <CapabilityBadge
                label="docker"
                enabled={status.capabilities.docker_verify}
                available={status.capabilities.docker_available}
                color="blue"
              />
              <CapabilityBadge
                label="ripgrep"
                enabled={status.capabilities.ripgrep_available ?? false}
                color="purple"
              />
            </div>
          </div>
        )}

        {status.patchConstraints && (
          <div className="pt-2 border-t border-terminal-border">
            <span className="text-muted-foreground text-xs">Patch Constraints</span>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max files</span>
                <span className="font-mono">{status.patchConstraints.maxFilesChanged}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max diff lines</span>
                <span className="font-mono">{status.patchConstraints.maxDiffLines}</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-between cursor-help">
                      <span className="text-muted-foreground">Denied paths</span>
                      <span className="font-mono text-terminal-yellow">
                        {status.patchConstraints.pathDenylist.length} patterns
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <div className="text-xs space-y-1">
                      <div className="font-medium mb-1">Denied paths:</div>
                      <div className="font-mono text-muted-foreground">
                        {status.patchConstraints.pathDenylist.slice(0, 5).join(", ")}
                        {status.patchConstraints.pathDenylist.length > 5 && 
                          ` +${status.patchConstraints.pathDenylist.length - 5} more`
                        }
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {!status.isOnline && (
          <div className="pt-3 border-t border-terminal-border">
            <RunnerSetupWizard
              trigger={
                <Button variant="outline" size="sm" className="w-full">
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  Connect Local Runner
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CapabilityBadge({
  label,
  enabled,
  available,
  color,
}: {
  label: string;
  enabled: boolean;
  available?: boolean;
  color: "cyan" | "green" | "blue" | "purple";
}) {
  const colorClasses = {
    cyan: enabled ? "bg-terminal-cyan/20 text-terminal-cyan" : "bg-muted text-muted-foreground",
    green: enabled ? "bg-terminal-green/20 text-terminal-green" : "bg-muted text-muted-foreground",
    blue: enabled ? "bg-terminal-blue/20 text-terminal-blue" : "bg-muted text-muted-foreground",
    purple: enabled ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground",
  };

  const indicator = enabled ? "✓" : (available === false ? "✗" : "○");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("px-2 py-0.5 rounded text-xs font-mono cursor-help", colorClasses[color])}>
            {indicator} {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-xs">
            {enabled ? `${label} is enabled` : 
              available === false ? `${label} is not available on this system` :
              `${label} is disabled`}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
