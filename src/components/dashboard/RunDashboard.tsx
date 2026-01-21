import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Run } from "@/types/run";
import { RunStatusBadge } from "./RunStatusBadge";
import { PlanViewer } from "./PlanViewer";
import { ToolCallsViewer } from "./ToolCallsViewer";
import { VerificationViewer } from "./VerificationViewer";
import { ApprovalPanel } from "./ApprovalPanel";
import { RunnerPanel } from "./RunnerPanel";
import { DiffViewer } from "@/components/DiffViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { exportRun, downloadRunExport } from "@/lib/run-export";
import { toast } from "sonner";
import { 
  Clock,
  GitBranch,
  FileCode,
  Download
} from "lucide-react";

interface RunDashboardProps {
  run: Run;
  onApprove?: () => void;
  onReject?: () => void;
  onApplyPatch?: (patchId: string) => Promise<void>;
  applyError?: string | null;
  className?: string;
}

export function RunDashboard({ 
  run, 
  onApprove, 
  onReject, 
  onApplyPatch,
  applyError,
  className 
}: RunDashboardProps) {
  const [activeTab, setActiveTab] = useState("plan");

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDuration = () => {
    const start = new Date(run.createdAt).getTime();
    const end = new Date(run.updatedAt).getTime();
    const duration = Math.round((end - start) / 1000);
    if (duration < 60) return `${duration}s`;
    return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  };

  const handleExport = async () => {
    try {
      const data = await exportRun(run);
      downloadRunExport(data);
      toast.success("Run exported successfully");
    } catch (err) {
      toast.error("Failed to export run");
    }
  };

  return (
    <div className={cn("space-y-4 md:space-y-6", className)}>
      {/* Header + Runner Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Run Info */}
        <div className="lg:col-span-2 rounded-lg border border-terminal-border bg-terminal-bg p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h2 className="text-base md:text-lg font-semibold text-foreground break-words">{run.task}</h2>
                <RunStatusBadge status={run.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  Started {formatTime(run.createdAt)}
                </span>
                <span>Duration: {getDuration()}</span>
                <span className="text-muted-foreground/60 truncate max-w-[120px] sm:max-w-none">{run.runId}</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">
                  {run.patches.length} patch{run.patches.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">
                  {run.patches.reduce((sum, p) => sum + p.filesChanged.length, 0)} files
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="flex-shrink-0">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Runner Panel */}
        <RunnerPanel />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-secondary/50 border border-terminal-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="plan" className="data-[state=active]:bg-terminal-cyan/20 data-[state=active]:text-terminal-cyan font-mono text-xs sm:text-sm">
            Plan
          </TabsTrigger>
          <TabsTrigger value="tools" className="data-[state=active]:bg-terminal-blue/20 data-[state=active]:text-terminal-blue font-mono text-xs sm:text-sm">
            Tools <span className="hidden sm:inline">({run.toolCalls.length})</span>
          </TabsTrigger>
          <TabsTrigger value="diff" className="data-[state=active]:bg-terminal-green/20 data-[state=active]:text-terminal-green font-mono text-xs sm:text-sm">
            Diff
          </TabsTrigger>
          <TabsTrigger value="verify" className="data-[state=active]:bg-terminal-yellow/20 data-[state=active]:text-terminal-yellow font-mono text-xs sm:text-sm">
            Verify
          </TabsTrigger>
          <TabsTrigger 
            value="approve" 
            className={cn(
              "font-mono text-xs sm:text-sm",
              run.status === 'awaiting_approval' && "data-[state=active]:bg-terminal-yellow/20 data-[state=active]:text-terminal-yellow",
              run.status !== 'awaiting_approval' && "data-[state=active]:bg-muted"
            )}
          >
            Approve
            {run.status === 'awaiting_approval' && (
              <span className="ml-1 sm:ml-2 w-2 h-2 rounded-full bg-terminal-yellow animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-0">
          {run.plan && <PlanViewer plan={run.plan} />}
        </TabsContent>

        <TabsContent value="tools" className="mt-0">
          <ToolCallsViewer toolCalls={run.toolCalls} />
        </TabsContent>

        <TabsContent value="diff" className="mt-0 space-y-4">
          {run.patches.map((patch) => (
            <div key={patch.patchId} className="space-y-4">
              <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{patch.summary}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{patch.reasoning}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-terminal-green">+{patch.totalAdditions}</span>
                    <span className="text-terminal-red">-{patch.totalDeletions}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {patch.constraintsUsed.map((c, i) => (
                    <code key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                      {c}
                    </code>
                  ))}
                </div>
              </div>
              
              {patch.filesChanged.map((file) => (
                <DiffViewer
                  key={file.path}
                  title={file.path}
                  lines={file.diff}
                />
              ))}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="verify" className="mt-0">
          {run.verification && <VerificationViewer verification={run.verification} />}
        </TabsContent>

        <TabsContent value="approve" className="mt-0">
          <ApprovalPanel
            approval={run.approval}
            riskAssessment={run.riskAssessment}
            patches={run.patches}
            impactedFiles={run.impactedFiles}
            onApprove={onApprove}
            onReject={onReject}
            onApplyPatch={onApplyPatch}
            applyError={applyError}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
