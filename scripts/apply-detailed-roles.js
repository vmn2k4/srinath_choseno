const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabase = createClient('https://qlzyfdwrkcxyqapewxwg.supabase.co', 'sb_publishable_m7I392hi0eurPIRFrr6IZQ_VOQa7EzK', {
  auth: { persistSession: false },
  realtime: { transport: WebSocket }
});

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'vmn2k4@gmail.com',
    password: 'Happy@123'
  });
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  console.log('Logged in as admin successfully:', authData.user.email);

  const roles = [
    // Federal
    {
      country: 'Canada',
      boundary_type: 'Federal',
      role_key: 'mp',
      region_override: '',
      role_title: 'MP',
      description: 'Represents the federal riding in the House of Commons in Ottawa. Debates, amends, and votes on federal statutes, taxation, national defense, criminal law (Criminal Code), and international treaties. Sits on parliamentary standing committees and assists constituents navigating federal agencies including the Canada Revenue Agency (CRA), Service Canada (Employment Insurance, OAS/CPP), Canadian passports, and Immigration, Refugees and Citizenship Canada (IRCC).'
    },
    {
      country: 'Canada',
      boundary_type: 'National',
      role_key: 'prime_minister',
      region_override: '',
      role_title: 'Prime Minister',
      description: "Canada's head of government and leader of the federal Cabinet. Sets the national policy and legislative agenda, introduces major federal bills in Parliament, advises the Governor General on key appointments (Supreme Court justices, Senators, Lieutenant Governors), directs national security and international relations, and must maintain the confidence of the House of Commons to govern."
    },

    // Provincial Premiers
    {
      country: 'Canada',
      boundary_type: 'Province',
      role_key: 'premier',
      region_override: '',
      role_title: 'Premier',
      description: 'Head of the provincial government and leader of the provincial Cabinet. Directs provincial legislative priorities, oversees ministries responsible for healthcare delivery, public education, provincial transportation and infrastructure, labor standards, and natural resources, and represents the province in intergovernmental and federal-provincial negotiations.'
    },
    {
      country: 'Canada',
      boundary_type: 'Province',
      role_key: 'premier',
      region_override: 'British Columbia',
      role_title: 'Premier',
      description: 'Head of the Government of British Columbia and Chair of the Executive Council. Leads provincial policy from the Parliament Buildings in Victoria, directs provincial healthcare delivery (Regional Health Authorities & MSP), housing initiatives, clean energy (BC Hydro), public transit (TransLink, BC Transit), environmental regulations, and oversees the multi-billion dollar provincial budget.'
    },
    {
      country: 'Canada',
      boundary_type: 'Province',
      role_key: 'premier',
      region_override: 'Ontario',
      role_title: 'Premier',
      description: "Head of the Government of Ontario and Chair of the Executive Council. Directs provincial policy and budgets at Queen's Park in Toronto, overseeing the Ontario Health Insurance Plan (OHIP), public hospitals, provincial transit (Metrolinx, 400-series highways), energy, labor laws, childcare funding, and municipal governance powers."
    },
    {
      country: 'Canada',
      boundary_type: 'Province',
      role_key: 'premier',
      region_override: 'Quebec',
      role_title: 'Premier',
      description: 'Premier ministre du Québec and President of the Conseil des ministres. Leads government policy in the National Assembly in Quebec City, managing provincial jurisdiction over healthcare (RAMQ), language policy (Charte de la langue française), civil law (Code civil du Québec), immigration selection, provincial revenue (Revenu Québec), and Hydro-Québec.'
    },
    {
      country: 'Canada',
      boundary_type: 'Province',
      role_key: 'premier',
      region_override: 'Alberta',
      role_title: 'Premier',
      description: 'Head of the Government of Alberta and Chair of the Executive Council. Guides legislative priorities at the Legislature Building in Edmonton across healthcare (Alberta Health Services), oil, gas and energy resource stewardship, provincial taxation, agriculture, and municipal affairs.'
    },

    // Provincial Representatives
    {
      country: 'Canada',
      boundary_type: 'Provincial',
      role_key: 'provincial_rep',
      region_override: '',
      role_title: 'MLA',
      description: 'Represents the provincial constituency in the legislative assembly. Debates, amends, and votes on provincial statutes, healthcare funding, K–12 and post-secondary education budgets, provincial policing, and natural resources. Advocates directly for constituents dealing with provincial ministries and public services.'
    },
    {
      country: 'Canada',
      boundary_type: 'Provincial',
      role_key: 'provincial_rep',
      region_override: 'British Columbia',
      role_title: 'MLA',
      description: 'Represents the provincial riding in the Legislative Assembly of British Columbia (Victoria). Debates and votes on provincial legislation, the BC provincial budget, healthcare delivery (Medical Services Plan & Regional Health Authorities), K–12 and post-secondary funding, provincial highways, tenancy laws, and environmental policies. Assists constituents with provincial ministries, ICBC, WorkSafeBC, and BC Housing.'
    },
    {
      country: 'Canada',
      boundary_type: 'Provincial',
      role_key: 'provincial_rep',
      region_override: 'Ontario',
      role_title: 'MPP',
      description: "Member of Provincial Parliament representing the riding at Queen's Park in the Legislative Assembly of Ontario (Toronto). Debates and votes on Ontario statutes, regulations, and the provincial fiscal budget. Oversees provincial public services including healthcare (hospitals & OHIP), education curriculum, environmental standards, labor laws, and 400-series highways. Assists constituents with OHIP, ODSP, Ontario Works, and the Landlord and Tenant Board."
    },
    {
      country: 'Canada',
      boundary_type: 'Provincial',
      role_key: 'provincial_rep',
      region_override: 'Quebec',
      role_title: 'MNA',
      description: 'Member of the National Assembly (Député) representing the riding in the Assemblée nationale du Québec (Quebec City). Debates and votes on Quebec legislation, provincial budgets, healthcare and social services (CISSS/CIUSSS networks), education policies, cultural preservation, and environmental laws. Assists constituents with provincial agencies including RAMQ, Retraite Québec, SAAQ, and CNESST.'
    },
    {
      country: 'Canada',
      boundary_type: 'Provincial',
      role_key: 'provincial_rep',
      region_override: 'Newfoundland and Labrador',
      role_title: 'MHA',
      description: "Member of the House of Assembly representing the district in the House of Assembly of Newfoundland and Labrador at Confederation Building in St. John's. Votes on provincial laws, the provincial budget, offshore energy resources, fisheries, provincial roads, and rural healthcare delivery."
    },
    {
      country: 'Canada',
      boundary_type: 'Provincial',
      role_key: 'provincial_rep',
      region_override: 'Alberta',
      role_title: 'MLA',
      description: 'Member of the Legislative Assembly representing the constituency in the Legislative Assembly of Alberta (Edmonton). Debates and votes on provincial laws, energy policies, education funding, healthcare system reforms, and the provincial budget. Sits on legislative policy committees and helps constituents with provincial programs including Alberta Health Care, AISH, and Student Aid Alberta.'
    },

    // Municipal Mayors
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'mayor',
      region_override: '',
      role_title: 'Mayor',
      description: 'Chief executive and presiding officer of municipal council. Sets the agenda for council deliberations, acts as the primary public representative of the municipality, leads municipal strategic planning, and works with councillors to pass the annual municipal budget, zoning bylaws, and local infrastructure projects.'
    },
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'mayor',
      region_override: 'British Columbia',
      role_title: 'Mayor',
      description: 'Chief Executive Officer and leader of municipal council under the BC Community Charter and Local Government Act. Presides over council meetings, represents the municipality on regional district boards (e.g. Metro Vancouver), chairs the municipal Police Board (where a municipal police department operates), and provides civic leadership on housing, zoning, and local capital projects.'
    },
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'mayor',
      region_override: 'Ontario',
      role_title: 'Mayor',
      description: 'Head of municipal council under the Ontario Municipal Act (or City of Toronto Act). Presides over council deliberations, represents the city, and in designated large municipalities, exercises "Strong Mayor" powers to propose the annual budget, appoint municipal leadership, and veto certain bylaws to advance provincial housing and transit priorities.'
    },
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'mayor',
      region_override: 'Alberta',
      role_title: 'Mayor',
      description: 'Head of council for a city, town, village, or municipal district under the Alberta Municipal Government Act. Presides over council meetings, represents the municipality in intergovernmental partnerships, and provides leadership on local economic development, capital projects, and community services.'
    },
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'mayor',
      region_override: 'Quebec',
      role_title: 'Mayor',
      description: 'Maire / Mairesse leading the municipal council under the Loi sur les cités et villes (or Montreal/Quebec City charters). Directs municipal priorities across public transit, urban development, emergency services, water infrastructure, and local economic development.'
    },

    // Municipal Councillors
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'councillor',
      region_override: '',
      role_title: 'Councillor',
      description: 'Elected member of municipal council representing a ward or the municipality at large. Votes on municipal bylaws, annual operating and capital budgets, property tax rates, land-use zoning, development permits, local roads, parks, recreation facilities, and municipal utilities.'
    },
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'councillor',
      region_override: 'British Columbia',
      role_title: 'Councillor',
      description: 'Elected at-large or by ward to municipal council. Votes on municipal bylaws, annual property tax rates, operating and capital budgets, Official Community Plans (OCP), land-use zoning, development permits, local infrastructure (roads, water, sewage), parks, recreation, and emergency services.'
    },
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'councillor',
      region_override: 'Ontario',
      role_title: 'Councillor',
      description: 'Represents a municipal ward on city or local council. In two-tier regional municipalities (e.g. Peel, York, Durham, Halton, Waterloo), Regional Councillors also sit on Regional Council to govern regional policing, paramedic services, regional roads, waste management, public health, and social housing.'
    },
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'councillor',
      region_override: 'Alberta',
      role_title: 'Councillor',
      description: 'Represents an electoral ward or rural division under the Alberta Municipal Government Act. Establishes municipal property tax rates, passes land-use and development bylaws, funds emergency services, transit, and local roads, and approves municipal capital budgets.'
    },
    {
      country: 'Canada',
      boundary_type: 'Municipal',
      role_key: 'councillor',
      region_override: 'Quebec',
      role_title: 'Councillor',
      description: "Conseiller municipal / Conseiller d'arrondissement voting on municipal regulations, urban planning, municipal budgets, local bylaws, and neighborhood services."
    },

    // School District Trustees
    {
      country: 'Canada',
      boundary_type: 'School District',
      role_key: 'trustee',
      region_override: '',
      role_title: 'School Trustee',
      description: 'Elected member of a local school board or school division. Governs the school district under provincial education legislation, establishes local educational policies, approves the annual school board operating budget, plans capital improvements and new school facilities, and oversees educational programs and student achievement.'
    },
    {
      country: 'Canada',
      boundary_type: 'School District',
      role_key: 'trustee',
      region_override: 'British Columbia',
      role_title: 'School Trustee',
      description: "Elected member of the local Board of Education governing a BC School District under the BC School Act. Sets the district's multi-million dollar annual operating budget, establishes local educational and student-welfare policies, plans capital projects and school expansions/renovations, allocates funding across neighborhood schools, and hires and supervises the Superintendent of Schools."
    },
    {
      country: 'Canada',
      boundary_type: 'School District',
      role_key: 'trustee',
      region_override: 'Ontario',
      role_title: 'School Trustee',
      description: "Elected trustee governing one of Ontario's four publicly funded school board systems (English Public, English Catholic, French Public, French Catholic) under the Ontario Education Act. Approves the multi-year strategic plan, establishes the annual school board budget, makes decisions on school construction, boundary reviews, and program delivery, and ensures compliance with provincial curriculum guidelines."
    },
    {
      country: 'Canada',
      boundary_type: 'School District',
      role_key: 'trustee',
      region_override: 'Alberta',
      role_title: 'School Trustee',
      description: 'Elected representative on a Public, Separate (Catholic), or Francophone Regional School Division Board under the Alberta Education Act. Manages local education funding allocated by Alberta Education, approves school division policies, oversees local school facilities, and advocates for quality education and student achievement in the community.'
    },

    // School District Board Chair
    {
      country: 'Canada',
      boundary_type: 'School District',
      role_key: 'board_chair',
      region_override: '',
      role_title: 'Board Chair',
      description: 'Elected by fellow School Trustees to preside over the Board of Education or School Board. Chairs public board meetings, serves as the official spokesperson for the school district, represents the board in consultations with the provincial Ministry of Education, and signs official contracts, bylaws, and collective agreements.'
    },
    {
      country: 'Canada',
      boundary_type: 'School District',
      role_key: 'board_chair',
      region_override: 'British Columbia',
      role_title: 'Board Chair',
      description: 'Elected by fellow Trustees to lead the Board of Education for a BC School District. Presides over public board meetings, acts as the official spokesperson for the school district, represents the board in government consultations with the BC Ministry of Education and Child Care, and signs official contracts, bylaws, and collective agreements on behalf of the district.'
    }
  ];

  for (const r of roles) {
    const { error: upsertErr } = await supabase.from('election_role_types').upsert(r, {
      onConflict: 'country,boundary_type,role_key,region_override'
    });
    if (upsertErr) {
      console.error('Error upserting', r.role_title, r.region_override, upsertErr);
    } else {
      console.log(`✓ Upserted [${r.boundary_type}] ${r.role_title} (${r.region_override || 'default'})`);
    }
  }

  console.log('\nAll detailed province role types successfully applied!');
}

run();
