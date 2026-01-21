import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PhaseCardProps {
  phase: number;
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  status: "completed" | "current" | "upcoming";
  delay?: number;
}

export function PhaseCard({ phase, title, description, icon: Icon, features, status, delay = 0 }: PhaseCardProps) {
  const statusStyles = {
    completed: "border-success/50 bg-success/5",
    current: "border-primary/50 bg-primary/5 glow-primary",
    upcoming: "border-border bg-card/50",
  };

  const statusBadge = {
    completed: "bg-success/20 text-success border-success/30",
    current: "bg-primary/20 text-primary border-primary/30 animate-glow-pulse",
    upcoming: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-6 transition-all duration-500 hover:scale-[1.02] hover:border-primary/50",
        statusStyles[status]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Phase indicator */}
      <div className="absolute -top-3 left-6">
        <span className={cn(
          "inline-flex items-center px-3 py-1 rounded-full text-xs font-mono border",
          statusBadge[status]
        )}>
          Phase {phase}
        </span>
      </div>

      <div className="mt-2">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 rounded-lg bg-secondary">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {description}
        </p>

        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-1">→</span>
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
