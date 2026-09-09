BEGIN;
DELETE FROM public.election_seats WHERE id = 'de75be99-5b95-490a-9054-5a572639db22' AND NOT EXISTS (SELECT 1 FROM public.election_candidates WHERE seat_id = 'de75be99-5b95-490a-9054-5a572639db22');

DO $$
DECLARE
  v_election_id uuid;
  v_ward_shape_id bigint;
  v_seat_id uuid;
  v_stub_id uuid;
BEGIN
  SELECT id INTO v_election_id FROM public.elections WHERE name = '2026 Ontario Municipal Elections';


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 1')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Stephen Dasko', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Stephen Dasko' || '-councillor-' || 'Mississauga Ward 1'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Olivia Gannon', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Olivia Gannon' || '-councillor-' || 'Mississauga Ward 1'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 2')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Samer Fawzi Alghoul', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Samer Fawzi Alghoul' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ronnie Amyotte', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ronnie Amyotte' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michelle Baker', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michelle Baker' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael Carroll', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael Carroll' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Leeann Cole', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Leeann Cole' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tom Ellard', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tom Ellard' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Abdul Mukhtar Ghafarzoy', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Abdul Mukhtar Ghafarzoy' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Syed Jaffery', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Syed Jaffery' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ross Kutisker-jacobson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ross Kutisker-jacobson' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ananya Majumder', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ananya Majumder' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Olga Polstvin', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Olga Polstvin' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Alex Ragozzino', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Alex Ragozzino' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sue Shanly', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sue Shanly' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Audrey Simpson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Audrey Simpson' || '-councillor-' || 'Mississauga Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 3')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Chris Fonseca', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Chris Fonseca' || '-councillor-' || 'Mississauga Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Arshad Hashmi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Arshad Hashmi' || '-councillor-' || 'Mississauga Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mendi Kabashi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mendi Kabashi' || '-councillor-' || 'Mississauga Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kim Pines', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kim Pines' || '-councillor-' || 'Mississauga Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Stjepan Vukovic', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Stjepan Vukovic' || '-councillor-' || 'Mississauga Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 4')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Zulfiqar Ali', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Zulfiqar Ali' || '-councillor-' || 'Mississauga Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Humphrey Chukwuemeka', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Humphrey Chukwuemeka' || '-councillor-' || 'Mississauga Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Khawar Hussain', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Khawar Hussain' || '-councillor-' || 'Mississauga Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'John Kovac', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('John Kovac' || '-councillor-' || 'Mississauga Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 5')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Aruna Anand', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Aruna Anand' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ismail Bawa', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ismail Bawa' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Raghavan Babu Bhogaiah', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Raghavan Babu Bhogaiah' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mandeep Singh Dhaliwal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mandeep Singh Dhaliwal' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jamie Dookie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jamie Dookie' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Natalie Hart', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Natalie Hart' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Vipan Mehta', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Vipan Mehta' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael Anthony Perretta', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael Anthony Perretta' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rosemarie Sanchez Sanchez', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rosemarie Sanchez Sanchez' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Danny Singh', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Danny Singh' || '-councillor-' || 'Mississauga Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 6')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael Bastian', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael Bastian' || '-councillor-' || 'Mississauga Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Javed Dean', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Javed Dean' || '-councillor-' || 'Mississauga Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gurcharan Guleria', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gurcharan Guleria' || '-councillor-' || 'Mississauga Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ahmad Reshad Hatefi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ahmad Reshad Hatefi' || '-councillor-' || 'Mississauga Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Joe Horneck', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Joe Horneck' || '-councillor-' || 'Mississauga Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Martina Wood', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Martina Wood' || '-councillor-' || 'Mississauga Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 7')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gerald Adad', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gerald Adad' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amir Ali', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amir Ali' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Lucas Alves', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Lucas Alves' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Joel Binda', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Joel Binda' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Asha Falinski', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Asha Falinski' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ahsan Khokhar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ahsan Khokhar' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jerry Krzywda', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jerry Krzywda' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Keshav Mandadi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Keshav Mandadi' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Louroz Mercader', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Louroz Mercader' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Naila Saeed', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Naila Saeed' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Maisa Salhia', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Maisa Salhia' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amitabh Srivastava', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amitabh Srivastava' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tassawar Syed', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tassawar Syed' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'George Tavares', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('George Tavares' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Peter Tolias', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Peter Tolias' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Hazra Wade', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Hazra Wade' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Leslie Zurek-silvestri', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Leslie Zurek-silvestri' || '-councillor-' || 'Mississauga Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 8')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Valerie Hogue', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Valerie Hogue' || '-councillor-' || 'Mississauga Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Matt Mahoney', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Matt Mahoney' || '-councillor-' || 'Mississauga Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Viktoria Manzar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Viktoria Manzar' || '-councillor-' || 'Mississauga Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rahul Mehta', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rahul Mehta' || '-councillor-' || 'Mississauga Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Grzegorz Nowacki', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Grzegorz Nowacki' || '-councillor-' || 'Mississauga Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 9')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ramsha Haq', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ramsha Haq' || '-councillor-' || 'Mississauga Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Anwar Knight', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Anwar Knight' || '-councillor-' || 'Mississauga Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Martin Reid', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Martin Reid' || '-councillor-' || 'Mississauga Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mohammad Shabbeer', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mohammad Shabbeer' || '-councillor-' || 'Mississauga Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 10')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Hamza Bajwa', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Hamza Bajwa' || '-councillor-' || 'Mississauga Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Suha Hashim', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Suha Hashim' || '-councillor-' || 'Mississauga Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Aatish Jamal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Aatish Jamal' || '-councillor-' || 'Mississauga Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sue Mcfadden', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sue Mcfadden' || '-councillor-' || 'Mississauga Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Salman Tariq', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Salman Tariq' || '-councillor-' || 'Mississauga Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Mississauga Ward 11')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Brad Butt', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Brad Butt' || '-councillor-' || 'Mississauga Ward 11'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amin Nanji', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amin Nanji' || '-councillor-' || 'Mississauga Ward 11'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dev Vashi', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dev Vashi' || '-councillor-' || 'Mississauga Ward 11'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Karam Ahmed', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Karam Ahmed' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Aamir Bhatti', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Aamir Bhatti' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bonnie Crombie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bonnie Crombie' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dipika Damerla', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dipika Damerla' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gord Elliott', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gord Elliott' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Frank Fang', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Frank Fang' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Amjad Jilani', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Amjad Jilani' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mohsin Khan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mohsin Khan' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mike Matulewicz', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mike Matulewicz' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Fadi Naami', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Fadi Naami' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Carolyn Parrish', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Carolyn Parrish' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'David Shaw', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('David Shaw' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Alvin Tedjo', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Alvin Tedjo' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ana Luisa Vasquez de Espinal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ana Luisa Vasquez de Espinal' || '-mayor-' || 'Mississauga'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e24e1b91-2dfe-40ad-b8f3-fa07f349059a', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');

  RAISE NOTICE 'Mississauga: 11 wards, 75 councillor + 14 mayor candidates added';
END $$;
COMMIT;
