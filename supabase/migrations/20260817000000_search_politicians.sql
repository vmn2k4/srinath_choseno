-- Global "search politicians & office holders" feature (nav bar search).
--
-- Two source tables get searched by name (falling back to jurisdiction/role
-- text so e.g. "surrey" alone still surfaces its Mayor):
--   - office_holders: currently-serving officials tied to a real map_shape.
--   - politician_profiles/profiles (role='politician'): registered candidate
--     profiles not currently linked from a current office_holders row.
--
-- Ranking, in order:
--   1. Key political leaders (see key_political_leaders below) always float
--      to the top when their name matches, ordered by their own priority tier.
--   2. Name-match quality (exact > starts-with > contains > jurisdiction/role match).
--   3. Proximity to the searcher: their own jurisdiction (mayor of their own
--      city) before their own province/state before their own country before
--      everything else -- "closer to them, then wider", per the actual ask.
--   4. Within a proximity tier, more local office (Municipal) before broader
--      (Provincial/State) before broadest (Federal/National).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes so ILIKE '%term%' stays fast against these ~30k-row tables.
CREATE INDEX IF NOT EXISTS idx_office_holders_full_name_trgm
  ON public.office_holders USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_map_shapes_name_trgm
  ON public.map_shapes USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Key Political Leaders: admin-curated allowlist of high-profile officials
-- (heads of state/government, cabinet ministers, party/opposition leaders,
-- premiers/governors) who should always rank at the top of search results
-- regardless of the searcher's own location -- e.g. "trump" or "carney"
-- should surface immediately. This is the same 30-leader roster
-- NewsPrompts/KeyLeadersNewsCollectionPrompt.md already scopes news
-- ingestion to; this table gives it a real, admin-editable home instead of
-- only living inside a prompt doc.
--
-- Matched primarily by linked profile/office-holder row; normalized_name is
-- a text fallback for leaders not yet seeded as a platform profile (e.g. a
-- newly-appointed minister with no office_holders row yet) so admins can add
-- them by name alone and link the row up later.
CREATE TABLE public.key_political_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  normalized_name text NOT NULL GENERATED ALWAYS AS (lower(trim(full_name))) STORED,
  politician_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  office_holder_id uuid REFERENCES public.office_holders(id) ON DELETE SET NULL,
  -- 1 = head of state/government, 2 = cabinet ministers / party & opposition
  -- leaders / governors & premiers, 3 = other admin-flagged high-priority figures.
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  role_title text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_key_political_leaders_normalized_name ON public.key_political_leaders(normalized_name);
CREATE INDEX idx_key_political_leaders_profile ON public.key_political_leaders(politician_profile_id);
CREATE INDEX idx_key_political_leaders_office_holder ON public.key_political_leaders(office_holder_id);

ALTER TABLE public.key_political_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read key political leaders"
  ON public.key_political_leaders FOR SELECT USING (true);

CREATE POLICY "Admins manage key political leaders"
  ON public.key_political_leaders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed from NewsPrompts/KeyLeadersNewsCollectionPrompt.md's 30-leader roster.
-- politician_profile_id set for the 26 already seeded as platform profiles
-- (verified live against profiles before writing this migration); the
-- remaining 4 (JD Vance, Ted Cruz, Elizabeth Warren, Jagmeet Singh) are
-- "pending seed" there too -- inserted by name only so search still floats
-- them once they ever appear as a candidate/officeholder query match, and an
-- admin can link politician_profile_id/office_holder_id once a row exists.
INSERT INTO public.key_political_leaders (full_name, politician_profile_id, priority, role_title) VALUES
  ('Donald Trump', 'a5fdebea-5daf-4d7e-86f2-b1b55aae903d', 1, 'President of the United States'),
  ('Mark Carney', '4bd5cf73-1d03-4fb2-ae1b-2303c2c99737', 1, 'Prime Minister of Canada'),
  ('JD Vance', NULL, 2, 'Vice President of the United States'),
  ('Mike Johnson', 'a655066e-0fc6-42d8-9334-8329acb6d80d', 2, 'Speaker of the U.S. House of Representatives'),
  ('Hakeem Jeffries', '0bfc7974-d5a5-4740-bc6f-213d09b5cd90', 2, 'U.S. House Democratic Leader'),
  ('Chuck Schumer', 'b0e16d47-d85a-4702-8e73-7187c8c2dd2d', 2, 'U.S. Senate Democratic Leader'),
  ('John Thune', '225f93a9-1ff0-4ccb-b8db-a4ff0e506873', 2, 'U.S. Senate Majority Leader'),
  ('Gavin Newsom', '400a040b-ee2a-448e-b2e2-1faeea46b718', 2, 'Governor of California'),
  ('Ron DeSantis', 'fc437e5a-1d25-4904-959e-88add7928b50', 2, 'Governor of Florida'),
  ('Greg Abbott', '82d5f358-a471-4b4d-b052-843ef9934ad3', 2, 'Governor of Texas'),
  ('JB Pritzker', '8f5b5344-ef1b-46cb-99bc-5ce45a84bfe9', 2, 'Governor of Illinois'),
  ('Josh Shapiro', 'b79d61e5-8476-45f0-9eed-a7d6304f6eac', 2, 'Governor of Pennsylvania'),
  ('Gretchen Whitmer', 'f7575c12-2971-4504-b654-bffde2bbf8d5', 2, 'Governor of Michigan'),
  ('Bernie Sanders', 'cab4ec75-2cec-4917-96dc-1065dad7b062', 2, 'U.S. Senator for Vermont'),
  ('Ted Cruz', NULL, 2, 'U.S. Senator for Texas'),
  ('Elizabeth Warren', NULL, 2, 'U.S. Senator for Massachusetts'),
  ('Pierre Poilievre', 'a0d8ee32-8927-48bc-9a98-fee27dd02d51', 2, 'Leader of the Official Opposition'),
  ('Jagmeet Singh', NULL, 2, 'Leader of the New Democratic Party'),
  ('Yves-François Blanchet', '2dffb263-e217-4ded-8c2a-26befa6a5a65', 2, 'Leader of the Bloc Québécois'),
  ('Chrystia Freeland', '4674a6d5-d9c0-4ec8-95ab-9a12cc27b5fa', 2, 'Senior Cabinet Minister / Deputy PM'),
  ('Dominic LeBlanc', '885e12f5-33d9-42a1-8dc9-b276069da88d', 2, 'Cabinet Minister (Trade / Intergovernmental)'),
  ('Mélanie Joly', '9d4b37d7-06e7-4df1-b9a5-e068a776ba86', 2, 'Cabinet Minister (Foreign Affairs)'),
  ('Doug Ford', '26ddb710-1861-4652-b8ed-dcbcc1dd7300', 2, 'Premier of Ontario'),
  ('François Legault', '19f76830-8288-487c-8ce7-0d6f64b0bb4a', 2, 'Premier of Quebec'),
  ('Danielle Smith', '77d86f33-0e15-46c3-8d2d-dd882a679be7', 2, 'Premier of Alberta'),
  ('David Eby', 'a730729a-0a3b-4231-b93d-9b5524f9db5e', 2, 'Premier of British Columbia'),
  ('Wab Kinew', '38870346-a851-434d-b894-8362aedc4966', 2, 'Premier of Manitoba'),
  ('Tim Houston', 'bcb1700f-740e-4d7c-8542-e346b4fb44f0', 2, 'Premier of Nova Scotia'),
  ('Elizabeth May', '50d60646-a942-415e-aea1-94d8293e888c', 3, 'Leader of the Green Party of Canada'),
  ('Ravi Kahlon', '472949c0-825a-498c-8a8e-33b6d292286e', 3, 'Senior B.C. Cabinet Minister');

