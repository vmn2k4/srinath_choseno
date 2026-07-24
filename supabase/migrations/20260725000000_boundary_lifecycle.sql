-- Robust boundary lifecycle: named upload batches, retire-not-mutate for
-- boundaries with real history, a geometry-overlap redistricting suggestion
-- tool, and a smart delete that only ever hard-deletes when nothing would
-- be lost.

-- 1. Upload batches
CREATE TABLE public.boundary_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  boundary_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.boundary_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage boundary uploads" ON public.boundary_uploads
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. map_shapes gains batch membership + retirement.
--    Pre-existing shapes get upload_id = NULL (predate batch tracking).
--    retired_at IS NULL means "currently active" everywhere in the app.
ALTER TABLE public.map_shapes ADD COLUMN upload_id UUID REFERENCES public.boundary_uploads(id) ON DELETE CASCADE;
ALTER TABLE public.map_shapes ADD COLUMN retired_at TIMESTAMPTZ;
CREATE INDEX idx_map_shapes_upload ON public.map_shapes(upload_id);

-- 3. insert_map_shape() now tags the shape with its upload batch.
--    New trailing param with a default keeps existing callers working.
CREATE OR REPLACE FUNCTION public.insert_map_shape(
    p_country TEXT,
    p_boundary_type TEXT,
    p_name TEXT,
    p_code TEXT,
    p_properties JSONB,
    p_geojson JSONB,
    p_upload_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    INSERT INTO public.map_shapes (country, boundary_type, name, code, properties, geom, upload_id)
    VALUES (
        p_country,
        p_boundary_type,
        p_name,
        p_code,
        p_properties,
        ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326)::geometry(MultiPolygon, 4326),
        p_upload_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Retire boundaries: mark inactive and drop current memberships for them
--    (a cache of "who's currently in this area", safe to drop — unlike
--    election_seats/post_boundaries, which are the historical record and
--    are deliberately left untouched).
CREATE OR REPLACE FUNCTION public.retire_shapes(p_shape_ids BIGINT[])
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.map_shapes SET retired_at = now() WHERE id = ANY(p_shape_ids) AND retired_at IS NULL;

  DELETE FROM public.user_boundary_memberships WHERE map_shape_id = ANY(p_shape_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Redistricting suggestion: for a freshly uploaded batch, find currently
--    active same-country/same-type boundaries it geometrically overlaps.
--    Purely advisory — the admin UI treats this as an editable starting
--    selection, never an auto-apply.
CREATE OR REPLACE FUNCTION public.suggest_replaced_shapes(p_upload_id UUID)
RETURNS SETOF public.map_shapes AS $$
  SELECT DISTINCT old.*
  FROM public.map_shapes old
  JOIN public.map_shapes new_shape ON new_shape.upload_id = p_upload_id
  WHERE old.retired_at IS NULL
    AND (old.upload_id IS NULL OR old.upload_id <> p_upload_id)
    AND old.country = new_shape.country
    AND old.boundary_type = new_shape.boundary_type
    AND ST_Intersects(old.geom, new_shape.geom);
$$ LANGUAGE sql STABLE;

-- 6. Coverage-gap preview: real users who'd fall outside every active
--    same-type boundary if the given shapes were retired right now. A
--    nonzero result is a warning surfaced to the admin, never a hard block.
CREATE OR REPLACE FUNCTION public.preview_retirement_coverage_gap(p_shape_ids BIGINT[])
RETURNS TABLE(affected_profile_id UUID) AS $$
DECLARE
  v_country TEXT;
  v_boundary_type TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT country, boundary_type INTO v_country, v_boundary_type
  FROM public.map_shapes WHERE id = p_shape_ids[1];

  RETURN QUERY
  SELECT DISTINCT ul.profile_id
  FROM public.user_locations ul
  WHERE ul.latitude IS NOT NULL AND ul.longitude IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.map_shapes retiring
      WHERE retiring.id = ANY(p_shape_ids)
        AND ST_Contains(retiring.geom, ST_SetSRID(ST_Point(ul.longitude, ul.latitude), 4326))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.map_shapes still_active
      WHERE still_active.retired_at IS NULL
        AND NOT (still_active.id = ANY(p_shape_ids))
        AND still_active.country = v_country
        AND still_active.boundary_type = v_boundary_type
        AND ST_Contains(still_active.geom, ST_SetSRID(ST_Point(ul.longitude, ul.latitude), 4326))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Smart batch delete: hard-delete only if nothing in the batch has real
--    history attached; otherwise refuse with a message the frontend routes
--    into the retire flow instead.
CREATE OR REPLACE FUNCTION public.delete_boundary_upload(p_upload_id UUID)
RETURNS void AS $$
DECLARE
  v_blocked_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT count(*) INTO v_blocked_count
  FROM public.map_shapes ms
  WHERE ms.upload_id = p_upload_id
    AND (
      EXISTS (SELECT 1 FROM public.election_seats es WHERE es.map_shape_id = ms.id)
      OR EXISTS (SELECT 1 FROM public.post_boundaries pb WHERE pb.map_shape_id = ms.id)
    );

  IF v_blocked_count > 0 THEN
    RAISE EXCEPTION 'RETIRE_REQUIRED: % boundaries in this upload are already referenced by elections or posts and cannot be permanently deleted. Retire them instead.', v_blocked_count;
  END IF;

  DELETE FROM public.boundary_uploads WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Retired boundaries must stop being matchable for new memberships or
--    new election seats, while every existing reference to them elsewhere
--    stays exactly as it was.
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
    WHERE ms.retired_at IS NULL
      AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(lng, lat), 4326));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  WHERE ms.retired_at IS NULL
    AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(p_lng, p_lat), 4326));

  RETURN QUERY SELECT * FROM public.user_boundary_memberships WHERE profile_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.find_shapes_within(p_container_shape_id BIGINT, p_target_boundary_type TEXT)
RETURNS SETOF public.map_shapes AS $$
  SELECT ms.*
  FROM public.map_shapes ms, public.map_shapes container
  WHERE container.id = p_container_shape_id
    AND ms.boundary_type = p_target_boundary_type
    AND ms.id <> container.id
    AND ms.retired_at IS NULL
    AND ST_Intersects(ms.geom, container.geom);
$$ LANGUAGE sql STABLE;
