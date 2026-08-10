-- India office-holder roles + political party catalog, mirroring the exact pattern used
-- for Canada/USA (20260809000000_national_and_province_head_roles.sql +
-- 20260728000005_election_role_types_usa_state.sql): a National boundary_type with one
-- placeholder map_shape (geom NULL, admin_only, never geometrically queried) to anchor the
-- Prime Minister's office_holders row, Chief Minister anchored to the existing State
-- container (mirrors Canada's Premier-on-Province / USA's Governor-on-State), and MP/MLA
-- anchored to the existing citizen-facing Lok Sabha/Vidhan Sabha boundary types.
-- See docs/adding-india-politicians.md for the full population plan.

INSERT INTO public.country_boundary_types (country, type_name, rank, admin_only, is_container)
SELECT 'India', 'National', COALESCE(MAX(rank), 0) + 1, true, false
FROM public.country_boundary_types WHERE country = 'India'
ON CONFLICT (country, type_name) DO NOTHING;

INSERT INTO public.map_shapes (country, boundary_type, name)
SELECT 'India', 'National', 'India'
WHERE NOT EXISTS (SELECT 1 FROM public.map_shapes WHERE country = 'India' AND boundary_type = 'National');

INSERT INTO public.election_role_types (country, boundary_type, role_key, region_override, role_title) VALUES
  ('India', 'National', 'prime_minister', '', 'Prime Minister'),
  ('India', 'State', 'chief_minister', '', 'Chief Minister'),
  ('India', 'Lok Sabha', 'mp', '', 'MP'),
  ('India', 'Vidhan Sabha', 'mla', '', 'MLA')
ON CONFLICT (country, boundary_type, role_key, region_override) DO NOTHING;

-- Major national + large regional parties (by current Lok Sabha/state-assembly seat
-- share) -- not exhaustive; India has dozens of smaller regional/state parties that a
-- bulk MP/MLA import's party-name-matching heuristic will fall back to 'Independent' for,
-- same lossy-matching precedent as every Canada/USA populate-*.py script already accepts.
INSERT INTO public.political_parties (country, name, rank) VALUES
  ('India', 'Bharatiya Janata Party', 1),
  ('India', 'Indian National Congress', 2),
  ('India', 'All India Trinamool Congress', 3),
  ('India', 'Dravida Munnetra Kazhagam', 4),
  ('India', 'Samajwadi Party', 5),
  ('India', 'Yuvajana Sramika Rythu Congress Party', 6),
  ('India', 'Janata Dal (United)', 7),
  ('India', 'Shiv Sena', 8),
  ('India', 'Nationalist Congress Party', 9),
  ('India', 'Rashtriya Janata Dal', 10),
  ('India', 'Aam Aadmi Party', 11),
  ('India', 'Telugu Desam Party', 12),
  ('India', 'Communist Party of India (Marxist)', 13),
  ('India', 'Communist Party of India', 14),
  ('India', 'Bahujan Samaj Party', 15),
  ('India', 'Biju Janata Dal', 16),
  ('India', 'Jharkhand Mukti Morcha', 17),
  ('India', 'Janasena Party', 18),
  ('India', 'Lok Janshakti Party (Ram Vilas)', 19),
  ('India', 'All India Majlis-e-Ittehadul Muslimeen', 20),
  ('India', 'Jammu & Kashmir National Conference', 21),
  ('India', 'Jammu & Kashmir Peoples Democratic Party', 22),
  ('India', 'Indian Union Muslim League', 23),
  ('India', 'Rashtriya Lok Dal', 24),
  ('India', 'Shiromani Akali Dal', 25),
  ('India', 'All India United Democratic Front', 26),
  ('India', 'Asom Gana Parishad', 27),
  ('India', 'Naga Peoples Front', 28),
  ('India', 'National Peoples Party', 29),
  ('India', 'Mizo National Front', 30),
  ('India', 'Sikkim Krantikari Morcha', 31),
  ('India', 'Zoram Peoples Movement', 32),
  ('India', 'Independent', 999)
ON CONFLICT (country, name) DO NOTHING;
