-- Feed conversations are local: only people who belong to one of the post's
-- districts can comment on it; everyone else can still read the thread.
--
-- Exempt (unchanged behaviour): wall posts (wall_ghost_id), candidacy posts
-- (election_candidate_id), news posts (news_article_id), and any post with no
-- district rows. The post's own author and admins can always comment.
--
-- can_comment_on_post() is exposed so the web and mobile UIs can show "only
-- people in <area> can join the conversation" instead of failing on submit;
-- create_comment() enforces the same rule, since client checks can be bypassed.

CREATE OR REPLACE FUNCTION public.can_comment_on_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.posts;
  v_ghost UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_post FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Not a district-scoped feed post: no locality rule.
  IF v_post.wall_ghost_id IS NOT NULL
     OR v_post.election_candidate_id IS NOT NULL
     OR v_post.news_article_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.post_boundaries WHERE post_id = p_post_id) THEN
    RETURN true;
  END IF;

  SELECT current_ghost_id, role INTO v_ghost, v_role
    FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'admin' OR v_ghost IS NOT DISTINCT FROM v_post.ghost_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.post_boundaries pb
      JOIN public.user_boundary_memberships m
        ON m.map_shape_id = pb.map_shape_id AND m.profile_id = auth.uid()
     WHERE pb.post_id = p_post_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_comment_on_post(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_comment(
  p_post_id UUID,
  p_content TEXT,
  p_is_test BOOLEAN DEFAULT false
) RETURNS public.comments
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
$$;
