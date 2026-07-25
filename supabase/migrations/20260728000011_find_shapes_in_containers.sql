-- Cache-backed replacement for calling find_shapes_within live from the
-- frontend. Reads shape_containers (20260728000009) instead of doing a
-- geometry join per request, and accepts multiple container ids at once so
-- callers can select several provinces/states in one action instead of being
-- limited to a single container.
CREATE OR REPLACE FUNCTION public.find_shapes_in_containers(
  p_container_shape_ids bigint[],
  p_target_boundary_type text,
  p_country text DEFAULT NULL::text
)
RETURNS TABLE(id bigint, name text, code text)
LANGUAGE sql
STABLE
AS $function$
  SELECT DISTINCT ms.id, ms.name, ms.code
  FROM public.map_shapes ms
  JOIN public.shape_containers sc ON sc.map_shape_id = ms.id
  WHERE sc.container_shape_id = ANY(p_container_shape_ids)
    AND ms.boundary_type = p_target_boundary_type
    AND (p_country IS NULL OR ms.country = p_country)
    AND ms.retired_at IS NULL
  ORDER BY ms.name;
$function$;