-- ---------------------------------------------------------------------------
-- Maps a boundary_type string to a "how local is this" tier used to order
-- results within the same proximity tier (Mayor before MLA before MP when
-- both are equally "the searcher's own"). Country data uses inconsistent
-- boundary_type spellings (Province vs Provincial, National vs Federal), so
-- this matches by pattern rather than an exact lookup table.
CREATE OR REPLACE FUNCTION public.boundary_locality_scope(p_boundary_type text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_boundary_type IS NULL THEN 9
    WHEN p_boundary_type ILIKE '%municip%' OR p_boundary_type ILIKE '%ward%' OR p_boundary_type ILIKE '%school%' THEN 0
    WHEN p_boundary_type ILIKE '%province%' OR p_boundary_type ILIKE '%provinc%' OR p_boundary_type ILIKE '%state%' OR p_boundary_type ILIKE '%vidhan%' THEN 1
    WHEN p_boundary_type ILIKE '%federal%' OR p_boundary_type ILIKE '%national%' OR p_boundary_type ILIKE '%lok sabha%' THEN 2
    ELSE 3
  END;
$$;

-- ---------------------------------------------------------------------------
-- Main search RPC. Plain SECURITY INVOKER (default) is enough: every table
-- read here is already public (office_holders, politician_profiles, and
-- profiles-where-role='politician' all have public SELECT policies) except
-- the searcher's own user_locations row, which their own existing
-- "Users can view own location" policy already covers under auth.uid().
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

  -- Fall back to the signed-in searcher's own saved location/country when no
  -- explicit coordinates were passed in (e.g. browser geolocation wasn't used).
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
  WITH matches AS (
    -- Currently-serving officials tied to a real jurisdiction.
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
    FROM public.office_holders oh
    JOIN public.map_shapes ms ON ms.id = oh.map_shape_id
    JOIN public.election_role_types ert ON ert.id = oh.election_role_type_id
    LEFT JOIN public.political_parties party ON party.id = oh.political_party_id
    LEFT JOIN public.politician_profiles ppr ON ppr.id = oh.linked_profile_id
    WHERE oh.is_current
      AND (
        oh.full_name ILIKE '%' || v_query || '%'
        OR ms.name ILIKE '%' || v_query || '%'
        OR ert.role_title ILIKE '%' || v_query || '%'
      )

    UNION ALL

    -- Registered politician/candidate profiles not currently linked from a
    -- live office_holders row (declared candidates who don't hold office yet).
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
        WHEN p.full_name ILIKE '%' || v_query || '%' THEN 2
        ELSE 3
      END
    FROM public.profiles p
    JOIN public.politician_profiles ppr2 ON ppr2.id = p.id
    LEFT JOIN public.political_parties party2 ON party2.id = ppr2.political_party_id
    WHERE p.role = 'politician'
      AND NOT EXISTS (
        SELECT 1 FROM public.office_holders oh2
        WHERE oh2.linked_profile_id = p.id AND oh2.is_current
      )
      AND (
        p.full_name ILIKE '%' || v_query || '%'
        OR ppr2.target_boundary_name ILIKE '%' || v_query || '%'
        OR ppr2.political_target_role ILIKE '%' || v_query || '%'
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
