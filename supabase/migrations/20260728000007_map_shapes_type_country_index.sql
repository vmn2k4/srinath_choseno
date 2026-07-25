-- find_shapes_within (and any other spatial query filtering by boundary_type+country) was
-- forced through idx_map_shapes_geom alone: a GiST bbox scan returns every shape near the
-- container regardless of type/country, then boundary_type/country are applied as a plain
-- Filter afterward. For a container like Ontario, whose bbox overlaps thousands of shapes
-- across every boundary type and both countries, this meant evaluating the expensive
-- ST_Intersects predicate against far more candidates than necessary before narrowing to the
-- ~130-shape Provincial-riding answer -- 1.68s execution (EXPLAIN ANALYZE, 8424 of 8558
-- candidates discarded by the post-hoc filter), well past PostgREST's role timeouts (anon 3s,
-- authenticated 8s) once connection/serialization overhead is added, even though the same
-- combination was fast for Municipal targets (candidate geometries are far simpler there).
--
-- Fix: a supporting btree index Postgres can combine with the GiST index via BitmapAnd, so
-- boundary_type+country narrows the candidate set BEFORE the per-row ST_Intersects check runs
-- -- verified via EXPLAIN ANALYZE: candidates dropped from 8558 to 761 pre-filter, execution
-- time from 1.68s to 30ms (warm) / ~900ms (cold, single backend not yet holding the plan).
CREATE INDEX IF NOT EXISTS idx_map_shapes_type_country
  ON public.map_shapes (boundary_type, country)
  WHERE retired_at IS NULL;

ANALYZE public.map_shapes;
