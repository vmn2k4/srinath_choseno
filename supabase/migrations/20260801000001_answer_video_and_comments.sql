-- Per-question video: a candidate can optionally attach a short video to
-- their answer for a specific question, independent of the admin's
-- allow_context toggle (that one only governs the written-context field) and
-- distinct from intro_video_url (which covers the whole application, not a
-- single question).
ALTER TABLE public.election_candidate_answers ADD COLUMN video_url text;

-- Public discussion thread on one candidate's answer to one question --
-- lets voters question/discuss a candidate's specific stance, separate from
-- the general CandidacyWall post feed. Same shape and RLS posture as the
-- existing public.comments table (20260721000000_init_schema.sql), scoped
-- to an answer instead of a post.
CREATE TABLE public.election_answer_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL REFERENCES public.election_candidate_answers(id) ON DELETE CASCADE,
  ghost_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_election_answer_comments_answer ON public.election_answer_comments(answer_id);

ALTER TABLE public.election_answer_comments ENABLE ROW LEVEL SECURITY;

-- Readable under the same condition the answer itself is publicly visible
-- under ("Public reads visible answers for approved candidates" in
-- 20260729000002_candidate_applications.sql), plus the answer's own owner
-- (who can always see their own answer regardless of visible_to_public, same
-- as "Candidates manage own answers") and admins.
CREATE POLICY "Read answer comments where the answer is visible"
  ON public.election_answer_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.election_candidate_answers a
      JOIN public.election_candidates ec ON ec.id = a.candidate_id
      JOIN public.election_questions q ON q.id = a.question_id
      WHERE a.id = election_answer_comments.answer_id
        AND (
          (ec.status = 'approved' AND q.visible_to_public = true)
          OR ec.politician_id = auth.uid()
        )
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can comment where the answer is visible"
  ON public.election_answer_comments FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.election_candidate_answers a
      JOIN public.election_candidates ec ON ec.id = a.candidate_id
      JOIN public.election_questions q ON q.id = a.question_id
      WHERE a.id = election_answer_comments.answer_id
        AND ec.status = 'approved' AND q.visible_to_public = true
    )
  );
