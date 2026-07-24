-- Multi-boundary constituency membership system
-- Replaces the two-column (polling_district_id/federal_boundary_id) model with a
-- proper many-to-many membership system: admins define a ranked set of boundary
-- types per country, every uploaded shape is one uniquely-identified group, every
-- user's full set of matching memberships is stored and kept in sync, and every
-- post is tagged with all of the poster's current memberships at creation time.

-- 1. Country Boundary Types (admin-managed, ranked per country)
CREATE TABLE IF NOT EXISTS public.country_boundary_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country TEXT NOT NULL,
  type_name TEXT NOT NULL,
  rank INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country, type_name),
  UNIQUE(country, rank)
);

ALTER TABLE public.country_boundary_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read boundary types" ON public.country_boundary_types
  FOR SELECT USING (true);

CREATE POLICY "Admins can write boundary types" ON public.country_boundary_types
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 1b. Backfill types for boundary data uploaded before this table existed,
--     so the FK constraint below doesn't reject already-live shapes.
--     (Existing production data: Canada/Federal, Canada/POLLING DISTRICT.)
INSERT INTO public.country_boundary_types (country, type_name, rank)
SELECT DISTINCT ms.country, ms.boundary_type,
  CASE
    WHEN ms.boundary_type ILIKE 'federal%' THEN 1
    WHEN ms.boundary_type ILIKE '%provin%' OR ms.boundary_type ILIKE '%state%' THEN 2
    WHEN ms.boundary_type ILIKE '%municip%' THEN 3
    ELSE 4
  END AS rank
FROM public.map_shapes ms
ON CONFLICT (country, type_name) DO NOTHING;

-- 2. Lock down map_shapes (previously had NO RLS at all) and constrain
--    boundary_type to whatever the admin has registered for that country.
ALTER TABLE public.map_shapes
  ADD CONSTRAINT map_shapes_type_fk FOREIGN KEY (country, boundary_type)
  REFERENCES public.country_boundary_types(country, type_name);

ALTER TABLE public.map_shapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read map shapes" ON public.map_shapes
  FOR SELECT USING (true);

CREATE POLICY "Admins can write map shapes" ON public.map_shapes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- insert_map_shape() is SECURITY DEFINER and bypassed RLS entirely; add an
-- explicit admin check so it can't be used to smuggle in unauthenticated writes.
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
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

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

-- 3. User Boundary Memberships (replaces polling_district_id/federal_boundary_id)
CREATE TABLE IF NOT EXISTS public.user_boundary_memberships (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  map_shape_id BIGINT NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, map_shape_id)
);

CREATE INDEX IF NOT EXISTS idx_ubm_shape ON public.user_boundary_memberships(map_shape_id);

ALTER TABLE public.user_boundary_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memberships" ON public.user_boundary_memberships
  FOR SELECT USING (auth.uid() = profile_id);
-- No client insert/update/delete policy: writes only happen via
-- sync_user_boundary_memberships() and the map_shapes reconciliation trigger below.

-- 4. Full recompute of the calling user's memberships for a given point.
--    Called from onboarding and from the profile-edit location step.
CREATE OR REPLACE FUNCTION public.sync_user_boundary_memberships(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS SETOF public.user_boundary_memberships AS $$
BEGIN
  UPDATE public.user_locations SET latitude = p_lat, longitude = p_lng WHERE profile_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.user_locations (profile_id, latitude, longitude) VALUES (auth.uid(), p_lat, p_lng);
  END IF;

  DELETE FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  INSERT INTO public.user_boundary_memberships (profile_id, map_shape_id)
  SELECT auth.uid(), ms.id
  FROM public.map_shapes ms
  WHERE ST_Contains(ms.geom, ST_SetSRID(ST_Point(p_lng, p_lat), 4326));

  RETURN QUERY SELECT * FROM public.user_boundary_memberships WHERE profile_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4b. Add a single boundary as an extra membership without touching the rest
--     (used when a user manually searches for and adds a specific jurisdiction
--     the point lookup didn't catch).
CREATE OR REPLACE FUNCTION public.add_user_boundary_membership(p_map_shape_id BIGINT)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_boundary_memberships (profile_id, map_shape_id)
  VALUES (auth.uid(), p_map_shape_id)
  ON CONFLICT (profile_id, map_shape_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Reconcile memberships for a single shape whenever an admin edits its
--    geometry (or re-uploads under a new type), so existing users' memberships
--    stay correct without requiring them to touch their own profile.
CREATE OR REPLACE FUNCTION public.reconcile_shape_memberships() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.user_boundary_memberships ubm
  USING public.user_locations ul
  WHERE ubm.map_shape_id = NEW.id
    AND ubm.profile_id = ul.profile_id
    AND (
      ul.latitude IS NULL OR ul.longitude IS NULL
      OR NOT ST_Contains(NEW.geom, ST_SetSRID(ST_Point(ul.longitude, ul.latitude), 4326))
    );

  INSERT INTO public.user_boundary_memberships (profile_id, map_shape_id)
  SELECT ul.profile_id, NEW.id
  FROM public.user_locations ul
  WHERE ul.latitude IS NOT NULL AND ul.longitude IS NOT NULL
    AND ST_Contains(NEW.geom, ST_SetSRID(ST_Point(ul.longitude, ul.latitude), 4326))
  ON CONFLICT (profile_id, map_shape_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reconcile_shape_memberships ON public.map_shapes;
CREATE TRIGGER trg_reconcile_shape_memberships
AFTER INSERT OR UPDATE OF geom ON public.map_shapes
FOR EACH ROW EXECUTE FUNCTION public.reconcile_shape_memberships();

-- 6. Posts: drop the old exclusive boundary columns + unused constituency
--    column, add a country column so the Country tab can actually be scoped
--    per-country instead of showing every country's posts to everyone.
ALTER TABLE public.posts DROP COLUMN IF EXISTS federal_boundary_id;
ALTER TABLE public.posts DROP COLUMN IF EXISTS polling_district_id;
ALTER TABLE public.posts DROP COLUMN IF EXISTS constituency;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS country TEXT;

DROP INDEX IF EXISTS idx_posts_constituency;

-- 7. Post Boundaries: snapshot of which groups a post belongs to at creation time.
CREATE TABLE IF NOT EXISTS public.post_boundaries (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  map_shape_id BIGINT NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, map_shape_id)
);

CREATE INDEX IF NOT EXISTS idx_post_boundaries_shape ON public.post_boundaries(map_shape_id);

ALTER TABLE public.post_boundaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read post boundaries" ON public.post_boundaries
  FOR SELECT USING (true);
-- No client insert policy: written only by create_post().

-- 8. create_post(): inserts a post under the caller's current ghost_id, then
--    copies their current memberships into post_boundaries in the same
--    transaction, so a single post shows up in every matching group's feed.
CREATE OR REPLACE FUNCTION public.create_post(
  p_content TEXT,
  p_image_url TEXT DEFAULT NULL,
  p_video_url TEXT DEFAULT NULL,
  p_link_metadata JSONB DEFAULT NULL
) RETURNS public.posts AS $$
DECLARE
  v_ghost_id UUID;
  v_country TEXT;
  v_post public.posts;
BEGIN
  SELECT current_ghost_id, country INTO v_ghost_id, v_country FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  INSERT INTO public.posts (ghost_id, content, image_url, video_url, link_metadata, country, is_country, is_international)
  VALUES (v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata, v_country, true, true)
  RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  RETURN v_post;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Track onboarding completion explicitly instead of inferring it from a
--    single constituency string (a user can legitimately have zero boundary
--    memberships if admin hasn't uploaded shapes for their area yet).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
