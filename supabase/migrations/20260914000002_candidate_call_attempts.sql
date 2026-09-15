-- Outbound candidate-outreach calling (xAI Grok Voice Agent + Twilio).
--
-- Mirrors the candidate_claim_invites tracking pattern
-- (20260911000000_candidate_claim_invite_tracking.sql) rather than inventing
-- a new authorization model: an election seat's approved administrator (or a
-- site admin) can place a call to a candidate, exactly who is already
-- allowed to send that candidate a claim/interview email invite via
-- is_claim_reviewer_for_candidate() (20260802000001_candidacy_claims.sql).
--
-- This table is call-metadata only. The actual call audio never touches
-- Supabase -- Twilio originates the PSTN call, a separate always-on bridge
-- service (voice-bridge/) relays audio between Twilio Media Streams and
-- xAI's realtime Voice Agent, and posts the final transcript/outcome back
-- to this app's /api/telephony/complete route once the call ends. That
-- route runs with the service-role key (same bypass-RLS pattern as
-- api/news/[slug]/og-image/route.ts) since the bridge has no user session
-- to authenticate as -- so writes to this table happen either as the
-- authenticated admin (placing the call) or via service role (recording
-- the outcome), never as an arbitrary anonymous caller.

CREATE TABLE public.candidate_call_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  seat_id uuid NOT NULL REFERENCES public.election_seats(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  -- Captured up front (same "on file or type it in" UX as
  -- SendInterviewInviteFlow's email field) so a positive call outcome can
  -- fire the EXISTING inviteCandidateToClaim() follow-up email without a
  -- second admin step. Deliberately optional: a call can still be logged
  -- without one, just without the auto-follow-up.
  email text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'canceled')),
  -- Set once the call ends, from the bridge's read of the conversation (or
  -- left null if the call never connected). Kept separate from `status`
  -- (call-mechanics) so "the call succeeded but they said no" and "the call
  -- never went through" aren't conflated.
  outcome text
    CHECK (outcome IS NULL OR outcome IN ('interested', 'not_interested', 'callback_requested', 'voicemail', 'wrong_number')),
  outcome_summary text,
  transcript text,
  recording_url text,
  -- Twilio's own Answering Machine Detection result ('human', 'machine_start',
  -- 'machine_end_beep', 'fax', etc. -- see calls.create's MachineDetection
  -- param in api/admin/calls/start/route.ts) -- a real-time signal from
  -- Twilio itself, distinct from and more reliable than outcome='voicemail'
  -- (which is the bridge's own after-the-fact transcript guess).
  answered_by text,
  twilio_call_sid text UNIQUE,
  duration_seconds integer,
  follow_up_email_sent_at timestamptz,
  error_message text,
  created_by uuid REFERENCES public.profiles(id),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidate_call_attempts_candidate ON public.candidate_call_attempts(candidate_id);
CREATE INDEX idx_candidate_call_attempts_seat ON public.candidate_call_attempts(seat_id);
CREATE INDEX idx_candidate_call_attempts_status ON public.candidate_call_attempts(status);

ALTER TABLE public.candidate_call_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Election admins and site admins manage call attempts for their seats"
  ON public.candidate_call_attempts FOR ALL
  USING (public.is_claim_reviewer_for_candidate(candidate_id))
  WITH CHECK (public.is_claim_reviewer_for_candidate(candidate_id));

CREATE OR REPLACE FUNCTION public.set_candidate_call_attempts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_candidate_call_attempts_updated_at
  BEFORE UPDATE ON public.candidate_call_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_candidate_call_attempts_updated_at();

-- Dashboard rollup for the admin "Calls" panel: every attempt this caller is
-- authorized to see (all of them for a site admin, only their approved
-- seats' candidates for an election admin), joined with the candidate name,
-- seat/jurisdiction label, and the SAME claim/registration signal the
-- existing "Invite Candidates to Claim" panel already reads
-- (election_candidates.claimed_at) -- not a new definition of "registered".
CREATE OR REPLACE FUNCTION public.list_candidate_call_attempts(p_seat_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  candidate_id uuid,
  seat_id uuid,
  candidate_name text,
  seat_role_title text,
  jurisdiction_name text,
  phone_number text,
  email text,
  status text,
  answered_by text,
  outcome text,
  outcome_summary text,
  transcript text,
  recording_url text,
  duration_seconds integer,
  follow_up_email_sent_at timestamptz,
  claimed_at timestamptz,
  error_message text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.candidate_id, a.seat_id,
    p.full_name AS candidate_name,
    es.role_title AS seat_role_title,
    ms.name AS jurisdiction_name,
    a.phone_number, a.email, a.status, a.answered_by, a.outcome, a.outcome_summary, a.transcript,
    a.recording_url, a.duration_seconds, a.follow_up_email_sent_at,
    ec.claimed_at, a.error_message, a.started_at, a.ended_at, a.created_at
  FROM public.candidate_call_attempts a
  JOIN public.election_candidates ec ON ec.id = a.candidate_id
  JOIN public.profiles p ON p.id = ec.politician_id
  JOIN public.election_seats es ON es.id = a.seat_id
  JOIN public.map_shapes ms ON ms.id = es.map_shape_id
  WHERE (p_seat_id IS NULL OR a.seat_id = p_seat_id)
    AND public.is_claim_reviewer_for_candidate(a.candidate_id)
  ORDER BY a.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_candidate_call_attempts(uuid) TO authenticated;

-- Read-only lookup for the TwiML webhook (api/telephony/voice) to
-- personalize the agent's opening line ("...congratulations on your run
-- for [office]..."). Deliberately NOT gated by is_claim_reviewer_for_candidate
-- -- that check is about who may CONTACT the candidate (already enforced
-- once, at api/admin/calls/start, before the call was ever placed), not
-- about who may read a candidate's name and the public office they're
-- running for, which is the same information already shown on that seat's
-- public page. Called with the service-role key (no auth.uid() available --
-- Twilio's webhook has no Supabase session), so it can't depend on that
-- check anyway.
CREATE OR REPLACE FUNCTION public.get_call_attempt_context(p_attempt_id uuid)
RETURNS TABLE (candidate_name text, seat_role_title text, jurisdiction_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.full_name, es.role_title, ms.name
  FROM public.candidate_call_attempts a
  JOIN public.election_candidates ec ON ec.id = a.candidate_id
  JOIN public.profiles p ON p.id = ec.politician_id
  JOIN public.election_seats es ON es.id = a.seat_id
  JOIN public.map_shapes ms ON ms.id = es.map_shape_id
  WHERE a.id = p_attempt_id;
END;
$function$;
