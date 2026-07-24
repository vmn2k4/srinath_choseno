-- Admin-panel boundary upload: histogram/cutoff analysis, tiered batching,
-- and resumability. See ARCHITECTURE.md for the full design.

-- Track expected vs. actual progress so an interrupted upload can be
-- distinguished from a genuinely finished one (a completed upload can still
-- have expected_count > actual row count if shapes were intentionally
-- skipped for exceeding the vertex cutoff — completed_at is what matters).
ALTER TABLE public.boundary_uploads ADD COLUMN IF NOT EXISTS expected_count INT;
ALTER TABLE public.boundary_uploads ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Bulk insert for the low-complexity tier: one network round-trip for a
-- whole batch of shapes instead of one call per shape.
CREATE OR REPLACE FUNCTION public.insert_map_shapes_batch(p_shapes JSONB)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.map_shapes (country, boundary_type, name, code, properties, geom, upload_id)
  SELECT
    s->>'country', s->>'boundary_type', s->>'name', s->>'code',
    COALESCE(s->'properties', '{}'::jsonb),
    ST_SetSRID(ST_GeomFromGeoJSON((s->'geojson')::text), 4326)::geometry(MultiPolygon, 4326),
    (s->>'upload_id')::uuid
  FROM jsonb_array_elements(p_shapes) AS s;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
