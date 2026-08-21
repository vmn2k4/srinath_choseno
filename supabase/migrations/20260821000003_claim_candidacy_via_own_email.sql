-- claim_candidacy_via_token requires the raw invite token to survive the
-- round trip through the invite email -> GoTrue -> app. It doesn't:
-- admin.inviteUserByEmail's redirectTo is validated against the project's
-- Redirect URLs allow-list *before* our auth-send-email hook ever runs
-- (see that function's own SITE_URL comment), and a dynamic path like
-- /claim/{token} isn't on it -- so GoTrue silently drops it, the `next`
-- param never reaches auth-send-email's extractNextPath, and every invited
-- signup lands on /auth/confirm's generic per-type default (/onboarding for
-- "invite") with no idea a claim is pending. Confirmed via a real invite
-- link: /auth/confirm?token_hash=...&type=invite, no &next= at all.
--
-- This sidesteps the whole problem: verifyOtp({type:'invite', token_hash})
-- already cryptographically proves the caller controls the exact email
-- address the invite was sent to -- that's the same root trust
-- claim_candidacy_via_token relies on (whoever has the link/token proves
-- they have the inbox). So once verified, look up the pending invite by
-- email instead of by a token that never survived the trip, and finalize
-- the same way. No dependency on GoTrue's Redirect URLs list at all.
CREATE OR REPLACE FUNCTION public.claim_candidacy_via_own_email()
RETURNS public.election_candidates
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_email text;
  v_invite RECORD;
  v_row public.election_candidates;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to claim a candidacy';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No email on this account';
  END IF;

  -- Most recent still-open invite for this email. Deliberately not scoped
  -- to a specific candidate_id -- one email should only ever have one live
  -- invite in practice, and picking the newest is the sane tiebreak if that
  -- assumption is ever violated.
  SELECT * INTO v_invite FROM public.candidate_claim_invites
  WHERE email = v_email AND used_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'No pending interview invite found for this email';
  END IF;

  PERFORM public.finalize_candidate_claim(v_invite.candidate_id, auth.uid());

  UPDATE public.candidate_claim_invites SET used_at = now() WHERE id = v_invite.id;

  SELECT * INTO v_row FROM public.election_candidates WHERE id = v_invite.candidate_id;
  RETURN v_row;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_candidacy_via_own_email() TO authenticated;
