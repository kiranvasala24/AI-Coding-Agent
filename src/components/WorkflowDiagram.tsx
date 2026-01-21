import { ArrowRight, FileCode, GitBranch, CheckCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: FileCode,
    label: "Plan",
    description: "Analyze task & create structured plan",
    color: "text-terminal-cyan",
    bgColor: "bg-terminal-cyan/10",
    borderColor: "border-terminal-cyan/30",
  },
  {
    icon: GitBranch,
    label: "Act",
    description: "Generate code patches using tools",
    color: "text-terminal-purple",
    bgColor: "bg-terminal-purple/10",
    borderColor: "border-terminal-purple/30",
  },
  {
    icon: CheckCircle,
    label: "Verify",
    description: "Run tests in isolated sandbox",
    color: "text-terminal-yellow",
    bgColor: "bg-terminal-yellow/10",
    borderColor: "border-terminal-yellow/30",
  },
  {
    icon: Shield,
    label: "Approve",
    description: "Human review before applying",
    color: "text-terminal-green",
    bgColor: "bg-terminal-green/10",
    borderColor: "border-terminal-green/30",
  },
];

export function WorkflowDiagram() {
  return (
    <div className="relative">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center">
            <div
              className={cn(
                "relative flex flex-col items-center p-6 rounded-xl border transition-all duration-300 hover:scale-105 group",
                step.bgColor,
                step.borderColor
              )}
            >
              <div className={cn("p-3 rounded-lg mb-3", step.bgColor)}>
                <step.icon className={cn("w-6 h-6", step.color)} />
              </div>
              <span className={cn("font-semibold text-lg mb-1", step.color)}>
                {step.label}
              </span>
              <span className="text-xs text-muted-foreground text-center max-w-[120px]">
                {step.description}
              </span>
              
              {/* Glow effect on hover */}
              <div
                className={cn(
                  "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl",
                  step.bgColor
                )}
              />
            </div>
            
            {/* Arrow between steps */}
            {index < steps.length - 1 && (
              <div className="hidden md:flex items-center px-4">
                <ArrowRight className="w-5 h-5 text-muted-foreground animate-pulse-slow" />
              </div>
            )}
            
            {/* Vertical arrow for mobile */}
            {index < steps.length - 1 && (
              <div className="flex md:hidden items-center py-2 rotate-90">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
