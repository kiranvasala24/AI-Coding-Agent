-- Remove public UPDATE policies on runs, patches, run_events
-- Updates should only happen via edge functions using service role

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Public update access for runs" ON public.runs;
DROP POLICY IF EXISTS "Public update access for patches" ON public.patches;

-- Create restricted UPDATE policies that only allow service role (edge functions)
-- These use a function that checks if the request is from service role
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
$$;

-- Runs: only service role can update
CREATE POLICY "Service role can update runs"
ON public.runs
FOR UPDATE
USING (public.is_service_role());

-- Patches: only service role can update  
CREATE POLICY "Service role can update patches"
ON public.patches
FOR UPDATE
USING (public.is_service_role());

-- Run events: only service role can insert (append-only via edge functions)
DROP POLICY IF EXISTS "Public insert access for run_events" ON public.run_events;
CREATE POLICY "Service role can insert run_events"
ON public.run_events
FOR INSERT
WITH CHECK (public.is_service_role());

-- Patches: only service role can insert
DROP POLICY IF EXISTS "Public insert access for patches" ON public.patches;
CREATE POLICY "Service role can insert patches"
ON public.patches
FOR INSERT
WITH CHECK (public.is_service_role());

-- Keep public SELECT access for UI
-- Keep public INSERT for runs only (users can create runs)