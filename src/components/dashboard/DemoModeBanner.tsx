import React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoModeBannerProps {
  onDisable?: () => void;
  className?: string;
}

export function DemoModeBanner({ onDisable, className }: DemoModeBannerProps) {
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-terminal-yellow/90 text-black py-2 px-4",
        "flex items-center justify-center gap-3 text-sm font-medium",
        "backdrop-blur-sm border-b border-terminal-yellow",
        className
      )}
    >
      <Zap className="w-4 h-4" />
      <span>
        <strong>Demo Mode:</strong> Simulated events — no real runner connected
      </span>
      {onDisable && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-black hover:bg-black/10"
          onClick={onDisable}
        >
          <X className="w-3 h-3 mr-1" />
          Exit Demo
        </Button>
      )}
    </div>
  );
}

interface RunnerOfflineBannerProps {
  onSetup?: () => void;
  className?: string;
}

export function RunnerOfflineBanner({ onSetup, className }: RunnerOfflineBannerProps) {
  return (
    <div
      className={cn(
        "bg-muted/50 border border-border rounded-lg py-3 px-4",
        "flex items-center justify-between gap-3 text-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="w-4 h-4 text-terminal-yellow" />
        <span>Local runner not connected. </span>
        <span className="hidden sm:inline">Enable Demo Mode or connect a runner to start.</span>
      </div>
      {onSetup && (
        <Button variant="outline" size="sm" onClick={onSetup}>
          Setup Runner
        </Button>
      )}
    </div>
  );
}
