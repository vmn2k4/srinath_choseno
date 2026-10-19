-- Domains that may not be linked in posts (porn, phishing, scams, etc.).
-- Populated by scripts/import_blocked_domains.sh from the Blocklist Project
-- lists. Not readable by clients: checks run inside SECURITY DEFINER RPCs.
CREATE TABLE IF NOT EXISTS public.blocked_domains (
  domain   text PRIMARY KEY,
  category text NOT NULL
);

CREATE INDEX IF NOT EXISTS blocked_domains_category_idx ON public.blocked_domains (category);

ALTER TABLE public.blocked_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocked_domains FROM anon, authenticated;

-- True if the host, or any parent domain of it, is blocked.
CREATE OR REPLACE FUNCTION public.is_domain_blocked(p_host text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH h AS (SELECT regexp_replace(lower(trim(p_host)), '^www\.', '') AS host),
  parts AS (
    SELECT array_to_string(labels[i:], '.') AS d
    FROM h, LATERAL string_to_array(h.host, '.') AS labels,
         LATERAL generate_series(1, GREATEST(array_length(labels, 1) - 1, 1)) AS i
  )
  SELECT EXISTS (SELECT 1 FROM blocked_domains b JOIN parts p ON p.d = b.domain);
$$;

REVOKE ALL ON FUNCTION public.is_domain_blocked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_domain_blocked(text) TO anon, authenticated;
