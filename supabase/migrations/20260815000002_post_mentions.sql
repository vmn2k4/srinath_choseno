-- @mention support: tag a politician/officeholder in a feed or wall post
-- (Twitter-style "@" autocomplete in the composer). Every office_holders row
-- is required to have a linked profiles+politician_profiles row (see
-- ARCHITECTURE.md §34), so "politician or officeholder" is one taggable set:
-- profiles WHERE role='politician'. That role already has a public SELECT
-- policy (20260724000001_public_politician_profiles.sql), so the client-side
-- autocomplete search needs no new RPC -- only post creation needs one.

CREATE TABLE IF NOT EXISTS public.post_mentions (
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  politician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (post_id, politician_id)
);

CREATE INDEX IF NOT EXISTS idx_post_mentions_politician_id ON public.post_mentions(politician_id);

ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read post mentions" ON public.post_mentions FOR SELECT USING (true);
-- No client-facing INSERT policy: rows are only ever written by create_post/
-- create_wall_post below (SECURITY DEFINER, runs as function owner, bypasses
-- RLS), which validates each id actually resolves to role='politician'
-- before inserting -- a direct client insert could tag an arbitrary profile.

-- Shared validate-and-insert helper so create_post/create_wall_post don't
-- duplicate the same filter-and-cap logic. Silently drops any id that isn't
-- a real politician profile instead of raising, so a stale/tampered id in
-- the array never blocks the post itself from being created. Capped at 5
-- mentions/post to keep this a lightweight tag, not a spam vector.
CREATE OR REPLACE FUNCTION public.insert_post_mentions(p_post_id UUID, p_mentioned_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_mentioned_ids IS NULL OR array_length(p_mentioned_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.post_mentions (post_id, politician_id)
  SELECT p_post_id, p.id
  FROM public.profiles p
  WHERE p.id = ANY(p_mentioned_ids) AND p.role = 'politician'
  LIMIT 5
  ON CONFLICT DO NOTHING;
END;
$$;

-- create_post: same body as 20260804000008_politician_daily_post_limit.sql
-- plus p_mentioned_politician_ids.
CREATE OR REPLACE FUNCTION public.create_post(
  p_content                  TEXT,
  p_image_url                TEXT    DEFAULT NULL,
  p_video_url                TEXT    DEFAULT NULL,
  p_link_metadata            JSONB   DEFAULT NULL,
  p_election_candidate_id    UUID    DEFAULT NULL,
  p_news_article_id          UUID    DEFAULT NULL,
  p_mentioned_politician_ids UUID[]  DEFAULT NULL
) RETURNS public.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_country TEXT;
  v_banked BIGINT;
  v_live BIGINT;
  v_role TEXT;
  v_post public.posts;
BEGIN
  SELECT current_ghost_id, country, civic_score, role
    INTO v_ghost_id, v_country, v_banked, v_role
    FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  IF v_role = 'politician' THEN
    IF EXISTS (
      SELECT 1 FROM public.posts
      WHERE ghost_id = v_ghost_id
        AND created_at::date = (now() AT TIME ZONE 'utc')::date
    ) THEN
      RAISE EXCEPTION 'Politicians can only post once per day';
    END IF;
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  INSERT INTO public.posts (
    ghost_id, content, image_url, video_url, link_metadata,
    country, is_country, is_international,
    election_candidate_id, news_article_id, civic_score_snapshot
  ) VALUES (
    v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata,
    v_country, true, true,
    p_election_candidate_id, p_news_article_id,
    COALESCE(v_banked, 0) + COALESCE(v_live, 0)
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  PERFORM public.insert_post_mentions(v_post.id, p_mentioned_politician_ids);

  RETURN v_post;
END;
$$;

-- New arg appended at the end changes the signature, so the pre-existing
-- overload must be dropped explicitly (CREATE OR REPLACE only replaces an
-- identical arg list) -- same pattern as
-- 20260806000008_drop_old_create_post_overloads.sql.
DROP FUNCTION IF EXISTS public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID);
GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID[]) TO authenticated;

-- create_wall_post: same body as 20260804000009_create_wall_post_rpc.sql
-- plus p_mentioned_politician_ids.
CREATE OR REPLACE FUNCTION public.create_wall_post(
  p_content                  TEXT,
  p_image_url                TEXT    DEFAULT NULL,
  p_video_url                TEXT    DEFAULT NULL,
  p_link_metadata            JSONB   DEFAULT NULL,
  p_wall_ghost_id            TEXT    DEFAULT NULL,
  p_mentioned_politician_ids UUID[]  DEFAULT NULL
) RETURNS public.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_country TEXT;
  v_banked BIGINT;
  v_live BIGINT;
  v_post public.posts;
BEGIN
  SELECT current_ghost_id, country, civic_score
    INTO v_ghost_id, v_country, v_banked
    FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  INSERT INTO public.posts (
    ghost_id, content, image_url, video_url, link_metadata,
    country, is_country, is_international, wall_ghost_id, civic_score_snapshot
  ) VALUES (
    v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata,
    v_country, true, true,
    COALESCE(p_wall_ghost_id, v_ghost_id::text),
    COALESCE(v_banked, 0) + COALESCE(v_live, 0)
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  PERFORM public.insert_post_mentions(v_post.id, p_mentioned_politician_ids);

  RETURN v_post;
END;
$$;

DROP FUNCTION IF EXISTS public.create_wall_post(TEXT, TEXT, TEXT, JSONB, TEXT);
GRANT EXECUTE ON FUNCTION public.create_wall_post(TEXT, TEXT, TEXT, JSONB, TEXT, UUID[]) TO authenticated;

-- CandidacyWall's composer creates posts via a direct table insert
-- (createCandidatePost in elections.ts -- a pre-existing, documented
-- divergence from create_post/create_wall_post, see SERVICES.md's "Known
-- intentional divergences"), so mentions there can't ride along inside one
-- RPC call the way they do above. This lets the client attach mentions as a
-- second step, but only onto a post it just created itself (the post's
-- ghost_id must match the caller's current ghost) -- can't be used to tag
-- mentions onto someone else's post.
CREATE OR REPLACE FUNCTION public.attach_post_mentions(p_post_id UUID, p_mentioned_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_post_ghost_id UUID;
BEGIN
  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();
  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT ghost_id INTO v_post_ghost_id FROM public.posts WHERE id = p_post_id;
  IF v_post_ghost_id IS NULL OR v_post_ghost_id <> v_ghost_id THEN
    RAISE EXCEPTION 'Cannot attach mentions to a post you do not own';
  END IF;

  PERFORM public.insert_post_mentions(p_post_id, p_mentioned_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_post_mentions(UUID, UUID[]) TO authenticated;
