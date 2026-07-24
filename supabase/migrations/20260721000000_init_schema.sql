-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  role TEXT CHECK (role IN ('normal', 'politician', 'admin')) DEFAULT 'normal',
  full_name TEXT,
  country TEXT DEFAULT 'Canada',
  constituency TEXT,
  designation TEXT,
  current_ghost_id UUID DEFAULT gen_random_uuid() UNIQUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, current_ghost_id) 
  VALUES (NEW.id, gen_random_uuid())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. User Locations Table
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

CREATE UNIQUE INDEX IF NOT EXISTS user_locations_profile_id_key ON public.user_locations (profile_id);

-- RLS for user_locations
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own location" ON public.user_locations FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own location" ON public.user_locations FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own location" ON public.user_locations FOR UPDATE USING (auth.uid() = profile_id);

-- 4. Map Shapes (Electoral Boundaries) Table
CREATE TABLE IF NOT EXISTS public.map_shapes (
    id BIGSERIAL PRIMARY KEY,
    country TEXT NOT NULL,
    boundary_type TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    geom GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_shapes_geom ON public.map_shapes USING GIST (geom);

-- RPC to insert map shape
CREATE OR REPLACE FUNCTION public.insert_map_shape(
    p_country TEXT,
    p_boundary_type TEXT,
    p_name TEXT,
    p_code TEXT,
    p_properties JSONB,
    p_geojson JSONB
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.map_shapes (country, boundary_type, name, code, properties, geom)
    VALUES (
        p_country,
        p_boundary_type,
        p_name,
        p_code,
        p_properties,
        ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326)::geometry(MultiPolygon, 4326)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to find boundaries by point
CREATE OR REPLACE FUNCTION public.find_boundaries_by_point(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    country TEXT,
    boundary_type TEXT,
    code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT ms.id, ms.name, ms.country, ms.boundary_type, ms.code
    FROM public.map_shapes ms
    WHERE ST_Contains(ms.geom, ST_SetSRID(ST_Point(lng, lat), 4326));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to get GeoJSON shapes
CREATE OR REPLACE FUNCTION public.get_geojson_shapes()
RETURNS TABLE (
    id BIGINT,
    geojson JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT ms.id, ST_AsGeoJSON(ms.geom)::jsonb
    FROM public.map_shapes ms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ghost_id UUID NOT NULL,
    constituency TEXT NOT NULL,
    content TEXT NOT NULL,
    video_url TEXT,
    image_url TEXT,
    is_country BOOLEAN DEFAULT false,
    is_international BOOLEAN DEFAULT false,
    federal_boundary_id TEXT,
    polling_district_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    likes_count INT DEFAULT 0,
    dislikes_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_posts_constituency ON public.posts(constituency);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert posts" ON public.posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    ghost_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 7. Post Votes Table
CREATE TABLE IF NOT EXISTS public.post_votes (
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    ghost_id UUID NOT NULL,
    vote_type SMALLINT NOT NULL CHECK (vote_type IN (1, -1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (post_id, ghost_id)
);

ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read votes" ON public.post_votes FOR SELECT USING (true);

-- RPC to vote on post
CREATE OR REPLACE FUNCTION vote_on_post(p_post_id UUID, p_vote_type SMALLINT)
RETURNS void AS $$
DECLARE
    v_ghost_id UUID;
    v_existing_vote SMALLINT;
BEGIN
    SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();
    
    IF v_ghost_id IS NULL THEN
        RAISE EXCEPTION 'Ghost identity not found';
    END IF;

    SELECT vote_type INTO v_existing_vote FROM public.post_votes WHERE post_id = p_post_id AND ghost_id = v_ghost_id;

    IF v_existing_vote IS NOT NULL THEN
        IF v_existing_vote = p_vote_type THEN
            DELETE FROM public.post_votes WHERE post_id = p_post_id AND ghost_id = v_ghost_id;
            
            IF p_vote_type = 1 THEN
                UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = p_post_id;
            ELSE
                UPDATE public.posts SET dislikes_count = dislikes_count - 1 WHERE id = p_post_id;
            END IF;
        ELSE
            UPDATE public.post_votes SET vote_type = p_vote_type WHERE post_id = p_post_id AND ghost_id = v_ghost_id;
            
            IF p_vote_type = 1 THEN
                UPDATE public.posts SET likes_count = likes_count + 1, dislikes_count = dislikes_count - 1 WHERE id = p_post_id;
            ELSE
                UPDATE public.posts SET likes_count = likes_count - 1, dislikes_count = dislikes_count + 1 WHERE id = p_post_id;
            END IF;
        END IF;
    ELSE
        INSERT INTO public.post_votes (post_id, ghost_id, vote_type) VALUES (p_post_id, v_ghost_id, p_vote_type);
        
        IF p_vote_type = 1 THEN
            UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
        ELSE
            UPDATE public.posts SET dislikes_count = dislikes_count + 1 WHERE id = p_post_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Politician Profiles Table
CREATE TABLE IF NOT EXISTS public.politician_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    political_target_role TEXT,
    target_boundary_type TEXT,
    target_boundary_id TEXT,
    target_boundary_name TEXT,
    political_party TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.politician_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Politician Profiles" ON public.politician_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own politician profile" ON public.politician_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own politician profile" ON public.politician_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own politician profile" ON public.politician_profiles FOR DELETE USING (auth.uid() = id);

-- 9. Politician Supporters Table
CREATE TABLE IF NOT EXISTS public.politician_supporters (
    politician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    supporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (politician_id, supporter_id)
);

ALTER TABLE public.politician_supporters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Supporters" ON public.politician_supporters FOR SELECT USING (true);
CREATE POLICY "Auth Insert Own Support" ON public.politician_supporters FOR INSERT WITH CHECK (auth.uid() = supporter_id);
CREATE POLICY "Auth Delete Own Support" ON public.politician_supporters FOR DELETE USING (auth.uid() = supporter_id);

-- 10. Designations Table
CREATE TABLE IF NOT EXISTS public.designations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(country, name)
);

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read designations" ON public.designations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert designations" ON public.designations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Default Designation Data
INSERT INTO public.designations (country, name) VALUES 
('USA', 'Mayor'), ('USA', 'Senator'), ('USA', 'Representative'), ('USA', 'Governor'), ('USA', 'City Council'),
('India', 'MLA'), ('India', 'MP'), ('India', 'Mayor'), ('India', 'Corporator'), ('India', 'Sarpanch'),
('Canada', 'MP'), ('Canada', 'MPP'), ('Canada', 'MLA'), ('Canada', 'Mayor'), ('Canada', 'City Councillor'),
('UK', 'MP'), ('UK', 'Mayor'), ('UK', 'Councillor'), ('UK', 'Member of Scottish Parliament'),
('Australia', 'MP'), ('Australia', 'Senator'), ('Australia', 'Mayor'), ('Australia', 'Councillor')
ON CONFLICT (country, name) DO NOTHING;
