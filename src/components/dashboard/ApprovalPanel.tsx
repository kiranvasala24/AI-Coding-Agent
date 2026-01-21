import { cn } from "@/lib/utils";
import type { Approval, RiskAssessment, Patch } from "@/types/run";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  Plus,
  Minus,
  Loader2,
  Play
} from "lucide-react";
import { useState } from "react";

interface ApprovalPanelProps {
  approval: Approval;
  riskAssessment?: RiskAssessment;
  patches: Patch[];
  impactedFiles?: string[];
  onApprove?: () => void;
  onReject?: () => void;
  onApplyPatch?: (patchId: string) => Promise<void>;
  applyError?: string | null;
  className?: string;
}

const riskColors: Record<RiskAssessment['score'], string> = {
  low: 'text-terminal-green',
  medium: 'text-terminal-yellow',
  high: 'text-terminal-red',
  critical: 'text-terminal-red'
};

const riskBgColors: Record<RiskAssessment['score'], string> = {
  low: 'bg-terminal-green/10 border-terminal-green/30',
  medium: 'bg-terminal-yellow/10 border-terminal-yellow/30',
  high: 'bg-terminal-red/10 border-terminal-red/30',
  critical: 'bg-terminal-red/20 border-terminal-red/50'
};

export function ApprovalPanel({ 
  approval, 
  riskAssessment, 
  patches,
  impactedFiles,
  onApprove, 
  onReject,
  onApplyPatch,
  applyError,
  className 
}: ApprovalPanelProps) {
  const [isApplying, setIsApplying] = useState(false);
  const isApproved = !!approval.approvedAt;
  const isRejected = !!approval.rejectedAt;
  const isPending = !isApproved && !isRejected && approval.required;

  const totalAdditions = patches.reduce((sum, p) => sum + p.totalAdditions, 0);
  const totalDeletions = patches.reduce((sum, p) => sum + p.totalDeletions, 0);
  const totalFilesChanged = patches.reduce((sum, p) => sum + p.filesChanged.length, 0);

  return (
    <div className={cn(
      "rounded-lg border bg-terminal-bg overflow-hidden",
      isPending && "border-terminal-yellow/50",
      isApproved && "border-terminal-green/50",
      isRejected && "border-terminal-red/50",
      !isPending && !isApproved && !isRejected && "border-terminal-border",
      className
    )}>
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        isPending && "bg-terminal-yellow/10 border-terminal-yellow/30",
        isApproved && "bg-terminal-green/10 border-terminal-green/30",
        isRejected && "bg-terminal-red/10 border-terminal-red/30",
        !isPending && !isApproved && !isRejected && "bg-secondary/50 border-terminal-border"
      )}>
        <div className="flex items-center gap-2">
          {isPending && <ShieldAlert className="w-5 h-5 text-terminal-yellow" />}
          {isApproved && <ShieldCheck className="w-5 h-5 text-terminal-green" />}
          {isRejected && <XCircle className="w-5 h-5 text-terminal-red" />}
          <span className="text-sm font-medium text-foreground">
            {isPending && "Approval Required"}
            {isApproved && "Approved"}
            {isRejected && "Rejected"}
          </span>
        </div>
        
        {riskAssessment && (
          <span className={cn(
            "px-2 py-1 rounded text-xs font-mono uppercase",
            riskBgColors[riskAssessment.score],
            riskColors[riskAssessment.score]
          )}>
            {riskAssessment.score} risk
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Summary stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{totalFilesChanged} files</span>
          </div>
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-terminal-green" />
            <span className="text-terminal-green">{totalAdditions}</span>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="w-4 h-4 text-terminal-red" />
            <span className="text-terminal-red">{totalDeletions}</span>
          </div>
        </div>

        {/* Risk factors */}
        {riskAssessment && riskAssessment.factors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase text-muted-foreground">Risk Factors</h4>
            <div className="space-y-1">
              {riskAssessment.factors.map((factor, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className={cn(
                    "w-3 h-3 mt-0.5",
                    factor.severity === 'high' && "text-terminal-red",
                    factor.severity === 'medium' && "text-terminal-yellow",
                    factor.severity === 'low' && "text-muted-foreground"
                  )} />
                  <span className="text-muted-foreground">{factor.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Impacted files */}
        {impactedFiles && impactedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase text-muted-foreground">Impacted Files</h4>
            <div className="flex flex-wrap gap-1">
              {impactedFiles.map((file, i) => (
                <code key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                  {file}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex items-center gap-3 pt-2">
            <Button 
              variant="default" 
              className="flex-1 bg-terminal-green hover:bg-terminal-green/90"
              onClick={onApprove}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve & Apply
            </Button>
            <Button 
              variant="outline" 
              className="border-terminal-red/50 text-terminal-red hover:bg-terminal-red/10"
              onClick={onReject}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        )}

        {isApproved && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-terminal-green">
              <CheckCircle2 className="w-4 h-4" />
              <span>Approved by {approval.approvedBy} at {new Date(approval.approvedAt!).toLocaleString()}</span>
            </div>
            
            {/* Apply Patch button - only shown when approved */}
            {onApplyPatch && patches.length > 0 && (
              <div className="space-y-2">
                {applyError && (
                  <div className="p-2 rounded bg-terminal-red/10 border border-terminal-red/30 text-xs text-terminal-red">
                    <strong>Apply blocked:</strong> {applyError}
                  </div>
                )}
                <Button
                  variant="default"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={async () => {
                    setIsApplying(true);
                    try {
                      await onApplyPatch(patches[0].patchId);
                    } finally {
                      setIsApplying(false);
                    }
                  }}
                  disabled={isApplying}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Apply Patch
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-2 text-xs text-terminal-red">
            <XCircle className="w-4 h-4" />
            <span>Rejected by {approval.rejectedBy} at {new Date(approval.rejectedAt!).toLocaleString()}</span>
            {approval.reason && <span>— {approval.reason}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
