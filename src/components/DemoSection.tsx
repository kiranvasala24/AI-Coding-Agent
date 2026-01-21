import { RunDashboard } from "@/components/dashboard/RunDashboard";
import { useRun } from "@/hooks/use-run";
import { useDemoSimulation } from "@/hooks/use-demo-simulation";
import { useRunnerStatus } from "@/hooks/use-runner-status";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, RotateCcw, Wifi, WifiOff, Settings, Zap } from "lucide-react";
import { useState } from "react";
import { applyPatch } from "@/lib/runs-client";
import { RunnerSetupWizard } from "@/components/dashboard/RunnerSetupWizard";
import { DemoModeBanner, RunnerOfflineBanner } from "@/components/dashboard/DemoModeBanner";

// Check if demo mode is enabled via environment variable
const DEMO_MODE_ENABLED = import.meta.env.VITE_DEMO_MODE_ENABLED !== "false";

// Preset demo tasks for quick demos
const DEMO_PRESETS = [
  { label: "Error Handling", task: "Add error handling to the API client" },
  { label: "Dark Mode", task: "Add dark mode toggle with system preference detection" },
  { label: "Form Validation", task: "Add form validation with Zod schema" },
  { label: "Loading States", task: "Add loading skeletons to the dashboard" },
];

export function DemoSection() {
  const runnerStatus = useRunnerStatus();
  const [demoMode, setDemoMode] = useState(DEMO_MODE_ENABLED && !runnerStatus.isOnline);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  
  // Real run hook (for when runner is connected)
  const realRun = useRun({ useMock: false });
  
  // Simulation hook (for demo mode)
  const simulation = useDemoSimulation();
  
  // Use the appropriate source based on mode
  const run = demoMode ? simulation.run : realRun.run;
  const isLoading = demoMode ? simulation.isRunning : realRun.isLoading;

  const handleStartDemo = async () => {
    setApplyError(null);
    const task = "Add error handling to the API client";
    
    if (demoMode) {
      toast.info("Starting simulated demo...", {
        description: "This is a demo run without a local runner."
      });
      simulation.startSimulation(task);
    } else {
      if (!runnerStatus.isOnline) {
        toast.error("Runner not connected", {
          description: "Connect a local runner or enable Demo Mode."
        });
        return;
      }
      toast.info("Starting live run...", {
        description: "Waiting for runner to claim the task."
      });
      await realRun.startRun(task);
    }
  };

  const handleApprove = async () => {
    if (demoMode) {
      simulation.approveSimulation();
      toast.success("Patch approved! (Demo mode)");
    } else {
      await realRun.approve();
      toast.success("Patch approved! You can now apply it.");
    }
  };

  const handleReject = async () => {
    if (demoMode) {
      simulation.rejectSimulation("Changes not needed");
      toast.error("Patch rejected (Demo mode)");
    } else {
      await realRun.reject("Changes not needed");
      toast.error("Patch rejected");
    }
  };

  const handleApplyPatch = async (patchId: string) => {
    setApplyError(null);
    
    if (demoMode) {
      // Simulate apply in demo mode
      await new Promise(r => setTimeout(r, 500));
      toast.success("Patch applied successfully! (Demo mode)", {
        description: "In a real run, this would modify files on disk."
      });
      return;
    }
    
    try {
      const result = await applyPatch(patchId);
      toast.success(`Patch applied successfully! ${result.filesAffected} files affected.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply patch";
      setApplyError(message);
      toast.error(message);
    }
  };

  const handleReset = () => {
    if (demoMode) {
      simulation.resetSimulation();
    } else {
      realRun.reset();
    }
    setApplyError(null);
    toast.info("Demo reset");
  };

  const handleDisableDemoMode = () => {
    setDemoMode(false);
    simulation.resetSimulation();
  };

  const canStart = !isLoading && (!run || ["completed", "failed", "approved", "cancelled"].includes(run.status));

  return (
    <section id="demo" className="py-12 md:py-24 relative">
      {/* Demo Mode Banner - fixed at top when active */}
      {demoMode && run && (
        <DemoModeBanner onDisable={handleDisableDemoMode} />
      )}
      
      <div className={`container mx-auto px-4 md:px-6 ${demoMode && run ? 'pt-10' : ''}`}>
        <div className="text-center mb-8 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
            See it in <span className="text-gradient">Action</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-6 md:mb-8 px-4">
            The agent generates structured plans, creates reviewable diffs,
            and clearly explains its reasoning and potential risks.
          </p>
          
          {/* Mode toggle and status */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            {/* Runner status indicator */}
            <div className="flex items-center gap-2 text-sm">
              {runnerStatus.isOnline ? (
                <span className="flex items-center gap-1.5 text-terminal-green">
                  <Wifi className="w-4 h-4" />
                  Runner Online
                  {runnerStatus.version && (
                    <span className="text-xs text-muted-foreground">v{runnerStatus.version}</span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <WifiOff className="w-4 h-4" />
                  Runner Offline
                </span>
              )}
            </div>
            
            <div className="w-px h-4 bg-border" />
            
            {/* Demo mode toggle - only show if enabled */}
            {DEMO_MODE_ENABLED && (
              <div className="flex items-center gap-2">
                <Switch 
                  id="demo-mode" 
                  checked={demoMode}
                  onCheckedChange={(checked) => {
                    setDemoMode(checked);
                    if (checked) {
                      simulation.resetSimulation();
                    } else {
                      realRun.reset();
                    }
                  }}
                />
                <Label htmlFor="demo-mode" className="text-sm cursor-pointer">
                  Demo Mode
                  <span className="text-xs text-muted-foreground ml-1">
                    (simulated)
                  </span>
                </Label>
              </div>
            )}
            
            {!runnerStatus.isOnline && !demoMode && (
              <>
                <div className="w-px h-4 bg-border hidden sm:block" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setSetupOpen(true)}
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Setup Runner
                </Button>
              </>
            )}
          </div>
          
          {/* Demo preset buttons */}
          {canStart && (
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {DEMO_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    if (demoMode) {
                      simulation.startSimulation(preset.task);
                      toast.info(`Starting demo: ${preset.label}`);
                    } else if (runnerStatus.isOnline) {
                      realRun.startRun(preset.task);
                      toast.info(`Starting live run: ${preset.label}`);
                    }
                  }}
                  disabled={!demoMode && !runnerStatus.isOnline}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {preset.label}
                </Button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 md:gap-4 justify-center">
            <Button
              variant="hero"
              size="default"
              className="md:text-base"
              onClick={handleStartDemo}
              disabled={!canStart}
            >
              <Play className="w-4 h-4 mr-2" />
              {isLoading ? "Running..." : demoMode ? "Start Demo" : "Start Live Run"}
            </Button>
            {run && (
              <Button variant="outline" size="default" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}
          </div>
          
          {realRun.error && !demoMode && (
            <p className="text-destructive mt-4 text-sm">Error: {realRun.error.message}</p>
          )}
        </div>

        {/* Offline warning when not in demo mode */}
        {!runnerStatus.isOnline && !demoMode && !run && (
          <RunnerOfflineBanner 
            onSetup={() => setSetupOpen(true)}
            className="mb-8 max-w-2xl mx-auto"
          />
        )}

        {run ? (
          <RunDashboard 
            run={run} 
            onApprove={handleApprove}
            onReject={handleReject}
            onApplyPatch={handleApplyPatch}
            applyError={applyError}
          />
        ) : (
          <div className="border border-border/50 rounded-xl p-6 md:p-12 text-center bg-card/30">
            <p className="text-sm md:text-base text-muted-foreground">
              {demoMode 
                ? 'Click "Start Demo" to see a simulated run with streaming events.'
                : runnerStatus.isOnline 
                  ? 'Click "Start Live Run" to create a real run executed by your local runner.'
                  : 'Enable Demo Mode above to see the agent in action, or connect a local runner for real execution.'
              }
            </p>
          </div>
        )}
      </div>
      
      {/* Runner Setup Wizard Dialog */}
      <RunnerSetupWizard open={setupOpen} onOpenChange={setSetupOpen} />
    </section>
  );
}
