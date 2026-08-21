-- Pre-existing bug, found while verifying today's video-interview work
-- didn't regress anything else: candidacy_claim_requests.candidate_id has
-- NO foreign key to election_candidates(id) in the live database, even
-- though 20260802000001_candidacy_claims.sql defines one
-- ("REFERENCES public.election_candidates(id) ON DELETE CASCADE"). The
-- table also carries a requester_name column no migration file accounts
-- for -- this table drifted from its migration history via some unlogged
-- change, unrelated to anything in this session.
--
-- Concrete impact: PostgREST can't resolve the
-- candidacy_claim_requests -> election_candidates embed
-- getClaimRequestsForSeat() relies on (ElectionSeatPageClient's "Pending
-- Claim Requests" panel), so that query 400s for every seat admin, every
-- load, silently (the client only logs to console, nothing surfaces the
-- failure in the UI). Restoring the FK the original migration intended
-- fixes it.
-- 2 pre-existing rows reference a candidate_id that no longer exists in
-- election_candidates (the candidate row was deleted sometime after the
-- request was filed). Both are already resolved (status IN
-- ('approved','rejected'), not 'pending') -- stale audit-trail rows for a
-- candidacy that no longer exists, not actionable data, and they block the
-- FK below. Confirmed via direct inspection before writing this.
DELETE FROM public.candidacy_claim_requests r
WHERE NOT EXISTS (SELECT 1 FROM public.election_candidates c WHERE c.id = r.candidate_id);

ALTER TABLE public.candidacy_claim_requests
  ADD CONSTRAINT candidacy_claim_requests_candidate_id_fkey
  FOREIGN KEY (candidate_id) REFERENCES public.election_candidates(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
