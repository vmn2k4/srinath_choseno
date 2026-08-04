-- Persistent debug personas for manual QA — paired with the dev-only floating user-switcher
-- at src/components/dev/DebugUserSwitcher.tsx. Unlike sql/seed_e2e_users.sql (throwaway,
-- deleted after each automated run), these are meant to stay in the database indefinitely.
-- Idempotent — safe to re-run any time (upserts by email / natural key).
--
-- Run manually against the dev Supabase project (never production):
--   PGPASSWORD='<db password>' psql "postgresql://postgres@db.<project-ref>.supabase.co:5432/postgres" -f sql/seed_debug_personas.sql
--
-- All debug accounts share the password: ChosenoDebug123!
--   debug.candidate1@choseno.test    -- politician, candidate for Councillor — Vancouver
--   debug.candidate2@choseno.test    -- politician, candidate for the same seat (2-way race)
--   debug.electionadmin@choseno.test -- citizen, approved election administrator for that seat
--   debug.citizen1..5@choseno.test   -- plain citizens, member of the Vancouver boundary

DO $$
DECLARE
  v_id uuid;
  v_email text;
  v_password text := 'ChosenoDebug123!';
  v_vancouver_shape_id bigint := 21308; -- Canada / Municipal / "Vancouver" — has real map_shapes+role data
  v_election_id uuid;
  v_seat_id uuid;
  v_cand1_id uuid;
  v_cand2_id uuid;
  v_admin_persona_id uuid;
  fixtures text[] := ARRAY[
    'debug.candidate1@choseno.test',
    'debug.candidate2@choseno.test',
    'debug.electionadmin@choseno.test',
    'debug.citizen1@choseno.test',
    'debug.citizen2@choseno.test',
    'debug.citizen3@choseno.test',
    'debug.citizen4@choseno.test',
    'debug.citizen5@choseno.test'
  ];
