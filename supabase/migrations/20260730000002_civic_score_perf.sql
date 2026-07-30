-- calculate_my_score() and burn_ghost_identity() filter posts/comments by
-- ghost_id on every call, but neither column had an index -- every call
-- was a full sequential scan of both tables, getting linearly more
-- expensive as they grow. Add the missing indexes, and collapse the
-- previous two separate posts subqueries (one for count, one for the vote
-- sum) into a single pass per table.
CREATE INDEX IF NOT EXISTS idx_posts_ghost_id ON public.posts(ghost_id);
CREATE INDEX IF NOT EXISTS idx_comments_ghost_id ON public.comments(ghost_id);

CREATE OR REPLACE FUNCTION public.calculate_my_score()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_banked BIGINT;
  v_post_count BIGINT;
  v_net_votes BIGINT;
  v_comment_count BIGINT;
BEGIN
  SELECT current_ghost_id, civic_score INTO v_ghost_id, v_banked
  FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RETURN COALESCE(v_banked, 0);
  END IF;

  SELECT count(*), COALESCE(sum(likes_count) - sum(dislikes_count), 0)
  INTO v_post_count, v_net_votes
  FROM public.posts WHERE ghost_id = v_ghost_id;

  SELECT count(*) INTO v_comment_count
  FROM public.comments WHERE ghost_id = v_ghost_id;

  RETURN COALESCE(v_banked, 0) + v_post_count * 10 + v_comment_count * 5 + v_net_votes;
END;
$$;

CREATE OR REPLACE FUNCTION public.burn_ghost_identity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_post_count BIGINT;
  v_net_votes BIGINT;
  v_comment_count BIGINT;
BEGIN
  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();

  SELECT count(*), COALESCE(sum(likes_count) - sum(dislikes_count), 0)
  INTO v_post_count, v_net_votes
  FROM public.posts WHERE ghost_id = v_ghost_id;

  SELECT count(*) INTO v_comment_count
  FROM public.comments WHERE ghost_id = v_ghost_id;

  UPDATE public.profiles
  SET civic_score = civic_score + (v_post_count * 10 + v_comment_count * 5 + v_net_votes),
      current_ghost_id = gen_random_uuid(),
      updated_at = timezone('utc'::text, now())
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_my_score() TO authenticated;
GRANT EXECUTE ON FUNCTION public.burn_ghost_identity() TO authenticated;
