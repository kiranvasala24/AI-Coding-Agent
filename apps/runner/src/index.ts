/**
 * Local Runner Daemon
 * 
 * Entry point for the runner service.
 * Run with: bun run dev
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config';
import { sendHeartbeat } from './supabase';
import { listFiles, search, openFile, getRepoInfo } from './tools/repo';
import { startRunPoller, cleanupCurrentRun } from './runner';

const app = new Hono();

// Enable CORS for local development
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    runnerId: config.runnerId,
    repoPath: config.repoPath,
    version: config.version,
    uptime: process.uptime(),
  });
});

// Status with capabilities
app.get('/status', (c) => {
  return c.json({
    runnerId: config.runnerId,
    repoPath: config.repoPath,
    version: config.version,
    capabilities: {
      repoRead: true,
      patchApply: true,
      dockerVerify: config.dockerEnabled,
      dockerAvailable: config.dockerAvailable,
      ripgrepAvailable: config.ripgrepAvailable,
    },
    os: config.os,
    packageManager: config.packageManager,
    commandTimeoutMs: config.commandTimeoutMs,
    patchConstraints: config.patchConstraints,
  });
});

// Repo: List files
app.post('/repo/list', async (c) => {
  try {
    const { pattern, maxDepth } = await c.req.json();
    const result = await listFiles(pattern || '**/*', maxDepth);
    return c.json(result);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Repo: Search
app.post('/repo/search', async (c) => {
  try {
    const { query, filePattern } = await c.req.json();
    const results = await search(query, filePattern);
    return c.json({ results });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Repo: Open file
app.post('/repo/open', async (c) => {
  try {
    const { file, startLine, endLine } = await c.req.json();
    const result = await openFile(file, startLine, endLine);
    return c.json(result);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Repo: Info
app.get('/repo/info', async (c) => {
  try {
    const info = await getRepoInfo();
    return c.json(info);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Start heartbeat loop with exponential backoff on failure
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let heartbeatFailures = 0;
const MAX_HEARTBEAT_FAILURES = 5;

async function startHeartbeat() {
  const beat = async () => {
    try {
      await sendHeartbeat();
      heartbeatFailures = 0;
      console.log('[heartbeat] ✓ sent');
    } catch (error) {
      heartbeatFailures++;
      console.error(`[heartbeat] ✗ failed (${heartbeatFailures}/${MAX_HEARTBEAT_FAILURES}):`, 
        error instanceof Error ? error.message : error);
      
      if (heartbeatFailures >= MAX_HEARTBEAT_FAILURES) {
        console.error('[heartbeat] Too many failures, will keep trying...');
      }
    }
  };
  
  // Send immediately
  await beat();
  
  // Then every configured interval
  heartbeatInterval = setInterval(beat, config.heartbeatIntervalMs);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[runner] Shutting down...');
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  cleanupCurrentRun();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[runner] Received SIGTERM, shutting down...');
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  cleanupCurrentRun();
  process.exit(0);
});

// Startup
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Local Runner Daemon                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Runner ID:     ${config.runnerId.slice(0, 43).padEnd(43)}║
║  Version:       ${config.version.padEnd(43)}║
║  Repo Path:     ${config.repoPath.slice(0, 43).padEnd(43)}║
║  Port:          ${String(config.port).padEnd(43)}║
║  Pkg Manager:   ${config.packageManager.padEnd(43)}║
║  Docker:        ${(config.dockerEnabled ? 'enabled' : config.dockerAvailable ? 'available' : 'not found').padEnd(43)}║
║  Ripgrep:       ${(config.ripgrepAvailable ? 'available' : 'not found').padEnd(43)}║
╚═══════════════════════════════════════════════════════════════╝
`);

// Start services
startHeartbeat();
startRunPoller();

// Start server
export default {
  port: config.port,
  fetch: app.fetch,
};

console.log(`[server] Listening on http://localhost:${config.port}`);
