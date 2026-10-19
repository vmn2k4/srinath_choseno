-- 'active' used to mean "voting day or any day after", so a finished race
-- stayed active forever until an admin manually closed it (the BC municipal
-- races of 2026-10-17 were still listed as active the day after). Voting day
-- itself is still 'active'; the day after it the election is 'closed'.
-- "Day after" uses Pacific time so a western-Canada/US election day isn't cut
-- off early by UTC rolling over in the evening.
CREATE OR REPLACE FUNCTION public.compute_election_status(
  p_status text, p_nomination_close_date date, p_election_date date
)
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT CASE
    WHEN p_status IN ('draft', 'closed') THEN p_status
    WHEN (now() AT TIME ZONE 'America/Vancouver')::date > p_election_date THEN 'closed'
    WHEN CURRENT_DATE >= p_election_date THEN 'active'
    WHEN CURRENT_DATE >= p_nomination_close_date THEN 'nominations_closed'
    ELSE 'nominations_open'
  END;
$function$;

-- The public directory/places RPCs filtered on the raw stored column, which is
-- only lazily synced; use the computed status like the other open-race RPCs.
CREATE OR REPLACE FUNCTION public.get_public_election_directory()
RETURNS TABLE (
  election_id uuid, election_name text, election_date date, status text,
  seat_count bigint, candidate_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    e.id, e.name, e.election_date, e.status,
    (SELECT count(*) FROM public.election_seats s WHERE s.election_id = e.id),
    (SELECT count(*)
       FROM public.election_candidates c
       JOIN public.election_seats s ON s.id = c.seat_id
       JOIN public.profiles p ON p.id = c.politician_id
      WHERE s.election_id = e.id AND c.status = 'approved' AND NOT p.is_test)
  FROM public.elections e
  WHERE public.compute_election_status(e.status, e.nomination_close_date, e.election_date)
    IN ('nominations_open', 'nominations_closed', 'active')
  ORDER BY e.election_date NULLS LAST, e.name;
$$;

CREATE OR REPLACE FUNCTION public.get_public_election_places(p_per_election integer DEFAULT 8)
RETURNS TABLE (election_id uuid, shape_id bigint, place_name text, candidate_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH counts AS (
    SELECT s.election_id, ms.id AS shape_id, ms.name AS place_name, count(c.id) AS candidate_count
    FROM public.election_seats s
    JOIN public.elections e
      ON e.id = s.election_id
     AND public.compute_election_status(e.status, e.nomination_close_date, e.election_date)
         IN ('nominations_open', 'nominations_closed', 'active')
    JOIN public.map_shapes ms ON ms.id = s.map_shape_id
    JOIN public.election_candidates c ON c.seat_id = s.id AND c.status = 'approved'
    JOIN public.profiles p ON p.id = c.politician_id AND NOT p.is_test
    GROUP BY s.election_id, ms.id, ms.name
  ), ranked AS (
    SELECT counts.*, row_number() OVER (PARTITION BY counts.election_id ORDER BY counts.candidate_count DESC, counts.place_name) AS rn
    FROM counts
  )
  SELECT ranked.election_id, ranked.shape_id, ranked.place_name, ranked.candidate_count
  FROM ranked
  WHERE ranked.rn <= greatest(p_per_election, 1)
  ORDER BY ranked.election_id, ranked.rn;
$$;

-- One-time catch-up for races already over (draft/closed rows untouched).
SELECT public.sync_election_status();
