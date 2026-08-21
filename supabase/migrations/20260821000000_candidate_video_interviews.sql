-- Candidate video interviews: question-level video + per-question answer
-- duration cap, and turning a video answer into a real wall post so it gets
-- the standard comment/like treatment (see docs/VIRTUAL_INTERVIEW_SYSTEM.md).
--
-- Deliberately additive only: every new column is nullable or has a safe
-- default, so every existing query, RLS policy, and RPC on election_questions
-- and posts keeps working unchanged. No existing column, policy, or function
-- is altered or dropped.

-- ── 1. Question-level video + per-question answer duration ────────────────
-- Mirrors election_candidate_answers.video_url (the candidate's answer) with
-- a video ON the question itself (played before the candidate answers).
-- max_answer_seconds replaces the currently-hardcoded 60s used in
-- CandidateApplicationClient.tsx with an admin-configurable, per-question
-- value; defaults to 30 to match the original product requirement.
ALTER TABLE public.election_questions
  ADD COLUMN question_video_url text,
  ADD COLUMN question_video_path text,
  ADD COLUMN max_answer_seconds int NOT NULL DEFAULT 30;

-- ── 2. A video answer is also a real wall post ─────────────────────────────
-- post_kind = 'answer_pitch' marks a post as a candidate's video answer to a
-- specific election question, distinct from a normal wall/feed post.
-- election_answer_id links it back to the source answer (nullable, and
-- ON DELETE SET NULL rather than CASCADE -- if an answer is ever deleted the
-- post shouldn't vanish along with its comments/likes, it just stops being
-- attributable to a specific question).
ALTER TABLE public.posts
  ADD COLUMN election_answer_id uuid REFERENCES public.election_candidate_answers(id) ON DELETE SET NULL,
  ADD COLUMN post_kind text NOT NULL DEFAULT 'standard'
    CHECK (post_kind IN ('standard', 'answer_pitch'));

-- One post per answer (retake replaces the linked post's video in place --
-- see upsert_answer_pitch_post below -- rather than accumulating a new post
-- per retake).
CREATE UNIQUE INDEX idx_posts_election_answer_id
  ON public.posts(election_answer_id)
  WHERE election_answer_id IS NOT NULL;

-- Powers the cross-candidate "swipe through every candidate's answer to this
-- question" carousel: given a question_id, find every answer_pitch post for
-- it in one query instead of joining through election_candidate_answers each
-- time.
CREATE INDEX idx_election_candidate_answers_question ON public.election_candidate_answers(question_id);

-- ── 3. upsert_answer_pitch_post(answer_id) ─────────────────────────────────
-- Called right after a candidate's video answer is saved
-- (election_candidate_answers.video_url set/changed). Creates the linked
-- post on first submission; on retake, updates that same post's video_url in
-- place and deliberately leaves its likes_count/dislikes_count and comments
-- untouched (confirmed product decision: retake replaces the video, not the
-- engagement history -- see docs/VIRTUAL_INTERVIEW_SYSTEM.md Gap 2).
--
-- Modeled directly on create_wall_post (20260804000009_create_wall_post_rpc.sql)
-- for the ghost_id-resolution and civic-score-snapshot shape, with one
-- deliberate difference: is_country/is_international are set to FALSE, not
-- TRUE. create_wall_post sets both true so a wall post also appears in the
-- main country/international feed; answer_pitch posts are scoped to the
-- candidate's wall and the question-comparison carousel only (both look the
-- post up via wall_ghost_id / election_answer_id, neither via
-- is_country/is_international), not the main feed -- see the "conservative
-- default" note in docs/VIRTUAL_INTERVIEW_SYSTEM.md's open questions. Flip
-- these two flags to true here if that scope is later widened.
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
    wall_ghost_id, election_answer_id, post_kind, civic_score_snapshot
  ) VALUES (
    v_ghost_id, '', v_answer.video_url, v_country, false, false,
    v_ghost_id::text, p_answer_id, 'answer_pitch',
    COALESCE(v_banked, 0) + COALESCE(v_live, 0)
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  RETURN v_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_answer_pitch_post(uuid) TO authenticated;
