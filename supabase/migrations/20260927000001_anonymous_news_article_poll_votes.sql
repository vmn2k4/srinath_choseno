-- Anonymous poll voting: lets a logged-out visitor vote on a news
-- article's poll(s) without creating an account -- same "no sign-in
-- friction" trade the site already makes for candidate support (see
-- 20260910000000_anonymous_politician_support.sql, whose header comment
-- explains the tradeoff this mirrors: dedup is a random anon_id minted
-- client-side and persisted in both localStorage and a cookie, backstopped
-- by an IP rate limit -- there is no way to guarantee "one vote per human"
-- without an account, so this only raises the cost of casual double-voting
-- past a single click).
--
-- Deliberately a SEPARATE table/RPC pair from the signed-in path
-- (news_article_poll_votes / cast_news_article_poll_vote), not a nullable
-- voter_id on the existing table -- an anon_id and a real profile id are
-- different identity concepts with different guarantees, and keeping them
-- apart means the signed-in path's UNIQUE (poll_id, voter_id) constraint
-- and RLS never have to account for a "sometimes null" voter.

-- 1. Anonymous votes table ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_article_anon_poll_votes (
  poll_id    UUID NOT NULL REFERENCES public.news_article_polls(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES public.news_article_poll_options(id) ON DELETE CASCADE,
  anon_id    UUID NOT NULL,
  is_test    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, anon_id)
);

CREATE INDEX IF NOT EXISTS news_article_anon_poll_votes_option_idx
  ON public.news_article_anon_poll_votes (option_id);

CREATE TRIGGER news_article_anon_poll_votes_updated_at
  BEFORE UPDATE ON public.news_article_anon_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public._news_article_polls_set_updated_at();

ALTER TABLE public.news_article_anon_poll_votes ENABLE ROW LEVEL SECURITY;

-- Public read, same posture as "Public Read Anonymous Supporters" -- rows
-- carry no PII beyond a random anon_id. Needed so a returning anonymous
-- voter's own pick can be looked up with a plain select (matching
-- news_article_poll_votes' "own row" read for signed-in voters), not just
-- through the results RPC. No INSERT/UPDATE/DELETE policy -- anon has no
-- session to scope a USING/WITH CHECK clause to; every write goes through
-- cast_anonymous_news_article_poll_vote below.
CREATE POLICY "Public can read anonymous poll votes"
  ON public.news_article_anon_poll_votes FOR SELECT
  USING (true);

-- 2. IP-based rate-limit log (abuse throttle, NOT a uniqueness key) ---------
-- Reuses the same anon_ip_pepper seeded in internal_secrets by the
-- anonymous-support migration -- one pepper for hashing IPs across every
-- anonymous-write feature, not a per-feature secret.
CREATE TABLE IF NOT EXISTS public.anonymous_poll_vote_rate_limits (
  ip_hash    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anon_poll_vote_rate_limits_ip_hash_created
  ON public.anonymous_poll_vote_rate_limits (ip_hash, created_at DESC);

ALTER TABLE public.anonymous_poll_vote_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies -- SECURITY DEFINER only, same as anonymous_support_rate_limits.

-- 3. cast_anonymous_news_article_poll_vote(): rate-limited upsert -----------
CREATE OR REPLACE FUNCTION public.cast_anonymous_news_article_poll_vote(
  p_option_id UUID,
  p_anon_id UUID,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS public.news_article_anon_poll_votes
LANGUAGE plpgsql
SECURITY DEFINER
-- `extensions`, not just `public`: pgcrypto's digest() lives in the
-- `extensions` schema on this project (confirmed via pg_extension), so a
-- search_path restricted to public alone can't resolve it -- caught live
-- via a direct anon-key RPC test (42883 "function digest(text, unknown)
-- does not exist") before this ever shipped to a real user.
SET search_path = public, extensions
AS $$
DECLARE
  v_poll_id UUID;
  v_limit INT := 30; -- generous -- a real reader votes on at most a handful of polls per article, this guards scripted abuse, not a normal visitor
  v_client_ip TEXT;
  v_ip_hash TEXT;
  v_recent_count INT;
  v_inserted INT;
  v_row public.news_article_anon_poll_votes;
BEGIN
  SELECT poll_id INTO v_poll_id FROM public.news_article_poll_options WHERE id = p_option_id;
  IF v_poll_id IS NULL THEN
    RAISE EXCEPTION 'Unknown poll option';
  END IF;

  -- Same "real client IP behind PostgREST's pooler" extraction as
  -- add_anonymous_support -- see that function's comment for why
  -- inet_client_addr() alone isn't enough.
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
    FROM public.anonymous_poll_vote_rate_limits
    WHERE ip_hash = v_ip_hash AND created_at > now() - INTERVAL '1 hour';

  IF v_recent_count >= v_limit THEN
    RAISE EXCEPTION 'Too many anonymous votes from this network. Please try again later.';
  END IF;

  INSERT INTO public.news_article_anon_poll_votes (poll_id, option_id, anon_id, is_test)
  VALUES (v_poll_id, p_option_id, p_anon_id, p_is_test)
  ON CONFLICT (poll_id, anon_id) DO UPDATE
    SET option_id = EXCLUDED.option_id,
        updated_at = now()
  RETURNING * INTO v_row;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  -- Only charge the rate-limit budget when the pick actually changed --
  -- re-clicking the same option a visitor already picked is a no-op vote,
  -- same "don't burn the shared IP budget for free" reasoning as
  -- add_anonymous_support's insert-count check.
  IF v_inserted > 0 THEN
    INSERT INTO public.anonymous_poll_vote_rate_limits (ip_hash) VALUES (v_ip_hash);
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_anonymous_news_article_poll_vote(UUID, UUID, BOOLEAN) TO anon, authenticated;

-- 4. Fold anonymous tallies into the public results RPC ---------------------
-- Same signature as before (safe to CREATE OR REPLACE in place) -- now
-- sums both the signed-in and anonymous vote tables per option.
CREATE OR REPLACE FUNCTION public.get_news_article_poll_results(p_poll_ids UUID[])
RETURNS TABLE(poll_id UUID, option_id UUID, vote_count INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT poll_id, option_id, SUM(vote_count)::int AS vote_count
  FROM (
    SELECT poll_id, option_id, COUNT(*) AS vote_count
    FROM public.news_article_poll_votes
    WHERE poll_id = ANY(p_poll_ids)
    GROUP BY poll_id, option_id
    UNION ALL
    SELECT poll_id, option_id, COUNT(*) AS vote_count
    FROM public.news_article_anon_poll_votes
    WHERE poll_id = ANY(p_poll_ids)
    GROUP BY poll_id, option_id
  ) combined
  GROUP BY poll_id, option_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_news_article_poll_results(UUID[]) TO authenticated, anon;
