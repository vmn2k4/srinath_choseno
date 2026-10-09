-- Post each supporter message from a "Share my picks" share onto that
-- candidate's wall, as a normal wall post (shows in the wall feed, under the
-- sharer's anonymous Choseno name).
--
-- Works for logged-out sharers too: posts.ghost_id has no FK to profiles, so a
-- logged-out sharer gets a stable pseudo-ghost derived from their anon_id (same
-- browser -> same "Ghost-AdjectiveNoun"). This is NOT a general anonymous-post
-- endpoint: it only posts notes that already exist on a share the caller just
-- created (owner-checked, within 15 minutes, once per note), and those notes
-- already passed create_race_pick_share's validation (<=140 chars, no links)
-- and its per-IP rate limit.
--
-- Posts are wall-only (is_country/is_international false, no post_boundaries)
-- so a burst of shares can't flood the main feed. Reporting a share hidden
-- (3 networks) also hides its wall posts.

ALTER TABLE public.race_pick_share_picks
  ADD COLUMN IF NOT EXISTS wall_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.post_pick_share_messages_to_walls(
  p_code TEXT,
  p_anon_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share public.race_pick_shares;
  v_uid UUID := (SELECT auth.uid());
  v_ghost UUID;
  v_posted INT := 0;
  v_post_id UUID;
  r RECORD;
BEGIN
  SELECT * INTO v_share FROM public.race_pick_shares WHERE code = p_code AND removed_at IS NULL;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Only right after the share was created.
  IF v_share.created_at < now() - INTERVAL '15 minutes' THEN
    RETURN 0;
  END IF;

  -- Only the creator: the signed-in account, or the same anon browser id.
  IF v_uid IS NOT NULL THEN
    IF v_share.creator_id IS DISTINCT FROM v_uid THEN
      RETURN 0;
    END IF;
    SELECT current_ghost_id INTO v_ghost FROM public.profiles WHERE id = v_uid;
  ELSE
    IF v_share.creator_id IS NOT NULL OR p_anon_id IS NULL OR v_share.anon_id IS DISTINCT FROM p_anon_id THEN
      RETURN 0;
    END IF;
    v_ghost := md5('pickshare:' || p_anon_id::text)::uuid;
  END IF;

  IF v_ghost IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT pk.candidate_id, pk.note, pr.current_ghost_id AS wall_ghost
    FROM public.race_pick_share_picks pk
    JOIN public.election_candidates c ON c.id = pk.candidate_id
    JOIN public.profiles pr ON pr.id = c.politician_id
    WHERE pk.share_id = v_share.id AND pk.note IS NOT NULL AND pk.wall_post_id IS NULL
    ORDER BY pk.position
  LOOP
    IF r.wall_ghost IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.posts (ghost_id, content, is_country, is_international, wall_ghost_id, civic_score_snapshot, is_test)
    VALUES (v_ghost, r.note, false, false, r.wall_ghost::text, 0, v_share.is_test)
    RETURNING id INTO v_post_id;

    UPDATE public.race_pick_share_picks
       SET wall_post_id = v_post_id
     WHERE share_id = v_share.id AND candidate_id = r.candidate_id;

    v_posted := v_posted + 1;
  END LOOP;

  RETURN v_posted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_pick_share_messages_to_walls(TEXT, UUID) TO anon, authenticated;

-- A share hidden by reports takes its wall posts down with it.
CREATE OR REPLACE FUNCTION public.report_race_pick_share(p_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_id UUID;
  v_inserted INT;
  v_removed TIMESTAMPTZ;
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
     WHERE id = v_share_id
     RETURNING removed_at INTO v_removed;

    IF v_removed IS NOT NULL THEN
      UPDATE public.posts
         SET removed_at = now(), removed_reason = 'pick_share_reported'
       WHERE removed_at IS NULL
         AND id IN (SELECT wall_post_id FROM public.race_pick_share_picks
                    WHERE share_id = v_share_id AND wall_post_id IS NOT NULL);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_race_pick_share(TEXT) TO anon, authenticated;
