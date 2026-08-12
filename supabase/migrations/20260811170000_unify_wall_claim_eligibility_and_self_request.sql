-- Unifies "can this wall be claimed, and by which system" across the two
-- claim paths that actually needed unifying: officeholder walls and
-- generic politician walls. (Election-candidacy claims — a third, separate
-- system with its own seat-admin review model — are deliberately left
-- untouched; see docs/OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md 2026-08-11 entry.)
--
-- Two bugs this fixes:
--
-- 1. The "Claim Profile" button on politician walls showed for EVERY
--    non-owner visitor, on EVERY politician wall, including walls that
--    already belong to a real, signed-up person. There was no "does this
--    wall already have an owner" check at all. Fixed by deriving
--    claimability from public data: an election_candidates stub with
--    claimed_at IS NULL, or an office_holders record with no open/approved
--    claim. Neither → nothing to claim → no button.
--
-- 2. The same button, when it *did* submit, inserted into
--    candidacy_claim_requests with candidate_id falling back to the
--    profile's own id whenever no matching election_candidates row
--    existed (true for every officeholder wall, and for any self-
--    registered politician with no candidacy record) — a guaranteed FK
--    violation. Fixed by only ever routing to that form when a real
--    election_candidates stub id is confirmed to exist, and adding a new,
--    parallel self-service path for officeholder walls that reuses the
--    exact officeholder-claim machinery (same table, same admin review
--    screen, same merge RPC, same signup-time prefill) instead of writing
--    into a table whose FK was never meant for it.

