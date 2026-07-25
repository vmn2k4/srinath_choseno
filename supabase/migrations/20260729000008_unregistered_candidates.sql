-- Lets an approved election administrator (20260729000007) add a candidate
-- who is running in real life but hasn't registered on the platform, so
-- citizens aren't missing races that actually have candidates. Reuses the
-- existing candidate wall/wall-feed components entirely unchanged -- see
-- add_unregistered_candidate()'s comment below for why that's safe.
ALTER TABLE public.election_candidates
  ADD COLUMN nomination_filed boolean NOT NULL DEFAULT false,
  ADD COLUMN added_by_election_admin_id uuid REFERENCES public.profiles(id);

-- nomination_filed is self-editable via the existing "Candidates update own
-- application" policy (auth.uid() = politician_id, no column restriction) --
-- same mechanism updateCandidateStatement already relies on, no new RPC.

CREATE OR REPLACE FUNCTION public.add_unregistered_candidate(
  p_seat_id uuid, p_full_name text, p_party_id bigint, p_education text, p_hometown text, p_bio text
)
RETURNS public.election_candidates
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_seat_country text;
  v_party_country text;
  v_stub_id uuid := gen_random_uuid();
  v_row public.election_candidates;
BEGIN
  PERFORM public.promote_expired_election_admin_applications(p_seat_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.election_administrators
    WHERE seat_id = p_seat_id AND profile_id = auth.uid() AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'You are not an approved election administrator for this seat';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'A name is required';
  END IF;

  SELECT ms.country INTO v_seat_country
  FROM public.election_seats es JOIN public.map_shapes ms ON ms.id = es.map_shape_id
  WHERE es.id = p_seat_id;

  IF p_party_id IS NOT NULL THEN
    SELECT country INTO v_party_country FROM public.political_parties WHERE id = p_party_id;
    IF v_party_country IS DISTINCT FROM v_seat_country THEN
      RAISE EXCEPTION 'That party does not belong to this seat''s country';
    END IF;
  END IF;

  -- No auth.users row behind this id -- confirmed safe, profiles.id has had
  -- no FK to auth.users since 20260721000001_drop_fk.sql. current_ghost_id is
  -- still generated (rather than left null) so no display/comparison code
  -- path anywhere has to special-case a missing one; nobody will ever be
  -- logged in as this ghost, so isOwner checks in CandidacyWall/WallPostFeed
  -- are simply always false for this candidate -- citizens can still
  -- discuss/comment/support via the existing wall, unchanged.
  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', p_full_name, true, v_seat_country, gen_random_uuid());

  -- target_boundary_id/target_boundary_type deliberately left NULL: those
  -- drive PoliticianSidebar.jsx's "People Interested in Politics" query --
  -- an unclaimed stub candidate shouldn't show up there as if they were a
  -- real, browsing politician account.
  INSERT INTO public.politician_profiles (id, education, hometown, bio, political_party_id)
  VALUES (v_stub_id, p_education, p_hometown, p_bio, p_party_id);

  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (p_seat_id, v_stub_id, 'approved', now(), auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_unregistered_candidate(
  p_candidate_id uuid, p_full_name text, p_party_id bigint, p_education text, p_hometown text, p_bio text
)
RETURNS public.election_candidates
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_politician_id uuid;
  v_row public.election_candidates;
BEGIN
  SELECT politician_id INTO v_politician_id
  FROM public.election_candidates
  WHERE id = p_candidate_id AND added_by_election_admin_id = auth.uid();

  IF v_politician_id IS NULL THEN
    RAISE EXCEPTION 'Not found, or not a candidate you added';
  END IF;

  IF p_full_name IS NOT NULL AND trim(p_full_name) <> '' THEN
    UPDATE public.profiles SET full_name = p_full_name WHERE id = v_politician_id;
  END IF;

  UPDATE public.politician_profiles
  SET political_party_id = p_party_id, education = p_education, hometown = p_hometown, bio = p_bio
  WHERE id = v_politician_id;

  SELECT * INTO v_row FROM public.election_candidates WHERE id = p_candidate_id;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_unregistered_candidate(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM public.election_candidates
  WHERE id = p_candidate_id AND added_by_election_admin_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found, or not a candidate you added';
  END IF;
END;
$function$;
