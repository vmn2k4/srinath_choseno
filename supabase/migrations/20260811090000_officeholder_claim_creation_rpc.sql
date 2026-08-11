-- Officeholder claim creation boundary.
--
-- Additive and non-destructive: this migration adds one admin-guarded RPC.
-- It does not merge, delete, update, or rewrite existing officeholder/profile
-- or wall data. The merge and reversal RPCs remain separate operations.

CREATE OR REPLACE FUNCTION public.create_officeholder_wall_claim(
  p_office_holder_id UUID,
  p_email TEXT,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
)
RETURNS TABLE (
  claim_id UUID,
  invite_id UUID,
  office_holder_id UUID,
  source_profile_id UUID,
  source_ghost_id UUID,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_source_profile_id UUID;
  v_source_ghost_id UUID;
  v_claim_id UUID;
  v_invite_id UUID;
BEGIN
  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;

  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'email is required' USING ERRCODE = '22023';
  END IF;

  IF p_token_hash IS NULL OR btrim(p_token_hash) = '' THEN
    RAISE EXCEPTION 'token hash is required' USING ERRCODE = '22023';
  END IF;

  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'invitation expiry must be in the future' USING ERRCODE = '22023';
  END IF;

  SELECT oh.linked_profile_id, p.current_ghost_id
    INTO v_source_profile_id, v_source_ghost_id
  FROM public.office_holders oh
  LEFT JOIN public.profiles p ON p.id = oh.linked_profile_id
  WHERE oh.id = p_office_holder_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'officeholder not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_source_profile_id IS NULL OR v_source_ghost_id IS NULL THEN
    RAISE EXCEPTION 'officeholder has no linked wall identity' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.office_holder_wall_claims (
    office_holder_id,
    source_profile_id,
    source_ghost_id,
    contact_email,
    status,
    invited_at,
    created_by
  )
  VALUES (
    p_office_holder_id,
    v_source_profile_id,
    v_source_ghost_id,
    lower(btrim(p_email)),
    'invited',
    now(),
    v_admin_id
  )
  RETURNING id INTO v_claim_id;

  INSERT INTO public.office_holder_wall_claim_invites (
    claim_id,
    email,
    token_hash,
    created_by,
    expires_at
  )
  VALUES (
    v_claim_id,
    lower(btrim(p_email)),
    p_token_hash,
    v_admin_id,
    p_expires_at
  )
  RETURNING id INTO v_invite_id;

  RETURN QUERY SELECT
    v_claim_id,
    v_invite_id,
    p_office_holder_id,
    v_source_profile_id,
    v_source_ghost_id,
    p_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_officeholder_wall_claim(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_officeholder_wall_claim(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.create_officeholder_wall_claim(UUID, TEXT, TEXT, TIMESTAMPTZ) IS
  'Creates an admin-authorized, officeholder-scoped claim invitation without changing wall ownership.';
