-- Moderation system: reporting/flagging for posts, comments, and politician
-- profiles, with admin-configurable per-abuse-type auto-removal thresholds
-- and score penalties.
--
-- Design decisions (confirmed with product owner before implementation):
--   * Removal is soft-delete (removed_at/removed_reason/removed_by) so an
--     admin can review/undo, not a hard DELETE.
--   * The civic_score penalty applies once, only when content is actually
--     confirmed removed (auto-threshold hit or admin manual removal) --
--     never per individual report -- to avoid a handful of colluding
--     accounts tanking someone's score before any real review happens.
--   * civic_score floors at 0 (GREATEST(... , 0)), never goes negative.
--   * politician_profile reports never trigger an automatic action (there's
--     no sane "soft-delete a profile" operation) -- they just accumulate in
--     the admin queue for a human to act on via existing tools.

-- 1. Soft-delete columns -----------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_reason TEXT,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_reason TEXT,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES public.profiles(id);

-- 2. Hide removed content from everyone except admins. Each table only
--    has the one blanket SELECT policy from init_schema.sql -- safe to
--    replace outright since Postgres OR-combines permissive policies and
--    there's nothing else that could leak removed rows back in.
DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
CREATE POLICY "Anyone can read non-removed posts" ON public.posts
  FOR SELECT USING (
    removed_at IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Anyone can read comments" ON public.comments;
CREATE POLICY "Anyone can read non-removed comments" ON public.comments
  FOR SELECT USING (
    removed_at IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Moderation rules: one row per abuse type, admin-editable thresholds
--    and penalties.
CREATE TABLE IF NOT EXISTS public.moderation_rules (
  abuse_type TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  auto_remove_threshold INT NOT NULL DEFAULT 30,
  score_penalty INT NOT NULL DEFAULT 10,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read moderation rules" ON public.moderation_rules
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage moderation rules" ON public.moderation_rules
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO public.moderation_rules (abuse_type, label, auto_remove_threshold, score_penalty)
VALUES
  ('spam', 'Spam', 30, 10),
  ('harassment', 'Harassment', 30, 10),
  ('hate_speech', 'Hate Speech', 30, 10),
  ('misinformation', 'Misinformation', 30, 10),
  ('other', 'Other', 30, 10)
ON CONFLICT (abuse_type) DO NOTHING;

-- 4. Content reports: one report per (reporter, target) via the unique
--    constraint -- prevents a single account from inflating a count.
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'politician_profile')),
  target_id UUID NOT NULL,
  abuse_type TEXT NOT NULL REFERENCES public.moderation_rules(abuse_type),
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('open', 'removed', 'dismissed')) DEFAULT 'open',
  UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_target ON public.content_reports(target_type, target_id, abuse_type, status);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
-- No client policies -- all access goes through the RPCs below. Admin FOR
-- ALL kept for convenience/ad-hoc debugging via the SQL editor, matching
-- how every other admin-only table in this codebase is gated.
CREATE POLICY "Admins can manage content reports" ON public.content_reports
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. report_content(): the only way a normal user can create a report.
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
      UPDATE public.profiles
      SET civic_score = GREATEST(civic_score - v_rule.score_penalty, 0)
      WHERE current_ghost_id = v_removed_ghost;

      UPDATE public.content_reports SET status = 'removed'
      WHERE target_type = p_target_type AND target_id = p_target_id
        AND abuse_type = p_abuse_type AND status = 'open';
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_content(TEXT, UUID, TEXT) TO authenticated;

-- 6. admin_remove_content(): manual removal, same idempotent soft-delete +
--    penalty logic, gated by the standard inline admin-role check.
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
    UPDATE public.profiles
    SET civic_score = GREATEST(civic_score - v_rule.score_penalty, 0)
    WHERE current_ghost_id = v_removed_ghost;

    UPDATE public.content_reports SET status = 'removed'
    WHERE target_type = p_target_type AND target_id = p_target_id AND status = 'open';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_remove_content(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- 7. admin_dismiss_reports(): false-positive handling, no content change.
CREATE OR REPLACE FUNCTION public.admin_dismiss_reports(
  p_target_type TEXT,
  p_target_id UUID,
  p_abuse_type TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.content_reports SET status = 'dismissed'
  WHERE target_type = p_target_type AND target_id = p_target_id AND status = 'open'
    AND (p_abuse_type IS NULL OR abuse_type = p_abuse_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dismiss_reports(TEXT, UUID, TEXT) TO authenticated;

-- 8. admin_update_moderation_rule(): lets admin tune threshold/penalty/
--    enabled per abuse type.
CREATE OR REPLACE FUNCTION public.admin_update_moderation_rule(
  p_abuse_type TEXT,
  p_auto_remove_threshold INT,
  p_score_penalty INT,
  p_enabled BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.moderation_rules
  SET auto_remove_threshold = p_auto_remove_threshold,
      score_penalty = p_score_penalty,
      enabled = p_enabled,
      updated_at = now()
  WHERE abuse_type = p_abuse_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_moderation_rule(TEXT, INT, INT, BOOLEAN) TO authenticated;

-- 9. get_moderation_queue(): admin report queue, grouped by target+abuse
--    type, open reports only.
CREATE OR REPLACE FUNCTION public.get_moderation_queue()
RETURNS TABLE (
  target_type TEXT,
  target_id UUID,
  abuse_type TEXT,
  report_count BIGINT,
  last_reported_at TIMESTAMPTZ,
  is_removed BOOLEAN,
  content_snippet TEXT,
  author_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT 'post'::TEXT, p.id, cr.abuse_type, count(*)::BIGINT, max(cr.created_at),
         bool_or(p.removed_at IS NOT NULL), LEFT(p.content, 200), p.ghost_id::TEXT
  FROM public.content_reports cr
  JOIN public.posts p ON p.id = cr.target_id AND cr.target_type = 'post'
  WHERE cr.status = 'open'
  GROUP BY p.id, cr.abuse_type

  UNION ALL

  SELECT 'comment'::TEXT, c.id, cr.abuse_type, count(*)::BIGINT, max(cr.created_at),
         bool_or(c.removed_at IS NOT NULL), LEFT(c.content, 200), c.ghost_id::TEXT
  FROM public.content_reports cr
  JOIN public.comments c ON c.id = cr.target_id AND cr.target_type = 'comment'
  WHERE cr.status = 'open'
  GROUP BY c.id, cr.abuse_type

  UNION ALL

  SELECT 'politician_profile'::TEXT, pr.id, cr.abuse_type, count(*)::BIGINT, max(cr.created_at),
         false, pr.full_name, pr.full_name
  FROM public.content_reports cr
  JOIN public.profiles pr ON pr.id = cr.target_id AND cr.target_type = 'politician_profile'
  WHERE cr.status = 'open'
  GROUP BY pr.id, cr.abuse_type

  ORDER BY 4 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_moderation_queue() TO authenticated;
