-- Adds open-tracking + a status-rollup RPC to the candidate claim invite
-- flow (20260802000001_candidacy_claims.sql), so the seat page's "Invite
-- Candidates to Claim" panel can show an admin whether an invite was
-- opened, whether the recipient has signed up, and whether they've
-- claimed -- previously that table was write-only (nothing in the app
-- ever read it back). Mirrors the shape of politician_claim_campaigns'
-- open-tracking (20260819000002_add_campaign_tracking.sql) but stays
-- minimal -- no click-tracking/engagement-score columns, since only
-- open/signup/claim status was asked for.

ALTER TABLE public.candidate_claim_invites
  ADD COLUMN tracking_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN opened_at timestamptz,
  ADD COLUMN opened_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_opened_at timestamptz;

-- create_claim_invite() now also hands back the tracking token so
-- send-claim-invite (the Edge Function) can thread it into the invite
-- email's user_metadata without a second round-trip -- avoids having to
-- widen this table's RLS (still "creator only", unchanged) just to let the
-- Edge Function read back the row it just inserted. Return type is
-- changing (text -> a two-column table), which Postgres won't do via
-- CREATE OR REPLACE -- drop the old signature first.
DROP FUNCTION IF EXISTS public.create_claim_invite(uuid, text);

CREATE OR REPLACE FUNCTION public.create_claim_invite(p_candidate_id uuid, p_email text)
RETURNS TABLE (token text, tracking_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_seat_id uuid;
  v_token text;
  v_tracking_token uuid;
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
  VALUES (p_candidate_id, p_email, encode(digest(v_token, 'sha256'), 'hex'), auth.uid(), now() + interval '7 days')
  RETURNING candidate_claim_invites.tracking_token INTO v_tracking_token;

  RETURN QUERY SELECT v_token, v_tracking_token;
END;
$function$;

-- Status rollup for the admin panel: one row per requested candidate id,
-- the latest invite for it (if any), and whether the invited email has an
-- account yet. SECURITY DEFINER so it can check auth.users (not otherwise
-- client-readable) -- same posture as get_admin_daily_user_signups()
-- (20260806000010). Authorization happens per-candidate via the same
-- is_claim_reviewer_for_candidate() check create_claim_invite() already
-- uses, so a caller only ever sees status for seats they administer (or
-- all of them, if they're a site admin) -- candidates the caller isn't
-- authorized for are silently dropped from the result rather than erroring,
-- so the seat page can pass its whole candidate list without pre-filtering.
CREATE OR REPLACE FUNCTION public.list_candidate_claim_invite_status(p_candidate_ids uuid[])
RETURNS TABLE (
  candidate_id uuid,
  invite_id uuid,
  email text,
  invited_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  opened_at timestamptz,
  opened_count integer,
  last_opened_at timestamptz,
  signed_up boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    cid.id AS candidate_id,
    i.id AS invite_id,
    i.email,
    i.created_at AS invited_at,
    i.expires_at,
    i.used_at,
    i.opened_at,
    i.opened_count,
    i.last_opened_at,
    -- auth.users existence alone isn't the right signal: inviteUserByEmail
    -- (send-claim-invite) pre-creates the auth.users row the instant the
    -- invite is *sent*, before the recipient has done anything -- confirmed
    -- against a real invite still sitting untouched, where the row already
    -- existed. email_confirmed_at only gets set once /auth/confirm's
    -- verifyOtp() actually runs, i.e. the recipient clicked through and
    -- completed the invite -- that's the real "signed up" signal.
    (i.email IS NOT NULL AND EXISTS (
      SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(i.email) AND u.email_confirmed_at IS NOT NULL
    )) AS signed_up
  FROM unnest(p_candidate_ids) AS cid(id)
  LEFT JOIN LATERAL (
    SELECT *
    FROM public.candidate_claim_invites cci
    WHERE cci.candidate_id = cid.id
    ORDER BY cci.created_at DESC
    LIMIT 1
  ) i ON true
  WHERE public.is_claim_reviewer_for_candidate(cid.id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_candidate_claim_invite_status(uuid[]) TO authenticated;
