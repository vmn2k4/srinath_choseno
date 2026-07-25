-- find_shapes_within previously RETURNED SETOF map_shapes (every column, including the raw
-- geom and properties JSONB), even though every caller (ElectionsAdmin.jsx,
-- BoundaryVisualizer.jsx) only ever chains .select('id'), .select('id,name,code') afterward.
--
-- Discovered while verifying this feature's Ontario-municipal seat-creation flow: direct
-- psql/EXPLAIN ANALYZE consistently showed ~140-160ms for this exact call (Ontario -> 622
-- Municipal matches), but the identical call via PostgREST consistently failed with
-- "canceling statement due to statement timeout" (57014) at just over the calling role's
-- timeout (anon 3s, authenticated 8s) -- every attempt, not an intermittent cold-cache blip.
-- Root-caused by testing a throwaway narrow-return variant of this function side by side:
-- PostgREST materializes a set-returning function's result before projecting the caller's
-- requested columns (needed for correctness with VOLATILE functions), which forces
-- Postgres to fully construct/detoast every column of every matched row -- including geom,
-- which is large for a real province's worth of municipalities and enormous for the small
-- fraction of outlier shapes (same "4% outlier" pattern documented in
-- 20260727000005_simplify_geojson_outliers.sql) -- regardless of what the client actually
-- asked for. A direct psql query never pays this cost because it can stream the id column
-- without ever touching the toasted geom value it doesn't reference.
--
-- Fix: narrow the function's own return type to just the columns any caller has ever used
-- (id, name, code) -- same lesson already applied to get_geojson_shapes, now applied here.
-- Verified via a side-by-side throwaway test function before making this change: the narrow
-- version consistently succeeds via PostgREST in under 1.5s where the wide version
-- consistently timed out.
-- Also drops a stale 2-arg overload left over from before p_country was added
-- (20260724000000_election_mode.sql) -- still returning the old wide SETOF map_shapes type
-- and unused by any current caller (both call sites always pass p_country), but a landmine
-- for the exact same timeout bug if anything ever called it.
DROP FUNCTION IF EXISTS public.find_shapes_within(bigint, text);
DROP FUNCTION IF EXISTS public.find_shapes_within(bigint, text, text);

CREATE FUNCTION public.find_shapes_within(
  p_container_shape_id bigint,
  p_target_boundary_type text,
  p_country text DEFAULT NULL
)
RETURNS TABLE(id bigint, name text, code text)
LANGUAGE sql STABLE AS $$
  SELECT ms.id, ms.name, ms.code
  FROM public.map_shapes ms, public.map_shapes container
  WHERE container.id = p_container_shape_id
    AND ms.boundary_type = p_target_boundary_type
    AND (p_country IS NULL OR ms.country = p_country)
    AND ms.id <> container.id
    AND ms.retired_at IS NULL
    AND ST_Intersects(ms.geom, container.geom);
$$;
