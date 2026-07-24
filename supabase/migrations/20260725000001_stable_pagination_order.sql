-- Result-set pagination via PostgREST's Range header (LIMIT/OFFSET under the
-- hood) is only guaranteed consistent across repeated calls when the query
-- has a deterministic ORDER BY. Both functions could return more than the
-- 1000-row default page size for a large real-world upload, so make their
-- ordering explicit now that callers page through results with .range().
CREATE OR REPLACE FUNCTION public.suggest_replaced_shapes(p_upload_id UUID)
RETURNS SETOF public.map_shapes AS $$
  SELECT DISTINCT old.*
  FROM public.map_shapes old
  JOIN public.map_shapes new_shape ON new_shape.upload_id = p_upload_id
  WHERE old.retired_at IS NULL
    AND (old.upload_id IS NULL OR old.upload_id <> p_upload_id)
    AND old.country = new_shape.country
    AND old.boundary_type = new_shape.boundary_type
    AND ST_Intersects(old.geom, new_shape.geom)
  ORDER BY old.id;
$$ LANGUAGE sql STABLE;

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
    )
  ORDER BY ul.profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
