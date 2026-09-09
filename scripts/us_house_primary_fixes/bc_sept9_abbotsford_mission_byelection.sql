BEGIN;

INSERT INTO public.elections (name, election_date, status, nomination_open_date, nomination_close_date)
VALUES ('2026 Abbotsford-Mission By-election', '2026-09-26', 'nominations_closed', '2026-08-29', '2026-09-05')
RETURNING id;

INSERT INTO public.political_parties (country, name)
SELECT v.country, v.name FROM (VALUES ('Canada','CentreBC'),
('Canada','Libertarian')) AS v(country, name)
WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.country AND p.name=v.name);

DO $$
DECLARE
  v_election_id uuid;
  v_seat_id uuid;
BEGIN
  SELECT id INTO v_election_id FROM public.elections WHERE name = '2026 Abbotsford-Mission By-election';

  INSERT INTO public.election_seats (election_id, map_shape_id, role_title)
  VALUES (v_election_id, 22307, 'MLA')
  RETURNING id INTO v_seat_id;

  CREATE TEMP TABLE new_stub (name text, party_name text, stub_id uuid, wall_slug text) ON COMMIT DROP;

  INSERT INTO new_stub (name, party_name, stub_id) VALUES ('Pam Alexis','New Democratic Party (NDP)',gen_random_uuid()),
('Kerry-Lynne Findlay','Conservative Party',gen_random_uuid()),
('Stephen Fowler','Green Party',gen_random_uuid()),
('Lakhwinder Jhaj','CentreBC',gen_random_uuid()),
('Jeff Monds','Libertarian',gen_random_uuid());

  UPDATE new_stub ns SET wall_slug = base.slug FROM (
    SELECT ns2.stub_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.politician_profiles pp WHERE pp.wall_slug = regexp_replace(regexp_replace(lower(ns2.name || '-mla'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
      ) THEN regexp_replace(regexp_replace(lower(ns2.name || '-mla'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(ns2.stub_id::text, '-', ''), 6)
      ELSE regexp_replace(regexp_replace(lower(ns2.name || '-mla'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
      END AS slug
    FROM new_stub ns2
  ) base WHERE base.stub_id = ns.stub_id;

  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;

  INSERT INTO public.politician_profiles (id, political_party_id, wall_slug)
  SELECT ns.stub_id, pp.id, ns.wall_slug FROM new_stub ns
  LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name;

  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  SELECT v_seat_id, stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a' FROM new_stub;

  RAISE NOTICE 'Abbotsford-Mission by-election: seat % created, % candidates added', v_seat_id, (SELECT count(*) FROM new_stub);
END $$;

COMMIT;
