-- Removes the admin-approval gate for self-nomination: submitting an
-- application now makes a candidate immediately publicly visible, instead of
-- sitting invisible as status='pending' until a site admin manually approves
-- it in ElectionsAdmin.jsx. The status flip is conditional, not unconditional
-- -- CandidateApplication.jsx already lets a candidate edit and resubmit
-- after their first submission, and an unconditional "always set approved"
-- would silently undo an explicit site-admin rejection on the next resubmit.
--
-- Removing admin review also means nothing server-side stops a candidate
-- from directly setting their own row's status/reviewed_at/reviewed_by via a
-- plain client update (the existing "Candidates update own application" RLS
-- policy only checks politician_id, not which columns changed) -- bypassing
-- the video/questionnaire checklist this very function enforces entirely.
-- That gap already existed before this migration, but admin review was still
-- a backstop against it; now there is none, so it's closed here with a guard
-- trigger rather than left as a documented-but-deferred issue.
CREATE OR REPLACE FUNCTION public.guard_candidate_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
    IF NOT (
      current_setting('app.bypass_candidate_status_guard', true) = 'true'
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    ) THEN
      RAISE EXCEPTION 'Cannot modify candidate status directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER guard_candidate_status_change
  BEFORE UPDATE ON public.election_candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_candidate_status_change();

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

  PERFORM set_config('app.bypass_candidate_status_guard', 'true', true);

  UPDATE public.election_candidates
  SET submitted_at = now(),
      status = CASE WHEN status = 'rejected' THEN status ELSE 'approved' END
  WHERE id = p_candidate_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
