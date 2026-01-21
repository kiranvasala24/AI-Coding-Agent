/**
 * Verification Tools
 * 
 * Execute verification commands (tsc, tests) and stream logs.
 * Supports automatic package manager detection.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';
import { postEvents } from '../supabase';

export interface VerifyResult {
  command: string;
  exitCode: number;
  duration: number;
  passed: boolean;
}

interface CommandConfig {
  command: string;
  args: string[];
  description: string;
}

/**
 * Get package manager specific commands
 */
function getPackageManagerCommands(): {
  typecheck: CommandConfig | null;
  test: CommandConfig | null;
} {
  const { repoPath, packageManager } = config;
  
  // Check for package.json scripts
  let pkgScripts: Record<string, string> = {};
  try {
    const pkgPath = join(repoPath, 'package.json');
    if (existsSync(pkgPath)) {
      const raw = readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      pkgScripts = pkg.scripts || {};
    }
  } catch {
    // No package.json or invalid JSON
  }
  
  // Check for TypeScript config
  const hasTsConfig = existsSync(join(repoPath, 'tsconfig.json'));
  
  // Determine typecheck command
  let typecheck: CommandConfig | null = null;
  if (pkgScripts.typecheck) {
    typecheck = {
      command: packageManager,
      args: ['run', 'typecheck'],
      description: 'Type checking',
    };
  } else if (pkgScripts['type-check']) {
    typecheck = {
      command: packageManager,
      args: ['run', 'type-check'],
      description: 'Type checking',
    };
  } else if (hasTsConfig) {
    typecheck = {
      command: 'npx',
      args: ['tsc', '--noEmit'],
      description: 'TypeScript check',
    };
  }
  
  // Determine test command
  let test: CommandConfig | null = null;
  if (pkgScripts.test && pkgScripts.test !== 'echo "Error: no test specified" && exit 1') {
    // Check for common test runners and add --run flag for vitest
    const isVitest = pkgScripts.test.includes('vitest');
    const args = isVitest ? ['test', '--', '--run'] : ['test'];
    
    test = {
      command: packageManager,
      args,
      description: 'Tests',
    };
  }
  
  return { typecheck, test };
}

/**
 * Run a verification command and stream logs
 */
export async function runVerifyCommand(
  runId: string,
  command: string,
  args: string[] = [],
  description?: string
): Promise<VerifyResult> {
  const startTime = Date.now();
  const commandId = `verify-${Date.now()}`;
  
  // Emit start event
  await postEvents(runId, [{
    type: 'VERIFY_STARTED',
    payload: { 
      command, 
      args,
      commandId,
      description: description || `${command} ${args.join(' ')}`,
    },
  }]);
  
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: config.repoPath,
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0', // Disable color codes for cleaner logs
        CI: 'true',
      },
      timeout: config.commandTimeoutMs,
    });
    
    let logBuffer: string[] = [];
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;
    const MAX_CHUNK_SIZE = 1024; // ~1KB chunks
    
    // Batch logs and flush periodically or when buffer gets large
    const flushLogs = async () => {
      if (logBuffer.length === 0) return;
      
      const logs = logBuffer.join('');
      logBuffer = [];
      
      // Split into chunks if too large
      const chunks: string[] = [];
      let remaining = logs;
      while (remaining.length > MAX_CHUNK_SIZE) {
        // Try to split at newline
        let splitPoint = remaining.lastIndexOf('\n', MAX_CHUNK_SIZE);
        if (splitPoint === -1) splitPoint = MAX_CHUNK_SIZE;
        chunks.push(remaining.slice(0, splitPoint + 1));
        remaining = remaining.slice(splitPoint + 1);
      }
      if (remaining) chunks.push(remaining);
      
      for (const chunk of chunks) {
        await postEvents(runId, [{
          type: 'VERIFY_LOG',
          payload: { 
            content: chunk, 
            stream: 'mixed',
            commandId,
          },
        }]);
      }
    };
    
    const scheduledFlush = () => {
      if (flushTimeout) clearTimeout(flushTimeout);
      
      // Flush immediately if buffer is getting large
      const bufferSize = logBuffer.reduce((sum, s) => sum + s.length, 0);
      if (bufferSize > MAX_CHUNK_SIZE) {
        flushLogs();
      } else {
        flushTimeout = setTimeout(flushLogs, 100);
      }
    };
    
    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      logBuffer.push(text);
      scheduledFlush();
      
      // Also log locally (line by line for readability)
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          process.stdout.write(`  ${line}\n`);
        }
      }
    };
    
    proc.stdout.on('data', handleOutput);
    proc.stderr.on('data', handleOutput);
    
    proc.on('close', async (code) => {
      // Final flush
      await flushLogs();
      
      const duration = Date.now() - startTime;
      const exitCode = code ?? 1;
      const passed = exitCode === 0;
      
      // Emit finish event
      await postEvents(runId, [{
        type: 'VERIFY_COMMAND_FINISHED',
        payload: { 
          command, 
          args,
          commandId,
          exitCode, 
          duration, 
          passed,
          description: description || `${command} ${args.join(' ')}`,
        },
      }]);
      
      resolve({
        command: `${command} ${args.join(' ')}`.trim(),
        exitCode,
        duration,
        passed,
      });
    });
    
    proc.on('error', async (err) => {
      await postEvents(runId, [{
        type: 'VERIFY_LOG',
        payload: { 
          content: `Error: ${err.message}\n`, 
          stream: 'stderr',
          commandId,
        },
      }]);
      
      resolve({
        command: `${command} ${args.join(' ')}`.trim(),
        exitCode: 1,
        duration: Date.now() - startTime,
        passed: false,
      });
    });
  });
}

/**
 * Run full verification suite with automatic detection
 */
export async function runVerification(runId: string): Promise<{
  passed: boolean;
  results: VerifyResult[];
}> {
  const results: VerifyResult[] = [];
  const commands = getPackageManagerCommands();
  
  console.log(`[verify] Package manager: ${config.packageManager}`);
  console.log(`[verify] Commands detected:`, {
    typecheck: commands.typecheck?.description || 'none',
    test: commands.test?.description || 'none',
  });
  
  // TypeScript check
  if (commands.typecheck) {
    console.log(`[verify] Running ${commands.typecheck.description}...`);
    const tscResult = await runVerifyCommand(
      runId, 
      commands.typecheck.command, 
      commands.typecheck.args,
      commands.typecheck.description
    );
    results.push(tscResult);
    
    if (!tscResult.passed) {
      console.log(`[verify] ${commands.typecheck.description} failed`);
    }
  } else {
    console.log('[verify] No typecheck command found, skipping');
  }
  
  // Run tests
  if (commands.test) {
    console.log(`[verify] Running ${commands.test.description}...`);
    const testResult = await runVerifyCommand(
      runId, 
      commands.test.command, 
      commands.test.args,
      commands.test.description
    );
    results.push(testResult);
    
    if (!testResult.passed) {
      console.log(`[verify] ${commands.test.description} failed`);
    }
  } else {
    console.log('[verify] No test command found, skipping');
  }
  
  const allPassed = results.length > 0 && results.every(r => r.passed);
  
  // Emit final verification status
  await postEvents(runId, [{
    type: 'VERIFY_FINISHED',
    payload: {
      passed: allPassed,
      results: results.map(r => ({
        command: r.command,
        passed: r.passed,
        duration: r.duration,
        exitCode: r.exitCode,
      })),
    },
  }]);
  
  return { passed: allPassed, results };
}