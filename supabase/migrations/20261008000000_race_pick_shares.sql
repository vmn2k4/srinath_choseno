-- "Share my picks": a voter selects one or more candidates in a race, adds an
-- optional note, and gets a short link (/p/<code>) whose OG image highlights
-- the picked candidates. Additive only -- touches no existing table except a
-- new kill-switch column on site_settings.
--
-- Writes go exclusively through SECURITY DEFINER RPCs (create/report), same
-- posture as add_anonymous_support: logged-out visitors have no session to
-- scope a policy to. Rate limiting reuses internal_secrets.anon_ip_pepper.

-- 1. Kill switch (default ON: sharing is the point of the feature) ----------
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS pick_sharing_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pick_sharing_rate_limit_per_hour INT NOT NULL DEFAULT 20
    CHECK (pick_sharing_rate_limit_per_hour > 0);

-- 2. Tables ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.race_pick_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  seat_id UUID NOT NULL REFERENCES public.election_seats(id) ON DELETE CASCADE,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 140),
  author_label TEXT CHECK (author_label IS NULL OR char_length(author_label) <= 40),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  anon_id UUID,
  is_test BOOLEAN NOT NULL DEFAULT false,
  report_count INT NOT NULL DEFAULT 0,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_race_pick_shares_seat ON public.race_pick_shares(seat_id);

