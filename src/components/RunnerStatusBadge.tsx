import { cn } from "@/lib/utils";
import { useRunnerStatus } from "@/hooks/use-runner-status";
import { Wifi, WifiOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RunnerStatusBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export function RunnerStatusBadge({ className, showLabel = true }: RunnerStatusBadgeProps) {
  const status = useRunnerStatus();

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors",
              status.isOnline
                ? "bg-terminal-green/10 border-terminal-green/30 text-terminal-green"
                : "bg-muted/50 border-border text-muted-foreground",
              className
            )}
          >
            {status.isOnline ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {showLabel && (
              <span>Runner: {status.isOnline ? "Online" : "Offline"}</span>
            )}
            {status.isOnline && (
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Status:</span>
              <span className={status.isOnline ? "text-terminal-green" : "text-muted-foreground"}>
                {status.isOnline ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last heartbeat:</span>
              <span>{formatTime(status.lastHeartbeat)}</span>
            </div>
            {status.version && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Version:</span>
                <span>{status.version}</span>
              </div>
            )}
            {status.capabilities && (
              <div className="pt-1 border-t border-border mt-1">
                <span className="text-muted-foreground">Capabilities:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {status.capabilities.repo_read && (
                    <span className="px-1.5 py-0.5 bg-terminal-cyan/20 text-terminal-cyan rounded text-[10px]">
                      repo_read
                    </span>
                  )}
                  {status.capabilities.patch_apply && (
                    <span className="px-1.5 py-0.5 bg-terminal-green/20 text-terminal-green rounded text-[10px]">
                      patch_apply
                    </span>
                  )}
                  {status.capabilities.docker_verify && (
                    <span className="px-1.5 py-0.5 bg-terminal-blue/20 text-terminal-blue rounded text-[10px]">
                      docker_verify
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
