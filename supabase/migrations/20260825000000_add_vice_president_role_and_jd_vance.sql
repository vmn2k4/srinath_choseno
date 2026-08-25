-- Add the "Vice President" role type for USA/National (didn't exist --
-- only President was created by 20260809000000_national_and_province_head_roles.sql)
-- and populate JD Vance as its current office holder, following the exact
-- same pattern that migration used for Trump/Carney/the Premiers: office_holders
-- row -> linked Ghost Profile + Politician Wall (politician_profiles.wall_slug).
--
-- Also links the pre-existing "JD Vance" row in key_political_leaders (added
-- 2026-08-18 as a featured-leaders stub with office_holder_id/politician_profile_id
-- both NULL) to the real records created here, same as Trump's featured-leader
-- row already points at his office_holders/profiles rows.

INSERT INTO public.election_role_types (country, boundary_type, role_key, region_override, role_title)
VALUES ('USA', 'National', 'vice_president', '', 'Vice President')
ON CONFLICT (country, boundary_type, role_key, region_override) DO NOTHING;

INSERT INTO public.office_holders (
  map_shape_id, election_role_type_id, full_name, political_party_id,
  bio, source_url, updated_at
)
SELECT
  ms.id,
  ert.id,
  'JD Vance',
  pp.id,
  'Vice President of the United States',
  'https://www.whitehouse.gov',
  NOW()
FROM public.map_shapes ms
JOIN public.election_role_types ert
  ON ert.country = ms.country AND ert.boundary_type = ms.boundary_type AND ert.role_key = 'vice_president'
LEFT JOIN public.political_parties pp ON pp.country = ms.country AND pp.name ILIKE 'Republican Party'
WHERE ms.country = 'USA' AND ms.boundary_type = 'National'
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  political_party_id = EXCLUDED.political_party_id,
  bio = EXCLUDED.bio,
  source_url = EXCLUDED.source_url,
  updated_at = NOW();

-- Ghost Profile + Politician Wall, mirroring populate-national-and-province-heads.py's
-- DO block exactly (slug formula matches scripts/sync-bc-election-results.py etc.).
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  new_ghost_id UUID;
  existing_profile_id UUID;
  computed_slug TEXT;
BEGIN
  SELECT
    oh.id AS office_holder_id,
    oh.full_name,
    oh.bio,
    oh.photo_url,
    oh.political_party_id,
    ms.country,
    ms.name AS boundary_name,
    ms.boundary_type,
    ert.role_title
  INTO r
  FROM public.office_holders oh
  JOIN public.map_shapes ms ON oh.map_shape_id = ms.id
  JOIN public.election_role_types ert ON oh.election_role_type_id = ert.id
  WHERE ert.role_key = 'vice_president' AND oh.full_name = 'JD Vance';

  IF r.office_holder_id IS NULL THEN
    RAISE NOTICE 'JD Vance office_holders row not found -- skipping wall creation.';
    RETURN;
  END IF;

  computed_slug := lower(regexp_replace(regexp_replace(r.full_name || '-' || r.role_title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));

  SELECT pp.id INTO existing_profile_id FROM public.politician_profiles pp WHERE pp.wall_slug = computed_slug LIMIT 1;
  IF existing_profile_id IS NULL THEN
    SELECT p.id INTO existing_profile_id
    FROM public.profiles p
    WHERE p.role = 'politician' AND lower(p.full_name) = lower(r.full_name) AND p.constituency = r.boundary_name
    LIMIT 1;
  END IF;

  IF existing_profile_id IS NOT NULL THEN
    new_profile_id := existing_profile_id;
  ELSE
    new_profile_id := gen_random_uuid();
    new_ghost_id := gen_random_uuid();

    INSERT INTO public.profiles (
      id, role, full_name, country, constituency, designation, current_ghost_id, updated_at
    ) VALUES (
      new_profile_id, 'politician', r.full_name, r.country, r.boundary_name, r.role_title, new_ghost_id, NOW()
    );

    INSERT INTO public.politician_profiles (
      id, political_target_role, target_boundary_type, target_boundary_name,
      bio, avatar_url, political_party_id, wall_slug, created_at, updated_at
    ) VALUES (
      new_profile_id, r.role_title, r.boundary_type, r.boundary_name,
      r.bio, r.photo_url, r.political_party_id, computed_slug, NOW(), NOW()
    );
  END IF;

  UPDATE public.office_holders SET linked_profile_id = new_profile_id WHERE id = r.office_holder_id;

  -- Link the pre-existing featured-leader stub (added 2026-08-18) to the real records.
  UPDATE public.key_political_leaders
  SET office_holder_id = r.office_holder_id,
      politician_profile_id = new_profile_id
  WHERE normalized_name = 'jd vance';
END $$;
