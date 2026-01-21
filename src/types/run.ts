// Core Run types for the AI Coding Agent

export type RunStatus = 
  | 'pending'
  | 'queued'      // Waiting for runner to pick up
  | 'running'     // Runner is executing
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'awaiting_approval'
  | 'approved'
  | 'applying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ToolName = 
  | 'search'
  | 'open'
  | 'list_files'
  | 'propose_patch'
  | 'get_patch'
  | 'symbol_lookup'
  | 'find_references'
  | 'get_dependents'
  | 'sandbox_run';

export interface PlanStep {
  id: string;
  action: 'analyze' | 'modify' | 'test' | 'verify' | 'create' | 'delete';
  target: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  changes?: string;
  expected?: string;
}

export interface Plan {
  task: string;
  steps: PlanStep[];
  risks: string[];
  affectedExports: string[];
  acceptanceCriteria: string[];
}

export interface ToolCall {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultSummary?: string;
  result?: unknown;
}

export interface DiffLine {
  type: 'header' | 'context' | 'added' | 'removed';
  content: string;
  lineNumber?: {
    old?: number;
    new?: number;
  };
}

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  diff: DiffLine[];
}

export interface Patch {
  patchId: string;
  summary: string;
  filesChanged: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  createdAt: string;
  reasoning: string;
  constraintsUsed: string[];
}

export interface VerificationCommand {
  command: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  logs: string[];
}

export interface Verification {
  commands: VerificationCommand[];
  overallStatus: 'pending' | 'running' | 'passed' | 'failed';
  startedAt?: string;
  finishedAt?: string;
}

export interface Approval {
  required: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  reason?: string;
}

export interface RiskAssessment {
  score: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

export interface Run {
  runId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  task: string;
  
  // Phase data
  plan?: Plan;
  toolCalls: ToolCall[];
  patches: Patch[];
  verification?: Verification;
  approval: Approval;
  
  // Analysis
  riskAssessment?: RiskAssessment;
  impactedFiles?: string[];
  impactedSymbols?: string[];
  
  // Error handling
  error?: {
    message: string;
    phase: 'planning' | 'execution' | 'verification' | 'application';
    recoverable: boolean;
  };
}

// Event types for SSE streaming
export type RunEventType = 
  | 'RUN_CREATED'
  | 'RUN_STARTED'      // Runner picked up the run
  | 'RUNNER_HEARTBEAT' // Runner health check
  | 'PLAN_CREATED'
  | 'PLAN_STEP_STARTED'
  | 'PLAN_STEP_COMPLETED'
  | 'TOOL_CALLED'
  | 'TOOL_COMPLETED'
  | 'PATCH_PROPOSED'
  | 'PATCH_APPLIED'    // Patch applied to filesystem
  | 'VERIFY_STARTED'
  | 'VERIFY_LOG'
  | 'VERIFY_COMMAND_FINISHED'
  | 'VERIFY_FINISHED'
  | 'NEEDS_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPLY_STARTED'
  | 'APPLY_FINISHED'
  | 'RUN_COMPLETED'
  | 'RUN_FAILED'
  | 'RUN_CANCELLED'
  | 'ERROR';

export interface RunEvent {
  eventId: string;
  runId: string;
  type: RunEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}
