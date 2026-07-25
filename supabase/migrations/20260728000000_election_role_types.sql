-- Catalog of real elected-position titles per country + boundary_type, so election-seat
-- creation in ElectionsAdmin.jsx can offer real roles (MP, MLA/MPP/MNA/MHA, Mayor,
-- Councillor, ...) instead of a free-text field with no source of truth. role_title on
-- election_seats itself is left untouched (still a plain string) -- this table only feeds
-- the admin UI; it seeds what gets written there.
--
-- region_override uses '' (empty string) as the "no override, use the default for this
-- country+boundary_type" sentinel rather than NULL. Postgres unique indexes treat every NULL
-- as distinct from every other NULL, so UNIQUE(...) with a nullable region_override would
-- silently allow multiple "default" rows per role_key -- '' is a real, comparable value and
-- keeps the constraint meaningful.
--
-- FK to country_boundary_types(country, type_name) so a typo'd boundary_type fails loudly at
-- migration time instead of silently producing a catalog entry nothing will ever match --
-- same reasoning as map_shapes' existing FK to the same target.
CREATE TABLE public.election_role_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  boundary_type TEXT NOT NULL,
  role_key TEXT NOT NULL,
  region_override TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (country, boundary_type) REFERENCES public.country_boundary_types(country, type_name),
  UNIQUE(country, boundary_type, role_key, region_override)
);

ALTER TABLE public.election_role_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "election_role_types are viewable by everyone"
  ON public.election_role_types FOR SELECT
  USING (true);

CREATE POLICY "election_role_types are manageable by admins"
  ON public.election_role_types FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed data. type_name strings verified live against country_boundary_types before writing
-- this migration (Canada: Federal/Municipal/Provincial; USA: Federal/State Senate/State
-- House/Municipal -- USA/State is registered by a later migration in this same batch).
-- Region names verified live against map_shapes (boundary_type='Province', country='Canada').
INSERT INTO public.election_role_types (country, boundary_type, role_key, region_override, role_title) VALUES
  ('Canada', 'Federal', 'mp', '', 'MP'),

  ('Canada', 'Provincial', 'provincial_rep', '', 'MLA'),
  ('Canada', 'Provincial', 'provincial_rep', 'Ontario', 'MPP'),
  ('Canada', 'Provincial', 'provincial_rep', 'Quebec', 'MNA'),
  ('Canada', 'Provincial', 'provincial_rep', 'Newfoundland and Labrador', 'MHA'),

  ('Canada', 'Municipal', 'mayor', '', 'Mayor'),
  ('Canada', 'Municipal', 'councillor', '', 'Councillor'),

  ('USA', 'Federal', 'us_representative', '', 'U.S. Representative'),
  ('USA', 'State Senate', 'state_senator', '', 'State Senator'),
  ('USA', 'State House', 'state_representative', '', 'State Representative'),
  ('USA', 'Municipal', 'mayor', '', 'Mayor'),
  ('USA', 'Municipal', 'council_member', '', 'Council Member');