CREATE TABLE IF NOT EXISTS public.race_pick_share_picks (
  share_id UUID NOT NULL REFERENCES public.race_pick_shares(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (share_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_race_pick_share_picks_candidate
  ON public.race_pick_share_picks(candidate_id);

-- One report per network per share (hash only, never the raw IP).
CREATE TABLE IF NOT EXISTS public.race_pick_share_reports (
  share_id UUID NOT NULL REFERENCES public.race_pick_shares(id) ON DELETE CASCADE,
  reporter_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (share_id, reporter_hash)
);

CREATE TABLE IF NOT EXISTS public.race_pick_share_rate_limits (
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_race_pick_share_rate_limits_ip_created
  ON public.race_pick_share_rate_limits(ip_hash, created_at DESC);

-- 3. RLS --------------------------------------------------------------------------
ALTER TABLE public.race_pick_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_pick_share_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_pick_share_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_pick_share_rate_limits ENABLE ROW LEVEL SECURITY;
-- reports / rate_limits: no policies -- SECURITY DEFINER only.

-- Public read of live (non-removed) shares; creator_id/anon_id/report_count
-- live in these rows, so expose only through the column grants below.
CREATE POLICY "Public read live pick shares" ON public.race_pick_shares
  FOR SELECT USING (removed_at IS NULL);

CREATE POLICY "Public read picks of live shares" ON public.race_pick_share_picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.race_pick_shares s
      WHERE s.id = share_id AND s.removed_at IS NULL
    )
  );

CREATE POLICY "Admins manage pick shares" ON public.race_pick_shares
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- Keep identity/abuse columns out of the public API surface.
REVOKE SELECT ON public.race_pick_shares FROM anon, authenticated;
GRANT SELECT (id, code, seat_id, note, author_label, created_at, removed_at)
  ON public.race_pick_shares TO anon, authenticated;

-- 4. Helpers ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._anon_ip_hash()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_ip TEXT;
BEGIN
  BEGIN
    v_client_ip := NULLIF(
      split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
      ''
    );
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

-- 5. create_race_pick_share ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_race_pick_share(
  p_seat_id UUID,
  p_candidate_ids UUID[],
  p_note TEXT DEFAULT NULL,
  p_author_label TEXT DEFAULT NULL,
  p_anon_id UUID DEFAULT NULL,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_limit INT;
  v_ip_hash TEXT;
  v_recent INT;
  v_note TEXT;
  v_label TEXT;
  v_ids UUID[];
  v_valid INT;
  v_share_id UUID;
  v_code TEXT;
  v_alphabet CONSTANT TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  i INT;
  attempts INT := 0;
BEGIN
  SELECT pick_sharing_enabled, pick_sharing_rate_limit_per_hour
    INTO v_enabled, v_limit
    FROM public.site_settings WHERE id = 1;
  IF NOT COALESCE(v_enabled, true) THEN
    RAISE EXCEPTION 'Sharing picks is currently disabled.';
  END IF;

  -- De-duplicate while preserving the caller's order.
  SELECT COALESCE(array_agg(id ORDER BY ord), '{}') INTO v_ids
  FROM (
    SELECT id, min(ord) AS ord
    FROM unnest(p_candidate_ids) WITH ORDINALITY AS t(id, ord)
    GROUP BY id
  ) d;

  IF COALESCE(array_length(v_ids, 1), 0) < 1 THEN
    RAISE EXCEPTION 'Pick at least one candidate.';
  END IF;
  IF array_length(v_ids, 1) > 12 THEN
    RAISE EXCEPTION 'Too many candidates picked.';
  END IF;

  -- Every pick must be a candidate of THIS seat (server-side invariant).
  SELECT count(*) INTO v_valid
  FROM public.election_candidates
  WHERE seat_id = p_seat_id AND id = ANY(v_ids);
  IF v_valid <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'Picks must be candidates in this race.';
  END IF;

  v_note := NULLIF(btrim(regexp_replace(COALESCE(p_note, ''), '\s+', ' ', 'g')), '');
  v_label := NULLIF(btrim(regexp_replace(COALESCE(p_author_label, ''), '\s+', ' ', 'g')), '');

  IF v_note IS NOT NULL AND char_length(v_note) > 140 THEN
    RAISE EXCEPTION 'Note is too long (140 characters max).';
  END IF;
  IF v_label IS NOT NULL AND char_length(v_label) > 40 THEN
    RAISE EXCEPTION 'Name is too long (40 characters max).';
  END IF;
  -- The note/name are rendered into an image and a public page: block links
  -- so the feature can't be used to advertise or phish.
  IF (v_note IS NOT NULL AND v_note ~* '(https?://|www\.|\.[a-z]{2,}/|[a-z0-9-]+\.(com|net|org|io|co|ly|me|app|xyz)\b)')
     OR (v_label IS NOT NULL AND v_label ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|co|ly|me|app|xyz)\b)') THEN
    RAISE EXCEPTION 'Links are not allowed in a share note.';
  END IF;

  v_ip_hash := public._anon_ip_hash();
  SELECT count(*) INTO v_recent
    FROM public.race_pick_share_rate_limits
    WHERE ip_hash = v_ip_hash AND created_at > now() - INTERVAL '1 hour';
  IF v_recent >= v_limit THEN
    RAISE EXCEPTION 'Too many shares from this network. Please try again later.';
  END IF;

  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.race_pick_shares (code, seat_id, note, author_label, creator_id, anon_id, is_test)
      VALUES (v_code, p_seat_id, v_note, v_label, (SELECT auth.uid()), p_anon_id, COALESCE(p_is_test, false))
      RETURNING id INTO v_share_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      IF attempts > 5 THEN
        RAISE EXCEPTION 'Could not allocate a share code. Please try again.';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.race_pick_share_picks (share_id, candidate_id, position)
  SELECT v_share_id, id, (ord - 1)::smallint
  FROM unnest(v_ids) WITH ORDINALITY AS t(id, ord);

  INSERT INTO public.race_pick_share_rate_limits (ip_hash) VALUES (v_ip_hash);

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_race_pick_share(UUID, UUID[], TEXT, TEXT, UUID, BOOLEAN) TO anon, authenticated;

-- 6. report_race_pick_share: 3 distinct networks auto-hide a share -------------------
CREATE OR REPLACE FUNCTION public.report_race_pick_share(p_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_id UUID;
  v_inserted INT;
BEGIN
  SELECT id INTO v_share_id FROM public.race_pick_shares WHERE code = p_code AND removed_at IS NULL;
  IF v_share_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.race_pick_share_reports (share_id, reporter_hash)
  VALUES (v_share_id, public._anon_ip_hash())
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE public.race_pick_shares
       SET report_count = report_count + 1,
           removed_at = CASE WHEN report_count + 1 >= 3 THEN now() ELSE removed_at END
     WHERE id = v_share_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_race_pick_share(TEXT) TO anon, authenticated;
