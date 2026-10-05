-- US House district shapes were named just "Congressional District 5" with only a
-- numeric state code (properties.statefp) -- no state name anywhere. Every
-- state has a District 1..N, so the 435 House seat pages, their place pages and
-- candidate/officeholder pages all shared near-identical titles/H1s/URLs
-- ("Congressional District 8 U.S. Representative 2026") and couldn't match how
-- people search ("Texas 8th district candidates"). Prefix the state onto the
-- shape name; titles, headings, slugs and place pages all derive from it.
--
-- Only name and properties are SET, so the geom/retired_at/boundary_type/country
-- triggers on map_shapes (reconcile_shape_containers / _memberships) do not fire.
-- The previous name is kept in properties.name_before_state_prefix.
--
-- To reverse:
--   UPDATE public.map_shapes SET name = properties->>'name_before_state_prefix',
--          properties = properties - 'name_before_state_prefix'
--    WHERE properties ? 'name_before_state_prefix';
--
-- Not touched: politician_profiles.target_boundary_name and profiles.constituency
-- also hold the old text (no state to rebuild it from); pages prefer the shape
-- name via the candidacy -> seat -> shape join and only fall back to those.
BEGIN;

WITH fips(statefp, state_name) AS (VALUES
 ('01','Alabama'),('02','Alaska'),('04','Arizona'),('05','Arkansas'),('06','California'),('08','Colorado'),('09','Connecticut'),
 ('10','Delaware'),('12','Florida'),('13','Georgia'),('15','Hawaii'),('16','Idaho'),('17','Illinois'),('18','Indiana'),('19','Iowa'),
 ('20','Kansas'),('21','Kentucky'),('22','Louisiana'),('23','Maine'),('24','Maryland'),('25','Massachusetts'),('26','Michigan'),
 ('27','Minnesota'),('28','Mississippi'),('29','Missouri'),('30','Montana'),('31','Nebraska'),('32','Nevada'),('33','New Hampshire'),
 ('34','New Jersey'),('35','New Mexico'),('36','New York'),('37','North Carolina'),('38','North Dakota'),('39','Ohio'),('40','Oklahoma'),
 ('41','Oregon'),('42','Pennsylvania'),('44','Rhode Island'),('45','South Carolina'),('46','South Dakota'),('47','Tennessee'),
 ('48','Texas'),('49','Utah'),('50','Vermont'),('51','Virginia'),('53','Washington'),('54','West Virginia'),('55','Wisconsin'),('56','Wyoming')),
targets AS (
  SELECT ms.id, ms.name AS old_name, f.state_name,
         CASE WHEN ms.name ILIKE '%at large%'
              THEN f.state_name || ' At-Large Congressional District'
              ELSE f.state_name || ' ' || ms.name END AS new_name
  FROM public.map_shapes ms
  JOIN fips f ON f.statefp = ms.properties->>'statefp'
  WHERE ms.country = 'USA' AND ms.boundary_type = 'Federal' AND ms.retired_at IS NULL
    AND (ms.name ~ '^Congressional District [0-9]+$' OR ms.name ILIKE 'Congressional District (at large)')
)
UPDATE public.map_shapes ms
SET name = t.new_name,
    properties = ms.properties || jsonb_build_object('name_before_state_prefix', t.old_name)
FROM targets t
WHERE ms.id = t.id;

COMMIT;
