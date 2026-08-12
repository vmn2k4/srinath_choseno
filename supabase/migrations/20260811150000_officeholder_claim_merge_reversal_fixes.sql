-- Fixes two bugs found in a manual audit of the officeholder wall claim flow:
--
-- 1. merge_officeholder_wall_claim: a target profile that reached
--    'politician' role without completing onboarding (e.g. via the token
--    redemption path, which already creates a bare politician_profiles row
--    with no wall_slug) ends up with a wall that is unreachable by any URL —
--    every wall-resolution query in politicianWall.ts requires
--    politician_profiles!inner, and the redirect from the old wall slug
--    resolves by profile id through that same inner join. This migration
--    backfills a wall_slug and the public-facing role/boundary/bio/party
--    fields from the officeholder record, but only where the target's own
--    column is still NULL — it must never overwrite a real politician's own
--    edits (see docs/OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md §5.2).
--
-- 2. reverse_officeholder_wall_claim: the 'post' reversal step unconditionally
--    set BOTH posts.ghost_id and posts.wall_ghost_id back to source_ghost_id,
--    even when only one of the two columns was actually changed at merge
--    time (the common case: a citizen's own post left *on* the wall has its
--    wall_ghost_id retargeted but keeps its own ghost_id). Reversing that
--    claim silently reassigned the citizen's post to the officeholder's
--    ghost id. This migration restores each column independently, and only
--    when it still holds the value the merge step set, using the exact
--    per-column snapshot merge already recorded in claim_items.source_value.
--
-- Both functions are CREATE OR REPLACE — additive, no data is touched by
-- running this migration itself.

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
  v_target_full_name TEXT;
  v_role_title TEXT;
  v_boundary_name TEXT;
  v_base_slug TEXT;
  v_candidate_slug TEXT;
  v_existing_target_slug TEXT;
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

  -- Guarantee the target has a resolvable public wall regardless of which
  -- claim path led here. politician_profiles!inner is required by every wall
  -- lookup (including the redirect above), so a missing row here would leave
  -- both the old and new wall URLs unreachable after this transaction commits.
  INSERT INTO public.politician_profiles (id) VALUES (c.target_profile_id) ON CONFLICT (id) DO NOTHING;

  SELECT full_name INTO v_target_full_name FROM public.profiles WHERE id = c.target_profile_id;
  SELECT ert.role_title INTO v_role_title FROM public.election_role_types ert WHERE ert.id = oh.election_role_type_id;
  SELECT ms.name INTO v_boundary_name FROM public.map_shapes ms WHERE ms.id = oh.map_shape_id;

  SELECT wall_slug INTO v_existing_target_slug FROM public.politician_profiles WHERE id = c.target_profile_id;
  IF v_existing_target_slug IS NULL THEN
    v_base_slug := lower(regexp_replace(
      trim(both '-' from regexp_replace(coalesce(v_target_full_name, '') || '-' || coalesce(v_role_title, ''), '[^a-zA-Z0-9]+', '-', 'g')),
      '-{2,}', '-', 'g'
    ));
    IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'politician'; END IF;
    v_candidate_slug := v_base_slug;
    -- wall_slug is unique where non-null (see officeholder claim foundation
    -- migration) — fall back to a short id suffix on collision rather than
    -- fail the whole merge over a name clash.
    IF EXISTS (SELECT 1 FROM public.politician_profiles WHERE wall_slug = v_candidate_slug) THEN
      v_candidate_slug := v_base_slug || '-' || substr(replace(c.target_profile_id::text, '-', ''), 1, 6);
    END IF;
    UPDATE public.politician_profiles SET wall_slug = v_candidate_slug, updated_at = now() WHERE id = c.target_profile_id;
    INSERT INTO public.office_holder_wall_claim_items(claim_id, entity_type, entity_id, source_value, target_value, metadata)
    VALUES (p_claim_id, 'politician_profile', c.target_profile_id::text,
      jsonb_build_object('wall_slug', NULL), jsonb_build_object('wall_slug', v_candidate_slug),
      jsonb_build_object('moved', false, 'field', 'wall_slug'));
  END IF;

  -- Fill gaps only — never overwrite a value the target already set for
  -- themselves. Contact/photo/source_url are intentionally left alone here:
  -- enrichProfileWithContactFallback (politicianWall.ts) already resolves
  -- those live from office_holders once is_office_holder is true, so writing
  -- them here would just create a second, potentially stale source of truth.
  UPDATE public.politician_profiles SET
    political_target_role = COALESCE(political_target_role, v_role_title),
    target_boundary_name = COALESCE(target_boundary_name, v_boundary_name),
    bio = COALESCE(bio, oh.bio),
    political_party_id = COALESCE(political_party_id, oh.political_party_id),
    updated_at = now()
  WHERE id = c.target_profile_id;

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
      -- Restore ghost_id and wall_ghost_id independently, each only if it
      -- still holds the value merge set it to. A blanket two-column
      -- overwrite here would reassign a citizen's own post (whose ghost_id
      -- was never touched — only wall_ghost_id was retargeted at merge) to
      -- the officeholder's ghost id.
      UPDATE public.posts SET ghost_id = (item.source_value->>'ghost_id')::uuid
        WHERE id = item.entity_id::uuid AND ghost_id = c.target_ghost_id
          AND item.source_value->>'ghost_id' IS NOT NULL;
      UPDATE public.posts SET wall_ghost_id = item.source_value->>'wall_ghost_id'
        WHERE id = item.entity_id::uuid AND wall_ghost_id = c.target_ghost_id::text;
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
    -- The 'politician_profile' wall_slug backfill and other profile-field
    -- backfills are intentionally not reversed here (note metadata.moved is
    -- false for that item, so the loop's WHERE clause already skips it): the
    -- target keeps their own account and identity going forward, only the
    -- officeholder's link and moved content revert.
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
