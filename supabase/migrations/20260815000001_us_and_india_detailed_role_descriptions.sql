-- Detailed, comprehensive role descriptions for official elected roles in USA and India.

-- 1. Upsert USA official role descriptions
INSERT INTO public.election_role_types (country, boundary_type, role_key, region_override, role_title, description) VALUES
  ('USA', 'National', 'president', '', 'President',
   'The President of the United States serves as Head of State, Head of Government, and Commander-in-Chief of the U.S. Armed Forces. Directs federal executive departments and agencies, executes and enforces federal laws passed by Congress, signs or vetoes federal legislation, negotiates international treaties, conducts foreign policy, and appoints federal judges, Supreme Court justices, ambassadors, and Cabinet secretaries subject to U.S. Senate confirmation.'),

  ('USA', 'State', 'us_senator', '', 'U.S. Senator',
   'Represents the entire state in the United States Senate in Washington, D.C. Authors, debates, and votes on federal legislation, federal taxation, and national appropriations. Holds exclusive constitutional powers of "Advice and Consent" to confirm federal judges, Supreme Court justices, and presidential Cabinet appointments, ratify international treaties by two-thirds vote, and try impeachment cases delivered by the House of Representatives.'),

  ('USA', 'Federal', 'us_representative', '', 'U.S. Representative',
   'Represents the congressional district in the U.S. House of Representatives in Washington, D.C. Introduces and votes on federal legislation, holds the exclusive constitutional authority to originate all federal revenue and tax bills, authorizes federal agency appropriations, and serves on key congressional committees. Directly assists district constituents with federal agencies including the Internal Revenue Service (IRS), Social Security Administration, Veterans Affairs (VA), and U.S. Passports.'),

  ('USA', 'State', 'governor', '', 'Governor',
   'The chief executive of the state government. Implements state laws, commands the state National Guard, and signs or vetoes legislation passed by the state legislature (often with line-item veto authority over state budget appropriations). Prepares and submits the annual state executive budget, appoints heads of state departments and agencies, nominates state judges, and grants executive pardons or commutations.'),

  ('USA', 'State Senate', 'state_senator', '', 'State Senator',
   'Represents the state legislative district in the upper chamber of the state legislature. Authors, debates, and votes on state statutes, the annual state budget, state taxation, education standards, public safety, and transportation funding. In most states, confirms the Governor''s executive appointments to state commissions, departments, and judicial vacancies.'),

  ('USA', 'State House', 'state_representative', '', 'State Representative',
   'Represents the state legislative district in the lower chamber of the state legislature (State House of Representatives, State Assembly, or House of Delegates). Introduces and votes on state legislation, state appropriations, public education funding, healthcare programs (Medicaid), and highway infrastructure. Assists constituents with state agencies including the Department of Motor Vehicles (DMV), state unemployment, and public assistance programs.'),

  ('USA', 'Municipal', 'mayor', '', 'Mayor',
   'Chief executive and official head of city or town municipal government. In "strong-mayor" municipalities, appoints and oversees municipal department heads (police, fire, public works, housing), proposes the annual municipal operating and capital budget, and exercises veto authority. In "council-manager" cities, presides over city council meetings and serves as the city''s chief policy leader and public representative alongside a professional city manager.'),

  ('USA', 'Municipal', 'council_member', '', 'Council Member',
   'Elected member of city or town council representing a geographic district or the city at large. Enacts municipal ordinances and local codes, adopts the annual city operating budget, approves zoning and land-use development plans, sets local property tax and utility rates, and oversees municipal services including public transit, sanitation, parks, and libraries.')

ON CONFLICT (country, boundary_type, role_key, region_override)
DO UPDATE SET
  role_title = EXCLUDED.role_title,
  description = EXCLUDED.description;


-- 2. Upsert India official role descriptions
INSERT INTO public.election_role_types (country, boundary_type, role_key, region_override, role_title, description) VALUES
  ('India', 'National', 'prime_minister', '', 'Prime Minister',
   'Head of the Government of India and leader of the Union Council of Ministers. Appointed by the President as the leader commanding the majority in the Lok Sabha. Directs national policies, national defense, external affairs, atomic energy, space, and the Union Budget. Represents India in international summits and heads key statutory and advisory bodies including NITI Aayog and the National Security Council.'),

  ('India', 'State', 'chief_minister', '', 'Chief Minister',
   'Head of Government for the State and leader of the State Council of Ministers. Appointed by the Governor as the leader commanding the majority in the State Legislative Assembly (Vidhan Sabha). Directs state administration, public order, police, public health, agriculture, irrigation, state infrastructure, and presents the state annual budget.'),

  ('India', 'Lok Sabha', 'mp', '', 'MP',
   'Member of Parliament representing the Parliamentary Constituency in the Lok Sabha (House of the People) in New Delhi. Debates, amends, and votes on central legislation, national taxation, and the Union Budget. Sits on parliamentary standing committees, scrutinizes union ministries, utilizes the Members of Parliament Local Area Development Scheme (MPLADS) funds to build local constituency infrastructure, and assists citizens with central government schemes and services.'),

  ('India', 'Vidhan Sabha', 'mla', '', 'MLA',
   'Member of the Legislative Assembly representing the Assembly Constituency in the State Legislative Assembly (Vidhan Sabha). Debates and votes on state legislation, state taxation, and the annual state budget under State and Concurrent lists (including healthcare, education, agriculture, roads, and law & order). Utilizes MLA Local Area Development Scheme (MLALADS) funds for local community development and coordinates directly with district administration and municipal bodies to resolve civic grievances.'),

  ('India', 'Ward', 'councillor', '', 'Corporator / Councillor',
   'Elected municipal representative for the ward in the Municipal Corporation, Municipality, or Town Council (Nagar Nigam / Palika). Decides local civic policies, oversees ward sanitation, road maintenance, street lighting, water supply, drainage, parks, and local building permissions, and manages ward development funds.')

ON CONFLICT (country, boundary_type, role_key, region_override)
DO UPDATE SET
  role_title = EXCLUDED.role_title,
  description = EXCLUDED.description;
