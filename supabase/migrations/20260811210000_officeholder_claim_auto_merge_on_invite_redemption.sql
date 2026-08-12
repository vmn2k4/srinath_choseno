-- Auto-merge officeholder wall claims that originated from an admin invite,
-- the moment the recipient redeems the token — no separate admin
-- merge/approval step.
--
-- Why this is safe to skip: there are exactly two ways a claim reaches
-- 'pending_review' today (see 20260811170000's comment for the full
-- picture):
--   1. redeem_officeholder_wall_claim() — reached ONLY via a token created by
--      create_officeholder_wall_claim(), which is itself admin-only
--      (auth.uid() must be role='admin' — 20260811090000). An admin already
--      decided this specific email should own this specific wall before any
--      invite existed. Requiring a second admin click after the recipient
--      proves ownership by controlling the invited inbox is a redundant gate,
--      not an independent check — nothing new is being verified.
--   2. request_officeholder_wall_claim() — a citizen self-asserting "this is
--      me" with no admin involvement yet. This path is UNCHANGED by this
--      migration: it still lands in 'pending_review' and still requires a
--      human admin to look at it via merge_officeholder_wall_claim() (or
--      reject it), since nobody with authority has vetted it yet.
--
-- Implementation: the data-moving body of merge_officeholder_wall_claim() is
-- extracted into an internal helper, _execute_officeholder_wall_claim_merge,
-- parameterized on who to record as approved_by (rather than hardcoding
-- auth.uid()) so both the admin-invoked RPC and the auto-merge-on-redemption
-- path can share the exact same logic. Auto-merge failure (e.g. the
-- officeholder's linked_profile_id changed after the invite was created)
-- falls back to leaving the claim at 'pending_review' — the previous
-- behavior — rather than failing the claimant's own signup/login.

CREATE OR REPLACE FUNCTION public._execute_officeholder_wall_claim_merge(p_claim_id UUID, p_approved_by UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.office_holder_wall_claims%ROWTYPE;
  oh public.office_holders%ROWTYPE;
  src_slug TEXT;
  r RECORD;
  moved_count INTEGER := 0;
BEGIN
  SELECT * INTO c FROM public.office_holder_wall_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found' USING ERRCODE = 'P0002'; END IF;
  IF c.status <> 'pending_review' OR c.target_profile_id IS NULL OR c.target_ghost_id IS NULL THEN
    RAISE EXCEPTION 'claim must be pending review with a target profile' USING ERRCODE = '22023';
  END IF;
  IF c.source_profile_id = c.target_profile_id OR c.source_ghost_id = c.target_ghost_id THEN
    RAISE EXCEPTION 'source and target wall identities must differ' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = c.target_profile_id AND role = 'politician') THEN
    RAISE EXCEPTION 'target profile must be a politician profile' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO oh FROM public.office_holders WHERE id = c.office_holder_id FOR UPDATE;
  IF NOT FOUND OR oh.linked_profile_id <> c.source_profile_id THEN
    RAISE EXCEPTION 'officeholder source link changed since claim creation' USING ERRCODE = '40001';
  END IF;
  SELECT wall_slug INTO src_slug FROM public.politician_profiles WHERE id = c.source_profile_id;

  INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
  VALUES (p_claim_id, 'wall_route', c.office_holder_id::text,
    jsonb_build_object('linked_profile_id', oh.linked_profile_id),
    jsonb_build_object('linked_profile_id', c.target_profile_id), jsonb_build_object('moved', true));
  UPDATE public.office_holders SET linked_profile_id = c.target_profile_id, updated_at = now() WHERE id = c.office_holder_id;

  IF src_slug IS NOT NULL THEN
    INSERT INTO public.office_holder_wall_redirects(claim_id, old_wall_slug, old_ghost_id, target_profile_id, target_ghost_id)
    VALUES (p_claim_id, src_slug, c.source_ghost_id, c.target_profile_id, c.target_ghost_id);
  END IF;

  -- Defensive backstop: guarantees a resolvable, filled-in wall regardless of
  -- which claim path led here. For the normal redemption path this is a
  -- no-op (already done by redeem_officeholder_wall_claim before it calls
  -- this function).
  PERFORM public.backfill_politician_profile_from_officeholder(c.target_profile_id, c.office_holder_id, p_claim_id);

  FOR r IN SELECT id, ghost_id, wall_ghost_id FROM public.posts WHERE ghost_id = c.source_ghost_id OR wall_ghost_id = c.source_ghost_id::text LOOP
    INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
    VALUES (p_claim_id, 'post', r.id::text, jsonb_build_object('ghost_id', r.ghost_id, 'wall_ghost_id', r.wall_ghost_id), jsonb_build_object('ghost_id', c.target_ghost_id, 'wall_ghost_id', c.target_ghost_id::text), jsonb_build_object('moved', true));
    UPDATE public.posts SET ghost_id = CASE WHEN ghost_id = c.source_ghost_id THEN c.target_ghost_id ELSE ghost_id END, wall_ghost_id = CASE WHEN wall_ghost_id = c.source_ghost_id::text THEN c.target_ghost_id::text ELSE wall_ghost_id END WHERE id = r.id;
    moved_count := moved_count + 1;
  END LOOP;

  FOR r IN SELECT id, ghost_id FROM public.comments WHERE ghost_id = c.source_ghost_id LOOP
    INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
    VALUES (p_claim_id, 'comment', r.id::text, jsonb_build_object('ghost_id', r.ghost_id), jsonb_build_object('ghost_id', c.target_ghost_id), jsonb_build_object('moved', true));
    UPDATE public.comments SET ghost_id = c.target_ghost_id WHERE id = r.id;
    moved_count := moved_count + 1;
  END LOOP;

  FOR r IN SELECT politician_id, supporter_id, created_at, is_test FROM public.politician_supporters WHERE politician_id = c.source_profile_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.politician_supporters WHERE politician_id = c.target_profile_id AND supporter_id = r.supporter_id) THEN
      INSERT INTO public.politician_supporters(politician_id, supporter_id, created_at, is_test) VALUES (c.target_profile_id, r.supporter_id, r.created_at, r.is_test);
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata) VALUES (p_claim_id, 'supporter', r.supporter_id::text, jsonb_build_object('politician_id', c.source_profile_id), jsonb_build_object('politician_id', c.target_profile_id), jsonb_build_object('moved', true));
      DELETE FROM public.politician_supporters WHERE politician_id = c.source_profile_id AND supporter_id = r.supporter_id;
      moved_count := moved_count + 1;
    END IF;
  END LOOP;

  FOR r IN SELECT id, rater_id, rating, comment, is_test FROM public.politician_ratings WHERE politician_id = c.source_profile_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.politician_ratings WHERE politician_id = c.target_profile_id AND rater_id = r.rater_id) THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata) VALUES (p_claim_id, 'rating', r.id::text, jsonb_build_object('politician_id', c.source_profile_id), jsonb_build_object('politician_id', c.target_profile_id), jsonb_build_object('moved', true));
      UPDATE public.politician_ratings SET politician_id = c.target_profile_id WHERE id = r.id;
      moved_count := moved_count + 1;
    END IF;
  END LOOP;

  FOR r IN SELECT news_article_id FROM public.news_article_politicians WHERE politician_id = c.source_profile_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.news_article_politicians WHERE politician_id = c.target_profile_id AND news_article_id = r.news_article_id) THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata) VALUES (p_claim_id, 'news_article_tag', r.news_article_id::text, jsonb_build_object('politician_id', c.source_profile_id), jsonb_build_object('politician_id', c.target_profile_id), jsonb_build_object('moved', true));
      UPDATE public.news_article_politicians SET politician_id = c.target_profile_id WHERE politician_id = c.source_profile_id AND news_article_id = r.news_article_id;
      moved_count := moved_count + 1;
    END IF;
  END LOOP;

  FOR r IN SELECT id FROM public.election_candidates WHERE politician_id = c.source_profile_id LOOP
    INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata) VALUES (p_claim_id, 'election_candidate', r.id::text, jsonb_build_object('politician_id', c.source_profile_id), jsonb_build_object('politician_id', c.target_profile_id), jsonb_build_object('moved', true));
    UPDATE public.election_candidates SET politician_id = c.target_profile_id WHERE id = r.id;
    moved_count := moved_count + 1;
  END LOOP;

  UPDATE public.office_holder_wall_claims SET status = 'approved', approved_at = now(), approved_by = p_approved_by, updated_at = now() WHERE id = p_claim_id;
  RETURN jsonb_build_object('claim_id', p_claim_id, 'status', 'approved', 'moved_item_count', moved_count, 'source_profile_id', c.source_profile_id, 'target_profile_id', c.target_profile_id);
