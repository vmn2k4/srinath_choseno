-- Lets citizens dismiss the "an election is happening in your area" banner on FeedPage.jsx
-- per-election, persistently (not per-device, since nothing else in this app uses
-- localStorage for durable state -- the one existing sessionStorage use, UserPage.jsx's
-- country filter, is a "remember last choice" convenience, not a dismiss-forever record).
CREATE TABLE public.election_notification_dismissals (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, election_id)
);

ALTER TABLE public.election_notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own dismissals"
  ON public.election_notification_dismissals FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- No SECURITY DEFINER: every table this touches is already RLS-scoped to exactly what this
-- function needs -- elections/election_seats already allow public SELECT of non-draft rows,
-- and user_boundary_memberships / election_notification_dismissals both already restrict to
-- auth.uid(). A plain invoker-mode function returns identical results and, unlike DEFINER,
-- can't be walked to leak another user's memberships or draft elections if this query is ever
-- extended later by someone who forgets to add an auth.uid() filter. Matches
-- find_shapes_within's existing posture (also plain STABLE SQL, no DEFINER).
CREATE OR REPLACE FUNCTION public.get_active_elections_for_user()
RETURNS TABLE(election_id uuid, election_name text, election_date date, seat_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT e.id, e.name, e.election_date, count(DISTINCT es.id)
  FROM public.elections e
  JOIN public.election_seats es ON es.election_id = e.id
  JOIN public.user_boundary_memberships ubm
    ON ubm.map_shape_id = es.map_shape_id AND ubm.profile_id = auth.uid()
  WHERE e.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.election_notification_dismissals d
      WHERE d.profile_id = auth.uid() AND d.election_id = e.id
    )
  GROUP BY e.id, e.name, e.election_date;
$$;
