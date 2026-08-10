-- Fills in election_role_types.description for the three roles added in
-- 20260809000000_national_and_province_head_roles.sql (Prime Minister,
-- Premier, President) -- every other role already has a description
-- (populated separately); these three were left blank at insert time.
UPDATE public.election_role_types
SET description = 'Canada''s head of government. Chairs Cabinet, sets the federal legislative agenda, and represents Canada internationally. Must hold the confidence of the House of Commons to remain in office.'
WHERE country = 'Canada' AND boundary_type = 'National' AND role_key = 'prime_minister';

UPDATE public.election_role_types
SET description = 'A province''s head of government. Chairs the provincial Cabinet, sets the provincial legislative agenda, and oversees ministries responsible for health care, education, and other provincial matters.'
WHERE country = 'Canada' AND boundary_type = 'Province' AND role_key = 'premier';

UPDATE public.election_role_types
SET description = 'The United States'' head of state and head of government. Signs or vetoes federal legislation, commands the armed forces, appoints federal judges and Cabinet officials with Senate confirmation, and conducts foreign policy.'
WHERE country = 'USA' AND boundary_type = 'National' AND role_key = 'president';
