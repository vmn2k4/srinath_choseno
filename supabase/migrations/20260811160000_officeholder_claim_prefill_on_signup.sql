-- Prefill the politician profile at signup/redemption time, not just at
-- admin merge time.
--
-- Before this migration: a brand-new account that redeemed a claim token got
-- role='politician' and a BARE politician_profiles row (id only — no name,
-- role, boundary, bio, party, contact, or wall_slug). All of that only got
-- filled in by merge_officeholder_wall_claim() once an admin approved the
-- claim, which could be hours or days later. In the meantime the new user's
-- own profile page looked empty despite having just claimed an official
-- record via a verified, single-use, email-gated invite link.
--
-- This migration extracts the gap-filling logic already proven in
-- 20260811150000 into a shared helper, and calls it from BOTH
-- redeem_officeholder_wall_claim (so the profile is prefilled the moment
-- someone signs up through the invite link) and merge_officeholder_wall_claim
-- (kept as a defensive backstop for any path that reaches merge without
-- going through redemption first — calling it twice is a no-op the second
-- time since every field is filled with COALESCE, never overwritten).
--
-- Contact fields (email/phone/source_url/photo_url) are now copied directly
-- here too, unlike the merge-time version in 20260811150000 which left them
-- to enrichProfileWithContactFallback's live lookup. That live lookup only
-- activates once is_office_holder is true, which requires
-- office_holders.linked_profile_id to already point at this profile — true
-- after merge, but NOT true yet at redemption time (ownership doesn't move
-- until an admin approves). Without copying them here, a freshly-signed-up
-- politician would see no contact info on their own wall until merge, which
-- defeats the point of prefilling at signup.

CREATE OR REPLACE FUNCTION public.backfill_politician_profile_from_officeholder(
  p_profile_id UUID,
  p_office_holder_id UUID,
  p_claim_id UUID DEFAULT NULL -- for audit logging; pass NULL to skip logging
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  oh public.office_holders%ROWTYPE;
  v_profile_full_name TEXT;
  v_role_title TEXT;
  v_boundary_name TEXT;
  v_base_slug TEXT;
  v_candidate_slug TEXT;
  v_existing_slug TEXT;
BEGIN
  SELECT * INTO oh FROM public.office_holders WHERE id = p_office_holder_id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.politician_profiles (id) VALUES (p_profile_id) ON CONFLICT (id) DO NOTHING;

  SELECT full_name INTO v_profile_full_name FROM public.profiles WHERE id = p_profile_id;
  SELECT ert.role_title INTO v_role_title FROM public.election_role_types ert WHERE ert.id = oh.election_role_type_id;
  SELECT ms.name INTO v_boundary_name FROM public.map_shapes ms WHERE ms.id = oh.map_shape_id;

  SELECT wall_slug INTO v_existing_slug FROM public.politician_profiles WHERE id = p_profile_id;
  IF v_existing_slug IS NULL THEN
    v_base_slug := lower(regexp_replace(
      trim(both '-' from regexp_replace(coalesce(v_profile_full_name, '') || '-' || coalesce(v_role_title, ''), '[^a-zA-Z0-9]+', '-', 'g')),
      '-{2,}', '-', 'g'
    ));
    IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'politician'; END IF;
    v_candidate_slug := v_base_slug;
    -- wall_slug is unique where non-null — fall back to a short id suffix on
    -- collision rather than fail the caller over a name clash.
    IF EXISTS (SELECT 1 FROM public.politician_profiles WHERE wall_slug = v_candidate_slug) THEN
      v_candidate_slug := v_base_slug || '-' || substr(replace(p_profile_id::text, '-', ''), 1, 6);
    END IF;
    UPDATE public.politician_profiles SET wall_slug = v_candidate_slug, updated_at = now() WHERE id = p_profile_id;

    IF p_claim_id IS NOT NULL THEN
      INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
      VALUES (p_claim_id, 'politician_profile', p_profile_id::text,
        jsonb_build_object('wall_slug', NULL), jsonb_build_object('wall_slug', v_candidate_slug),
        jsonb_build_object('moved', false, 'field', 'wall_slug'));
    END IF;
  END IF;

  -- Gap-fill only — never overwrite a value the profile owner already set for
  -- themselves (e.g. if they'd started editing before the claim was reviewed).
  UPDATE public.politician_profiles SET
    political_target_role = COALESCE(political_target_role, v_role_title),
    target_boundary_name = COALESCE(target_boundary_name, v_boundary_name),
    bio = COALESCE(bio, oh.bio),
    political_party_id = COALESCE(political_party_id, oh.political_party_id),
    contact_email = COALESCE(contact_email, oh.contact_email),
    contact_phone = COALESCE(contact_phone, oh.contact_phone),
    source_url = COALESCE(source_url, oh.source_url),
    photo_url = COALESCE(photo_url, oh.photo_url),
    holding_since = COALESCE(holding_since, oh.holding_since),
    updated_at = now()
  WHERE id = p_profile_id;
END;
$$;

-- Internal helper only — not part of the public RPC surface. It's called
-- from inside other SECURITY DEFINER functions (which execute as the
-- function owner, so no explicit GRANT to authenticated is needed for those
-- calls to succeed); REVOKE keeps it off PostgREST's directly-callable list.
REVOKE ALL ON FUNCTION public.backfill_politician_profile_from_officeholder(UUID, UUID, UUID) FROM PUBLIC;

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
  -- extension; the later admin merge still remains the ownership decision.
  UPDATE public.profiles SET role = 'politician', onboarding_completed = true WHERE id = v_user_id;

  -- Prefill the new politician's own profile from the officeholder record
  -- right away — the user shouldn't have to wait for admin approval to see
  -- their name, role, boundary, bio, party, and contact info reflected on
  -- their own account. Ownership of the PUBLIC wall (office_holders.
  -- linked_profile_id) still only changes at merge; this only affects the
  -- claimant's own, not-yet-public-facing politician_profiles row.
  PERFORM public.backfill_politician_profile_from_officeholder(v_user_id, v_office_holder_id, v_invite.claim_id);

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

-- merge_officeholder_wall_claim: swap the inline slug/field backfill for a
-- call to the shared helper (DRY — same logic redemption now also uses).
-- Everything else is unchanged from 20260811150000.
CREATE OR REPLACE FUNCTION public.merge_officeholder_wall_claim(p_claim_id UUID)
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;

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
  -- which claim path led here. For the normal redemption path this is now a
  -- no-op (already done in redeem_officeholder_wall_claim); it only does real
  -- work if merge is ever reached without going through redemption first.
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

  UPDATE public.office_holder_wall_claims SET status = 'approved', approved_at = now(), approved_by = auth.uid(), updated_at = now() WHERE id = p_claim_id;
  RETURN jsonb_build_object('claim_id', p_claim_id, 'status', 'approved', 'moved_item_count', moved_count, 'source_profile_id', c.source_profile_id, 'target_profile_id', c.target_profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_officeholder_wall_claim(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_officeholder_wall_claim(UUID) TO authenticated;
