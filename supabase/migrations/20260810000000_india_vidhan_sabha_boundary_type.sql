-- Registers India's Vidhan Sabha (State Legislative Assembly / MLA) constituencies,
-- the third and final India boundary layer alongside Lok Sabha and State (see
-- 20260809000004_india_country_and_boundary_types.sql). Held back originally because
-- every open dataset checked had Andhra Pradesh/Telangana boundary confusion (Telangana
-- was carved out of AP in 2014, and most public GIS exports never got updated) — resolved
-- by finding a live Government of India (NIC) ArcGIS service with the two states correctly
-- split (175 + 119 seats, both exact matches to the real current counts). See
-- docs/adding-india-boundary-data.md for the full source-finding writeup.

UPDATE public.country_boundary_types SET rank = 3 WHERE country = 'India' AND type_name = 'State';

INSERT INTO public.country_boundary_types (country, type_name, rank, admin_only, is_container)
VALUES ('India', 'Vidhan Sabha', 2, false, false);
