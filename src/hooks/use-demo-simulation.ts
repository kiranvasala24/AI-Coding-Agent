/**
 * Demo Simulation Hook
 * 
 * Provides a fake run flow for demos when no local runner is connected.
 * Streams realistic events to show off the UI without requiring local setup.
 */

import { useState, useCallback, useRef } from "react";
import type { Run, ToolCall, Patch, Verification, VerificationCommand } from "@/types/run";

interface UseDemoSimulationReturn {
  run: Run | null;
  isRunning: boolean;
  startSimulation: (task: string) => void;
  approveSimulation: () => void;
  rejectSimulation: (reason?: string) => void;
  resetSimulation: () => void;
}

const DEMO_TOOL_CALLS: Array<{ name: string; args: Record<string, unknown>; duration: number; summary: string }> = [
  { name: 'repo.getInfo', args: {}, duration: 120, summary: 'Found package.json with 15 scripts' },
  { name: 'repo.listFiles', args: { pattern: 'src/**/*.tsx' }, duration: 340, summary: '42 files found' },
  { name: 'repo.search', args: { query: 'error' }, duration: 180, summary: '8 matches in 5 files' },
  { name: 'repo.open', args: { file: 'src/lib/api.ts' }, duration: 95, summary: 'Opened 156 lines' },
];

const DEMO_VERIFY_COMMANDS: Array<{ command: string; logs: string[]; passed: boolean; duration: number }> = [
  {
    command: 'tsc --noEmit',
    logs: [
      '$ tsc --noEmit',
      'Checking types...',
      'src/App.tsx(15,3): No issues found',
      'src/lib/api.ts(42,5): No issues found',
      '✓ Type checking complete',
    ],
    passed: true,
    duration: 2400,
  },
  {
    command: 'npm test -- --run',
    logs: [
      '$ npm test -- --run',
      '✓ API client handles errors correctly (45ms)',
      '✓ Dashboard renders run status (23ms)',
      '✓ Verification viewer shows logs (18ms)',
      '',
      'Test Files  3 passed (3)',
      'Tests       8 passed (8)',
      'Duration    1.24s',
    ],
    passed: true,
    duration: 1800,
  },
];

const DEMO_PATCH: Patch = {
  patchId: 'demo-patch-001',
  summary: 'Add error handling to API client',
  filesChanged: [
    {
      path: 'src/lib/api.ts',
      additions: 12,
      deletions: 3,
      diff: [
        { type: 'header', content: '--- a/src/lib/api.ts' },
        { type: 'header', content: '+++ b/src/lib/api.ts' },
        { type: 'context', content: 'export async function fetchData(endpoint: string) {', lineNumber: { old: 10, new: 10 } },
        { type: 'removed', content: '  const response = await fetch(endpoint);', lineNumber: { old: 11 } },
        { type: 'removed', content: '  return response.json();', lineNumber: { old: 12 } },
        { type: 'added', content: '  try {', lineNumber: { new: 11 } },
        { type: 'added', content: '    const response = await fetch(endpoint);', lineNumber: { new: 12 } },
        { type: 'added', content: '    if (!response.ok) {', lineNumber: { new: 13 } },
        { type: 'added', content: '      throw new Error(`HTTP ${response.status}: ${response.statusText}`);', lineNumber: { new: 14 } },
        { type: 'added', content: '    }', lineNumber: { new: 15 } },
        { type: 'added', content: '    return response.json();', lineNumber: { new: 16 } },
        { type: 'added', content: '  } catch (error) {', lineNumber: { new: 17 } },
        { type: 'added', content: '    console.error("API Error:", error);', lineNumber: { new: 18 } },
        { type: 'added', content: '    throw error;', lineNumber: { new: 19 } },
        { type: 'added', content: '  }', lineNumber: { new: 20 } },
        { type: 'context', content: '}', lineNumber: { old: 13, new: 21 } },
      ],
    },
  ],
  totalAdditions: 12,
  totalDeletions: 3,
  createdAt: new Date().toISOString(),
  reasoning: 'Added try-catch error handling with proper error messages and logging',
  constraintsUsed: ['max-files: 20', 'max-diff-lines: 1000'],
};

function createInitialRun(task: string): Run {
  return {
    runId: `demo-run-${Date.now()}`,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    task,
    toolCalls: [],
    patches: [],
    approval: { required: true },
  };
}

