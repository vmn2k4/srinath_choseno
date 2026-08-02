-- Candidacy claim flow: lets a stub candidate created by
-- add_unregistered_candidate() (20260729000008) be handed over to the real
-- person, two ways in -- an election admin emails them a one-time invite
-- link, or they self-request and an election admin/site admin approves.
-- Both converge on finalize_candidate_claim(), the single reassignment
-- operation that repoints the candidacy, merges the stub's already-vetted
-- identity onto the claiming profile, and repoints existing wall discussion
-- (posts.wall_ghost_id) and supporters onto the claiming profile's ghost id
-- before deleting the now-empty stub. See ARCHITECTURE.md's note (§27,
-- unregistered_candidates section) flagging this as a deferred next step.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.election_candidates ADD COLUMN claimed_at timestamptz;

-- Admin-sent invite. token_hash (not the plaintext) is what's stored --
-- this is an account-takeover-shaped credential, same trust level as a
-- password-reset link, so it gets the extra hashing step
-- election_administrators' contact_email etc. didn't need.
CREATE TABLE public.candidate_claim_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX idx_candidate_claim_invites_candidate ON public.candidate_claim_invites(candidate_id);

ALTER TABLE public.candidate_claim_invites ENABLE ROW LEVEL SECURITY;

-- No public SELECT -- token_hash/email don't need to be world-readable, and
-- nothing in the UI lists sent invites in this pass anyway. Mirrors
-- election_administrators' "no public SELECT" posture.
CREATE POLICY "Creators manage own claim invites"
  ON public.candidate_claim_invites FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Self-request: "this is me", reviewed by the seat's approved election
-- administrator or a site admin. Column shape mirrors
-- election_administrators (motivation/contact_email/social_media_info).
CREATE TABLE public.candidacy_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  requester_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  motivation text,
  contact_email text,
  social_media_info text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  UNIQUE (candidate_id, requester_profile_id)
);

CREATE INDEX idx_candidacy_claim_requests_candidate ON public.candidacy_claim_requests(candidate_id);

ALTER TABLE public.candidacy_claim_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can see and create their own requests, but NOT update them --
-- status changes only ever happen through review_candidacy_claim() below
-- (a SECURITY DEFINER function, which executes as the function owner and so
-- isn't itself gated by these policies), so a requester directly flipping
-- their own status to 'approved' via a raw client update is not possible.
CREATE POLICY "Requesters view own claim requests"
  ON public.candidacy_claim_requests FOR SELECT
  USING (auth.uid() = requester_profile_id);

CREATE POLICY "Requesters insert own claim requests"
  ON public.candidacy_claim_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_profile_id);

-- Whether the calling user can review/manage claim activity for a given
-- candidate -- site admin, or the seat's approved election administrator.
-- Deliberately SECURITY DEFINER so it can be used inside the RLS policy
-- below without nested-RLS fragility: election_candidates' own SELECT
-- policy hides rows whose parent election is still 'draft' from anyone who
-- isn't a site admin, so a plain (non-bypassing) subquery against it from
-- inside another table's policy would spuriously deny the seat's own
-- election administrator during that window. Same reasoning as
-- get_seat_admin_status() existing at all instead of a raw client query.
CREATE OR REPLACE FUNCTION public.is_claim_reviewer_for_candidate(p_candidate_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_seat_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN true;
  END IF;

  SELECT seat_id INTO v_seat_id FROM public.election_candidates WHERE id = p_candidate_id;

  RETURN EXISTS (
    SELECT 1 FROM public.election_administrators
    WHERE seat_id = v_seat_id AND profile_id = auth.uid() AND status = 'approved'
  );
END;
$function$;

CREATE POLICY "Election admins and site admins manage claim requests for their seats"
  ON public.candidacy_claim_requests FOR ALL
  USING (public.is_claim_reviewer_for_candidate(candidate_id))
  WITH CHECK (public.is_claim_reviewer_for_candidate(candidate_id));

-- The shared reassignment. Not client-callable directly -- only invoked
-- from claim_candidacy_via_token() and review_candidacy_claim() below, both
-- of which have already authorized the caller by the time they get here.
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

  INSERT INTO public.politician_profiles (id, education, hometown, bio, political_party_id, avatar_url)
  VALUES (p_claiming_profile_id, v_pp.education, v_pp.hometown, v_pp.bio, v_pp.political_party_id, v_pp.avatar_url)
  ON CONFLICT (id) DO UPDATE SET
    education = EXCLUDED.education,
    hometown = EXCLUDED.hometown,
    bio = EXCLUDED.bio,
    political_party_id = EXCLUDED.political_party_id,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.politician_profiles.avatar_url);

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

