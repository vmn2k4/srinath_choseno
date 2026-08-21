-- find_open_seats_in_container() and get_active_elections_for_user()
-- (20260729000005 / 20260806000003) both filtered on the raw, stored
-- elections.status column -- which is now only lazily synced (see
-- 20260821000004), so a voter-facing browse could show stale data if
-- nothing had recently written to that election. Switch both to filter on
-- compute_election_status(...) instead: always correct regardless of sync
-- timing, and picks up the new nominations_closed stage for free (a seat
-- should stay visible for browsing straight through nominations_closed and
-- into voting day, just like it already did across nominations_open/active).
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
    AND public.compute_election_status(e.status, e.nomination_close_date, e.election_date)
      IN ('nominations_open', 'nominations_closed', 'active')
    AND e.election_date >= CURRENT_DATE
  ORDER BY es.role_title;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_elections_for_user()
RETURNS TABLE(
  seat_id uuid,
  election_id uuid,
  election_name text,
  election_date date,
  role_title text,
  boundary_name text
)
LANGUAGE sql STABLE AS $$
  SELECT
    es.id AS seat_id,
    e.id AS election_id,
    e.name AS election_name,
    e.election_date,
    es.role_title,
    ms.name AS boundary_name
  FROM public.elections e
  JOIN public.election_seats es ON es.election_id = e.id
  LEFT JOIN public.map_shapes ms ON ms.id = es.map_shape_id
  JOIN public.user_boundary_memberships ubm
    ON ubm.map_shape_id = es.map_shape_id AND ubm.profile_id = auth.uid()
  WHERE public.compute_election_status(e.status, e.nomination_close_date, e.election_date)
    IN ('nominations_open', 'nominations_closed', 'active')
  ORDER BY e.election_date, es.role_title;
$$;
