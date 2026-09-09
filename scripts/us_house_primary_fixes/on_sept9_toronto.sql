BEGIN;
DELETE FROM public.election_seats WHERE id = '37950c72-5e71-4c65-96f9-799eef2ecac1';

DO $$
DECLARE
  v_election_id uuid;
  v_ward_shape_id bigint;
  v_seat_id uuid;
  v_stub_id uuid;
  v_ward_name text;
  v_candidate_name text;

BEGIN
  SELECT id INTO v_election_id FROM public.elections WHERE name = '2026 Ontario Municipal Elections';

  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 1 - Etobicoke North')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Abraham Abbey', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Abraham Abbey' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ala''a Adib', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ala''a Adib' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Saima Babar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Saima Babar' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Chloe Brown', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Chloe Brown' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Vincent Crisanti', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Vincent Crisanti' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Norman Hamilton', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Norman Hamilton' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Joseph Martino', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Joseph Martino' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nathen Masri', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nathen Masri' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Hard Parmar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Hard Parmar' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kristian Santos', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kristian Santos' || '-councillor-' || 'Toronto Ward 1 - Etobicoke North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 2 - Etobicoke Centre')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jennifer Alexander', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jennifer Alexander' || '-councillor-' || 'Toronto Ward 2 - Etobicoke Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Katie Andrachuk', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Katie Andrachuk' || '-councillor-' || 'Toronto Ward 2 - Etobicoke Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Stephen Holyday', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Stephen Holyday' || '-councillor-' || 'Toronto Ward 2 - Etobicoke Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 3 - Etobicoke-Lakeshore')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mihaela Andrei', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mihaela Andrei' || '-councillor-' || 'Toronto Ward 3 - Etobicoke-Lakeshore'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Anthony Internicola', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Anthony Internicola' || '-councillor-' || 'Toronto Ward 3 - Etobicoke-Lakeshore'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amber Morley', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amber Morley' || '-councillor-' || 'Toronto Ward 3 - Etobicoke-Lakeshore'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ted Opitz', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ted Opitz' || '-councillor-' || 'Toronto Ward 3 - Etobicoke-Lakeshore'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 4 - Parkdale-High Park')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael Corcoran', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael Corcoran' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nadia Guerrera', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nadia Guerrera' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Debbie King', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Debbie King' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Diana Chan McNally', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Diana Chan McNally' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bridget Ogundipe', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bridget Ogundipe' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Adam Pham', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Adam Pham' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Andy Potega', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Andy Potega' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Vanessa Raponi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Vanessa Raponi' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Holly Weber', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Holly Weber' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Steve Yuen', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Steve Yuen' || '-councillor-' || 'Toronto Ward 4 - Parkdale-High Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 5 - York South-Weston')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sharmarke Ali', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sharmarke Ali' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Matthew Boateng', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Matthew Boateng' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Daniel Di Giorgio', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Daniel Di Giorgio' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Maryama Farah', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Maryama Farah' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ahmed Mawel', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ahmed Mawel' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Frances Nunziata', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Frances Nunziata' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nekpen Obasogie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nekpen Obasogie' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Chiara Padovani', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Chiara Padovani' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sileen Phillips', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sileen Phillips' || '-councillor-' || 'Toronto Ward 5 - York South-Weston'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 6 - York Centre')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Alexander Artamonov', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Alexander Artamonov' || '-councillor-' || 'Toronto Ward 6 - York Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Conroy Irving', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Conroy Irving' || '-councillor-' || 'Toronto Ward 6 - York Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'James Pasternak', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('James Pasternak' || '-councillor-' || 'Toronto Ward 6 - York Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 7 - Humber River-Black Creek')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Lorna Antwi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Lorna Antwi' || '-councillor-' || 'Toronto Ward 7 - Humber River-Black Creek'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amanda Coombs', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amanda Coombs' || '-councillor-' || 'Toronto Ward 7 - Humber River-Black Creek'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Anthony Perruzza', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Anthony Perruzza' || '-councillor-' || 'Toronto Ward 7 - Humber River-Black Creek'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 8 - Eglinton-Lawrence')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mike Colle', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mike Colle' || '-councillor-' || 'Toronto Ward 8 - Eglinton-Lawrence'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Liz Grade', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Liz Grade' || '-councillor-' || 'Toronto Ward 8 - Eglinton-Lawrence'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Domenico Maiolo', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Domenico Maiolo' || '-councillor-' || 'Toronto Ward 8 - Eglinton-Lawrence'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jason McDonald', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jason McDonald' || '-councillor-' || 'Toronto Ward 8 - Eglinton-Lawrence'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Enzo Torrone', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Enzo Torrone' || '-councillor-' || 'Toronto Ward 8 - Eglinton-Lawrence'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Daniel Trayes', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Daniel Trayes' || '-councillor-' || 'Toronto Ward 8 - Eglinton-Lawrence'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 9 - Davenport')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Alejandra Bravo', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Alejandra Bravo' || '-councillor-' || 'Toronto Ward 9 - Davenport'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ashley Jansen', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ashley Jansen' || '-councillor-' || 'Toronto Ward 9 - Davenport'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Marco Martins', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Marco Martins' || '-councillor-' || 'Toronto Ward 9 - Davenport'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Neil Simon', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Neil Simon' || '-councillor-' || 'Toronto Ward 9 - Davenport'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 10 - Spadina-Fort York')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ian Cunningham', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ian Cunningham' || '-councillor-' || 'Toronto Ward 10 - Spadina-Fort York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Xue Ding', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Xue Ding' || '-councillor-' || 'Toronto Ward 10 - Spadina-Fort York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Andi Hoàng-Lefranc', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Andi Hoàng-Lefranc' || '-councillor-' || 'Toronto Ward 10 - Spadina-Fort York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bashar Kassir', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bashar Kassir' || '-councillor-' || 'Toronto Ward 10 - Spadina-Fort York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ausma Malik', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ausma Malik' || '-councillor-' || 'Toronto Ward 10 - Spadina-Fort York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Paul Nash', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Paul Nash' || '-councillor-' || 'Toronto Ward 10 - Spadina-Fort York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Husain Neemuchwala', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Husain Neemuchwala' || '-councillor-' || 'Toronto Ward 10 - Spadina-Fort York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Aanchal Vashistha', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Aanchal Vashistha' || '-councillor-' || 'Toronto Ward 10 - Spadina-Fort York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 11 - University-Rosedale')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Keenan Courtis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Keenan Courtis' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Terri Hawkes', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Terri Hawkes' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mike Layton', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mike Layton' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Karina Lemke', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Karina Lemke' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Alice Li', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Alice Li' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Huy Lieu', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Huy Lieu' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gian Pileri', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gian Pileri' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Paul Viret', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Paul Viret' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Diana Yoon', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Diana Yoon' || '-councillor-' || 'Toronto Ward 11 - University-Rosedale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 12 - Toronto-St. Paul''s')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'David Cottrell', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('David Cottrell' || '-councillor-' || 'Toronto Ward 12 - Toronto-St. Paul''s'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jenny Kalimbet', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jenny Kalimbet' || '-councillor-' || 'Toronto Ward 12 - Toronto-St. Paul''s'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ahmed Kamal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ahmed Kamal' || '-councillor-' || 'Toronto Ward 12 - Toronto-St. Paul''s'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Josh Matlow', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Josh Matlow' || '-councillor-' || 'Toronto Ward 12 - Toronto-St. Paul''s'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bob Murphy', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bob Murphy' || '-councillor-' || 'Toronto Ward 12 - Toronto-St. Paul''s'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mina Nadimi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mina Nadimi' || '-councillor-' || 'Toronto Ward 12 - Toronto-St. Paul''s'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 13 - Toronto Centre')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Joe Cadeau', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Joe Cadeau' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tom Cai', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tom Cai' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Victoria Davis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Victoria Davis' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Morgan Harris', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Morgan Harris' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Walied Khogali Ali', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Walied Khogali Ali' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Norman MacLeod', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Norman MacLeod' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Cleveland Marshall', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Cleveland Marshall' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Chris Moise', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Chris Moise' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Curran Stikuts', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Curran Stikuts' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Daniel Tate', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Daniel Tate' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nicki Ward', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nicki Ward' || '-councillor-' || 'Toronto Ward 13 - Toronto Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 14 - Toronto-Danforth')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Maqsood Ahmad', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Maqsood Ahmad' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Susan Chapelle', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Susan Chapelle' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael Connor', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael Connor' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dennis Corcoran', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dennis Corcoran' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Robb Dagenais', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Robb Dagenais' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Peter De Marco', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Peter De Marco' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sara Ehrhardt', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sara Ehrhardt' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'George Fawcett', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('George Fawcett' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mary Fragedakis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mary Fragedakis' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'John Kladitis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('John Kladitis' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael Mitchell', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael Mitchell' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Caryma Sa''d', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Caryma Sa''d' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dianne Saxe', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dianne Saxe' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Devyn Stackhouse', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Devyn Stackhouse' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jason Stevens', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jason Stevens' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Christiane Tetreault', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Christiane Tetreault' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Maria Voutsinas', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Maria Voutsinas' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Denise Walcott', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Denise Walcott' || '-councillor-' || 'Toronto Ward 14 - Toronto-Danforth'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 15 - Don Valley West')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rachel Chernos Lin', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rachel Chernos Lin' || '-councillor-' || 'Toronto Ward 15 - Don Valley West'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sheena Sharp', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sheena Sharp' || '-councillor-' || 'Toronto Ward 15 - Don Valley West'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Denis Tsang', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Denis Tsang' || '-councillor-' || 'Toronto Ward 15 - Don Valley West'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 16 - Don Valley East')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jon Burnside', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jon Burnside' || '-councillor-' || 'Toronto Ward 16 - Don Valley East'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sinan Erdemir', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sinan Erdemir' || '-councillor-' || 'Toronto Ward 16 - Don Valley East'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Didi Moffat', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Didi Moffat' || '-councillor-' || 'Toronto Ward 16 - Don Valley East'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Stacey Moffatt', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Stacey Moffatt' || '-councillor-' || 'Toronto Ward 16 - Don Valley East'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 17 - Don Valley North')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jeffery Adamson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jeffery Adamson' || '-councillor-' || 'Toronto Ward 17 - Don Valley North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Shelley Carroll', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Shelley Carroll' || '-councillor-' || 'Toronto Ward 17 - Don Valley North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jethro Adir Kavod', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jethro Adir Kavod' || '-councillor-' || 'Toronto Ward 17 - Don Valley North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Hassan Mubarak Noor Mohamed', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Hassan Mubarak Noor Mohamed' || '-councillor-' || 'Toronto Ward 17 - Don Valley North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Roy Samathanam', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Roy Samathanam' || '-councillor-' || 'Toronto Ward 17 - Don Valley North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Hong Xiao', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Hong Xiao' || '-councillor-' || 'Toronto Ward 17 - Don Valley North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sabrina Zuniga', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sabrina Zuniga' || '-councillor-' || 'Toronto Ward 17 - Don Valley North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 18 - Willowdale')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Lily Cheng', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Lily Cheng' || '-councillor-' || 'Toronto Ward 18 - Willowdale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nicole Daneshvar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nicole Daneshvar' || '-councillor-' || 'Toronto Ward 18 - Willowdale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'David Magazzinich', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('David Magazzinich' || '-councillor-' || 'Toronto Ward 18 - Willowdale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Hamid Shakeri', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Hamid Shakeri' || '-councillor-' || 'Toronto Ward 18 - Willowdale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nathan Yusifov', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nathan Yusifov' || '-councillor-' || 'Toronto Ward 18 - Willowdale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ardeshir Zarezade', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ardeshir Zarezade' || '-councillor-' || 'Toronto Ward 18 - Willowdale'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 19 - Beaches-East York')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Syeda Jaana Ali', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Syeda Jaana Ali' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'James Dann', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('James Dann' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nate Erskine-Smith', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nate Erskine-Smith' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Fatima Ibrahimi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Fatima Ibrahimi' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Natalie Johnson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Natalie Johnson' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kevin Morrison', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kevin Morrison' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Karsten Riedel', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Karsten Riedel' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mohammad Shabani', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mohammad Shabani' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Adam Smith', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Adam Smith' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Austin Vieira', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Austin Vieira' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jeff Wahl', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jeff Wahl' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Devin Wilkins', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Devin Wilkins' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jennie Worden', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jennie Worden' || '-councillor-' || 'Toronto Ward 19 - Beaches-East York'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 20 - Scarborough Southwest')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Laikul Choudhury', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Laikul Choudhury' || '-councillor-' || 'Toronto Ward 20 - Scarborough Southwest'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Naser Kaid', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Naser Kaid' || '-councillor-' || 'Toronto Ward 20 - Scarborough Southwest'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Parthi Kandavel', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Parthi Kandavel' || '-councillor-' || 'Toronto Ward 20 - Scarborough Southwest'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ariel-Rachel Karokis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ariel-Rachel Karokis' || '-councillor-' || 'Toronto Ward 20 - Scarborough Southwest'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Luigi Lisciandro', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Luigi Lisciandro' || '-councillor-' || 'Toronto Ward 20 - Scarborough Southwest'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sharmina Nasrin', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sharmina Nasrin' || '-councillor-' || 'Toronto Ward 20 - Scarborough Southwest'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mohammad Ali Reza', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mohammad Ali Reza' || '-councillor-' || 'Toronto Ward 20 - Scarborough Southwest'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kevin Rupasinghe', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kevin Rupasinghe' || '-councillor-' || 'Toronto Ward 20 - Scarborough Southwest'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 21 - Scarborough Centre')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Taiba Ahmed', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Taiba Ahmed' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bahareh Barahmand', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bahareh Barahmand' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Patience Evbagharu', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Patience Evbagharu' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Uthish Ganesh', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Uthish Ganesh' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Stella Kargiannakis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Stella Kargiannakis' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Akina Lalla', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Akina Lalla' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', ' Nisha Kumari', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower(' Nisha Kumari' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Willie Reodica', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Willie Reodica' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Madura Shanmugaratnam', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Madura Shanmugaratnam' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael Thompson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael Thompson' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Krissan Veerasingam', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Krissan Veerasingam' || '-councillor-' || 'Toronto Ward 21 - Scarborough Centre'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 22 - Scarborough-Agincourt')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Madhuri Azad', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Madhuri Azad' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bill Chan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bill Chan' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jackson Ho', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jackson Ho' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Serge Khatchadourian', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Serge Khatchadourian' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rakhee Kotecha', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rakhee Kotecha' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Aaron Lal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Aaron Lal' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dan Lovell', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dan Lovell' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nick Mantas', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nick Mantas' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Donny Morgan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Donny Morgan' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sindia Vijayarajan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sindia Vijayarajan' || '-councillor-' || 'Toronto Ward 22 - Scarborough-Agincourt'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 23 - Scarborough North')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Shaun Chen', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Shaun Chen' || '-councillor-' || 'Toronto Ward 23 - Scarborough North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Han Dong', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Han Dong' || '-councillor-' || 'Toronto Ward 23 - Scarborough North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sajawal Javed', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sajawal Javed' || '-councillor-' || 'Toronto Ward 23 - Scarborough North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kevin Li', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kevin Li' || '-councillor-' || 'Toronto Ward 23 - Scarborough North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jamaal Myers', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jamaal Myers' || '-councillor-' || 'Toronto Ward 23 - Scarborough North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'John-Mark Oleh', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('John-Mark Oleh' || '-councillor-' || 'Toronto Ward 23 - Scarborough North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ronald Phen', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ronald Phen' || '-councillor-' || 'Toronto Ward 23 - Scarborough North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Piravena Sathiyanantham', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Piravena Sathiyanantham' || '-councillor-' || 'Toronto Ward 23 - Scarborough North'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 24 - Scarborough-Guildwood')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Paul Ainslie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Paul Ainslie' || '-councillor-' || 'Toronto Ward 24 - Scarborough-Guildwood'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Robert Bazil', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Robert Bazil' || '-councillor-' || 'Toronto Ward 24 - Scarborough-Guildwood'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jithender Mulamalla', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jithender Mulamalla' || '-councillor-' || 'Toronto Ward 24 - Scarborough-Guildwood'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nachi Ramasamy', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nachi Ramasamy' || '-councillor-' || 'Toronto Ward 24 - Scarborough-Guildwood'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Arun Sivanandan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Arun Sivanandan' || '-councillor-' || 'Toronto Ward 24 - Scarborough-Guildwood'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'An Wu', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('An Wu' || '-councillor-' || 'Toronto Ward 24 - Scarborough-Guildwood'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Toronto Ward 25 - Scarborough-Rouge Park')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Shawn Allen', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Shawn Allen' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dharshan Casinathen', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dharshan Casinathen' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ashan Fernando', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ashan Fernando' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Somas Kaneshapillai', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Somas Kaneshapillai' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jannette Lumley', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jannette Lumley' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Zakir Patel', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Zakir Patel' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dianna Robinson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dianna Robinson' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kannan S''ree Jr', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kannan S''ree Jr' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Neethan Shan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Neethan Shan' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Vane Stavrev', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Vane Stavrev' || '-councillor-' || 'Toronto Ward 25 - Scarborough-Rouge Park'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Imad Abdulkadir', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Imad Abdulkadir' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bahira Abdulsalam', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bahira Abdulsalam' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Chris Alexander', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Chris Alexander' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jamie Atkinson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jamie Atkinson' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Brad Bradford', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Brad Bradford' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Darrell Brown', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Darrell Brown' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Brian Buffey', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Brian Buffey' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Braeden Chow', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Braeden Chow' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Olivia Chow', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Olivia Chow' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Logan Choy', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Logan Choy' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kevin Clarke', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kevin Clarke' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Paul Collins', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Paul Collins' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Alex Cruze', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Alex Cruze' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Roberto Curto', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Roberto Curto' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Laura Dean', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Laura Dean' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Habiba Desai', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Habiba Desai' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Cory Deville', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Cory Deville' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Wincess Dorville', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Wincess Dorville' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Laura Ellis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Laura Ellis' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Martin Fraser', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Martin Fraser' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Alton Frederick', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Alton Frederick' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Edward Gong', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Edward Gong' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Faizan Haider', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Faizan Haider' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Thomas Hall', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Thomas Hall' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Peter Handjis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Peter Handjis' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jack Hartley', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jack Hartley' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Heather He', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Heather He' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mohamad Kaaki', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mohamad Kaaki' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Georgios Kalkounis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Georgios Kalkounis' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Isidoros Kyrlangitses', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Isidoros Kyrlangitses' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael Lamoureux', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael Lamoureux' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rick Lee', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rick Lee' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Reagan Levermany', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Reagan Levermany' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Eddie Mayanja', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Eddie Mayanja' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sarah McVie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sarah McVie' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Francis Mercieca', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Francis Mercieca' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Joseph Osuji', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Joseph Osuji' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Odessa Paloma Parker', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Odessa Paloma Parker' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gus Prokos', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gus Prokos' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Faisal Razi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Faisal Razi' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amy Rosen', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amy Rosen' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Lyall Sanders', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Lyall Sanders' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Naomi Sayers', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Naomi Sayers' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Robert Shusterman', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Robert Shusterman' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sandeep Srivastava', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sandeep Srivastava' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Weizhen Tang', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Weizhen Tang' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Joshua Thompson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Joshua Thompson' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kuo Yu Tong', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kuo Yu Tong' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jeffery Tunney', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jeffery Tunney' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jack Weenen', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jack Weenen' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Henoke Yohannes', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Henoke Yohannes' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Leila Yohannes', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Leila Yohannes' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mostafa Zandkarimi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mostafa Zandkarimi' || '-mayor-toronto'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('8b7c8685-4b29-4bd3-a00c-3ed130ba7c04', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');

  RAISE NOTICE 'Toronto: 25 wards created, 190 councillor + 53 mayor candidates added';
END $$;
COMMIT;
