-- Civic score was only ever computed on demand (via calculate_my_score()) and
-- shown as "—" until the user clicked "Update My Score" -- nothing was cached,
-- so every profile/feed load started blank. Also, burning a ghost id left no
-- trace anywhere that a burn had happened. This adds:
--   1. profiles.cached_total_score -- the last computed grand total (banked
--      civic_score + the current ghost's live tally), written by
--      calculate_my_score() on every call so the client can show a real
--      number immediately on load instead of waiting on an RPC round-trip.
--   2. profiles.last_burned_at / burn_count -- burn history, previously
--      untracked entirely (current_ghost_id was silently overwritten).
--   3. posts.civic_score_snapshot -- the poster's total score at the moment
--      they posted, stamped by create_post(). New posts only; historical
--      posts get NULL since their true at-the-time score can't be
--      reconstructed. This is just an integer, no more identifying than the
--      ghost_id already public on every post.
--
-- Burn semantics are unchanged (per design discussion): burning still freezes
-- the outgoing ghost's contribution into civic_score at the moment of the
-- burn call. Likes/dislikes that land on now-orphaned posts afterward are not
-- retroactively counted -- recovering them would require persisting a
-- ghost_id -> profile_id mapping past the burn, which defeats the point of
-- burning. The client is expected to warn the user of this before they burn.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cached_total_score BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_burned_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS burn_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS civic_score_snapshot BIGINT;

CREATE OR REPLACE FUNCTION public.calculate_my_score()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_banked BIGINT;
  v_live BIGINT;
  v_total BIGINT;
BEGIN
  SELECT current_ghost_id, civic_score INTO v_ghost_id, v_banked
  FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    v_total := COALESCE(v_banked, 0);
  ELSE
    SELECT
      (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
      + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
      + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
    INTO v_live;

    v_total := COALESCE(v_banked, 0) + COALESCE(v_live, 0);
  END IF;

  UPDATE public.profiles SET cached_total_score = v_total WHERE id = auth.uid();

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.burn_ghost_identity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_contribution BIGINT;
BEGIN
  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_contribution;

  -- civic_score and cached_total_score both reference the pre-update
  -- civic_score value here -- Postgres evaluates all SET expressions in a
  -- single UPDATE against the old row, so this is not a double-count.
  UPDATE public.profiles
  SET civic_score = civic_score + COALESCE(v_contribution, 0),
      cached_total_score = civic_score + COALESCE(v_contribution, 0),
      current_ghost_id = gen_random_uuid(),
      last_burned_at = timezone('utc'::text, now()),
      burn_count = burn_count + 1,
      updated_at = timezone('utc'::text, now())
  WHERE id = auth.uid();
END;
$$;

-- Same as the create_post() defined in 20260723000000_multi_boundary_memberships.sql,
-- plus stamping civic_score_snapshot with the caller's total at insert time
-- (computed fresh, not read from the cache, so it can't be stale).
CREATE OR REPLACE FUNCTION public.create_post(
  p_content TEXT,
  p_image_url TEXT DEFAULT NULL,
  p_video_url TEXT DEFAULT NULL,
  p_link_metadata JSONB DEFAULT NULL
) RETURNS public.posts AS $$
DECLARE
  v_ghost_id UUID;
  v_country TEXT;
  v_banked BIGINT;
  v_live BIGINT;
  v_post public.posts;
BEGIN
  SELECT current_ghost_id, country, civic_score INTO v_ghost_id, v_country, v_banked
  FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  INSERT INTO public.posts (ghost_id, content, image_url, video_url, link_metadata, country, is_country, is_international, civic_score_snapshot)
  VALUES (v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata, v_country, true, true, COALESCE(v_banked, 0) + COALESCE(v_live, 0))
  RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  RETURN v_post;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.calculate_my_score() TO authenticated;
GRANT EXECUTE ON FUNCTION public.burn_ghost_identity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT, TEXT, JSONB) TO authenticated;
