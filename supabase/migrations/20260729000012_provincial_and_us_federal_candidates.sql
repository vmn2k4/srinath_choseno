-- Extends the official-candidate-data pattern from
-- 20260729000011_federal_election_candidates.sql (Canada federal) to two
-- more jurisdictions researched at the same time: Canadian provincial
-- elections (starting with BC, the only province with real seats on the
-- platform today) and US federal elections. Each jurisdiction's source
-- publishes results in a genuinely different shape, so they get their own
-- tables rather than forcing one schema on all of them:
--
--   * Canada federal (existing): per-riding URL, keyed by an opaque
--     Elections Canada "EV" event id that has to be discovered per event.
--   * Canada provincial (this migration): one page per election listing
--     every riding's candidates in a single HTML table, at a URL slug
--     that's predictable ahead of time (BC has fixed election dates) --
--     no opaque id to discover, but still needs a "which election" row.
--   * US federal (this migration): the FEC's OpenFEC API is queried
--     directly by (cycle, office, state, district) -- self-describing,
--     no separate "event" registry needed at all.

-- ── Canada provincial ───────────────────────────────────────────────────
CREATE TABLE public.provincial_election_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province text NOT NULL,             -- 2-letter code, e.g. 'BC'
  name text NOT NULL,
  source_url text NOT NULL,           -- the one page listing every riding's candidates for this election
  event_date date,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province, source_url)
);

CREATE TABLE public.provincial_election_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_event_id uuid NOT NULL REFERENCES public.provincial_election_events(id) ON DELETE CASCADE,
  map_shape_id bigint NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  party_name text,
  elected boolean NOT NULL DEFAULT false,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_event_id, map_shape_id, candidate_name)
);

CREATE INDEX idx_provincial_election_candidates_event ON public.provincial_election_candidates(election_event_id);
CREATE INDEX idx_provincial_election_candidates_shape ON public.provincial_election_candidates(map_shape_id);

-- ── US federal ───────────────────────────────────────────────────────────
-- No separate "events" table: (cycle, office) from the FEC's OpenFEC API
-- fully identifies "which election" on its own, so a row here already
-- carries the full context. map_shape_id is NULL for President (a
-- nationwide race, not tied to any one district/state shape).
CREATE TABLE public.us_federal_election_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle integer NOT NULL,             -- FEC election cycle, e.g. 2026
  office text NOT NULL CHECK (office IN ('H', 'S', 'P')),
  map_shape_id bigint REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  fec_candidate_id text NOT NULL,
  candidate_name text NOT NULL,
  party_name text,
  candidate_status text,              -- FEC's C/F/N/P (candidate/future/not yet/prior)
  incumbent_challenge text,           -- FEC's I/C/O (incumbent/challenger/open seat)
  source_url text NOT NULL,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle, office, map_shape_id, fec_candidate_id)
);

CREATE INDEX idx_us_federal_election_candidates_shape ON public.us_federal_election_candidates(map_shape_id);
CREATE INDEX idx_us_federal_election_candidates_cycle ON public.us_federal_election_candidates(cycle, office);

-- ── RLS: same public-read, script-only-write pattern as the Canada
-- federal tables -- official government data, no reason to gate it. ──────
ALTER TABLE public.provincial_election_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provincial_election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.us_federal_election_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads provincial election events" ON public.provincial_election_events
  FOR SELECT USING (true);
CREATE POLICY "Public reads provincial election candidates" ON public.provincial_election_candidates
  FOR SELECT USING (true);
CREATE POLICY "Public reads US federal election candidates" ON public.us_federal_election_candidates
  FOR SELECT USING (true);
