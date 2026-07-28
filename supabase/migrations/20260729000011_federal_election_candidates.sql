-- Official federal candidate data scraped from Elections Canada's Voter
-- Information Service, kept deliberately separate from election_candidates
-- (our own platform's self-serve applicant table for politicians running
-- campaigns on Choseno). This is government-sourced reference data, not
-- something a user ever applies into.
--
-- federal_election_events.id is Elections Canada's own internal "EV"
-- identifier (not one we generate) -- ev_type is their companion "EV_TYPE"
-- param, always 6 for every riding-candidate-list view observed so far
-- (general election or by-election alike; EV_TYPE appears to select the
-- *view*, not the election type). Both are required to query
-- Scripts/vis/Candidates for a given riding.
CREATE TABLE public.federal_election_events (
  id integer PRIMARY KEY,
  ev_type integer NOT NULL,
  name text NOT NULL,
  event_date date,
  is_general boolean NOT NULL DEFAULT false,
  discovered_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (event, riding, candidate). map_shape_id ties back to the
-- Federal boundary_type rows in map_shapes, matched by FED_NUM == the
-- district's ED code -- see scripts/sync_federal_candidates.py.
CREATE TABLE public.federal_election_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_event_id integer NOT NULL REFERENCES public.federal_election_events(id) ON DELETE CASCADE,
  map_shape_id bigint NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  party_name text,
  elected boolean NOT NULL DEFAULT false,
  source_url text NOT NULL,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_event_id, map_shape_id, candidate_name)
);

CREATE INDEX idx_federal_election_candidates_event ON public.federal_election_candidates(election_event_id);
CREATE INDEX idx_federal_election_candidates_shape ON public.federal_election_candidates(map_shape_id);

ALTER TABLE public.federal_election_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federal_election_candidates ENABLE ROW LEVEL SECURITY;

-- Official public record -- readable by anyone, including anonymous
-- visitors, same as the rest of the election-transparency data in this app.
-- No client write policy: only scripts/sync_federal_candidates.py writes
-- here, connecting directly with DATABASE_URL (service role), bypassing RLS.
CREATE POLICY "Public reads federal election events" ON public.federal_election_events
  FOR SELECT USING (true);

CREATE POLICY "Public reads federal election candidates" ON public.federal_election_candidates
  FOR SELECT USING (true);

-- Known events as of this migration -- discovered by hand via
-- elections.ca's live "upcoming by-elections" pages and, for the two
-- already-expired by-elections, the Wayback Machine (their EV stopped
-- resolving live within a few months of the event concluding -- see the
-- script's module docstring). Candidate rows for these are backfilled by
-- running the sync script while each EV is still live; historical events
-- whose EV has already expired are catalogued here for completeness but
-- won't have candidate rows.
INSERT INTO public.federal_election_events (id, ev_type, name, event_date, is_general) VALUES
  (99, 6, '45th General Election', '2025-04-28', true),
  (63, 6, 'August 18, 2025 By-election (Battle River—Crowfoot)', '2025-08-18', false),
  (64, 6, 'April 13, 2026 By-elections (Terrebonne / Scarborough Southwest / University—Rosedale)', '2026-04-13', false),
  (65, 6, 'August 31, 2026 By-elections (Chicoutimi—Le Fjord / Beaches—East York / North Vancouver—Capilano)', '2026-08-31', false);
