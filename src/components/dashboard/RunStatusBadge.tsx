import { cn } from "@/lib/utils";
import type { RunStatus } from "@/types/run";
import { 
  Clock, 
  Loader2, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Pause,
  Ban
} from "lucide-react";

interface RunStatusBadgeProps {
  status: RunStatus;
  className?: string;
}

const statusConfig: Record<RunStatus, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  className: string;
}> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-muted text-muted-foreground'
  },
  queued: {
    label: 'Queued',
    icon: Clock,
    className: 'bg-terminal-cyan/20 text-terminal-cyan'
  },
  running: {
    label: 'Running',
    icon: Loader2,
    className: 'bg-terminal-blue/20 text-terminal-blue'
  },
  planning: {
    label: 'Planning',
    icon: Loader2,
    className: 'bg-terminal-cyan/20 text-terminal-cyan'
  },
  executing: {
    label: 'Executing',
    icon: Play,
    className: 'bg-terminal-blue/20 text-terminal-blue'
  },
  verifying: {
    label: 'Verifying',
    icon: Loader2,
    className: 'bg-terminal-yellow/20 text-terminal-yellow'
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    icon: AlertTriangle,
    className: 'bg-terminal-yellow/20 text-terminal-yellow'
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'bg-terminal-green/20 text-terminal-green'
  },
  applying: {
    label: 'Applying',
    icon: Loader2,
    className: 'bg-terminal-cyan/20 text-terminal-cyan'
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'bg-terminal-green/20 text-terminal-green'
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-terminal-red/20 text-terminal-red'
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    className: 'bg-muted text-muted-foreground'
  }
};

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = ['planning', 'executing', 'verifying', 'applying', 'running'].includes(status);

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono",
      config.className,
      className
    )}>
      <Icon className={cn("w-3 h-3", isAnimated && "animate-spin")} />
      {config.label}
    </span>
  );
}
