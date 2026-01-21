# Release Checklist

Use this checklist for every release. Complete staging first, then production.

## Pre-Release

- [ ] All tests pass locally (`npm run typecheck && npm run lint && npm run build`)
- [ ] CI pipeline passes on main branch
- [ ] No critical security warnings in console
- [ ] Token validation script passes (`npx tsx scripts/validate-tokens.ts`)

## Database & Functions (per environment)

- [ ] Migrations applied (if any schema changes)
- [ ] Edge functions deployed:
  - [ ] `runs`
  - [ ] `runner`
  - [ ] `patches`
  - [ ] `run-events`
  - [ ] `admin`
- [ ] Function secrets set:
  - [ ] `RUNNER_TOKEN` (different per environment!)
  - [ ] `ADMIN_TOKEN` (optional, defaults to RUNNER_TOKEN)
  - [ ] `ALLOWED_ORIGINS` (optional, for admin endpoint)

## Frontend Deploy

- [ ] Environment variables set:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
  - [ ] `VITE_DEMO_MODE_ENABLED` (true for staging, false for prod if desired)
  - [ ] `VITE_ENV` (staging | production)
- [ ] Deploy triggered
- [ ] Deployment successful

## Post-Deploy Verification

### UI & Infrastructure
- [ ] App loads without errors
- [ ] No DiagnosticsBanner warnings
- [ ] `/health` page shows:
  - [ ] Database: ✅ Healthy
  - [ ] Edge Functions: ✅ Healthy
  - [ ] Realtime: ✅ Healthy
  - [ ] Runner Heartbeat: (depends on runner)

### Core Functionality
- [ ] "Start Demo" creates a run (check for 201 response)
- [ ] Rate limiting works (429 after 10+ rapid creates)
- [ ] Run status updates appear in real-time

### Runner Mode (if testing with local runner)
- [ ] Runner connects and shows "Online"
- [ ] `queued` → `running` transition works
- [ ] Tool calls appear in ToolCallsViewer
- [ ] Verification logs stream in real-time
- [ ] Patch appears in DiffViewer
- [ ] Approve → Apply works
- [ ] Export JSON includes all data

### Admin Endpoints
- [ ] `GET /admin/stats` returns counts with valid token
- [ ] `GET /admin/stats` returns 401 without token
- [ ] `POST /admin/cleanup` works with token
- [ ] Origin restrictions work (if configured)

## Staging-Only Tests
- [ ] Cleanup with `retentionDays: 0` deletes all data
- [ ] Re-run full test after cleanup to verify fresh state

## Production Promotion

Only after staging passes:
- [ ] Tag release in git: `git tag v1.x.x && git push --tags`
- [ ] Deploy to production
- [ ] Run post-deploy verification on production
- [ ] Verify demo mode matches intended behavior

## Rollback Plan

If issues occur:
1. Revert frontend to previous deploy
2. If DB migration caused issues, apply rollback migration
3. Edge functions auto-deploy from code, revert commit if needed

## Version Pinning

Ensure these are pinned in CI and documented:
- Node.js: 20.x
- Bun: 1.x (for runner)
- Deno: (uses Supabase edge runtime)

---

**Last updated:** Check git history for this file
