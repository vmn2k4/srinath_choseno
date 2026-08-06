-- Per-shape entity classification, distinct from country_boundary_types.
-- boundary_type ("Municipal") is too coarse: BC's Municipal type alone
-- contains 751 map_shapes rows from a single StatsCan census-subdivision
-- upload, but only ~160 are real incorporated municipalities -- the rest
-- are Indian reserves, regional district electoral areas, treaty lands,
-- etc, all sharing that one boundary_type. This table classifies at the
-- shape level via a small fixed set of categories (grouped from StatsCan's
-- ~50 raw CSDTYPE codes -- see src/lib/utils/censusSubdivisionEntityTypes.ts
-- for the code-to-category mapping) rather than adding a column to
-- map_shapes: classification is derived at query time from the CSDTYPE
-- already present in every shape's properties JSONB, so no backfill is
-- needed and future uploads classify automatically.
CREATE TABLE public.entity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL REFERENCES public.countries(name),
  name text NOT NULL,
  election_eligible boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, name)
);

INSERT INTO public.entity_types (country, name, election_eligible, description) VALUES
('Canada', 'Municipality', true, 'Incorporated city, town, village, district, or regional municipality with a standard local council election.'),
('Canada', 'Indian Reserve', false, 'Federal Indian reserve, governed by band council under the Indian Act -- not a municipal election.'),
('Canada', 'Indian Settlement', false, 'Indian settlement or Indian government district -- not a standard incorporated municipality.'),
('Canada', 'Regional Electoral Area', false, 'Unincorporated area represented by an elected regional district director, not a municipal council (BC).'),
('Canada', 'Treaty / Self-Governing Land', false, 'Land governed under its own treaty or self-government agreement (Nisga''a, Tsawwassen, Tla''amin, Cree/Naskapi/Inuit lands) -- outside standard municipal election law.'),
('Canada', 'Other / Unorganized', false, 'Unorganized territory or an administrative type without a standard local election -- lumped here pending case-by-case admin review.');

ALTER TABLE public.entity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read entity types"
  ON public.entity_types FOR SELECT USING (true);

CREATE POLICY "Admins manage entity types"
  ON public.entity_types FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
