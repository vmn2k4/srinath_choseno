-- Political parties become an admin-managed, country-scoped list (mirrors
-- country_boundary_types) instead of a free-text field on politician_profiles
-- -- so the profile form can offer a dropdown instead of a "type it yourself"
-- box, and the party name a politician displays is consistent/spellchecked.
CREATE TABLE public.political_parties (
  id bigserial PRIMARY KEY,
  country text NOT NULL REFERENCES public.countries(name) ON DELETE CASCADE,
  name text NOT NULL,
  rank int NOT NULL DEFAULT 999,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, name)
);

ALTER TABLE public.political_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read political parties"
  ON public.political_parties FOR SELECT USING (true);

CREATE POLICY "Admins manage political parties"
  ON public.political_parties FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Starter lists per country's major parties + Independent. Admin can add
-- more later (e.g. provincial-level parties) once that need actually comes up.
INSERT INTO public.political_parties (country, name, rank) VALUES
  ('Canada', 'Liberal Party', 1),
  ('Canada', 'Conservative Party', 2),
  ('Canada', 'New Democratic Party (NDP)', 3),
  ('Canada', 'Bloc Québécois', 4),
  ('Canada', 'Green Party', 5),
  ('Canada', 'People''s Party of Canada', 6),
  ('Canada', 'Independent', 999),
  ('USA', 'Democratic Party', 1),
  ('USA', 'Republican Party', 2),
  ('USA', 'Libertarian Party', 3),
  ('USA', 'Green Party', 4),
  ('USA', 'Independent', 999)
ON CONFLICT (country, name) DO NOTHING;

-- politician_profiles.political_party was free text (only 4 rows exist in
-- this dataset, one holds real content) -- replace it outright with a proper
-- FK rather than keep a parallel legacy column.
ALTER TABLE public.politician_profiles ADD COLUMN political_party_id bigint REFERENCES public.political_parties(id);
ALTER TABLE public.politician_profiles DROP COLUMN political_party;
