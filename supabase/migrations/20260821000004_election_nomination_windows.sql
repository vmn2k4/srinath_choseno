-- Splits the old 3-stage election lifecycle (draft -> nominations_open ->
-- active -> closed) into a 4-stage one with an explicit nominations_closed
-- stage in between: draft -> nominations_open -> nominations_closed ->
-- active -> closed. "active" now specifically means voting day itself.
--
-- Previously "activating" an election (nominations_open -> active) had
-- nothing to do with nominations at all -- 20260729000003 explicitly
-- decoupled apply_for_seat from that toggle because there was no dedicated
-- "nominations closed" stage to gate on, so 'active' had to keep accepting
-- applications as a workaround. Now that nominations_closed exists as its
-- own stage, apply_for_seat can go back to gating on nominations_open alone.
--
-- The three stage-boundary dates (nomination_open_date, nomination_close_date,
-- election_date) are now set once at creation time and drive status
-- automatically -- no more manually clicking "Activate Election" through each
-- stage. draft and closed remain manual, admin-only bookends: draft because
-- an election shouldn't go live just because a date rolled past while an
-- admin is still building it, closed because archiving is a deliberate call,
-- not something that happens on its own after voting day.
--
-- Status is kept as a real, lazily-synced column (matching the existing
-- promote_expired_election_admin_applications() pattern for
-- election_administrators) rather than computed on every read, so every
-- existing query/RLS policy that filters on elections.status keeps working
-- unchanged. The security-sensitive checks (apply_for_seat, remove_candidate)
-- don't trust that cached column though -- they re-sync it first, so a stale
-- column can never grant/deny something it shouldn't.

ALTER TABLE public.elections
  ADD COLUMN nomination_open_date date,
  ADD COLUMN nomination_close_date date;

-- Backfill the 4 existing rows (all still 'nominations_open', all with a
-- future election_date): nominations "opened" whenever the election was
-- created, and close 14 days before the election date (or immediately, if
-- that would land before creation).
UPDATE public.elections
SET
  nomination_open_date = created_at::date,
  nomination_close_date = GREATEST(created_at::date, election_date - INTERVAL '14 days')::date
WHERE nomination_open_date IS NULL;

ALTER TABLE public.elections
  ALTER COLUMN nomination_open_date SET NOT NULL,
  ALTER COLUMN nomination_close_date SET NOT NULL;

ALTER TABLE public.elections
  ADD CONSTRAINT elections_nomination_window_check
    CHECK (nomination_open_date <= nomination_close_date AND nomination_close_date <= election_date);

ALTER TABLE public.elections DROP CONSTRAINT elections_status_check;
ALTER TABLE public.elections
  ADD CONSTRAINT elections_status_check
    CHECK (status IN ('draft', 'nominations_open', 'nominations_closed', 'active', 'closed'));

-- Pure function: given the stored status and the two later boundary dates,
-- what should the status actually be right now? draft/closed are manual and
-- pass through unchanged; the three date-driven stages are derived fresh
-- from CURRENT_DATE every time this is called.
CREATE OR REPLACE FUNCTION public.compute_election_status(
  p_status text, p_nomination_close_date date, p_election_date date
)
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT CASE
    WHEN p_status IN ('draft', 'closed') THEN p_status
    WHEN CURRENT_DATE >= p_election_date THEN 'active'
    WHEN CURRENT_DATE >= p_nomination_close_date THEN 'nominations_closed'
    ELSE 'nominations_open'
  END;
$function$;

-- Lazy sync, same shape as promote_expired_election_admin_applications():
-- call with a specific election_id from a write path that cares about
-- correctness right now (apply_for_seat, remove_candidate), or with no
-- argument for a bulk refresh (the admin dashboard calls this before listing
-- elections). draft/closed rows are never touched -- they're manual.
CREATE OR REPLACE FUNCTION public.sync_election_status(p_election_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.elections
  SET status = public.compute_election_status(status, nomination_close_date, election_date)
  WHERE (p_election_id IS NULL OR id = p_election_id)
    AND status NOT IN ('draft', 'closed');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_election_status(uuid) TO anon, authenticated;

-- Nominations now only accept applications while the election is actually in
-- its nominations_open window -- re-derived from today's date, not trusted
-- from the (possibly stale) stored column, so this can't be bypassed by a
-- column that hasn't been synced yet.
CREATE OR REPLACE FUNCTION public.apply_for_seat(p_seat_id uuid, p_statement text)
RETURNS public.election_candidates
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT;
  v_election_id uuid;
  v_stored_status TEXT;
  v_effective_status TEXT;
  v_row public.election_candidates;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'politician' THEN
    RAISE EXCEPTION 'Only politician accounts can apply to run';
  END IF;

  SELECT e.id, e.status INTO v_election_id, v_stored_status
  FROM public.election_seats s
  JOIN public.elections e ON e.id = s.election_id
  WHERE s.id = p_seat_id;

  IF v_election_id IS NULL THEN
    RAISE EXCEPTION 'Seat not found';
  END IF;

  PERFORM public.sync_election_status(v_election_id);

  SELECT public.compute_election_status(status, nomination_close_date, election_date)
    INTO v_effective_status
  FROM public.elections WHERE id = v_election_id;

  IF v_effective_status <> 'nominations_open' THEN
    RAISE EXCEPTION 'This election is not accepting candidates right now';
  END IF;

  INSERT INTO public.election_candidates (seat_id, politician_id, statement)
  VALUES (p_seat_id, auth.uid(), p_statement)
  ON CONFLICT (seat_id, politician_id) DO UPDATE SET statement = EXCLUDED.statement
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- Unified admin removal: unlike remove_unregistered_candidate() (which only
-- lets an election admin remove a stub *they personally added*), this lets a
-- platform admin OR that seat's approved election administrator remove ANY
-- candidate on the seat -- registered or stub, self-added or not. This is
-- the "only admin or election admin can remove a candidate" power the
-- nominations_closed/active stages rely on; self-withdrawal (a candidate
-- deleting their own application) is untouched and still goes through the
-- existing "Candidates withdraw own application" RLS policy at any stage.
CREATE OR REPLACE FUNCTION public.remove_candidate(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_seat_id uuid;
BEGIN
  SELECT seat_id INTO v_seat_id FROM public.election_candidates WHERE id = p_candidate_id;

  IF v_seat_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.election_administrators
    WHERE seat_id = v_seat_id AND profile_id = auth.uid() AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'You are not an approved election administrator for this seat';
  END IF;

  DELETE FROM public.election_candidates WHERE id = p_candidate_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.remove_candidate(uuid) TO authenticated;
