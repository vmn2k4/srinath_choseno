-- Signup funnel tracking: captures exactly where a signup attempt drops,
-- something GA4 alone already proved unreliable for. Two independent things
-- exposed that gap this week: (1) GA4's `sign_up` event showed 0 for a day
-- Supabase's `profiles` table had 2 real new rows (event never fired or was
-- lost client-side), and (2) even on days it does fire, `sign_up` only
-- covers the success path -- someone who hits "email already registered",
-- a password rejection, or just closes the tab mid-form looks identical to
-- someone who never visited at all. This table is the reliable, detailed
-- side (same relationship client_error_logs already has to GA4's
-- error_occurred, see 20260826000000_client_error_logs.sql); GA4 keeps a
-- lightweight sign_up_failed/sign_up_abandoned event alongside this for
-- quick trend-watching, not as the source of truth.
--
-- Public-write / admin-read, identical shape and rationale to
-- client_error_logs: a failed or abandoned signup is definitionally a
-- signed-out visitor, so there's no auth.uid() to gate inserts on.

CREATE TABLE IF NOT EXISTS public.signup_funnel_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('failed', 'abandoned')),
  -- NULL for 'abandoned' (there's no error to name -- they just left).
  -- For 'failed': 'email_already_exists' | 'validation_error' | 'google_oauth_error' | 'unknown_error'.
  reason TEXT,
  message TEXT,             -- the raw Supabase/Auth error message, when there is one -- untruncated here (unlike GA4's 150-char cap)
  method TEXT NOT NULL CHECK (method IN ('email', 'google')),
  page TEXT NOT NULL,       -- pathname + search, e.g. "/auth?role=citizen&next=%2Felections%2Fseat%2Fxyz"
  referrer TEXT,
  user_agent TEXT,
  viewport TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_funnel_events_created_at ON public.signup_funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_funnel_events_type ON public.signup_funnel_events (event_type, created_at DESC);

ALTER TABLE public.signup_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage signup funnel events" ON public.signup_funnel_events
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- log_signup_funnel_event(): the only write path, SECURITY DEFINER to get
-- past the admin-only RLS above. Deliberately takes no identity, same
-- anonymity-model reasoning as log_client_error.
CREATE OR REPLACE FUNCTION public.log_signup_funnel_event(
  p_event_type TEXT,
  p_method TEXT,
  p_page TEXT,
  p_reason TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_viewport TEXT DEFAULT NULL,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.signup_funnel_events (
    event_type, reason, message, method, page, referrer, user_agent, viewport, is_test
  ) VALUES (
    p_event_type,
    p_reason,
    LEFT(p_message, 2000),
    p_method,
    LEFT(p_page, 500),
    LEFT(p_referrer, 500),
    LEFT(p_user_agent, 500),
    p_viewport,
    p_is_test
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_signup_funnel_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
