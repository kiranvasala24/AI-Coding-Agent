import React from "react";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/types/run";
import { 
  Search, 
  FileText, 
  FolderOpen, 
  GitBranch,
  Package,
  Link2,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock
} from "lucide-react";

interface ToolCallsViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  toolCalls: ToolCall[];
}

const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  search: Search,
  open: FileText,
  list_files: FolderOpen,
  propose_patch: GitBranch,
  get_patch: Package,
  symbol_lookup: Link2,
  find_references: Link2,
  get_dependents: Link2,
  sandbox_run: Terminal
};

export const ToolCallsViewer = React.forwardRef<HTMLDivElement, ToolCallsViewerProps>(
  function ToolCallsViewer({ toolCalls, className, ...props }, ref) {
    const formatDuration = (start: string, end?: string) => {
      if (!end) return '...';
      const duration = new Date(end).getTime() - new Date(start).getTime();
      if (duration < 1000) return `${duration}ms`;
      return `${(duration / 1000).toFixed(1)}s`;
    };

    return (
      <div 
        ref={ref}
        className={cn("rounded-lg border border-terminal-border bg-terminal-bg overflow-hidden", className)}
        {...props}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-secondary/50 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-terminal-blue/20 text-terminal-blue text-xs font-mono">
              TOOLS
            </span>
            <span className="text-sm font-medium text-foreground">Tool Calls</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {toolCalls.filter(t => t.status === 'completed').length}/{toolCalls.length} completed
          </span>
        </div>

        <div className="divide-y divide-terminal-border">
          {toolCalls.map((call) => {
            const Icon = toolIcons[call.name] || Terminal;
            const isCompleted = call.status === 'completed';
            const isFailed = call.status === 'failed';
            const isRunning = call.status === 'running';

            return (
              <div 
                key={call.id}
                className={cn(
                  "flex items-start gap-3 p-3 transition-colors",
                  isRunning && "bg-terminal-cyan/5"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0",
                  isCompleted && "bg-terminal-green/10",
                  isFailed && "bg-terminal-red/10",
                  isRunning && "bg-terminal-cyan/10",
                  !isCompleted && !isFailed && !isRunning && "bg-muted"
                )}>
                  <Icon className={cn(
                    "w-4 h-4",
                    isCompleted && "text-terminal-green",
                    isFailed && "text-terminal-red",
                    isRunning && "text-terminal-cyan",
                    !isCompleted && !isFailed && !isRunning && "text-muted-foreground"
                  )} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-mono text-foreground">{call.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDuration(call.startedAt, call.finishedAt)}
                    </span>
                    
                    <div className="ml-auto flex-shrink-0">
                      {isCompleted && <CheckCircle2 className="w-4 h-4 text-terminal-green" />}
                      {isFailed && <XCircle className="w-4 h-4 text-terminal-red" />}
                      {isRunning && <Loader2 className="w-4 h-4 text-terminal-cyan animate-spin" />}
                      {call.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground font-mono mt-1 truncate max-w-full">
                    {JSON.stringify(call.args)}
                  </div>

                  {call.resultSummary && (
                    <div className="text-xs text-terminal-green mt-1 break-words">
                      → {call.resultSummary}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

ToolCallsViewer.displayName = "ToolCallsViewer";
