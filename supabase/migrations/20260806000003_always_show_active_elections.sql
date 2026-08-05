-- get_active_elections_for_user() update:
-- 1. Returns boundary_name (map_shapes.name)
-- 2. Removes filter for election_notification_dismissals so active elections ALWAYS show up in the user's feed bar without hide/close options.

DROP FUNCTION IF EXISTS public.get_active_elections_for_user();

CREATE FUNCTION public.get_active_elections_for_user()
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
  WHERE e.status IN ('nominations_open', 'active')
  ORDER BY e.election_date, es.role_title;
$$;
