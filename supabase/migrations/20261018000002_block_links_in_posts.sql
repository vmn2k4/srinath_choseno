-- Reject posts/comments that link to a blocked domain (see blocked_domains).
-- Enforced in the RPCs so it can't be bypassed by skipping the link preview.
CREATE OR REPLACE FUNCTION public.assert_no_blocked_links(p_texts text[])
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text text;
  v_url text[];
BEGIN
  FOREACH v_text IN ARRAY p_texts LOOP
    CONTINUE WHEN v_text IS NULL;
    FOR v_url IN
      SELECT regexp_matches(v_text, '(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]|$|\s)', 'gi')
    LOOP
      IF public.is_domain_blocked(v_url[1]) THEN
        RAISE EXCEPTION 'Links to this kind of website are not allowed on Choseno (%).', lower(v_url[1]);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_no_blocked_links(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_no_blocked_links(text[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_comment(p_post_id uuid, p_content text, p_is_test boolean DEFAULT false)
 RETURNS comments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ghost_id UUID;
  v_wall_ghost_id TEXT;
  v_action_type TEXT;
  v_politician_id UUID := '00000000-0000-0000-0000-000000000000';
  v_daily_limit INT;
  v_today_count INT;
  v_comment public.comments;
BEGIN
  PERFORM public.assert_no_blocked_links(ARRAY[p_content]);

  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  IF NOT public.can_comment_on_post(p_post_id) THEN
    RAISE EXCEPTION 'Only people in this post''s area can join the conversation';
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
$function$;

CREATE OR REPLACE FUNCTION public.create_post(p_content text, p_image_url text DEFAULT NULL::text, p_video_url text DEFAULT NULL::text, p_link_metadata jsonb DEFAULT NULL::jsonb, p_election_candidate_id uuid DEFAULT NULL::uuid, p_news_article_id uuid DEFAULT NULL::uuid, p_is_test boolean DEFAULT false, p_mentioned_politician_ids uuid[] DEFAULT NULL::uuid[], p_boundary_ids bigint[] DEFAULT NULL::bigint[])
 RETURNS posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ghost_id UUID;
  v_country TEXT;
  v_banked BIGINT;
  v_live BIGINT;
  v_role TEXT;
  v_daily_limit INT;
  v_posts_today INT;
  v_post public.posts;
  v_boundary_count INT;
BEGIN
  PERFORM public.assert_no_blocked_links(ARRAY[p_content, p_video_url, p_link_metadata->>'url']);

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

  -- A chosen district the caller doesn't belong to is a client bug or abuse:
  -- refuse before inserting anything.
  IF p_boundary_ids IS NOT NULL AND cardinality(p_boundary_ids) > 0 THEN
    SELECT count(*) INTO v_boundary_count
      FROM public.user_boundary_memberships
     WHERE profile_id = auth.uid() AND map_shape_id = ANY(p_boundary_ids);
    IF v_boundary_count = 0 THEN
      RAISE EXCEPTION 'Choose at least one of your own districts to post to';
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
  SELECT v_post.id, map_shape_id
    FROM public.user_boundary_memberships
   WHERE profile_id = auth.uid()
     AND (p_boundary_ids IS NULL OR cardinality(p_boundary_ids) = 0
          OR map_shape_id = ANY(p_boundary_ids));

  PERFORM public.record_user_action(auth.uid(), 'post_news_feed');
  PERFORM public.insert_post_mentions(v_post.id, p_mentioned_politician_ids);

  RETURN v_post;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_wall_post(p_content text, p_image_url text DEFAULT NULL::text, p_video_url text DEFAULT NULL::text, p_link_metadata jsonb DEFAULT NULL::jsonb, p_wall_ghost_id text DEFAULT NULL::text, p_is_test boolean DEFAULT false, p_mentioned_politician_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ghost_id UUID;
  v_country TEXT;
  v_banked BIGINT;
  v_live BIGINT;
  v_target_ghost TEXT;
  v_politician_id UUID;
  v_post public.posts;
BEGIN
  PERFORM public.assert_no_blocked_links(ARRAY[p_content, p_video_url, p_link_metadata->>'url']);

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
$function$;

