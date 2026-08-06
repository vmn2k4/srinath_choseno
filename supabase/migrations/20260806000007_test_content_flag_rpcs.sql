-- Wire is_test through the write paths so newly created content keeps
-- carrying the flag going forward -- client passes p_is_test based on which
-- environment (dev vs prod) it's running in (see src/lib/utils/environment.ts).
-- Bodies are otherwise unchanged from 20260805000000_privacy_preserving_action_log.sql.

CREATE OR REPLACE FUNCTION public.create_post(
  p_content               TEXT,
  p_image_url             TEXT    DEFAULT NULL,
  p_video_url             TEXT    DEFAULT NULL,
  p_link_metadata         JSONB   DEFAULT NULL,
  p_election_candidate_id UUID    DEFAULT NULL,
  p_news_article_id       UUID    DEFAULT NULL,
  p_is_test               BOOLEAN DEFAULT false
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

  RETURN v_post;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_wall_post(
  p_content        TEXT,
  p_image_url      TEXT DEFAULT NULL,
  p_video_url      TEXT DEFAULT NULL,
  p_link_metadata  JSONB DEFAULT NULL,
  p_wall_ghost_id  TEXT DEFAULT NULL,
  p_is_test        BOOLEAN DEFAULT false
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

  RETURN v_post;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_comment(p_post_id UUID, p_content TEXT, p_is_test BOOLEAN DEFAULT false)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_wall_ghost_id TEXT;
  v_action_type TEXT;
  v_politician_id UUID := '00000000-0000-0000-0000-000000000000';
  v_daily_limit INT;
  v_today_count INT;
  v_comment public.comments;
BEGIN
  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT wall_ghost_id INTO v_wall_ghost_id FROM public.posts WHERE id = p_post_id;

  IF v_wall_ghost_id IS NOT NULL THEN
    v_action_type := 'comment_politician_wall';
    SELECT id INTO v_politician_id FROM public.profiles WHERE current_ghost_id = v_wall_ghost_id::uuid;
    v_politician_id := COALESCE(v_politician_id, '00000000-0000-0000-0000-000000000000');
  ELSE
    v_action_type := 'comment_news_feed';
  END IF;

  SELECT comment_daily_limit_per_target INTO v_daily_limit FROM public.site_settings WHERE id = 1;
  v_daily_limit := COALESCE(v_daily_limit, 1);

  SELECT action_count INTO v_today_count
  FROM public.user_actions
  WHERE user_id = auth.uid()
    AND action_type = v_action_type
    AND politician_id = v_politician_id
    AND action_date = (timezone('utc'::text, now()))::date;

  IF COALESCE(v_today_count, 0) >= v_daily_limit THEN
    RAISE EXCEPTION 'You have reached today''s comment limit for this target.';
  END IF;

  INSERT INTO public.comments (post_id, ghost_id, content, is_test)
  VALUES (p_post_id, v_ghost_id, p_content, p_is_test)
  RETURNING * INTO v_comment;

  PERFORM public.record_user_action(auth.uid(), v_action_type, v_politician_id);

  RETURN v_comment;
END;
$$;