BEGIN
  -- ── 1. auth.users (create or refresh password) ──────────────────────────
  FOREACH v_email IN ARRAY fixtures LOOP
    SELECT id INTO v_id FROM auth.users WHERE email = v_email;
    IF v_id IS NULL THEN
      v_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        role, aud, confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) VALUES (
        v_id, '00000000-0000-0000-0000-000000000000', v_email,
        crypt(v_password, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        'authenticated', 'authenticated', '', '', '', ''
      );
    ELSE
      UPDATE auth.users
      SET encrypted_password = crypt(v_password, gen_salt('bf')), email_confirmed_at = now()
      WHERE id = v_id;
    END IF;
  END LOOP;

  -- ── 2. profiles ──────────────────────────────────────────────────────────
  SELECT id INTO v_cand1_id FROM auth.users WHERE email = 'debug.candidate1@choseno.test';
  SELECT id INTO v_cand2_id FROM auth.users WHERE email = 'debug.candidate2@choseno.test';
  SELECT id INTO v_admin_persona_id FROM auth.users WHERE email = 'debug.electionadmin@choseno.test';

  INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
  VALUES (v_cand1_id, 'politician', 'Priya Nakamura', 'Canada', true)
  ON CONFLICT (id) DO UPDATE SET role='politician', full_name='Priya Nakamura', onboarding_completed=true;

  INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
  VALUES (v_cand2_id, 'politician', 'Marcus Whitfield', 'Canada', true)
  ON CONFLICT (id) DO UPDATE SET role='politician', full_name='Marcus Whitfield', onboarding_completed=true;

  INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
  VALUES (v_admin_persona_id, 'normal', 'Debug Election Admin', 'Canada', true)
  ON CONFLICT (id) DO UPDATE SET full_name='Debug Election Admin', onboarding_completed=true;

  INSERT INTO public.profiles (id, role, full_name, country, onboarding_completed)
  SELECT id, 'normal', 'Debug Citizen ' || substring(email from 'citizen(\d)'), 'Canada', true
  FROM auth.users WHERE email LIKE 'debug.citizen%@choseno.test'
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'Debug Citizen ' || substring((SELECT email FROM auth.users WHERE id = profiles.id) from 'citizen(\d)'),
    onboarding_completed = true;

  INSERT INTO public.politician_profiles (id, bio, hometown, education)
  VALUES (v_cand1_id, 'Community organizer and small-business owner running on transit expansion and affordable housing.', 'Vancouver, BC', 'UBC, B.A. Urban Studies')
  ON CONFLICT (id) DO UPDATE SET bio=EXCLUDED.bio, hometown=EXCLUDED.hometown, education=EXCLUDED.education;

  INSERT INTO public.politician_profiles (id, bio, hometown, education)
  VALUES (v_cand2_id, 'Former city planner focused on infrastructure renewal and fiscal accountability.', 'Vancouver, BC', 'SFU, M.A. Public Policy')
  ON CONFLICT (id) DO UPDATE SET bio=EXCLUDED.bio, hometown=EXCLUDED.hometown, education=EXCLUDED.education;

  -- ── 3. election + seat ───────────────────────────────────────────────────
  SELECT id INTO v_election_id FROM public.elections WHERE name = 'Debug Municipal Election';
  IF v_election_id IS NULL THEN
    INSERT INTO public.elections (name, election_date, status, created_by)
    VALUES ('Debug Municipal Election', CURRENT_DATE + INTERVAL '60 days', 'nominations_open', v_admin_persona_id)
    RETURNING id INTO v_election_id;
  ELSE
    UPDATE public.elections SET status = 'nominations_open' WHERE id = v_election_id;
  END IF;

  SELECT id INTO v_seat_id FROM public.election_seats
  WHERE election_id = v_election_id AND map_shape_id = v_vancouver_shape_id AND role_title = 'Councillor';
  IF v_seat_id IS NULL THEN
    INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
    VALUES (v_election_id, v_vancouver_shape_id, 'Councillor')
    RETURNING id INTO v_seat_id;
  END IF;

  -- ── 4. candidates (approved, realistic statements) ──────────────────────
  INSERT INTO public.election_candidates (seat_id, politician_id, statement, status, submitted_at, nomination_filed)
  VALUES (v_seat_id, v_cand1_id, 'I''m running to expand rapid transit and keep housing within reach for working families in our district.', 'approved', now(), true)
  ON CONFLICT (seat_id, politician_id) DO UPDATE SET statement=EXCLUDED.statement, status='approved', nomination_filed=true;

  INSERT INTO public.election_candidates (seat_id, politician_id, statement, status, submitted_at, nomination_filed)
  VALUES (v_seat_id, v_cand2_id, 'My priority is fixing our aging infrastructure while keeping the municipal budget balanced.', 'approved', now(), false)
  ON CONFLICT (seat_id, politician_id) DO UPDATE SET statement=EXCLUDED.statement, status='approved';

  -- ── 5. election administrator (approved) ─────────────────────────────────
  INSERT INTO public.election_administrators (seat_id, profile_id, motivation, contact_email, status, submitted_at, reviewed_by, reviewed_at)
  VALUES (v_seat_id, v_admin_persona_id, 'Debug persona — pre-approved for manual QA.', 'debug.electionadmin@choseno.test', 'approved', now(), v_admin_persona_id, now())
  ON CONFLICT (seat_id, profile_id) DO UPDATE SET status='approved', reviewed_at=now();

  -- ── 6. citizen boundary memberships (Vancouver) ──────────────────────────
  INSERT INTO public.user_boundary_memberships (profile_id, map_shape_id)
  SELECT id, v_vancouver_shape_id FROM auth.users WHERE email LIKE 'debug.citizen%@choseno.test'
  ON CONFLICT DO NOTHING;

END $$;

SELECT email, id FROM auth.users WHERE email LIKE 'debug.%@choseno.test' ORDER BY email;
