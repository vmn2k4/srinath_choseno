-- Let users flag an office holder directory listing (name/role/party/photo/
-- contact details sourced from public.office_holders, shown on the
-- elections/[boundarySlug] directory and /find-my-district pages) as
-- factually wrong, and let admins see those reports in the existing
-- moderation queue.
--
-- Reuses the content_reports/moderation_rules machinery added in
-- 20260804000007_moderation_system.sql wholesale -- same report_content()
-- RPC, same get_moderation_queue() admin view, same per-abuse-type rules --
-- rather than standing up a parallel "correction request" system. Only
-- addition: a new target_type ('office_holder', distinct from
-- 'politician_profile' since most office_holders rows have no claimed/linked
-- profile at all -- see office_holders.linked_profile_id) and a new
-- abuse_type ('incorrect_info') that actually fits "this data is wrong"
-- better than the existing spam/harassment/hate_speech/misinformation set,
-- which was written for user-generated content, not admin-entered directory
-- data.

-- 1. New abuse type, usable by any target_type.
INSERT INTO public.moderation_rules (abuse_type, label, auto_remove_threshold, score_penalty)
VALUES ('incorrect_info', 'Incorrect Information', 30, 10)
ON CONFLICT (abuse_type) DO NOTHING;

-- 2. Widen content_reports.target_type to accept 'office_holder'. The
--    original CHECK was unnamed in its CREATE TABLE, so Postgres assigned it
--    the standard <table>_<column>_check name -- drop and recreate under
--    that same name rather than leaving a stray duplicate constraint.
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type IN ('post', 'comment', 'politician_profile', 'office_holder'));

-- 3. report_content(): add the office_holder branch. No self-report/ghost
--    check needed (unlike politician_profile, an office_holders row isn't a
--    user account someone could be reporting themselves), and -- same as
--    politician_profile -- it's excluded from the auto-remove path below via
--    the existing "IF p_target_type NOT IN ('post', 'comment') THEN RETURN"
--    guard, since there's no sane "soft-delete a directory listing"
--    operation; reports just accumulate for an admin to review and correct
--    via the office-holders admin tool.
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
  ELSIF p_target_type = 'office_holder' THEN
    NULL; -- directory listing, not a user account -- nothing to self-check
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

-- 4. get_moderation_queue(): add the office_holder branch. content_snippet
--    carries role + boundary (e.g. "MLA · Vancouver-West End") since that's
--    what an admin actually needs to locate the record in the office-holders
--    admin tool (which is search-driven, not ID-addressable); author_label
--    carries the office holder's own name, matching how the politician_profile
--    branch already repurposes author_label as a plain name rather than a
--    ghost-decoded author.
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

  UNION ALL

  SELECT 'office_holder'::TEXT, oh.id, cr.abuse_type, count(*)::BIGINT, max(cr.created_at),
         false,
         COALESCE(ert.role_title, 'Unknown role') || ' · ' || COALESCE(ms.name, 'Unknown boundary'),
         oh.full_name
  FROM public.content_reports cr
  JOIN public.office_holders oh ON oh.id = cr.target_id AND cr.target_type = 'office_holder'
  LEFT JOIN public.election_role_types ert ON ert.id = oh.election_role_type_id
  LEFT JOIN public.map_shapes ms ON ms.id = oh.map_shape_id
  WHERE cr.status = 'open'
  GROUP BY oh.id, cr.abuse_type, ert.role_title, ms.name

  ORDER BY 4 DESC;
END;
$$;
