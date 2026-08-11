-- Officeholder claim redemption, reversible merge, and wall-route redirect.
--
-- This migration is additive at schema level. The merge RPC intentionally
-- updates/deletes rows only when an administrator explicitly approves a
-- pending claim; every affected row is recorded before the ownership change.

CREATE TABLE IF NOT EXISTS public.office_holder_wall_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.office_holder_wall_claims(id) ON DELETE RESTRICT,
  old_wall_slug TEXT,
  old_ghost_id UUID NOT NULL,
  target_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_ghost_id UUID NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS office_holder_wall_redirects_active_ghost_idx
  ON public.office_holder_wall_redirects(old_ghost_id) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS office_holder_wall_redirects_active_slug_idx
  ON public.office_holder_wall_redirects(old_wall_slug) WHERE active AND old_wall_slug IS NOT NULL;

ALTER TABLE public.office_holder_wall_redirects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active officeholder wall redirects" ON public.office_holder_wall_redirects;
CREATE POLICY "Anyone can read active officeholder wall redirects"
  ON public.office_holder_wall_redirects FOR SELECT
  TO anon, authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Admins can manage officeholder wall redirects" ON public.office_holder_wall_redirects;
CREATE POLICY "Admins can manage officeholder wall redirects"
  ON public.office_holder_wall_redirects FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

COMMENT ON TABLE public.office_holder_wall_redirects IS
  'Public redirect from an imported officeholder wall identity to its approved surviving profile.';

CREATE OR REPLACE FUNCTION public.redeem_officeholder_wall_claim(p_token_hash TEXT)
RETURNS TABLE (claim_id UUID, office_holder_id UUID, target_profile_id UUID, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite public.office_holder_wall_claim_invites%ROWTYPE;
  v_target_ghost UUID;
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

  SELECT current_ghost_id INTO v_target_ghost
  FROM public.profiles WHERE id = v_user_id;
  IF v_target_ghost IS NULL THEN
    RAISE EXCEPTION 'signed-in profile has no wall identity' USING ERRCODE = '23514';
  END IF;

  UPDATE public.office_holder_wall_claims
  SET target_profile_id = v_user_id,
      target_ghost_id = v_target_ghost,
      claimed_at = now(),
      status = 'pending_review',
      updated_at = now()
  WHERE id = v_invite.claim_id;

  UPDATE public.office_holder_wall_claim_invites
  SET used_at = now()
  WHERE id = v_invite.id;

  RETURN QUERY
  SELECT c.id, c.office_holder_id, c.target_profile_id, c.status
  FROM public.office_holder_wall_claims c WHERE c.id = v_invite.claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_officeholder_wall_claim(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_officeholder_wall_claim(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_officeholder_wall_claim(p_claim_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_claim public.office_holder_wall_claims%ROWTYPE;
  v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_claim FROM public.office_holder_wall_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found' USING ERRCODE = 'P0002'; END IF;

  v_result := jsonb_build_object(
    'claim_id', v_claim.id,
    'office_holder_id', v_claim.office_holder_id,
    'source_profile_id', v_claim.source_profile_id,
    'source_ghost_id', v_claim.source_ghost_id,
    'target_profile_id', v_claim.target_profile_id,
    'target_ghost_id', v_claim.target_ghost_id,
    'status', v_claim.status,
    'posts', (SELECT count(*) FROM public.posts WHERE ghost_id = v_claim.source_ghost_id OR wall_ghost_id = v_claim.source_ghost_id::text),
    'comments', (SELECT count(*) FROM public.comments WHERE ghost_id = v_claim.source_ghost_id),
    'supporters', (SELECT count(*) FROM public.politician_supporters WHERE politician_id = v_claim.source_profile_id),
    'ratings', (SELECT count(*) FROM public.politician_ratings WHERE politician_id = v_claim.source_profile_id),
    'news_tags', (SELECT count(*) FROM public.news_article_politicians WHERE politician_id = v_claim.source_profile_id),
    'election_candidates', (SELECT count(*) FROM public.election_candidates WHERE politician_id = v_claim.source_profile_id)
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_officeholder_wall_claim(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_officeholder_wall_claim(UUID) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.reverse_officeholder_wall_claim(p_claim_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.office_holder_wall_claims%ROWTYPE;
  item RECORD;
  restored_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'reversal reason is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO c FROM public.office_holder_wall_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'approved' THEN RAISE EXCEPTION 'only an approved claim can be reversed' USING ERRCODE = '22023'; END IF;

  FOR item IN SELECT * FROM public.office_holder_wall_claim_items WHERE claim_id = p_claim_id AND COALESCE((metadata->>'moved')::boolean, true) LOOP
    IF item.entity_type = 'post' THEN
      UPDATE public.posts SET ghost_id = c.source_ghost_id, wall_ghost_id = c.source_ghost_id::text WHERE id = item.entity_id::uuid AND (ghost_id = c.target_ghost_id OR wall_ghost_id = c.target_ghost_id::text);
    ELSIF item.entity_type = 'comment' THEN
      UPDATE public.comments SET ghost_id = c.source_ghost_id WHERE id = item.entity_id::uuid AND ghost_id = c.target_ghost_id;
    ELSIF item.entity_type = 'supporter' THEN
      DELETE FROM public.politician_supporters WHERE politician_id = c.target_profile_id AND supporter_id = item.entity_id::uuid;
      INSERT INTO public.politician_supporters(politician_id, supporter_id) VALUES (c.source_profile_id, item.entity_id::uuid) ON CONFLICT DO NOTHING;
    ELSIF item.entity_type = 'rating' THEN
      IF NOT EXISTS (SELECT 1 FROM public.politician_ratings WHERE politician_id = c.source_profile_id AND rater_id = (item.source_value->>'rater_id')::uuid) THEN
        UPDATE public.politician_ratings SET politician_id = c.source_profile_id WHERE id = item.entity_id::uuid AND politician_id = c.target_profile_id;
      END IF;
    ELSIF item.entity_type = 'news_article_tag' THEN
      DELETE FROM public.news_article_politicians WHERE politician_id = c.target_profile_id AND news_article_id = item.entity_id::uuid;
      INSERT INTO public.news_article_politicians(news_article_id, politician_id) VALUES (item.entity_id::uuid, c.source_profile_id) ON CONFLICT DO NOTHING;
    ELSIF item.entity_type = 'election_candidate' THEN
      UPDATE public.election_candidates SET politician_id = c.source_profile_id WHERE id = item.entity_id::uuid AND politician_id = c.target_profile_id;
    ELSIF item.entity_type = 'wall_route' THEN
      UPDATE public.office_holders SET linked_profile_id = c.source_profile_id, updated_at = now() WHERE id = c.office_holder_id AND linked_profile_id = c.target_profile_id;
    END IF;
    UPDATE public.office_holder_wall_claim_items SET reversed_at = now() WHERE id = item.id;
    restored_count := restored_count + 1;
  END LOOP;

  UPDATE public.office_holder_wall_redirects SET active = false, reversed_at = now() WHERE claim_id = p_claim_id AND active;
  UPDATE public.office_holder_wall_claims SET status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason), updated_at = now() WHERE id = p_claim_id;
  RETURN jsonb_build_object('claim_id', p_claim_id, 'status', 'reversed', 'restored_item_count', restored_count);
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_officeholder_wall_claim(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_officeholder_wall_claim(UUID, TEXT) TO authenticated;
