-- Lets a platform admin or the seat's approved election administrator attach
-- an intro video to any candidate on the seat (e.g. an admin-added,
-- unclaimed candidate who can't record one themselves). Writes the same
-- election_candidates.intro_video_url column the candidate's own
-- CandidateApplicationClient flow writes, so it shows everywhere that does.
-- Needs an RPC because "Candidates update own application" RLS only lets the
-- candidate themselves update the row.
CREATE OR REPLACE FUNCTION public.set_candidate_intro_video(p_candidate_id uuid, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_seat_id uuid;
BEGIN
  SELECT seat_id INTO v_seat_id FROM public.election_candidates WHERE id = p_candidate_id;

  IF v_seat_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.election_administrators
    WHERE seat_id = v_seat_id AND profile_id = auth.uid() AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'You are not an approved election administrator for this seat';
  END IF;

  UPDATE public.election_candidates SET intro_video_url = p_url WHERE id = p_candidate_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_candidate_intro_video(uuid, text) TO authenticated;
