/**
 * Local Runner Service Types
 * 
 * This file defines the API contract for a local runner daemon that
 * runs on the developer's machine. The local runner has:
 * - Access to the target repository filesystem
 * - Ability to run Docker containers for sandboxed verification
 * - Real-time event streaming back to the cloud backend
 * 
 * The cloud backend (Supabase) handles:
 * - Run orchestration and state management
 * - Event storage and streaming to UI
 * - Patch storage and approval gate
 * - Dashboard and user interactions
 */

// ============= Configuration =============

export interface LocalRunnerConfig {
  /** Path to the target repository */
  repoPath: string;
  
  /** Supabase project URL */
  supabaseUrl: string;
  
  /** Supabase service role key (for posting events) */
  supabaseServiceKey: string;
  
  /** Port for local HTTP API */
  port: number;
  
  /** Docker image for sandbox verification */
  sandboxImage: string;
  
  /** Allowed file patterns for reading */
  fileAllowlist: string[];
  
  /** Denied file patterns */
  fileDenylist: string[];
  
  /** Maximum diff lines per patch */
  maxDiffLines: number;
  
  /** Maximum files changed per patch */
  maxFilesChanged: number;
}

// ============= Repo Tool Types =============

export interface RepoSearchRequest {
  query: string;
  filePattern?: string;
  maxResults?: number;
}

export interface RepoSearchResult {
  file: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

export interface RepoOpenRequest {
  file: string;
  startLine?: number;
  endLine?: number;
}

export interface RepoOpenResult {
  file: string;
  content: string;
  lines: { number: number; content: string }[];
  totalLines: number;
}

export interface RepoListFilesRequest {
  glob: string;
  maxDepth?: number;
}

export interface RepoListFilesResult {
  files: string[];
  count: number;
}

export interface RepoPatchRequest {
  runId: string;
  diff: string; // Unified diff format
  summary: string;
  reasoning?: string;
}

export interface RepoPatchResult {
  patchId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============= Sandbox Types =============

export interface SandboxRunRequest {
  runId: string;
  command: string;
  timeout?: number; // seconds
  env?: Record<string, string>;
}

export interface SandboxRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

// ============= Event Types =============

export type LocalRunnerEventType =
  | 'RUNNER_CONNECTED'
  | 'RUNNER_DISCONNECTED'
  | 'TOOL_CALL_STARTED'
  | 'TOOL_CALL_FINISHED'
  | 'VERIFY_LOG'
  | 'VERIFY_COMMAND_FINISHED'
  | 'PATCH_CREATED'
  | 'PATCH_APPLIED'
  | 'ERROR';

export interface LocalRunnerEvent {
  runId: string;
  type: LocalRunnerEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ============= Local API Endpoints =============

/**
 * Local Runner HTTP API Contract
 * 
 * Base URL: http://localhost:{port}
 * 
 * Endpoints:
 * 
 * POST /local/run
 *   Start a new run with the given task
 *   Body: { runId: string, task: string }
 *   Response: { success: true }
 * 
 * POST /local/repo/search
 *   Search the repository using ripgrep
 *   Body: RepoSearchRequest
 *   Response: { results: RepoSearchResult[] }
 * 
 * POST /local/repo/open
 *   Read file contents
 *   Body: RepoOpenRequest
 *   Response: RepoOpenResult
 * 
 * POST /local/repo/list
 *   List files matching a glob pattern
 *   Body: RepoListFilesRequest
 *   Response: RepoListFilesResult
 * 
 * POST /local/repo/patch
 *   Propose a patch (validates but does not apply)
 *   Body: RepoPatchRequest
 *   Response: RepoPatchResult
 * 
 * POST /local/sandbox/run
 *   Run a command in Docker sandbox
 *   Body: SandboxRunRequest
 *   Response: SandboxRunResult (streams logs via events)
 * 
 * POST /local/patch/apply
 *   Apply an approved patch
 *   Body: { patchId: string, approvalToken: string }
 *   Response: { success: true, filesAffected: number }
 * 
 * GET /local/health
 *   Health check
 *   Response: { status: 'ok', repoPath: string, version: string }
 */

// ============= Implementation Skeleton =============

/**
 * Example local runner implementation (Node.js/Bun)
 * 
 * ```typescript
 * import { serve } from 'bun';
 * import { createClient } from '@supabase/supabase-js';
 * import { exec } from 'child_process';
 * import { readFile, readdir } from 'fs/promises';
 * import { glob } from 'glob';
 * 
 * const config: LocalRunnerConfig = {
 *   repoPath: process.env.REPO_PATH || '.',
 *   supabaseUrl: process.env.SUPABASE_URL!,
 *   supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
 *   port: 3001,
 *   sandboxImage: 'node:20-alpine',
 *   fileAllowlist: ['src/**', 'lib/**', 'test/**'],
 *   fileDenylist: ['node_modules/**', '.env*', '*.lock'],
 *   maxDiffLines: 300,
 *   maxFilesChanged: 10,
 * };
 * 
 * const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
 * 
 * async function emitEvent(event: LocalRunnerEvent) {
 *   await supabase.from('run_events').insert({
 *     run_id: event.runId,
 *     event_type: event.type,
 *     payload: event.payload,
 *   });
 * }
 * 
 * serve({
 *   port: config.port,
 *   async fetch(req) {
 *     const url = new URL(req.url);
 *     
 *     if (url.pathname === '/local/repo/search') {
 *       const { query } = await req.json();
 *       // Use ripgrep: rg --json query
 *       const results = await searchRepo(query);
 *       return Response.json({ results });
 *     }
 *     
 *     if (url.pathname === '/local/sandbox/run') {
 *       const { runId, command } = await req.json();
 *       // Run in Docker with --network none
 *       const result = await runInSandbox(runId, command);
 *       return Response.json(result);
 *     }
 *     
 *     // ... other endpoints
 *   }
 * });
 * 
 * console.log(`Local runner listening on port ${config.port}`);
 * ```
 */

export {};
