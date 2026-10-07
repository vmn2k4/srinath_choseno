-- Fixes _anon_ip_hash() from 20261008000000, which (a) could not resolve
-- pgcrypto's digest() -- it lives in the `extensions` schema -- and (b) read
-- the caller-controlled x-forwarded-for header. Mirrors the hardened
-- approach in 20260913000000_fix_anonymous_support_ip_spoofing.sql:
-- cf-connecting-ip (set by Cloudflare's edge), then sb-forwarded-for.
CREATE OR REPLACE FUNCTION public._anon_ip_hash()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_headers JSON;
  v_client_ip TEXT;
BEGIN
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
  RETURN encode(
    digest(
      v_client_ip || (SELECT anon_ip_pepper FROM public.internal_secrets WHERE id = 1),
      'sha256'
    ),
    'hex'
  );
END;
$$;

REVOKE ALL ON FUNCTION public._anon_ip_hash() FROM PUBLIC, anon, authenticated;
