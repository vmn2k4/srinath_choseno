-- 1. Create the new User Locations table
CREATE TABLE IF NOT EXISTS public.user_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ghost_id UUID,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    federal_boundary_id TEXT,
    polling_district_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Set up RLS for user_locations
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own location" ON public.user_locations FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own location" ON public.user_locations FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own location" ON public.user_locations FOR UPDATE USING (auth.uid() = profile_id);

-- 2. Update posts table with country and international flags
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_country BOOLEAN DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS federal_boundary_id TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS polling_district_id TEXT;
