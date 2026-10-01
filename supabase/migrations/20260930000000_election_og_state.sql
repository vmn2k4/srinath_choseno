-- Tracks when an election's "parties & candidates" share card last became
-- out of date, so generate-election-parties-og-image can cache the rendered PNG
-- indefinitely and only re-render after the candidate/seat roster changes.
-- (Replaces the old 1h TTL.) The function compares changed_at to the stored
-- object's updated_at; no pg_net/pg_cron needed.
CREATE TABLE IF NOT EXISTS public.election_og_state (
  election_id UUID PRIMARY KEY REFERENCES public.elections(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.election_og_state ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role edge function and the SECURITY DEFINER
-- trigger functions below touch it.

-- Statement-level (transition-table) triggers, so a 200-row bulk import
-- stamps each affected election once instead of 200 times.
CREATE OR REPLACE FUNCTION public.touch_election_og_from_candidates_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.election_og_state (election_id, changed_at)
  SELECT DISTINCT es.election_id, now()
  FROM new_rows nr JOIN public.election_seats es ON es.id = nr.seat_id
  ON CONFLICT (election_id) DO UPDATE SET changed_at = EXCLUDED.changed_at;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.touch_election_og_from_candidates_old()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.election_og_state (election_id, changed_at)
  SELECT DISTINCT es.election_id, now()
  FROM old_rows orr JOIN public.election_seats es ON es.id = orr.seat_id
  ON CONFLICT (election_id) DO UPDATE SET changed_at = EXCLUDED.changed_at;
  RETURN NULL;
END $$;

-- Seat count is on the card too ("93 races").
CREATE OR REPLACE FUNCTION public.touch_election_og_from_seats_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.election_og_state (election_id, changed_at)
  SELECT DISTINCT election_id, now() FROM new_rows
  ON CONFLICT (election_id) DO UPDATE SET changed_at = EXCLUDED.changed_at;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.touch_election_og_from_seats_old()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.election_og_state (election_id, changed_at)
  SELECT DISTINCT election_id, now() FROM old_rows
  WHERE EXISTS (SELECT 1 FROM public.elections e WHERE e.id = old_rows.election_id)
  ON CONFLICT (election_id) DO UPDATE SET changed_at = EXCLUDED.changed_at;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_og_candidates_ins ON public.election_candidates;
CREATE TRIGGER trg_og_candidates_ins AFTER INSERT ON public.election_candidates
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
  EXECUTE FUNCTION public.touch_election_og_from_candidates_new();

DROP TRIGGER IF EXISTS trg_og_candidates_upd ON public.election_candidates;
CREATE TRIGGER trg_og_candidates_upd AFTER UPDATE ON public.election_candidates
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
  EXECUTE FUNCTION public.touch_election_og_from_candidates_new();

DROP TRIGGER IF EXISTS trg_og_candidates_del ON public.election_candidates;
CREATE TRIGGER trg_og_candidates_del AFTER DELETE ON public.election_candidates
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT
  EXECUTE FUNCTION public.touch_election_og_from_candidates_old();

DROP TRIGGER IF EXISTS trg_og_seats_ins ON public.election_seats;
CREATE TRIGGER trg_og_seats_ins AFTER INSERT ON public.election_seats
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
  EXECUTE FUNCTION public.touch_election_og_from_seats_new();

DROP TRIGGER IF EXISTS trg_og_seats_del ON public.election_seats;
CREATE TRIGGER trg_og_seats_del AFTER DELETE ON public.election_seats
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT
  EXECUTE FUNCTION public.touch_election_og_from_seats_old();
