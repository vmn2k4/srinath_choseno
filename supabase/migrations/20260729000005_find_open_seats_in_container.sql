-- Backs the "browse a different area" filter on the politician's Elections
-- page: given a province/state container, return every open seat located
-- inside it in one server-side join (via the shape_containers cache),
-- instead of the client fetching every shape id in that container and
-- passing a possibly-huge IN(...) list back to election_seats.
CREATE OR REPLACE FUNCTION public.find_open_seats_in_container(p_container_shape_id bigint)
RETURNS TABLE(
  seat_id uuid,
  role_title text,
  map_shape_id bigint,
  shape_name text,
  boundary_type text,
  election_id uuid,
  election_name text,
  election_date date,
  election_status text
)
LANGUAGE sql
STABLE
AS $function$
  SELECT es.id, es.role_title, ms.id, ms.name, ms.boundary_type, e.id, e.name, e.election_date, e.status
  FROM public.election_seats es
  JOIN public.map_shapes ms ON ms.id = es.map_shape_id
  JOIN public.elections e ON e.id = es.election_id
  JOIN public.shape_containers sc ON sc.map_shape_id = es.map_shape_id
  WHERE sc.container_shape_id = p_container_shape_id
    AND e.status IN ('nominations_open', 'active')
    AND e.election_date >= CURRENT_DATE
  ORDER BY es.role_title;
$function$;
