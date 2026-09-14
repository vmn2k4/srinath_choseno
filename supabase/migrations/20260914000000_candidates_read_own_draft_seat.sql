-- Gap found while QA-testing the interview-claim flow: a candidate who
-- legitimately claimed a seat (election_candidates.politician_id = their own
-- auth.uid(), via the "Candidates read own application" policy) still could
-- not read their own seat's role_title/map_shape or parent election's
-- name/date while that election is 'draft' -- election_seats/elections both
-- gate SELECT on "status <> 'draft' OR caller is a site admin" with no
-- allowance for "this is literally my own claimed seat". getCandidateById's
-- nested `election_seats(...elections(...))` embed silently comes back null
-- for a non-admin candidate in that state, which cascades into
-- CandidateApplicationClient never loading electionId -> never fetching
-- election_questions -> submit_candidate_application (SECURITY DEFINER,
-- unaffected by RLS) correctly rejecting the submit for unanswered required
-- questions the candidate was never shown.
--
-- Doesn't come up for a real election: by the time real candidates are
-- invited, the admin has already flipped it out of draft. It bit a test
-- election kept in draft on purpose for admin-only QA visibility, with a
-- non-admin account claiming a seat on it -- but the same gap would hit any
-- real pre-launch/private-beta invite flow too, so this is a real fix, not
-- just a QA workaround. Scoped narrowly: only the seat/election a candidate
-- is actually attached to via election_candidates, nothing wider (other
-- seats/candidates on the same draft election, or other draft elections
-- entirely, stay exactly as invisible to them as before).
--
-- Can't express this as a plain inline EXISTS subquery on election_seats
-- reading election_candidates: election_candidates' own SELECT policy reads
-- back into election_seats/elections, so a raw subquery round-trips into
-- "infinite recursion detected in policy for relation election_seats"
-- (confirmed against the live DB). SECURITY DEFINER helper functions break
-- the cycle -- same reasoning as is_claim_reviewer_for_candidate in
-- 20260802000001_candidacy_claims.sql: they execute as the function owner
-- (postgres, which bypasses RLS), so the query inside never re-triggers the
-- calling table's own policy.
CREATE OR REPLACE FUNCTION public.is_own_claimed_seat(p_seat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.election_candidates
    WHERE seat_id = p_seat_id AND politician_id = (select auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_own_claimed_election(p_election_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.election_candidates c
    JOIN public.election_seats s ON s.id = c.seat_id
    WHERE s.election_id = p_election_id AND c.politician_id = (select auth.uid())
  );
$function$;

CREATE POLICY "Candidates read their own claimed seat" ON public.election_seats
  FOR SELECT USING (public.is_own_claimed_seat(id));

CREATE POLICY "Candidates read their own claimed election" ON public.elections
  FOR SELECT USING (public.is_own_claimed_election(id));
