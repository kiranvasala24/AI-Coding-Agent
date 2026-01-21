# Deployment Guide

This guide covers setting up staging and production environments for the AI Coding Agent.

## Quick Start Checklist

### GitHub Secrets Required

Set these in your repo's Settings → Secrets → Actions:

| Secret | Description |
|--------|-------------|
| `STAGING_SUPABASE_URL` | Staging project URL |
| `STAGING_ADMIN_TOKEN` | Admin token for staging cleanup |
| `PROD_SUPABASE_URL` | Production project URL |
| `PROD_ADMIN_TOKEN` | Admin token for production cleanup |
| `VITE_SUPABASE_URL` | (Optional) For CI builds |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | (Optional) For CI builds |

## Environment Setup

### 2. Apply Database Migrations

For each project, apply the migrations in order:

```sql
-- 1. Create runs table
CREATE TABLE public.runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  plan JSONB,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  patches JSONB DEFAULT '[]'::jsonb,
  verification JSONB,
  approval JSONB DEFAULT '{"required": true}'::jsonb,
  risk_assessment JSONB,
  error JSONB,
  impacted_files TEXT[],
  impacted_symbols TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create run_events table
CREATE TABLE public.run_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create patches table
CREATE TABLE public.patches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  summary TEXT NOT NULL,
  files_changed JSONB NOT NULL,
  total_additions INTEGER NOT NULL DEFAULT 0,
  total_deletions INTEGER NOT NULL DEFAULT 0,
  reasoning TEXT,
  constraints_used TEXT[],
  approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patches ENABLE ROW LEVEL SECURITY;

-- 5. Create service role check function
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
$$;

-- 6. Create RLS policies
-- Runs: public can insert and select, only service role can update
CREATE POLICY "Public insert access for runs" ON public.runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read access for runs" ON public.runs FOR SELECT USING (true);
CREATE POLICY "Service role can update runs" ON public.runs FOR UPDATE USING (public.is_service_role());

-- Run events: public can select, only service role can insert
CREATE POLICY "Public read access for run_events" ON public.run_events FOR SELECT USING (true);
CREATE POLICY "Service role can insert run_events" ON public.run_events FOR INSERT WITH CHECK (public.is_service_role());

-- Patches: public can select, only service role can insert/update
CREATE POLICY "Public read access for patches" ON public.patches FOR SELECT USING (true);
CREATE POLICY "Service role can insert patches" ON public.patches FOR INSERT WITH CHECK (public.is_service_role());
CREATE POLICY "Service role can update patches" ON public.patches FOR UPDATE USING (public.is_service_role());

-- 7. Enable realtime
ALTER TABLE public.runs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.runs;

-- 8. Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_runs_updated_at
BEFORE UPDATE ON public.runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

### 3. Set Function Secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

| Secret | Description |
|--------|-------------|
| `RUNNER_TOKEN` | Token for runner authentication (different per environment) |
| `ADMIN_TOKEN` | Token for admin operations (optional, defaults to RUNNER_TOKEN) |

### 4. Deploy Edge Functions

Edge functions are deployed automatically. Ensure these functions exist:
- `runs` - Run CRUD and simulation
- `runner` - Runner bridge endpoints
- `patches` - Patch management
- `run-events` - SSE event streaming
- `admin` - Cleanup and stats (optional)

### 5. Frontend Environment Variables

Create environment-specific configs:

**.env.staging**
```
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-staging-anon-key
VITE_ENV=staging
VITE_DEMO_MODE_ENABLED=true
```

**.env.production**
```
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-prod-anon-key
VITE_ENV=production
VITE_DEMO_MODE_ENABLED=false
```

### 6. Runner Configuration

**apps/runner/.env**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
RUNNER_TOKEN=your-runner-token
REPO_PATH=/path/to/target/repo
```

## Deployment Checklist

### Before First Deploy

- [ ] Staging Supabase project created
- [ ] Production Supabase project created
- [ ] Migrations applied to both projects
- [ ] Secrets set in both projects
- [ ] Frontend env vars configured

### Per-Deploy Checklist

1. [ ] All tests pass locally
2. [ ] CI pipeline passes
3. [ ] Deploy to staging
4. [ ] Run /health checks on staging
5. [ ] Test full demo flow on staging
6. [ ] Test runner connectivity on staging
7. [ ] Promote to production
8. [ ] Verify /health on production

## Admin Operations

### Cleanup Old Data

```bash
curl -X POST https://your-project.supabase.co/functions/v1/admin/cleanup \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"retentionDays": 7}'
```

### Get Stats

```bash
curl https://your-project.supabase.co/functions/v1/admin/stats \
  -H "x-admin-token: YOUR_ADMIN_TOKEN"
```

## Security Notes

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser
- **Always** use different `RUNNER_TOKEN` for staging vs production
- Edge functions use service role key internally (secure)
- Browser only uses anon key (public, safe)
- RLS policies prevent direct writes to protected tables
