BEGIN;
DELETE FROM public.election_seats WHERE id = '984fd7c0-58b6-47f7-ad0f-f0ab05af0241' AND NOT EXISTS (SELECT 1 FROM public.election_candidates WHERE seat_id = '984fd7c0-58b6-47f7-ad0f-f0ab05af0241');

DO $$
DECLARE
  v_election_id uuid;
  v_ward_shape_id bigint;
  v_seat_id uuid;
  v_stub_id uuid;
BEGIN
  SELECT id INTO v_election_id FROM public.elections WHERE name = '2026 Ontario Municipal Elections';


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Brampton City Councillor Ward 1 & 5')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gagandeep Singh Atwal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gagandeep Singh Atwal' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tajinder Singh Bhinder', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tajinder Singh Bhinder' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Staceyann Brooks', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Staceyann Brooks' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amit Dutta', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amit Dutta' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tracy Ann Pepe', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tracy Ann Pepe' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rowena Santos', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rowena Santos' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tejpal Sidhu', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tejpal Sidhu' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Romolo Tantalo', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Romolo Tantalo' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Khimani Williams', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Khimani Williams' || '-councillor-' || 'Brampton City Councillor Ward 1 & 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Brampton City Councillor Ward 2 & 6')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Navjit Kaur Brar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Navjit Kaur Brar' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jermaine Chambers', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jermaine Chambers' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Yadvinder Deswal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Yadvinder Deswal' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Raghav Dhir', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Raghav Dhir' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amir Khawaja Hassan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amir Khawaja Hassan' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gurpreet Pabla', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gurpreet Pabla' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Keval Shah', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Keval Shah' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rakesh Singh Thakur', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rakesh Singh Thakur' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Carmen Wilson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Carmen Wilson' || '-councillor-' || 'Brampton City Councillor Ward 2 & 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Brampton City Councillor Ward 3 & 4')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gita Devi Dawadi Dhakal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gita Devi Dawadi Dhakal' || '-councillor-' || 'Brampton City Councillor Ward 3 & 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dennis Keenan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dennis Keenan' || '-councillor-' || 'Brampton City Councillor Ward 3 & 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jugraj Singh Khinda', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jugraj Singh Khinda' || '-councillor-' || 'Brampton City Councillor Ward 3 & 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kaniki Karine Mujinga', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kaniki Karine Mujinga' || '-councillor-' || 'Brampton City Councillor Ward 3 & 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Santokh Randhawa', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Santokh Randhawa' || '-councillor-' || 'Brampton City Councillor Ward 3 & 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ajit Seerha', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ajit Seerha' || '-councillor-' || 'Brampton City Councillor Ward 3 & 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Brampton City Councillor Ward 7 & 8')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nayan Brahmbhatt', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nayan Brahmbhatt' || '-councillor-' || 'Brampton City Councillor Ward 7 & 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Taran Chahal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Taran Chahal' || '-councillor-' || 'Brampton City Councillor Ward 7 & 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ripudaman Singh Dhillon', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ripudaman Singh Dhillon' || '-councillor-' || 'Brampton City Councillor Ward 7 & 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ayanna Kahlon', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ayanna Kahlon' || '-councillor-' || 'Brampton City Councillor Ward 7 & 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ali Khan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ali Khan' || '-councillor-' || 'Brampton City Councillor Ward 7 & 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rakesh Sharma', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rakesh Sharma' || '-councillor-' || 'Brampton City Councillor Ward 7 & 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Monica Singh Soares', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Monica Singh Soares' || '-councillor-' || 'Brampton City Councillor Ward 7 & 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Brampton City Councillor Ward 9 & 10')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Janice Gordon-Daniels', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Janice Gordon-Daniels' || '-councillor-' || 'Brampton City Councillor Ward 9 & 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Azad Goyat', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Azad Goyat' || '-councillor-' || 'Brampton City Councillor Ward 9 & 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jagdish Singh Grewal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jagdish Singh Grewal' || '-councillor-' || 'Brampton City Councillor Ward 9 & 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kamran Hassan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kamran Hassan' || '-councillor-' || 'Brampton City Councillor Ward 9 & 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sandeep Kumar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sandeep Kumar' || '-councillor-' || 'Brampton City Councillor Ward 9 & 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Baljinder Singh Nehal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Baljinder Singh Nehal' || '-councillor-' || 'Brampton City Councillor Ward 9 & 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Cheryl Rodricks', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Cheryl Rodricks' || '-councillor-' || 'Brampton City Councillor Ward 9 & 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Harkirat Singh', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Harkirat Singh' || '-councillor-' || 'Brampton City Councillor Ward 9 & 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jagruti Bhatt', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jagruti Bhatt' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Patrick Brown', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Patrick Brown' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gurdeep Singh Dhothar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gurdeep Singh Dhothar' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Vidya Sagar Gautam', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Vidya Sagar Gautam' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Prabh Gill', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Prabh Gill' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Wesley Jackson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Wesley Jackson' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Najma Khurram', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Najma Khurram' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nathaniel Peart', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nathaniel Peart' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Prabhjot Kaur Sidhu', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Prabhjot Kaur Sidhu' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sandeep Somal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sandeep Somal' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Paul Tarriwal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Paul Tarriwal' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gaurav Walia', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gaurav Walia' || '-mayor-' || 'Brampton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e2a81db7-7b5f-44b0-89a4-1886ff7a430a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');

  RAISE NOTICE 'Brampton: 5 wards, 39 councillor + 12 mayor candidates added';
END $$;
COMMIT;
