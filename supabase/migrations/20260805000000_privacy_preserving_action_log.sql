-- Replaces comment_rate_limits (which mapped a real user_id directly to a
-- specific post_id -- deanonymizing a burned ghost's comment by simply
-- looking up which post that user_id last commented on) with user_actions:
-- an append-style log keyed on (user_id, action_type, politician_id,
-- action_date) with a plain count. It never stores a post_id/comment_id, so
-- even with full DB access, once a ghost is burned there is no path from
-- this table back to which piece of content a user authored -- only that
-- they took some action, on some target (a politician, or the
-- politician-less news feed), on some day.
--
-- politician_id uses a fixed sentinel UUID (all zeros) rather than NULL for
-- "no specific politician" (news-feed actions) so the PRIMARY KEY can still
-- enforce one row per user/action_type/politician_id/day -- Postgres treats
-- multiple NULLs in a unique/PK column as distinct, which would silently
-- defeat the daily-limit lookup below.
--
-- politician_supporters and content_reports are deliberately left untouched
-- -- product decision: supporter_id -> politician_id is fine to keep mapped
-- (confirmed with product owner), and content_reports maps a user to
-- content they *reported*, not content they *posted*, which is a different
-- concern from what this migration addresses.
CREATE TABLE public.user_actions (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'post_news_feed',
    'post_politician_wall',
    'comment_news_feed',
    'comment_politician_wall',
    'burn_ghost',
    'spam_removed'
  )),
  politician_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  action_date DATE NOT NULL DEFAULT (timezone('utc'::text, now()))::date,
  action_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action_type, politician_id, action_date)
);

ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon -- same posture as the old
-- comment_rate_limits table: only SECURITY DEFINER functions (below) may
-- read or write this table.

-- record_user_action(): internal upsert helper shared by every write path
-- below. Takes an arbitrary p_user_id (not derived from auth.uid()) because
-- moderation removal needs to credit the *content owner*, not the caller --
-- so it must never be reachable directly by a client. REVOKE below closes
-- the default PUBLIC EXECUTE grant Postgres applies to new functions.
CREATE OR REPLACE FUNCTION public.record_user_action(
  p_user_id UUID,
  p_action_type TEXT,
  p_politician_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_actions (user_id, action_type, politician_id, action_date, action_count)
  VALUES (p_user_id, p_action_type, p_politician_id, (timezone('utc'::text, now()))::date, 1)
  ON CONFLICT (user_id, action_type, politician_id, action_date)
  DO UPDATE SET action_count = public.user_actions.action_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.record_user_action(UUID, TEXT, UUID) FROM PUBLIC;

-- site_settings: comment_cooldown_days doesn't map onto the new model (it
-- measured days between comments on the *same post*; there's no post-level
-- key anymore). Replaced with a daily cap per (action_type, politician_id).
ALTER TABLE public.site_settings
  DROP COLUMN IF EXISTS comment_cooldown_days,
  ADD COLUMN IF NOT EXISTS comment_daily_limit_per_target INT NOT NULL DEFAULT 1
    CHECK (comment_daily_limit_per_target > 0);

-- create_comment(): drops the comment_rate_limits (user_id, post_id) check
-- in favor of a same-day cap keyed on the comment's target -- the wall
-- owner's politician_id if this post lives on a politician's Wall
-- (posts.wall_ghost_id set), otherwise the politician-less news feed
-- bucket. Same signature/return type as before.
CREATE OR REPLACE FUNCTION public.create_comment(p_post_id UUID, p_content TEXT)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost_id UUID;
  v_wall_ghost_id TEXT;
  v_action_type TEXT;
  v_politician_id UUID := '00000000-0000-0000-0000-000000000000';
  v_daily_limit INT;
  v_today_count INT;
  v_comment public.comments;
BEGIN
  SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT wall_ghost_id INTO v_wall_ghost_id FROM public.posts WHERE id = p_post_id;

  IF v_wall_ghost_id IS NOT NULL THEN
    v_action_type := 'comment_politician_wall';
    SELECT id INTO v_politician_id FROM public.profiles WHERE current_ghost_id = v_wall_ghost_id::uuid;
    v_politician_id := COALESCE(v_politician_id, '00000000-0000-0000-0000-000000000000');
  ELSE
    v_action_type := 'comment_news_feed';
  END IF;

  SELECT comment_daily_limit_per_target INTO v_daily_limit FROM public.site_settings WHERE id = 1;
  v_daily_limit := COALESCE(v_daily_limit, 1);

  SELECT action_count INTO v_today_count
  FROM public.user_actions
  WHERE user_id = auth.uid()
    AND action_type = v_action_type
    AND politician_id = v_politician_id
    AND action_date = (timezone('utc'::text, now()))::date;

  IF COALESCE(v_today_count, 0) >= v_daily_limit THEN
    RAISE EXCEPTION 'You have reached today''s comment limit for this target.';
  END IF;

  INSERT INTO public.comments (post_id, ghost_id, content)
  VALUES (p_post_id, v_ghost_id, p_content)
  RETURNING * INTO v_comment;

  PERFORM public.record_user_action(auth.uid(), v_action_type, v_politician_id);

  RETURN v_comment;
