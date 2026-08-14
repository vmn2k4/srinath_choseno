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
    // USA Official Roles
    {
      country: 'USA',
      boundary_type: 'National',
      role_key: 'president',
      region_override: '',
      role_title: 'President',
      description: 'The President of the United States serves as Head of State, Head of Government, and Commander-in-Chief of the U.S. Armed Forces. Directs federal executive departments and agencies, executes and enforces federal laws passed by Congress, signs or vetoes federal legislation, negotiates international treaties, conducts foreign policy, and appoints federal judges, Supreme Court justices, ambassadors, and Cabinet secretaries subject to U.S. Senate confirmation.'
    },
    {
      country: 'USA',
      boundary_type: 'State',
      role_key: 'us_senator',
      region_override: '',
      role_title: 'U.S. Senator',
      description: 'Represents the entire state in the United States Senate in Washington, D.C. Authors, debates, and votes on federal legislation, federal taxation, and national appropriations. Holds exclusive constitutional powers of "Advice and Consent" to confirm federal judges, Supreme Court justices, and presidential Cabinet appointments, ratify international treaties by two-thirds vote, and try impeachment cases delivered by the House of Representatives.'
    },
    {
      country: 'USA',
      boundary_type: 'Federal',
      role_key: 'us_representative',
      region_override: '',
      role_title: 'U.S. Representative',
      description: 'Represents the congressional district in the U.S. House of Representatives in Washington, D.C. Introduces and votes on federal legislation, holds the exclusive constitutional authority to originate all federal revenue and tax bills, authorizes federal agency appropriations, and serves on key congressional committees. Directly assists district constituents with federal agencies including the Internal Revenue Service (IRS), Social Security Administration, Veterans Affairs (VA), and U.S. Passports.'
    },
    {
      country: 'USA',
      boundary_type: 'State',
      role_key: 'governor',
      region_override: '',
      role_title: 'Governor',
      description: 'The chief executive of the state government. Implements state laws, commands the state National Guard, and signs or vetoes legislation passed by the state legislature (often with line-item veto authority over state budget appropriations). Prepares and submits the annual state executive budget, appoints heads of state departments and agencies, nominates state judges, and grants executive pardons or commutations.'
    },
    {
      country: 'USA',
      boundary_type: 'State Senate',
      role_key: 'state_senator',
      region_override: '',
      role_title: 'State Senator',
      description: "Represents the state legislative district in the upper chamber of the state legislature. Authors, debates, and votes on state statutes, the annual state budget, state taxation, education standards, public safety, and transportation funding. In most states, confirms the Governor's executive appointments to state commissions, departments, and judicial vacancies."
    },
    {
      country: 'USA',
      boundary_type: 'State House',
      role_key: 'state_representative',
      region_override: '',
      role_title: 'State Representative',
      description: 'Represents the state legislative district in the lower chamber of the state legislature (State House of Representatives, State Assembly, or House of Delegates). Introduces and votes on state legislation, state appropriations, public education funding, healthcare programs (Medicaid), and highway infrastructure. Assists constituents with state agencies including the Department of Motor Vehicles (DMV), state unemployment, and public assistance programs.'
    },
    {
      country: 'USA',
      boundary_type: 'Municipal',
      role_key: 'mayor',
      region_override: '',
      role_title: 'Mayor',
      description: 'Chief executive and official head of city or town municipal government. In "strong-mayor" municipalities, appoints and oversees municipal department heads (police, fire, public works, housing), proposes the annual municipal operating and capital budget, and exercises veto authority. In "council-manager" cities, presides over city council meetings and serves as the city\'s chief policy leader and public representative alongside a professional city manager.'
    },
    {
      country: 'USA',
      boundary_type: 'Municipal',
      role_key: 'council_member',
      region_override: '',
      role_title: 'Council Member',
      description: 'Elected member of city or town council representing a geographic district or the city at large. Enacts municipal ordinances and local codes, adopts the annual city operating budget, approves zoning and land-use development plans, sets local property tax and utility rates, and oversees municipal services including public transit, sanitation, parks, and libraries.'
    },

    // India Official Roles
    {
      country: 'India',
      boundary_type: 'National',
      role_key: 'prime_minister',
      region_override: '',
      role_title: 'Prime Minister',
      description: 'Head of the Government of India and leader of the Union Council of Ministers. Appointed by the President as the leader commanding the majority in the Lok Sabha. Directs national policies, national defense, external affairs, atomic energy, space, and the Union Budget. Represents India in international summits and heads key statutory and advisory bodies including NITI Aayog and the National Security Council.'
    },
    {
      country: 'India',
      boundary_type: 'State',
      role_key: 'chief_minister',
      region_override: '',
      role_title: 'Chief Minister',
      description: 'Head of Government for the State and leader of the State Council of Ministers. Appointed by the Governor as the leader commanding the majority in the State Legislative Assembly (Vidhan Sabha). Directs state administration, public order, police, public health, agriculture, irrigation, state infrastructure, and presents the state annual budget.'
    },
    {
      country: 'India',
      boundary_type: 'Lok Sabha',
      role_key: 'mp',
      region_override: '',
      role_title: 'MP',
      description: 'Member of Parliament representing the Parliamentary Constituency in the Lok Sabha (House of the People) in New Delhi. Debates, amends, and votes on central legislation, national taxation, and the Union Budget. Sits on parliamentary standing committees, scrutinizes union ministries, utilizes the Members of Parliament Local Area Development Scheme (MPLADS) funds to build local constituency infrastructure, and assists citizens with central government schemes and services.'
    },
    {
      country: 'India',
      boundary_type: 'Vidhan Sabha',
      role_key: 'mla',
      region_override: '',
      role_title: 'MLA',
      description: 'Member of the Legislative Assembly representing the Assembly Constituency in the State Legislative Assembly (Vidhan Sabha). Debates and votes on state legislation, state taxation, and the annual state budget under State and Concurrent lists (including healthcare, education, agriculture, roads, and law & order). Utilizes MLA Local Area Development Scheme (MLALADS) funds for local community development and coordinates directly with district administration and municipal bodies to resolve civic grievances.'
    },
    {
      country: 'India',
      boundary_type: 'Ward',
      role_key: 'councillor',
      region_override: '',
      role_title: 'Corporator / Councillor',
      description: 'Elected municipal representative for the ward in the Municipal Corporation, Municipality, or Town Council (Nagar Nigam / Palika). Decides local civic policies, oversees ward sanitation, road maintenance, street lighting, water supply, drainage, parks, and local building permissions, and manages ward development funds.'
    }
  ];

  for (const r of roles) {
    const { error: upsertErr } = await supabase.from('election_role_types').upsert(r, {
      onConflict: 'country,boundary_type,role_key,region_override'
    });
    if (upsertErr) {
      console.error('Error upserting', r.country, r.role_title, upsertErr);
    } else {
      console.log(`✓ Upserted [${r.country} - ${r.boundary_type}] ${r.role_title}`);
    }
  }

  console.log('\nAll USA and India official role descriptions successfully applied!');
}

run();
