-- Politicians can only post once per day to the main feed (this limit does
-- NOT apply to Wall/Candidacy posting -- see create_wall_post() in the next
-- migration, a deliberately separate, unlimited flow). Normal users are
-- unaffected. Same signature/body as news_platform.sql's create_post(),
-- with the daily-limit check added before the insert.
CREATE OR REPLACE FUNCTION public.create_post(
  p_content               TEXT,
  p_image_url             TEXT    DEFAULT NULL,
  p_video_url             TEXT    DEFAULT NULL,
  p_link_metadata         JSONB   DEFAULT NULL,
  p_election_candidate_id UUID    DEFAULT NULL,
  p_news_article_id       UUID    DEFAULT NULL
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

  RETURN v_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID) TO authenticated;
