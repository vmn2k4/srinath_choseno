-- country_boundary_types already functions as the per-country entity-type
-- registry (rank, admin_only, is_container). Extend it with election
-- eligibility and per-type governance metadata rather than introducing a
-- new parallel table -- avoids a redundant 1:1 join against a table that
-- already exists for exactly this purpose.
--
-- election_eligible drives the seat-building "target type" dropdown in
-- ElectionsAdminClient: many uploaded boundary sets mix real municipalities
-- with non-electoral entities (regional district electoral areas, Indian
-- reserves, etc.) at the same rank, and this is how those get excluded from
-- ever being offered as an election target while still being visible in the
-- Boundary Visualizer.
ALTER TABLE public.country_boundary_types
  ADD COLUMN election_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN term_length_months integer,
  ADD COLUMN term_limits integer,
  ADD COLUMN voting_method text,
  ADD COLUMN description text;

ALTER TABLE public.country_boundary_types
  ADD CONSTRAINT valid_term_length CHECK (term_length_months IS NULL OR term_length_months > 0),
  ADD CONSTRAINT valid_term_limits CHECK (term_limits IS NULL OR term_limits > 0);
