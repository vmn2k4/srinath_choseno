-- get_admin_daily_user_signups() (20260806000010) counted every row in
-- auth.users by created_at, with no check that the account was ever
-- actually confirmed. admin.inviteUserByEmail() (send-claim-invite, the
-- candidacy claim flow) creates that auth.users row -- and a profiles row
-- right behind it via trigger -- the instant an invite is *sent*, before
-- the recipient does anything. Confirmed against a real invite still
-- sitting untouched: auth.users.created_at matched the invite's send time
-- to the second, while confirmed_at/email_confirmed_at/last_sign_in_at
-- were all null. Every candidate-claim invite sent was therefore
-- permanently inflating the "Daily Signups & Email Directory" panel by one
-- ghost entry, whether the recipient ever opened it or not.
--
-- Fix: only count accounts that actually completed confirmation --
-- email_confirmed_at is set once /auth/confirm's verifyOtp() runs, the
-- same distinction list_candidate_claim_invite_status()'s `signed_up`
-- column (20260911000000) already makes for the same reason.
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
  WHERE u.email_confirmed_at IS NOT NULL
  GROUP BY (u.created_at AT TIME ZONE 'UTC')::DATE
  ORDER BY (u.created_at AT TIME ZONE 'UTC')::DATE DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_daily_user_signups() TO authenticated;
