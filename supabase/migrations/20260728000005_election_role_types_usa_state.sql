-- Adds the Governor / U.S. Senator role catalog rows for USA's "State" boundary type, now
-- that country_boundary_types has a ('USA','State') row (20260728000003) for
-- election_role_types' FK to reference -- these couldn't be seeded alongside the rest of the
-- catalog in 20260728000000 because that row didn't exist yet.
INSERT INTO public.election_role_types (country, boundary_type, role_key, region_override, role_title) VALUES
  ('USA', 'State', 'governor', '', 'Governor'),
  ('USA', 'State', 'us_senator', '', 'U.S. Senator');
