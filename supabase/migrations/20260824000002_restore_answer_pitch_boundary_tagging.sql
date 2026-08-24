-- Correction to 20260824000001: dropping the post_boundaries insert there
-- was based on an incomplete read of the problem. It didn't just stop
-- individual answer_pitch posts from cluttering the local feed as 9 separate
-- full post cards (the actual bug) -- it also cut them out of
-- getMembershipScopedPosts entirely, which is an INNER JOIN on
-- post_boundaries. FeedPageClient's "Full Interview" story-strip grouping
-- (added the same session) reads its source data from that same query, so
-- removing the boundary rows made the grouped entry disappear rather than
-- consolidate: there was nothing left to group.
--
-- The actual fix belongs at the display layer, not the data layer: keep
-- these posts boundary-tagged so local constituents' feeds can surface them,
-- but FeedPageClient now explicitly filters post_kind = 'answer_pitch' out
-- of the scrollable post list and only uses it to build the single grouped
-- story-strip entry per candidate. Restore the insert this migration
-- corrects, and restore the boundary rows deleted by it.
CREATE OR REPLACE FUNCTION public.upsert_answer_pitch_post(p_answer_id uuid)
RETURNS public.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_answer public.election_candidate_answers;
  v_candidate public.election_candidates;
  v_ghost_id uuid;
  v_country text;
  v_banked bigint;
  v_live bigint;
  v_existing_post_id uuid;
  v_post public.posts;
BEGIN
  SELECT * INTO v_answer FROM public.election_candidate_answers WHERE id = p_answer_id;
  IF v_answer IS NULL THEN
    RAISE EXCEPTION 'Answer not found';
  END IF;
  IF v_answer.video_url IS NULL THEN
    RAISE EXCEPTION 'Answer has no video to post';
  END IF;

  SELECT * INTO v_candidate FROM public.election_candidates WHERE id = v_answer.candidate_id;
  IF v_candidate IS NULL OR v_candidate.politician_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not your answer';
  END IF;

  SELECT current_ghost_id, country, civic_score
    INTO v_ghost_id, v_country, v_banked
    FROM public.profiles WHERE id = auth.uid();
  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT id INTO v_existing_post_id FROM public.posts WHERE election_answer_id = p_answer_id;

  IF v_existing_post_id IS NOT NULL THEN
    UPDATE public.posts
    SET video_url = v_answer.video_url
    WHERE id = v_existing_post_id
    RETURNING * INTO v_post;
    RETURN v_post;
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  INSERT INTO public.posts (
    ghost_id, content, video_url, country, is_country, is_international,
    wall_ghost_id, election_answer_id, election_candidate_id, post_kind, civic_score_snapshot
  ) VALUES (
    v_ghost_id, '', v_answer.video_url, v_country, false, false,
    v_ghost_id::text, p_answer_id, v_answer.candidate_id, 'answer_pitch',
    COALESCE(v_banked, 0) + COALESCE(v_live, 0)
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  RETURN v_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_answer_pitch_post(uuid) TO authenticated;

-- Restore the boundary rows the previous migration deleted, for existing
-- answer_pitch posts, using each post's author's current boundary
-- memberships (mirrors what the RPC itself would have inserted).
INSERT INTO public.post_boundaries (post_id, map_shape_id)
SELECT p.id, ubm.map_shape_id
FROM public.posts p
JOIN public.profiles pr ON pr.current_ghost_id = p.ghost_id
JOIN public.user_boundary_memberships ubm ON ubm.profile_id = pr.id
WHERE p.post_kind = 'answer_pitch'
  AND NOT EXISTS (
    SELECT 1 FROM public.post_boundaries pb WHERE pb.post_id = p.id AND pb.map_shape_id = ubm.map_shape_id
  );