export function useDemoSimulation(): UseDemoSimulationReturn {
  const [run, setRun] = useState<Run | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const timeoutsRef = useRef<number[]>([]);

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const addTimeout = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  const startSimulation = useCallback((task: string) => {
    clearTimeouts();
    setIsRunning(true);
    
    const initialRun = createInitialRun(task);
    setRun(initialRun);
    
    let delay = 0;
    
    // Phase 1: queued -> running
    delay += 500;
    addTimeout(() => {
      setRun(prev => prev ? { ...prev, status: 'running', updatedAt: new Date().toISOString() } : null);
    }, delay);
    
    // Phase 2: Tool calls (one by one)
    const toolCalls: ToolCall[] = [];
    
    DEMO_TOOL_CALLS.forEach((tool, index) => {
      delay += 300;
      const toolCall: ToolCall = {
        id: `tool-${index}`,
        name: tool.name as ToolCall['name'],
        args: tool.args,
        startedAt: new Date(Date.now() + delay).toISOString(),
        status: 'running',
      };
      
      addTimeout(() => {
        toolCalls.push({ ...toolCall });
        setRun(prev => prev ? { 
          ...prev, 
          toolCalls: [...toolCalls],
          updatedAt: new Date().toISOString(),
        } : null);
      }, delay);
      
      delay += tool.duration;
      addTimeout(() => {
        const completed: ToolCall = {
          ...toolCall,
          finishedAt: new Date().toISOString(),
          status: 'completed',
          resultSummary: tool.summary,
        };
        const idx = toolCalls.findIndex(t => t.id === toolCall.id);
        if (idx >= 0) toolCalls[idx] = completed;
        setRun(prev => prev ? { 
          ...prev, 
          toolCalls: [...toolCalls],
          updatedAt: new Date().toISOString(),
        } : null);
      }, delay);
    });
    
    // Phase 3: Verification
    delay += 500;
    addTimeout(() => {
      setRun(prev => prev ? { 
        ...prev, 
        status: 'verifying',
        verification: {
          commands: [],
          overallStatus: 'running',
          startedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      } : null);
    }, delay);
    
    const verifyCommands: VerificationCommand[] = [];
    
    DEMO_VERIFY_COMMANDS.forEach((cmd, index) => {
      delay += 400;
      const command: VerificationCommand = {
        command: cmd.command,
        status: 'running',
        startedAt: new Date(Date.now() + delay).toISOString(),
        logs: [],
      };
      
      addTimeout(() => {
        verifyCommands.push({ ...command });
        setRun(prev => prev ? {
          ...prev,
          verification: {
            commands: [...verifyCommands],
            overallStatus: 'running',
            startedAt: prev.verification?.startedAt,
          },
          updatedAt: new Date().toISOString(),
        } : null);
      }, delay);
      
      // Stream logs
      cmd.logs.forEach((log, logIndex) => {
        delay += 150;
        addTimeout(() => {
          const cmdIndex = verifyCommands.findIndex(c => c.command === cmd.command);
          if (cmdIndex >= 0) {
            verifyCommands[cmdIndex] = {
              ...verifyCommands[cmdIndex],
              logs: [...verifyCommands[cmdIndex].logs, log],
            };
            setRun(prev => prev ? {
              ...prev,
              verification: {
                commands: [...verifyCommands],
                overallStatus: 'running',
                startedAt: prev.verification?.startedAt,
              },
              updatedAt: new Date().toISOString(),
            } : null);
          }
        }, delay);
      });
      
      delay += 200;
      addTimeout(() => {
        const cmdIndex = verifyCommands.findIndex(c => c.command === cmd.command);
        if (cmdIndex >= 0) {
          verifyCommands[cmdIndex] = {
            ...verifyCommands[cmdIndex],
            status: cmd.passed ? 'passed' : 'failed',
            finishedAt: new Date().toISOString(),
            exitCode: cmd.passed ? 0 : 1,
          };
          setRun(prev => prev ? {
            ...prev,
            verification: {
              commands: [...verifyCommands],
              overallStatus: 'running',
              startedAt: prev.verification?.startedAt,
            },
            updatedAt: new Date().toISOString(),
          } : null);
        }
      }, delay);
    });
    
    // Phase 4: Create patch and await approval
    delay += 600;
    addTimeout(() => {
      const allPassed = DEMO_VERIFY_COMMANDS.every(c => c.passed);
      setRun(prev => prev ? {
        ...prev,
        status: 'awaiting_approval',
        verification: {
          commands: verifyCommands,
          overallStatus: allPassed ? 'passed' : 'failed',
          startedAt: prev.verification?.startedAt,
          finishedAt: new Date().toISOString(),
        },
        patches: [DEMO_PATCH],
        updatedAt: new Date().toISOString(),
      } : null);
      setIsRunning(false);
    }, delay);
    
  }, []);

  const approveSimulation = useCallback(() => {
    setRun(prev => prev ? {
      ...prev,
      status: 'approved',
      approval: {
        required: true,
        approvedBy: 'demo-user',
        approvedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    } : null);
  }, []);

  const rejectSimulation = useCallback((reason?: string) => {
    setRun(prev => prev ? {
      ...prev,
      status: 'failed',
      approval: {
        required: true,
        rejectedBy: 'demo-user',
        rejectedAt: new Date().toISOString(),
        reason: reason || 'Rejected by user',
      },
      updatedAt: new Date().toISOString(),
    } : null);
  }, []);

  const resetSimulation = useCallback(() => {
    clearTimeouts();
    setRun(null);
    setIsRunning(false);
  }, []);

  return {
    run,
    isRunning,
    startSimulation,
    approveSimulation,
    rejectSimulation,
    resetSimulation,
  };
}
