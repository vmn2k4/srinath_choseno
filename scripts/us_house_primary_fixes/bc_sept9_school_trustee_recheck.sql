BEGIN;
CREATE TEMP TABLE new_stub (seat_id uuid, name text, stub_id uuid, wall_slug text) ON COMMIT DROP;
INSERT INTO new_stub (seat_id, name, stub_id) VALUES ('86ad72b7-5485-4aea-8a1e-ccf0074bb30b','Michael Carter',gen_random_uuid()),
('86ad72b7-5485-4aea-8a1e-ccf0074bb30b','Marina Garmon',gen_random_uuid()),
('86ad72b7-5485-4aea-8a1e-ccf0074bb30b','Hugh Hamilton',gen_random_uuid()),
('86ad72b7-5485-4aea-8a1e-ccf0074bb30b','Christine Kruger',gen_random_uuid()),
('86ad72b7-5485-4aea-8a1e-ccf0074bb30b','Cary Moore',gen_random_uuid()),
('0ff2755f-031f-4a8e-ad9f-f86f386432b1','Deepa Bissessur',gen_random_uuid()),
('0ff2755f-031f-4a8e-ad9f-f86f386432b1','Emily Haugen',gen_random_uuid()),
('f467660b-73e0-4d76-9d21-734bcf5e0df5','Lisa Turpin',gen_random_uuid());

UPDATE new_stub ns SET wall_slug = base.slug FROM (
  SELECT ns2.stub_id,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.politician_profiles pp WHERE pp.wall_slug = regexp_replace(regexp_replace(lower(ns2.name || '-school-trustee'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    ) THEN regexp_replace(regexp_replace(lower(ns2.name || '-school-trustee'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(ns2.stub_id::text, '-', ''), 6)
    ELSE regexp_replace(regexp_replace(lower(ns2.name || '-school-trustee'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    END AS slug
  FROM new_stub ns2
) base WHERE base.stub_id = ns.stub_id;

INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;
INSERT INTO public.politician_profiles (id, wall_slug) SELECT stub_id, wall_slug FROM new_stub;
INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) SELECT seat_id, stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a' FROM new_stub;
INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
VALUES ('958ea2ad-c5c7-49b6-a170-555e2e341d94','d4eaf5a1-a4b0-43fd-b2cf-0b3ac635cc16','approved',now(),'5b66563e-2674-4fed-b733-3e19955a166a'),
('f9a7ddc0-9e90-4143-9932-84671a488368','91ba7c47-503e-40ec-97ca-28a23ba2fcf5','approved',now(),'5b66563e-2674-4fed-b733-3e19955a166a');
COMMIT;
