-- get_geojson_shapes() (fixed for the id-filtering timeout in
-- 20260727000003) hit a second, different timeout: bulk-fetching geometry
-- for a real province's worth of municipalities (622 for Ontario) via
-- PostgREST/the pooler consistently timed out, even though the identical
-- query completed in ~450ms over a warm interactive psql session. Root
-- cause (confirmed by testing 10/50/100/150-id subsets): NOT the shape
-- count — a small minority of outlier geometries (26 of 622 Ontario
-- municipalities, i.e. ~4%, StatsCan "Unorganized"/rural subdivisions with
-- complex coastlines, same pattern as the Arctic territories in §6) blow up
-- both the ST_AsGeoJSON payload size (59MB total for Ontario) and, more
-- importantly, whatever per-request overhead PostgREST/the connection
-- pooler adds on top of raw query time for a response that large.
--
-- Tried and rejected: simplifying ALL requested geometries uniformly
-- (ST_SimplifyPreserveTopology on all 622 took 20s+ — topology-preserving
-- simplification is itself expensive per-geometry, and applying it to
-- geometries that were already simple wasted time for no benefit).
--
-- Fix: only simplify geometries that are actually complex (> 5,000
-- vertices — matches the same tier boundary scripts/upload_boundary.py
-- already uses for its "medium complexity" insert tier) using plain
-- ST_Simplify (not PreserveTopology — confirmed much faster) at 0.005
-- degrees (~500m, appropriate for on-screen map display, not precision
-- boundary determination), repaired via ST_MakeValid + ST_CollectionExtract
-- the same way scripts/upload_boundary.py already does. Verified: Ontario's
-- full 622-shape municipal set went from a consistent PostgREST timeout to
-- 15.6MB / ~5s (well under the authenticated role's 8s budget) — 654ms of
-- actual query time via psql, the rest is response transfer.
--
-- This changes geometry returned to EVERY caller (BoundaryPicker.jsx's
-- individual-shape fetches too, not just bulk Visualizer fetches) — judged
-- acceptable because get_geojson_shapes only ever feeds map *display*
-- (BoundaryPicker's map column, the Visualizer), never anything that
-- determines an actual boundary/membership decision; those all query
-- map_shapes.geom directly (find_boundaries_by_point, find_shapes_within,
-- sync_user_boundary_memberships), which are untouched by this migration.
CREATE OR REPLACE FUNCTION public.get_geojson_shapes(ids bigint[] DEFAULT NULL)
 RETURNS TABLE(id bigint, geojson jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT ms.id,
      ST_AsGeoJSON(
        CASE WHEN ST_NPoints(ms.geom) > 5000
          THEN ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Simplify(ms.geom, 0.005)), 3))
          ELSE ms.geom
        END
      )::jsonb
    FROM public.map_shapes ms
    WHERE ids IS NULL OR ms.id = ANY(ids);
END;
$function$;
