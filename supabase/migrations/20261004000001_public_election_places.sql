-- Top places (boundaries) per live election by approved-candidate count, for
-- the "browse who's running by place" links on /elections. Those links point
-- at the /elections/<place> pages that actually rank in search, so the
-- landing page passes them crawl paths and authority.
--
-- SECURITY DEFINER for the same reason as get_public_election_directory():
-- the equivalent RLS-checked join is slow and hits the anon 3s
-- statement_timeout on a cold connection. Filters mirror what anon can see:
-- non-draft elections, approved candidates, no test profiles.
CREATE OR REPLACE FUNCTION public.get_public_election_places(p_per_election integer DEFAULT 8)
RETURNS TABLE (
  election_id uuid,
  shape_id bigint,
  place_name text,
  candidate_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH counts AS (
    SELECT s.election_id, ms.id AS shape_id, ms.name AS place_name, count(c.id) AS candidate_count
    FROM public.election_seats s
    JOIN public.elections e
      ON e.id = s.election_id AND e.status IN ('nominations_open', 'nominations_closed', 'active')
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

GRANT EXECUTE ON FUNCTION public.get_public_election_places(integer) TO anon, authenticated;
