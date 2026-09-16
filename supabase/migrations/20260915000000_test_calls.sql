-- Lets a site admin place a bare test call -- just a phone number, no
-- candidate/seat attached -- to verify the Twilio/xAI/voice-bridge chain
-- actually works before ever dialing a real candidate. Distinct from (and
-- much simpler than) the real candidate-call flow in
-- 20260914000002_candidate_call_attempts.sql, which this builds on rather
-- than duplicating.

ALTER TABLE public.candidate_call_attempts
  ALTER COLUMN candidate_id DROP NOT NULL,
  ALTER COLUMN seat_id DROP NOT NULL,
  ADD COLUMN is_test boolean NOT NULL DEFAULT false;

-- Data-integrity guardrail: a row is either a real, fully-linked candidate
-- call, or an explicitly-flagged test call with nothing attached -- never
-- a row that's ambiguously in between (e.g. is_test=false with a null
-- candidate_id, which would silently break every join that assumes a real
-- call always has one).
ALTER TABLE public.candidate_call_attempts
  ADD CONSTRAINT candidate_call_attempts_test_or_linked CHECK (
    (is_test = false AND candidate_id IS NOT NULL AND seat_id IS NOT NULL)
    OR
    (is_test = true AND candidate_id IS NULL AND seat_id IS NULL)
  );

-- No RLS policy change needed: the existing policy's
-- is_claim_reviewer_for_candidate(candidate_id) already returns true for a
-- site admin regardless of candidate_id (it short-circuits on
-- profiles.role = 'admin' before ever looking at candidate_id), and test
-- calls are only ever placed by a site admin -- the only role that can see
-- /admin/calls at all (src/app/admin/layout.tsx). A non-admin election
-- administrator passing a null candidate_id would correctly still be
-- rejected (the function's seat lookup finds nothing to check them
-- against), matching the intent that test calls are a site-admin-only
-- tool.

-- Re-point the dashboard rollup at the wider set of columns and switch its
-- joins to LEFT JOIN -- a test call has no candidate/seat row to join
-- against, and should still show up (as "Test Call", not silently
-- dropped). Return-column list changed (added is_test), so this needs a
-- DROP first -- CREATE OR REPLACE can't add columns to a TABLE return type.
DROP FUNCTION IF EXISTS public.list_candidate_call_attempts(uuid);

CREATE OR REPLACE FUNCTION public.list_candidate_call_attempts(p_seat_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  candidate_id uuid,
  seat_id uuid,
  is_test boolean,
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
    a.id, a.candidate_id, a.seat_id, a.is_test,
    p.full_name AS candidate_name,
    es.role_title AS seat_role_title,
    ms.name AS jurisdiction_name,
    a.phone_number, a.email, a.status, a.answered_by, a.outcome, a.outcome_summary, a.transcript,
    a.recording_url, a.duration_seconds, a.follow_up_email_sent_at,
    ec.claimed_at, a.error_message, a.started_at, a.ended_at, a.created_at
  FROM public.candidate_call_attempts a
  LEFT JOIN public.election_candidates ec ON ec.id = a.candidate_id
  LEFT JOIN public.profiles p ON p.id = ec.politician_id
  LEFT JOIN public.election_seats es ON es.id = a.seat_id
  LEFT JOIN public.map_shapes ms ON ms.id = es.map_shape_id
  WHERE (p_seat_id IS NULL OR a.seat_id = p_seat_id)
    -- Test calls have no candidate_id to authorize against -- gate them on
    -- plain site-admin status directly instead of falling through
    -- is_claim_reviewer_for_candidate(NULL), which is equivalent here but
    -- less clear to read.
    --
    -- The subquery's columns must be explicitly aliased/qualified (prof.id,
    -- prof.role) -- this function's RETURNS TABLE(id uuid, ...) puts a
    -- PL/pgSQL variable named `id` in scope for the whole function body, so
    -- a bare `WHERE id = auth.uid()` is genuinely ambiguous (variable vs.
    -- profiles.id) and errors at runtime, not at CREATE FUNCTION time --
    -- found live via a real "column reference \"id\" is ambiguous" once
    -- test calls actually started hitting this branch.
    AND (
      (a.is_test AND EXISTS (SELECT 1 FROM public.profiles prof WHERE prof.id = auth.uid() AND prof.role = 'admin'))
      OR (NOT a.is_test AND public.is_claim_reviewer_for_candidate(a.candidate_id))
    )
  ORDER BY a.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_candidate_call_attempts(uuid) TO authenticated;