END;
$$;

-- Internal helper only — not part of the public RPC surface, same pattern as
-- backfill_politician_profile_from_officeholder. Callable from other
-- SECURITY DEFINER functions (they execute as the function owner) without a
-- direct GRANT to authenticated.
REVOKE ALL ON FUNCTION public._execute_officeholder_wall_claim_merge(UUID, UUID) FROM PUBLIC;

-- merge_officeholder_wall_claim: unchanged behavior (admin-authorized manual
-- merge, e.g. for a self-requested claim or a claim whose auto-merge fell
-- back to pending_review) — now just a thin wrapper over the shared helper.
CREATE OR REPLACE FUNCTION public.merge_officeholder_wall_claim(p_claim_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  RETURN public._execute_officeholder_wall_claim_merge(p_claim_id, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.merge_officeholder_wall_claim(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_officeholder_wall_claim(UUID) TO authenticated;

-- redeem_officeholder_wall_claim: identical through the pending_review
-- update and invite consumption, then immediately attempts the merge that
-- previously waited for a separate admin click — every claim reaching this
-- function came from an admin-created invite (self-requests use
-- request_officeholder_wall_claim and never call this), so admin sign-off
-- already happened when the invite was sent. approved_by is recorded as the
-- inviting admin (the invite's created_by), not the claimant, since they're
-- the one whose authorization this represents.
--
-- The merge is wrapped in its own exception-handling block so a failure
-- (e.g. the officeholder's wall was reassigned by some other path between
-- invite and redemption) can't break the claimant's signup/login — it just
-- leaves the claim at 'pending_review' for an admin to merge manually from
-- the Office Holders panel, exactly like before this migration.
CREATE OR REPLACE FUNCTION public.redeem_officeholder_wall_claim(p_token_hash TEXT)
RETURNS TABLE (claim_id UUID, office_holder_id UUID, target_profile_id UUID, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite public.office_holder_wall_claim_invites%ROWTYPE;
  v_office_holder_id UUID;
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

  -- Table alias required: this function's own RETURNS TABLE declares an
  -- office_holder_id OUT variable, which otherwise shadows/collides with the
  -- column reference below.
  SELECT c2.office_holder_id INTO v_office_holder_id
  FROM public.office_holder_wall_claims c2 WHERE c2.id = v_invite.claim_id;

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
  -- extension.
  UPDATE public.profiles SET role = 'politician', onboarding_completed = true WHERE id = v_user_id;

  -- Prefill the new politician's own profile from the officeholder record
  -- right away — the user shouldn't have to wait to see their name, role,
  -- boundary, bio, party, and contact info reflected on their own account,
  -- even in the rare case the auto-merge below falls back to pending_review.
  PERFORM public.backfill_politician_profile_from_officeholder(v_user_id, v_office_holder_id, v_invite.claim_id);

  UPDATE public.office_holder_wall_claims
  SET target_profile_id = v_user_id,
      target_ghost_id = v_target_ghost,
      claimed_at = now(),
      status = 'pending_review',
      updated_at = now()
  WHERE id = v_invite.claim_id;

  UPDATE public.office_holder_wall_claim_invites SET used_at = now() WHERE id = v_invite.id;

  -- Auto-merge: this claim exists only because an admin already created and
  -- sent the invite (see migration header) — there is no further approval
  -- left to gate on, so move the public wall immediately rather than parking
  -- it at pending_review for a redundant admin click. Falls back to leaving
  -- it at pending_review (previous behavior, unchanged) if the merge can't
  -- complete for any reason.
  BEGIN
    PERFORM public._execute_officeholder_wall_claim_merge(v_invite.claim_id, v_invite.created_by);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT c.id, c.office_holder_id, c.target_profile_id, c.status
  FROM public.office_holder_wall_claims c WHERE c.id = v_invite.claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_officeholder_wall_claim(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_officeholder_wall_claim(TEXT) TO authenticated;

COMMENT ON FUNCTION public.redeem_officeholder_wall_claim(TEXT) IS
  'Redeems an admin-sent officeholder wall claim invite: promotes the signed-in account to politician, prefills its profile, then auto-merges the public wall immediately (admin already authorized this claim by creating the invite). Falls back to pending_review, awaiting a manual merge_officeholder_wall_claim() call, if auto-merge cannot complete.';
