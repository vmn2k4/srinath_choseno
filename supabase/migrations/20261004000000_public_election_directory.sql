-- Public election summary for the /elections landing page (src/app/elections/
-- page.tsx): one row per live election with its race and candidate counts, so
-- logged-out visitors get election cards linking to each election hub instead
-- of a 300-seat list (which cost a 300-row seats query plus a candidates query
-- on every render of the page).
--
-- SECURITY DEFINER on purpose: the same counts through RLS cost several
-- seconds on a cold connection and hit the anon role's 3s statement_timeout.
-- The WHERE clauses below mirror what anon can already see: non-draft
-- elections, approved candidates, and (like the hub pages) no test profiles.
CREATE OR REPLACE FUNCTION public.get_public_election_directory()
RETURNS TABLE (
  election_id uuid,
  election_name text,
  election_date date,
  status text,
  seat_count bigint,
  candidate_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.name,
    e.election_date,
    e.status,
    (SELECT count(*) FROM public.election_seats s WHERE s.election_id = e.id),
    (SELECT count(*)
       FROM public.election_candidates c
       JOIN public.election_seats s ON s.id = c.seat_id
       JOIN public.profiles p ON p.id = c.politician_id
      WHERE s.election_id = e.id
        AND c.status = 'approved'
        AND NOT p.is_test)
  FROM public.elections e
  WHERE e.status IN ('nominations_open', 'nominations_closed', 'active')
  ORDER BY e.election_date NULLS LAST, e.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_election_directory() TO anon, authenticated;