-- Read-only, callable by anyone viewing a wall (including logged-out
-- visitors, so the UI can decide whether to show a claim affordance at
-- all before asking anyone to sign in). Never exposes claim contents
-- (contact_email, tokens, requester identity) — only the routing decision.
CREATE OR REPLACE FUNCTION public.get_wall_claim_eligibility(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate_id UUID;
  v_office_holder_id UUID;
  v_oh_has_open_claim BOOLEAN;
BEGIN
  -- Election-candidacy stub: unclaimed if it's an admin-added stub with no
  -- claim finalized yet. Same eligibility check finalize_candidate_claim()
  -- itself enforces (20260802000001_candidacy_claims.sql) — kept in sync,
  -- not re-derived differently here.
  SELECT id INTO v_candidate_id FROM public.election_candidates
  WHERE politician_id = p_profile_id
    AND added_by_election_admin_id IS NOT NULL
    AND claimed_at IS NULL
  LIMIT 1;

  IF v_candidate_id IS NOT NULL THEN
    RETURN jsonb_build_object('kind', 'unclaimed_candidate', 'candidate_id', v_candidate_id);
  END IF;

  -- Officeholder wall: unclaimed if no claim is currently open or already
  -- approved for it. office_holder_wall_claims is admin-only-readable, so
  -- this SECURITY DEFINER check is the only way a non-admin visitor can
  -- learn "is there already a claim in flight" without seeing the claim
  -- itself — otherwise two different citizens could both be shown a claim
  -- button for the same wall and race for it (the unique index would still
  -- stop a second row being written, but the first visitor would just see
  -- a raw constraint-violation error instead of the button never showing).
  SELECT id INTO v_office_holder_id FROM public.office_holders WHERE linked_profile_id = p_profile_id LIMIT 1;

  IF v_office_holder_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.office_holder_wall_claims
      WHERE office_holder_id = v_office_holder_id
        AND status IN ('draft', 'invited', 'pending_confirmation', 'pending_review', 'approved')
    ) INTO v_oh_has_open_claim;

    IF NOT v_oh_has_open_claim THEN
      RETURN jsonb_build_object('kind', 'unclaimed_officeholder', 'office_holder_id', v_office_holder_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('kind', 'not_claimable');
END;
$$;

REVOKE ALL ON FUNCTION public.get_wall_claim_eligibility(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wall_claim_eligibility(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.get_wall_claim_eligibility(UUID) IS
  'Read-only routing check for wall claim UI: unclaimed_candidate (route to the existing election-candidacy claim form), unclaimed_officeholder (route to request_officeholder_wall_claim), or not_claimable (hide all claim UI — the wall already has an owner or an open claim).';

-- Self-service counterpart to the admin-initiated invite flow. A logged-in
-- citizen asserting "this officeholder wall is me" lands directly in
-- pending_review — same trust model as the existing self-service
-- candidacy_claim_requests path (no token; a human admin reviews the
-- contact info/note before merging), just against office_holder_wall_claims
-- instead of a form that never had a valid FK target for this case.
--
-- Deliberately reuses backfill_politician_profile_from_officeholder() — the
-- exact function redeem_officeholder_wall_claim() calls — so a self-request
-- gets the identical immediate profile prefill an invited signup gets. The
-- officeholder-claim machinery is the source of truth; this is a second
-- entry point into it, not a parallel implementation.
CREATE OR REPLACE FUNCTION public.request_officeholder_wall_claim(
  p_office_holder_id UUID,
  p_contact_email TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (claim_id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  oh public.office_holders%ROWTYPE;
  v_source_ghost UUID;
  v_target_ghost UUID;
  v_role TEXT;
  v_claim_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'sign-in required' USING ERRCODE = '42501';
  END IF;
  IF p_contact_email IS NULL OR btrim(p_contact_email) = '' THEN
    RAISE EXCEPTION 'contact email is required' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO oh FROM public.office_holders WHERE id = p_office_holder_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'officeholder not found' USING ERRCODE = 'P0002';
  END IF;
  IF oh.linked_profile_id IS NULL THEN
    RAISE EXCEPTION 'officeholder has no wall to claim' USING ERRCODE = '23514';
  END IF;
  IF oh.linked_profile_id = v_user_id THEN
    RAISE EXCEPTION 'cannot claim your own wall' USING ERRCODE = '23514';
  END IF;

  SELECT current_ghost_id, role INTO v_target_ghost, v_role FROM public.profiles WHERE id = v_user_id;
  IF v_target_ghost IS NULL THEN
    RAISE EXCEPTION 'signed-in profile has no wall identity' USING ERRCODE = '23514';
  END IF;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'admin accounts cannot self-request an officeholder wall claim' USING ERRCODE = '42501';
  END IF;

  SELECT current_ghost_id INTO v_source_ghost FROM public.profiles WHERE id = oh.linked_profile_id;

  BEGIN
    INSERT INTO public.office_holder_wall_claims
      (office_holder_id, source_profile_id, source_ghost_id, target_profile_id, target_ghost_id,
       contact_email, status, claimed_at, created_by, metadata)
    VALUES
      (p_office_holder_id, oh.linked_profile_id, v_source_ghost, v_user_id, v_target_ghost,
       btrim(p_contact_email), 'pending_review', now(), v_user_id,
       jsonb_build_object('self_requested', true, 'note', NULLIF(btrim(coalesce(p_note, '')), '')))
    RETURNING id INTO v_claim_id;
  EXCEPTION WHEN unique_violation THEN
    -- office_holder_wall_claims_one_open_claim_idx (20260811082341) — someone
    -- else already has an open or approved claim on this officeholder.
    RAISE EXCEPTION 'this wall already has a pending or approved claim' USING ERRCODE = '23505';
  END;

  -- Same promotion + prefill an invited redemption gets (20260811160000) —
  -- the requester doesn't have to wait for admin approval to see their own
  -- profile populated from the officeholder record.
  UPDATE public.profiles SET role = 'politician', onboarding_completed = true WHERE id = v_user_id;
  PERFORM public.backfill_politician_profile_from_officeholder(v_user_id, p_office_holder_id, v_claim_id);

  RETURN QUERY SELECT v_claim_id, 'pending_review'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.request_officeholder_wall_claim(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_officeholder_wall_claim(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.request_officeholder_wall_claim(UUID, TEXT, TEXT) IS
  'Self-service counterpart to create_officeholder_wall_claim(): a logged-in citizen requests an officeholder wall directly into pending_review, no admin invite needed. Reviewed the same way as an invited/redeemed claim, via preview_officeholder_wall_claim()/merge_officeholder_wall_claim().';

-- Admin-only, global discoverability for self-requests. Without this, an
-- admin can only see a self-request by already having navigated to that
-- specific officeholder's admin panel — a self-service path nobody can
-- discover isn't a self-service path.
CREATE OR REPLACE FUNCTION public.list_pending_self_requested_officeholder_claims()
RETURNS TABLE (
  claim_id UUID,
  office_holder_id UUID,
  office_holder_name TEXT,
  role_title TEXT,
  boundary_name TEXT,
  target_profile_id UUID,
  requester_name TEXT,
  contact_email TEXT,
  note TEXT,
  claimed_at TIMESTAMPTZ
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
    c.id, c.office_holder_id, oh.full_name, ert.role_title, ms.name,
    c.target_profile_id, p.full_name, c.contact_email, c.metadata->>'note', c.claimed_at
  FROM public.office_holder_wall_claims c
  JOIN public.office_holders oh ON oh.id = c.office_holder_id
  LEFT JOIN public.election_role_types ert ON ert.id = oh.election_role_type_id
  LEFT JOIN public.map_shapes ms ON ms.id = oh.map_shape_id
  LEFT JOIN public.profiles p ON p.id = c.target_profile_id
  WHERE c.status = 'pending_review' AND (c.metadata->>'self_requested')::boolean IS TRUE
  ORDER BY c.claimed_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_self_requested_officeholder_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pending_self_requested_officeholder_claims() TO authenticated;
