-- Migration: 20260806000010_admin_daily_user_signups.sql
-- RPC to allow platform admins to view daily user signups with email addresses, full name, role, and timestamp.

CREATE OR REPLACE FUNCTION public.get_admin_daily_user_signups()
RETURNS TABLE (
  signup_date TEXT,
  user_count BIGINT,
  users JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    to_char((u.created_at AT TIME ZONE 'UTC')::DATE, 'YYYY-MM-DD') AS signup_date,
    COUNT(*)::BIGINT AS user_count,
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'full_name', COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', 'User'),
        'role', COALESCE(p.role, 'citizen'),
        'created_at', u.created_at
      )
      ORDER BY u.created_at DESC
    ) AS users
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  GROUP BY (u.created_at AT TIME ZONE 'UTC')::DATE
  ORDER BY (u.created_at AT TIME ZONE 'UTC')::DATE DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_daily_user_signups() TO authenticated;
