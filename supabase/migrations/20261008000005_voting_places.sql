-- Voting places (advance + general voting day) for local elections, kept in
-- their own tables and tagged by election name/date so any election can reuse
-- them. Rows attach to a municipality via map_shape_id, so every seat whose
-- shape matches (mayor, councillor, trustee ...) can show the same list.
--
-- Public read; writes only via service role / psql (no client write policy).

CREATE TABLE IF NOT EXISTS public.voting_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_name TEXT NOT NULL,
  election_date DATE NOT NULL,
  map_shape_id BIGINT REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  jurisdiction_name TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION CHECK (lng BETWEEN -180 AND 180),
  geocode_source TEXT,
  notes TEXT,
  source_url TEXT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voting_places_shape_date
  ON public.voting_places(map_shape_id, election_date);
CREATE INDEX IF NOT EXISTS idx_voting_places_election
  ON public.voting_places(election_name);

CREATE TABLE IF NOT EXISTS public.voting_place_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_place_id UUID NOT NULL REFERENCES public.voting_places(id) ON DELETE CASCADE,
  voting_type TEXT NOT NULL CHECK (voting_type IN ('advance', 'general', 'special')),
  vote_date DATE NOT NULL,
  opens_at TIME,
  closes_at TIME,
  notes TEXT,
  UNIQUE (voting_place_id, voting_type, vote_date)
);

CREATE INDEX IF NOT EXISTS idx_voting_place_schedules_place
  ON public.voting_place_schedules(voting_place_id);

ALTER TABLE public.voting_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_place_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voting_places public read" ON public.voting_places;
CREATE POLICY "voting_places public read" ON public.voting_places
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "voting_place_schedules public read" ON public.voting_place_schedules;
CREATE POLICY "voting_place_schedules public read" ON public.voting_place_schedules
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.voting_places FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.voting_place_schedules FROM anon, authenticated;
