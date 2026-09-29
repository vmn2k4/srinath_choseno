-- Adds shape_properties to find_overlapping_open_seats so callers can build
-- the same canonical seat slug (buildSeatSlug reads properties.state_name).
-- Return type changes, so the function has to be dropped and recreated.
DROP FUNCTION IF EXISTS public.find_overlapping_open_seats(uuid, double precision);

CREATE FUNCTION public.find_overlapping_open_seats(
  p_seat_id uuid,
  p_min_overlap double precision DEFAULT 0.5
)
RETURNS TABLE(
  seat_id uuid,
  role_title text,
  map_shape_id bigint,
  shape_name text,
  shape_properties jsonb,
  boundary_type text,
  election_id uuid,
  election_name text,
  election_date date,
  election_status text,
  overlap double precision
)
LANGUAGE sql
STABLE
AS $function$
  WITH base AS (
    SELECT ms.geom, ST_Area(ms.geom) AS area
    FROM public.election_seats es
    JOIN public.map_shapes ms ON ms.id = es.map_shape_id
    WHERE es.id = p_seat_id AND ms.geom IS NOT NULL
  ),
  candidates AS (
    SELECT es.id, es.role_title, ms.id AS shape_id, ms.name, ms.properties, ms.boundary_type,
           e.id AS eid, e.name AS ename, e.election_date, e.status,
           ST_Area(ms.geom) AS area, ms.geom
    FROM public.election_seats es
    JOIN public.map_shapes ms ON ms.id = es.map_shape_id
    JOIN public.elections e ON e.id = es.election_id
    WHERE es.id <> p_seat_id
      AND ms.geom IS NOT NULL
      AND public.compute_election_status(e.status, e.nomination_close_date, e.election_date)
        IN ('nominations_open', 'nominations_closed', 'active')
      AND e.election_date >= CURRENT_DATE
      AND ms.geom && (SELECT geom FROM base)
  ),
  scored AS (
    SELECT c.*,
           ST_Area(ST_Intersection(c.geom, b.geom)) AS inter,
           b.area AS base_area
    FROM candidates c, base b
    WHERE ST_Intersects(c.geom, b.geom)
  )
  SELECT id, role_title, shape_id, name, properties::jsonb, boundary_type, eid, ename, election_date, status,
         GREATEST(inter / NULLIF(area, 0), inter / NULLIF(base_area, 0)) AS overlap
  FROM scored
  WHERE GREATEST(inter / NULLIF(area, 0), inter / NULLIF(base_area, 0)) >= p_min_overlap
  ORDER BY role_title, name;
$function$;

GRANT EXECUTE ON FUNCTION public.find_overlapping_open_seats(uuid, double precision) TO anon, authenticated;
