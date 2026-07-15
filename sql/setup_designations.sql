-- Run this in your Supabase SQL Editor to set up the dynamic designations table

CREATE TABLE IF NOT EXISTS public.designations (
  id uuid default gen_random_uuid() primary key,
  country text not null,
  name text not null,
  UNIQUE(country, name)
);

-- Set up Security Policies
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read designations" 
ON public.designations FOR SELECT 
USING (true);

-- Any authenticated user can insert (so when a user adds a new one, it saves globally)
CREATE POLICY "Authenticated users can insert designations" 
ON public.designations FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Insert the default starting data
INSERT INTO public.designations (country, name) VALUES 
('USA', 'Mayor'), ('USA', 'Senator'), ('USA', 'Representative'), ('USA', 'Governor'), ('USA', 'City Council'),
('India', 'MLA'), ('India', 'MP'), ('India', 'Mayor'), ('India', 'Corporator'), ('India', 'Sarpanch'),
('Canada', 'MP'), ('Canada', 'MPP'), ('Canada', 'MLA'), ('Canada', 'Mayor'), ('Canada', 'City Councillor'),
('UK', 'MP'), ('UK', 'Mayor'), ('UK', 'Councillor'), ('UK', 'Member of Scottish Parliament'),
('Australia', 'MP'), ('Australia', 'Senator'), ('Australia', 'Mayor'), ('Australia', 'Councillor')
ON CONFLICT (country, name) DO NOTHING;
