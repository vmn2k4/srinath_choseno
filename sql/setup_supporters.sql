-- Create politician_supporters table
CREATE TABLE IF NOT EXISTS public.politician_supporters (
    politician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    supporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (politician_id, supporter_id)
);

-- Enable RLS
ALTER TABLE public.politician_supporters ENABLE ROW LEVEL SECURITY;

-- Public can read all supporters (needed for counts)
DROP POLICY IF EXISTS "Public Read Supporters" ON public.politician_supporters;
CREATE POLICY "Public Read Supporters" ON public.politician_supporters FOR SELECT USING (true);

-- Authenticated users can insert their own support record
DROP POLICY IF EXISTS "Auth Insert Own Support" ON public.politician_supporters;
CREATE POLICY "Auth Insert Own Support" ON public.politician_supporters FOR INSERT WITH CHECK (auth.uid() = supporter_id);

-- Authenticated users can delete their own support record
DROP POLICY IF EXISTS "Auth Delete Own Support" ON public.politician_supporters;
CREATE POLICY "Auth Delete Own Support" ON public.politician_supporters FOR DELETE USING (auth.uid() = supporter_id);

-- Enable Realtime for the table so counts update live
ALTER PUBLICATION supabase_realtime ADD TABLE public.politician_supporters;
