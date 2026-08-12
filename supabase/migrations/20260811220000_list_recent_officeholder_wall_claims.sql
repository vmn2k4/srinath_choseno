-- Admin-facing feed of recent officeholder wall claims across ALL
-- officeholders — not scoped to whichever single wall the admin most
-- recently looked up by URL.
--
-- Why: the admin panel only rendered the per-wall InvitationHistoryPanel
-- while `selectedWall` was still live in React state from the "Invite a
-- politician" form submission. That state is in-memory only and resets to
-- null on any page refresh, so a just-sent invite (and its status) would
-- silently disappear from the UI even though the row was safely persisted
-- in office_holder_wall_claims. This RPC backs a persistent list that is
-- loaded fresh from the database on every page load, so it survives
-- refresh, and it's cross-wall so admins don't need to remember which URL
-- they last looked up.

CREATE OR REPLACE FUNCTION public.list_recent_officeholder_wall_claims(p_limit INT DEFAULT 50)
RETURNS TABLE (
  claim_id UUID,
  office_holder_id UUID,
  office_holder_name TEXT,
  wall_slug TEXT,
  status TEXT,
  contact_email TEXT,
  is_self_requested BOOLEAN,
  invited_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.office_holder_id,
    oh.full_name,
    pp.wall_slug,
    c.status,
    c.contact_email,
    (c.metadata->>'self_requested')::boolean IS TRUE,
    c.invited_at,
    c.claimed_at,
    c.approved_at,
    c.reversed_at,
    c.reversal_reason,
    c.created_at,
    inv.expires_at
  FROM public.office_holder_wall_claims c
  JOIN public.office_holders oh ON oh.id = c.office_holder_id
  -- Current wall for this officeholder (survives merges — linked_profile_id
  -- is repointed to the claimant on merge, so this always resolves to the
  -- live wall rather than a stale/redirected slug).
  LEFT JOIN public.politician_profiles pp ON pp.id = oh.linked_profile_id
  LEFT JOIN LATERAL (
    SELECT i.expires_at
    FROM public.office_holder_wall_claim_invites i
    WHERE i.claim_id = c.id
    ORDER BY i.created_at DESC
    LIMIT 1
  ) inv ON true
  ORDER BY c.created_at DESC
  LIMIT GREATEST(p_limit, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.list_recent_officeholder_wall_claims(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_recent_officeholder_wall_claims(INT) TO authenticated;

COMMENT ON FUNCTION public.list_recent_officeholder_wall_claims(INT) IS
  'Admin-only feed of recent officeholder wall claims (any status) across all officeholders, joined to the officeholder''s current wall slug and latest invite expiry. Backs a persistent admin-panel list that survives page refresh, unlike the client-state-only per-wall lookup panel.';
