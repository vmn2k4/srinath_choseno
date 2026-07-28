-- add_unregistered_candidate() (20260729000008) only let an *approved
-- election administrator for that specific seat* add an unregistered
-- candidate -- a separate, per-seat volunteer role citizens apply for
-- (election_administrators), not the platform admin role (profiles.role =
-- 'admin') that gates ElectionsAdmin.jsx. The new admin "fetch official
-- candidates" panel there needs platform admins to be able to add
-- unregistered candidates too, for any seat, without also being that
-- seat's approved election administrator.
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
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
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

  INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id)
  VALUES (v_stub_id, 'politician', p_full_name, true, v_seat_country, gen_random_uuid());

  INSERT INTO public.politician_profiles (id, education, hometown, bio, political_party_id)
  VALUES (v_stub_id, p_education, p_hometown, p_bio, p_party_id);

  INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id)
  VALUES (p_seat_id, v_stub_id, 'approved', now(), auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
