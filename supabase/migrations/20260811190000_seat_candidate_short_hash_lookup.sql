-- Performance fix: seat and candidate SEO slugs (buildSeatSlug/buildCandidateSlug
-- in src/lib/utils/slugs.ts) always end in a short 6-character hex hash derived
-- from the row's id (id with dashes stripped, first 6 chars) — they never carry
-- the full UUID. Every /elections/seat/[seatId] and .../candidate/[candidateId]
-- page view (plus every seat listed via getCandidatesBySeatIds) was therefore
-- hitting the "no full UUID match" fallback in getSeatById/getCandidatesBySeatIds/
-- getCandidateById/getPublicCandidateById, which fetched the ENTIRE
-- election_seats or election_candidates table (with joins) and linear-scanned it
-- in JS to find the matching row. That cost grows with every seat/candidate
-- added and runs on nearly every election-related page.
--
-- Fix: an expression index on the same short-hash computation, plus a SQL
-- function to resolve a short hash straight to its row id via that index. The
-- application still keeps its in-memory scan as a last-resort fallback for any
-- slug shape these don't cover.

CREATE INDEX IF NOT EXISTS idx_election_seats_short_hash
  ON public.election_seats (left(replace(id::text, '-', ''), 6));

CREATE INDEX IF NOT EXISTS idx_election_candidates_short_hash
  ON public.election_candidates (left(replace(id::text, '-', ''), 6));

CREATE OR REPLACE FUNCTION public.find_seat_id_by_short_hash(short_hash text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT id FROM public.election_seats
  WHERE left(replace(id::text, '-', ''), 6) = lower(short_hash)
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.find_candidate_id_by_short_hash(short_hash text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT id FROM public.election_candidates
  WHERE left(replace(id::text, '-', ''), 6) = lower(short_hash)
  LIMIT 1;
$function$;
