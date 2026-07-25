-- apply_for_seat only accepted applications while an election's status was
-- exactly 'nominations_open' -- but 'active' (the status admins flip to so
-- voters can actually see the election and browse candidates) came right
-- after it in the lifecycle, so the moment an admin activated an election to
-- make it visible, nominations silently slammed shut, even with zero
-- candidates and the election date still in the future. Decouple "can a
-- politician still apply" from that manual admin toggle: nominations now
-- stay open through the election date itself, across both the
-- nominations_open and active statuses. Only 'draft' (not opened yet) and
-- 'closed' (or a past election_date) block new applications.
CREATE OR REPLACE FUNCTION public.apply_for_seat(p_seat_id uuid, p_statement text)
RETURNS public.election_candidates
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT;
  v_election_status TEXT;
  v_election_date DATE;
  v_row public.election_candidates;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'politician' THEN
    RAISE EXCEPTION 'Only politician accounts can apply to run';
  END IF;

  SELECT e.status, e.election_date INTO v_election_status, v_election_date
  FROM public.election_seats s
  JOIN public.elections e ON e.id = s.election_id
  WHERE s.id = p_seat_id;

  IF v_election_status IS NULL THEN
    RAISE EXCEPTION 'Seat not found';
  END IF;

  IF v_election_status NOT IN ('nominations_open', 'active') OR v_election_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'This election is not accepting candidates right now';
  END IF;

  INSERT INTO public.election_candidates (seat_id, politician_id, statement)
  VALUES (p_seat_id, auth.uid(), p_statement)
  ON CONFLICT (seat_id, politician_id) DO UPDATE SET statement = EXCLUDED.statement
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