-- Flow A entry point: redeem an emailed token.
CREATE OR REPLACE FUNCTION public.claim_candidacy_via_token(p_token text)
RETURNS public.election_candidates
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_invite RECORD;
  v_row public.election_candidates;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to claim a candidacy';
  END IF;

  SELECT * INTO v_invite FROM public.candidate_claim_invites
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND used_at IS NULL AND expires_at > now();

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'This invite link is invalid or has expired';
  END IF;

  PERFORM public.finalize_candidate_claim(v_invite.candidate_id, auth.uid());

  UPDATE public.candidate_claim_invites SET used_at = now() WHERE id = v_invite.id;

  SELECT * INTO v_row FROM public.election_candidates WHERE id = v_invite.candidate_id;
  RETURN v_row;
END;
$function$;

-- Flow A: create the invite (called by the send-claim-invite Edge Function
-- with the caller's own JWT, before it separately emails the token via
-- Supabase Auth's admin.inviteUserByEmail using the service role).
CREATE OR REPLACE FUNCTION public.create_claim_invite(p_candidate_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_seat_id uuid;
  v_token text;
BEGIN
  SELECT seat_id INTO v_seat_id
  FROM public.election_candidates
  WHERE id = p_candidate_id AND added_by_election_admin_id IS NOT NULL AND claimed_at IS NULL;

  IF v_seat_id IS NULL THEN
    RAISE EXCEPTION 'This candidacy is not open to claim requests';
  END IF;

  IF NOT public.is_claim_reviewer_for_candidate(p_candidate_id) THEN
    RAISE EXCEPTION 'You are not an approved election administrator for this seat';
  END IF;

  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please provide a valid email address';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.candidate_claim_invites (candidate_id, email, token_hash, created_by, expires_at)
  VALUES (p_candidate_id, p_email, encode(digest(v_token, 'sha256'), 'hex'), auth.uid(), now() + interval '7 days');

  RETURN v_token;
END;
$function$;

-- Flow B: submit a self-request. Blocks resubmission after an explicit
-- rejection, same pattern as apply_for_election_admin.
CREATE OR REPLACE FUNCTION public.request_candidacy_claim(
  p_candidate_id uuid, p_motivation text, p_contact_email text, p_social_media_info text
)
RETURNS public.candidacy_claim_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_existing_status text;
  v_row public.candidacy_claim_requests;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.election_candidates
    WHERE id = p_candidate_id AND added_by_election_admin_id IS NOT NULL AND claimed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This candidacy is not open to claim requests';
  END IF;

  IF p_contact_email IS NULL OR p_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please provide a valid contact email';
  END IF;

  SELECT status INTO v_existing_status
  FROM public.candidacy_claim_requests WHERE candidate_id = p_candidate_id AND requester_profile_id = auth.uid();

  IF v_existing_status = 'rejected' THEN
    RAISE EXCEPTION 'Your request to claim this candidacy was not approved. Contact a site administrator if you believe this is a mistake.';
  END IF;

  INSERT INTO public.candidacy_claim_requests
    (candidate_id, requester_profile_id, motivation, contact_email, social_media_info, status, submitted_at)
  VALUES (p_candidate_id, auth.uid(), p_motivation, p_contact_email, p_social_media_info, 'pending', now())
  ON CONFLICT (candidate_id, requester_profile_id) DO UPDATE SET
    motivation = EXCLUDED.motivation,
    contact_email = EXCLUDED.contact_email,
    social_media_info = EXCLUDED.social_media_info,
    submitted_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- Flow B: review a self-request. Same dual-permission check as
-- create_claim_invite; approving one request rejects any other still-pending
-- requests for the same candidate, mirroring
-- review_election_admin_application's "only one winner" cleanup.
CREATE OR REPLACE FUNCTION public.review_candidacy_claim(p_request_id uuid, p_approve boolean)
RETURNS public.candidacy_claim_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_candidate_id uuid;
  v_requester uuid;
  v_row public.candidacy_claim_requests;
BEGIN
  SELECT candidate_id, requester_profile_id INTO v_candidate_id, v_requester
  FROM public.candidacy_claim_requests WHERE id = p_request_id;

  IF v_candidate_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_claim_reviewer_for_candidate(v_candidate_id) THEN
    RAISE EXCEPTION 'You are not an approved election administrator for this seat';
  END IF;

  IF p_approve THEN
    PERFORM public.finalize_candidate_claim(v_candidate_id, v_requester);
  END IF;

  UPDATE public.candidacy_claim_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  IF p_approve THEN
    UPDATE public.candidacy_claim_requests
    SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    WHERE candidate_id = v_candidate_id AND id <> p_request_id AND status = 'pending';
  END IF;

  RETURN v_row;
END;
$function$;
