-- One-off correction for Maple Ridge, BC (map_shape_id = 21322).
--
-- The OpenNorth Represent API (our source for Canadian municipal
-- officeholders, via scripts/populate-canadian-municipal.py) is itself
-- stale for this seat: it still reports the pre-October-2022-election
-- roster. Verified against the City of Maple Ridge's own "Meet Your
-- Council" page and the official 2022 election results:
--   https://www.mapleridge.ca/your-government/city-council/meet-your-council
--   https://www.mapleridge.ca/media/file/2022-10-19-official-election-results-2022-general-local
--
-- Mike Morden (mayor) lost to Dan Ruimy; Ruimy took office Nov 1, 2022 and
-- is running for a second term in the Oct 2026 election. Gordy Robson,
-- Kiersten Duncan, and Ryan Svendsen are not on the current council;
-- Korleen Carreras, Onyeka Dozie, Sunny Schiller, and Jenny Tan are.
-- Ahmed Yousef and Judy Dueck were already correct and are untouched.
--
-- Outgoing holders are retired (is_current = false), never deleted or
-- overwritten in place -- see 20260816000000_office_holder_term_lifecycle.sql
-- for why (office_holder_wall_claims is ON DELETE RESTRICT on
-- office_holder_id, and overwriting destroys term history).
BEGIN;

UPDATE public.office_holders
SET is_current = false, term_ended_at = '2022-11-01', updated_at = NOW()
WHERE id IN (
  '910e18b2-51cc-494d-8a85-f1d2a7cfee60', -- Mike Morden, Mayor
  '1edcff19-0e77-49ed-8c17-a995abe90300', -- Gordy Robson, Councillor
  '371eaffb-c9b9-431e-852f-b61e0024b845', -- Kiersten Duncan, Councillor
  'c4228738-0b2c-41f3-b04c-7fe18842b68e'  -- Ryan Svendsen, Councillor
);

-- Backfill holding_since on the two rows that were already correct
-- (Ahmed Yousef, Judy Dueck) so all seven current-term holders agree on
-- when the term started.
UPDATE public.office_holders
SET holding_since = '2022-11-01', updated_at = NOW()
WHERE id IN (
  '00750d7d-7eaf-456a-a70f-dc8ae6693a74', -- Ahmed Yousef
  '0a5f21ba-b56d-4dca-98d1-437b02d83683'  -- Judy Dueck
) AND holding_since IS NULL;

-- Incoming: mayor + 4 councillors, inserted as new current rows (never
-- reusing a retired row's id, so the retired holder's own record/history
-- stays intact).
INSERT INTO public.office_holders (
  map_shape_id, election_role_type_id, full_name, bio,
  source_url, holding_since, contact_phone, is_current, updated_at
) VALUES
  (21322, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dan Ruimy', 'Mayor for Maple Ridge',
   'https://www.mapleridge.ca/directory/mayor-council', '2022-11-01', '1 604 463-5221', true, NOW()),
  (21322, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Korleen Carreras', 'Councillor for Maple Ridge',
   'https://www.mapleridge.ca/directory/mayor-council', '2022-11-01', '1 604 463-5221', true, NOW()),
  (21322, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Onyeka Dozie', 'Councillor for Maple Ridge',
   'https://www.mapleridge.ca/directory/mayor-council', '2022-11-01', '1 604 463-5221', true, NOW()),
  (21322, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Sunny Schiller', 'Councillor for Maple Ridge',
   'https://www.mapleridge.ca/directory/mayor-council', '2022-11-01', '1 604 463-5221', true, NOW()),
  (21322, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jenny Tan', 'Councillor for Maple Ridge',
   'https://www.mapleridge.ca/directory/mayor-council', '2022-11-01', '1 604 463-5221', true, NOW())
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  is_current = true, term_ended_at = NULL, holding_since = EXCLUDED.holding_since, updated_at = NOW();

-- Ghost Profile + Politician Wall for each newly inserted holder that
-- doesn't already have one under this exact name (mirrors the ghost-profile
-- creation block in scripts/populate-canadian-municipal.py).
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  new_ghost_id UUID;
  counter INT := 0;
BEGIN
  FOR r IN
    SELECT
      oh.id as office_holder_id,
      oh.full_name,
      oh.bio,
      ms.country,
      ms.name as boundary_name,
      ms.boundary_type,
      ert.role_title
    FROM public.office_holders oh
    JOIN public.map_shapes ms ON oh.map_shape_id = ms.id
    JOIN public.election_role_types ert ON oh.election_role_type_id = ert.id
    WHERE oh.linked_profile_id IS NULL AND oh.map_shape_id = 21322 AND oh.is_current = true
  LOOP
    new_profile_id := gen_random_uuid();
    new_ghost_id := gen_random_uuid();

    INSERT INTO public.profiles (
      id, role, full_name, country, constituency, designation, current_ghost_id, updated_at
    ) VALUES (
      new_profile_id, 'politician', r.full_name, r.country, r.boundary_name, r.role_title, new_ghost_id, NOW()
    );

    INSERT INTO public.politician_profiles (
      id, political_target_role, target_boundary_type, target_boundary_name, bio, created_at, updated_at
    ) VALUES (
      new_profile_id, r.role_title, r.boundary_type, r.boundary_name, r.bio, NOW(), NOW()
    );

    UPDATE public.office_holders SET linked_profile_id = new_profile_id WHERE id = r.office_holder_id;

    counter := counter + 1;
  END LOOP;
  RAISE NOTICE 'Created % ghost profile walls for the corrected Maple Ridge officeholders!', counter;
END $$;

COMMIT;
