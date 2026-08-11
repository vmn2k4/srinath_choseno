-- Qualify the invitation claim_id reference because the RPC also returns a
-- column named claim_id.

CREATE OR REPLACE FUNCTION public.resend_officeholder_wall_claim(
  p_claim_id UUID,
  p_email TEXT,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
)
RETURNS TABLE (claim_id UUID, invite_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_claim public.office_holder_wall_claims%ROWTYPE;
  v_invite_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' OR p_token_hash IS NULL OR btrim(p_token_hash) = '' OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'valid email, token hash, and future expiry are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_claim FROM public.office_holder_wall_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND OR v_claim.status NOT IN ('invited', 'expired') THEN
    RAISE EXCEPTION 'only an invited or expired claim can be resent' USING ERRCODE = '22023';
  END IF;

  UPDATE public.office_holder_wall_claim_invites AS i
  SET cancelled_at = COALESCE(i.cancelled_at, now())
  WHERE i.claim_id = p_claim_id AND i.used_at IS NULL AND i.cancelled_at IS NULL;

  INSERT INTO public.office_holder_wall_claim_invites(claim_id, email, token_hash, created_by, expires_at)
  VALUES (p_claim_id, lower(btrim(p_email)), p_token_hash, auth.uid(), p_expires_at)
  RETURNING id INTO v_invite_id;

  UPDATE public.office_holder_wall_claims
  SET contact_email = lower(btrim(p_email)), status = 'invited', invited_at = now(), updated_at = now()
  WHERE id = p_claim_id;
  RETURN QUERY SELECT p_claim_id, v_invite_id, p_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.resend_officeholder_wall_claim(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resend_officeholder_wall_claim(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
