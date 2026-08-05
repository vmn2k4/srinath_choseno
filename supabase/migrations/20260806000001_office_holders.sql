-- Current officeholders (e.g. "who is the current Mayor of Surrey") -- distinct
-- from election_candidates, which tracks people *running*, not who currently
-- holds the seat. Keyed by (map_shape_id, election_role_type_id) rather than
-- election_seat_id because an officeholder persists independent of any one
-- election cycle -- a seat can be closed/reopen across elections while the
-- same person still holds office between them.
--
-- v1 write model is admin-only, entered manually (same trust tier as
-- political_parties/election_role_types) -- no automated sourcing yet. See
-- ARCHITECTURE.md / ELECTION_DATA_SOURCES.md if that changes later.
CREATE TABLE public.office_holders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_shape_id bigint NOT NULL REFERENCES public.map_shapes(id) ON DELETE CASCADE,
  election_role_type_id uuid NOT NULL REFERENCES public.election_role_types(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  political_party_id bigint REFERENCES public.political_parties(id),
  bio text,
  source_url text,
  photo_url text,
  holding_since date,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (map_shape_id, election_role_type_id)
);

CREATE INDEX idx_office_holders_map_shape ON public.office_holders(map_shape_id);

ALTER TABLE public.office_holders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read office holders"
  ON public.office_holders FOR SELECT USING (true);

CREATE POLICY "Admins manage office holders"
  ON public.office_holders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
