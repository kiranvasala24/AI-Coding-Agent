import React from "react";
import { cn } from "@/lib/utils";
import type { Verification } from "@/types/run";
import { Terminal } from "@/components/Terminal";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ShieldCheck
} from "lucide-react";

interface VerificationViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  verification: Verification;
}

export const VerificationViewer = React.forwardRef<HTMLDivElement, VerificationViewerProps>(
  function VerificationViewer({ verification, className, ...props }, ref) {
    const formatDuration = (start?: string, end?: string) => {
      if (!start || !end) return '';
      const duration = new Date(end).getTime() - new Date(start).getTime();
      return `${(duration / 1000).toFixed(1)}s`;
    };

    return (
      <div
        ref={ref}
        className={cn("rounded-lg border border-terminal-border bg-terminal-bg overflow-hidden", className)}
        {...props}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-1 rounded text-xs font-mono",
              verification.overallStatus === 'passed' && "bg-terminal-green/20 text-terminal-green",
              verification.overallStatus === 'failed' && "bg-terminal-red/20 text-terminal-red",
              verification.overallStatus === 'running' && "bg-terminal-yellow/20 text-terminal-yellow",
              verification.overallStatus === 'pending' && "bg-muted text-muted-foreground"
            )}>
              VERIFY
            </span>
            <span className="text-sm font-medium text-foreground">Verification</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-terminal-cyan/30 bg-terminal-cyan/5 text-terminal-cyan text-[10px] font-bold">
              <ShieldCheck className="w-3 h-3" />
              SANDBOXED
            </div>
          </div>
          {verification.startedAt && verification.finishedAt && (
            <span className="text-xs text-muted-foreground font-mono">
              {formatDuration(verification.startedAt, verification.finishedAt)}
            </span>
          )}
        </div>

        <div className="p-4 space-y-4">
          {verification.commands.map((cmd, index) => {
            const isPassed = cmd.status === 'passed';
            const isFailed = cmd.status === 'failed';
            const isRunning = cmd.status === 'running';

            // Convert logs to terminal format
            const terminalLines = cmd.logs.map(log => {
              if (log.startsWith('$')) {
                return { type: 'command' as const, content: log.slice(2) };
              }
              if (log.includes('✓') || log.includes('passed')) {
                return { type: 'success' as const, content: log };
              }
              if (log.includes('✗') || log.includes('failed') || log.includes('error')) {
                return { type: 'error' as const, content: log };
              }
              return { type: 'output' as const, content: log };
            });

            return (
              <div key={index} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded break-all">
                    {cmd.command}
                  </code>
                  {isPassed && <CheckCircle2 className="w-4 h-4 text-terminal-green flex-shrink-0" />}
                  {isFailed && <XCircle className="w-4 h-4 text-terminal-red flex-shrink-0" />}
                  {isRunning && <Loader2 className="w-4 h-4 text-terminal-yellow animate-spin flex-shrink-0" />}
                  {cmd.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />}

                  {cmd.exitCode !== undefined && (
                    <span className={cn(
                      "text-xs font-mono ml-auto flex-shrink-0",
                      cmd.exitCode === 0 ? "text-terminal-green" : "text-terminal-red"
                    )}>
                      exit {cmd.exitCode}
                    </span>
                  )}
                </div>

                {cmd.logs.length > 0 && (
                  <Terminal
                    lines={terminalLines}
                    title={cmd.command}
                    autoPlay={false}
                    className="max-h-[300px] overflow-y-auto"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

VerificationViewer.displayName = "VerificationViewer";
