-- Anonymous candidate support: lets a logged-out visitor click "Support" on
-- a candidate without creating an account. Dedup is a random anon_id minted
-- client-side (see src/lib/utils/anonSupporter.ts) and persisted in both
-- localStorage and a cookie -- this table is keyed by that id exactly like
-- politician_supporters is keyed by a real supporter_id. There is no way to
-- guarantee "one support per human" without an account; this only raises
-- the cost of casual double-support past the level of a single click.
--
-- Admin gets a kill switch (site_settings.anonymous_support_enabled) and an
-- admin-only breakdown RPC so the public "combined" count (see the
-- get_politician_engagement_summaries rewrite below) doesn't hide how much
-- of it came from unauthenticated visitors.

-- 1. Admin-editable settings -------------------------------------------------
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS anonymous_support_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anonymous_support_rate_limit_per_hour INT NOT NULL DEFAULT 20
    CHECK (anonymous_support_rate_limit_per_hour > 0);

-- 2. IP-hash pepper -----------------------------------------------------------
-- An IP has ~32 bits of entropy -- nowhere near enough for a bare SHA-256
-- digest to resist a rainbow-table reversal, unlike the 256-bit random
-- token hashed in candidacy_claims.sql. This table exists solely to hold a
-- pepper for that hash; it gets RLS enabled and NO policies at all --
-- exactly the "SECURITY DEFINER-only" posture comment_rate_limits already
-- uses -- so it is unreadable through PostgREST by anyone, including an
-- admin's own session. Only a SECURITY DEFINER function body (which runs
-- with the function owner's privileges and bypasses RLS) can ever read it.
CREATE TABLE IF NOT EXISTS public.internal_secrets (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  anon_ip_pepper TEXT NOT NULL,
  CONSTRAINT internal_secrets_single_row CHECK (id = 1)
);

ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies of any kind.

