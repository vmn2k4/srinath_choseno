-- Extends record_signup_source with the navigation trail and the click that
-- opened /auth, and adds the admin-only report RPC behind /admin/signup-sources.
-- (New file rather than editing 20261007000000, which is already applied.)

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
  SELECT COALESCE(jsonb_object_agg(k, left(p_source ->> k, CASE WHEN k = 'trail' THEN 1200 ELSE 500 END)), '{}'::jsonb)
  INTO v_clean
  FROM unnest(ARRAY[
    'landing_page', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign',
    'last_page_before_auth', 'auth_next', 'method', 'first_seen_at',
    'auth_trigger', 'auth_trigger_page', 'trail', 'role'
  ]) AS k
  WHERE p_source ->> k IS NOT NULL;

  IF v_clean = '{}'::jsonb THEN
    RETURN FALSE;
  END IF;

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

-- Admin-only aggregate report. Returns counts and non-identifying source
-- fields only (no emails/names). `untracked` = real signups in the window
-- that predate tracking or whose browser never stored context.
CREATE OR REPLACE FUNCTION public.get_admin_signup_source_report(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - make_interval(days => GREATEST(1, LEAST(COALESCE(p_days, 30), 365)));
  v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH s AS (
    SELECT signup_order, created_at, signup_source AS src
    FROM public.profiles
    WHERE signup_order IS NOT NULL AND is_test = false AND created_at >= v_since
  ),
  t AS (
    SELECT *,
      COALESCE(NULLIF(src ->> 'auth_trigger', ''), '(no click -- direct visit or redirect)') AS trigger_label,
      CASE
        WHEN src ->> 'last_page_before_auth' IS NULL THEN '(unknown)'
        WHEN src ->> 'last_page_before_auth' = '/' THEN 'home'
        ELSE split_part(src ->> 'last_page_before_auth', '/', 2)
      END AS page_type,
      COALESCE(NULLIF(src ->> 'referrer', ''), '(direct / none)') AS ref
    FROM s WHERE src IS NOT NULL
  )
  SELECT jsonb_build_object(
    'window_days', GREATEST(1, LEAST(COALESCE(p_days, 30), 365)),
    'total_signups', (SELECT count(*) FROM s),
    'tracked', (SELECT count(*) FROM t),
    'untracked', (SELECT count(*) FROM s WHERE src IS NULL),
    'by_trigger', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', trigger_label, 'count', c) ORDER BY c DESC)
      FROM (SELECT trigger_label, count(*) c FROM t GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x), '[]'::jsonb),
    'by_page_type', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', page_type, 'count', c) ORDER BY c DESC)
      FROM (SELECT page_type, count(*) c FROM t GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x), '[]'::jsonb),
    'by_last_page', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', p, 'count', c) ORDER BY c DESC)
      FROM (SELECT COALESCE(src ->> 'last_page_before_auth', '(unknown)') p, count(*) c FROM t GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x), '[]'::jsonb),
    'by_landing_page', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', p, 'count', c) ORDER BY c DESC)
      FROM (SELECT COALESCE(src ->> 'landing_page', '(unknown)') p, count(*) c FROM t GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x), '[]'::jsonb),
    'by_referrer', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', ref, 'count', c) ORDER BY c DESC)
      FROM (SELECT ref, count(*) c FROM t GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x), '[]'::jsonb),
    'by_method', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', m, 'count', c) ORDER BY c DESC)
      FROM (SELECT COALESCE(src ->> 'method', '(unknown)') m, count(*) c FROM t GROUP BY 1) x), '[]'::jsonb),
    'recent', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'signup_order', signup_order, 'created_at', created_at, 'trigger', trigger_label,
        'landing_page', src ->> 'landing_page', 'referrer', ref,
        'last_page', src ->> 'last_page_before_auth', 'method', src ->> 'method', 'trail', src ->> 'trail')
        ORDER BY created_at DESC)
      FROM (SELECT * FROM t ORDER BY created_at DESC LIMIT 40) r), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_signup_source_report(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_signup_source_report(INTEGER) TO authenticated;
