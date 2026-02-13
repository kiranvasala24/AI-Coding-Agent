/**
 * Runner Core Logic
 * 
 * Handles the main run execution loop with proper event streaming,
 * tool calls, verification, and patch generation.
 */

import { config } from './config';
import {
  claimRun,
  getQueuedRuns,
  postEvents,
  updateRun,
  createPatch,
  supabase
} from './supabase';
import { listFiles, search, openFile, getRepoInfo } from './tools/repo';
import { extractSymbols, lookupSymbol, SymbolInfo } from './tools/indexer';
import { runVerification } from './tools/verify';
import { watchForApprovals } from './tools/patch';
import { assessRisk } from './tools/risk';

interface RunContext {
  runId: string;
  task: string;
  cleanup: (() => void)[];
  startedAt: number;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultSummary?: string;
}

type SearchResult = { file: string } & Record<string, unknown>;

let currentRun: RunContext | null = null;
let isProcessing = false;

/**
 * Execute a single run with full pipeline
 */
export async function executeRun(runId: string, task: string) {
  if (isProcessing) {
    console.log('[runner] Already processing a run, skipping');
    return;
  }

  isProcessing = true;
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[runner] Starting run: ${runId}`);
  console.log(`[runner] Task: ${task}`);
  console.log('='.repeat(60));

  const cleanup: (() => void)[] = [];
  currentRun = { runId, task, cleanup, startedAt: startTime };

  const toolCalls: ToolCall[] = [];

  try {
    // Emit RUN_STARTED
    await postEvents(runId, [{
      type: 'RUN_STARTED',
      payload: {
        runnerId: config.runnerId,
        task,
        version: config.version,
        capabilities: {
          repoRead: true,
          patchApply: true,
          dockerVerify: config.dockerEnabled,
        },
      },
    }]);

    // Update status to running
    await updateRun(runId, { status: 'running' });

    // ========================================
    // Phase 1: Gather context with repo tools
    // ========================================
    console.log('\n[runner] Phase 1: Gathering repository context...');

    // Tool 1: Get repo info
    const repoInfo = await emitToolCall(runId, 'repo.getInfo', {}, toolCalls, async () => {
      return await getRepoInfo();
    });

    // Tool 2: List source files
    const fileList = await emitToolCall(runId, 'repo.listFiles', { pattern: 'src/**/*.{ts,tsx}' }, toolCalls, async () => {
      return await listFiles('src/**/*.{ts,tsx}');
    });

    // Tool 3: Search for task-relevant files
    const keywords = task.split(' ')
      .filter(w => w.length > 3 && !['the', 'and', 'for', 'with'].includes(w.toLowerCase()))
      .slice(0, 2);

    let searchResults: SearchResult[] = [];
    for (const keyword of keywords) {
      const results = await emitToolCall(runId, 'repo.search', { query: keyword }, toolCalls, async () => {
        return await search(keyword, '*.{ts,tsx}');
      });
      searchResults = searchResults.concat((results as unknown as SearchResult[]) || []);
    }

    // Tool 4: Open top matching file if found and extract symbols
    if (searchResults.length > 0) {
      const topFile = searchResults[0].file;
      await emitToolCall(runId, 'repo.open', { file: topFile }, toolCalls, async () => {
        return await openFile(topFile, 1, 50);
      });

      // Extract symbols from the top file to understand structure
      const symbols = await emitToolCall(runId, 'indexer.extract', { file: topFile }, toolCalls, async () => {
        return await extractSymbols(topFile);
      });

      // Add symbols to run metadata
      await updateRun(runId, {
        impacted_symbols: (symbols as SymbolInfo[] || []).map(s => `${s.kind} ${s.name}`).slice(0, 20)
      });
    }

    // Update run with tool calls
    await updateRun(runId, {
      tool_calls: toolCalls,
      impacted_files: fileList?.files?.slice(0, 10) || [],
    });

    // ========================================
    // Phase 2: Run verification
    // ========================================
    console.log('\n[runner] Phase 2: Running verification...');

    await updateRun(runId, {
      status: 'verifying',
      verification: {
        overallStatus: 'running',
        commands: [],
        startedAt: new Date().toISOString(),
      },
    });

    const verifyResult = await runVerification(runId);

    const verificationData = {
      overallStatus: verifyResult.passed ? 'passed' : 'failed',
      commands: verifyResult.results.map(r => ({
        command: r.command,
        status: r.passed ? 'passed' : 'failed',
        exitCode: r.exitCode,
        logs: [],
      })),
      startedAt: currentRun?.startedAt ? new Date(currentRun.startedAt).toISOString() : undefined,
      finishedAt: new Date().toISOString(),
    };

    await updateRun(runId, { verification: verificationData });

    // ========================================
    // Phase 3: Generate patch (scripted for now)
    // ========================================
    if (verifyResult.passed) {
      console.log('\n[runner] Phase 3: Generating patch...');

      // Create a simple scripted patch for testing
      const patchSummary = `Update based on task: ${task.slice(0, 50)}`;
      const timestamp = new Date().toISOString().split('T')[0];

      const filesChanged = [
        {
          path: 'README.md',
          additions: 2,
          deletions: 0,
          diff: [
            { type: 'header' as const, content: '--- a/README.md' },
            { type: 'header' as const, content: '+++ b/README.md' },
            { type: 'context' as const, content: '', lineNumber: { old: 1, new: 1 } },
            { type: 'added' as const, content: `<!-- Task: ${task.slice(0, 40)} -->`, lineNumber: { new: 2 } },
            { type: 'added' as const, content: `<!-- Updated: ${timestamp} by runner ${config.runnerId} -->`, lineNumber: { new: 3 } },
          ],
        },
      ];

      // Create patch in database
      const { id: patchId } = await createPatch(
        runId,
        patchSummary,
        filesChanged,
        `Automated patch generated for task: ${task}`
      );

      await postEvents(runId, [{
        type: 'PATCH_PROPOSED',
        payload: {
          patchId,
          summary: patchSummary,
          filesChanged: filesChanged.length,
          totalAdditions: 2,
          totalDeletions: 0,
        },
      }]);

      console.log(`[runner] Created patch ${patchId}`);

      // Risk Assessment
      const risk = assessRisk(filesChanged, task);
      console.log(`[runner] Risk Assessment: ${risk.score.toUpperCase()}`);

      // Update run with patch reference and risk
      await updateRun(runId, {
        status: 'awaiting_approval',
        patches: [{ patchId, summary: patchSummary }],
        risk_assessment: risk,
      });

      await postEvents(runId, [{
        type: 'NEEDS_APPROVAL',
        payload: {
          patchId,
          reason: 'Verification passed, patch ready for review',
          riskScore: risk.score,
        },
      }]);

      // Start watching for patch approvals
      const stopWatching = await watchForApprovals(runId);
      cleanup.push(stopWatching);

      console.log('[runner] Waiting for approval...');
    } else {
      console.log('\n[runner] Verification failed, not creating patch');

      await updateRun(runId, {
        status: 'failed',
        error: {
          message: 'Verification failed',
          phase: 'verification',
          recoverable: false,
        },
      });

      await postEvents(runId, [{
        type: 'RUN_FAILED',
        payload: { reason: 'Verification failed' },
      }]);
    }

  } catch (error) {
    console.error('[runner] Run failed:', error);

    // Smarter failure analysis
    const failureSummary = error instanceof Error ? error.message : String(error);
    let category: 'analysis' | 'verification' | 'environment' | 'unknown' = 'unknown';

    if (failureSummary.includes('Verification failed')) {
      category = 'verification';
    } else if (failureSummary.includes('Path traversal') || failureSummary.includes('denylist')) {
      category = 'environment';
    } else if (failureSummary.includes('TypeScript') || failureSummary.includes('token')) {
      category = 'analysis';
    }

    await postEvents(runId, [{
      type: 'RUN_FAILED',
      payload: {
        reason: failureSummary,
        category,
        recoverable: category === 'verification' || category === 'analysis'
      },
    }]);

    await updateRun(runId, {
      status: 'failed',
      error: {
        message: failureSummary,
        phase: isProcessing ? 'execution' : 'setup',
        recoverable: category !== 'environment',
        category
      },
    });
  } finally {
    isProcessing = false;
  }
}

/**
 * Emit tool call events around a tool execution
 */
async function emitToolCall<T>(
  runId: string,
  tool: string,
  input: Record<string, unknown>,
  toolCalls: ToolCall[],
  execute: () => Promise<T>
): Promise<T> {
  const callId = `${tool}-${Date.now()}`;
  const startedAt = new Date().toISOString();

  const toolCall: ToolCall = {
    id: callId,
    name: tool,
    args: input,
    startedAt,
    status: 'running' as const,
  };

  toolCalls.push(toolCall);

  await postEvents(runId, [{
    type: 'TOOL_CALLED',
    payload: {
      callId,
      tool,
      input,
      startedAt,
    },
  }]);

  const startTime = Date.now();

  try {
    const result = await execute();

    // Summarize result for logging (avoid huge payloads)
    const summary = summarizeResult(result);
    const duration = Date.now() - startTime;

    // Update tool call in array
    Object.assign(toolCall, {
      finishedAt: new Date().toISOString(),
      status: 'completed',
      resultSummary: typeof summary === 'string' ? summary : JSON.stringify(summary).slice(0, 100),
    });

    await postEvents(runId, [{
      type: 'TOOL_COMPLETED',
      payload: {
        callId,
        tool,
        duration,
        result: summary,
      },
    }]);

    console.log(`[tool] ${tool} completed in ${duration}ms`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    Object.assign(toolCall, {
      finishedAt: new Date().toISOString(),
      status: 'failed',
      resultSummary: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });

    await postEvents(runId, [{
      type: 'TOOL_COMPLETED',
      payload: {
        callId,
        tool,
        duration,
        error: error instanceof Error ? error.message : String(error),
      },
    }]);

    throw error;
  }
}

/**
 * Summarize a result for event payload (avoid huge data)
 */
function summarizeResult(result: unknown): unknown {
  if (result === null || result === undefined) return result;

  if (Array.isArray(result)) {
    return {
      type: 'array',
      length: result.length,
      preview: result.slice(0, 3).map(item =>
        typeof item === 'object' ? JSON.stringify(item).slice(0, 50) : item
      ),
    };
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    const summary: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.length > 100) {
        summary[key] = value.slice(0, 100) + '...';
      } else if (Array.isArray(value)) {
        summary[key] = { type: 'array', length: value.length };
      } else if (typeof value === 'object' && value !== null) {
        summary[key] = '[object]';
      } else {
        summary[key] = value;
      }
    }

    return summary;
  }

  return result;
}

/**
 * Poll for queued runs and claim them
 */
export async function startRunPoller() {
  console.log('[runner] Starting run poller...');

  const poll = async () => {
    if (currentRun || isProcessing) {
      // Already running something
      return;
    }

    try {
      const queued = await getQueuedRuns();

      if (queued.length > 0) {
        const run = queued[0];
        console.log(`[runner] Found queued run: ${run.id}`);

        // Claim it via edge function (includes optimistic lock)
        const { claimed, run: claimedRun } = await claimRun(run.id);

        if (claimed && claimedRun) {
          console.log(`[runner] Successfully claimed run ${run.id}`);
          // Execute the run
          await executeRun(run.id, run.task);
        } else {
          console.log(`[runner] Failed to claim run ${run.id} (may have been claimed by another runner)`);
        }
      }
    } catch (error) {
      console.error('[runner] Poll error:', error);
    }
  };

  // Poll immediately, then on interval
  await poll();
  const interval = setInterval(poll, config.pollIntervalMs);

  return () => clearInterval(interval);
}

/**
 * Cleanup current run
 */
export function cleanupCurrentRun() {
  if (currentRun) {
    for (const cleanup of currentRun.cleanup) {
      try {
        cleanup();
      } catch (e) {
        console.error('[runner] Cleanup error:', e);
      }
    }
    currentRun = null;
  }
  isProcessing = false;
}