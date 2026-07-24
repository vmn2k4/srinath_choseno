-- get_geojson_shapes() computed ST_AsGeoJSON for the ENTIRE map_shapes table
-- before either call site's PostgREST filter (.eq/.in on id) was applied,
-- because it's an opaque plpgsql set-returning function with no parameters —
-- Postgres can't push a predicate into it. Now times out at ~14,700 rows.
-- Confirmed via REST: GET .../rpc/get_geojson_shapes?id=eq.<id> -> 57014
-- statement timeout. Fix: accept the ids explicitly and filter server-side.
-- DEFAULT NULL (= no filter) keeps any 0-arg caller working, though the only
-- two callers (BoundaryPicker.jsx) are being updated to always pass ids.
CREATE OR REPLACE FUNCTION public.get_geojson_shapes(ids bigint[] DEFAULT NULL)
 RETURNS TABLE(id bigint, geojson jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT ms.id, ST_AsGeoJSON(ms.geom)::jsonb
    FROM public.map_shapes ms
    WHERE ids IS NULL OR ms.id = ANY(ids);
END;
$function$;
