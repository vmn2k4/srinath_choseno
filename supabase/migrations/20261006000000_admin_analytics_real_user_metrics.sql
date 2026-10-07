-- Admin analytics headline numbers (Total Posts / Comments / Accounts, DNU,
-- DAU/WAU/MAU) were counting everything: the ~36K imported politician
-- profiles that have no auth.users row, auto-generated news wall posts
-- (posts.news_article_id), admin-authored posts, test accounts and the
-- mailsac.com QA mailboxes.
--
-- "Real user" = a confirmed auth.users account that is not an admin, not
-- flagged is_test, and not on a mailsac.com address. Posts/comments are
-- attributed through profiles.current_ghost_id, so content authored by
-- anything without a matching real profile (news bot, admins, test users)
-- is excluded. Caveat: a ghost id that was later burned no longer matches
-- its owner, so that user's pre-burn content is not counted.
CREATE OR REPLACE FUNCTION public.get_admin_real_user_metrics(
  p_start_of_today TIMESTAMPTZ,
  p_past_24h TIMESTAMPTZ,
  p_past_7d TIMESTAMPTZ,
  p_past_30d TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  WITH real_users AS (
    SELECT p.id, p.current_ghost_id::text AS ghost_id, p.created_at, p.updated_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email_confirmed_at IS NOT NULL
      AND p.role <> 'admin'
      AND NOT COALESCE(p.is_test, false)
      AND COALESCE(u.email, '') NOT ILIKE '%mailsac%'
  ),
  rp AS (
    SELECT po.created_at, po.ghost_id::text AS ghost_id
    FROM public.posts po
    JOIN real_users r ON r.ghost_id = po.ghost_id::text
    WHERE po.is_test = false AND po.news_article_id IS NULL
  ),
  rc AS (
    SELECT c.created_at, c.ghost_id::text AS ghost_id
    FROM public.comments c
    JOIN real_users r ON r.ghost_id = c.ghost_id::text
    WHERE c.is_test = false
  ),
  active AS (
    SELECT ghost_id AS k, created_at AS t FROM rp
    UNION ALL SELECT ghost_id, created_at FROM rc
    UNION ALL SELECT id::text, updated_at FROM real_users
  )
  SELECT jsonb_build_object(
    'totalPosts', (SELECT count(*) FROM rp),
    'totalComments', (SELECT count(*) FROM rc),
    'totalUsers', (SELECT count(*) FROM real_users),
    'dnu', (SELECT count(*) FROM real_users WHERE created_at >= p_start_of_today),
    'dau', (SELECT count(DISTINCT k) FROM active WHERE t >= p_past_24h),
    'wau', (SELECT count(DISTINCT k) FROM active WHERE t >= p_past_7d),
    'mau', (SELECT count(DISTINCT k) FROM active WHERE t >= p_past_30d),
    'postsToday', (SELECT count(*) FROM rp WHERE created_at >= p_start_of_today),
    'posts7d', (SELECT count(*) FROM rp WHERE created_at >= p_past_7d),
    'posts30d', (SELECT count(*) FROM rp WHERE created_at >= p_past_30d),
    'commentsToday', (SELECT count(*) FROM rc WHERE created_at >= p_start_of_today),
    'comments7d', (SELECT count(*) FROM rc WHERE created_at >= p_past_7d),
    'comments30d', (SELECT count(*) FROM rc WHERE created_at >= p_past_30d)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_real_user_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
