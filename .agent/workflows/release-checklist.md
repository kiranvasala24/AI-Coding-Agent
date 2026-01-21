---
description: Release Checklist for Staging and Production
---

# Release Checklist

This workflow outlines the steps to verify a deployment in Staging and Production environments.

## 1. Environment Verification
- [ ] Check BuildInfo footer:
  - Staging: Shows `staging`, correct version, and commit.
  - Production: Shows `production`, correct version, and commit.
- [ ] /health check:
  - [ ] Database: Healthy
  - [ ] Edge Functions: Healthy (Verify version and env in message)
  - [ ] Realtime: Healthy
  - [ ] Runner: Degraded (Expected if no local runner is connected)

## 2. Feature Verification (Demo Mode)
- [ ] **Staging**:
  - [ ] Demo Mode is ON by default.
  - [ ] Can run preset tasks (e.g., "Error Handling").
  - [ ] Run completes successfully (Planning -> Executing -> Verifying -> Awaiting Approval).
  - [ ] Approve/Reject buttons work correctly.
  - [ ] "Reset Demo" button clears the state.
- [ ] **Production**:
  - [ ] Demo Mode is OFF by default.
  - [ ] Enabling via `?demo=1` works and activates the demo UI.
  - [ ] "Try Interactive Demo" button on Hero section works and scrolls to Demo.

## 3. Security & Abuse Verification
- [ ] **Rate Limiting**:
  - [ ] Spam the "Start Demo" button (in a live run context or simulated if applicable).
  - [ ] Verify 429 response after limit (10 runs/min).
  - [ ] Verify `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers.
  - [ ] Verify IP detection is correct (not "unknown").
- [ ] **Admin Security**:
  - [ ] `/admin/ping` is publicly accessible.
  - [ ] `/admin/stats` and `/admin/cleanup` reject requests without `x-admin-token`.
  - [ ] Rejects requests from unauthorized origins.
- [ ] **Runner Security**:
  - [ ] All `/runner/*` endpoints reject requests without `x-runner-token`.

## 4. Maintenance Verification
- [ ] **Cleanup**:
  - [ ] Manually trigger `/admin/cleanup` via Postman or script.
  - [ ] Verify JSON summary output includes `deleted` and `remaining` stats.

## 5. Deployment Isolation
- [ ] Verify Staging and Production have different `SUPABASE_URL`s.
- [ ] Verify secrets are not shared between environments.
