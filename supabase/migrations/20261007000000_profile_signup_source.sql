-- Records where a new signup came from (first-touch landing page, referrer,
-- UTM params, page they were on before /auth). Until now nothing stored this,
-- so "what motivated today's signups" could only be guessed from GA4.
--
-- Deliberately NOT done inside handle_new_user(): that trigger runs on every
-- auth.users insert and a bug there would break signup. Instead the client
-- calls this RPC best-effort after sign-in; if it never runs, signup is
-- unaffected and signup_source simply stays NULL.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_source JSONB;

CREATE OR REPLACE FUNCTION public.record_signup_source(p_source JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean JSONB;
  v_rows INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_source IS NULL OR jsonb_typeof(p_source) <> 'object' THEN
    RETURN FALSE;
  END IF;

  -- Whitelist keys and cap lengths so a caller can't stash arbitrary data.
  SELECT COALESCE(jsonb_object_agg(k, left(p_source ->> k, 500)), '{}'::jsonb)
  INTO v_clean
  FROM unnest(ARRAY[
    'landing_page', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign',
    'last_page_before_auth', 'auth_next', 'method', 'first_seen_at'
  ]) AS k
  WHERE p_source ->> k IS NOT NULL;

  IF v_clean = '{}'::jsonb THEN
    RETURN FALSE;
  END IF;

  -- Only a genuine recent signup, and only once: never tags old accounts
  -- or bulk-imported politician rows (signup_order IS NULL).
  UPDATE public.profiles
  SET signup_source = v_clean
  WHERE id = auth.uid()
    AND signup_source IS NULL
    AND signup_order IS NOT NULL
    AND created_at > now() - interval '7 days';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_signup_source(JSONB) TO authenticated;
