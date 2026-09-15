-- finalize_candidate_claim (20260802000001_candidacy_claims.sql) copies
-- education/hometown/bio/political_party_id/avatar_url from the stub onto
-- the claiming profile's politician_profiles row, but never touched
-- wall_slug, political_target_role, or target_boundary_id/type/name. Every
-- place that links to a politician's wall (NavBar "My Wall",
-- CandidacyWall's "View Politician Wall", post author links, search
-- results, OG metadata) falls back to *guessing* a slug from name + role
-- when wall_slug is empty -- and each call site reaches for a different
-- role field (election_seats.role_title, profiles.designation, a hardcoded
-- "Representative" metadata default...). For a normally-onboarded
-- politician those guesses are merely inconsistent; for an invite-claimed
-- candidate every one of those role fields is empty (none of the normal
-- onboarding steps that would populate them ever ran), so the guesses
-- diverge completely and the exact-match + name-fallback lookup in
-- getWallOwnerProfileBySlug doesn't reconcile them -- the candidate's own
-- wall link 404s. Confirmed against a real claimed test candidate: wall_slug,
-- political_target_role and target_boundary_* were all still empty.
--
-- Fix: compute and persist a real wall_slug (+ target_boundary_*, so
-- PoliticianSidebar's "people interested in politics" and other
-- target-boundary-driven surfaces also work) at claim time, same shape as
-- buildPoliticianWallSlug(name, role) in src/lib/utils/slugs.ts. Appends a
-- short id-hash suffix on collision, same convention buildSeatSlug/
-- buildCandidateSlug already use for exactly this reason.
--
-- Deliberately COALESCE on conflict (only fill if currently null), unlike
-- the "stub wins" fields above it: if the claiming account already has an
-- established wall (they were a real politician on the platform before
-- claiming this candidacy -- the identity-merge case this whole flow exists
-- to handle safely), overwriting their existing wall_slug/target_boundary
-- would break their existing wall's links. A brand-new account has no prior
-- row to conflict with, so it always gets the freshly computed values.
CREATE OR REPLACE FUNCTION public.finalize_candidate_claim(p_candidate_id uuid, p_claiming_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_stub_id uuid;
  v_seat_id uuid;
  v_stub_full_name text;
  v_stub_country text;
  v_stub_ghost_id uuid;
  v_claiming_ghost_id uuid;
  v_pp RECORD;
  v_role_title text;
  v_boundary_id bigint;
  v_boundary_type text;
  v_boundary_name text;
  v_base_slug text;
  v_final_slug text;
BEGIN
  -- Authoritative eligibility gate: must still be an unclaimed stub, no
  -- matter which entry point got us here.
  SELECT politician_id, seat_id INTO v_stub_id, v_seat_id
  FROM public.election_candidates
  WHERE id = p_candidate_id AND added_by_election_admin_id IS NOT NULL AND claimed_at IS NULL;

  IF v_stub_id IS NULL THEN
    RAISE EXCEPTION 'This candidacy is not open to claim requests';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.election_candidates
    WHERE seat_id = v_seat_id AND politician_id = p_claiming_profile_id AND id <> p_candidate_id
  ) THEN
    RAISE EXCEPTION 'This account already has a candidacy for this seat';
  END IF;

  SELECT full_name, country, current_ghost_id INTO v_stub_full_name, v_stub_country, v_stub_ghost_id
  FROM public.profiles WHERE id = v_stub_id;

  SELECT current_ghost_id INTO v_claiming_ghost_id FROM public.profiles WHERE id = p_claiming_profile_id;

  SELECT * INTO v_pp FROM public.politician_profiles WHERE id = v_stub_id;

  SELECT s.role_title, ms.id, ms.boundary_type, ms.name
    INTO v_role_title, v_boundary_id, v_boundary_type, v_boundary_name
  FROM public.election_seats s
  JOIN public.map_shapes ms ON ms.id = s.map_shape_id
  WHERE s.id = v_seat_id;

  v_base_slug := trim(both '-' from regexp_replace(
    lower(coalesce(v_stub_full_name, 'politician') || '-' || coalesce(v_role_title, '')),
    '[^a-z0-9]+', '-', 'g'
  ));
  v_final_slug := v_base_slug;
  IF EXISTS (
    SELECT 1 FROM public.politician_profiles
    WHERE wall_slug = v_final_slug AND id <> p_claiming_profile_id
  ) THEN
    v_final_slug := v_base_slug || '-' || left(replace(p_claiming_profile_id::text, '-', ''), 6);
  END IF;

  UPDATE public.election_candidates
  SET politician_id = p_claiming_profile_id, claimed_at = now()
  WHERE id = p_candidate_id;

  -- The stub's identity fields win -- it was already vetted as "the real
  -- candidate" when the election admin created it; claiming is the
  -- claimer asserting they *are* that vetted identity, not proposing a new
  -- one. onboarding_completed = true here is what lets a brand-new invited
  -- signup (Flow A) skip the normal onboarding flow entirely -- claiming
  -- *is* onboarding for them.
  UPDATE public.profiles
  SET role = 'politician', full_name = v_stub_full_name, country = v_stub_country, onboarding_completed = true
  WHERE id = p_claiming_profile_id;

  INSERT INTO public.politician_profiles (
    id, education, hometown, bio, political_party_id, avatar_url,
    wall_slug, political_target_role, target_boundary_id, target_boundary_type, target_boundary_name
  )
  VALUES (
    p_claiming_profile_id, v_pp.education, v_pp.hometown, v_pp.bio, v_pp.political_party_id, v_pp.avatar_url,
    v_final_slug, v_role_title, v_boundary_id::text, v_boundary_type, v_boundary_name
  )
  ON CONFLICT (id) DO UPDATE SET
    education = EXCLUDED.education,
    hometown = EXCLUDED.hometown,
    bio = EXCLUDED.bio,
    political_party_id = EXCLUDED.political_party_id,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.politician_profiles.avatar_url),
    wall_slug = COALESCE(public.politician_profiles.wall_slug, EXCLUDED.wall_slug),
    political_target_role = COALESCE(public.politician_profiles.political_target_role, EXCLUDED.political_target_role),
    target_boundary_id = COALESCE(public.politician_profiles.target_boundary_id, EXCLUDED.target_boundary_id),
    target_boundary_type = COALESCE(public.politician_profiles.target_boundary_type, EXCLUDED.target_boundary_type),
    target_boundary_name = COALESCE(public.politician_profiles.target_boundary_name, EXCLUDED.target_boundary_name);

  -- Repoint existing wall discussion onto the claiming profile's ghost id.
  -- Safe here specifically because candidate walls are already public/named
  -- (not anonymous like a citizen's), so this isn't the deanonymization
  -- risk repointing a citizen's ghost_id would be.
  -- posts.wall_ghost_id is text (not uuid, unlike posts.ghost_id) -- cast
  -- both sides for the comparison/assignment.
  IF v_stub_ghost_id IS NOT NULL AND v_claiming_ghost_id IS NOT NULL THEN
    UPDATE public.posts SET ghost_id = v_claiming_ghost_id WHERE ghost_id = v_stub_ghost_id;
    UPDATE public.posts SET wall_ghost_id = v_claiming_ghost_id::text WHERE wall_ghost_id = v_stub_ghost_id::text;
  END IF;

  -- Merge any existing supporters onto the claiming profile before the stub
  -- (and its politician_supporters rows, via ON DELETE CASCADE) are gone --
  -- otherwise real support data would be silently lost.
  INSERT INTO public.politician_supporters (politician_id, supporter_id, created_at)
  SELECT p_claiming_profile_id, supporter_id, created_at
  FROM public.politician_supporters WHERE politician_id = v_stub_id
  ON CONFLICT (politician_id, supporter_id) DO NOTHING;

  DELETE FROM public.politician_profiles WHERE id = v_stub_id;
  DELETE FROM public.profiles WHERE id = v_stub_id;
END;
$function$;

-- Backfill already-claimed candidates left with no wall_slug by the old
-- version of this function (never touches a row that already has one, e.g.
-- Casey Askar's pre-existing "casey-askar-u-s-representative" -- confirmed
-- against live data before writing this).
WITH targets AS (
  SELECT
    ec.politician_id AS profile_id,
    p.full_name,
    s.role_title,
    ms.id AS boundary_id,
    ms.boundary_type,
    ms.name AS boundary_name
  FROM public.election_candidates ec
  JOIN public.profiles p ON p.id = ec.politician_id
  JOIN public.election_seats s ON s.id = ec.seat_id
  JOIN public.map_shapes ms ON ms.id = s.map_shape_id
  JOIN public.politician_profiles pp ON pp.id = ec.politician_id
  WHERE ec.claimed_at IS NOT NULL AND pp.wall_slug IS NULL
),
slugged AS (
  SELECT
    profile_id, role_title, boundary_id, boundary_type, boundary_name,
    trim(both '-' from regexp_replace(lower(coalesce(full_name, 'politician') || '-' || coalesce(role_title, '')), '[^a-z0-9]+', '-', 'g')) AS base_slug
  FROM targets
)
UPDATE public.politician_profiles pp
SET
  wall_slug = CASE
    WHEN EXISTS (SELECT 1 FROM public.politician_profiles other WHERE other.wall_slug = s.base_slug AND other.id <> s.profile_id)
      THEN s.base_slug || '-' || left(replace(s.profile_id::text, '-', ''), 6)
    ELSE s.base_slug
  END,
  political_target_role = COALESCE(pp.political_target_role, s.role_title),
  target_boundary_id = COALESCE(pp.target_boundary_id, s.boundary_id::text),
  target_boundary_type = COALESCE(pp.target_boundary_type, s.boundary_type),
  target_boundary_name = COALESCE(pp.target_boundary_name, s.boundary_name)
FROM slugged s
WHERE pp.id = s.profile_id;
