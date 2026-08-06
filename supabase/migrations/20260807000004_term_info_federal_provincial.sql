-- Fill in term_length_months/voting_method for the boundary types where a
-- single, honest national-level default exists. Left NULL where the
-- boundary type covers more than one office with different terms (USA
-- "State" hosts both Governor [4yr] and U.S. Senator [6yr]) or where the
-- real-world value is too jurisdiction-specific to assert one number
-- (USA "Municipal" terms vary city to city).
UPDATE public.country_boundary_types
SET term_length_months = 48, voting_method = 'first_past_post',
    description = 'House of Commons (MP); fixed-date law sets ~4-year terms (constitutional maximum 5 years), no term limit.'
WHERE country = 'Canada' AND type_name = 'Federal';

UPDATE public.country_boundary_types
SET term_length_months = 48, voting_method = 'first_past_post',
    description = 'Provincial/territorial legislature; most provinces use fixed 4-year terms, no term limit (exact date rules vary by province).'
WHERE country = 'Canada' AND type_name = 'Provincial';

UPDATE public.country_boundary_types
SET description = 'Local council; most provinces now use 4-year terms (BC since 2018), no term limit.'
WHERE country = 'Canada' AND type_name = 'Municipal';

UPDATE public.country_boundary_types
SET term_length_months = 24, voting_method = 'first_past_post',
    description = 'U.S. House of Representatives; 2-year term, no term limit.'
WHERE country = 'USA' AND type_name = 'Federal';

UPDATE public.country_boundary_types
SET term_length_months = 48, voting_method = 'first_past_post',
    description = 'State senate; most states use 4-year terms (some vary 2-4 years), term limits vary by state.'
WHERE country = 'USA' AND type_name = 'State Senate';

UPDATE public.country_boundary_types
SET term_length_months = 24, voting_method = 'first_past_post',
    description = 'State house/assembly; most states use 2-year terms (some vary), term limits vary by state.'
WHERE country = 'USA' AND type_name = 'State House';

UPDATE public.country_boundary_types
SET voting_method = 'first_past_post',
    description = 'City/local council; term length varies by municipality (commonly 2 or 4 years).'
WHERE country = 'USA' AND type_name = 'Municipal';

UPDATE public.country_boundary_types
SET voting_method = 'first_past_post',
    description = 'Covers both Governor (typically 4-year term; term limits vary by state) and U.S. Senator (6-year term, no term limit) -- see role for specifics.'
WHERE country = 'USA' AND type_name = 'State';
