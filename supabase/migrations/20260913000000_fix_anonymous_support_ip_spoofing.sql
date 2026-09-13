-- Fixes a real gap in add_anonymous_support() (20260910000000): it read the
-- LEFTMOST entry of the x-forwarded-for header as "the real client IP" for
-- rate-limit hashing. That entry is whatever the caller sends -- verified
-- empirically against production (qlzyfdwrkcxyqapewxwg) by sending a
-- request with a hand-set X-Forwarded-For header and inspecting
-- request.headers from inside a SECURITY DEFINER function: the caller-sent
-- value is passed straight through unmodified, with the real edge-detected
-- IP appended at the END of the list instead. So the old logic hashed an
-- attacker-controlled string, not an IP -- anyone could set a different
-- fake X-Forwarded-For on every request and never hit the rate limit,
-- defeating the one thing this table exists for.
--
-- This project's requests are proxied through Cloudflare in front of
-- Supabase's API (confirmed via the same probe -- cf-ray/cdn-loop/
-- cf-worker headers are present on every request). Cloudflare overwrites
-- cf-connecting-ip at its own edge based on the real TCP connection and
-- strips any client-sent copy first, so it can't be spoofed the way
-- x-forwarded-for can. sb-forwarded-for (Supabase's own normalized single
-- IP, observed to match cf-connecting-ip) is kept as a second-line
-- fallback in case a request path doesn't set the Cloudflare header.
CREATE OR REPLACE FUNCTION public.add_anonymous_support(
  p_politician_id UUID,
  p_anon_id UUID,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Real client IP: cf-connecting-ip is set by Cloudflare's edge from the
  -- actual TCP connection and cannot be spoofed by the caller (Cloudflare
  -- overwrites/strips any client-sent copy). NEVER use x-forwarded-for's
  -- leftmost entry here -- that's exactly the caller-controlled value a
  -- client sends, verified empirically to pass straight through unchanged.
  -- Falls back to sb-forwarded-for, then inet_client_addr() for direct/local
  -- connections (e.g. testing via psql), wrapped in an exception handler in
  -- case request.headers isn't set on some path.
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
