-- 20260802000000_flexible_questionnaire.sql's CREATE OR REPLACE of
-- submit_candidate_application dropped two things it shouldn't have: the
-- app.bypass_candidate_status_guard bypass and the "approve on submit"
-- status flip from 20260729000009_fix_submit_candidate_application.sql,
-- silently reverting §21's no-admin-approval-gate behaviour back to
-- everything sitting at 'pending' forever. Found live: after submitting a
-- test application through the real UI, ElectionsAdmin showed it as
-- "pending" instead of "approved". Restores that logic, keeping the
-- type-aware required-question check from the flexible-questionnaire change.
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

  PERFORM set_config('app.bypass_candidate_status_guard', 'true', true);

  UPDATE public.election_candidates
  SET submitted_at = now(),
      status = CASE WHEN status = 'rejected' THEN status ELSE 'approved' END
  WHERE id = p_candidate_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
