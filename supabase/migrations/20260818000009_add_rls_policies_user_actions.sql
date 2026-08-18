-- Add RLS policies for user_actions table (user analytics/audit log)
-- This table had RLS disabled but full anon/authenticated CRUD grants,
-- allowing any anonymous visitor to read all user action history.

-- Users should only read their own action history
CREATE POLICY "Users can read own actions"
  ON public.user_actions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins should be able to read all actions for analytics/moderation
CREATE POLICY "Admins can read all actions"
  ON public.user_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Only admins should be able to insert actions (system tracking, not user-initiated)
CREATE POLICY "Admins can insert actions"
  ON public.user_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Prevent modifications/deletions (user_actions is an append-only audit log)
-- Implicitly no policy for UPDATE/DELETE means anon/authenticated cannot modify history
