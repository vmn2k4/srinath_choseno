-- Corrective follow-up to 20260815000002_post_mentions.sql, applied within
-- the same session. That migration based create_post/create_wall_post's
-- bodies on the versions documented in SERVICES.md/politician_daily_post_
-- limit.sql, which turned out to be stale -- the actual live functions (per
-- pg_get_functiondef, checked directly against the database) also carry a
-- p_is_test parameter (20260806000007), a configurable per-day limit read
-- from site_settings instead of a hardcoded "once a day" (a later,
-- undocumented change), and a public.record_user_action() call
-- (20260805000000_privacy_preserving_action_log.sql). Re-running the
-- previous migration's CREATE OR REPLACE therefore didn't replace the live
-- function at all -- since the arg list differed (no p_is_test), Postgres
-- created a second, incomplete overload instead, exactly the
-- "two-overloads-confuses-PostgREST" trap this codebase has hit and fixed
-- twice before (20260804000003, 20260806000008). Same fix pattern here:
-- drop both stray overloads explicitly, recreate one function carrying
-- every real live parameter plus p_mentioned_politician_ids.

DROP FUNCTION IF EXISTS public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID[]);
DROP FUNCTION IF EXISTS public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.create_post(
  p_content                  TEXT,
  p_image_url                TEXT    DEFAULT NULL,
  p_video_url                TEXT    DEFAULT NULL,
  p_link_metadata            JSONB   DEFAULT NULL,
  p_election_candidate_id    UUID    DEFAULT NULL,
  p_news_article_id          UUID    DEFAULT NULL,
  p_is_test                  BOOLEAN DEFAULT false,
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
  v_daily_limit INT;
  v_posts_today INT;
  v_post public.posts;
BEGIN
  SELECT current_ghost_id, country, civic_score, role
    INTO v_ghost_id, v_country, v_banked, v_role
    FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  IF v_role = 'politician' THEN
    SELECT politician_daily_post_limit INTO v_daily_limit FROM public.site_settings WHERE id = 1;
    v_daily_limit := COALESCE(v_daily_limit, 1);

    SELECT count(*) INTO v_posts_today
    FROM public.posts
    WHERE ghost_id = v_ghost_id
      AND created_at::date = (now() AT TIME ZONE 'utc')::date;

    IF v_posts_today >= v_daily_limit THEN
      RAISE EXCEPTION 'Politicians can only post % time(s) per day', v_daily_limit;
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
    election_candidate_id, news_article_id, civic_score_snapshot, is_test
  ) VALUES (
    v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata,
    v_country, true, true,
    p_election_candidate_id, p_news_article_id,
    COALESCE(v_banked, 0) + COALESCE(v_live, 0), p_is_test
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  PERFORM public.record_user_action(auth.uid(), 'post_news_feed');
  PERFORM public.insert_post_mentions(v_post.id, p_mentioned_politician_ids);

  RETURN v_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID, BOOLEAN, UUID[]) TO authenticated;

DROP FUNCTION IF EXISTS public.create_wall_post(TEXT, TEXT, TEXT, JSONB, TEXT, UUID[]);
DROP FUNCTION IF EXISTS public.create_wall_post(TEXT, TEXT, TEXT, JSONB, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.create_wall_post(
  p_content                  TEXT,
  p_image_url                TEXT    DEFAULT NULL,
  p_video_url                TEXT    DEFAULT NULL,
  p_link_metadata            JSONB   DEFAULT NULL,
  p_wall_ghost_id            TEXT    DEFAULT NULL,
  p_is_test                  BOOLEAN DEFAULT false,
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
  v_target_ghost TEXT;
  v_politician_id UUID;
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

  v_target_ghost := COALESCE(p_wall_ghost_id, v_ghost_id::text);

  INSERT INTO public.posts (
    ghost_id, content, image_url, video_url, link_metadata,
    country, is_country, is_international, wall_ghost_id, civic_score_snapshot, is_test
  ) VALUES (
    v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata,
    v_country, true, true,
    v_target_ghost,
    COALESCE(v_banked, 0) + COALESCE(v_live, 0), p_is_test
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  SELECT id INTO v_politician_id FROM public.profiles WHERE current_ghost_id = v_target_ghost::uuid;
  PERFORM public.record_user_action(auth.uid(), 'post_politician_wall', COALESCE(v_politician_id, '00000000-0000-0000-0000-000000000000'));
  PERFORM public.insert_post_mentions(v_post.id, p_mentioned_politician_ids);

  RETURN v_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_wall_post(TEXT, TEXT, TEXT, JSONB, TEXT, BOOLEAN, UUID[]) TO authenticated;
