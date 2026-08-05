-- Plain-language description of what each office actually does, for the public
-- boundary directory pages (/elections/[boundarySlug]) -- lets a page explain
-- "what does a Mayor decide" even before any candidate has registered, instead
-- of the page being empty until someone signs up. Written once per role (keyed
-- the same way election_role_types already is), reused across every boundary
-- that role applies to.

ALTER TABLE public.election_role_types ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE public.election_role_types SET description = CASE
  WHEN country = 'Canada' AND role_key = 'mp' THEN
    'Represents the riding in the House of Commons. Votes on federal laws and the federal budget, and can serve in Cabinet if their party forms government.'
  WHEN country = 'Canada' AND role_key = 'provincial_rep' AND region_override = '' THEN
    'Represents the riding in the provincial legislature. Votes on provincial laws covering health care, education, and policing, and can serve in the provincial Cabinet.'
  WHEN country = 'Canada' AND role_key = 'provincial_rep' AND region_override = 'Ontario' THEN
    'Ontario''s title for a provincial representative. Represents the riding at Queen''s Park, votes on provincial legislation and the provincial budget.'
  WHEN country = 'Canada' AND role_key = 'provincial_rep' AND region_override = 'Quebec' THEN
    'Quebec''s title for a provincial representative. Represents the riding in the National Assembly, votes on provincial laws and the budget, and can serve in Quebec''s Cabinet.'
  WHEN country = 'Canada' AND role_key = 'provincial_rep' AND region_override = 'Newfoundland and Labrador' THEN
    'Newfoundland and Labrador''s title for a provincial representative. Represents the district in the House of Assembly, voting on provincial laws and the budget.'
  WHEN country = 'Canada' AND role_key = 'mayor' THEN
    'Heads city council, sets the agenda for council meetings, and represents the municipality publicly. In most Canadian municipalities the Mayor also casts a tie-breaking vote on decisions like the municipal budget and zoning.'
  WHEN country = 'Canada' AND role_key = 'councillor' THEN
    'Represents a ward, or the city at large, on council. Votes on the municipal budget, zoning and development approvals, property taxes, and local bylaws.'
  WHEN country = 'USA' AND role_key = 'us_representative' THEN
    'Represents the congressional district in the U.S. House of Representatives. Votes on federal legislation and appropriations bills, and sits on committees that shape specific policy areas.'
  WHEN country = 'USA' AND role_key = 'state_senator' THEN
    'Represents the district in the state senate. Votes on state laws and the state budget, and in many states confirms certain gubernatorial appointments.'
  WHEN country = 'USA' AND role_key = 'state_representative' THEN
    'Represents the district in the state''s lower legislative chamber. Votes on state laws and the state budget alongside the state senate.'
  WHEN country = 'USA' AND role_key = 'mayor' THEN
    'Leads city government. Proposes the municipal budget, appoints department heads in many cities, and represents the city publicly.'
  WHEN country = 'USA' AND role_key = 'council_member' THEN
    'Represents a district, or the city at large, on city council. Votes on the municipal budget, zoning, and local ordinances.'
  WHEN country = 'USA' AND role_key = 'governor' THEN
    'The state''s chief executive. Signs or vetoes state legislation, proposes the state budget, appoints state agency heads and, in many states, judges.'
  WHEN country = 'USA' AND role_key = 'us_senator' THEN
    'Represents the entire state in the U.S. Senate. Votes on federal legislation and the federal budget, and confirms federal judicial and Cabinet appointments.'
  ELSE description
END;
