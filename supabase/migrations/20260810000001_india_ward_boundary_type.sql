-- Registers India's Ward (municipal corporator/councillor constituency) boundaries — the
-- fourth India layer, one level more granular than Vidhan Sabha. Unlike Lok Sabha/Vidhan
-- Sabha/State, there is no single national election authority for this data (municipal
-- elections are run independently by each state, mirroring Canada/USA's municipal
-- situation) — source is the Swachh Bharat Mission - Urban program, which requires every
-- enrolled Urban Local Body to self-report its own ward boundaries. Citizen-facing (a ward
-- elects a real corporator/councillor), so admin_only=false, is_container=false — same
-- treatment as Lok Sabha/Vidhan Sabha. See docs/adding-india-boundary-data.md for the full
-- source-finding and data-cleaning writeup (self-reported state names needed normalizing
-- across 69 spelling variants; only `status='APPROVED'` wards were kept).

INSERT INTO public.country_boundary_types (country, type_name, rank, admin_only, is_container)
VALUES ('India', 'Ward', 4, false, false);
