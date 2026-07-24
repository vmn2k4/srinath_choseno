-- profiles.SELECT was own-row-only, which silently breaks any feature that
-- needs to show a politician's name to someone else — including the
-- pre-existing PoliticianWall page and the new Election candidate views.
-- Politicians are meant to be publicly identifiable (that's the whole premise
-- of politician_profiles/PoliticianWall); citizens stay private since they're
-- never looked up by profile id anywhere in the app, only by ghost_id.
CREATE POLICY "Public can view politician profiles" ON public.profiles
  FOR SELECT USING (role = 'politician');
