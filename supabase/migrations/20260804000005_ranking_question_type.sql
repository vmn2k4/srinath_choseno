-- New "ranking" question_type: candidate orders every option from 1 (top
-- priority) to N (lowest), instead of rating a single issue on a fixed 1-5
-- scale. Reuses election_question_options for the option list (same as
-- single_choice/multiple_choice) and election_candidate_answer_options for
-- the candidate's chosen order, adding a `rank` column there to record each
-- option's position (1-indexed) instead of just membership.
ALTER TABLE public.election_questions
  DROP CONSTRAINT IF EXISTS election_questions_question_type_check;
ALTER TABLE public.election_questions
  ADD CONSTRAINT election_questions_question_type_check
    CHECK (question_type IN ('single_choice', 'multiple_choice', 'text', 'rating', 'ranking'));

ALTER TABLE public.election_candidate_answer_options
  ADD COLUMN rank int;

-- Prevents two options in the same answer from sharing a rank (only
-- meaningful for "ranking" answers -- multiple_choice rows leave rank null
-- and are unaffected since the partial index skips NULLs).
CREATE UNIQUE INDEX idx_election_candidate_answer_options_answer_rank
  ON public.election_candidate_answer_options(answer_id, rank)
  WHERE rank IS NOT NULL;

-- submit_candidate_application's required-question check needs a case for
-- "ranking": satisfied once every option for the question has been given a
-- rank (a partial ranking doesn't count, same spirit as multiple_choice
-- needing at least one selection). Based on the current body from
-- 20260802000003_fix_submit_auto_approve_regression.sql -- keeps the
-- status-guard bypass and auto-approve-on-submit logic that fix restored.
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
        WHEN 'ranking' THEN (
          SELECT count(*) FROM public.election_candidate_answer_options o
          WHERE o.answer_id = a.id AND o.rank IS NOT NULL
        ) = (
          SELECT count(*) FROM public.election_question_options opt WHERE opt.question_id = q.id
        )
        ELSE a.option_id IS NOT NULL
      END
    );

  IF v_missing_required > 0 THEN
    RAISE EXCEPTION 'Please answer all required questions before submitting';
  END IF;

  PERFORM set_config('app.bypass_candidate_status_guard', 'true', true);

  UPDATE public.election_candidates
  SET submitted_at = now(),
      status = CASE WHEN status = 'rejected' THEN status ELSE 'approved' END
  WHERE id = p_candidate_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
