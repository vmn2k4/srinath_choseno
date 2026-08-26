-- Client-side error logging: captures the full detail GA4's error_occurred
-- event can't (GA4 truncates message to 150 chars client-side before it's
-- even sent, has no stack-trace field, and its event params were never
-- registered as GA4 custom dimensions -- so error_type/message aren't even
-- queryable there today). This table is the source of truth for "what broke
-- and why"; GA4 stays as-is for the aggregate volume/trend view alongside
-- everything else in Analytics.
--
-- Public-write / admin-read, same shape as content_reports in
-- 20260804000007_moderation_system.sql: errors happen for signed-out
-- visitors too, so there's no auth.uid() to gate on for inserts -- the
-- log_client_error() RPC is the only write path, granted to anon +
-- authenticated. Reads/updates (marking something resolved once fixed) go
-- through the standard admin-role ALL policy, no separate RPC needed.

CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type TEXT NOT NULL CHECK (error_type IN ('uncaught_exception', 'unhandled_rejection', 'render_exception')),
  message TEXT NOT NULL,
  stack TEXT,
  digest TEXT,              -- Next.js error boundary's error.digest, for render_exception -- correlates to the matching server-side log line
  page TEXT NOT NULL,       -- pathname + search, e.g. "/elections/seat/xyz?tab=candidates"
  referrer TEXT,
  user_agent TEXT,
  viewport TEXT,            -- "<width>x<height>" at time of error
  is_test BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolution_note TEXT,     -- what the fix was / why it was dismissed, filled in once diagnosed
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_created_at ON public.client_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_unresolved ON public.client_error_logs (resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_client_error_logs_page ON public.client_error_logs (page);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client error logs" ON public.client_error_logs
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- log_client_error(): the only way a browser (signed in or not) can write a
-- row. SECURITY DEFINER to get past the admin-only RLS above; deliberately
-- takes no identity -- matches the app's anonymity model (no ghost_id/user
-- link here, same as GA4 today) and keeps this from becoming a second,
-- easier-to-query de-anonymization path. LEFT()-capped so a pathological
-- error (e.g. a stack trace in a tight throw loop) can't grow a row past a
-- sane bound.
CREATE OR REPLACE FUNCTION public.log_client_error(
  p_error_type TEXT,
  p_message TEXT,
  p_page TEXT,
  p_stack TEXT DEFAULT NULL,
  p_digest TEXT DEFAULT NULL,
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
  INSERT INTO public.client_error_logs (
    error_type, message, stack, digest, page, referrer, user_agent, viewport, is_test
  ) VALUES (
    p_error_type,
    LEFT(p_message, 4000),
    LEFT(p_stack, 8000),
    p_digest,
    LEFT(p_page, 500),
    LEFT(p_referrer, 500),
    LEFT(p_user_agent, 500),
    p_viewport,
    p_is_test
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_client_error(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
