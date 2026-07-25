-- Election Administrators: a citizen or politician can volunteer to moderate
-- one specific seat (e.g. "Councillor -- South Surrey"), and once approved,
-- gains the ability to add candidates who aren't registered on the platform
-- (see 20260729000008_unregistered_candidates.sql). This is additive to
-- their existing role -- they keep their normal citizen/politician feed,
-- this is a permission grant, not a profiles.role value.
CREATE TABLE public.election_administrators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id uuid NOT NULL REFERENCES public.election_seats(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  motivation text,
  social_media_info text,
  contact_email text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  UNIQUE (seat_id, profile_id)
);

CREATE INDEX idx_election_administrators_seat ON public.election_administrators(seat_id);

-- Hard DB invariant, not just application logic: only one seat can ever be
-- 'approved' at a time. Backstops any race between the lazy promotion sweep
-- and an explicit site-admin review happening close together.
CREATE UNIQUE INDEX idx_election_administrators_one_approved_per_seat
  ON public.election_administrators(seat_id) WHERE status = 'approved';

ALTER TABLE public.election_administrators ENABLE ROW LEVEL SECURITY;

-- No public SELECT -- motivation/contact_email/social_media_info are real
-- PII and don't need to be world-readable. get_seat_admin_status() below is
-- how the frontend checks "does this seat already have an admin" without
-- exposing those columns.
CREATE POLICY "Users manage own election admin applications"
  ON public.election_administrators FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Admins manage all election admin applications"
  ON public.election_administrators FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Internal sweep, not itself a client-facing action. Promotes the oldest
-- still-pending application for a seat once it's older than the delay
-- window below, and only if that seat has no approved admin yet. Called
-- from the top of every RPC below that reads/acts on this table, so state
-- is always correct by the time it matters -- no pg_cron needed.
CREATE OR REPLACE FUNCTION public.promote_expired_election_admin_applications(p_seat_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  c_delay CONSTANT interval := interval '48 hours';
BEGIN
  UPDATE public.election_administrators ea
  SET status = 'approved', reviewed_at = now()
  WHERE ea.status = 'pending'
    AND ea.submitted_at < now() - c_delay
    AND (p_seat_id IS NULL OR ea.seat_id = p_seat_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.election_administrators ea2
      WHERE ea2.seat_id = ea.seat_id AND ea2.status = 'approved'
    )
    AND ea.id = (
      SELECT id FROM public.election_administrators ea3
      WHERE ea3.seat_id = ea.seat_id AND ea3.status = 'pending'
      ORDER BY ea3.submitted_at ASC LIMIT 1
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_for_election_admin(
  p_seat_id uuid, p_motivation text, p_social_media_info text, p_contact_email text
)
RETURNS public.election_administrators
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_existing_status text;
  v_row public.election_administrators;
BEGIN
  PERFORM public.promote_expired_election_admin_applications(p_seat_id);

  IF p_contact_email IS NULL OR p_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please provide a valid contact email';
  END IF;

  SELECT status INTO v_existing_status
  FROM public.election_administrators WHERE seat_id = p_seat_id AND profile_id = auth.uid();

  IF v_existing_status = 'rejected' THEN
    RAISE EXCEPTION 'Your application for this seat was not approved. Contact a site administrator if you believe this is a mistake.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.election_administrators
    WHERE seat_id = p_seat_id AND status = 'approved' AND profile_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'This seat already has an election administrator';
  END IF;

  INSERT INTO public.election_administrators (seat_id, profile_id, motivation, social_media_info, contact_email, status, submitted_at)
  VALUES (p_seat_id, auth.uid(), p_motivation, p_social_media_info, p_contact_email, 'pending', now())
  ON CONFLICT (seat_id, profile_id) DO UPDATE SET
    motivation = EXCLUDED.motivation,
    social_media_info = EXCLUDED.social_media_info,
    contact_email = EXCLUDED.contact_email,
    submitted_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_seat_admin_status(p_seat_id uuid)
RETURNS TABLE(has_approved_admin boolean, my_application_status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public.promote_expired_election_admin_applications(p_seat_id);
  RETURN QUERY
  SELECT
    EXISTS(SELECT 1 FROM public.election_administrators WHERE seat_id = p_seat_id AND status = 'approved'),
    (SELECT status FROM public.election_administrators WHERE seat_id = p_seat_id AND profile_id = auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_election_admin_application(p_application_id uuid, p_approve boolean)
RETURNS public.election_administrators
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role text;
  v_seat_id uuid;
  v_row public.election_administrators;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only site administrators can review these applications';
  END IF;

  SELECT seat_id INTO v_seat_id FROM public.election_administrators WHERE id = p_application_id;
  IF v_seat_id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.election_administrators
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_application_id
  RETURNING * INTO v_row;

  -- Only one admin per seat -- approving one rejects any other still-pending
  -- applicants for the same seat.
  IF p_approve THEN
    UPDATE public.election_administrators
    SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    WHERE seat_id = v_seat_id AND id <> p_application_id AND status = 'pending';
  END IF;

  RETURN v_row;
END;
$function$;
