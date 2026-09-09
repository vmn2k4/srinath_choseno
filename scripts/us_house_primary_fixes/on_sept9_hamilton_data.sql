BEGIN;
DELETE FROM public.election_seats WHERE id = '51f5becb-a0e0-4c99-bd68-220fad1dd821' AND NOT EXISTS (SELECT 1 FROM public.election_candidates WHERE seat_id = '51f5becb-a0e0-4c99-bd68-220fad1dd821');

DO $$
DECLARE
  v_election_id uuid;
  v_ward_shape_id bigint;
  v_seat_id uuid;
  v_stub_id uuid;
BEGIN
  SELECT id INTO v_election_id FROM public.elections WHERE name = '2026 Ontario Municipal Elections';


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 1')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Raymond R. Paquette', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Raymond R. Paquette' || '-councillor-' || 'Hamilton Ward 1'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mark Powell', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mark Powell' || '-councillor-' || 'Hamilton Ward 1'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nathan Savelli', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nathan Savelli' || '-councillor-' || 'Hamilton Ward 1'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Maureen Wilson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Maureen Wilson' || '-councillor-' || 'Hamilton Ward 1'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 2')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Eisham Abdulkarim', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Eisham Abdulkarim' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rodney Elesie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rodney Elesie' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Daniel Greene', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Daniel Greene' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bill Houston', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bill Houston' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Cameron Kroetsch', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Cameron Kroetsch' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Brian Lewis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Brian Lewis' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kelly Oucharek', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kelly Oucharek' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tony Sciara', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tony Sciara' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Bernard- Tompkins', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Bernard- Tompkins' || '-councillor-' || 'Hamilton Ward 2'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 3')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Wade Campbell', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Wade Campbell' || '-councillor-' || 'Hamilton Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Christine Cayuga', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Christine Cayuga' || '-councillor-' || 'Hamilton Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Christopher DeMelo', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Christopher DeMelo' || '-councillor-' || 'Hamilton Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nrinder Nann', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nrinder Nann' || '-councillor-' || 'Hamilton Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Andrew Selman', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Andrew Selman' || '-councillor-' || 'Hamilton Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Graham Schreiber', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Graham Schreiber' || '-councillor-' || 'Hamilton Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kristeen Sprague', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kristeen Sprague' || '-councillor-' || 'Hamilton Ward 3'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 4')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Todd Anderson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Todd Anderson' || '-councillor-' || 'Hamilton Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jason Farr', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jason Farr' || '-councillor-' || 'Hamilton Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tammy Hwang', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tammy Hwang' || '-councillor-' || 'Hamilton Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jemma Lambert', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jemma Lambert' || '-councillor-' || 'Hamilton Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tony Mamone', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tony Mamone' || '-councillor-' || 'Hamilton Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tobin Tuff', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tobin Tuff' || '-councillor-' || 'Hamilton Ward 4'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 5')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Matt Francis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Matt Francis' || '-councillor-' || 'Hamilton Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ahmad Khan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ahmad Khan' || '-councillor-' || 'Hamilton Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Juanita Maldonado', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Juanita Maldonado' || '-councillor-' || 'Hamilton Ward 5'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 6')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Melissa Debicki', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Melissa Debicki' || '-councillor-' || 'Hamilton Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tom Jackson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tom Jackson' || '-councillor-' || 'Hamilton Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Peter Werhun', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Peter Werhun' || '-councillor-' || 'Hamilton Ward 6'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 7')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Heather Beale', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Heather Beale' || '-councillor-' || 'Hamilton Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mark Daly', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mark Daly' || '-councillor-' || 'Hamilton Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gordon Leslie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gordon Leslie' || '-councillor-' || 'Hamilton Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Esther Pauls', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Esther Pauls' || '-councillor-' || 'Hamilton Ward 7'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 8')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nenos Damerchie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nenos Damerchie' || '-councillor-' || 'Hamilton Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Dawn Danko', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Dawn Danko' || '-councillor-' || 'Hamilton Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jonathan Morris', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jonathan Morris' || '-councillor-' || 'Hamilton Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Pat Piro', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Pat Piro' || '-councillor-' || 'Hamilton Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Adlan Taramov', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Adlan Taramov' || '-councillor-' || 'Hamilton Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jacob Tenbrinke', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jacob Tenbrinke' || '-councillor-' || 'Hamilton Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Terry Whitehead', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Terry Whitehead' || '-councillor-' || 'Hamilton Ward 8'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 9')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Brad Clark', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Brad Clark' || '-councillor-' || 'Hamilton Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Abhijeet Gill', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Abhijeet Gill' || '-councillor-' || 'Hamilton Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Brad Stapleton', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Brad Stapleton' || '-councillor-' || 'Hamilton Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jonathan Stathakos', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jonathan Stathakos' || '-councillor-' || 'Hamilton Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Eileen Walker', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Eileen Walker' || '-councillor-' || 'Hamilton Ward 9'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 10')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Cal DiFalco', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Cal DiFalco' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Eugene Farago', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Eugene Farago' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Olivia Fung', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Olivia Fung' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sam Gamble', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sam Gamble' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Akash Grewal', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Akash Grewal' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Michael T. Loomans', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Michael T. Loomans' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ivan Luksic', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ivan Luksic' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Tanjoban Nijjar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Tanjoban Nijjar' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Larry Paletta', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Larry Paletta' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Vince Rigitano', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Vince Rigitano' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nicole Trombetta', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nicole Trombetta' || '-councillor-' || 'Hamilton Ward 10'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 11')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Damon Mombourquette', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Damon Mombourquette' || '-councillor-' || 'Hamilton Ward 11'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Aaron Post', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Aaron Post' || '-councillor-' || 'Hamilton Ward 11'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mark Tadeson', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mark Tadeson' || '-councillor-' || 'Hamilton Ward 11'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 12')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Fred Bennink', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Fred Bennink' || '-councillor-' || 'Hamilton Ward 12'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Craig Cassar', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Craig Cassar' || '-councillor-' || 'Hamilton Ward 12'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 13')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Gary Aikema', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Gary Aikema' || '-councillor-' || 'Hamilton Ward 13'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rick Kunc', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rick Kunc' || '-councillor-' || 'Hamilton Ward 13'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Loren Lieberman', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Loren Lieberman' || '-councillor-' || 'Hamilton Ward 13'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Spencer Naylor', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Spencer Naylor' || '-councillor-' || 'Hamilton Ward 13'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 14')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kojo Damptey', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kojo Damptey' || '-councillor-' || 'Hamilton Ward 14'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mike Spadafora', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mike Spadafora' || '-councillor-' || 'Hamilton Ward 14'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  INSERT INTO public.map_shapes (country, boundary_type, name)
  VALUES ('Canada', 'Ward', 'Hamilton Ward 15')
  RETURNING id INTO v_ward_shape_id;

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, v_ward_shape_id, 'Councillor')
  RETURNING id INTO v_seat_id;


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Chase Alford', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Chase Alford' || '-councillor-' || 'Hamilton Ward 15'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Mary Kovacs', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Mary Kovacs' || '-councillor-' || 'Hamilton Ward 15'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ted McMeekin', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ted McMeekin' || '-councillor-' || 'Hamilton Ward 15'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Colleen Stewart', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Colleen Stewart' || '-councillor-' || 'Hamilton Ward 15'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Zac Wrobel', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Zac Wrobel' || '-councillor-' || 'Hamilton Ward 15'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Jeff Yaeger', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Jeff Yaeger' || '-councillor-' || 'Hamilton Ward 15'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (v_seat_id, v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Sasha Austin', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Sasha Austin' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Ejaz Butt', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Ejaz Butt' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'David Mark Cherkewski', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('David Mark Cherkewski' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Rob Cooper', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Rob Cooper' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Paul Fromm', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Paul Fromm' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Scarlett Gillespie', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Scarlett Gillespie' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'David Harrison', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('David Harrison' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Andrea Horwath', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Andrea Horwath' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Erin Janus', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Erin Janus' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Keanin Loomis', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Keanin Loomis' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Pamela Mitchell', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Pamela Mitchell' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Kevin Walker', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Kevin Walker' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');


  v_stub_id := gen_random_uuid();
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', 'Nathalie Xian Yi Yan', true, 'Canada', gen_random_uuid());
  INSERT INTO public.politician_profiles (id, wall_slug)
  VALUES (v_stub_id, regexp_replace(regexp_replace(lower('Nathalie Xian Yi Yan' || '-mayor-' || 'Hamilton'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(v_stub_id::text, '-', ''), 6));
  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES ('e48398cb-925f-46fe-b0c8-8e8baf7d335c', v_stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a');

  RAISE NOTICE 'Hamilton: 15 wards, 76 councillor + 13 mayor candidates added';
END $$;
COMMIT;
