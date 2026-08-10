-- Registers India as a country and its two boundary types that are ready to
-- load now: Lok Sabha (MP constituencies, 543 seats, verified clean source
-- data) and State (28 states + 8 UTs outlines, pure admin container — no
-- directly-elected statewide office in India, Governor is appointed not
-- elected, so this mirrors Canada's Province: admin_only=true, is_container=
-- true). Vidhan Sabha (MLA/assembly constituencies) deliberately NOT
-- registered yet — the best available source has real data-quality problems
-- (Andhra Pradesh/Telangana boundary confusion, duplicate/junk rows) that
-- need resolving first. See docs/adding-india-boundary-data.md for the full
-- research log and status.

INSERT INTO public.countries (name, code, flag_emoji) VALUES ('India', 'IN', '🇮🇳');

INSERT INTO public.country_boundary_types (country, type_name, rank, admin_only, is_container)
VALUES ('India', 'Lok Sabha', 1, false, false);

INSERT INTO public.country_boundary_types (country, type_name, rank, admin_only, is_container)
VALUES ('India', 'State', 2, true, true);
