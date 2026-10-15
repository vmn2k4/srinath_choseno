-- Let the poster choose which of their districts a feed post goes to.
-- Previously create_post copied EVERY user_boundary_memberships row into
-- post_boundaries; now an optional p_boundary_ids narrows that to the chosen
-- ones (still limited to districts the caller actually belongs to, so it can't
-- be used to post into someone else's district). NULL / empty keeps the old
-- "all my districts" behaviour, so existing callers are unaffected.
--
-- The old 8-argument overload is dropped first: leaving it next to the new
-- 9-argument one would give PostgREST two candidates (the trap this codebase
-- has hit before — see 20260804000003, 20260806000008, 20260815000003).

DROP FUNCTION IF EXISTS public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID, BOOLEAN, UUID[]);

CREATE OR REPLACE FUNCTION public.create_post(
  p_content                  TEXT,
  p_image_url                TEXT    DEFAULT NULL,
  p_video_url                TEXT    DEFAULT NULL,
  p_link_metadata            JSONB   DEFAULT NULL,
  p_election_candidate_id    UUID    DEFAULT NULL,
  p_news_article_id          UUID    DEFAULT NULL,
  p_is_test                  BOOLEAN DEFAULT false,
  p_mentioned_politician_ids UUID[]  DEFAULT NULL,
  p_boundary_ids             BIGINT[] DEFAULT NULL
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
  v_boundary_count INT;
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
$$;

GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID, BOOLEAN, UUID[], BIGINT[]) TO authenticated;
