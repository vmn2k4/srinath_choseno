-- find_shapes_within used ST_Intersects, which matches any target shape that
-- merely touches the container's border (e.g. a Yukon/NWT/Alberta riding
-- sharing an edge with the BC provincial outline) as if it were "inside" the
-- container.
--
-- Point-in-polygon containment (ST_Contains(container, ST_PointOnSurface(ms)))
-- was tried and rejected: BC's Province container is simplified (~2km
-- tolerance, see 20260727000004), which thins out small coastal/island
-- geometry, so real BC island ridings (e.g. Oak Bay-Gordon Head) lost their
-- representative point falling inside the simplified container -- trading
-- false positives for false negatives.
--
-- Fix: require the target shape's overlap with the container to cover a
-- meaningful fraction of its own area, not just any nonzero intersection.
-- Verified against real data (BC container, Provincial target): shapes that
-- only share a border line/sliver top out at 0.63% overlap (Banff-Kananaskis),
-- while every genuine BC riding -- including island ones -- clears 5%
-- (Richmond-Bridgeport, the lowest). A 2% threshold sits in the middle of
-- that gap with margin on both sides.
--
-- Performance note: putting the ST_Area(ST_Intersection(...)) test directly
-- alongside the boundary_type/country/bbox filters in one WHERE clause
-- confuses the planner into abandoning the BitmapAnd of idx_map_shapes_geom +
-- idx_map_shapes_type_country (20260728000007's fix) for a geom-index-only
-- scan that inspects thousands of candidates one at a time -- 500ms-1.7s and
-- occasionally over PostgREST's anon 3s statement_timeout. Splitting into two
-- MATERIALIZED CTEs (cheap candidate scan first, full-detail area ratio only
-- against that handful of rows after) keeps the original fast plan for the
-- candidate scan; the area computation then only runs against ~100 rows
-- instead of ~3000, landing at ~500-650ms total -- comfortably inside both
-- PostgREST role timeouts.
CREATE OR REPLACE FUNCTION public.find_shapes_within(
  p_container_shape_id bigint,
  p_target_boundary_type text,
  p_country text DEFAULT NULL::text
)
RETURNS TABLE(id bigint, name text, code text)
LANGUAGE sql
STABLE
AS $function$
  WITH container AS MATERIALIZED (
    SELECT geom FROM public.map_shapes WHERE id = p_container_shape_id
  ),
  candidates AS MATERIALIZED (
    SELECT ms.id, ms.name, ms.code, ms.geom
    FROM public.map_shapes ms, public.map_shapes container_shape
    WHERE container_shape.id = p_container_shape_id
      AND ms.boundary_type = p_target_boundary_type
      AND (p_country IS NULL OR ms.country = p_country)
      AND ms.id <> container_shape.id
      AND ms.retired_at IS NULL
      AND ST_Intersects(ms.geom, container_shape.geom)
  )
  SELECT c.id, c.name, c.code
  FROM candidates c CROSS JOIN container
  WHERE ST_Area(ST_Intersection(c.geom, container.geom)) / NULLIF(ST_Area(c.geom), 0) > 0.02;
$function$;
