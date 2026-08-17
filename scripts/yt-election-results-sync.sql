BEGIN;

CREATE TEMP TABLE staging_yt_winners (
  map_shape_id bigint,
  election_role_type_id uuid,
  full_name text,
  source_url text
) ON COMMIT DROP;

INSERT INTO staging_yt_winners VALUES
(21875, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Justin Lachance', 'https://yukon.ca/en/local-government-directory'),
(21875, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Doris Hansen', 'https://yukon.ca/en/local-government-directory'),
(21875, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Dennis Mitchell', 'https://yukon.ca/en/local-government-directory'),
(21875, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tara Wheeler', 'https://yukon.ca/en/local-government-directory'),
(21875, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Helena Belanger', 'https://yukon.ca/en/local-government-directory'),
(21879, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Stephen Johnson', 'https://yukon.ca/en/local-government-directory'),
(21879, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Darwyn Lynn', 'https://yukon.ca/en/local-government-directory'),
(21879, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Justine Hobbs', 'https://yukon.ca/en/local-government-directory'),
(21879, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Cud Eastbound', 'https://yukon.ca/en/local-government-directory'),
(21879, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tobias Graf', 'https://yukon.ca/en/local-government-directory'),
(21869, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jack Bowers', 'https://yukon.ca/en/local-government-directory'),
(21869, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Michelle Vainio', 'https://yukon.ca/en/local-government-directory'),
(21869, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Wendy Michell-Laroque', 'https://yukon.ca/en/local-government-directory'),
(21869, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Gary Jones', 'https://yukon.ca/en/local-government-directory'),
(21869, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Neil Yee', 'https://yukon.ca/en/local-government-directory'),
(21876, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Diane Strand', 'https://yukon.ca/en/local-government-directory'),
(21876, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Sydney Mackinnon', 'https://yukon.ca/en/local-government-directory'),
(21876, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Deborah Busche', 'https://yukon.ca/en/local-government-directory'),
(21876, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Bruce Sundbo', 'https://yukon.ca/en/local-government-directory'),
(21876, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Rob Moore', 'https://yukon.ca/en/local-government-directory'),
(21878, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Trevor Ellis', 'https://yukon.ca/en/local-government-directory'),
(21878, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Simeon Paschuk', 'https://yukon.ca/en/local-government-directory'),
(21878, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Brent Chapman', 'https://yukon.ca/en/local-government-directory'),
(21878, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Chelsea Dolan', 'https://yukon.ca/en/local-government-directory'),
(21878, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Brett Stauffer', 'https://yukon.ca/en/local-government-directory'),
(21868, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lauren Hanchar', 'https://yukon.ca/en/local-government-directory'),
(21868, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Thomas Slager', 'https://yukon.ca/en/local-government-directory'),
(21868, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'William Whimp', 'https://yukon.ca/en/local-government-directory'),
(21868, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Norma Puckett', 'https://yukon.ca/en/local-government-directory'),
(21868, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Denina Paquette', 'https://yukon.ca/en/local-government-directory'),
(21873, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kirk Cameron', 'https://yukon.ca/en/local-government-directory'),
(21873, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Dan Boyd', 'https://yukon.ca/en/local-government-directory'),
(21873, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Anne Middler', 'https://yukon.ca/en/local-government-directory'),
(21873, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jenny Hamilton', 'https://yukon.ca/en/local-government-directory'),
(21873, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Paolo Gallina', 'https://yukon.ca/en/local-government-directory'),
(21873, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Eileen Melnychuk', 'https://yukon.ca/en/local-government-directory'),
(21873, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lenore Morris', 'https://yukon.ca/en/local-government-directory');

UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_yt_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_yt_winners s
    WHERE s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
      AND s.election_role_type_id = oh.election_role_type_id
  );


INSERT INTO office_holders (
  map_shape_id, election_role_type_id, full_name, bio, source_url,
  is_current, term_ended_at, updated_at
)
SELECT DISTINCT ON (s.map_shape_id, s.election_role_type_id, s.full_name)
  s.map_shape_id, s.election_role_type_id, s.full_name,
  (SELECT ert.role_title FROM election_role_types ert WHERE ert.id = s.election_role_type_id) || ' for ' ||
  (SELECT ms.name FROM map_shapes ms WHERE ms.id = s.map_shape_id),
  s.source_url, true, NULL, NOW()
FROM staging_yt_winners s
ORDER BY s.map_shape_id, s.election_role_type_id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  is_current = true,
  term_ended_at = NULL,
  updated_at = NOW();


DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  new_ghost_id UUID;
  existing_profile_id UUID;
  computed_slug TEXT;
  created_count INT := 0;
  linked_count INT := 0;
BEGIN
  FOR r IN
    SELECT oh.id as office_holder_id, oh.full_name, oh.bio,
           ms.country, ms.name as boundary_name, ms.boundary_type, ert.role_title
    FROM office_holders oh
    JOIN map_shapes ms ON oh.map_shape_id = ms.id
    JOIN election_role_types ert ON oh.election_role_type_id = ert.id
    JOIN staging_yt_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
    WHERE oh.linked_profile_id IS NULL
  LOOP
    computed_slug := lower(regexp_replace(regexp_replace(r.full_name || '-' || r.role_title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
    SELECT pp.id INTO existing_profile_id FROM politician_profiles pp WHERE pp.wall_slug = computed_slug LIMIT 1;
    IF existing_profile_id IS NULL THEN
      SELECT p.id INTO existing_profile_id FROM profiles p
      WHERE p.role = 'politician' AND lower(p.full_name) = lower(r.full_name) AND p.constituency = r.boundary_name
      LIMIT 1;
    END IF;
    IF existing_profile_id IS NOT NULL THEN
      UPDATE office_holders SET linked_profile_id = existing_profile_id WHERE id = r.office_holder_id;
      linked_count := linked_count + 1;
    ELSE
      new_profile_id := gen_random_uuid();
      new_ghost_id := gen_random_uuid();
      INSERT INTO profiles (id, role, full_name, country, constituency, designation, current_ghost_id, updated_at)
      VALUES (new_profile_id, 'politician', r.full_name, r.country, r.boundary_name, r.role_title, new_ghost_id, NOW());
      INSERT INTO politician_profiles (id, political_target_role, target_boundary_type, target_boundary_name, bio, wall_slug, created_at, updated_at)
      VALUES (new_profile_id, r.role_title, r.boundary_type, r.boundary_name, r.bio, computed_slug, NOW(), NOW());
      UPDATE office_holders SET linked_profile_id = new_profile_id WHERE id = r.office_holder_id;
      created_count := created_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'YT sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;

COMMIT;