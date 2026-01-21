-- Create runs table to store agent runs
CREATE TABLE public.runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  task TEXT NOT NULL,
  plan JSONB,
  tool_calls JSONB DEFAULT '[]'::jsonb,
  patches JSONB DEFAULT '[]'::jsonb,
  verification JSONB,
  approval JSONB DEFAULT '{"required": true}'::jsonb,
  risk_assessment JSONB,
  impacted_files TEXT[],
  impacted_symbols TEXT[],
  error JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create run_events table for append-only event log
CREATE TABLE public.run_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patches table for storing diffs
CREATE TABLE public.patches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  files_changed JSONB NOT NULL,
  total_additions INTEGER NOT NULL DEFAULT 0,
  total_deletions INTEGER NOT NULL DEFAULT 0,
  reasoning TEXT,
  constraints_used TEXT[],
  approved BOOLEAN DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_run_events_run_id ON public.run_events(run_id);
CREATE INDEX idx_run_events_created_at ON public.run_events(created_at);
CREATE INDEX idx_patches_run_id ON public.patches(run_id);

-- Enable RLS
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patches ENABLE ROW LEVEL SECURITY;

-- Create public read/write policies (for demo - no auth required)
CREATE POLICY "Public read access for runs" ON public.runs FOR SELECT USING (true);
CREATE POLICY "Public insert access for runs" ON public.runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for runs" ON public.runs FOR UPDATE USING (true);

CREATE POLICY "Public read access for run_events" ON public.run_events FOR SELECT USING (true);
CREATE POLICY "Public insert access for run_events" ON public.run_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read access for patches" ON public.patches FOR SELECT USING (true);
CREATE POLICY "Public insert access for patches" ON public.patches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for patches" ON public.patches FOR UPDATE USING (true);

-- Enable realtime for run_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.run_events;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_runs_updated_at
BEFORE UPDATE ON public.runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();