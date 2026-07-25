-- Turns candidacy into a real application/approval workflow instead of
-- "apply_for_seat = instantly an official candidate" (explicitly out of
-- scope when Election Mode first shipped -- now needed). No existing
-- election_candidates rows exist in this dataset, so no backfill is needed.
ALTER TABLE public.election_candidates
  ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN intro_video_url text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid REFERENCES public.profiles(id);

-- Candidate's per-question answer. One row per (candidate, question); the
-- option chosen plus optional free-text context when the admin allowed it.
CREATE TABLE public.election_candidate_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.election_questions(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.election_question_options(id),
  context_text text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, question_id)
);

CREATE INDEX idx_election_candidate_answers_candidate ON public.election_candidate_answers(candidate_id);

ALTER TABLE public.election_candidate_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates manage own answers"
  ON public.election_candidate_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.election_candidates ec WHERE ec.id = candidate_id AND ec.politician_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.election_candidates ec WHERE ec.id = candidate_id AND ec.politician_id = auth.uid()));

CREATE POLICY "Admins manage all candidate answers"
  ON public.election_candidate_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public reads visible answers for approved candidates"
  ON public.election_candidate_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.election_candidates ec
      JOIN public.election_questions q ON q.id = election_candidate_answers.question_id
      WHERE ec.id = candidate_id AND ec.status = 'approved' AND q.visible_to_public = true
    )
  );

-- election_candidates was readable by anyone once its election left draft,
-- regardless of application status -- that's no longer right now that
-- 'pending'/'rejected' are real, non-public states. Replace with:
-- approved candidates are public; a candidate always sees their own
-- application regardless of status; admins already see everything via their
-- existing "Admins manage candidates" FOR ALL policy.
DROP POLICY "Read candidates via parent election visibility" ON public.election_candidates;

CREATE POLICY "Public reads approved candidates"
  ON public.election_candidates FOR SELECT
  USING (
    status = 'approved' AND EXISTS (
      SELECT 1 FROM public.election_seats s JOIN public.elections e ON e.id = s.election_id
      WHERE s.id = election_candidates.seat_id AND e.status <> 'draft'
    )
  );

CREATE POLICY "Candidates read own application"
  ON public.election_candidates FOR SELECT
  USING (politician_id = auth.uid());

-- Validates the application is actually complete (every required question
-- answered, intro video present) before marking it submitted for admin
-- review -- called once, right before the candidate hits "Submit
-- Application"; editing after submission is still allowed (admin just
-- re-reviews), no need to lock the row.
CREATE OR REPLACE FUNCTION public.submit_candidate_application(p_candidate_id uuid)
RETURNS public.election_candidates
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_owner uuid;
  v_election_id uuid;
  v_intro_video text;
  v_missing_required int;
  v_row public.election_candidates;
BEGIN
  SELECT ec.politician_id, s.election_id, ec.intro_video_url
    INTO v_owner, v_election_id, v_intro_video
  FROM public.election_candidates ec
  JOIN public.election_seats s ON s.id = ec.seat_id
  WHERE ec.id = p_candidate_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not your application';
  END IF;
  IF v_intro_video IS NULL THEN
    RAISE EXCEPTION 'An introductory campaign video is required before submitting';
  END IF;

  SELECT count(*) INTO v_missing_required
  FROM public.election_questions q
  WHERE q.election_id = v_election_id
    AND q.required
    AND NOT EXISTS (
      SELECT 1 FROM public.election_candidate_answers a
      WHERE a.candidate_id = p_candidate_id AND a.question_id = q.id
    );

  IF v_missing_required > 0 THEN
    RAISE EXCEPTION 'Please answer all required questions before submitting';
  END IF;

  UPDATE public.election_candidates SET submitted_at = now() WHERE id = p_candidate_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
