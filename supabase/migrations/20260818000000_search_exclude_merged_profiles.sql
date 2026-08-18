-- A profile that's been merged away via office_holder_wall_claims (see
-- merge_officeholder_wall_claim) is deliberately left in place afterward so
-- the merge stays reversible -- its posts/comments/supporters/ratings move
-- to the target profile, but the source profiles/politician_profiles row
-- itself, and its own political_target_role/target_boundary_name, still
-- exist untouched.
--
-- The candidate branch of search_politicians_and_officeholders only
-- excludes a profile that's *currently* linked_profile_id-linked from a
-- live office_holders row -- it had no way to know a profile used to be
-- that link and got superseded by a merge. Once David Eby's MLA and Premier
-- office_holders rows both point at the same surviving profile (see the
-- merge run for him), the old MLA-only profile has no office_holders link
-- left at all, so it satisfies the candidate branch's "not currently an
-- officeholder" condition and reappears as a phantom third search result
-- for the same real person.
--
-- Fix: exclude any profile that is the source_profile_id of an approved
-- merge claim from ever surfacing as its own search result again -- its
-- identity now belongs to the surviving target profile.
CREATE OR REPLACE FUNCTION public.search_politicians_and_officeholders(
  p_query text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  result_key text,
  source text,
  full_name text,
  role_title text,
  jurisdiction_name text,
  country text,
  boundary_type text,
  map_shape_id bigint,
  party_name text,
  photo_url text,
  wall_slug text,
  politician_profile_id uuid,
  office_holder_id uuid,
  is_key_leader boolean,
  key_priority smallint
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query text := trim(coalesce(p_query, ''));
  v_lat double precision;
  v_lng double precision;
  v_country text;
  v_province_geom geometry;
BEGIN
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL THEN
    SELECT ul.latitude, ul.longitude INTO v_lat, v_lng
    FROM public.user_locations ul WHERE ul.profile_id = auth.uid();
  ELSE
    v_lat := p_lat;
    v_lng := p_lng;
  END IF;

  SELECT p.country INTO v_country FROM public.profiles p WHERE p.id = auth.uid();

  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    SELECT ms.geom INTO v_province_geom
    FROM public.map_shapes ms
    WHERE (ms.boundary_type ILIKE '%province%' OR ms.boundary_type ILIKE '%provinc%'
           OR ms.boundary_type ILIKE '%state%' OR ms.boundary_type ILIKE '%vidhan%')
      AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(v_lng, v_lat), 4326))
    LIMIT 1;
  END IF;

  RETURN QUERY
  WITH oh_matched AS (
    SELECT oh.id
    FROM public.office_holders oh
    WHERE oh.is_current AND oh.full_name ILIKE '%' || v_query || '%'

    UNION

    SELECT oh.id
    FROM public.map_shapes ms
    JOIN public.office_holders oh ON oh.map_shape_id = ms.id AND oh.is_current
    WHERE ms.name ILIKE '%' || v_query || '%'

    UNION

    SELECT oh.id
    FROM public.election_role_types ert
    JOIN public.office_holders oh ON oh.election_role_type_id = ert.id AND oh.is_current
    WHERE ert.role_title ILIKE '%' || v_query || '%'
  ),
  matches AS (
    SELECT
      'oh_' || oh.id::text AS result_key,
      'office_holder'::text AS source,
      oh.full_name,
      ert.role_title,
      ms.name AS jurisdiction_name,
      ms.country,
      ms.boundary_type,
      ms.id AS map_shape_id,
      party.name AS party_name,
      COALESCE(oh.photo_url, ppr.photo_url, ppr.avatar_url) AS photo_url,
      ppr.wall_slug,
      oh.linked_profile_id AS politician_profile_id,
      oh.id AS office_holder_id,
      CASE
        WHEN v_lat IS NOT NULL AND v_lng IS NOT NULL
          AND ST_Contains(ms.geom, ST_SetSRID(ST_Point(v_lng, v_lat), 4326)) THEN 0
        WHEN v_province_geom IS NOT NULL AND ST_Intersects(ms.geom, v_province_geom) THEN 1
        WHEN v_country IS NOT NULL AND ms.country = v_country THEN 2
        ELSE 3
      END AS proximity_tier,
      public.boundary_locality_scope(ms.boundary_type) AS locality_scope,
      CASE
        WHEN oh.full_name ILIKE v_query THEN 0
        WHEN oh.full_name ILIKE v_query || '%' THEN 1
        WHEN oh.full_name ILIKE '%' || v_query || '%' THEN 2
        ELSE 3
      END AS match_rank
    FROM oh_matched om
    JOIN public.office_holders oh ON oh.id = om.id
    JOIN public.map_shapes ms ON ms.id = oh.map_shape_id
    JOIN public.election_role_types ert ON ert.id = oh.election_role_type_id
    LEFT JOIN public.political_parties party ON party.id = oh.political_party_id
    LEFT JOIN public.politician_profiles ppr ON ppr.id = oh.linked_profile_id

    UNION ALL

    SELECT
      'pp_' || p.id::text,
      'candidate'::text,
      p.full_name,
      ppr2.political_target_role,
      ppr2.target_boundary_name,
      p.country,
      ppr2.target_boundary_type,
      NULL::bigint,
      party2.name,
      COALESCE(ppr2.photo_url, ppr2.avatar_url),
      ppr2.wall_slug,
      p.id,
      NULL::uuid,
      CASE WHEN v_country IS NOT NULL AND p.country = v_country THEN 2 ELSE 3 END,
      public.boundary_locality_scope(ppr2.target_boundary_type),
      CASE
        WHEN p.full_name ILIKE v_query THEN 0
        WHEN p.full_name ILIKE v_query || '%' THEN 1
        ELSE 2
      END
    FROM public.profiles p
    JOIN public.politician_profiles ppr2 ON ppr2.id = p.id
    LEFT JOIN public.political_parties party2 ON party2.id = ppr2.political_party_id
    WHERE p.role = 'politician'
      AND p.full_name ILIKE '%' || v_query || '%'
      AND NOT EXISTS (
        SELECT 1 FROM public.office_holders oh2
        WHERE oh2.linked_profile_id = p.id AND oh2.is_current
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.office_holder_wall_claims c
        WHERE c.source_profile_id = p.id AND c.status = 'approved'
      )

    UNION ALL

    SELECT
      'pp_' || p.id::text,
      'candidate'::text,
      p.full_name,
      ppr2.political_target_role,
      ppr2.target_boundary_name,
      p.country,
      ppr2.target_boundary_type,
      NULL::bigint,
      party2.name,
      COALESCE(ppr2.photo_url, ppr2.avatar_url),
      ppr2.wall_slug,
      p.id,
      NULL::uuid,
      CASE WHEN v_country IS NOT NULL AND p.country = v_country THEN 2 ELSE 3 END,
      public.boundary_locality_scope(ppr2.target_boundary_type),
      3
    FROM public.politician_profiles ppr2
    JOIN public.profiles p ON p.id = ppr2.id AND p.role = 'politician'
    LEFT JOIN public.political_parties party2 ON party2.id = ppr2.political_party_id
    WHERE NOT (p.full_name ILIKE '%' || v_query || '%')
      AND (ppr2.target_boundary_name ILIKE '%' || v_query || '%' OR ppr2.political_target_role ILIKE '%' || v_query || '%')
      AND NOT EXISTS (
        SELECT 1 FROM public.office_holders oh2
        WHERE oh2.linked_profile_id = p.id AND oh2.is_current
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.office_holder_wall_claims c
        WHERE c.source_profile_id = p.id AND c.status = 'approved'
      )
  ),
  ranked AS (
    SELECT
      m.*,
      (kl.id IS NOT NULL) AS is_key_leader,
      kl.priority AS key_priority_raw
    FROM matches m
    LEFT JOIN public.key_political_leaders kl
      ON kl.politician_profile_id = m.politician_profile_id
      OR kl.office_holder_id = m.office_holder_id
      OR kl.normalized_name = lower(trim(m.full_name))
  )
  SELECT
    r.result_key, r.source, r.full_name, r.role_title, r.jurisdiction_name,
    r.country, r.boundary_type, r.map_shape_id, r.party_name, r.photo_url,
    r.wall_slug, r.politician_profile_id, r.office_holder_id,
    r.is_key_leader, r.key_priority_raw
  FROM ranked r
  ORDER BY
    r.is_key_leader DESC,
    COALESCE(r.key_priority_raw, 9) ASC,
    r.match_rank ASC,
    r.proximity_tier ASC,
    r.locality_scope ASC,
    r.full_name ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_politicians_and_officeholders(text, double precision, double precision, int) TO anon, authenticated;
