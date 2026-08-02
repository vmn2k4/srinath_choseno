-- Generalizes the candidate questionnaire beyond single-choice: a question
-- can now be single_choice (existing behaviour), multiple_choice (pick any
-- number of options), text (free-form written answer), or rating (a fixed
-- 1-5 scale, e.g. "rate this issue's priority"). allow_context/video_url
-- stay available on every type -- they're "elaborate further", independent
-- of how the primary answer itself is captured.
ALTER TABLE public.election_questions
  ADD COLUMN question_type text NOT NULL DEFAULT 'single_choice'
    CHECK (question_type IN ('single_choice', 'multiple_choice', 'text', 'rating'));

-- option_id only applies to single_choice now (multiple_choice answers live
-- in the new junction table below; text/rating answers use their own
-- columns) -- so it can no longer be NOT NULL.
ALTER TABLE public.election_candidate_answers
  ALTER COLUMN option_id DROP NOT NULL,
  ADD COLUMN text_answer text,
  ADD COLUMN rating_value int;

-- One row per selected option, for multiple_choice questions. Every
-- election_candidate_answers row still exists 1:1 per (candidate, question)
-- regardless of type (so context_text/video_url and the "required question
-- answered" check keep working the same way); this table just holds the set
-- of options chosen when the question allows more than one.
CREATE TABLE public.election_candidate_answer_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL REFERENCES public.election_candidate_answers(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.election_question_options(id) ON DELETE CASCADE,
  UNIQUE (answer_id, option_id)
);

CREATE INDEX idx_election_candidate_answer_options_answer ON public.election_candidate_answer_options(answer_id);

ALTER TABLE public.election_candidate_answer_options ENABLE ROW LEVEL SECURITY;

-- Same three-policy shape as election_candidate_answers itself
-- (20260729000002_candidate_applications.sql), just joined through the
-- parent answer row instead of directly.
CREATE POLICY "Candidates manage own answer options"
  ON public.election_candidate_answer_options FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.election_candidate_answers a
    JOIN public.election_candidates ec ON ec.id = a.candidate_id
    WHERE a.id = answer_id AND ec.politician_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.election_candidate_answers a
    JOIN public.election_candidates ec ON ec.id = a.candidate_id
    WHERE a.id = answer_id AND ec.politician_id = auth.uid()
  ));

CREATE POLICY "Admins manage all answer options"
  ON public.election_candidate_answer_options FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public reads visible answer options"
  ON public.election_candidate_answer_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.election_candidate_answers a
    JOIN public.election_candidates ec ON ec.id = a.candidate_id
    JOIN public.election_questions q ON q.id = a.question_id
    WHERE a.id = answer_id AND ec.status = 'approved' AND q.visible_to_public = true
  ));

-- submit_candidate_application's "missing required" check previously just
-- checked an election_candidate_answers row existed. That's no longer
-- enough on its own: a multiple_choice question could have a row with zero
-- selected options (e.g. all checkboxes toggled back off), and a text
-- question could have a row with an empty string. Made type-aware instead.
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
  LEFT JOIN public.election_candidate_answers a
    ON a.question_id = q.id AND a.candidate_id = p_candidate_id
  WHERE q.election_id = v_election_id
    AND q.required
    AND NOT (
      CASE q.question_type
        WHEN 'text' THEN a.text_answer IS NOT NULL AND btrim(a.text_answer) <> ''
        WHEN 'rating' THEN a.rating_value IS NOT NULL
        WHEN 'multiple_choice' THEN EXISTS (
          SELECT 1 FROM public.election_candidate_answer_options o WHERE o.answer_id = a.id
        )
        ELSE a.option_id IS NOT NULL
      END
    );

  IF v_missing_required > 0 THEN
    RAISE EXCEPTION 'Please answer all required questions before submitting';
  END IF;

  UPDATE public.election_candidates SET submitted_at = now() WHERE id = p_candidate_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
