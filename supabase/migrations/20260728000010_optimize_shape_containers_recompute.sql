-- recompute_shape_containers_for_container's first backfill run timed out
-- (2min statement_timeout) computing ST_Area(ST_Intersection(...)) inline
-- alongside the bbox/country/retired filters in one WHERE, the same planner
-- pathology fixed for find_shapes_within in 20260728000008 -- except this
-- function has no target boundary_type to filter by (it computes membership
-- for every ordinary shape, of any type, against one container), so the
-- (boundary_type, country) composite index can't help narrow candidates the
-- way it did there.
--
-- Splitting into MATERIALIZED CTEs alone wasn't enough here: the planner's
-- row-count estimate for the bbox candidate scan is wildly low (it expects
-- ~1 row, there are actually thousands), so it picks a plain per-tuple Index
-- Scan (each match = one random heap page read) instead of a Bitmap Heap
-- Scan (sorted, batched page reads) -- 6s vs under 1s for the same ~3000
-- candidates. Forcing bitmap scans for the duration of this function fixes
-- that; the expensive area-ratio test then only runs against the resulting
-- ~2000 real candidates instead of blocking on scan I/O first.
CREATE OR REPLACE FUNCTION public.recompute_shape_containers_for_container(p_container_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text;
BEGIN
  DELETE FROM shape_containers WHERE container_shape_id = p_container_id;

  SELECT country INTO v_country FROM map_shapes WHERE id = p_container_id AND retired_at IS NULL;
  IF v_country IS NULL THEN
    RETURN;
  END IF;

  SET LOCAL enable_indexscan = off;

  INSERT INTO shape_containers (map_shape_id, container_shape_id)
  WITH container AS MATERIALIZED (
    SELECT geom FROM map_shapes WHERE id = p_container_id
  ),
  candidates AS MATERIALIZED (
    SELECT c.id, c.geom
    FROM map_shapes c, map_shapes container_shape
    WHERE container_shape.id = p_container_id
      AND c.id <> p_container_id
      AND c.country = v_country
      AND c.retired_at IS NULL
      AND ST_Intersects(c.geom, container_shape.geom)
  )
  SELECT cand.id, p_container_id
  FROM candidates cand CROSS JOIN container
  WHERE ST_Area(ST_Intersection(cand.geom, container.geom)) / NULLIF(ST_Area(cand.geom), 0) > 0.02;
END;
$$;
