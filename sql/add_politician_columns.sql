ALTER TABLE public.politician_profiles ADD COLUMN IF NOT EXISTS political_party TEXT;
ALTER TABLE public.politician_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
