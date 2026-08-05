-- Makes the previously-hardcoded rate-limit numbers admin-editable, same
-- pattern as the existing site_settings row (single-row table, publicly
-- readable, admin-only write) that already stores the site theme —
-- reusing it here instead of a new table since these are all just scalar
-- platform-wide knobs.
--
-- comment_cooldown_days: create_comment()'s per-(user, post) cooldown,
--   previously a hardcoded 7-day INTERVAL literal.
-- politician_daily_post_limit: create_post()'s politician feed-post cap,
--   previously a hardcoded "already posted today" boolean check (limit of
--   exactly 1). Generalized to a count comparison so admin can raise/lower
--   it, or set it high enough to effectively disable it.
-- story_strip_hours: how long a video pitch stays in the ephemeral
--   "Politician Pitches" strip (FeedPageClient.tsx), previously a hardcoded
--   24h constant on the client. The underlying post is unaffected either
--   way and stays in the regular feed forever.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS comment_cooldown_days INT NOT NULL DEFAULT 7 CHECK (comment_cooldown_days > 0),
  ADD COLUMN IF NOT EXISTS politician_daily_post_limit INT NOT NULL DEFAULT 1 CHECK (politician_daily_post_limit > 0),
  ADD COLUMN IF NOT EXISTS story_strip_hours INT NOT NULL DEFAULT 24 CHECK (story_strip_hours > 0);

-- create_comment(): read the cooldown from site_settings instead of a
-- hardcoded '7 days' literal. Same body otherwise as
-- comment_rate_limit.sql's version.
CREATE OR REPLACE FUNCTION public.create_comment(p_post_id UUID, p_content TEXT)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_cooldown_days INT;
  v_last_commented_at TIMESTAMPTZ;
  v_days_remaining NUMERIC;
  v_comment public.comments;
BEGIN
  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT comment_cooldown_days INTO v_cooldown_days FROM public.site_settings WHERE id = 1;
  v_cooldown_days := COALESCE(v_cooldown_days, 7);

  SELECT last_commented_at INTO v_last_commented_at
  FROM public.comment_rate_limits
  WHERE user_id = auth.uid() AND post_id = p_post_id;

  IF v_last_commented_at IS NOT NULL AND v_last_commented_at > now() - make_interval(days => v_cooldown_days) THEN
    v_days_remaining := CEIL(EXTRACT(EPOCH FROM (v_last_commented_at + make_interval(days => v_cooldown_days) - now())) / 86400.0);
    RAISE EXCEPTION 'You can comment on this again in % day(s).', v_days_remaining;
  END IF;

  INSERT INTO public.comments (post_id, ghost_id, content)
  VALUES (p_post_id, v_ghost_id, p_content)
  RETURNING * INTO v_comment;

  INSERT INTO public.comment_rate_limits (user_id, post_id, last_commented_at)
  VALUES (auth.uid(), p_post_id, now())
  ON CONFLICT (user_id, post_id) DO UPDATE SET last_commented_at = now();

  RETURN v_comment;
END;
$$;

-- create_post(): read the politician daily-post limit from site_settings
-- instead of a hardcoded "already posted today" boolean check. Same body
-- otherwise as politician_daily_post_limit.sql's version.
CREATE OR REPLACE FUNCTION public.create_post(
  p_content               TEXT,
  p_image_url             TEXT    DEFAULT NULL,
  p_video_url             TEXT    DEFAULT NULL,
  p_link_metadata         JSONB   DEFAULT NULL,
  p_election_candidate_id UUID    DEFAULT NULL,
  p_news_article_id       UUID    DEFAULT NULL
) RETURNS public.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_country TEXT;
  v_banked BIGINT;
  v_live BIGINT;
  v_role TEXT;
  v_daily_limit INT;
  v_posts_today INT;
  v_post public.posts;
BEGIN
  SELECT current_ghost_id, country, civic_score, role
    INTO v_ghost_id, v_country, v_banked, v_role
    FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  IF v_role = 'politician' THEN
    SELECT politician_daily_post_limit INTO v_daily_limit FROM public.site_settings WHERE id = 1;
    v_daily_limit := COALESCE(v_daily_limit, 1);

    SELECT count(*) INTO v_posts_today
    FROM public.posts
    WHERE ghost_id = v_ghost_id
      AND created_at::date = (now() AT TIME ZONE 'utc')::date;

    IF v_posts_today >= v_daily_limit THEN
      RAISE EXCEPTION 'Politicians can only post % time(s) per day', v_daily_limit;
    END IF;
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  INSERT INTO public.posts (
    ghost_id, content, image_url, video_url, link_metadata,
    country, is_country, is_international,
    election_candidate_id, news_article_id, civic_score_snapshot
  ) VALUES (
    v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata,
    v_country, true, true,
    p_election_candidate_id, p_news_article_id,
    COALESCE(v_banked, 0) + COALESCE(v_live, 0)
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  RETURN v_post;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT, TEXT, JSONB, UUID, UUID) TO authenticated;
