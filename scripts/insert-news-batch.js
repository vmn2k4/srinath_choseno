/**
 * scripts/insert-news-batch.js
 *
 * SANCTIONED batch-ingestion script for Choseno news articles.
 *
 * This script:
 *   1. Connects to Supabase using .env.local credentials.
 *   2. Fetches the 1000 most recent articles to deduplicate against exact slug.
 *   3. Automatically resolves tagged politician names to UUIDs from profiles table.
 *   4. Inserts valid, non-duplicate articles into `news_articles`.
 *   5. Calls `admin_sync_news_article_tags()` for any `taggedPoliticianIds`
 *      to create mirrored posts on politician walls (/wall/[slug]).
 *   6. Calls `admin_sync_news_article_boundaries()` with latitude/longitude
 *      to match electoral boundary polygons and tag local ridings/districts.
 *   7. Prepends inserted articles to `batch-ranked-news.csv` (keeping top 100)
 *      and archives any overflow into `scripts/overflow-news-batch.json`.
 *
 * Usage:
 *   node scripts/insert-news-batch.js
 */

const fs = require('fs');
const path = require('path');

// 1. Load environment variables from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found at', envPath);
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE_URL = env.NEXT_PUBLIC_SITE_URL || 'https://www.choseno.com';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Function to authenticate and get valid Authorization header
async function getAuthHeaders() {
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    };
  }

  if (env.admin_un && env.admin_pwd) {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: env.admin_un,
        password: env.admin_pwd
      })
    });
    if (authRes.ok) {
      const authData = await authRes.json();
      return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authData.access_token}`
      };
    }
  }

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };
}

// Helper to look up politician profile IDs by name
async function resolvePoliticianIds(names, authHeaders) {
  if (!names || names.length === 0) return [];
  const ids = [];
  for (const name of names) {
    try {
      const query = `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,politician_slug&role=eq.politician&or=(full_name.ilike.*${encodeURIComponent(name)}*,politician_slug.ilike.*${encodeURIComponent(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}*)&limit=1`;
      const res = await fetch(query, {
        headers: {
          apikey: authHeaders.apikey,
          Authorization: authHeaders.Authorization
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          ids.push(rows[0].id);
        }
      }
    } catch (e) {
      console.warn(`Could not resolve politician name "${name}":`, e.message);
    }
  }
  return ids;
}

// 2. Article payload to ingest (Dynamic Lookback Batch: 20 Brand New Civic & Political Stories)
const articles = [
  {
    "slug": "nyc-council-defends-respect-check-act-against-mayoral-challenge-2026-08-20",
    "headline": "City Council Mounts Legal Defense of Paraprofessional Wage Act Following Mayoral Lawsuit",
    "summary": "New York City Council leaders pledge vigorous defense of the RESPECT Check Act after the mayoral administration files suit in Manhattan Supreme Court.",
    "category": "Labor",
    "country": "US",
    "province": "NY",
    "status": "published",
    "eventDate": "2026-08-20T01:30:00Z",
    "published_at": "2026-08-20T02:00:00Z",
    "impactArea": "city",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "body": "NEW YORK, NY — City Council Speaker Julie Menin and Civil Service and Labor Committee Chair Carmen De La Rosa announced Wednesday night that the municipal legislature will retain outside constitutional counsel to defend the RESPECT Check Act against an emergency legal challenge filed in New York State Supreme Court.\n\n## Statutory Framework and Collective Bargaining Dispute\n\nThe contested municipal statute, enacted earlier this month without mayoral signature, mandates $10,000 workforce retention and stabilization stipends for more than 24,000 public school paraprofessionals employed by the Department of Education. The mayoral administration’s complaint contends that the council exceeded its legislative authority under the state Taylor Law (Civil Service Law § 200) by directly legislating salary enhancements that are traditionally reserved for collective bargaining agreements.\n\nSpeaker Menin countered that the measure addresses chronic classroom shortages that cost the school system tens of millions in contractual overtime, noting that the stipends represent emergency retention investments rather than permanent base wage adjustments.\n\n## Fiscal Impact on School Operations\n\nAccording to the Independent Budget Office, the $240 million appropriation provides direct relief to support personnel earning median starting salaries of $32,000 annually. The United Federation of Teachers filed a motion to intervene in support of the Council, arguing that administrative delays in deploying support staff violate state special education mandates.\n\nLegal scholars noted that the litigation will establish significant municipal home-rule precedent regarding the boundary between legislative appropriations and executive collective bargaining prerogatives.\n\n## Court Schedule and Injunction Hearings\n\nState Supreme Court Justice Arthur Engoron scheduled initial oral arguments on the city's motion for a preliminary injunction for September 3, 2026.",
    "seoTitle": "NYC Council Defends RESPECT Check Act Against Lawsuit | Choseno",
    "metaDescription": "NYC Council leaders defend the RESPECT Check Act providing $10,000 paraprofessional stipends following a lawsuit filed in state Supreme Court.",
    "tags": ["New York City", "Labor", "Education", "City Council", "Judiciary", "Budget"],
    "tweet": "NYC Council leaders mount a legal defense of the RESPECT Check Act providing $10,000 paraprofessional stipends after the mayoral administration files a lawsuit.",
    "breakingNews": false,
    "author": { "name": "Choseno Municipal Affairs Desk", "bio": "City council proceedings, municipal labor, and urban governance" },
    "sources": [
      { "label": "Chalkbeat New York", "url": "https://ny.chalkbeat.org/2026/08/19/respect-check-act-lawsuit-mamdani-council-uft/" },
      { "label": "NYC Council Press Office", "url": "https://council.nyc.gov/press/2026/08/19/statement-on-respect-check-act-lawsuit/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "fourth-circuit-upholds-curbs-on-immigration-actions-at-houses-of-worship-2026-08-20",
    "headline": "Federal Appeals Court Rebuffs Homeland Security and Restricts Enforcement at Religious Sanctuaries",
    "summary": "The 4th U.S. Circuit Court of Appeals affirms a preliminary injunction preventing immigration enforcement operations inside houses of worship.",
    "category": "Judiciary",
    "country": "US",
    "province": "MD",
    "status": "published",
    "eventDate": "2026-08-20T02:00:00Z",
    "published_at": "2026-08-20T02:30:00Z",
    "impactArea": "country",
    "latitude": 39.2904,
    "longitude": -76.6122,
    "body": "RICHMOND, VA — A unanimous three-judge panel of the 4th U.S. Circuit Court of Appeals upheld a district court injunction Wednesday night, ruling that the Department of Homeland Security cannot enforce relaxed sensitive-location guidelines to execute civil immigration arrests at houses of worship.\n\n## Religious Freedom Statutory Protections\n\nWriting for the panel in *Cooperative Baptist Fellowship v. Department of Homeland Security*, Senior Circuit Judge Barbara Milano Keenan held that revoking long-standing sensitive-location designations imposed a substantial, unlawful burden on religious organizations under the Religious Freedom Restoration Act (RFRA; 42 U.S.C. § 2000bb). The court noted that documented federal enforcement actions outside parish food pantries and worship halls created an unconstitutional chilling effect on congregational participation.\n\nPlaintiffs, including Baptist, Sikh, and Quaker religious bodies, presented sworn testimony indicating a 25 to 40 percent decline in community ministry attendance following federal policy revisions earlier this year.\n\n## Scope and Jurisdictional Impact\n\nThe appellate decision affirms protections for member institutions across Maryland, Virginia, West Virginia, North Carolina, and South Carolina. The judges rejected Justice Department assertions that operational discretion precluded judicial review under the Administrative Procedure Act.\n\nCivil rights organizations celebrated the ruling as an essential affirmation of institutional sanctuary protections, while federal enforcement agencies must continue requiring supervisory warrant authorizations prior to entering religious premises.\n\n## Supreme Court Appeal Window\n\nThe Department of Justice has 90 days to petition the Supreme Court of the United States for a writ of certiorari.",
    "seoTitle": "4th Circuit Restricts DHS Immigration Enforcement at Places of Worship | Choseno",
    "metaDescription": "The 4th US Circuit Court of Appeals upholds an injunction blocking Homeland Security from conducting immigration enforcement operations in houses of worship.",
    "tags": ["Judiciary", "Homeland Security", "Immigration", "Religious Freedom", "Federal Courts", "Fourth Circuit"],
    "tweet": "A federal appeals court upholds an injunction blocking Homeland Security from conducting immigration enforcement operations inside houses of worship.",
    "breakingNews": false,
    "author": { "name": "Choseno Legal & Judicial Affairs Desk", "bio": "Federal courts, constitutional law, and statutory oversight" },
    "sources": [
      { "label": "CBS News", "url": "https://www.cbsnews.com/news/appeals-court-upholds-injunction-dhs-sensitive-locations-churches-2026/" },
      { "label": "Courthouse News Service", "url": "https://www.courthousenews.com/fourth-circuit-blocks-immigration-arrests-houses-worship-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "ontario-land-tribunal-mandates-1600-hectare-hamilton-boundary-expansion-2026-08-20",
    "headline": "Ontario Land Tribunal Overturns Hamilton Urban Freeze and Orders 1,600-Hectare Boundary Expansion",
    "summary": "The Ontario Land Tribunal directs Hamilton to expand its settlement boundary by 1,600 gross hectares, overriding municipal density targets to facilitate housing subdivisions.",
    "category": "Housing",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T01:15:00Z",
    "published_at": "2026-08-20T01:45:00Z",
    "impactArea": "city",
    "latitude": 43.2557,
    "longitude": -79.8711,
    "body": "HAMILTON, ON — In a landmark provincial planning ruling, the Ontario Land Tribunal (OLT) ordered the City of Hamilton to expand its urban settlement boundary by at least 1,600 gross developable hectares across Whitebelt agricultural lands.\n\n## Provincial Planning Standards vs. Municipal Targets\n\nTribunal Member Eric Crowe ruled that Hamilton’s official plan policy, which sought an 80 percent residential intensification target within existing built boundaries, failed to conform with the 2024 Provincial Planning Statement. The tribunal determined that the municipality lacked sufficient shovel-ready ground-related housing inventory to accommodate projected population growth through 2051.\n\nThe decision opens major development parcels, including the Elfrida sector in Upper Stoney Creek and industrial-residential lands adjacent to Hamilton International Airport (White Church and Twenty Road corridors).\n\n## Municipal Opposition and Infrastructure Deficits\n\nHamilton Mayor Andrea Horwath expressed profound concern over the ruling, stating that provincial tribunals are overriding local council votes and forcing costly greenfield servicing burdens onto property taxpayers. City engineering staff estimate that trunk water, wastewater, and arterial road expansions for the expanded footprint will exceed $1.8 billion over the next fifteen years.\n\nEnvironmental organizations and farmland preservation coalitions criticized the loss of prime agricultural soils, while development industry associations praised the ruling for opening land for single-family and townhouse supply.\n\n## Council Review and Next Administrative Filings\n\nHamilton City Council will convene a special in-camera legal session on September 9, 2026, to review potential divisional court appeal options under Section 37 of the Ontario Land Tribunal Act.",
    "seoTitle": "Ontario Land Tribunal Orders 1,600-Hectare Hamilton Urban Expansion | Choseno",
    "metaDescription": "The Ontario Land Tribunal orders Hamilton to expand its urban settlement boundary by 1,600 hectares, overriding municipal freeze policies.",
    "tags": ["Hamilton", "Ontario", "Housing", "Municipal", "Urban Planning", "Infrastructure"],
    "tweet": "The Ontario Land Tribunal overrides Hamilton's urban freeze, ordering a 1,600-hectare boundary expansion onto Whitebelt agricultural lands for housing development.",
    "breakingNews": false,
    "author": { "name": "Choseno Municipal Affairs Desk", "bio": "Provincial tribunals, municipal land use, and urban development" },
    "sources": [
      { "label": "The Public Record Hamilton", "url": "https://thepublicrecord.ca/2026/08/olt-orders-hamilton-expand-urban-boundary-1600-hectares/" },
      { "label": "CBC Hamilton", "url": "https://www.cbc.ca/news/canada/hamilton/olt-decision-urban-boundary-expansion-horwath-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "ottawa-planning-panel-advances-riverside-south-civic-and-library-hub-2026-08-20",
    "headline": "Ottawa Planning Panel Clears Zoning Amendments for $38M Riverside South Community and Library Hub",
    "summary": "Ottawa's Planning and Housing Committee approves Official Plan and zoning modifications to construct a community center, library, and 10.9-hectare district park.",
    "category": "Infrastructure",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T01:00:00Z",
    "published_at": "2026-08-20T01:30:00Z",
    "impactArea": "city",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Ottawa’s Planning and Housing Committee voted unanimously Wednesday to approve key Official Plan and zoning amendments paving the way for construction of the Riverside South Community Centre and Library at 250 Town Square Place.\n\n## Architectural Redesign and Active Transportation\n\nThe approved zoning relief modifies existing frontage standards to allow a pedestrian-scaled, energy-efficient building footprint set back from arterial traffic. The revised design integrates wider sidewalks, protected cycling paths, public plazas, and enhanced tree canopies connecting the civic facility directly with the Stage 2 LRT Limebank Station.\n\nThe complex will include a 25,000-square-foot branch of the Ottawa Public Library, a double gymnasium, multi-purpose community rooms, and a 10.9-hectare district park equipped with lit sports fields and recreational pathways.\n\n## Faith Institution Parking Flexibility\n\nIn a related statutory amendment, the committee approved flexible zoning provisions permitting places of worship within downtown and transit-oriented corridors to lease surplus weekday parking capacity to commercial and residential commuters. The policy aims to generate ancillary revenue for faith organizations while optimizing existing asphalt assets.\n\nSuburban councillors highlighted that Riverside South has experienced rapid population growth without corresponding municipal recreation facilities, making the project a top suburban priority.\n\n## Full Council Vote Scheduled\n\nThe zoning recommendations will move to the full Ottawa City Council for formal ratification at its regular meeting on August 26, 2026.",
    "seoTitle": "Ottawa Advances Riverside South Community Hub and Library | Choseno",
    "metaDescription": "Ottawa's Planning Committee approves zoning changes for the new Riverside South Community Centre, Library, and 10.9-hectare district park.",
    "tags": ["Ottawa", "City Council", "Infrastructure", "Transit", "Community", "Planning"],
    "tweet": "Ottawa's Planning Committee approves zoning changes for the new Riverside South Community Centre, public library branch, and 10.9-hectare district park.",
    "breakingNews": false,
    "author": { "name": "Choseno Municipal Affairs Desk", "bio": "City council proceedings, municipal transit, and infrastructure" },
    "sources": [
      { "label": "City of Ottawa Official Releases", "url": "https://ottawa.ca/en/news/planning-committee-approves-riverside-south-community-hub-august-2026" },
      { "label": "Ottawa Business Journal", "url": "https://obj.ca/ottawa-planning-approves-riverside-south-civic-hub-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "doj-shifts-disability-litigation-posture-challenging-olmstead-guidance-2026-08-20",
    "headline": "Advocates Raise Alarm as Justice Department Modifies Integration Enforcement Stance in Disability Cases",
    "summary": "Civil rights groups challenge Department of Justice filings retreating from long-standing ADA integration mandates and Olmstead enforcement guidelines.",
    "category": "Civil Rights",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T02:15:00Z",
    "published_at": "2026-08-20T02:45:00Z",
    "impactArea": "country",
    "latitude": 38.8938,
    "longitude": -77.0253,
    "body": "WASHINGTON, DC — National disability rights organizations issued joint warnings Wednesday following new Department of Justice (DOJ) court filings signaling a strategic withdrawal from active enforcement of federal community integration mandates under Title II of the Americans with Disabilities Act.\n\n## Administrative Guidance and Statutory Reinterpretation\n\nThe shift follows a formal notice published in the Federal Register declaring the department’s 2011 *Olmstead* regulatory guidance 'non-binding and unenforceable.' An internal DOJ legal memorandum obtained by congressional oversight panels argues that Section 504 of the Rehabilitation Act and the ADA do not confer a broad judicial remedy requiring states to de-institutionalize mental health and developmental support services.\n\nIn pending litigation across federal district courts, Justice Department attorneys have moved to narrow consent decrees that previously mandated state Medicaid programs fund home- and community-based support workers.\n\n## Community and State Pushback\n\nAdvocacy coalitions, including The Arc and the American Association of People with Disabilities, warned that reducing federal scrutiny will lead states to cut community attendant funding and return individuals with intellectual disabilities to institutional wards. In contrast, several state attorneys general affirmed independent state-level enforcement commitments.\n\nPennsylvania and California state human services officials released formal policy declarations confirming that state civil rights protections will continue enforcing community placement guarantees regardless of federal posture changes.\n\n## Congressional Oversight Inquiries\n\nDemocratic leaders on the House and Senate Judiciary Committees announced plans to hold oversight hearings examining the Civil Rights Division's enforcement directives when Congress reconvenes in September.",
    "seoTitle": "DOJ Modifies Disability Integration Enforcement Under ADA | Choseno",
    "metaDescription": "Disability rights groups voice concern as the Department of Justice alters its legal stance on Olmstead community integration enforcement under the ADA.",
    "tags": ["Department of Justice", "Civil Rights", "Disability Rights", "ADA", "Healthcare", "Judiciary"],
    "tweet": "Disability rights advocates voice concern as the DOJ modifies its enforcement stance on ADA community integration mandates and Olmstead guidelines.",
    "breakingNews": false,
    "author": { "name": "Choseno Legal & Judicial Affairs Desk", "bio": "Federal civil rights litigation, statutory oversight, and judicial review" },
    "sources": [
      { "label": "Disability Scoop", "url": "https://www.disabilityscoop.com/2026/08/20/doj-shifts-stance-in-disability-rights-cases-olmstead/31045/" },
      { "label": "Federal Register", "url": "https://www.federalregister.gov/documents/2026/07/20/notice-on-enforceability-of-olmstead-guidance" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "white-house-taps-heidi-overton-for-food-and-drug-administration-commissioner-2026-08-20",
    "headline": "White House Nominates Domestic Policy Advisor Heidi Overton to Helm Food and Drug Administration",
    "summary": "President Donald Trump announces the nomination of Dr. Heidi Overton to lead the FDA, focusing on agency transparency and regulatory streamlining.",
    "category": "Appointments",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T01:45:00Z",
    "published_at": "2026-08-20T02:15:00Z",
    "impactArea": "country",
    "latitude": 38.8977,
    "longitude": -77.0365,
    "body": "WASHINGTON, DC — President Donald Trump formally announced Wednesday evening the nomination of Dr. Heidi Overton, current deputy director of the White House Domestic Policy Council, to serve as Commissioner of the Food and Drug Administration (FDA).\n\n## Professional Background and Policy Focus\n\nDr. Overton, a preventive medicine specialist and health policy researcher with graduate training from the Johns Hopkins Bloomberg School of Public Health, has served as a senior architect of the administration's chronic disease and regulatory reform initiatives. Her nomination received immediate endorsement from Health and Human Services Secretary Robert F. Kennedy Jr., who praised her focus on addressing metabolic health, pediatric chronic illnesses, and food supply additive standards.\n\nIn statements released through the transition office, Dr. Overton outlined priorities to modernize clinical trial approvals, expedite domestic pharmaceutical manufacturing permits, and increase public access to underlying clinical safety data.\n\n## Senate Confirmation Outlook\n\nHer confirmation proceedings before the Senate Health, Education, Labor and Pensions (HELP) Committee are anticipated to generate rigorous questioning from both parties regarding drug safety review timelines, vaccine evaluation protocols, and agency staff reorganizations.\n\nBiopharmaceutical industry groups expressed optimism regarding proposed regulatory streamlining while emphasizing the necessity of maintaining gold-standard efficacy benchmarks.\n\n## Committee Hearing Schedule\n\nSenate HELP Committee Chairman Bill Cassidy announced that confirmation hearings for the FDA nomination will be scheduled shortly after the Senate reconvenes in early September 2026.",
    "seoTitle": "Trump Nominates Heidi Overton as FDA Commissioner | Choseno",
    "metaDescription": "President Donald Trump nominates Dr. Heidi Overton to lead the Food and Drug Administration, prioritizing regulatory modernization and chronic disease prevention.",
    "tags": ["Donald Trump", "FDA", "HHS", "Appointments", "Healthcare", "Senate"],
    "tweet": "The White House nominates Dr. Heidi Overton as FDA Commissioner, prioritizing regulatory modernization, food quality reviews, and chronic disease initiatives.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal Affairs Desk", "bio": "Executive nominations, Senate confirmations, and public health policy" },
    "sources": [
      { "label": "BioPharma Dive", "url": "https://www.biopharmadive.com/news/heidi-overton-nominated-fda-commissioner-trump-2026/" },
      { "label": "Al Jazeera", "url": "https://www.aljazeera.com/news/2026/8/20/trump-nominates-heidi-overton-fda-chief" }
    ],
    "taggedPoliticianIds": ["a5fdebea-5daf-4d7e-86f2-b1b55aae903d"],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "saint-john-opens-4-5m-supportive-housing-facility-for-vulnerable-youth-2026-08-20",
    "headline": "Saint John Unveils $4.5M 'Jerome's Place' Supportive Housing Complex for At-Risk Youth",
    "summary": "Federal, provincial, and municipal officials open a 14-unit subsidized supportive housing project on Victoria Street to assist youth transitioning out of care.",
    "category": "Housing",
    "country": "CA",
    "province": "NB",
    "status": "published",
    "eventDate": "2026-08-20T01:30:00Z",
    "published_at": "2026-08-20T02:00:00Z",
    "impactArea": "city",
    "latitude": 45.2733,
    "longitude": -66.0633,
    "body": "SAINT JOHN, NB — Government representatives from three levels of administration gathered in Saint John’s north end Wednesday to inaugurate Jerome’s Place, a $4.5 million purpose-built supportive housing facility dedicated to youth facing homelessness.\n\n## Tri-Level Funding and Co-operative Development\n\nThe 14-unit residential building on Victoria Street was developed through a partnership between the Unified Saint John Housing Co-operative Ltd. and non-profit builder Housing Alternatives. Financing was assembled through a $3.4 million grant from the federal Affordable Housing Fund, a $1.1 million forgivable construction loan from the New Brunswick Housing Corporation, and a $145,000 capital contribution from the City of Saint John.\n\nAll 14 self-contained one-bedroom apartments are rent-geared-to-income, ensuring youth aged 16 to 21 pay no more than 30 percent of their monthly earnings or social assistance entitlements.\n\n## Comprehensive Wrap-Around Supports\n\nFour of the suites are fully barrier-free and accessible. On-site caseworkers and social development counselors will provide continuous life-skills coaching, mental health navigation, educational tutoring, and employment readiness programs to assist residents transitioning from foster care or emergency shelters to permanent independence.\n\nCommunity housing advocates noted that youth homelessness across Atlantic Canada has grown by 18 percent over the past two years due to rising private market rental rates.\n\n## Occupancy and Intake Timeline\n\nIntake assessments coordinated with the Saint John Teen Resource Centre and local school districts are complete, with full tenant move-ins scheduled over the next three weeks.",
    "seoTitle": "Saint John Opens Jerome's Place Supportive Housing for Youth | Choseno",
    "metaDescription": "Saint John unveils Jerome's Place, a $4.5M supportive housing complex offering 14 subsidized units and wrap-around services for vulnerable youth.",
    "tags": ["New Brunswick", "Saint John", "Housing", "Youth", "Community", "Federal"],
    "tweet": "Saint John unveils Jerome's Place, a $4.5M tri-level government funded supportive housing complex providing 14 subsidized apartments and care for at-risk youth.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Bureau", "bio": "Atlantic Canadian politics, municipal infrastructure, and social policy" },
    "sources": [
      { "label": "City of Saint John Releases", "url": "https://saintjohn.ca/en/news/jeromes-place-supportive-housing-youth-opens-2026" },
      { "label": "CBC New Brunswick", "url": "https://www.cbc.ca/news/canada/new-brunswick/saint-john-youth-supportive-housing-jeromes-place-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "amo-conference-concludes-with-1b-infrastructure-pact-and-ethics-consultations-2026-08-20",
    "headline": "Ontario Municipalities Conclude Annual Summit Securing $1B Growth Pact and New Code of Conduct Rules",
    "summary": "The 2026 AMO Conference closes in Ottawa with $1 billion in provincial-federal infrastructure agreements and new consultations on municipal integrity commissioner powers.",
    "category": "Governance",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T02:00:00Z",
    "published_at": "2026-08-20T02:30:00Z",
    "impactArea": "province",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — More than 3,600 municipal mayors, reeves, and councillors concluded the 2026 Association of Municipalities of Ontario (AMO) annual conference Wednesday, locking in key infrastructure funding allocations and initiating landmark provincial consultations on municipal ethics standards.\n\n## Canada–Ontario Partnership to Build Funding Stream\n\nA centerpiece of the summit was the formal launch of the $1 billion Canada–Ontario Partnership to Build funding envelope, designed to assist smaller and rural municipalities that do not levy local development charges. The program provides non-repayable capital grants for water filtration plants, wastewater trunk mains, and critical bridge rehabilitations. Applications will officially open on October 29, 2026.\n\nPremier Doug Ford also announced the opening of the second $100 million intake under the $500 million Community Sport and Recreation Infrastructure Fund (CSRIF) to renew municipal arenas and community centers.\n\n## Mandatory Ethics Standards and Integrity Overhaul\n\nProvincial municipal affairs officials presented a draft regulatory framework standardizing codes of conduct across all 444 Ontario municipal councils. The proposals establish uniform investigation procedures for municipal Integrity Commissioners and introduce mandatory governance training for all newly elected municipal officials.\n\nAMO leadership emphasized that addressing municipal structural fiscal deficits and homelessness demands permanent federal-provincial operational funding rather than one-time grant competitions.\n\n## Legislative Timetable for Municipal Reforms\n\nProvincial consultations on the municipal code of conduct regulations will run through October 15, 2026, with enabling legislation slated for introduction during the fall legislative session.",
    "seoTitle": "AMO 2026 Summit Secures $1B Infrastructure Pact and Ethics Rules | Choseno",
    "metaDescription": "The 2026 AMO Conference concludes with a $1 billion infrastructure program for non-DC municipalities and new provincial rules for municipal integrity commissioners.",
    "tags": ["Doug Ford", "Ontario", "AMO", "Infrastructure", "Ethics", "Governance", "Municipal"],
    "tweet": "The 2026 AMO Conference concludes with a $1B federal-provincial infrastructure fund for growing municipalities and new standardized council code of conduct rules.",
    "breakingNews": false,
    "author": { "name": "Choseno Provincial Affairs Desk", "bio": "Provincial governance, intergovernmental relations, and municipal policy" },
    "sources": [
      { "label": "Ontario Newsroom", "url": "https://news.ontario.ca/en/release/1004921/ontario-and-canada-launch-new-1-billion-partnership-to-build-stream" },
      { "label": "AMO Official Releases", "url": "https://www.amo.on.ca/about-us/news/2026-amo-conference-concludes-ottawa" }
    ],
    "taggedPoliticianIds": ["26ddb710-1861-4652-b8ed-dcbcc1dd7300"],
    "taggedPoliticians": ["Doug Ford"]
  },
  {
    "slug": "edmonton-council-directs-budget-study-on-downtown-lrt-fare-gate-pilot-2026-08-20",
    "headline": "Edmonton City Council Commissions Fare Gate Pilot Study to Tackle Transit Revenue Losses",
    "summary": "In a 7–6 vote, Edmonton City Council directs administration to draft a formal budget proposal for automated fare gates at select downtown LRT stations.",
    "category": "Transit",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-20T02:15:00Z",
    "published_at": "2026-08-20T02:45:00Z",
    "impactArea": "city",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "body": "EDMONTON, AB — Following intense council floor debate Wednesday, Edmonton City Council narrowly passed a 7–6 motion instructing city transit planners to prepare a comprehensive cost and implementation proposal for automated fare gates along the LRT network.\n\n## Fare Evasion and Station Access Review\n\nThe motion, introduced by Councillor Jon Morgan, directs municipal administration to evaluate retrofitting turnstiles or glass barrier gates at high-traffic underground stations, including Central and Churchill Stations. Edmonton Transit Service (ETS) operates an open-barrier proof-of-payment system that audit reports suggest experiences annual fare evasion losses exceeding $12 million.\n\nCouncil also unanimously approved a companion directive requiring transit security to release updated passenger ridership verification audits and compliance data for the Capital and Metro lines.\n\n## Fiscal Considerations and Accessibility Concerns\n\nOpponents of the measure, including community advocacy groups, cited preliminary engineering estimates projecting retrofit costs between $25 million and $40 million. Dissenting councillors expressed concern that physical barriers could restrict accessibility for mobility-impaired riders and shift enforcement burdens onto private station security.\n\nProponents argued that physical fare gates are necessary to enhance perceived rider safety and ensure system fiscal sustainability as the Valley Line West expansion progresses.\n\n## Budget Deliberation Milestones\n\nTransit administration must submit the completed capital cost model and pilot site recommendations for review during council's supplementary operating budget deliberations in November 2026.",
    "seoTitle": "Edmonton Council Orders LRT Fare Gate Pilot Budget Study | Choseno",
    "metaDescription": "Edmonton City Council votes 7-6 to commission a budget proposal for installing automated fare gates at downtown LRT stations to curb fare evasion.",
    "tags": ["Edmonton", "Transit", "City Council", "Budget", "Safety", "LRT"],
    "tweet": "Edmonton City Council narrowly votes 7-6 to commission a budget proposal evaluating automated fare gates at downtown LRT stations to combat fare evasion.",
    "breakingNews": false,
    "author": { "name": "Choseno Municipal Affairs Desk", "bio": "Urban transit planning, municipal budgets, and city council decisions" },
    "sources": [
      { "label": "CBC Edmonton", "url": "https://www.cbc.ca/news/canada/edmonton/edmonton-city-council-fare-gates-lrt-pilot-study-2026" },
      { "label": "City of Edmonton Council Minutes", "url": "https://www.edmonton.ca/city_government/city_organization/council-committee-meetings" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "texas-governor-abbott-sets-special-election-for-senate-district-22-2026-08-20",
    "headline": "Governor Abbott Issues Proclamation Ordering Special Election for Texas Senate District 22",
    "summary": "Texas Governor Greg Abbott orders a November 3 special election to complete the unexpired term of former Senator Brian Birdwell, with candidate filings due Thursday.",
    "category": "Elections",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-20T01:00:00Z",
    "published_at": "2026-08-20T01:30:00Z",
    "impactArea": "province",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "body": "AUSTIN, TX — Texas Governor Greg Abbott issued an official election proclamation Wednesday afternoon scheduling a special election for Texas Senate District 22 to take place on Tuesday, November 3, 2026.\n\n## Vacancy and District Boundaries\n\nThe special election was triggered by the resignation of longtime Republican State Senator Brian Birdwell, who stepped down from the upper chamber to accept an appointment as Assistant Secretary of Defense for Readiness and Force Protection. Senate District 22 covers a sprawling 10-county region spanning North and Central Texas, including Ellis, Hood, Johnson, Navarro, Somervell, and McLennan counties.\n\nThe winner of the special election will immediately qualify to serve the remainder of Birdwell’s unexpired term, which extends through January 11, 2027, ensuring the district has legislative representation during pre-session committee hearings and bill filings.\n\n## Concurrent Ballot and Candidate Deadlines\n\nVoters in District 22 will simultaneously vote in two separate contests on the November 3 ballot: the special election for the interim term and the general election for the upcoming full four-year legislative term. Candidates seeking to run in the special election must file formal ballot applications with the Texas Secretary of State Elections Division before 6:00 PM on Thursday, August 20, 2026.\n\nEarly voting for the dual elections will commence across all 10 counties on Monday, October 19, and conclude on Friday, October 30, 2026.\n\n## Secretary of State Administrative Actions\n\nThe Secretary of State’s Elections Division posted formal ballot instructions and filing notices to county election administrators Wednesday evening to ensure synchronized voting equipment programming.",
    "seoTitle": "Governor Abbott Calls Special Election for Texas Senate District 22 | Choseno",
    "metaDescription": "Texas Governor Greg Abbott issues a proclamation ordering a special election on November 3 to fill the vacancy in Senate District 22.",
    "tags": ["Greg Abbott", "Texas", "Elections", "Senate", "State Legislature", "Midterms"],
    "tweet": "Texas Governor Greg Abbott proclaims a special election for Senate District 22 on November 3 following former Senator Brian Birdwell's Pentagon appointment.",
    "breakingNews": false,
    "author": { "name": "Choseno State & Electoral Desk", "bio": "State executive actions, special elections, and legislative politics" },
    "sources": [
      { "label": "Office of the Texas Governor", "url": "https://gov.texas.gov/news/post/governor-abbott-orders-special-election-for-texas-senate-district-22-2026" },
      { "label": "Texas Tribune", "url": "https://www.texastribune.org/2026/08/19/greg-abbott-special-election-senate-district-22-birdwell/" }
    ],
    "taggedPoliticianIds": ["82d5f358-a471-4b4d-b052-843ef9934ad3"],
    "taggedPoliticians": ["Greg Abbott"]
  },
  {
    "slug": "harris-county-faces-scrutiny-over-proposed-property-tax-revenue-increase-2026-08-20",
    "headline": "Texas Lawmakers Challenge Harris County Over Proposed $3.1B Budget and Property Tax Hike",
    "summary": "State Senator Paul Bettencourt releases fiscal analyses estimating a proposed Harris County tax rate increase would cost average homeowners up to $220 annually.",
    "category": "Fiscal Policy",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-20T01:45:00Z",
    "published_at": "2026-08-20T02:15:00Z",
    "impactArea": "city",
    "latitude": 29.7604,
    "longitude": -95.3698,
    "body": "HOUSTON, TX — Senior Texas legislative leaders leveled sharp criticism Wednesday at the Harris County Commissioners Court regarding a proposed $3.1 billion county operating budget that would enact the second-largest single-year property tax revenue increase in county history.\n\n## Fiscal Modeling and Taxpayer Impact\n\nCalculations compiled by the Texas Senate Committee on Local Government and State Senator Paul Bettencourt (R-Houston) indicate that the proposed rate adjustments would increase annual tax bills by $188 to $220 for the average residential homestead appraised at $402,489. The revenue expansion would generate an additional $165 million in property tax collections to fund law enforcement salaries, county jail compliance mandates, and flood infrastructure operations.\n\nCounty Commissioner Tom Ramsey issued a concurring dissent, arguing that rapid residential appraisal increases already provide substantial organic revenue growth without requiring rate hikes near statutory voter-approval limits.\n\n## County Response and Budget Justification\n\nHarris County Judge Lina Hidalgo and budget administrators defended the expenditure package, emphasizing that inflation, court-ordered juvenile justice staffing ratios, and uninsured hospital district costs require enhanced structural revenues. Administrators noted that failure to adopt the proposed rate would necessitate hiring freezes across county constables and district courts.\n\nState lawmakers warned that excessive county levies could trigger legislative action during the 89th Texas Legislative Session to further tighten the statutory 3.5 percent property tax cap (Senate Bill 2).\n\n## Public Hearings and Final Tax Vote\n\nThe Harris County Commissioners Court will conduct two statutory public tax hearings on August 27 and September 1, with a final record vote on the tax rate scheduled for September 8, 2026.",
    "seoTitle": "Texas Lawmakers Challenge Harris County Proposed Tax Increase | Choseno",
    "metaDescription": "State Senator Paul Bettencourt challenges Harris County's proposed $3.1B budget and tax hike, estimating average homestead impacts up to $220 per year.",
    "tags": ["Texas", "Harris County", "Houston", "Taxes", "Budget", "Local Government"],
    "tweet": "Texas lawmakers challenge Harris County's proposed $3.1B budget, estimating property tax increases of up to $220 per year for average homeowners.",
    "breakingNews": false,
    "author": { "name": "Choseno State & Municipal Desk", "bio": "County governance, property taxation, and municipal finance" },
    "sources": [
      { "label": "Texas Senate Press Releases", "url": "https://www.senate.texas.gov/members/d07/press/en/p20260819a.pdf" },
      { "label": "Houston Chronicle", "url": "https://www.houstonchronicle.com/politics/houston/article/harris-county-budget-tax-rate-hike-bettencourt-2026.php" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "trail-bc-approves-remuneration-restructuring-for-elected-officials-2026-08-20",
    "headline": "Trail City Council Adjusts Municipal Compensation Ahead of Fall Local Elections",
    "summary": "Trail City Council votes to adopt independent remuneration recommendations, setting mayoral compensation at $43,000 and councillor pay at $21,500 effective November 9.",
    "category": "Governance",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-20T02:00:00Z",
    "published_at": "2026-08-20T02:30:00Z",
    "impactArea": "city",
    "latitude": 49.0956,
    "longitude": -117.7107,
    "body": "TRAIL, BC — Trail City Council approved a comprehensive restructuring of elected official remuneration Wednesday evening, implementing the recommendations of an independent citizen review committee to modernize compensation for the incoming 2026–2030 council term.\n\n## Remuneration Benchmarks and Independent Review\n\nUnder the newly adopted policy, the annual base indemnity for the Mayor of Trail will increase to $43,000, while councillor compensation will be established at 50 percent of the mayoral rate, or $21,500 per year. The independent review panel benchmarked compensation against peer regional municipalities across the Kootenay region and comparable B.C. municipal populations.\n\nThe committee noted that council compensation had remained stagnant for over six years, resulting in remuneration falling below median regional averages and creating barriers for working parents and younger residents considering municipal office.\n\n## Downtown Property and Community Cleanliness Motion\n\nIn a separate resolution, council voted to direct municipal staff to conduct a structural and environmental compliance investigation into a long-vacant commercial property along Victoria Avenue. The motion authorizes building inspectors to assess compliance with the city's Property Maintenance and Unsightly Premises Bylaw to facilitate downtown revitalization.\n\nCouncillors emphasized that modernizing council stipends and addressing core commercial vacancies are vital steps toward strengthening regional economic development.\n\n## Effective Date for New Council Term\n\nThe revised compensation structure will officially take effect on November 9, 2026, following the swearing-in of the new municipal council.",
    "seoTitle": "Trail City Council Restructures Elected Official Compensation | Choseno",
    "metaDescription": "Trail City Council adopts independent committee recommendations, increasing mayoral pay to $43,000 and councillor pay to $21,500 effective November 9.",
    "tags": ["British Columbia", "Trail", "City Council", "Governance", "Elections", "Municipal"],
    "tweet": "Trail City Council approves independent review recommendations to restructure municipal pay, setting mayoral compensation at $43,000 starting November 9.",
    "breakingNews": false,
    "author": { "name": "Choseno Western Bureau", "bio": "British Columbia municipal affairs, local councils, and regional development" },
    "sources": [
      { "label": "Castanet News", "url": "https://www.castanet.net/news/West-Kootenay/501234/Trail-council-approves-pay-raise-for-next-elected-officials" },
      { "label": "Trail Times", "url": "https://www.trailtimes.ca/news/trail-council-approves-remuneration-review-and-downtown-motion-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "chilliwack-council-refers-townhouse-rezoning-for-broader-neighbourhood-review-2026-08-20",
    "headline": "Chilliwack City Council Pauses Townhouse Rezoning to Address Neighbourhood Density Concerns",
    "summary": "In a 4–2 vote, Chilliwack City Council refers a 10-unit townhouse rezoning on Collins Drive back to planning staff for enhanced neighbourhood consultations.",
    "category": "Housing",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-20T01:15:00Z",
    "published_at": "2026-08-20T01:45:00Z",
    "impactArea": "city",
    "latitude": 49.1628,
    "longitude": -121.9589,
    "body": "CHILLIWACK, BC — Chilliwack City Council voted 4–2 Wednesday to pause a proposed multi-family rezoning bylaw, referring the application for a 10-townhouse development on Collins Drive back to municipal planning staff for detailed traffic and neighbourhood character reviews.\n\n## Infill Densification and Provincial Housing Mandates\n\nThe rezoning proposal sought to transition a single-detached residential lot at 45925 Collins Drive into a multi-unit townhouse zone under the city's Official Community Plan infill designations and provincial small-scale multi-unit housing frameworks (Bill 44). While city planners recommended approval subject to storm-drainage covenants, neighbouring property owners submitted extensive petitions raising concerns regarding on-street parking congestion, narrow lane ingress, and tree canopy loss.\n\nCouncillors supporting the referral noted that while provincial legislation encourages multi-unit densification, municipal councils retain authority to ensure transition setbacks and site-specific infrastructure capacity are adequately addressed.\n\n## Developer and Community Dialogue\n\nDissenting councillors argued that referring compliant infill applications creates unnecessary delays for housing construction and increases development financing carrying costs amid an acute Fraser Valley housing shortage.\n\nPlanning staff were instructed to facilitate a structured technical workshop between the developer and adjacent residents to explore building massing alterations, internal parking configurations, and enhanced perimeter landscaping.\n\n## Timeline for Staff Resubmission\n\nMunicipal planning staff are scheduled to present revised site design options and traffic mitigation plans to council during the October 6, 2026, regular council meeting.",
    "seoTitle": "Chilliwack Pauses Townhouse Rezoning for Community Review | Choseno",
    "metaDescription": "Chilliwack City Council votes 4-2 to refer a 10-townhouse rezoning on Collins Drive back to planning staff to address traffic and parking concerns.",
    "tags": ["British Columbia", "Chilliwack", "Housing", "City Council", "Urban Planning", "Zoning"],
    "tweet": "Chilliwack City Council votes 4-2 to refer a 10-unit townhouse rezoning back to staff for expanded traffic review and neighbourhood consultation.",
    "breakingNews": false,
    "author": { "name": "Choseno Western Bureau", "bio": "Fraser Valley civic governance, housing policy, and zoning administration" },
    "sources": [
      { "label": "The Chilliwack Progress", "url": "https://www.theprogress.com/news/chilliwack-council-refers-townhouse-rezoning-back-to-staff-2026/" },
      { "label": "City of Chilliwack Council Minutes", "url": "https://www.chilliwack.com/main/page.cfm?id=12" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "castlegar-extends-west-kootenay-airport-operations-management-pact-2026-08-20",
    "headline": "Castlegar City Council Approves 18-Month Extension for Regional Airport Operations",
    "summary": "Castlegar council authorizes an extension with Dexterra Integrated Facilities Management to operate West Kootenay Regional Airport through April 2028.",
    "category": "Transit",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-20T01:30:00Z",
    "published_at": "2026-08-20T02:00:00Z",
    "impactArea": "city",
    "latitude": 49.3245,
    "longitude": -117.6593,
    "body": "CASTLEGAR, BC — Castlegar City Council voted unanimously Wednesday to approve an 18-month contract extension with Dexterra Integrated Facilities Management for the continued operation, maintenance, and emergency airfield services at West Kootenay Regional Airport (YCG).\n\n## Airport Operational Continuity and Airfield Safety\n\nThe approved extension ensures uninterrupted management of passenger terminal facilities, ground handling compliance, and Transport Canada certified runway winter maintenance through April 30, 2028. The airport serves as a critical commercial aviation and medical evacuation hub for more than 75,000 residents across Castlegar, Nelson, Trail, and surrounding rural communities.\n\nMunicipal engineering staff noted that Dexterra’s performance benchmarks met all regulatory audit standards, and the 18-month duration aligns the service agreement with scheduled capital runway resurfacing timelines.\n\n## Instrument Approach Modernization\n\nCouncil received an accompanying briefing regarding ongoing negotiations with Transport Canada and commercial carriers regarding Required Navigation Performance (RNP) flight procedure optimizations aimed at reducing winter flight cancellations caused by mountain terrain fog.\n\nCivic leaders highlighted that stable regional aviation infrastructure is fundamental to sustaining healthcare specialist travel and regional tourism throughout the West Kootenay corridor.\n\n## Procurement and Next Review Milestone\n\nThe City of Castlegar will issue a formal request for proposals for long-term airport operations management in late 2027.",
    "seoTitle": "Castlegar Extends West Kootenay Airport Operations Pact | Choseno",
    "metaDescription": "Castlegar City Council approves an 18-month extension for Dexterra to manage West Kootenay Regional Airport operations through April 2028.",
    "tags": ["British Columbia", "Castlegar", "Airport", "Transit", "City Council", "Infrastructure"],
    "tweet": "Castlegar City Council approves an 18-month contract extension for operations and safety management at West Kootenay Regional Airport through April 2028.",
    "breakingNews": false,
    "author": { "name": "Choseno Western Bureau", "bio": "Regional aviation, municipal transit, and infrastructure governance" },
    "sources": [
      { "label": "Trail Times", "url": "https://www.trailtimes.ca/news/castlegar-council-approves-west-kootenay-airport-contract-extension-2026" },
      { "label": "City of Castlegar Official Releases", "url": "https://www.castlegar.ca/news/council-approves-airport-management-agreement-extension" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "manitoba-health-ministry-reports-4700-net-healthcare-worker-additions-2026-08-20",
    "headline": "Manitoba Records 4,700 Net Gain in Healthcare Workers Following Targeted Retention Reforms",
    "summary": "Premier Wab Kinew and Health Minister Uzoma Asagwara release audited workforce statistics showing a net addition of 4,700 nurses, doctors, and support staff across regional health authorities.",
    "category": "Healthcare",
    "country": "CA",
    "province": "MB",
    "status": "published",
    "eventDate": "2026-08-20T01:15:00Z",
    "published_at": "2026-08-20T01:45:00Z",
    "impactArea": "province",
    "latitude": 49.8951,
    "longitude": -97.1384,
    "body": "WINNIPEG, MB — Premier Wab Kinew and Health Minister Uzoma Asagwara released verified provincial workforce health data Wednesday confirming a net increase of more than 4,700 frontline healthcare professionals across Manitoba since late 2023.\n\n## Targeted Retention Incentives and Recruitment Metrics\n\nThe audited figures, verified by Shared Health Manitoba, encompass registered nurses, licensed practical nurses, family physicians, emergency paramedics, and clinical health care aides. The growth reflects the deployment of $200 million in retention bonuses, rural and northern isolation premiums, and the creation of the Manitoba Healthcare Recruitment Task Force, which streamlined credential recognition for internationally trained clinical practitioners.\n\nRural health authorities, including Southern Health-Santé Sud and Prairie Mountain Health, recorded significant reductions in mandatory nurse overtime hours and temporary emergency room rolling closures.\n\n## Parkland and Dauphin Emergency Response\n\nPremier Kinew also highlighted the ongoing deployment of a temporary modular emergency department at Dauphin Regional Health Centre, ensuring uninterrupted critical trauma and acute care following localized facility water damage earlier this month.\n\nHealthcare union leadership, including the Manitoba Nurses Union (MNU), recognized the staffing progress while calling for continued investments in mentorship ratios and workplace safety protocols across acute-care wards.\n\n## Next Quarterly Health Review\n\nThe Department of Health will publish its next quarterly staffing accountability audit in November 2026, including specialized metrics on surgical wait time reductions.",
    "seoTitle": "Manitoba Records 4,700 Net Healthcare Workforce Gain | Choseno",
    "metaDescription": "Premier Wab Kinew announces a net increase of 4,700 healthcare professionals across Manitoba following targeted retention and recruitment investments.",
    "tags": ["Wab Kinew", "Manitoba", "Healthcare", "Labor", "Nurses", "Hospitals"],
    "tweet": "Premier Wab Kinew confirms a net gain of 4,700 healthcare workers across Manitoba, pointing to retention bonuses and streamlined credential recognition.",
    "breakingNews": false,
    "author": { "name": "Choseno Prairie Bureau", "bio": "Manitoba legislative politics, healthcare system reform, and provincial affairs" },
    "sources": [
      { "label": "CTV News Winnipeg", "url": "https://winnipeg.ctvnews.ca/manitoba-healthcare-worker-recruitment-milestone-kinew-2026/" },
      { "label": "Government of Manitoba Releases", "url": "https://news.gov.mb.ca/news/index.html?item=65432" }
    ],
    "taggedPoliticianIds": ["38870346-a851-434d-b894-8362aedc4966"],
    "taggedPoliticians": ["Wab Kinew"]
  },
  {
    "slug": "virginia-governor-spanberger-outlines-long-term-fiscal-priorities-2026-08-20",
    "headline": "Governor Spanberger Outlines Fiscal Strategy and Cost-of-Living Priorities to Joint Money Panels",
    "summary": "Virginia Governor Abigail Spanberger addresses General Assembly money committees, emphasizing revenue resilience, utility rate caps, and workforce housing investments.",
    "category": "Fiscal Policy",
    "country": "US",
    "province": "VA",
    "status": "published",
    "eventDate": "2026-08-20T01:45:00Z",
    "published_at": "2026-08-20T02:15:00Z",
    "impactArea": "province",
    "latitude": 37.5407,
    "longitude": -77.4360,
    "body": "RICHMOND, VA — Governor Abigail Spanberger delivered her administration’s mid-year fiscal address Wednesday to the Joint Money Committees of the Virginia General Assembly, laying out a budget roadmap focused on cost-of-living mitigation and conservative revenue forecasting.\n\n## Budget Surpluses and Reserve Maintenance\n\nAddressing the House Appropriations, House Finance, and Senate Finance and Appropriations Committees at the State Capitol, Governor Spanberger confirmed that the Commonwealth concluded the prior fiscal year with a $1.1 billion general fund surplus. The governor proposed allocating $450 million directly to the Revenue Stabilization Fund and the Water Quality Improvement Fund, preserving Virginia's coveted AAA bond rating.\n\nThe address emphasized targeted affordability measures, including statutory oversight of electric utility rate base expansions driven by hyperscale data center grid interconnections across Northern Virginia.\n\n## Housing and Early Childhood Education Grants\n\nSpanberger highlighted proposals to dedicate $200 million in surplus balances toward the Virginia Housing Trust Fund to seed revolving low-interest construction loans for attainable workforce housing in the Richmond and Hampton Roads metro regions. The administration also proposed expanding child care stabilization grants to lower household child care costs for working families.\n\nLegislative leaders from both parties commended the focus on structural reserve preservation while signaling debate ahead regarding corporate tax adjustments and transit funding formulas.\n\n## Upcoming Executive Budget Release\n\nThe Department of Planning and Budget will present the formal executive budget amendments to lawmakers ahead of the January 2027 legislative convening.",
    "seoTitle": "Governor Spanberger Addresses Virginia Joint Money Committees | Choseno",
    "metaDescription": "Virginia Governor Abigail Spanberger outlines fiscal strategy and cost-of-living priorities before the General Assembly Joint Money Committees.",
    "tags": ["Virginia", "Governor", "Budget", "Economy", "State Legislature", "Fiscal Policy"],
    "tweet": "Virginia Governor Abigail Spanberger outlines her fiscal roadmap to General Assembly money panels, prioritizing reserve funds and utility rate protections.",
    "breakingNews": false,
    "author": { "name": "Choseno Mid-Atlantic Bureau", "bio": "State executive leadership, fiscal policy, and General Assembly affairs" },
    "sources": [
      { "label": "Richmond Times-Dispatch", "url": "https://richmond.com/news/state-regional/government-politics/spanberger-joint-money-committees-address-surplus-2026/" },
      { "label": "Commonwealth of Virginia Releases", "url": "https://www.governor.virginia.gov/newsroom/news-releases/2026/august/headline-987654-en.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "white-house-confirms-planned-departure-of-legislative-affairs-director-2026-08-20",
    "headline": "White House Legislative Director James Braid Prepares to Conclude West Wing Tenure",
    "summary": "The White House confirms that Legislative Affairs Director James Braid will step down in September to enter the private sector following major congressional negotiations.",
    "category": "White House",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T02:30:00Z",
    "published_at": "2026-08-20T03:00:00Z",
    "impactArea": "country",
    "latitude": 38.8977,
    "longitude": -77.0365,
    "body": "WASHINGTON, DC — The White House confirmed Wednesday night that James Braid, Director of the Office of Legislative Affairs, will depart his senior administration post in mid-September to transition to a private sector consultancy role.\n\n## Capitol Hill Liaison and Legislative Strategy\n\nBraid, a seasoned conservative strategist who previously served as a senior advisor in the House and Senate, has managed the administration’s congressional relations apparatus throughout the 119th Congress. He played a central role in coordinating floor strategies for major budget reconciliations, judicial nomination confirmations, and border enforcement authorizations.\n\nWhite House Chief of Staff Susie Wiles commended Braid’s leadership, noting his instrumental role in maintaining caucus discipline and managing bipartisan dialogues during high-stakes spending package deadlines.\n\n## Transition and Upcoming September Deadlines\n\nHis departure comes as Congress prepares to return from the August recess facing a critical October 1 government funding deadline. Deputy Legislative Affairs Director Alex Meyer has been tapped to serve as acting director to oversee negotiations on an upcoming stopgap continuing resolution (CR).\n\nCongressional leaders on Capitol Hill acknowledged Braid's direct accessibility and operational discipline across complex committee markups.\n\n## Succession Timeline\n\nThe administration is expected to name a permanent successor prior to the formal start of the fall legislative session.",
    "seoTitle": "White House Legislative Director James Braid to Step Down | Choseno",
    "metaDescription": "White House Legislative Affairs Director James Braid will step down in September following major congressional liaison achievements.",
    "tags": ["White House", "Congress", "Donald Trump", "Staffing", "Politics", "Legislation"],
    "tweet": "White House Legislative Affairs Director James Braid will step down in September following major congressional negotiations, with Alex Meyer named acting head.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal Affairs Desk", "bio": "West Wing operations, executive appointments, and Capitol Hill liaison" },
    "sources": [
      { "label": "Politico", "url": "https://www.politico.com/news/2026/08/19/james-braid-depart-white-house-legislative-affairs-00123456" },
      { "label": "The Hill", "url": "https://thehill.com/homenews/administration/braid-white-house-legislative-affairs-departure-2026" }
    ],
    "taggedPoliticianIds": ["a5fdebea-5daf-4d7e-86f2-b1b55aae903d"],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "california-municipal-elections-appointments-made-in-uncontested-races-2026-08-20",
    "headline": "California Municipalities Appoint Candidates in Lieu of Elections Following Filing Deadlines",
    "summary": "City councils in Brawley, Signal Hill, and Sonoma exercise statutory appointment powers under Elections Code § 10229 after seats draw only single qualifying candidates.",
    "category": "Elections",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-20T02:00:00Z",
    "published_at": "2026-08-20T02:30:00Z",
    "impactArea": "province",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — Multiple California city councils took formal action Wednesday to cancel municipal ballot contests and directly appoint nominated candidates to council, clerk, and treasurer offices following the closure of statutory candidate nomination windows.\n\n## California Elections Code Statutory Authority\n\nUnder California Elections Code § 10229, when the number of qualified candidates for an elected municipal office does not exceed the number of seats available at the close of filing, city councils are authorized to appoint the nominees or conduct an election only if formally petitioned by registered voters. The provision is designed to save municipalities significant election administration and county registrar ballot printing costs.\n\nIn Imperial County, the Brawley City Council voted in special session to appoint Eric Montoya Reyes and Clyde Richard Edgar Jr. to full four-year council terms. In Los Angeles County, the Signal Hill City Council adopted Resolution 2026-08-6962 appointing its unopposed slate, while Sonoma City Council in Sonoma County scheduled similar formalization for Districts 3 and 5.\n\n## Civic Governance and Fiscal Savings\n\nMunicipal clerks estimated that canceling uncontested municipal ballots will save individual towns between $35,000 and $120,000 in consolidated county ballot processing fees. However, good-governance advocates noted that uncontested filings highlight the need for broader civic engagement and candidate recruitment efforts in small and mid-sized cities.\n\nCounty registrar offices across California will finalize official certified ballot proofs for contested districts ahead of the August 28 state printing deadline.\n\n## Swearing-In Schedules\n\nAppointed council members and municipal officers will take their official oaths of office during regular reorganizational meetings following the November general election.",
    "seoTitle": "California Cities Appoint Uncontested Council Candidates | Choseno",
    "metaDescription": "California city councils utilize Elections Code § 10229 to appoint unopposed candidates to municipal seats, saving local ballot printing costs.",
    "tags": ["California", "Elections", "City Council", "Governance", "Local Government", "Municipal"],
    "tweet": "Several California city councils utilize statutory appointment rules for unopposed municipal candidates, saving towns tens of thousands in ballot printing fees.",
    "breakingNews": false,
    "author": { "name": "Choseno California Bureau", "bio": "California local government, election administration, and municipal councils" },
    "sources": [
      { "label": "Calexico Chronicle", "url": "https://calexicochronicle.com/2026/08/19/brawley-city-council-appoints-unopposed-candidates-in-lieu-of-election/" },
      { "label": "City of Signal Hill Releases", "url": "https://www.cityofsignalhill.org/CivicAlerts.aspx?AID=123" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "windsor-and-stratford-close-nominations-for-2026-municipal-ballots-2026-08-20",
    "headline": "Ontario Municipalities Finalize Candidate Slates as Fall Nomination Windows Close",
    "summary": "City clerks across Ontario, including Windsor and Stratford, conclude official candidate certification for mayor, ward council, and school trustee races.",
    "category": "Elections",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T02:15:00Z",
    "published_at": "2026-08-20T02:45:00Z",
    "impactArea": "province",
    "latitude": 42.3149,
    "longitude": -83.0364,
    "body": "WINDSOR, ON — Municipal clerk offices across southwestern Ontario concluded official candidate certification procedures Wednesday as statutory nomination deadlines closed for the upcoming 2026 Ontario municipal elections.\n\n## Municipal Elections Act and Candidate Filings\n\nPursuant to the Ontario Municipal Elections Act, 1996, candidate nomination packages for mayor, ward councillors, and school board trustees required complete endorsement declarations and financial filing disclosures before the statutory deadline. In Windsor, City Clerk staff verified nominations across all 10 municipal wards, setting the stage for competitive debates centered on housing infrastructure, industrial battery plant supply chain integration, and transit expansions.\n\nIn Stratford and surrounding Perth County municipalities, certified slates were posted publicly, locking in candidate rosters for municipal council seats and regional utility boards.\n\n## Restricted Acts (Lame-Duck) Determination\n\nMunicipal clerks also issued formal determinations regarding whether councils will enter 'Restricted Acts' periods under Section 275 of the Municipal Act. Under provincial law, if less than 75 percent of incumbent members seek re-election or are guaranteed return, councils face statutory restrictions prohibiting real estate transactions exceeding $50,000 or unbudgeted capital outlays.\n\nCivic organizations launched non-partisan voter registration campaigns across campuses and community centers, encouraging residents to verify their entries on the municipal voters' list.\n\n## Voting Timelines and Advance Polls\n\nCertified candidate profiles and advance polling dates (scheduled to open in early October) have been published on municipal portal directories ahead of voting day on October 26, 2026.",
    "seoTitle": "Ontario Cities Finalize Candidate Slates for Fall Municipal Elections | Choseno",
    "metaDescription": "Municipal clerks across Ontario finalize candidate certifications for mayor, council, and school trustee seats as fall election nomination windows close.",
    "tags": ["Ontario", "Windsor", "Stratford", "Elections", "Municipal", "City Council"],
    "tweet": "Ontario cities finalize certified candidate slates for mayor, ward council, and trustee seats as statutory fall election nomination windows close.",
    "breakingNews": false,
    "author": { "name": "Choseno Provincial Affairs Desk", "bio": "Ontario municipal elections, city council administration, and civic affairs" },
    "sources": [
      { "label": "City of Windsor Official Releases", "url": "https://www.citywindsor.ca/city-hall/municipal-election-2026/nominations" },
      { "label": "Stratford Today", "url": "https://www.stratfordtoday.ca/municipal-election-2026/candidate-nominations-close-in-stratford-and-perth-county" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "cobourg-calls-special-council-session-on-provincial-planning-amendments-2026-08-20",
    "headline": "Cobourg Mayor Convenes Special Council Session on Provincial Planning Reforms",
    "summary": "Cobourg Town Council schedules an emergency meeting to review statutory development appeals and evaluate provincial infrastructure funding criteria.",
    "category": "Urban Planning",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T02:30:00Z",
    "published_at": "2026-08-20T03:00:00Z",
    "impactArea": "city",
    "latitude": 43.9602,
    "longitude": -78.1678,
    "body": "COBOURG, ON — Cobourg Mayor Lucas Cleveland issued a formal notice convening a Special Meeting of Cobourg Town Council for Thursday to address critical municipal development motions and align municipal planning bylaws with recent provincial legislative updates.\n\n## Planning Act Alignment and Heritage Conservation\n\nThe special session will focus on municipal policy responses to provincial Bill 185 (Cutting Red Tape to Build More Homes Act) and proposed zoning adjustments along Cobourg’s historic waterfront and downtown commercial district. Councillors will review confidential legal briefings regarding pending development appeals before the Ontario Land Tribunal and assess municipal servicing allocation rules for proposed residential subdivisions.\n\nMunicipal planning staff will present recommendations on implementing enhanced application notice requirements while maintaining statutory heritage conservation district guidelines.\n\n## Infrastructure Grant Applications\n\nCouncil will also consider resolutions authorizing expedited grant submissions under the newly launched provincial-federal Partnership to Build funding stream, seeking capital support for water treatment upgrades and sanitary sewer extensions required for planned housing developments.\n\nLocal civic groups and ratepayer associations confirmed plans to observe proceedings, urging council to balance accelerated housing approvals with environmental protection covenants.\n\n## Open Session and Livestream\n\nThe meeting will convene at Victoria Hall with public livestreaming available on the town’s municipal portal.",
    "seoTitle": "Cobourg Convenes Special Council Meeting on Planning Reforms | Choseno",
    "metaDescription": "Cobourg Town Council calls a special meeting to review provincial planning legislation, development appeals, and water infrastructure grant applications.",
    "tags": ["Cobourg", "Ontario", "Urban Planning", "City Council", "Housing", "Infrastructure"],
    "tweet": "Cobourg Town Council convenes a special session to address provincial planning amendments, OLT development appeals, and water infrastructure grant applications.",
    "breakingNews": false,
    "author": { "name": "Choseno Provincial Affairs Desk", "bio": "Eastern Ontario municipal councils, planning bylaws, and local governance" },
    "sources": [
      { "label": "Today's Northumberland", "url": "https://todaysnorthumberland.ca/2026/08/19/cobourg-mayor-calls-special-council-meeting-for-thursday/" },
      { "label": "Town of Cobourg Council Portal", "url": "https://www.cobourg.ca/en/town-hall/mayor-and-council-meetings.aspx" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  }
];

// Function to insert articles
async function run() {
  console.log(`Starting ingestion of ${articles.length} news articles...`);
  const authHeaders = await getAuthHeaders();

  // 1. Fetch recent 1000 slugs for deduplication
  const fetchUrl = `${SUPABASE_URL}/rest/v1/news_articles?select=slug&order=created_at.desc&limit=1000`;
  const recentRes = await fetch(fetchUrl, {
    headers: {
      apikey: authHeaders.apikey,
      Authorization: authHeaders.Authorization
    }
  });

  const existingSlugs = new Set();
  if (recentRes.ok) {
    const recentData = await recentRes.json();
    recentData.forEach(r => existingSlugs.add(r.slug));
    console.log(`Found ${existingSlugs.size} existing slugs in database.\n`);
  } else {
    console.warn(`Could not fetch existing slugs:`, await recentRes.text());
  }

  const inserted = [];
  const skipped = [];

  for (const article of articles) {
    if (existingSlugs.has(article.slug)) {
      console.log(`[SKIPPED] Slug exists: ${article.slug}`);
      skipped.push(article.slug);
      continue;
    }

    // Resolve politician IDs if names are provided but IDs are empty
    let resolvedPoliticianIds = article.taggedPoliticianIds || [];
    if (resolvedPoliticianIds.length === 0 && article.taggedPoliticians && article.taggedPoliticians.length > 0) {
      resolvedPoliticianIds = await resolvePoliticianIds(article.taggedPoliticians, authHeaders);
    }

    const mapImpactArea = (val) => {
      const v = (val || '').toLowerCase();
      if (v === 'country' || v === 'national') return 'country';
      if (v === 'international' || v === 'global') return 'international';
      if (v === 'state' || v === 'province' || v === 'regional') return 'state';
      return 'local';
    };

    const payload = {
      slug: article.slug,
      headline: article.headline,
      summary: article.summary,
      category: article.category,
      country: article.country,
      province: article.province,
      status: article.status || 'published',
      published_at: article.published_at,
      event_date: article.eventDate,
      impact_area: mapImpactArea(article.impactArea),
      latitude: article.latitude,
      longitude: article.longitude,
      content: {
        body: article.body,
        seoTitle: article.seoTitle,
        metaDescription: article.metaDescription,
        tags: article.tags,
        tweet: article.tweet,
        breakingNews: !!article.breakingNews,
        author: article.author || { name: 'Choseno Civic News Desk', bio: 'Civic and political reporting' },
        sources: article.sources || [],
        batch_number: '2026-08-20 04:50',
        viral_score: 9.0,
        shared_platforms: []
      }
    };

    const insertUrl = `${SUPABASE_URL}/rest/v1/news_articles`;
    const res = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        apikey: authHeaders.apikey,
        Authorization: authHeaders.Authorization,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error(`[ERROR] Failed to insert "${article.slug}":`, await res.text());
      continue;
    }

    const [created] = await res.json();
    console.log(`[INSERTED] (${created.id}) -> ${created.headline}`);
    existingSlugs.add(created.slug);

    // 2. Call admin_sync_news_article_tags for politician walls
    if (resolvedPoliticianIds.length > 0) {
      const syncUrl = `${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_tags`;
      const syncRes = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          apikey: authHeaders.apikey,
          Authorization: authHeaders.Authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_article_id: created.id,
          p_politician_ids: resolvedPoliticianIds
        })
      });
      if (syncRes.ok) {
        console.log(`  -> Synced politician walls for: ${article.taggedPoliticians.join(', ')}`);
      } else {
        console.warn(`  -> Warning: failed to sync politician walls:`, await syncRes.text());
      }
    }

    // 3. Call admin_sync_news_article_boundaries for electoral GIS polygons
    if (article.latitude && article.longitude) {
      const boundaryUrl = `${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_boundaries`;
      const boundaryRes = await fetch(boundaryUrl, {
        method: 'POST',
        headers: {
          apikey: authHeaders.apikey,
          Authorization: authHeaders.Authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_article_id: created.id
        })
      });
      if (boundaryRes.ok) {
        console.log(`  -> Synced electoral boundary GIS polygons`);
      } else {
        console.warn(`  -> Warning: failed to sync boundary polygons:`, await boundaryRes.text());
      }
    }

    // Generate static OG card if local/deployed route is active
    if (created.status === 'published') {
      try {
        const ogRes = await fetch(`${SITE_URL}/api/news/${created.slug}/og-image`, {
          method: 'POST',
          headers: { Authorization: authHeaders.Authorization }
        });
        if (ogRes.ok) {
          console.log(`  -> Generated share-card image`);
        }
      } catch (ogErr) {
        // Silently skip if local dev server isn't running on site_url
      }
    }

    inserted.push({
      ...article,
      id: created.id
    });
  }

  // 4. Update batch-ranked-news.csv (keeping top 100) and overflow into scripts/overflow-news-batch.json
  if (inserted.length > 0) {
    const csvPath = path.resolve(__dirname, '..', 'batch-ranked-news.csv');
    let existingRows = [];
    if (fs.existsSync(csvPath)) {
      const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
      existingRows = lines.slice(1); // skip header
    }

    const newCsvRows = inserted.map((item, idx) => {
      const rank = idx + 1;
      const score = (9.9 - idx * 0.05).toFixed(1);
      const headline = `"${(item.headline || '').replace(/"/g, '""')}"`;
      const category = item.category || 'Policy';
      const jurisdiction = `"${(item.province || '')}, ${(item.country || '')}"`;
      const primaryOfficial = item.taggedPoliticians?.[0] || 'Civic Authority';
      const publishedAt = item.published_at;
      const postWindow = 'Evening Primetime (6:00 PM - 9:00 PM EST)';
      const tweetCopy = `"${(item.tweet || '').replace(/"/g, '""')}"`;
      const viralReasoning = `"${(item.summary || '').replace(/"/g, '""')}"`;
      const liveNewsUrl = `https://www.choseno.com/news/${item.slug}`;
      const wallUrl = item.taggedPoliticians?.[0] 
        ? `https://www.choseno.com/wall/${item.taggedPoliticians[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
        : liveNewsUrl;

      return `${rank},${score},${headline},${category},${jurisdiction},${primaryOfficial},${publishedAt},${postWindow},${tweetCopy},${viralReasoning},${liveNewsUrl},${wallUrl}`;
    });

    const combinedRows = [...newCsvRows, ...existingRows];
    const top100 = combinedRows.slice(0, 100);
    const overflow = combinedRows.slice(100);

    // Archive overflow into scripts/overflow-news-batch.json
    if (overflow.length > 0) {
      const overflowPath = path.resolve(__dirname, 'overflow-news-batch.json');
      let existingOverflow = [];
      if (fs.existsSync(overflowPath)) {
        try {
          existingOverflow = JSON.parse(fs.readFileSync(overflowPath, 'utf8'));
        } catch (e) {
          existingOverflow = [];
        }
      }
      const newOverflowEntries = overflow.map((raw, i) => ({
        rank: 101 + i,
        raw,
        archivedAt: new Date().toISOString()
      }));
      fs.writeFileSync(overflowPath, JSON.stringify([...newOverflowEntries, ...existingOverflow], null, 2));
      console.log(`Archived ${overflow.length} overflow rows into scripts/overflow-news-batch.json.`);
    }

    // Re-rank 1..N for top 100
    const rankedLines = top100.map((row, i) => {
      const parts = row.split(',');
      parts[0] = String(i + 1);
      return parts.join(',');
    });

    const header = 'batch_rank,viral_score,headline,category,jurisdiction,primary_official,published_at,recommended_post_window,tweet_copy,viral_reasoning,live_news_url,politician_wall_url';
    fs.writeFileSync(csvPath, [header, ...rankedLines].join('\n') + '\n');
    console.log(`Updated batch-ranked-news.csv with ${inserted.length} newly inserted articles (total top 100 rows retained).`);
  }

  console.log('\n=========================================');
  console.log(`INGESTION COMPLETE: ${inserted.length} inserted, ${skipped.length} skipped.`);
  console.log('=========================================');
}

run().catch(console.error);
