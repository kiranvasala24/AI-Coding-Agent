# AI Coding Agent – Local-First TypeScript Codebase Assistant

A local-first AI coding agent that understands large TypeScript repositories, proposes scoped code changes, validates them with real tooling, and requires explicit human approval before applying diffs.

Built as a full-stack, safety-aware developer tool with real agent orchestration, streaming logs, and a controllable UX.

---

## What This Project Does

This system lets you:

- Index a large TypeScript repository semantically
- Plan multi-step code changes using an agent loop
- Execute real tooling (search, open files, tests, tsc)
- Stream verification logs in real time
- Propose patches as diffs
- Apply changes only after human approval

The architecture is designed around trust, transparency, and control.

---

## Core Architecture

Browser UI (React)
↓
Edge Functions (Supabase)
↓
Local Runner (Node/Bun, filesystem access)
↓
Sandboxed Verification (tsc, tests, Docker optional)

markdown
Copy code

### Design Principles

- Local-first execution – code never leaves your machine
- Human-in-the-loop – nothing is applied without approval
- Observable agent behavior – every step is logged and streamed
- Safe by default – patch constraints, denylists, rate limits
- Demo-friendly – full simulation mode when no runner is present

---

## Major Components

### Frontend (React + TypeScript)

- Run dashboard with live status updates
- Tool call viewer and verification log stream
- Patch diff viewer with approval controls
- Demo / Simulation mode
- Runner setup wizard
- Health & diagnostics page
- Build info footer (environment, version, commit)

### Backend (Supabase Edge Functions)

- Run creation & lifecycle management
- Runner heartbeat and claiming
- Event streaming (SSE + Realtime)
- Approval and patch application coordination
- Admin cleanup and statistics endpoints
- Rate limiting and payload hardening

### Local Runner (Node/Bun)

- Filesystem access to real repositories
- Repo tools: listFiles, search, open
- Verification via tsc and test runners
- Patch safety enforcement
- Heartbeat and capability handshake
- Idempotent run claiming

---

## Run Lifecycle

queued
↓
running
↓
planning
↓
executing (tool calls)
↓
verifying (tsc/tests)
↓
awaiting_approval
↓
approved → patch applied

yaml
Copy code

Every transition is persisted and streamed to the UI.

---

## Safety & Guardrails

- Human approval required before patch application
- Patch constraints:
  - Maximum files changed
  - Maximum diff size
  - Path denylist
  - Binary file blocking
- Rate limiting on public endpoints
- Runner authentication via token
- Admin endpoints protected by token and origin checks
- Error boundaries prevent white-screen failures
- Startup diagnostics validate configuration and secrets

---

## Demo Mode

The full system can be demonstrated without a local runner:

- Simulated tool calls
- Simulated verification logs
- Fake patches and approvals
- Complete UI flow preserved

Demo mode is enabled by default unless explicitly disabled.

---

## Getting Started (Demo Mode)

```bash
npm install
npm run dev
Open the app and click Start Demo to see the full agent workflow.

Running the Local Runner
Required for real filesystem access and patch application.

1. Configure Environment
Create apps/runner/.env:

env
Copy code
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
RUNNER_TOKEN=your_runner_token
REPO_PATH=/absolute/path/to/a/typescript/repo
2. Start the Runner
bash
Copy code
cd apps/runner
bun install
bun run dev
The dashboard should show Runner: Online within a few seconds.

Health & Monitoring
Visit /health to view:

Database connectivity

Edge function reachability

Realtime connection status

Runner heartbeat

Run statistics (pass rate, duration, volume)

A missing runner is treated as a degraded state, not a failure, to support demo mode.

Maintenance
Automated cleanup workflow removes old runs

Token-protected admin cleanup endpoint

Retention policies configurable per environment

Environments
Recommended setup:

staging – testing and demo verification

production – public deployment

Each environment should have:

Separate Supabase project

Separate runner and admin tokens

Separate frontend environment variables

See docs/DEPLOYMENT.md for full setup instructions.

Documentation
docs/DEPLOYMENT.md – environment setup and migrations

docs/RELEASE_CHECKLIST.md – pre-deploy checklist

apps/runner/ – local runner daemon

/health – runtime health overview

Why This Project Exists
This project demonstrates:

Agentic orchestration beyond simple prompt-response

Real LLM tool-use with side effects

Safe developer tooling design

Full-stack ownership across UI, backend, and infra

Production-grade guardrails for AI systems

It answers a single question clearly:

How do you let AI change real code without losing trust?

License
MIT

yaml
Copy code

---

If you want next, I can:
- Rewrite this for **recruiter-optimized GitHub discovery**
- Add a **system architecture diagram**
- Create a **demo script** for screen recording
- Produce a **one-paragraph portfolio summary**

Just tell me what you want to optimize for.
```
