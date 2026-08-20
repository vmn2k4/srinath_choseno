-- Add DELETE policies for admins on politician_claim_campaigns and tracking_events
DROP POLICY IF EXISTS "Admins can delete campaign sends" ON public.politician_claim_campaigns;
CREATE POLICY "Admins can delete campaign sends"
  ON public.politician_claim_campaigns FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "tracking_events_delete_admin" ON public.tracking_events;
CREATE POLICY "tracking_events_delete_admin" ON public.tracking_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
    )
  );
