-- Enable REPLICA IDENTITY FULL for realtime updates on runs table
ALTER TABLE public.runs REPLICA IDENTITY FULL;

-- Add runs to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.runs;