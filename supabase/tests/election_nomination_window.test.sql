-- Regression test for the nomination-window rules added in
-- 20260821000004_election_nomination_windows.sql:
--   1. A politician CANNOT self-nominate (apply_for_seat) once the election
--      has passed nomination_close_date.
--   2. That seat's approved election administrator CAN still add a
--      candidate (add_unregistered_candidate) after nominations close.
--   3. That same election administrator CAN remove a candidate
--      (remove_candidate) after nominations close.
--   A control at the end re-confirms self-nomination still works while
--   nominations ARE open, so a failure above means "blocked", not "broken".
--
-- There's no JS test framework in this repo (no Jest/Vitest configured) and
-- these rules live entirely in SECURITY DEFINER Postgres functions gated on
-- auth.uid(), so this is a self-contained psql script rather than a JS
-- test file. It fakes auth.uid() the same way PostgREST populates it
-- (request.jwt.claim.sub — see auth.uid()'s own definition), and the whole
-- thing runs inside one transaction that ALWAYS rolls back at the end, so
-- it can safely run against the real dev/prod Supabase project (this repo
-- has no separate test DB) without leaving any test data behind, pass or
-- fail.
--
-- Run with:
--   psql "$DATABASE_URL" -f supabase/tests/election_nomination_window.test.sql
--
-- Every assertion RAISE NOTICEs "PASS: ..." on success. Any failure raises
-- an exception that aborts the script (and the transaction) with a message
-- naming exactly what broke, so a bare "ERROR:" in the output means a rule
-- regressed.

BEGIN;

DO $$
DECLARE
  v_election_id uuid;
  v_seat_id uuid;
  v_politician_id uuid := gen_random_uuid();
  v_admin_id uuid := gen_random_uuid();
  v_shape_id bigint;
  v_candidate_id uuid;
  v_err_caught boolean;
BEGIN
  -- ── Fixtures ──────────────────────────────────────────────────────────
  SELECT id INTO v_shape_id FROM public.map_shapes LIMIT 1;
  IF v_shape_id IS NULL THEN
    RAISE EXCEPTION 'FAIL(setup): no map_shapes row available to attach a test seat to';
  END IF;

  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, is_test)
  VALUES (v_politician_id, 'politician', 'TEST Nominee (unit test)', true, true);

  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, is_test)
  VALUES (v_admin_id, 'normal', 'TEST Election Admin (unit test)', true, true);

  -- nomination_close_date in the past, election_date in the future -> the
  -- stored status still says nominations_open (deliberately, to prove the
  -- checks re-derive from dates rather than trusting a stale column) but
  -- the *effective* status is nominations_closed.
  INSERT INTO public.elections (name, nomination_open_date, nomination_close_date, election_date, status, created_by)
  VALUES (
    'TEST nomination window election (unit test)',
    CURRENT_DATE - 30, CURRENT_DATE - 1, CURRENT_DATE + 30,
    'nominations_open', v_admin_id
  )
  RETURNING id INTO v_election_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_shape_id, 'TEST Seat (unit test)')
  RETURNING id INTO v_seat_id;

  INSERT INTO public.election_administrators (seat_id, profile_id, status, reviewed_at, reviewed_by)
  VALUES (v_seat_id, v_admin_id, 'approved', now(), v_admin_id);

  IF public.compute_election_status('nominations_open', CURRENT_DATE - 1, CURRENT_DATE + 30) <> 'nominations_closed' THEN
    RAISE EXCEPTION 'FAIL(setup): fixture dates don''t actually land in nominations_closed — check the DO block''s dates';
  END IF;

  -- ── Test 1: self-nomination is blocked once nominations are closed ────
  PERFORM set_config('request.jwt.claim.sub', v_politician_id::text, true);

  v_err_caught := false;
  BEGIN
    PERFORM public.apply_for_seat(v_seat_id, 'I would like to run');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'FAIL: apply_for_seat let a politician self-nominate after nominations_closed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.election_candidates WHERE seat_id = v_seat_id AND politician_id = v_politician_id) THEN
    RAISE EXCEPTION 'FAIL: a candidacy row exists despite apply_for_seat raising an exception';
  END IF;
  RAISE NOTICE 'PASS: self-nomination is blocked once nominations_closed';

  -- ── Test 2: the seat's approved election admin CAN still add a candidate ─
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);

  BEGIN
    SELECT id INTO v_candidate_id
    FROM public.add_unregistered_candidate(
      v_seat_id, 'TEST Stub Candidate (unit test)', NULL::bigint, NULL::text, NULL::text, NULL::text, NULL::text
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: election administrator could not add a candidate during nominations_closed (%)', SQLERRM;
  END;

  IF v_candidate_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: add_unregistered_candidate returned no row';
  END IF;
  RAISE NOTICE 'PASS: approved election administrator CAN add a candidate during nominations_closed';

  -- ── Test 3: the same election admin CAN remove a candidate ────────────
  BEGIN
    PERFORM public.remove_candidate(v_candidate_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: election administrator could not remove a candidate during nominations_closed (%)', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM public.election_candidates WHERE id = v_candidate_id) THEN
    RAISE EXCEPTION 'FAIL: candidate row still exists after remove_candidate';
  END IF;
  RAISE NOTICE 'PASS: approved election administrator CAN remove a candidate during nominations_closed';

  -- ── Control: self-nomination DOES work while nominations ARE open ─────
  -- (proves Test 1 failing would mean "blocked", not "apply_for_seat is
  -- just broken outright")
  UPDATE public.elections SET nomination_close_date = CURRENT_DATE + 10 WHERE id = v_election_id;
  PERFORM set_config('request.jwt.claim.sub', v_politician_id::text, true);

  BEGIN
    PERFORM public.apply_for_seat(v_seat_id, 'I would like to run');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL(control): apply_for_seat rejected a politician while nominations_open (%)', SQLERRM;
  END;
  RAISE NOTICE 'PASS(control): self-nomination succeeds while nominations are actually open';

  RAISE NOTICE '=== ALL ASSERTIONS PASSED ===';
END $$;

-- Always rolls back — this is a read/verify script, it must never leave
-- test rows in the shared dev/prod project.
ROLLBACK;
