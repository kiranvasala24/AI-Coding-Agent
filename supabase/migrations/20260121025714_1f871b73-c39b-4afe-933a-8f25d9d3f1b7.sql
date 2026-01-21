-- Create rate_limits table for persistent rate limiting
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_key, window_start)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits
CREATE POLICY "Service role only for rate_limits" 
ON public.rate_limits 
FOR ALL 
USING (public.is_service_role());

-- Create function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_client_key TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Calculate current window start (truncate to window)
  v_window_start := date_trunc('minute', now());
  v_reset_at := v_window_start + (p_window_seconds || ' seconds')::interval;
  
  -- Upsert: increment existing or create new
  INSERT INTO rate_limits (client_key, window_start, request_count)
  VALUES (p_client_key, v_window_start, 1)
  ON CONFLICT (client_key, window_start) 
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING rate_limits.request_count INTO v_current_count;
  
  -- Return result
  allowed := v_current_count <= p_max_requests;
  remaining := GREATEST(0, p_max_requests - v_current_count);
  reset_at := v_reset_at;
  RETURN NEXT;
END;
$$;

-- Create cleanup function for old rate limit entries
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits 
  WHERE window_start < now() - interval '5 minutes';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create index for efficient lookups
CREATE INDEX idx_rate_limits_client_window ON public.rate_limits(client_key, window_start);