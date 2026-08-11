-- Ensure invited new accounts have the politician profile extension required
-- by the officeholder wall before an administrator approves the merge.

CREATE OR REPLACE FUNCTION public.redeem_officeholder_wall_claim(p_token_hash TEXT)
RETURNS TABLE (claim_id UUID, office_holder_id UUID, target_profile_id UUID, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite public.office_holder_wall_claim_invites%ROWTYPE;
  v_target_ghost UUID;
  v_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'sign-in required' USING ERRCODE = '42501';
  END IF;

  SELECT i.* INTO v_invite
  FROM public.office_holder_wall_claim_invites i
  JOIN public.office_holder_wall_claims c ON c.id = i.claim_id
  WHERE i.token_hash = p_token_hash
    AND i.used_at IS NULL AND i.cancelled_at IS NULL
    AND i.expires_at > now()
    AND c.status IN ('invited', 'pending_confirmation')
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim invitation is invalid, used, cancelled, or expired' USING ERRCODE = '22023';
  END IF;

  SELECT current_ghost_id, role INTO v_target_ghost, v_role
  FROM public.profiles WHERE id = v_user_id;
  IF v_target_ghost IS NULL THEN
    RAISE EXCEPTION 'signed-in profile has no wall identity' USING ERRCODE = '23514';
  END IF;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'admin accounts cannot claim an officeholder wall' USING ERRCODE = '42501';
  END IF;

  -- A new Auth invite normally starts with a normal profile. The verified
  -- officeholder claim is the explicit boundary that creates the politician
  -- extension; the later admin merge still remains the ownership decision.
  UPDATE public.profiles SET role = 'politician', onboarding_completed = true WHERE id = v_user_id;
  INSERT INTO public.politician_profiles(id) VALUES (v_user_id) ON CONFLICT (id) DO NOTHING;

  UPDATE public.office_holder_wall_claims
  SET target_profile_id = v_user_id,
      target_ghost_id = v_target_ghost,
      claimed_at = now(),
      status = 'pending_review',
      updated_at = now()
  WHERE id = v_invite.claim_id;

  UPDATE public.office_holder_wall_claim_invites SET used_at = now() WHERE id = v_invite.id;

  RETURN QUERY SELECT c.id, c.office_holder_id, c.target_profile_id, c.status
  FROM public.office_holder_wall_claims c WHERE c.id = v_invite.claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_officeholder_wall_claim(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_officeholder_wall_claim(TEXT) TO authenticated;
