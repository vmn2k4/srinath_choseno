-- Source: ballotpedia.org/United_States_House_of_Representatives_elections_in_California,_2026
-- Corrects 6 districts where the original Statement-of-Vote-PDF-based top-two fix picked the
-- wrong second-place finisher (likely a multi-column PDF misread). Ballotpedia's confirmed
-- top-two general election candidate list is authoritative here.
BEGIN;

DELETE FROM public.election_candidates WHERE id IN (
  '38390009-75d1-45ce-a64f-c6cf24f41d5f', -- CD-07 Zachariah Wooden (wrong)
  '67d67e9a-1669-494a-b07d-cebd57bdd592', -- CD-14 Wendy Fiona Huang (wrong)
  '47866099-1c72-440b-9267-2749065376bc', -- CD-29 Rudy Melendez (wrong)
  '1ca2efb4-922f-477c-a790-3aef0f83cb83', -- CD-34 Calvin Lee (wrong)
  '1dc03b91-ec20-455f-a870-86df243f72d1', -- CD-37 Baltazar Fedalizo (wrong)
  '15ac41bf-47d9-4dc7-ab20-47ed6ebc9383'  -- CD-42 Noah Blom (wrong)
);

CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_id bigint, stub_id uuid) ON COMMIT DROP;
INSERT INTO new_stub (seat_id, name, party_id, stub_id) VALUES
  ('9423af03-bbb9-48e7-8f52-01c2d0c74393', 'Doris Matsui', 8, gen_random_uuid()),
  ('38fae4b7-1aa5-47b2-b9f1-06cb4908db65', 'Melissa Hernandez', 8, gen_random_uuid()),
  ('1f8c1ab3-2632-40df-90d3-1fe615bba566', 'Angelica Maria Duenas', 8, gen_random_uuid()),
  ('73cc6feb-0965-4547-accd-c1b2d34ecf26', 'Angela Gonzales-Torres', 8, gen_random_uuid()),
  ('3ce9010f-4c26-44c3-8264-8b67dd90fc43', 'Samantha Mota', 8, gen_random_uuid()),
  ('87ae6c5a-e478-452a-9cb9-7b7c86fb975f', 'Brian Burley', 9, gen_random_uuid());

INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  SELECT stub_id, 'politician', name, true, 'USA', gen_random_uuid() FROM new_stub;
INSERT INTO public.politician_profiles (id, political_party_id) SELECT stub_id, party_id FROM new_stub;
INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  SELECT seat_id, stub_id, 'approved', now(), '5b66563e-2674-4fed-b733-3e19955a166a' FROM new_stub;

COMMIT;
