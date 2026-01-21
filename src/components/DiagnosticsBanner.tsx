import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiagnosticResult {
  category: string;
  check: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

interface DiagnosticsBannerProps {
  failures: DiagnosticResult[];
  onDismiss: () => void;
}

export function DiagnosticsBanner({ failures, onDismiss }: DiagnosticsBannerProps) {
  if (failures.length === 0) return null;
  
  const hasErrors = failures.some(f => f.status === "fail");
  
  return (
    <div className={`
      fixed top-0 left-0 right-0 z-50 p-3 
      ${hasErrors ? "bg-destructive/90" : "bg-warning/90"}
      text-foreground backdrop-blur-sm
    `}>
      <div className="max-w-screen-xl mx-auto flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-medium text-sm">
            {hasErrors ? "Critical startup issues detected" : "Startup warnings"}
          </p>
          <ul className="text-xs space-y-0.5 opacity-90">
            {failures.map((f, i) => (
              <li key={i}>
                <span className="font-mono">[{f.category}]</span> {f.check}: {f.message}
              </li>
            ))}
          </ul>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={onDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
