BEGIN;
CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid, wall_slug text) ON COMMIT DROP;
INSERT INTO new_stub (seat_id, name, party_name, stub_id) VALUES ('4c449a9e-898d-41a5-8d3c-e97e973048cc','Anny Scoones','Sustain OUR Central Saanich',gen_random_uuid()),
('be92d312-eb1f-4113-90e5-b022076e5f26','Danielle Beausoleil',NULL,gen_random_uuid()),
('2b9bb4f1-171d-457d-8c77-a1485364a2a9','Bob D''Eith','A Better Maple Ridge',gen_random_uuid()),
('10cdc667-621c-4af6-88c1-0bbe2b29912f','Marnie Boers',NULL,gen_random_uuid()),
('675639f8-dff3-41e9-b664-ba3d15fb927c','Sylvia Olson',NULL,gen_random_uuid()),
('dc8121c3-fa88-46f5-b1ab-6d062ece5d6b','Mandy McGregor',NULL,gen_random_uuid()),
('9e144558-0bfb-46fd-b4c3-88e5205f54b3','Kathryn Brooks',NULL,gen_random_uuid()),
('03c4d7d4-087f-4278-b0e2-c7156807734d','Neal Williams',NULL,gen_random_uuid()),
('db2490c3-5b3c-4f93-97a9-0937ddd5ba4c','Joe Lavoie',NULL,gen_random_uuid());

UPDATE new_stub ns SET wall_slug = base.slug FROM (
  SELECT ns2.stub_id,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.politician_profiles pp WHERE pp.wall_slug = regexp_replace(regexp_replace(lower(ns2.name || '-councillor'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    ) THEN regexp_replace(regexp_replace(lower(ns2.name || '-councillor'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') || '-' || left(replace(ns2.stub_id::text, '-', ''), 6)
    ELSE regexp_replace(regexp_replace(lower(ns2.name || '-councillor'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    END AS slug
  FROM new_stub ns2
) base WHERE base.stub_id = ns.stub_id;

INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;
INSERT INTO public.politician_profiles (id, political_party_id, wall_slug) SELECT ns.stub_id, pp.id, ns.wall_slug FROM new_stub ns LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name;
INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) SELECT seat_id, stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a' FROM new_stub;
INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
VALUES ('6cb05a9a-07e8-45fd-b126-883833ab42c2','1aaf3e11-963c-4600-bce6-3d70c44ce0c3','approved',now(),'5b66563e-2674-4fed-b733-3e19955a166a'),
('e138a0ff-8753-4a01-a7cb-e70b60ab23f3','5d1ebf2a-9535-4faf-aad2-1c33f57cf8cf','approved',now(),'5b66563e-2674-4fed-b733-3e19955a166a'),
('6cd7b7af-4901-4037-8ce3-ef78778c27e6','857dd62e-1c14-4818-a599-bfac39cff0b0','approved',now(),'5b66563e-2674-4fed-b733-3e19955a166a'),
('4fda670a-752d-43d7-9a83-99e0d1e83fd6','4df4159b-8bae-47b9-a33f-194cba4cbef2','approved',now(),'5b66563e-2674-4fed-b733-3e19955a166a'),
('db2490c3-5b3c-4f93-97a9-0937ddd5ba4c','7d8c2595-da2b-4d6f-bd12-1581b8743b61','approved',now(),'5b66563e-2674-4fed-b733-3e19955a166a'),
('ea173600-a227-4dea-aa39-372da7672d6a','a6c1b617-924a-4893-8fa5-cd523f9d89c6','approved',now(),'5b66563e-2674-4fed-b733-3e19955a166a');
COMMIT;
