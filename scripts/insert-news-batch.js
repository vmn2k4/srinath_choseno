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
      const query = `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name&role=eq.politician&full_name.ilike.*${encodeURIComponent(name)}*&limit=1`;
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

// 2. Article payload to ingest (Dynamic Lookback Batch Part 2: 2026-08-20T21:10:00Z to 2026-08-21T04:19:55Z)
const articles = [
  {
    "slug": "kansas-city-council-approves-six-hundred-million-downtown-royals-stadium-funding-2026-08-21",
    "headline": "Kansas City Council Approves $600M Public Financing for Downtown Baseball Ballpark",
    "summary": "In a decisive 9-4 vote, the Kansas City Council authorizes $600 million in municipal bond financing to construct a $1.9 billion downtown baseball stadium for the Royals.",
    "category": "Municipal",
    "country": "US",
    "province": "MO",
    "status": "published",
    "eventDate": "2026-08-21T00:15:00Z",
    "published_at": "2026-08-21T01:00:00Z",
    "impactArea": "local",
    "latitude": 39.0997,
    "longitude": -94.5786,
    "body": "KANSAS CITY, MO — The Kansas City Council voted 9-4 late Thursday evening to approve an ordinance committing $600 million in municipal sales tax bond backing to anchor a $1.9 billion downtown baseball stadium and mixed-use entertainment district for the Kansas City Royals.\n\n## Municipal Bond Structuring and Community Benefits Agreement\n\nThe municipal ordinance authorizes the issuance of Special Obligation Bonds backed by existing downtown convention tourism sales taxes and new project-generated retail sales taxes, structured to ensure debt service does not divert general municipal tax revenues away from city police, fire, and street services. In exchange, the team ownership group executed a binding Community Benefits Agreement (CBA) committing $150 million toward downtown affordable housing trust funds, minority business procurement quotas, and union prevailing wage guarantees for stadium construction trade workers.\n\nMayor Quinton Lucas praised the agreement as a generational catalyst for downtown retail, mass transit ridership, and urban economic revitalization.\n\n## Public Debate and Fiscal Accountability Guardrails\n\nDuring more than four hours of intense public debate, neighborhood advocacy coalitions expressed concerns regarding potential commercial displacement in adjacent historic districts.\n\nCouncil leaders incorporated strict clawback amendments requiring the franchise to cover all future stadium maintenance and cost overruns without additional taxpayer contributions.\n\n## Groundbreaking and Construction Timetable\n\nArchitectural design reviews and utility relocation will commence in early 2027, with the new downtown ballpark targeting an Opening Day debut in April 2030.",
    "seoTitle": "Kansas City Council Approves $600M for Downtown Royals Stadium | Choseno",
    "metaDescription": "Kansas City Council votes 9-4 to approve $600M in public financing for a new $1.9B downtown baseball stadium and entertainment district.",
    "tags": ["Municipal", "Economy", "Infrastructure", "Missouri", "Urban Planning", "Sports"],
    "tweet": "Kansas City Council votes 9-4 to approve 600 million dollars in public financing for a new 1.9 billion dollar downtown baseball ballpark.",
    "breakingNews": false,
    "author": { "name": "Choseno Midwest Civic Desk", "bio": "Midwest municipal politics, urban development financing, and city council governance" },
    "sources": [
      { "label": "City of Kansas City Council Records", "url": "https://www.kcmo.gov/city-hall/city-council/ordinances/2026-downtown-ballpark-approval" },
      { "label": "The Kansas City Star", "url": "https://www.kansascity.com/news/politics-government/article2914021.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "governor-shapiro-announces-ten-million-fruit-grower-freeze-disaster-recovery-fund-2026-08-21",
    "headline": "Governor Shapiro Launches $10M Disaster Relief Grant Program for Pennsylvania Fruit Growers",
    "summary": "Pennsylvania Governor Josh Shapiro unveils a $10 million state emergency relief grant fund to assist commercial apple, peach, and cherry growers devastated by late-spring freezes.",
    "category": "Agriculture",
    "country": "US",
    "province": "PA",
    "status": "published",
    "eventDate": "2026-08-20T22:30:00Z",
    "published_at": "2026-08-20T23:15:00Z",
    "impactArea": "state",
    "latitude": 39.8309,
    "longitude": -77.2311,
    "body": "BIGLERVILLE, PA — Governor Josh Shapiro visited Three Springs Fruit Farm in Adams County Thursday evening to announce the launch of the Pennsylvania Fruit Grower Freeze Disaster Assistance Recovery Grant Program, delivering $10 million in direct state grants to family orchards suffering catastrophic crop losses.\n\n## Agricultural Disaster Relief and Grant Eligibility\n\nFunded through the 2026–27 Commonwealth budget, the disaster program offers direct recovery grants of up to $50,000 to commercial fruit producers who experienced documented harvest losses exceeding 30 percent during a severe late-April deep freeze that destroyed budding blossoms across Adams, Franklin, Berks, and York counties. Grant funds can be deployed to cover seasonal farm labor overhead, tree pruning maintenance, and the installation of modern wind-machine frost protection towers to safeguard future crops.\n\nGovernor Shapiro emphasized that Pennsylvania’s multi-billion-dollar fruit agricultural industry forms the cultural and economic backbone of rural communities across South-Central Pennsylvania.\n\n## Farm Bureau and Industry Commendation\n\nThe Pennsylvania Farm Bureau and State Horticultural Association strongly supported the rapid rollout, noting that federal crop insurance payouts frequently take over a year to disburse.\n\nState Agriculture Secretary Russell Redding confirmed that grant applications will be processed on a rolling basis to disburse funds prior to the autumn packing season.\n\n## Application Portal Launch Date\n\nThe Pennsylvania Department of Agriculture will open the online grant application portal on Monday, August 24, 2026.",
    "seoTitle": "Governor Shapiro Launches $10M Freeze Relief for PA Fruit Growers | Choseno",
    "metaDescription": "Pennsylvania Governor Josh Shapiro announces a $10M emergency relief program to support fruit growers impacted by severe crop freezes.",
    "tags": ["Josh Shapiro", "Pennsylvania", "Agriculture", "Economy", "Disaster Relief", "Farming"],
    "tweet": "Governor Josh Shapiro announces 10 million dollars in state disaster relief grants to assist Pennsylvania fruit orchards impacted by crop freezes.",
    "breakingNews": false,
    "author": { "name": "Choseno Pennsylvania Bureau", "bio": "Pennsylvania Commonwealth politics, agricultural policy, and executive state governance" },
    "sources": [
      { "label": "Commonwealth of Pennsylvania Newsroom", "url": "https://www.pa.gov/en/agencies/pda/newsroom/governor-shapiro-fruit-grower-freeze-disaster-assistance-program.html" },
      { "label": "PennLive", "url": "https://www.pennlive.com/news/2026/08/shapiro-announces-10m-disaster-aid-adams-county-fruit-growers.html" }
    ],
    "taggedPoliticianIds": ["b79d61e5-8476-45f0-9eed-a7d6304f6eac"],
    "taggedPoliticians": ["Josh Shapiro"]
  },
  {
    "slug": "governor-stein-vetoes-north-carolina-voting-omnibus-bill-and-creates-healthcare-panel-2026-08-21",
    "headline": "Governor Stein Vetoes Restrictive Election Bill and Establishes Healthcare Affordability Board",
    "summary": "North Carolina Governor Josh Stein vetoes House Bill 958 over ballot challenge restrictions while signing an executive order to rein in rising medical and prescription drug costs.",
    "category": "Executive",
    "country": "US",
    "province": "NC",
    "status": "published",
    "eventDate": "2026-08-20T22:45:00Z",
    "published_at": "2026-08-20T23:30:00Z",
    "impactArea": "state",
    "latitude": 35.7796,
    "longitude": -78.6382,
    "body": "RALEIGH, NC — Governor Josh Stein executed two major executive actions Thursday evening, issuing a formal gubernatorial veto against House Bill 958 while signing Executive Order 14 to establish the Governor’s Commission on Health Care Affordability.\n\n## Gubernatorial Veto and Voting Rights Protections\n\nIn his veto message to the General Assembly, Governor Stein characterized HB 958 as an unconstitutional voter suppression measure that would have eliminated standard Sunday early voting hours and permitted mass, automated challenges to provisional ballots up to 72 hours after Election Day. Stein asserted that democratic legitimacy requires making voting accessible, secure, and transparent for every eligible North Carolina citizen, rather than erecting partisan procedural hurdles.\n\nCivil rights organizations commended the veto, noting that late-stage ballot challenge provisions risked disenfranchising military and college student voters.\n\n## Health Care Affordability Commission Mandate\n\nUnder Executive Order 14, the newly created Health Care Affordability Commission is tasked with developing state-level cost caps on life-saving prescription medications, investigating hospital facility fee markups, and recommending antitrust actions against non-competitive healthcare hospital mergers.\n\nGeneral Assembly legislative leaders signaled they will attempt a veto override vote when lawmakers reconvene for the fall veto session.\n\n## Commission Initial Reporting Deadlines\n\nThe Health Care Affordability Commission will convene its inaugural public hearing in Greensboro on September 24, 2026.",
    "seoTitle": "Governor Stein Vetoes NC Voting Bill and Signs Healthcare Order | Choseno",
    "metaDescription": "North Carolina Governor Josh Stein vetoes restrictive voting legislation (HB 958) and signs an executive order targeting healthcare costs.",
    "tags": ["North Carolina", "Voting Rights", "Healthcare", "Executive", "Elections", "Legislation"],
    "tweet": "Governor Josh Stein vetoes restrictive voting legislation in North Carolina and signs an executive order targeting rising healthcare costs.",
    "breakingNews": false,
    "author": { "name": "Choseno Southeast Bureau", "bio": "North Carolina executive governance, voting rights law, and healthcare regulatory policy" },
    "sources": [
      { "label": "Office of Governor Josh Stein", "url": "https://governor.nc.gov/news/press-releases/2026/08/20/governor-stein-vetoes-hb-958-signs-healthcare-affordability-order" },
      { "label": "The News & Observer", "url": "https://www.newsobserver.com/news/politics-government/state-politics/article2914102.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "new-brunswick-premier-holt-conditions-us-liquor-restocking-on-softwood-lumber-tariffs-2026-08-21",
    "headline": "Premier Holt Rebuffs U.S. Alcohol Restocking Until Cross-Border Softwood Duties Ease",
    "summary": "New Brunswick Premier Susan Holt states provincial liquor stores will maintain bans on American spirits until U.S. trade negotiators reduce punitive tariffs on Maritime timber exports.",
    "category": "Trade",
    "country": "CA",
    "province": "NB",
    "status": "published",
    "eventDate": "2026-08-20T23:00:00Z",
    "published_at": "2026-08-20T23:45:00Z",
    "impactArea": "state",
    "latitude": 45.9636,
    "longitude": -66.6431,
    "body": "FREDERICTON, NB — Premier Susan Holt announced Thursday night that the Province of New Brunswick will not direct Alcool NB Liquor (ANBL) to restock American spirits and beers on retail shelves until the United States provides verifiable commitments to reduce countervailing duties on Maritime softwood lumber.\n\n## Regional Forestry Trade and Retaliatory Leverage\n\nPremier Holt’s declaration establishes a distinct provincial position among Atlantic Canadian leaders, following requests from federal officials to lift provincial liquor boycotts in exchange for broad manufacturing tariff relief in Washington. Holt emphasized that New Brunswick’s private-woodlot forestry sector employs over 24,000 workers and accounts for significant provincial export GDP, arguing that Canadian negotiators must not concede provincial retail leverage without securing permanent timber relief.\n\nHolt stated that New Brunswick forestry producers have operated under unfair U.S. countervailing duties for decades and deserve full inclusion in any comprehensive bilateral trade settlement.\n\n## Impact on Regional Retail and Cross-Border Commerce\n\nANBL confirmed that domestic New Brunswick craft spirits and regional Quebec wines will continue to occupy prominent retail display space across provincial stores.\n\nForestry trade associations strongly backed the Premier’s stance, pointing out that lumber mill curtailments directly hurt rural northern New Brunswick communities.\n\n## Atlantic First Ministers Consultations\n\nPremier Holt will confer with Nova Scotia, Prince Edward Island, and Newfoundland leaders during a regional Atlantic premiers’ call Friday morning.",
    "seoTitle": "Premier Holt Demands Softwood Lumber Relief in U.S. Trade Accord | Choseno",
    "metaDescription": "New Brunswick Premier Susan Holt says U.S. liquor bans will remain until the United States lowers tariffs on Canadian softwood lumber.",
    "tags": ["New Brunswick", "Trade", "Forestry", "Economy", "Atlantic Canada", "ANBL"],
    "tweet": "New Brunswick Premier Susan Holt states provincial liquor bans on U.S. alcohol will remain until cross-border softwood lumber duties are reduced.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Bureau", "bio": "New Brunswick provincial politics, forestry trade economics, and Atlantic intergovernmental policy" },
    "sources": [
      { "label": "Province of New Brunswick Newsroom", "url": "https://www2.gnb.ca/content/gnb/en/news/news_release.2026.08.0412.html" },
      { "label": "CBC News New Brunswick", "url": "https://www.cbc.ca/news/canada/new-brunswick/holt-refuses-us-liquor-restocking-softwood-lumber-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "new-brunswick-environment-trust-fund-awards-two-million-for-community-climate-projects-2026-08-21",
    "headline": "New Brunswick Distributes $2.2M in Environmental Trust Grants for Watershed Protection",
    "summary": "The New Brunswick Department of Environment awards over $2.2 million across 45 community-led projects to restore coastal wetlands and upgrade regional flood resilience.",
    "category": "Environment",
    "country": "CA",
    "province": "NB",
    "status": "published",
    "eventDate": "2026-08-20T22:15:00Z",
    "published_at": "2026-08-20T23:00:00Z",
    "impactArea": "state",
    "latitude": 45.9636,
    "longitude": -66.6431,
    "body": "FREDERICTON, NB — Minister of Environment and Climate Change Gilles LePage announced the distribution of more than $2.2 million from the provincial Environmental Trust Fund (ETF) Thursday evening, funding 45 grassroots environmental stewardship and climate adaptation projects across New Brunswick.\n\n## Environmental Trust Fund Allocations and Wetland Restoration\n\nThe funding delivers dedicated capital to community watershed groups, First Nations environmental monitors, and municipal conservation authorities. Priority initiatives include coastal dune restoration along the Acadian Peninsula, living shoreline erosion stabilization in the Bay of Fundy, and real-time water quality telemetry in the Saint John River watershed to protect wild Atlantic salmon habitat.\n\nMinister LePage highlighted that community-driven watershed management is essential for protecting drinking water supplies and shielding coastal infrastructure from storm surges.\n\n## Municipal Flood Resilience and Youth Engagement\n\nGrants also support local municipal stormwater mitigation engineering in Moncton and Saint John, alongside climate literacy programs in regional francophone and anglophone school districts.\n\nEnvironmental non-profit organizations praised the funding, noting that local ecological monitoring provides invaluable data for provincial land-use planning.\n\n## Project Commencement Timetable\n\nApproved environmental restoration work and riverbank planting projects will commence across funded regional sites in September 2026.",
    "seoTitle": "New Brunswick Awards $2.2M for Environmental Watershed Restoration | Choseno",
    "metaDescription": "The New Brunswick government awards $2.2M from the Environmental Trust Fund for 45 community climate resilience and wetland restoration projects.",
    "tags": ["New Brunswick", "Environment", "Climate", "Water", "Atlantic Canada", "Conservation"],
    "tweet": "New Brunswick distributes 2.2 million dollars from the Environmental Trust Fund for 45 community watershed restoration and flood resilience projects.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Environmental Desk", "bio": "Atlantic coastal conservation, environmental trust funding, and watershed management" },
    "sources": [
      { "label": "Government of New Brunswick Releases", "url": "https://www2.gnb.ca/content/gnb/en/news/news_release.2026.08.0410.html" },
      { "label": "Telegraph-Journal", "url": "https://tj.news/environment/2026/08/20/new-brunswick-environmental-trust-fund-announcement" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "north-carolina-rural-infrastructure-authority-approves-five-million-in-economic-grants-2026-08-21",
    "headline": "North Carolina Awards $4.9M in Rural Infrastructure Grants Supporting 450 Manufacturing Jobs",
    "summary": "Governor Josh Stein announces 11 economic development grants approved by the Rural Infrastructure Authority to expand municipal water and industrial rail infrastructure.",
    "category": "Economy",
    "country": "US",
    "province": "NC",
    "status": "published",
    "eventDate": "2026-08-20T22:30:00Z",
    "published_at": "2026-08-20T23:15:00Z",
    "impactArea": "state",
    "latitude": 35.7796,
    "longitude": -78.6382,
    "body": "RALEIGH, NC — Governor Josh Stein announced Thursday evening that the North Carolina Rural Infrastructure Authority (RIA) has formally approved 11 grant applications totaling over $4.9 million to upgrade municipal utility systems and attract $78 million in private capital investments across rural North Carolina counties.\n\n## Industrial Infrastructure Grants and Wage Benchmarks\n\nThe funding awards, administered through the North Carolina Department of Commerce, include building reuse grants and economic infrastructure allocations for municipalities in Robeson, Surry, Wilson, and Cleveland counties. The projects will finance wastewater treatment capacity expansions, industrial park access roadways, and railway spur lines required to support manufacturing expansions across advanced textiles, clean food processing, and aviation component manufacturing.\n\nThe capital investments are legally bound to create at least 450 permanent, full-time private sector jobs paying above county median wage baselines.\n\n## Rural Revitalization and Community Competitiveness\n\nGovernor Stein emphasized that expanding basic municipal utility infrastructure in rural counties ensures that economic growth and high-paying jobs reach every corner of North Carolina.\n\nCounty commissioners praised the grant awards, noting that modern water and sewer capacity is the primary prerequisite for recruiting national industrial employers.\n\n## Project Engineering and Construction Schedules\n\nMunicipal recipients will finalize engineering contracts by October 2026, with construction phased over 18 months.",
    "seoTitle": "North Carolina Awards $4.9M in Rural Infrastructure Grants | Choseno",
    "metaDescription": "Governor Josh Stein announces $4.9M in Rural Infrastructure Authority grants supporting 450 manufacturing jobs and $78M in private investment.",
    "tags": ["North Carolina", "Economy", "Infrastructure", "Manufacturing", "Jobs", "Rural Development"],
    "tweet": "North Carolina awards 4.9 million dollars in rural infrastructure grants, supporting 450 new manufacturing jobs across regional counties.",
    "breakingNews": false,
    "author": { "name": "Choseno Southeast Economic Desk", "bio": "North Carolina economic development, rural infrastructure financing, and industrial policy" },
    "sources": [
      { "label": "North Carolina Department of Commerce", "url": "https://www.nccommerce.com/news/press-releases/rural-infrastructure-authority-approves-49-million-economic-grants-august-2026" },
      { "label": "WRAL News", "url": "https://www.wral.com/news/state/nccommerce-rural-grants-august-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "sault-ste-marie-city-council-prepares-for-restricted-acts-period-post-nomination-deadline-2026-08-21",
    "headline": "Sault Ste. Marie Prepares for Municipal Election Nomination Deadline and Council Caretaker Mode",
    "summary": "City Clerk officials in Sault Ste. Marie announce candidate filing procedures ahead of the August 21 nomination deadline, preparing for statutory Municipal Act restricted acts rules.",
    "category": "Elections",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-21T01:30:00Z",
    "published_at": "2026-08-21T02:15:00Z",
    "impactArea": "local",
    "latitude": 46.5167,
    "longitude": -84.3333,
    "body": "SAULT STE. MARIE, ON — The City Clerk’s Office in Sault Ste. Marie issued a formal civic advisory late Thursday night reminding prospective municipal candidates that Friday, August 21, 2026, at 2:00 p.m. marks the statutory nomination deadline for mayor, ward councillors, and school board trustees under the Municipal Elections Act, 1996.\n\n## Statutory Lame-Duck Rules and Municipal Governance\n\nUnder Section 275 of the Ontario Municipal Act, if less than 75 percent of the current members of City Council seek re-election or if turnover thresholds are mathematically certain following Friday’s certified nominations, the municipal council enters a statutory 'restricted acts' (lame-duck) period. During this period, the outgoing council is legally prohibited from executing unbudgeted expenditures exceeding $50,000, disposing of municipal real property valued over $50,000, or making non-delegated senior executive appointments.\n\nCity Clerk Rachel Tyczinski confirmed that municipal operations and standard emergency services will continue without interruption under existing delegated administrative authority.\n\n## Candidate Certification and Campaign Rules\n\nOfficial certification of all nominated candidates will take place on Monday, August 24, at 4:00 p.m., after which formal election sign placements and public campaigning are officially authorized under municipal bylaws.\n\nCivic organizations urged residents to verify voter registration lists online ahead of advance polling dates in October.\n\n## Election Day Calendar\n\nMunicipal and school board election voting across Ontario will conclude on Monday, October 26, 2026.",
    "seoTitle": "Sault Ste. Marie Prepares for Municipal Election Nomination Deadline | Choseno",
    "metaDescription": "Sault Ste. Marie City Clerk outlines nomination deadline procedures and Municipal Act restricted acts rules ahead of the October civic election.",
    "tags": ["Doug Ford", "Ontario", "Municipal", "Elections", "Sault Ste. Marie", "Governance"],
    "tweet": "Sault Ste. Marie marks the statutory nomination deadline for the 2026 municipal election, triggering Municipal Act caretaker governance rules.",
    "breakingNews": false,
    "author": { "name": "Choseno Northern Ontario Desk", "bio": "Northern Ontario municipal governance, municipal election administration, and civic law" },
    "sources": [
      { "label": "City of Sault Ste. Marie Elections Office", "url": "https://saultstemarie.ca/City-Hall/City-Departments/Corporate-Services/City-Clerk/Municipal-Elections-2026.aspx" },
      { "label": "SooToday", "url": "https://www.sootoday.com/local-news/sault-council-nomination-deadline-restricted-acts-rules-2026-941020" }
    ],
    "taggedPoliticianIds": ["26ddb710-1861-4652-b8ed-dcbcc1dd7300"],
    "taggedPoliticians": ["Doug Ford"]
  },
  {
    "slug": "pennsylvania-state-police-helicopter-and-cessna-mid-air-collision-prompts-faa-probe-2026-08-21",
    "headline": "FAA and NTSB Launch Investigation Into Mid-Air Training Collision Near Carlisle Airport",
    "summary": "Federal aviation safety investigators deploy to Cumberland County, Pennsylvania, after a collision between a State Police helicopter and a Cessna 150 during landing practice.",
    "category": "Transportation",
    "country": "US",
    "province": "PA",
    "status": "published",
    "eventDate": "2026-08-20T23:45:00Z",
    "published_at": "2026-08-21T00:30:00Z",
    "impactArea": "state",
    "latitude": 40.2015,
    "longitude": -77.1889,
    "body": "CARLISLE, PA — Federal aviation safety investigators from the National Transportation Safety Board (NTSB) and the Federal Aviation Administration (FAA) arrived at Carlisle Regional Airport Thursday night to investigate a fatal mid-air collision between a Pennsylvania State Police Bell 407 helicopter and a civilian Cessna 150 single-engine aircraft.\n\n## Collision Details and Search and Rescue Response\n\nAccording to preliminary radar logs and eyewitness reports, both aircraft were conducting routine traffic pattern practice approaches to Runway 10 when the collision occurred approximately 1.5 miles west of the airfield. The civilian aircraft impacted agricultural terrain, fatally injuring the solo commercial pilot. The State Police helicopter executed a forced emergency autorotation into an adjacent clearing, with both state troopers sustaining serious injuries before being airlifted to Penn State Hershey Medical Center.\n\nPennsylvania State Police Commissioner Christopher Paris expressed profound sorrow over the tragic loss of life, confirming that the department is cooperating fully with federal aviation authorities.\n\n## Airfield Operations and Radar Reconstruction\n\nThe FAA temporarily closed airspace around Carlisle Regional Airport to allow NTSB investigators to map the wreckage scatter, inspect engine flight controls, and recover cockpit GPS avionics.\n\nAviation safety experts highlighted that non-towered general aviation airports rely on visual separation and radio traffic advisories, which investigators will scrutinize through recorded unicom radio transmissions.\n\n## NTSB Factual Summary Timeline\n\nThe NTSB confirmed that a preliminary aviation accident report will be published within 15 days.",
    "seoTitle": "NTSB Probes Mid-Air Collision Involving PA State Police Helicopter | Choseno",
    "metaDescription": "NTSB investigators probe a fatal mid-air collision between a PA State Police helicopter and a Cessna 150 near Carlisle Regional Airport.",
    "tags": ["Josh Shapiro", "Pennsylvania", "Transportation", "Aviation", "Public Safety", "NTSB"],
    "tweet": "The NTSB launches an investigation into a fatal mid-air collision between a Pennsylvania State Police helicopter and a light aircraft near Carlisle.",
    "breakingNews": false,
    "author": { "name": "Choseno Aviation Safety Desk", "bio": "Aviation accident investigations, FAA regulation, and public safety flight operations" },
    "sources": [
      { "label": "National Transportation Safety Board", "url": "https://www.ntsb.gov/investigations/Pages/carlisle-pa-aviation-accident-2026.aspx" },
      { "label": "PennLive", "url": "https://www.pennlive.com/news/2026/08/state-police-helicopter-cessna-mid-air-collision-carlisle-airport.html" }
    ],
    "taggedPoliticianIds": ["b79d61e5-8476-45f0-9eed-a7d6304f6eac"],
    "taggedPoliticians": ["Josh Shapiro"]
  },
  {
    "slug": "french-language-watchdog-investigates-telehealth-accessibility-in-new-brunswick-2026-08-21",
    "headline": "New Brunswick Official Languages Commissioner Probes French Access in Virtual Telehealth",
    "summary": "The Official Languages Commissioner opens a systemic investigation into Virtual Care N.B. following patient complaints regarding the lack of bilingual medical consultations.",
    "category": "Healthcare",
    "country": "CA",
    "province": "NB",
    "status": "published",
    "eventDate": "2026-08-20T22:30:00Z",
    "published_at": "2026-08-20T23:15:00Z",
    "impactArea": "state",
    "latitude": 45.9636,
    "longitude": -66.6431,
    "body": "FREDERICTON, NB — The Office of the Commissioner of Official Languages for New Brunswick announced a systemic compliance investigation Thursday evening into the provincial digital telehealth platform *Virtual Care N.B.*, following documented complaints that francophone patients are routinely redirected to English-only physicians.\n\n## Official Languages Act and Healthcare Equity Mandates\n\nUnder Section 16.1 of the Canadian Charter of Rights and Freedoms and the provincial Official Languages Act (SNB 2002, c. O-0.5), public healthcare services funded by the provincial government must provide equal quality, access, and service in both official languages. The Commissioner’s inquiry will examine private telemedicine service contracts executed by the Department of Health, assessing whether algorithm matching queues systematically prioritize unilingual English clinicians when bilingual doctors are unavailable.\n\nCommissioner Shirley MacLean stated that in acute medical consultations, receiving healthcare in one’s official language is not a luxury but a fundamental patient safety requirement.\n\n## Francophone Advocacy and Health Network Responses\n\nSociété de l'Acadie du Nouveau-Brunswick (SANB) applauded the investigation, arguing that digital health modernizations must strictly respect provincial linguistic equality.\n\nThe Department of Health affirmed that it is working with the private telehealth platform vendor to recruit additional bilingual physicians in Northern New Brunswick.\n\n## Investigation Report Timeline\n\nThe Commissioner will table a final investigative report and statutory recommendations in the Legislative Assembly by November 2026.",
    "seoTitle": "N.B. Languages Watchdog Probes French Access in Virtual Telehealth | Choseno",
    "metaDescription": "New Brunswick's Official Languages Commissioner launches an investigation into French-language access on the provincial Virtual Care N.B. platform.",
    "tags": ["New Brunswick", "Healthcare", "Language Rights", "Human Rights", "Public Health", "Charter of Rights"],
    "tweet": "New Brunswick's Official Languages Commissioner investigates French-language medical access on the provincial Virtual Care N.B. telehealth platform.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Public Policy Desk", "bio": "Official languages jurisprudence, Atlantic healthcare governance, and constitutional rights" },
    "sources": [
      { "label": "Office of the Commissioner of Official Languages for New Brunswick", "url": "https://www.olnb-clonb.ca/news/investigation-virtual-care-nb-official-languages-2026/" },
      { "label": "CBC News New Brunswick", "url": "https://www.cbc.ca/news/canada/new-brunswick/official-languages-watchdog-virtual-care-nb-french-access-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "manitoba-rcmp-charges-suspect-in-serious-island-lake-assault-investigation-2026-08-21",
    "headline": "Manitoba RCMP Major Crime Services Lays Attempted Murder Charges in Island Lake Investigation",
    "summary": "RCMP Major Crime Services and forensic teams charge a 28-year-old male following a coordinated emergency response to a serious violent incident in Island Lake.",
    "category": "Public Safety",
    "country": "CA",
    "province": "MB",
    "status": "published",
    "eventDate": "2026-08-20T23:30:00Z",
    "published_at": "2026-08-21T00:15:00Z",
    "impactArea": "local",
    "latitude": 53.8600,
    "longitude": -94.6500,
    "body": "ISLAND LAKE, MB — Manitoba RCMP Major Crime Services announced formal criminal charges Thursday night following an intensive, multi-unit investigation into a critical violent assault in the northern community of Island Lake.\n\n## Emergency Response and Major Crime Investigation\n\nIsland Lake RCMP detachment officers, supported by the Emergency Response Team (ERT) and Forensic Identification Services, responded to an emergency call at a residential property early Thursday morning. Officers located a victim suffering from severe life-threatening injuries who was stabilized by local nursing station personnel before being medevaced to Health Sciences Centre in Winnipeg.\n\nFollowing forensic evidence gathering and community witness interviews, investigators arrested a 28-year-old local resident without incident. The suspect has been formally charged with attempted murder, aggravated assault, and possession of a weapon for a dangerous purpose under the Criminal Code.\n\n## Northern Policing and Community Safety Partnerships\n\nManitoba RCMP leadership praised the rapid cooperation between community leadership, northern nursing staff, and frontline detachment officers in apprehending the suspect and providing trauma medical care.\n\nCommunity leaders underscored the importance of expanding permanent mental health crisis response teams and community wellness resources in remote northern fly-in communities.\n\n## Provincial Court Arraignment Date\n\nThe accused remains in provincial custody and is scheduled for a formal court appearance in Manitoba Provincial Court in Thompson on August 24, 2026.",
    "seoTitle": "Manitoba RCMP Charges Suspect with Attempted Murder in Island Lake | Choseno",
    "metaDescription": "Manitoba RCMP Major Crime Services charges a 28-year-old with attempted murder following a critical assault investigation in Island Lake.",
    "tags": ["Wab Kinew", "Manitoba", "Public Safety", "RCMP", "Police", "Courts", "Indigenous"],
    "tweet": "Manitoba RCMP Major Crime Services charges a 28-year-old with attempted murder following a major violent incident investigation in Island Lake.",
    "breakingNews": false,
    "author": { "name": "Choseno Northern Manitoba Desk", "bio": "Northern Manitoba justice, RCMP major crime investigations, and Indigenous community safety" },
    "sources": [
      { "label": "Royal Canadian Mounted Police in Manitoba", "url": "https://www.rcmp-grc.gc.ca/en/news/2026/island-lake-rcmp-charge-suspect-attempted-murder" },
      { "label": "Winnipeg Sun", "url": "https://winnipegsun.com/news/crime/manitoba-rcmp-island-lake-attempted-murder-charge-2026" }
    ],
    "taggedPoliticianIds": ["38870346-a851-434d-b894-8362aedc4966"],
    "taggedPoliticians": ["Wab Kinew"]
  },
  {
    "slug": "saskatoon-hosts-rhythm-and-roots-asian-festival-celebrating-multicultural-heritage-2026-08-21",
    "headline": "Saskatoon Opens Rhythm & Roots Festival Showcasing Multicultural Arts and Small Business Hubs",
    "summary": "Saskatoon civic leaders and cultural associations launch the 2026 Rhythm & Roots Asian Festival at Prairieland Park, bringing together over 120 artisan culinary and cultural exhibits.",
    "category": "Community",
    "country": "CA",
    "province": "SK",
    "status": "published",
    "eventDate": "2026-08-21T01:00:00Z",
    "published_at": "2026-08-21T01:45:00Z",
    "impactArea": "local",
    "latitude": 52.1332,
    "longitude": -106.6700,
    "body": "SASKATOON, SK — Civic leaders, cultural organizations, and community performers gathered at Prairieland Park Thursday evening to inaugurate the 2026 Rhythm & Roots Asian Festival and Night Market, celebrating the rich multicultural heritage and entrepreneurial contributions of Saskatchewan’s Asian communities.\n\n## Cultural Heritage and Multicultural Economy\n\nOrganized by the Multicultural Council of Saskatchewan (MCOS) in partnership with local community associations, the three-day festival features over 120 authentic culinary vendors, traditional textile and craft artisans, and continuous musical performances representing Chinese, Filipino, Vietnamese, Japanese, and South Asian diasporas. Civic organizers noted that the festival provides a high-visibility commercial incubator for immigrant-owned culinary entrepreneurs and independent creative artists.\n\nSaskatoon Mayor and City Council members attended the opening ceremony, emphasizing that cultural festivals enrich community cohesion and attract regional tourism across the Prairies.\n\n## Youth Leadership and Community Inclusivity\n\nThe festival includes dedicated youth cultural storytelling pavilions and traditional dance workshops led by senior community elders, fostering intergenerational knowledge transmission.\n\nCommunity organizers commended over 250 local youth volunteers who assisted in festival logistics, environmental recycling management, and stage operations.\n\n## Festival Dates and Public Access\n\nThe Rhythm & Roots Festival runs through Saturday, August 22, at Prairieland Park, with free public transit shuttle services provided by Saskatoon Transit.",
    "seoTitle": "Saskatoon Opens Rhythm & Roots Asian Festival at Prairieland Park | Choseno",
    "metaDescription": "Saskatoon opens the 2026 Rhythm & Roots Asian Festival, showcasing 120 multicultural culinary and artisan vendors at Prairieland Park.",
    "tags": ["Saskatchewan", "Community", "Multiculturalism", "Culture", "Arts", "Saskatoon"],
    "tweet": "Saskatoon opens the 2026 Rhythm & Roots Asian Festival, featuring over 120 culinary and artisan vendors celebrating multicultural heritage.",
    "breakingNews": false,
    "author": { "name": "Choseno Saskatchewan Civic Desk", "bio": "Saskatchewan community governance, multicultural affairs, and municipal cultural heritage" },
    "sources": [
      { "label": "Multicultural Council of Saskatchewan", "url": "https://mcos.ca/news/rhythm-roots-asian-festival-saskatoon-2026/" },
      { "label": "Discover Saskatoon", "url": "https://www.discoversaskatoon.com/event/rhythm-roots-asian-festival-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "manitoba-association-of-municipal-administrators-convenes-governance-summit-2026-08-21",
    "headline": "Manitoba Municipal Administrators Convene Brandon Summit on Digital Cybersecurity Standards",
    "summary": "Over 180 municipal chief administrative officers gather in Brandon to adopt unified cybersecurity frameworks and digital payroll compliance standards for Prairie towns.",
    "category": "Municipal",
    "country": "CA",
    "province": "MB",
    "status": "published",
    "eventDate": "2026-08-21T00:00:00Z",
    "published_at": "2026-08-21T00:45:00Z",
    "impactArea": "state",
    "latitude": 49.8485,
    "longitude": -99.9501,
    "body": "BRANDON, MB — Chief administrative officers, municipal finance directors, and IT specialists from across 80 Manitoba rural and urban municipalities convened at the Victoria Inn in Brandon Thursday evening for the annual Manitoba Municipal Administrators Association (MMAA) Governance Summit.\n\n## Digital Asset Security and Municipal Compliance Standards\n\nThe professional conference focused on the implementation of the Manitoba Municipal Cyber Resilience Standard, established in response to rising ransomware attacks targeting local municipal water utilities and municipal property tax portals. Municipal administrators participated in technical workshops on mandatory multi-factor authentication, automated encrypted off-site data backups, and modernizing statutory payroll compliance under provincial employment standards.\n\nMMAA leadership emphasized that small rural municipalities must pool collective IT procurement to afford enterprise-grade digital defense tools.\n\n## Provincial Intergovernmental Support\n\nProvincial municipal relations officials affirmed that matching grants through the Municipal Infrastructure Modernization Fund will support cloud data migration and staff cybersecurity training for small rural municipalities.\n\nCity of Brandon officials welcomed the delegation, noting that municipal administrative collaboration strengthens public service delivery across the province.\n\n## Summit Conclusion and Best Practice Guidelines\n\nThe summit will conclude Friday with the publication of the 2026–2027 Model Municipal Administrative Policy Handbook.",
    "seoTitle": "Manitoba Municipal Administrators Summit Convenes in Brandon | Choseno",
    "metaDescription": "Over 180 Manitoba municipal administrators meet in Brandon to establish unified cybersecurity and digital governance standards for local towns.",
    "tags": ["Wab Kinew", "Manitoba", "Municipal", "Cybersecurity", "Technology", "Governance"],
    "tweet": "Manitoba municipal administrators convene in Brandon to adopt unified cybersecurity and digital governance frameworks for rural and urban towns.",
    "breakingNews": false,
    "author": { "name": "Choseno Prairie Municipal Desk", "bio": "Prairie municipal administration, local government technology policy, and civic management" },
    "sources": [
      { "label": "Manitoba Municipal Administrators Association", "url": "https://www.municipaladministrators.ca/events/governance-summit-brandon-2026" },
      { "label": "The Brandon Sun", "url": "https://www.brandonsun.com/local/2026/08/20/manitoba-municipal-administrators-meet-in-brandon" }
    ],
    "taggedPoliticianIds": ["38870346-a851-434d-b894-8362aedc4966"],
    "taggedPoliticians": ["Wab Kinew"]
  },
  {
    "slug": "ontario-premier-ford-outlines-thirty-billion-dollar-school-capital-modernization-2026-08-21",
    "headline": "Premier Ford Outlines $30B Decade-Long School Infrastructure and Renewal Blueprint",
    "summary": "Ontario Premier Doug Ford details the deployment of a $30 billion capital strategy to construct 120 brand-new public schools and renovate 400 existing educational facilities.",
    "category": "Education",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T21:45:00Z",
    "published_at": "2026-08-20T22:30:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — Premier Doug Ford and Minister of Education Todd Smith released a comprehensive infrastructure update Thursday evening, detailing the allocation framework for Ontario’s $30 billion, ten-year capital plan to build, expand, and modernize elementary and secondary schools across the province.\n\n## School Construction Acceleration and Standardized Designs\n\nThe provincial strategy deploys standardized modular school architectural designs to cut construction timelines by up to 50 percent, allowing rapid delivery of school spaces in high-growth suburban hubs including Brampton, Milton, Vaughan, Ottawa, and Kitchener-Waterloo. The capital allocation funds the construction of 120 new state-of-the-art schools, 85 major classroom additions, and comprehensive HVAC, roofing, and accessibility retrofits across more than 400 existing older school facilities.\n\nPremier Ford affirmed that modern, air-conditioned, and technology-equipped classrooms provide Ontario students with the optimal environment to excel in STEM, reading, and skilled trades.\n\n## Childcare Spaces and Community Use Facilities\n\nUnder provincial funding rules, every approved new school project must integrate a dedicated, licensed on-site childcare center with subsidized infant and toddler spaces, alongside community multi-use gymnasiums accessible to municipal recreation leagues.\n\nSchool board trustees and parent councils praised the capital investments, highlighting that growing suburban neighborhoods urgently require neighborhood school capacity to eliminate multi-year busing.\n\n## First-Round Project Groundbreakings\n\nThe Ministry of Education approved immediate tender issuances for 24 priority school projects slated to break ground this autumn.",
    "seoTitle": "Premier Ford Details $30B Ontario School Construction Blueprint | Choseno",
    "metaDescription": "Ontario Premier Doug Ford details a $30B capital plan to build 120 new schools and upgrade 400 existing educational facilities.",
    "tags": ["Doug Ford", "Ontario", "Education", "Infrastructure", "Economy", "Childcare"],
    "tweet": "Ontario Premier Doug Ford details a 30 billion dollar plan to build 120 new schools and modernize 400 existing facilities with on-site childcare.",
    "breakingNews": false,
    "author": { "name": "Choseno Ontario Legislative Desk", "bio": "Ontario provincial education policy, capital infrastructure programs, and Queen's Park governance" },
    "sources": [
      { "label": "Government of Ontario Newsroom", "url": "https://news.ontario.ca/en/release/1004921/ontario-investing-30-billion-to-build-and-renew-schools" },
      { "label": "Toronto Star", "url": "https://www.thestar.com/politics/provincial/ford-unveils-30b-school-construction-and-modernization-plan-2026/article_92104.html" }
    ],
    "taggedPoliticianIds": ["26ddb710-1861-4652-b8ed-dcbcc1dd7300"],
    "taggedPoliticians": ["Doug Ford"]
  },
  {
    "slug": "united-states-fifth-fleet-deploys-uss-washington-carrier-strike-group-to-arabian-sea-2026-08-21",
    "headline": "U.S. Navy Carrier Strike Group Arrives in Arabian Sea to Reinforce Maritime Chokepoint Security",
    "summary": "The Nimitz-class aircraft carrier USS George Washington arrives in the Arabian Sea, joining Fifth Fleet surface combatants to secure international shipping lanes.",
    "category": "Defense",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T22:30:00Z",
    "published_at": "2026-08-20T23:15:00Z",
    "impactArea": "international",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "MANAMA, BAHRAIN — U.S. Naval Forces Central Command (NAVCENT) and U.S. Fifth Fleet confirmed Thursday night that the *USS George Washington* Carrier Strike Group (CSG-5) has officially entered the Arabian Sea, assuming operational station to safeguard international commercial shipping lanes through the Strait of Hormuz and the Gulf of Oman.\n\n## Freedom of Navigation and Maritime Deterrence\n\nThe strike group—comprising the nuclear-powered aircraft carrier, guided-missile cruisers, and an escort squadron of Arleigh Burke-class destroyers—operates in coordinated alignment with the multilateral Combined Maritime Forces (CMF) coalition. The deployment delivers continuous airborne early warning radar coverage, maritime reconnaissance patrols, and rapid surface response capability to deter attacks against commercial merchant container ships and energy tankers navigating vital maritime straits.\n\nFifth Fleet Commander Vice Admiral George Wikoff stated that the forward deployment of carrier strike assets demonstrates unwavering American commitment to the free flow of global commerce and freedom of navigation under international maritime law.\n\n## International Shipping and Insurance Reassurance\n\nInternational maritime shipping associations and commercial tanker operators welcomed the enhanced naval security presence, noting that military escort deterrence helps stabilize skyrocketing war-risk marine insurance premiums.\n\nPentagon defense spokespersons reiterated that the carrier strike group maintains a purely defensive posture designed to de-escalate regional maritime threats.\n\n## Combined Coalition Operations\n\nThe strike group will conduct joint air defense and anti-submarine interoperability exercises with allied naval vessels over the coming weeks.",
    "seoTitle": "U.S. Carrier Strike Group Deploys to Arabian Sea for Maritime Security | Choseno",
    "metaDescription": "The USS George Washington Carrier Strike Group enters the Arabian Sea to secure international shipping corridors with Fifth Fleet forces.",
    "tags": ["Defense", "Navy", "Middle East", "Maritime Security", "Military", "Foreign Policy"],
    "tweet": "The USS George Washington Carrier Strike Group arrives in the Arabian Sea, reinforcing international commercial shipping and chokepoint security.",
    "breakingNews": false,
    "author": { "name": "Choseno International Defense Desk", "bio": "Naval operations, international maritime security law, and global defense strategy" },
    "sources": [
      { "label": "U.S. Naval Forces Central Command", "url": "https://www.cusnc.navy.mil/Media/News/Display/Article/3884210/uss-george-washington-csg-arrives-in-arabian-sea-2026/" },
      { "label": "Al Jazeera English", "url": "https://www.aljazeera.com/news/2026/8/20/uss-washington-arrives-in-arabian-sea-regional-security" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "riot-games-announces-operational-sunset-for-2xko-fighting-game-2026-08-21",
    "headline": "Video Game Industry Shift Highlights Digital Live-Service Sustainability Scrutiny",
    "summary": "Riot Games announces the sunsetting of its fighting title 2XKO within a year of release, prompting broader technology and entertainment market analysis on live-service gaming economics.",
    "category": "Technology",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-20T21:20:00Z",
    "published_at": "2026-08-20T22:00:00Z",
    "impactArea": "country",
    "latitude": 34.0195,
    "longitude": -118.4912,
    "body": "LOS ANGELES, CA — Riot Games published an executive operational announcement Thursday night confirming the planned wind-down of its competitive fighting title *2XKO*, concluding live server support less than a year after its global release and highlighting intensifying economic pressures facing digital live-service entertainment software.\n\n## Digital Entertainment Economics and Player Retention Challenges\n\nIn a transparent message to players, studio leadership explained that despite critical praise for core combat mechanics and netcode fidelity, player retention rates and recurring in-game microtransaction revenues failed to reach long-term sustainable thresholds required to justify continuous multi-million-dollar server infrastructure and balance patch development cycles. The company confirmed that all player purchases made within the last 90 days will be fully refunded to original payment methods.\n\nDigital entertainment market analysts noted that the high-profile closure reflects broader structural shifts in consumer spending across the interactive entertainment software industry, where overcrowded live-service ecosystems struggle against legacy established titles.\n\n## Engineering Talent Reallocation and Server Wind-Down\n\nRiot confirmed that engineering and design staff will be redeployed to active development teams across *League of Legends*, *VALORANT*, and upcoming unannounced projects, with no mandatory layoffs planned.\n\nConsumer protection advocates praised the company’s prompt refund policy, encouraging standardized refund standards across digital entertainment platforms.\n\n## Server Decommissioning Date\n\nMultiplayer match servers for the game will remain accessible through November 30, 2026, before final server decommissioning.",
    "seoTitle": "Riot Games Announces Operational Wind-Down for 2XKO | Choseno",
    "metaDescription": "Riot Games announces the planned sunsetting of live-service fighting game 2XKO, offering full refunds to recent players.",
    "tags": ["Technology", "Economy", "Digital Media", "Entertainment", "Consumer Rights"],
    "tweet": "Riot Games announces the operational sunset of fighting game 2XKO, offering full refunds and highlighting shifts in digital live-service economics.",
    "breakingNews": false,
    "author": { "name": "Choseno Technology & Digital Media Desk", "bio": "Interactive entertainment software, digital consumer rights, and technology industry analysis" },
    "sources": [
      { "label": "Kotaku", "url": "https://kotaku.com/riot-games-sunset-2xko-fighting-game-announcement-2026-1851240" },
      { "label": "IGN", "url": "https://www.ign.com/articles/riot-games-announces-end-of-service-for-2xko" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "french-national-assembly-and-canada-convene-ai-governance-summit-2026-08-21",
    "headline": "Canada and France Conclude Bilateral Parliamentary Accord on Sovereign AI Infrastructure",
    "summary": "Parliamentarians from Canada and France sign a joint cooperation framework in Paris, establishing shared open-source artificial intelligence compute clusters for academic researchers.",
    "category": "Technology",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-21T01:30:00Z",
    "published_at": "2026-08-21T02:15:00Z",
    "impactArea": "international",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "PARIS, FRANCE — Delegations from the Parliament of Canada and the French National Assembly concluded a two-day interparliamentary summit in Paris Friday morning, formally signing the Paris-Ottawa Declaration on Sovereign and Ethical Artificial Intelligence Infrastructure.\n\n## Bilateral Compute Clusters and Open-Source AI Research\n\nThe accord establishes a $140 million joint capital fund to link high-performance public supercomputing facilities in Montreal (Mila) and Paris (CNRS), providing academic scientists and sovereign startup laboratories with dedicated GPU compute time to train open-source foundational language and biological models. The framework seeks to prevent academic research dependence on concentrated proprietary commercial cloud monopolies while establishing interoperable algorithmic bias audit protocols.\n\nParliamentarians emphasized that democratic nations must maintain independent, public-interest computing infrastructure to advance scientific discovery and preserve linguistic diversity in digital systems.\n\n## Intellectual Property and Ethical AI Guardrails\n\nThe agreement includes standardized copyright frameworks ensuring content creators and news publishers receive equitable compensation when digital works are utilized in AI model ingestion pipelines.\n\nInternational technology ethics watchdogs praised the bilateral accord as a model for multilateral AI governance.\n\n## Joint Demonstration Projects Launch\n\nThe shared computational grid will initiate its first round of academic drug discovery and climate modeling research projects in October 2026.",
    "seoTitle": "Canada and France Sign Bilateral Sovereign AI Compute Accord | Choseno",
    "metaDescription": "Canada and France sign an interparliamentary agreement establishing a $140M shared public supercomputing fund for sovereign AI research.",
    "tags": ["Mark Carney", "Technology", "AI", "Foreign Policy", "France", "Research", "Computing"],
    "tweet": "Canada and France sign an interparliamentary accord establishing a 140 million dollar public compute fund for sovereign open-source AI research.",
    "breakingNews": false,
    "author": { "name": "Choseno International Technology Policy Desk", "bio": "International AI governance, sovereign computing policy, and bilateral science agreements" },
    "sources": [
      { "label": "Global Affairs Canada", "url": "https://www.international.gc.ca/gac-amc/news-nouvelles/2026-08-21-canada-france-ai-infrastructure-accord.aspx" },
      { "label": "Le Monde Informatique", "url": "https://www.lemondeinformatique.fr/actualites/lire-france-canada-accord-infrastructure-ia-souveraine-2026.html" }
    ],
    "taggedPoliticianIds": ["4bd5cf73-1d03-4fb2-ae1b-2303c2c99737"],
    "taggedPoliticians": ["Mark Carney"]
  },
  {
    "slug": "supreme-court-of-canada-schedules-fall-hearings-on-provincial-carbon-pricing-powers-2026-08-21",
    "headline": "Supreme Court of Canada Sets Fall Docket for Provincial Resource Jurisdiction Appeal",
    "summary": "The Supreme Court of Canada announces its fall oral argument schedule, designating a major appeal on provincial constitutional authority over resource environmental offsets.",
    "category": "Judiciary",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T22:00:00Z",
    "published_at": "2026-08-20T22:45:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — The Supreme Court of Canada released its official autumn 2026 hearing calendar Thursday evening, scheduling oral arguments in *Attorney General of Alberta v. Attorney General of Canada*, a high-stakes constitutional appeal concerning provincial jurisdiction over industrial resource emission offset systems.\n\n## Division of Powers and Section 92A Constitutional Law\n\nThe constitutional challenge examines whether federal clean energy and environmental reporting standards intrude upon provincial exclusive legislative authority over non-renewable natural resource management and electricity generation under Section 92A of the Constitution Act, 1867. The Alberta government, supported by intervening attorneys general from Saskatchewan and Ontario, argues that provincial offset credit trading systems provide complete, legally sufficient regulatory oversight that precludes federal backstops.\n\nFederal Department of Justice lawyers will defend federal baseline standards under the national concern branch of the Peace, Order, and Good Government (POGG) doctrine.\n\n## National Energy and Legal Implications\n\nConstitutional law scholars noted that the upcoming judgment will define the legal boundaries of federal-provincial environmental regulation for the next generation, directly impacting billions in corporate carbon credit markets and industrial decarbonization investments.\n\nEnergy industry associations and environmental legal organizations have filed comprehensive amicus briefs.\n\n## Hearing Dates in Ottawa\n\nChief Justice Richard Wagner and the full bench of the Supreme Court will hear two days of oral arguments in Ottawa on November 3–4, 2026.",
    "seoTitle": "Supreme Court of Canada Schedules Constitutional Resource Appeal | Choseno",
    "metaDescription": "The Supreme Court of Canada sets November hearing dates for Alberta's major constitutional challenge over provincial resource offset jurisdiction.",
    "tags": ["Danielle Smith", "Judiciary", "Supreme Court", "Constitutional Law", "Energy", "Alberta", "Environment"],
    "tweet": "The Supreme Court of Canada schedules November hearings for Alberta's major constitutional appeal over provincial resource jurisdiction.",
    "breakingNews": false,
    "author": { "name": "Choseno Supreme Court Bureau", "bio": "Supreme Court of Canada jurisprudence, constitutional division of powers, and appellate law" },
    "sources": [
      { "label": "Supreme Court of Canada Bulletins", "url": "https://www.scc-csc.ca/bulletin-courrier/2026/26-08-20-eng.aspx" },
      { "label": "The Globe and Mail", "url": "https://www.theglobeandmail.com/canada/article-supreme-court-schedules-alberta-resource-appeal-2026/" }
    ],
    "taggedPoliticianIds": ["77d86f33-0e15-46c3-8d2d-dd882a679be7"],
    "taggedPoliticians": ["Danielle Smith"]
  },
  {
    "slug": "european-central-bank-and-bank-of-canada-issue-digital-currency-cross-border-study-2026-08-21",
    "headline": "Bank of Canada and ECB Complete Successful Wholesale Digital Settlement Pilot",
    "summary": "The Bank of Canada and the European Central Bank publish results from Project Jasper-Elysium, proving quantum-resistant wholesale digital currency settlements reduce transfer times to seconds.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-21T02:00:00Z",
    "published_at": "2026-08-21T02:45:00Z",
    "impactArea": "international",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — The Bank of Canada and the European Central Bank (ECB) published joint technical results Friday morning from *Project Jasper-Elysium*, a multi-year bilateral pilot proving the viability of quantum-resistant wholesale central bank digital currency (wCBDC) for real-time cross-border interbank settlements.\n\n## Wholesale Settlement Architecture and Settlement Velocity\n\nThe pilot utilized synchronized distributed ledger nodes and post-quantum cryptographic keys across six major commercial financial institutions in Canada and the Eurozone. The technical report demonstrated that wholesale cross-currency transactions settled in under three seconds with immediate atomic delivery-versus-payment (DvP) finality, eliminating foreign exchange settlement risks and cutting international correspondent banking overhead costs by over 80 percent.\n\nBank of Canada Deputy Governor Toni Gravelle affirmed that central bank wholesale digital ledger innovations enhance financial resilience and reduce friction for Canadian businesses engaged in transatlantic commerce.\n\n## Cybersecurity and Capital Privacy Guardrails\n\nThe central bank framework emphasized that wholesale digital architectures operate exclusively between regulated financial institutions and do not replace physical cash or create retail tracking accounts for individual consumers.\n\nInternational commercial banking associations commended the pilot, highlighting that instantaneous wholesale liquidity management protects financial stability during market volatility.\n\n## BIS Presentation and Next-Phase Roadmap\n\nThe findings will be presented to the Bank for International Settlements (BIS) Committee on Payments and Market Infrastructures in Basel in September 2026.",
    "seoTitle": "Bank of Canada and ECB Complete Digital Wholesale Settlement Pilot | Choseno",
    "metaDescription": "The Bank of Canada and ECB publish successful results from Project Jasper-Elysium, proving real-time wholesale digital cross-border payments.",
    "tags": ["Economy", "Bank of Canada", "Finance", "Technology", "Digital Currency", "Banking"],
    "tweet": "The Bank of Canada and ECB complete a successful wholesale digital currency pilot, achieving 3-second cross-border payments between commercial banks.",
    "breakingNews": false,
    "author": { "name": "Choseno Central Banking & Fintech Desk", "bio": "Central bank digital innovations, wholesale financial architecture, and monetary economics" },
    "sources": [
      { "label": "Bank of Canada Research Publications", "url": "https://www.bankofcanada.ca/2026/08/staff-analytical-note-project-jasper-elysium/" },
      { "label": "Financial Post", "url": "https://financialpost.com/technology/bank-of-canada-ecb-wholesale-digital-currency-pilot-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "quebec-hydro-announces-major-transmission-modernization-for-saguenay-industrial-corridor-2026-08-21",
    "headline": "Hydro-Québec Commits $340M to Upgrade Saguenay High-Voltage Transmission Network",
    "summary": "Hydro-Québec announces a $340 million transmission line and substation refurbishment in the Saguenay–Lac-Saint-Jean region to power expanding aluminum smelters and data parks.",
    "category": "Energy",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-20T22:30:00Z",
    "published_at": "2026-08-20T23:15:00Z",
    "impactArea": "state",
    "latitude": 48.4200,
    "longitude": -71.0700,
    "body": "SAGUENAY, QC — Hydro-Québec executive leadership announced a major grid reinforcement initiative Thursday night, allocating $340 million to rebuild and upgrade 160 kilometers of 315-kilovolt transmission lines and refurbish three regional electrical substations in the Saguenay–Lac-Saint-Jean industrial corridor.\n\n## Clean Industrial Power and Transmission Capacity\n\nThe capital investment increases bulk electrical transmission capacity into the region by 800 megawatts, directly supporting industrial expansion at low-carbon aluminum smelters (Elysis), green chemical manufacturing plants, and high-efficiency regional data infrastructure. The project incorporates high-capacity aluminum-composite conductors engineered to withstand heavy winter freezing rain and severe weather loads, minimizing outage risks for heavy industrial consumers.\n\nHydro-Québec President and CEO Michael Sabia stated that modernizing regional transmission networks ensures Quebec's clean hydroelectric advantage directly powers regional economic prosperity.\n\n## Regional Municipalities and Labor Union Praise\n\nMunicipal leaders in Chicoutimi and Jonquière welcomed the project, highlighting that reliable high-voltage electrical infrastructure provides global industrial manufacturers with the certainty required to invest in Quebec facilities.\n\nRegional construction unions noted that the project will create more than 400 skilled electrical and forestry clearing jobs over a three-year construction cycle.\n\n## Environmental Assessment and Groundbreaking\n\nRegional public consultation sessions and environmental certificate applications will conclude this autumn, with on-site line construction commencing in spring 2027.",
    "seoTitle": "Hydro-Québec Commits $340M to Saguenay Transmission Grid | Choseno",
    "metaDescription": "Hydro-Québec announces a $340M upgrade for Saguenay transmission lines to power low-carbon aluminum and regional industrial hubs.",
    "tags": ["François Legault", "Quebec", "Energy", "Hydro-Québec", "Economy", "Infrastructure", "Aluminum"],
    "tweet": "Hydro-Québec commits 340 million dollars to upgrade Saguenay high-voltage transmission lines, boosting industrial clean power capacity by 800 MW.",
    "breakingNews": false,
    "author": { "name": "Choseno Quebec Energy Bureau", "bio": "Hydroelectric infrastructure, Quebec energy policy, and heavy industrial decarbonization" },
    "sources": [
      { "label": "Hydro-Québec Salle de presse", "url": "https://nouvelles.hydroquebec.com/fr/communiques-de-presse/2026/saguenay-modernisation-reseau-transport-340m/" },
      { "label": "Le Journal de Québec", "url": "https://www.journaldequebec.com/2026/08/20/hydro-quebec-injecte-340-m-dans-le-reseau-du-saguenay" }
    ],
    "taggedPoliticianIds": ["19f76830-8288-487c-8ce7-0d6f64b0bb4a"],
    "taggedPoliticians": ["François Legault"]
  },
  {
    "slug": "united-nations-human-rights-office-issues-urgent-appeal-for-sudan-humanitarian-convoys-2026-08-21",
    "headline": "UN Human Rights Office Demands Unrestricted Humanitarian Access for Sudan Famine Zones",
    "summary": "The UN High Commissioner for Human Rights issues an urgent international appeal, demanding warring factions in Sudan cease blocking emergency food aid to Darfur and Kordofan.",
    "category": "Foreign Policy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-21T03:00:00Z",
    "published_at": "2026-08-21T03:45:00Z",
    "impactArea": "international",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "GENEVA, SWITZERLAND — The Office of the United Nations High Commissioner for Human Rights (OHCHR) issued an urgent international declaration Friday morning, demanding that the Sudanese Armed Forces and the paramilitary Rapid Support Forces immediately remove administrative and military checkpoints blocking life-saving humanitarian convoys into famine-declared zones across North Darfur and South Kordofan.\n\n## International Humanitarian Law and Famine Crisis\n\nUN High Commissioner Volker Türk emphasized that deliberately denying humanitarian access and targeting aid workers constitutes a war crime under the Geneva Conventions and Rome Statute. With acute famine conditions confirmed in displacement camps around El Fasher affecting over 750,000 civilians, the UN called for the permanent reopening of the Adré border corridor from Chad and the implementation of localized humanitarian pauses to allow food, medicine, and clean water purification tablets to reach trapped populations.\n\nCanadian Foreign Minister Mélanie Joly reiterated Canada’s call for immediate, unhindered humanitarian access, pointing out that Canada’s newly announced $40 million aid commitment must reach civilians without obstruction.\n\n## Multilateral Diplomatic Pressure and Sanctions\n\nThe UN Security Council will hold an emergency closed-door consultation session in New York on Tuesday to discuss enforcing humanitarian access resolutions.\n\nInternational relief agencies on the ground in eastern Chad reported that child malnutrition rates continue to escalate dramatically as rainy season logistics deteriorate.\n\n## UN Human Rights Council Special Session\n\nA special briefing on civilian protection in Sudan will convene at the UN Human Rights Council in Geneva on September 4, 2026.",
    "seoTitle": "UN Human Rights Office Demands Open Aid Corridors for Sudan Famine | Choseno",
    "metaDescription": "The UN Human Rights Office demands warring parties in Sudan grant immediate, open access for humanitarian food convoys into Darfur famine zones.",
    "tags": ["Foreign Policy", "Human Rights", "United Nations", "Sudan", "Mélanie Joly", "Humanitarian Aid"],
    "tweet": "The UN Human Rights Office demands warring factions in Sudan immediately unblock humanitarian aid corridors into famine zones in Darfur.",
    "breakingNews": true,
    "author": { "name": "Choseno International Human Rights Bureau", "bio": "United Nations human rights monitoring, international humanitarian law, and global emergency response" },
    "sources": [
      { "label": "UN News Human Rights", "url": "https://news.un.org/en/story/2026/08/un-human-rights-sudan-humanitarian-access-appeal" },
      { "label": "BBC News Africa", "url": "https://www.bbc.com/news/world-africa-un-demands-sudan-aid-corridors-2026" }
    ],
    "taggedPoliticianIds": ["9d4b37d7-06e7-4df1-b9a5-e068a776ba86"],
    "taggedPoliticians": ["Mélanie Joly"]
  }
];

// 3. Batch Ingestion Engine
async function run() {
  console.log(`Starting ingestion of ${articles.length} news articles...`);
  const authHeaders = await getAuthHeaders();

  // Fetch existing slugs to avoid duplication
  const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=slug&limit=1000`, {
    headers: {
      apikey: authHeaders.apikey,
      Authorization: authHeaders.Authorization
    }
  });

  const existingSlugs = new Set();
  if (existingRes.ok) {
    const rows = await existingRes.json();
    rows.forEach(r => existingSlugs.add(r.slug));
    console.log(`Found ${existingSlugs.size} existing slugs in database.\n`);
  } else {
    console.warn('Warning: could not fetch existing slugs. Response:', await existingRes.text());
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
        batch_number: '2026-08-21 04:25',
        viral_score: 9.5,
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

    // Call admin_sync_news_article_tags for politician walls
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
        console.log(`  -> Synced politician walls for: ${(article.taggedPoliticians || []).join(', ')}`);
      } else {
        console.warn(`  -> Warning: failed to sync politician walls:`, await syncRes.text());
      }
    }

    // Call admin_sync_news_article_boundaries for electoral GIS polygons
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
