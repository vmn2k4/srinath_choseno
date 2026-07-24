-- Election Mode: admin-declared elections over a set of real boundaries,
-- open self-nomination for politician accounts, and a discussion/pitch space
-- per candidacy reusing the existing posts/comments infrastructure.

-- 1. Elections
CREATE TABLE public.elections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  election_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','nominations_open','active','closed')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads non-draft elections, admins read all" ON public.elections
  FOR SELECT USING (
    status <> 'draft' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage elections" ON public.elections
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Election Seats (one row per boundary + role within an election)
CREATE TABLE public.election_seats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  map_shape_id BIGINT NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(election_id, map_shape_id, role_title)
);

CREATE INDEX idx_election_seats_election ON public.election_seats(election_id);
CREATE INDEX idx_election_seats_shape ON public.election_seats(map_shape_id);

ALTER TABLE public.election_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read seats via parent election visibility" ON public.election_seats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.elections e WHERE e.id = election_id
      AND (e.status <> 'draft' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Admins manage seats" ON public.election_seats
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Election Candidates (a politician's application for a seat)
CREATE TABLE public.election_candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seat_id UUID NOT NULL REFERENCES public.election_seats(id) ON DELETE CASCADE,
  politician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  statement TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seat_id, politician_id)
);

CREATE INDEX idx_election_candidates_seat ON public.election_candidates(seat_id);
CREATE INDEX idx_election_candidates_politician ON public.election_candidates(politician_id);

ALTER TABLE public.election_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read candidates via parent election visibility" ON public.election_candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.election_seats s JOIN public.elections e ON e.id = s.election_id
      WHERE s.id = seat_id
      AND (e.status <> 'draft' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Candidates update own application" ON public.election_candidates
  FOR UPDATE USING (auth.uid() = politician_id) WITH CHECK (auth.uid() = politician_id);

CREATE POLICY "Candidates withdraw own application" ON public.election_candidates
  FOR DELETE USING (auth.uid() = politician_id);

CREATE POLICY "Admins manage candidates" ON public.election_candidates
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- No client INSERT policy: applications are only created via apply_for_seat().

-- 4. Candidacy-scoped posts (video pitches + discussion) reuse the existing
--    posts/comments tables, exactly like wall_ghost_id already does for
--    politician walls — just one new nullable tag column.
ALTER TABLE public.posts ADD COLUMN election_candidate_id UUID REFERENCES public.election_candidates(id) ON DELETE CASCADE;
CREATE INDEX idx_posts_election_candidate ON public.posts(election_candidate_id);

-- 5. Persistent candidate identity fields (separate from the per-election
--    "why I'm running" statement, which lives on election_candidates).
ALTER TABLE public.politician_profiles ADD COLUMN education TEXT;
ALTER TABLE public.politician_profiles ADD COLUMN hometown TEXT;

-- 6. Apply to run: server-side checks that the caller is a politician and the
--    election is actually accepting nominations, then upserts.
CREATE OR REPLACE FUNCTION public.apply_for_seat(p_seat_id UUID, p_statement TEXT)
RETURNS public.election_candidates AS $$
DECLARE
  v_role TEXT;
  v_election_status TEXT;
  v_row public.election_candidates;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'politician' THEN
    RAISE EXCEPTION 'Only politician accounts can apply to run';
  END IF;

  SELECT e.status INTO v_election_status
  FROM public.election_seats s
  JOIN public.elections e ON e.id = s.election_id
  WHERE s.id = p_seat_id;

  IF v_election_status IS NULL THEN
    RAISE EXCEPTION 'Seat not found';
  END IF;

  IF v_election_status <> 'nominations_open' THEN
    RAISE EXCEPTION 'This election is not accepting candidates right now';
  END IF;

  INSERT INTO public.election_candidates (seat_id, politician_id, statement)
  VALUES (p_seat_id, auth.uid(), p_statement)
  ON CONFLICT (seat_id, politician_id) DO UPDATE SET statement = EXCLUDED.statement
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Powers the admin "select everything of type X inside this container
--    boundary" tool. Inclusive (ST_Intersects) so edge-straddling boundaries
--    aren't silently dropped — the admin UI treats the result as an editable
--    starting selection, not a final answer.
CREATE OR REPLACE FUNCTION public.find_shapes_within(p_container_shape_id BIGINT, p_target_boundary_type TEXT)
RETURNS SETOF public.map_shapes AS $$
  SELECT ms.*
  FROM public.map_shapes ms, public.map_shapes container
  WHERE container.id = p_container_shape_id
    AND ms.boundary_type = p_target_boundary_type
    AND ms.id <> container.id
    AND ST_Intersects(ms.geom, container.geom);
$$ LANGUAGE sql STABLE;
