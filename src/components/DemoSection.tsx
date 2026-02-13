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
import { Textarea } from "@/components/ui/textarea";

// Determine environment
const IS_PROD = import.meta.env.PROD || import.meta.env.VITE_APP_ENV === "production";
const IS_STAGING = import.meta.env.VITE_APP_ENV === "staging";

// Check if demo mode is requested via URL
const searchParams = new URLSearchParams(window.location.search);
const hasDemoParam = searchParams.get("demo") === "1" || searchParams.get("demo") === "true";

// Final demo mode default:
// - If explicitly disabled in env, always false
// - If staging, enabled by default
// - If prod, only enabled if ?demo=1 is present
// - Otherwise (dev), enabled by default if no runner online
const DEMO_MODE_DEFAULT = import.meta.env.VITE_DEMO_MODE_ENABLED === "false"
  ? false
  : (IS_STAGING || hasDemoParam)
    ? true
    : IS_PROD
      ? false
      : true;

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
  const [demoMode, setDemoMode] = useState(DEMO_MODE_DEFAULT && (!runnerStatus.isOnline || IS_PROD || IS_STAGING));
  const [task, setTask] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  // Real run hook (for when runner is connected)
  const realRun = useRun({ useMock: false });

  // Simulation hook (for demo mode)
  const simulation = useDemoSimulation();

  // Use the appropriate source based on mode
  const run = demoMode ? simulation.run : realRun.run;
  const isLoading = demoMode ? simulation.isRunning : realRun.isLoading;

  const handleStartRun = async () => {
    if (!task.trim()) {
      toast.error("Please enter a task", {
        description: "Specify what you want the agent to do."
      });
      return;
    }

    setApplyError(null);

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
      toast.info("Demo state cleared", {
        description: "You can now start a new simulation."
      });
    } else {
      realRun.reset();
      toast.info("Live run state cleared");
    }
    setApplyError(null);
  };

  const handleStartPreset = (preset: typeof DEMO_PRESETS[0]) => {
    handleReset();
    setTask(preset.task);
    setTimeout(() => {
      if (demoMode) {
        simulation.startSimulation(preset.task);
        toast.info(`Starting demo: ${preset.label}`);
      } else if (runnerStatus.isOnline) {
        realRun.startRun(preset.task);
        toast.info(`Starting live run: ${preset.label}`);
      }
    }, 100);
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
            AI Agent <span className="text-gradient">Workspace</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mb-6 md:mb-8 px-4">
            Describe a task for the agent to perform. It will analyze your code,
            plan the changes, and propose a pull-request quality diff for your review.
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

          {/* Task Input Section */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-terminal-green/20 to-terminal-cyan/20 rounded-xl blur opacity-30 group-focus-within:opacity-100 transition duration-1000"></div>
              <div className="relative">
                <Textarea
                  placeholder="E.g., Add a new utility function to src/lib/utils.ts that formats currency..."
                  className="min-h-[120px] bg-card/50 border-border/50 rounded-xl text-base md:text-lg p-4 focus:ring-terminal-green/30 focus:border-terminal-green/30 transition-all resize-none shadow-sm"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  disabled={isLoading || (!!run && !["completed", "failed", "approved", "cancelled"].includes(run.status))}
                />

                {/* Preset task buttons (Small chips below textarea) */}
                <div className="flex flex-wrap gap-2 mt-3 pl-1">
                  <span className="text-xs text-muted-foreground py-1 mr-1">Suggestions:</span>
                  {DEMO_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      className="text-xs px-2.5 py-1 rounded-full border border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-terminal-green/30 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                      onClick={() => handleStartPreset(preset)}
                      disabled={isLoading}
                    >
                      <Zap className="w-3 h-3 text-terminal-green" />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 md:gap-4 justify-center">
            {canStart ? (
              <Button
                variant="hero"
                size="lg"
                className="md:px-12 group h-14 text-lg"
                onClick={handleStartRun}
                disabled={isLoading || !task.trim()}
              >
                <Play className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                {isLoading ? "Analyzing..." : demoMode ? "Simulate Task" : "Run Task Now"}
              </Button>
            ) : run && (
              <Button variant="outline" size="lg" onClick={handleReset} className="md:px-8 h-12">
                <RotateCcw className="w-4 h-4 mr-2" />
                Start New Task
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
