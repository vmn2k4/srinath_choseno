-- Per-candidate "why I support them" notes for race pick shares.
-- Additive: a nullable note column on the picks table, plus a new
-- create_race_pick_share overload that takes p_pick_notes (parallel to
-- p_candidate_ids). The previous 6-arg function stays callable (already-
-- deployed clients use it) and now just delegates here with no pick notes.
-- p_pick_notes deliberately has NO default so a call that omits it can only
-- ever resolve to the old signature (no overload ambiguity).

ALTER TABLE public.race_pick_share_picks
  ADD COLUMN IF NOT EXISTS note TEXT CHECK (note IS NULL OR char_length(note) <= 140);

CREATE OR REPLACE FUNCTION public.create_race_pick_share(
  p_seat_id UUID,
  p_candidate_ids UUID[],
  p_note TEXT,
  p_author_label TEXT,
  p_anon_id UUID,
  p_is_test BOOLEAN,
  p_pick_notes TEXT[]
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
  v_link_re CONSTANT TEXT := '(https?://|www\.|\.[a-z]{2,}/|[a-z0-9-]+\.(com|net|org|io|co|ly|me|app|xyz)\b)';
  i INT;
  attempts INT := 0;
  r RECORD;
  v_pick_note TEXT;
BEGIN
  SELECT pick_sharing_enabled, pick_sharing_rate_limit_per_hour
    INTO v_enabled, v_limit
    FROM public.site_settings WHERE id = 1;
  IF NOT COALESCE(v_enabled, true) THEN
    RAISE EXCEPTION 'Sharing picks is currently disabled.';
  END IF;

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
  IF (v_note IS NOT NULL AND v_note ~* v_link_re)
     OR (v_label IS NOT NULL AND v_label ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|co|ly|me|app|xyz)\b)') THEN
    RAISE EXCEPTION 'Links are not allowed in a share note.';
  END IF;

  -- Validate every per-pick note up front (by position in the caller's array).
  IF p_pick_notes IS NOT NULL THEN
    FOR i IN 1..COALESCE(array_length(p_pick_notes, 1), 0) LOOP
      v_pick_note := NULLIF(btrim(regexp_replace(COALESCE(p_pick_notes[i], ''), '\s+', ' ', 'g')), '');
      IF v_pick_note IS NOT NULL AND char_length(v_pick_note) > 140 THEN
        RAISE EXCEPTION 'Each note must be 140 characters or fewer.';
      END IF;
      IF v_pick_note IS NOT NULL AND v_pick_note ~* v_link_re THEN
        RAISE EXCEPTION 'Links are not allowed in a share note.';
      END IF;
    END LOOP;
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

  -- Each deduped id keeps the note from its first occurrence in the caller's array.
  FOR r IN
    SELECT id, min(ord) AS ord
    FROM unnest(p_candidate_ids) WITH ORDINALITY AS t(id, ord)
    GROUP BY id
    ORDER BY min(ord)
  LOOP
    v_pick_note := CASE
      WHEN p_pick_notes IS NULL THEN NULL
      ELSE NULLIF(btrim(regexp_replace(COALESCE(p_pick_notes[r.ord], ''), '\s+', ' ', 'g')), '')
    END;
    INSERT INTO public.race_pick_share_picks (share_id, candidate_id, position, note)
    VALUES (v_share_id, r.id, (SELECT count(*) FROM public.race_pick_share_picks WHERE share_id = v_share_id)::smallint, v_pick_note);
  END LOOP;

  INSERT INTO public.race_pick_share_rate_limits (ip_hash) VALUES (v_ip_hash);

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_race_pick_share(UUID, UUID[], TEXT, TEXT, UUID, BOOLEAN, TEXT[]) TO anon, authenticated;

-- Old signature: keep working, delegate (no pick notes).
CREATE OR REPLACE FUNCTION public.create_race_pick_share(
  p_seat_id UUID,
  p_candidate_ids UUID[],
  p_note TEXT DEFAULT NULL,
  p_author_label TEXT DEFAULT NULL,
  p_anon_id UUID DEFAULT NULL,
  p_is_test BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.create_race_pick_share(
    p_seat_id, p_candidate_ids, p_note, p_author_label, p_anon_id, p_is_test, NULL::text[]
  );
$$;

GRANT EXECUTE ON FUNCTION public.create_race_pick_share(UUID, UUID[], TEXT, TEXT, UUID, BOOLEAN) TO anon, authenticated;
