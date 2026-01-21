import { cn } from "@/lib/utils";
import type { Plan, PlanStep } from "@/types/run";
import { 
  Search, 
  FileEdit, 
  TestTube, 
  CheckCircle, 
  FilePlus,
  Trash2,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface PlanViewerProps {
  plan: Plan;
  className?: string;
}

const actionIcons: Record<PlanStep['action'], React.ComponentType<{ className?: string }>> = {
  analyze: Search,
  modify: FileEdit,
  test: TestTube,
  verify: CheckCircle,
  create: FilePlus,
  delete: Trash2
};

const statusIcons: Record<PlanStep['status'], React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
  failed: XCircle
};

export function PlanViewer({ plan, className }: PlanViewerProps) {
  return (
    <div className={cn("rounded-lg border border-terminal-border bg-terminal-bg overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded bg-terminal-cyan/20 text-terminal-cyan text-xs font-mono">
            PLAN
          </span>
          <span className="text-sm font-medium text-foreground">{plan.task}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {plan.steps.length} steps
        </span>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-3">
        {plan.steps.map((step, index) => {
          const ActionIcon = actionIcons[step.action];
          const StatusIcon = statusIcons[step.status];
          const isCompleted = step.status === 'completed';
          const isFailed = step.status === 'failed';
          const isInProgress = step.status === 'in_progress';

          return (
            <div 
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                isCompleted && "border-terminal-green/30 bg-terminal-green/5",
                isFailed && "border-terminal-red/30 bg-terminal-red/5",
                isInProgress && "border-terminal-cyan/30 bg-terminal-cyan/5",
                !isCompleted && !isFailed && !isInProgress && "border-terminal-border bg-secondary/20"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono",
                isCompleted && "bg-terminal-green/20 text-terminal-green",
                isFailed && "bg-terminal-red/20 text-terminal-red",
                isInProgress && "bg-terminal-cyan/20 text-terminal-cyan",
                !isCompleted && !isFailed && !isInProgress && "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ActionIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-mono uppercase text-muted-foreground">
                    {step.action}
                  </span>
                  <StatusIcon className={cn(
                    "w-4 h-4 ml-auto",
                    isCompleted && "text-terminal-green",
                    isFailed && "text-terminal-red",
                    isInProgress && "text-terminal-cyan animate-spin",
                    !isCompleted && !isFailed && !isInProgress && "text-muted-foreground"
                  )} />
                </div>
                <div className="text-sm text-foreground font-mono truncate">
                  {step.target}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {step.reason}
                </div>
                {step.changes && (
                  <div className="text-xs text-terminal-cyan mt-1 font-mono">
                    → {step.changes}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Risks & Criteria */}
      <div className="grid md:grid-cols-2 gap-4 p-4 border-t border-terminal-border bg-secondary/20">
        <div>
          <h4 className="text-xs font-mono uppercase text-muted-foreground mb-2">Risks</h4>
          <ul className="space-y-1">
            {plan.risks.map((risk, i) => (
              <li key={i} className="text-xs text-terminal-yellow flex items-start gap-2">
                <span className="text-terminal-yellow">⚠</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-mono uppercase text-muted-foreground mb-2">Acceptance Criteria</h4>
          <ul className="space-y-1">
            {plan.acceptanceCriteria.map((criteria, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-terminal-green">✓</span>
                {criteria}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