-- Generated once; ON CONFLICT DO NOTHING means re-applying this migration
-- never rotates an already-seeded pepper out from under previously-hashed
-- rows in anonymous_support_rate_limits.
INSERT INTO public.internal_secrets (id, anon_ip_pepper)
VALUES (1, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- 3. Anonymous supporters table -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.anonymous_supporters (
  politician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  anon_id UUID NOT NULL,
  is_test BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (politician_id, anon_id)
);

CREATE INDEX IF NOT EXISTS idx_anonymous_supporters_politician
  ON public.anonymous_supporters(politician_id);

ALTER TABLE public.anonymous_supporters ENABLE ROW LEVEL SECURITY;

-- Public read, same posture as "Public Read Supporters" on
-- politician_supporters -- rows carry no PII beyond a random anon_id (which
-- is less sensitive than politician_supporters already publicly exposing
-- real supporter_id profile UUIDs). Needed so getSupporterCount and the
-- viewer's-own-support lookups can run as plain selects under normal RLS,
-- not just through SECURITY DEFINER RPCs.
CREATE POLICY "Public Read Anonymous Supporters" ON public.anonymous_supporters
  FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy -- anon has no session to scope a
-- USING/WITH CHECK clause to. Every write goes through the two SECURITY
-- DEFINER RPCs below.

-- 4. IP-based rate-limit log (abuse throttle, NOT a uniqueness key) ----------
-- One row per successful, newly-inserted anonymous support (see
-- add_anonymous_support below) -- never read directly by clients.
CREATE TABLE IF NOT EXISTS public.anonymous_support_rate_limits (
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anon_support_rate_limits_ip_hash_created
  ON public.anonymous_support_rate_limits(ip_hash, created_at DESC);

ALTER TABLE public.anonymous_support_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies -- SECURITY DEFINER only, same as comment_rate_limits.

-- 5. add_anonymous_support(): the rate-limited, flag-gated insert -----------
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

  -- Real client IP: this project's Postgres is reached through PostgREST
  -- behind a pooler, so inet_client_addr() alone would return the pooler's
  -- address, not the visitor's -- silently collapsing the rate limit to one
  -- shared bucket for all traffic. Supabase's PostgREST forwards the
  -- original request headers via the request.headers GUC; x-forwarded-for's
  -- leftmost entry is the true client. Falls back to inet_client_addr() for
  -- direct/local connections (e.g. testing via psql), and is wrapped in an
  -- exception handler in case the GUC isn't set on some path. Never trusts
  -- a client-supplied IP -- everything here is read server-side.
  BEGIN
    v_client_ip := NULLIF(
      split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
      ''
    );
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

  -- Only charge the rate-limit budget for a genuinely new row -- otherwise
  -- re-toggling a candidate you already support burns the shared IP budget
  -- for free (and for everyone else on that IP).
  IF v_inserted > 0 THEN
    INSERT INTO public.anonymous_support_rate_limits (ip_hash) VALUES (v_ip_hash);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_anonymous_support(UUID, UUID, BOOLEAN) TO anon, authenticated;

-- 6. remove_anonymous_support(): withdraw ------------------------------------
-- Deliberately NOT flag-gated -- a visitor who supported while the feature
-- was on can still un-support after an admin disables it, so their own
-- toggle state never gets stuck in a way they can't undo.
CREATE OR REPLACE FUNCTION public.remove_anonymous_support(
  p_politician_id UUID,
  p_anon_id UUID
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.anonymous_supporters
  WHERE politician_id = p_politician_id AND anon_id = p_anon_id;
$$;

GRANT EXECUTE ON FUNCTION public.remove_anonymous_support(UUID, UUID) TO anon, authenticated;

-- 7. Fold anonymous counts into the public engagement-summary RPC -----------
-- ElectionSeatPageClient's "Community Support" poll reads its counts from
-- this RPC (not getSupporterCount), so the combined public number needs the
-- fix here too. Same signature/columns as before -- safe to CREATE OR
-- REPLACE in place. This always includes anonymous_supporters counts, even
-- while the feature is currently disabled -- turning the toggle off stops
-- *new* anonymous supports, it does not retroactively hide ones already
-- recorded (hiding history when a setting flips would make the public
-- number lie, and would look like a bug -- "why did the count drop?").
CREATE OR REPLACE FUNCTION public.get_politician_engagement_summaries(
  p_politician_ids UUID[],
  p_include_test BOOLEAN DEFAULT false
)
RETURNS TABLE(politician_id UUID, supporter_count INT, avg_rating NUMERIC, rating_count INT, comment_count INT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    ids.id AS politician_id,
    (COALESCE(s.supporter_count, 0) + COALESCE(a.anon_count, 0))::int AS supporter_count,
    COALESCE(r.avg_rating, 0) AS avg_rating,
    COALESCE(r.rating_count, 0)::int AS rating_count,
    COALESCE(r.comment_count, 0)::int AS comment_count
  FROM unnest(p_politician_ids) AS ids(id)
  LEFT JOIN (
    SELECT politician_id, count(*) AS supporter_count
    FROM public.politician_supporters
    WHERE politician_id = ANY(p_politician_ids) AND (p_include_test OR is_test = false)
    GROUP BY politician_id
  ) s ON s.politician_id = ids.id
  LEFT JOIN (
    SELECT politician_id, count(*) AS anon_count
    FROM public.anonymous_supporters
    WHERE politician_id = ANY(p_politician_ids) AND (p_include_test OR is_test = false)
    GROUP BY politician_id
  ) a ON a.politician_id = ids.id
  LEFT JOIN (
    SELECT politician_id,
           round(avg(rating)::numeric, 2) AS avg_rating,
           count(*) AS rating_count,
           count(comment) AS comment_count
    FROM public.politician_ratings
    WHERE politician_id = ANY(p_politician_ids) AND (p_include_test OR is_test = false)
    GROUP BY politician_id
  ) r ON r.politician_id = ids.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_politician_engagement_summaries(UUID[], BOOLEAN) TO authenticated, anon;

-- 8. Admin-only breakdown: how much of each candidate's total is anonymous --
-- Lists every politician profile with at least one support (authenticated
-- or anonymous) -- matches the general Support-button surface, not scoped
-- to currently-nominated election candidates specifically.
CREATE OR REPLACE FUNCTION public.get_anonymous_support_admin_breakdown(
  p_include_test BOOLEAN DEFAULT false
)
RETURNS TABLE(
  politician_id UUID,
  full_name TEXT,
  political_party TEXT,
  authenticated_count INT,
  anonymous_count INT,
  total_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    pp.political_party,
    COALESCE(s.cnt, 0)::int,
    COALESCE(a.cnt, 0)::int,
    (COALESCE(s.cnt, 0) + COALESCE(a.cnt, 0))::int
  FROM public.profiles p
  JOIN public.politician_profiles pp ON pp.id = p.id
  LEFT JOIN (
    SELECT politician_id, count(*) cnt FROM public.politician_supporters
    WHERE (p_include_test OR is_test = false) GROUP BY politician_id
  ) s ON s.politician_id = p.id
  LEFT JOIN (
    SELECT politician_id, count(*) cnt FROM public.anonymous_supporters
    WHERE (p_include_test OR is_test = false) GROUP BY politician_id
  ) a ON a.politician_id = p.id
  WHERE COALESCE(a.cnt, 0) > 0 OR COALESCE(s.cnt, 0) > 0
  ORDER BY (COALESCE(s.cnt, 0) + COALESCE(a.cnt, 0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_anonymous_support_admin_breakdown(BOOLEAN) TO authenticated;
