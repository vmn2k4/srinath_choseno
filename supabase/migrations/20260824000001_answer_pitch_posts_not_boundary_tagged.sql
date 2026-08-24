-- upsert_answer_pitch_post's own comment already documents the intent:
-- "answer_pitch posts are scoped to the candidate's wall and the
-- question-comparison carousel only ... not the main feed" (is_country and
-- is_international are both set false specifically to keep them out of the
-- main/local feed). But the function ALSO inserted a post_boundaries row per
-- candidate boundary membership, which is what FeedPageClient's
-- getMembershipScopedPosts actually filters on -- is_country/is_international
-- never come into it. So every video-answer post was still landing in the
-- local feed and its "Politician Pitches" story strip as 9 separate full
-- posts, directly contradicting the function's own documented contract.
--
-- Drop that insert so a saved video answer stays scoped to the candidate's
-- wall + the per-question comparison carousel, as designed. Viewing the
-- whole interview as one continuous thing happens through PlayInterviewReel
-- (candidate wall's "Play Interview" button, the election seat page's
-- candidate strip), not by scattering every answer across the local feed.
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

  -- Deliberately no post_boundaries insert -- see comment above.

  RETURN v_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_answer_pitch_post(uuid) TO authenticated;

-- Clean up boundary rows already inserted for existing answer_pitch posts
-- (all created during this session's testing) so they stop appearing in the
-- local feed immediately, without waiting for a retake to re-run the RPC.
DELETE FROM public.post_boundaries
WHERE post_id IN (SELECT id FROM public.posts WHERE post_kind = 'answer_pitch');

-- Backfill election_candidate_id on existing answer_pitch posts (the
-- original insert predates this column being populated here) so the feed's
-- "group every answer into one Politician Pitches entry per candidate" logic
-- works immediately instead of only for future answers.
UPDATE public.posts p
SET election_candidate_id = a.candidate_id
FROM public.election_candidate_answers a
WHERE p.election_answer_id = a.id
  AND p.post_kind = 'answer_pitch'
  AND p.election_candidate_id IS NULL;
