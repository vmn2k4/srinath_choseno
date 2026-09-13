-- Fixes a second, more basic bug in add_anonymous_support(): it sets
-- `SET search_path = public`, but on this project `pgcrypto` (digest(),
-- gen_random_bytes()) is installed in the `extensions` schema, not
-- `public` -- confirmed via `select nspname from pg_namespace join
-- pg_extension ... where extname = 'pgcrypto'` returning `extensions`.
-- Every call to add_anonymous_support() was failing with
-- "function digest(text, unknown) does not exist" (42883), caught live
-- against production via a direct REST call -- this is why "Support" would
-- flash on optimistically, then roll back once the RPC's error came back.
--
-- Fix: explicitly include `extensions` in the function's search_path
-- (rather than dropping the SET clause entirely, which would leave a
-- SECURITY DEFINER function with an attacker-influenceable search_path).
-- Keeps the cf-connecting-ip fix from 20260913000000 unchanged.
CREATE OR REPLACE FUNCTION public.add_anonymous_support(
  p_politician_id UUID,
  p_anon_id UUID,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_limit INT;
  v_headers JSON;
  v_client_ip TEXT;
  v_ip_hash TEXT;
  v_recent_count INT;
  v_inserted INT;
BEGIN
  SELECT anonymous_support_enabled, anonymous_support_rate_limit_per_hour
    INTO v_enabled, v_limit
    FROM public.site_settings WHERE id = 1;

  IF NOT COALESCE(v_enabled, false) THEN
    RAISE EXCEPTION 'Anonymous support is currently disabled.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.politician_profiles WHERE id = p_politician_id) THEN
    RAISE EXCEPTION 'Target is not a politician profile';
  END IF;

  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    v_client_ip := NULLIF(v_headers->>'cf-connecting-ip', '');
    IF v_client_ip IS NULL THEN
      v_client_ip := NULLIF(v_headers->>'sb-forwarded-for', '');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;
  v_client_ip := COALESCE(v_client_ip, host(inet_client_addr()), 'unknown');

  v_ip_hash := encode(
    digest(
      v_client_ip || (SELECT anon_ip_pepper FROM public.internal_secrets WHERE id = 1),
      'sha256'
    ),
    'hex'
  );

  SELECT count(*) INTO v_recent_count
    FROM public.anonymous_support_rate_limits
    WHERE ip_hash = v_ip_hash AND created_at > now() - INTERVAL '1 hour';

  IF v_recent_count >= v_limit THEN
    RAISE EXCEPTION 'Too many anonymous supports from this network. Please try again later.';
  END IF;

  INSERT INTO public.anonymous_supporters (politician_id, anon_id, is_test)
  VALUES (p_politician_id, p_anon_id, p_is_test)
  ON CONFLICT (politician_id, anon_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    INSERT INTO public.anonymous_support_rate_limits (ip_hash) VALUES (v_ip_hash);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_anonymous_support(UUID, UUID, BOOLEAN) TO anon, authenticated;