END;
$$;

-- create_post(): unchanged body, now also logs a politician-less
-- 'post_news_feed' action after the insert succeeds.
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

  PERFORM public.record_user_action(auth.uid(), 'post_news_feed');

  RETURN v_post;
END;
$$;

-- create_wall_post(): unchanged body, now also resolves the wall owner's
-- real profile id (from the target ghost) and logs a 'post_politician_wall'
-- action against it -- covers both a politician posting to their own Wall
-- and a citizen posting to someone else's.
CREATE OR REPLACE FUNCTION public.create_wall_post(
  p_content        TEXT,
  p_image_url      TEXT DEFAULT NULL,
  p_video_url      TEXT DEFAULT NULL,
  p_link_metadata  JSONB DEFAULT NULL,
  p_wall_ghost_id  TEXT DEFAULT NULL
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
  v_target_ghost TEXT;
  v_politician_id UUID;
  v_post public.posts;
BEGIN
  SELECT current_ghost_id, country, civic_score
    INTO v_ghost_id, v_country, v_banked
    FROM public.profiles WHERE id = auth.uid();

  IF v_ghost_id IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT
    (SELECT count(*) FROM public.posts WHERE ghost_id = v_ghost_id) * 10
    + (SELECT count(*) FROM public.comments WHERE ghost_id = v_ghost_id) * 5
    + COALESCE((SELECT sum(likes_count) - sum(dislikes_count) FROM public.posts WHERE ghost_id = v_ghost_id), 0)
  INTO v_live;

  v_target_ghost := COALESCE(p_wall_ghost_id, v_ghost_id::text);

  INSERT INTO public.posts (
    ghost_id, content, image_url, video_url, link_metadata,
    country, is_country, is_international, wall_ghost_id, civic_score_snapshot
  ) VALUES (
    v_ghost_id, p_content, p_image_url, p_video_url, p_link_metadata,
    v_country, true, true,
    v_target_ghost,
    COALESCE(v_banked, 0) + COALESCE(v_live, 0)
  ) RETURNING * INTO v_post;

  INSERT INTO public.post_boundaries (post_id, map_shape_id)
  SELECT v_post.id, map_shape_id FROM public.user_boundary_memberships WHERE profile_id = auth.uid();

  SELECT id INTO v_politician_id FROM public.profiles WHERE current_ghost_id = v_target_ghost::uuid;
  PERFORM public.record_user_action(auth.uid(), 'post_politician_wall', COALESCE(v_politician_id, '00000000-0000-0000-0000-000000000000'));

  RETURN v_post;
END;
$$;

-- burn_ghost_identity(): unchanged rotation/score-banking body, now also
-- logs a 'burn_ghost' action against the real user_id for audit/scoring
-- purposes. Harmless if a user burns more than once a day -- action_count
-- just increments, nothing is gated on it.
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

  UPDATE public.profiles
  SET civic_score = civic_score + COALESCE(v_contribution, 0),
      cached_total_score = civic_score + COALESCE(v_contribution, 0),
      current_ghost_id = gen_random_uuid(),
      last_burned_at = timezone('utc'::text, now()),
      burn_count = burn_count + 1,
      updated_at = timezone('utc'::text, now())
  WHERE id = auth.uid();

  PERFORM public.record_user_action(auth.uid(), 'burn_ghost');
END;
$$;

-- report_content() / admin_remove_content(): unchanged removal/penalty
-- logic, now also resolve the removed content's owning profile id (before
-- the ghost potentially rotates away) and log a 'spam_removed' action
-- against it when the abuse type is specifically 'spam' -- gives a
-- per-user spam-removal count with no content_id attached, so it survives
-- a burn without exposing which post/comment it was.
CREATE OR REPLACE FUNCTION public.report_content(p_target_type TEXT, p_target_id UUID, p_abuse_type TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_ghost UUID;
  v_target_ghost UUID;
  v_rule public.moderation_rules;
  v_open_count BIGINT;
  v_removed_ghost UUID;
  v_owner_id UUID;
BEGIN
  SELECT current_ghost_id INTO v_reporter_ghost FROM public.profiles WHERE id = auth.uid();
  IF v_reporter_ghost IS NULL THEN
    RAISE EXCEPTION 'Ghost identity not found';
  END IF;

  SELECT * INTO v_rule FROM public.moderation_rules WHERE abuse_type = p_abuse_type AND enabled = true;
  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Unknown or disabled abuse type: %', p_abuse_type;
  END IF;

  IF p_target_type = 'post' THEN
    SELECT ghost_id INTO v_target_ghost FROM public.posts WHERE id = p_target_id;
  ELSIF p_target_type = 'comment' THEN
    SELECT ghost_id INTO v_target_ghost FROM public.comments WHERE id = p_target_id;
  ELSIF p_target_type = 'politician_profile' THEN
    IF p_target_id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot report yourself';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown target type: %', p_target_type;
  END IF;

  IF v_target_ghost IS NOT NULL AND v_target_ghost = v_reporter_ghost THEN
    RAISE EXCEPTION 'You cannot report your own content';
  END IF;

  INSERT INTO public.content_reports (reporter_id, target_type, target_id, abuse_type)
  VALUES (auth.uid(), p_target_type, p_target_id, p_abuse_type)
  ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING;

  IF p_target_type NOT IN ('post', 'comment') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_open_count
  FROM public.content_reports
  WHERE target_type = p_target_type AND target_id = p_target_id
    AND abuse_type = p_abuse_type AND status = 'open';

  IF v_open_count >= v_rule.auto_remove_threshold THEN
    IF p_target_type = 'post' THEN
      UPDATE public.posts SET removed_at = now(), removed_reason = p_abuse_type
      WHERE id = p_target_id AND removed_at IS NULL
      RETURNING ghost_id INTO v_removed_ghost;
    ELSE
      UPDATE public.comments SET removed_at = now(), removed_reason = p_abuse_type
      WHERE id = p_target_id AND removed_at IS NULL
      RETURNING ghost_id INTO v_removed_ghost;
    END IF;

    IF v_removed_ghost IS NOT NULL THEN
      SELECT id INTO v_owner_id FROM public.profiles WHERE current_ghost_id = v_removed_ghost;

      UPDATE public.profiles
      SET civic_score = GREATEST(civic_score - v_rule.score_penalty, 0)
      WHERE current_ghost_id = v_removed_ghost;

      IF v_owner_id IS NOT NULL AND p_abuse_type = 'spam' THEN
        PERFORM public.record_user_action(v_owner_id, 'spam_removed');
      END IF;

      UPDATE public.content_reports SET status = 'removed'
      WHERE target_type = p_target_type AND target_id = p_target_id
        AND abuse_type = p_abuse_type AND status = 'open';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_content(
  p_target_type TEXT,
  p_target_id UUID,
  p_abuse_type TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.moderation_rules;
  v_removed_ghost UUID;
  v_owner_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_target_type NOT IN ('post', 'comment') THEN
    RAISE EXCEPTION 'Only posts and comments can be removed';
  END IF;

  SELECT * INTO v_rule FROM public.moderation_rules WHERE abuse_type = p_abuse_type;
  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Unknown abuse type: %', p_abuse_type;
  END IF;

  IF p_target_type = 'post' THEN
    UPDATE public.posts SET removed_at = now(), removed_reason = COALESCE(p_reason, p_abuse_type), removed_by = auth.uid()
    WHERE id = p_target_id AND removed_at IS NULL
    RETURNING ghost_id INTO v_removed_ghost;
  ELSE
    UPDATE public.comments SET removed_at = now(), removed_reason = COALESCE(p_reason, p_abuse_type), removed_by = auth.uid()
    WHERE id = p_target_id AND removed_at IS NULL
    RETURNING ghost_id INTO v_removed_ghost;
  END IF;

  IF v_removed_ghost IS NOT NULL THEN
    SELECT id INTO v_owner_id FROM public.profiles WHERE current_ghost_id = v_removed_ghost;

    UPDATE public.profiles
    SET civic_score = GREATEST(civic_score - v_rule.score_penalty, 0)
    WHERE current_ghost_id = v_removed_ghost;

    IF v_owner_id IS NOT NULL AND p_abuse_type = 'spam' THEN
      PERFORM public.record_user_action(v_owner_id, 'spam_removed');
    END IF;

    UPDATE public.content_reports SET status = 'removed'
    WHERE target_type = p_target_type AND target_id = p_target_id AND status = 'open';
  END IF;
END;
$$;

-- The old per-(user_id, post_id) rate limit table -- superseded entirely by
-- user_actions above.
DROP TABLE public.comment_rate_limits;
