-- The Candidates & Representatives sidebar (getInterestedPoliticians) needs to
-- discover which OTHER politicians live in a given boundary, not just the
-- querying user's own memberships. The existing "Users can read own
-- memberships" policy (auth.uid() = profile_id) blocks that for every other
-- user. Mirror the existing "Public can view politician profiles" policy on
-- public.profiles: expose a politician's own boundary memberships publicly,
-- while ordinary citizens' memberships stay private (RLS policies are OR'd,
-- so this is additive and doesn't touch the existing self-read policy).
CREATE POLICY "Public can view politician memberships" ON public.user_boundary_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_boundary_memberships.profile_id AND p.role = 'politician'
    )
  );
