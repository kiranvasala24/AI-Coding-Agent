# Local Runner Daemon

A Bun-based local runner that connects to the cloud backend and executes agent tasks against your local repository.

## Quick Start

```bash
cd apps/runner
bun install
cp .env.example .env
# Edit .env with your values
bun run dev
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key for DB writes | `eyJ...` |
| `RUNNER_TOKEN` | Shared secret for auth | `your-secret-token` |
| `RUNNER_ID` | Unique runner identifier | `runner-local-1` |
| `REPO_PATH` | Path to target repository | `/path/to/your/repo` |
| `PORT` | Local server port | `8787` |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloud (Supabase)                        │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────────┐  │
│  │  runs   │  │run_events│  │ patches │  │ /runner/* edges  │  │
│  └─────────┘  └──────────┘  └─────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Local Runner Daemon                          │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Heartbeat  │  │ Run Claimer  │  │ Tool Executor           │ │
│  │ (5s loop)  │  │ (poll queue) │  │ (repo/verify/patch)     │ │
│  └────────────┘  └──────────────┘  └─────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Local Filesystem                         ││
│  │                    (REPO_PATH)                              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Heartbeat**: Sends status every 5s so dashboard shows "Runner Online"
- **Run Claimer**: Polls for queued runs and claims them
- **Repo Tools**: listFiles, search, open (with ripgrep support)
- **Verification**: Executes tsc, test commands with streaming logs
- **Patch Apply**: Applies approved patches to local filesystem

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /status` | Runner status + capabilities |
| `POST /repo/list` | List files matching glob |
| `POST /repo/search` | Search with ripgrep |
| `POST /repo/open` | Read file contents |

## Capabilities

The runner reports these capabilities in heartbeat:

- `repoRead`: Can read repository files
- `patchApply`: Can apply patches locally
- `dockerVerify`: Docker available for sandboxed verification (optional)
