-- find_shapes_in_containers previously returned TABLE(id, name, code) only.
-- Both the election seat-builder and the Boundary Inspector now need
-- properties (to classify each shape's entity type via CSDTYPE) when a
-- container is selected, not just the country-wide path -- Postgres can't
-- change a function's return type via CREATE OR REPLACE, so drop + recreate.
DROP FUNCTION IF EXISTS public.find_shapes_in_containers(bigint[], text, text);

CREATE FUNCTION public.find_shapes_in_containers(
  p_container_shape_ids bigint[],
  p_target_boundary_type text,
  p_country text DEFAULT NULL::text
)
RETURNS TABLE(id bigint, name text, code text, properties jsonb)
LANGUAGE sql
STABLE
AS $function$
  SELECT DISTINCT ms.id, ms.name, ms.code, ms.properties
  FROM public.map_shapes ms
  JOIN public.shape_containers sc ON sc.map_shape_id = ms.id
  WHERE sc.container_shape_id = ANY(p_container_shape_ids)
    AND ms.boundary_type = p_target_boundary_type
    AND (p_country IS NULL OR ms.country = p_country)
    AND ms.retired_at IS NULL
  ORDER BY ms.name;
$function$;
