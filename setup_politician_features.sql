-- 1. Create a separate table for Politician Profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS political_target_role;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS target_boundary_type;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS target_boundary_id;

CREATE TABLE IF NOT EXISTS public.politician_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    political_target_role TEXT,
    target_boundary_type TEXT,
    target_boundary_id TEXT,
    target_boundary_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for Politician Profiles
ALTER TABLE public.politician_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Politician Profiles" ON public.politician_profiles;
CREATE POLICY "Public Read Politician Profiles" ON public.politician_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own politician profile" ON public.politician_profiles;
CREATE POLICY "Users can insert own politician profile" ON public.politician_profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own politician profile" ON public.politician_profiles;
CREATE POLICY "Users can update own politician profile" ON public.politician_profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own politician profile" ON public.politician_profiles;
CREATE POLICY "Users can delete own politician profile" ON public.politician_profiles FOR DELETE USING (auth.uid() = id);

-- 2. Update Posts table to support video uploads
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 3. Setup Storage for Videos
INSERT INTO storage.buckets (id, name, public) VALUES ('politician_videos', 'politician_videos', true) ON CONFLICT (id) DO NOTHING;

-- 4. RLS for Videos Bucket (Public read, Authenticated upload)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'politician_videos');

DROP POLICY IF EXISTS "Auth Users Upload" ON storage.objects;
CREATE POLICY "Auth Users Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'politician_videos' AND auth.role() = 'authenticated');
