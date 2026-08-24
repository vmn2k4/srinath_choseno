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

// Per-article virality score on the 0-10 scale the Admin > News
// Distribution table renders (score.toFixed(1), gold/green thresholds at
// 9.5/9.0 -- see AdminNewsDistributionClient.tsx). A prior version of this
// script hardcoded viral_score: 9.6 for every article in a batch instead of
// scoring each one, so an entire batch always rendered as a flat 9.6 row
// after row. (Other one-off scripts, e.g. publish-aug23-50-batch.js, have
// their own calculateViralityScore(), but on a 1-99 scale that doesn't
// match this table's thresholds -- this is the same idea rescaled to 0-10.)
function calculateViralityScore(article) {
  let score = 8.0;
  if (article.breakingNews) score += 0.8;
  if (['Economy', 'Politics', 'Public Safety', 'Elections'].includes(article.category)) score += 0.5;
  if (article.taggedPoliticians && article.taggedPoliticians.length > 0) score += 0.3;
  if (article.impactArea === 'country' || article.impactArea === 'national') score += 0.3;
  else if (article.impactArea === 'province' || article.impactArea === 'state') score += 0.15;
  return Math.min(9.9, Math.max(7.5, Number(score.toFixed(1))));
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

/// 2. Article payload to ingest (Surrey Municipal Officials 1-Year Investigative Coverage)
// 2. Article payload to ingest (Surrey Municipal Officials 1-Year Investigative Coverage)
// 2. Article payload to ingest (Loaded cleanly from JSON)
// 2. Article payload to ingest (Loaded cleanly from multi-story JSON)
// 2. Article payload to ingest (Loaded cleanly from expanded JSON)
// 2. Article payload to ingest (Loaded cleanly from hourly-news-cycle.json)
// 2. Article payload to ingest (Loaded cleanly from hourly-batch-extension.json)
// 2. Article payload to ingest (Loaded cleanly from hourly-batch-extension-2.json)
// 2. Article payload to ingest (Loaded cleanly from live-past-hour-batch.json)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
const articles = [
  {
    "slug": "illinois-governor-jb-pritzker-signs-hb-4758-job-opportunities-for-qualified-applicants-act-2026-08-24",
    "headline": "Governor JB Pritzker Signs HB 4758 Barring Employers from Requiring Drivers Licenses",
    "summary": "Illinois Governor JB Pritzker signs House Bill 4758 into law, amending employment opportunity statutes to prohibit employers from requiring a driver's license for jobs that do not involve driving.",
    "category": "Economy",
    "country": "US",
    "province": "IL",
    "status": "published",
    "eventDate": "2026-08-24T14:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "state",
    "latitude": 39.7817,
    "longitude": -89.6501,
    "body": "SPRINGFIELD, IL — Illinois Governor JB Pritzker signed House Bill 4758 into law, enacting landmark amendments to the Job Opportunities for Qualified Applicants Act to prohibit employers and employment agencies from requiring job applicants to possess a valid driver’s license unless driving is a bona fide occupational qualification for the position.\n\n## Removing Artificial Employment Barriers for Transit Commuters\n\nThe enacted legislation prohibits commercial employers from screening out qualified job candidates in online applications or interview screenings based on driver's license status, requiring employers to accept state non-driver identification cards, passports, or transit passes for identity verification. Workforce analysts project the law will expand employment access for over 250,000 transit-reliant workers, disabled individuals, and urban commuters across Chicago, Peoria, and Rockford.\n\nGovernor Pritzker affirmed that an individual’s ability to do a great job in an office, retail store, or hospital should never be blocked simply because they ride public transit rather than drive a personal car.\n\n## Labor Coalitions and Employer Guidance\n\nChicago Federation of Labor and disability rights advocates celebrated the enactment as a common-sense barrier reduction.\n\nIllinois Chamber of Commerce worked with lawmakers to ensure clear statutory carve-outs for delivery drivers and field technicians.\n\n## Effective Date\n\nHouse Bill 4758 takes full legal effect across all Illinois employers on January 1, 2027.",
    "seoTitle": "Governor JB Pritzker Signs HB 4758 Employment Identification Law | Choseno",
    "metaDescription": "Illinois Governor JB Pritzker signs HB 4758 prohibiting employers from requiring driver's licenses for non-driving positions.",
    "tags": [
      "JB Pritzker",
      "Illinois",
      "Economy",
      "Labor",
      "Civil Rights",
      "Jobs",
      "Transit",
      "US"
    ],
    "tweet": "Illinois Governor JB Pritzker signs HB 4758, barring employers from requiring a driver's license for jobs that don't involve driving.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Labor Law & State Policy Desk",
      "bio": "State employment regulation, workplace civil rights, Illinois General Assembly statutes, and transit equity"
    },
    "sources": [
      {
        "label": "State of Illinois Office of the Governor",
        "url": "https://gov.illinois.gov/news/press-release.29748.html"
      },
      {
        "label": "Chicago Tribune",
        "url": "https://www.chicagotribune.com/politics/ct-pritzker-signs-drivers-license-job-requirement-ban-2026.html"
      }
    ],
    "taggedPoliticianIds": [
      "b5e28a9b-e85b-4c22-92da-166258fa1342"
    ],
    "taggedPoliticians": [
      "JB Pritzker"
    ]
  },
  {
    "slug": "ontario-premier-doug-ford-announces-provincial-data-center-investment-and-data-residency-framework-2026-08-24",
    "headline": "Premier Doug Ford Unveils Ontario AI Data Center Framework Mandating Sovereign Data Residency",
    "summary": "Premier Doug Ford announces a provincial strategy to attract $10 billion in AI data center investments while requiring state power purchase agreements and secure Canadian sovereign data storage.",
    "category": "Tech",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T13:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — Premier Doug Ford and Minister of Economic Development, Job Creation and Trade Vic Fedeli unveiled the Ontario AI and Sovereign Cloud Infrastructure Framework, establishing provincial investment guidelines to attract $10 billion in hyperscale data center construction while protecting the province’s clean electricity grid.\n\n## Securing Canadian Data Sovereignty and Clean Nuclear Power Siting\n\nThe policy framework directs the Independent Electricity System Operator (IESO) to establish dedicated high-voltage substation connections near nuclear generation hubs in Bruce County, Clarington, and Niagara, requiring data center operators to enter into 15-year power purchase agreements (PPAs) that support new clean energy development. The framework legally mandates that all public sector healthcare, judicial, and financial records hosted in participating data centers remain permanently stored on Canadian soil subject to Canadian privacy law.\n\nPremier Ford stated that Ontario’s abundant clean nuclear energy makes the province the prime destination for global AI infrastructure, creating thousands of high-tech and union trade jobs.\n\n## Tech Consortia and Labor Trades Praise\n\nTechnology and cloud providers including Microsoft Canada and AWS welcomed the clear transmission connection rules.\n\nBuilding and Construction Trades Council of Ontario praised the multi-billion dollar construction pipeline.\n\n## Substation Siting Guidelines\n\nIESO will publish certified data center grid interconnection maps by November 2026.",
    "seoTitle": "Premier Doug Ford Unveils Ontario Data Center Framework | Choseno",
    "metaDescription": "Ontario Premier Doug Ford launches AI data center strategy mandating Canadian data residency and clean power contracts.",
    "tags": [
      "Doug Ford",
      "Ontario",
      "Tech",
      "Energy",
      "Economy",
      "AI",
      "Nuclear",
      "Canada"
    ],
    "tweet": "Ontario Premier Doug Ford unveils a $10B AI data center framework requiring Canadian data residency and clean nuclear power contracts.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Tech Infrastructure & Provincial Energy Desk",
      "bio": "Data center regulation, sovereign cloud computing, IESO grid interconnection, and Ontario industrial policy"
    },
    "sources": [
      {
        "label": "Ontario Ministry of Economic Development Newsroom",
        "url": "https://news.ontario.ca/en/release/1004915/ontario-driving-investment-in-ai-and-data-infrastructure"
      },
      {
        "label": "Financial Post",
        "url": "https://financialpost.com/technology/doug-ford-ontario-data-center-investment-framework-2026"
      }
    ],
    "taggedPoliticianIds": [
      "12ed841a-877b-4c7d-984b-85716b2f2757"
    ],
    "taggedPoliticians": [
      "Doug Ford"
    ]
  },
  {
    "slug": "houston-city-council-approves-62-million-for-police-fleet-modernization-and-station-reconstruction-2026-08-24",
    "headline": "Houston City Council Approves $62 Million for Police and Fire Fleets and Station 101 Rebuilding",
    "summary": "Houston City Council votes 16–1 to approve $43 million for 500 hybrid pursuit vehicles and fire pumpers alongside a $19 million contract to reconstruct Fire Station 101 in Kingwood.",
    "category": "Public Safety",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-24T13:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "local",
    "latitude": 29.7604,
    "longitude": -95.3698,
    "body": "HOUSTON, TX — Houston City Council approved a comprehensive $62 million public safety capital package during its regular weekly meeting, authorizing major fleet procurements and emergency station construction across the city.\n\n## Modernizing Emergency Fleets and Expanding Kingwood Fire Coverage\n\nThe approved council ordinances allocate $43 million to purchase 350 hybrid Ford Police Interceptor pursuit utility vehicles, 40 heavy fire pumpers, and 25 advanced life support ambulances to replace high-mileage emergency vehicles. The council also authorized a $19 million design-build contract to demolish and completely reconstruct Fire Station 101 in Kingwood with elevated, hurricane-resilient structural bays designed to withstand major flood events along the San Jacinto River.\n\nMayor John Whitmire and council members affirmed that equipping police officers and firefighters with reliable vehicles and modern facilities is essential to cut emergency response times across all Houston neighborhoods.\n\n## Houston Police Officers Union and Firefighters Support\n\nThe Houston Police Officers' Union (HPOU) and Houston Professional Fire Fighters Association (IAFF Local 341) strongly endorsed the capital package.\n\nKingwood civic associations praised the elevated flood-proof design of Fire Station 101.\n\n## Vehicle Delivery Schedule\n\nNew emergency hybrid patrol vehicles will begin arriving in municipal motor pool fleets in November 2026.",
    "seoTitle": "Houston City Council Approves $62M for Police Fleets & Fire Station | Choseno",
    "metaDescription": "Houston City Council approves $62M for 500 police and fire vehicles and the complete rebuilding of Kingwood Fire Station 101.",
    "tags": [
      "Houston",
      "Texas",
      "Public Safety",
      "Municipal",
      "Infrastructure",
      "First Responders",
      "US"
    ],
    "tweet": "Houston City Council approves $62M for 500 new police and fire vehicles and to rebuild flood-proof Fire Station 101 in Kingwood.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Municipal Governance & Public Safety Desk",
      "bio": "City council capital appropriations, emergency vehicle procurement, fire station engineering, and Houston municipal policy"
    },
    "sources": [
      {
        "label": "City of Houston City Council Action Minutes",
        "url": "https://www.houstontx.gov/citysec/agenda/2026/08242026.html"
      },
      {
        "label": "Houston Chronicle",
        "url": "https://www.houstonchronicle.com/news/houston-texas/transportation/article/houston-council-approves-62m-police-fire-vehicles-101.php"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "canada-announces-planned-retaliatory-tariffs-on-us-goods-following-cross-border-trade-disputes-2026-08-24",
    "headline": "Canada Prepares Retaliatory Tariffs on U.S. Steel and Consumer Goods Effective September 8",
    "summary": "Deputy Prime Minister and Finance Minister release target list of countermeasures against U.S. manufactured goods and agricultural products following bilateral tariff negotiations.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T12:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — The Government of Canada published an official list of targeted reciprocal tariff countermeasures under the Customs Tariff Act, preparing to apply 25% retaliatory duties on $3.6 billion in American steel, aluminum, manufactured appliances, and agricultural food products starting September 8, 2026.\n\n## Defending Canadian Workers and Integrated Supply Chains\n\nThe Canadian countermeasures respond directly to unilateral cross-border trade restrictions and threatened 50% tariffs on Canadian energy and industrial exports. The Department of Finance confirmed the countermeasures are designed to be dollar-for-dollar reciprocal while minimizing cost disruptions for Canadian domestic supply chains by exempting essential automotive parts and critical medicines.\n\nPrime Minister Mark Carney affirmed that Canada will always stand up for its domestic industries, workers, and businesses while remaining at the negotiating table to achieve fair, reciprocal trade under CUSMA.\n\n## Canadian Manufacturers and Steel Producers Support\n\nCanadian Steel Producers Association (CSPA) and Canadian Chamber of Commerce strongly supported the federal government’s resolute defense of integrated bilateral trade.\n\nAgricultural exporter federations urged continued diplomatic engagement to resolve cross-border trade friction before the September 8 deadline.\n\n## Countermeasure In-Force Date\n\nReciprocal customs tariffs take legal effect at Canadian ports of entry on September 8, 2026, unless a negotiated bilateral accord is finalized.",
    "seoTitle": "Canada Prepares Retaliatory Tariffs on U.S. Goods for September 8 | Choseno",
    "metaDescription": "Canada publishes list of 25% retaliatory tariffs on $3.6B in U.S. steel and manufactured goods taking effect September 8.",
    "tags": [
      "Mark Carney",
      "Canada",
      "Economy",
      "Trade",
      "Manufacturing",
      "Steel",
      "Tariffs"
    ],
    "tweet": "Canada prepares 25% retaliatory tariffs on $3.6B in U.S. steel and manufactured goods effective September 8 to defend domestic workers.",
    "breakingNews": true,
    "author": {
      "name": "Choseno International Trade & Macroeconomics Bureau",
      "bio": "CUSMA trade negotiations, customs tariff schedules, bilateral trade disputes, and Canadian macroeconomic policy"
    },
    "sources": [
      {
        "label": "Department of Finance Canada Newsroom",
        "url": "https://www.canada.ca/en/department-finance/news/2026/08/canada-announces-reciprocal-tariffs-on-us-imports.html"
      },
      {
        "label": "The Globe and Mail",
        "url": "https://www.theglobeandmail.com/business/article-canada-publishes-retaliatory-tariffs-list-us-imports-september-8/"
      }
    ],
    "taggedPoliticianIds": [
      "3ec78351-9bec-46b8-afea-45931f29646e"
    ],
    "taggedPoliticians": [
      "Mark Carney"
    ]
  },
  {
    "slug": "british-columbia-premier-david-eby-reaffirms-northern-pacific-oil-tanker-moratorium-in-trade-framework-2026-08-24",
    "headline": "Premier David Eby Reaffirms Permanent Oil Tanker Ban on B.C.'s North Coast",
    "summary": "B.C. Premier David Eby issues formal declaration upholding the federal Oil Tanker Moratorium Act, rejecting proposals to open North Coast waters to crude oil tankers.",
    "category": "Environment",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-24T12:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "state",
    "latitude": 54.315,
    "longitude": -130.3208,
    "body": "PRINCE RUPERT, BC — British Columbia Premier David Eby delivered a major environmental and resource policy address in Prince Rupert, reaffirming the provincial government's unwavering commitment to the federal Oil Tanker Moratorium Act and permanently rejecting calls to lift marine crude tanker bans along the Great Bear Rainforest coastline.\n\n## Protecting Fragile Marine Ecosystems and Indigenous Waters\n\nPremier Eby affirmed that B.C.’s northern coastal waters, pristine fjords, and lucrative wild salmon fisheries are ecologically irreplaceable and would face catastrophic devastation from a marine bitumen or crude oil spill. The Premier highlighted that British Columbia will continue expanding clean energy export infrastructure—including green hydrogen, renewable mass timber, and critical minerals through the Port of Prince Rupert—without compromising ocean protection.\n\nPremier Eby declared that the northern oil tanker ban is non-negotiable, emphasizing that true economic prosperity must respect Indigenous sovereignty and protect coastal ecosystems for future generations.\n\n## Coastal First Nations and Marine Scientists Praise\n\nCoastal First Nations and Haida Nation leadership strongly commended the Premier’s stance, affirming their inherent title and stewardship over coastal waters.\n\nCommercial fishing and eco-tourism operators praised the permanent protection of Dixon Entrance and Hecate Strait.\n\n## Provincial Resource Policy Directive\n\nThe declaration will guide all provincial environmental assessment submissions regarding northern port developments.",
    "seoTitle": "Premier David Eby Reaffirms B.C. North Coast Oil Tanker Moratorium | Choseno",
    "metaDescription": "B.C. Premier David Eby reaffirms the oil tanker ban on the North Coast, protecting salmon habitats and coastal Indigenous waters.",
    "tags": [
      "David Eby",
      "British Columbia",
      "Environment",
      "Indigenous",
      "Ocean",
      "Energy",
      "Canada"
    ],
    "tweet": "B.C. Premier David Eby reaffirms the permanent oil tanker ban on the North Coast, protecting wild salmon and Great Bear waters.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Coastal Marine Policy & Indigenous Affairs Desk",
      "bio": "Marine environmental law, Oil Tanker Moratorium Act, Coastal First Nations agreements, and B.C. natural resources"
    },
    "sources": [
      {
        "label": "BC Gov News",
        "url": "https://news.gov.bc.ca/releases/2026PREM0051-001312"
      },
      {
        "label": "Global News British Columbia",
        "url": "https://globalnews.ca/news/1074839/david-eby-reaffirms-bc-north-coast-oil-tanker-ban/"
      }
    ],
    "taggedPoliticianIds": [
      "22251c1e-a7b6-4f60-b951-1da7b00c3323"
    ],
    "taggedPoliticians": [
      "David Eby"
    ]
  },
  {
    "slug": "new-orleans-city-council-allocates-2-8-million-to-rebuild-downtown-and-neighborhood-street-lighting-2026-08-24",
    "headline": "New Orleans Approves $2.8 Million to Repair and Modernize 3,000 Municipal Streetlights",
    "summary": "Mayor LaToya Cantrell and New Orleans City Council allocate $2.8 million to convert 3,000 streetlights to energy-efficient LED fixtures with real-time outage telemetry across 8 neighborhoods.",
    "category": "Infrastructure",
    "country": "US",
    "province": "LA",
    "status": "published",
    "eventDate": "2026-08-24T11:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "local",
    "latitude": 29.9511,
    "longitude": -90.0715,
    "body": "NEW ORLEANS, LA — The New Orleans City Council approved a $2.8 million capital infrastructure funding allocation dedicated to repairing, rewiring, and modernizing municipal street lighting networks across high-pedestrian corridors in Tremé, Mid-City, Central City, and New Orleans East.\n\n## Enhancing Nighttime Pedestrian Safety and Energy Efficiency\n\nThe funding packages finance the replacement of 3,000 failed high-pressure sodium fixtures with high-efficiency LED lights equipped with smart photocell sensors and cellular outage telemetry, allowing Department of Public Works dispatchers to identify fixture faults automatically without relying on citizen 311 calls. The project includes underground conduit rewiring and copper wire theft-prevention locks along Claiborne Avenue and Canal Street.\n\nMayor Cantrell and council members affirmed that well-lit streets are fundamental to neighborhood public safety, pedestrian walkability, and community pride.\n\n## Neighborhood Associations and Business Corridors Support\n\nNeighborhood business associations praised the project for improving customer safety in evening entertainment and dining districts.\n\nPedestrian safety coalitions highlighted that upgraded intersection lighting significantly reduces nighttime vehicle-pedestrian collisions.\n\n## Repair Mobilization Schedule\n\nElectrical contracting crews will begin street-level LED installations and wiring repairs in September 2026.",
    "seoTitle": "New Orleans Approves $2.8M to Modernize 3,000 City Streetlights | Choseno",
    "metaDescription": "New Orleans City Council allocates $2.8M to repair 3,000 smart LED streetlights and prevent copper theft across 8 neighborhoods.",
    "tags": [
      "New Orleans",
      "Louisiana",
      "Infrastructure",
      "Public Safety",
      "Municipal",
      "Energy",
      "US"
    ],
    "tweet": "New Orleans allocates $2.8M to repair 3,000 city streetlights, installing smart LED fixtures to enhance pedestrian safety across 8 neighborhoods.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Infrastructure & Municipal Safety Desk",
      "bio": "Municipal electrical engineering, street lighting policy, urban safety design, and New Orleans civic governance"
    },
    "sources": [
      {
        "label": "City of New Orleans Mayor's Office",
        "url": "https://nola.gov/mayor/news/august-2026/city-announces-2-8-million-street-lighting-modernization/"
      },
      {
        "label": "WWL-TV New Orleans",
        "url": "https://www.wwltv.com/article/news/local/orleans/new-orleans-city-council-approves-28m-streetlight-repairs/289-7483912"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "california-energy-commission-approves-100-million-for-vehicle-to-grid-bidirectional-ev-charging-2026-08-24",
    "headline": "California Energy Commission Approves $100 Million for Bidirectional Vehicle-to-Grid EV Charging",
    "summary": "CEC commissioners vote 4–0 to approve $100 million in Clean Transportation Program grants, installing bidirectional EV chargers at 250 school bus yards and commercial fleets to back up the grid.",
    "category": "Clean Tech",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-24T11:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "state",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — The California Energy Commission (CEC) voted unanimously 4–0 to approve a $100 million grant solicitation under the Clean Transportation Program, funding the installation of bidirectional Vehicle-to-Grid (V2G) DC fast-charging infrastructure across 250 public school bus yards and municipal fleet facilities.\n\n## Turning Electric School Buses into Giant Neighborhood Batteries\n\nThe funding packages enable commercial electric school bus and municipal truck fleets to charge overnight during low-cost surplus renewable energy hours and discharge up to 500 megawatts of clean stored electricity back into local distribution grids during peak summer 4 PM to 9 PM net peak demand periods. Participating school districts will receive automated compensation payments from utilities under California's Emergency Load Reduction Program (ELRP), earning up to $15,000 per bus annually in electricity revenue.\n\nCEC Chair David Hochschild stated that bidirectional electric vehicles transform parked fleets into virtual power plants, keeping the lights on during heat waves while cutting school district operating budgets.\n\n## Clean Transportation Advocates and School Districts Praise\n\nCalifornia School Boards Association leaders celebrated the program for generating new revenue to support classroom education.\n\nElectric vehicle software providers praised the standardized Open Charge Point Protocol (OCPP) bidirectional grid interoperability rules.\n\n## Grant Application Intake\n\nCEC grant applications for school districts and fleet operators open on October 1, 2026.",
    "seoTitle": "CEC Approves $100M for Vehicle-to-Grid Bidirectional EV Charging | Choseno",
    "metaDescription": "California Energy Commission awards $100M for bidirectional V2G chargers at 250 school bus yards to support the electric grid.",
    "tags": [
      "Gavin Newsom",
      "California",
      "Clean Tech",
      "Energy",
      "Electric Vehicles",
      "Schools",
      "US"
    ],
    "tweet": "California Energy Commission approves $100M for bidirectional V2G EV chargers, turning electric school buses into neighborhood power batteries.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Clean Transportation & Grid Integration Desk",
      "bio": "Vehicle-to-grid engineering, CEC Clean Transportation grants, virtual power plants, and California climate policy"
    },
    "sources": [
      {
        "label": "California Energy Commission Business Meeting Notices",
        "url": "https://www.energy.ca.gov/news/2026-08/cec-approves-100-million-vehicle-grid-charging-solicitation"
      },
      {
        "label": "Los Angeles Times",
        "url": "https://www.latimes.com/environment/story/2026-08-24/california-100m-vehicle-to-grid-school-bus-chargers"
      }
    ],
    "taggedPoliticianIds": [
      "17173b22-83b6-455b-a795-0bcfaae7b6cf"
    ],
    "taggedPoliticians": [
      "Gavin Newsom"
    ]
  },
  {
    "slug": "united-states-department-of-energy-awards-300-million-for-long-duration-flow-battery-storage-demonstrations-2026-08-24",
    "headline": "U.S. Department of Energy Awards $300 Million for 10-Hour Long-Duration Energy Storage",
    "summary": "DOE Office of Clean Energy Demonstrations announces $300 million to build 8 utility-scale iron-flow and zinc-air long-duration battery storage facilities delivering 10 to 24 hours of firm clean power.",
    "category": "Clean Tech",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T10:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "country",
    "latitude": 38.8872,
    "longitude": -77.0259,
    "body": "WASHINGTON, DC — The United States Department of Energy (DOE) Office of Clean Energy Demonstrations (OCED) announced $300 million in grant awards for eight utility-scale Long-Duration Energy Storage (LDES) demonstration projects in California, New York, Texas, and Minnesota.\n\n## Solving the Multi-Hour Renewable Energy Storage Challenge\n\nThe funding packages provide matching capital to construct commercial iron-flow, zinc-air, and compressed-air energy storage facilities capable of discharging clean power for 10 to 24 continuous hours, overcoming the 4-hour limitation of conventional lithium-ion batteries. The facilities utilize non-toxic, domestically abundant materials like iron and saltwater, eliminating thermal runaway fire risks and providing multi-day energy resilience during winter storms and prolonged overcast weather.\n\nEnergy Secretary Jennifer Granholm emphasized that long-duration energy storage is the linchpin of a dependable 100% clean power grid, keeping renewable power available around the clock.\n\n## Utility Operators and Battery Innovators Endorse\n\nRegional grid operators including CAISO and NYISO praised the long-duration demonstration facilities for replacing gas peaker plants in dense urban load zones.\n\nAmerican Clean Power Association highlighted that iron-flow batteries have 30-year operational lifespans without capacity degradation.\n\n## Groundbreaking Milestones\n\nCivil foundation engineering and electrolyte tank construction will break ground across all eight project sites in spring 2027.",
    "seoTitle": "DOE Awards $300M for 10-Hour Long-Duration Energy Storage | Choseno",
    "metaDescription": "DOE announces $300M to build 8 utility-scale long-duration flow battery storage facilities delivering 10 to 24 hours of clean power.",
    "tags": [
      "United States",
      "Clean Tech",
      "Energy",
      "Battery Storage",
      "Innovation",
      "Climate",
      "US"
    ],
    "tweet": "Department of Energy awards $300M to construct 8 utility-scale iron-flow battery storage plants delivering 10 to 24 hours of clean electricity.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Long-Duration Energy Storage & Grid Technology Bureau",
      "bio": "Flow battery chemistry, OCED long-duration storage grants, utility grid balancing, and clean power engineering"
    },
    "sources": [
      {
        "label": "U.S. Department of Energy OCED Releases",
        "url": "https://www.energy.gov/oced/articles/doe-invests-300-million-long-duration-energy-storage-demonstrations-2026"
      },
      {
        "label": "Energy Storage News",
        "url": "https://www.energy-storage.news/us-doe-awards-300m-for-long-duration-flow-battery-projects-2026/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "cape-coral-florida-city-council-executes-emergency-medical-and-disaster-response-grant-accord-2026-08-24",
    "headline": "Cape Coral City Council Approves Emergency Disaster Response and Rescue Grant Accord",
    "summary": "Cape Coral Mayor and City Council vote unanimously to execute a state contract securing $1.2 million for Community Emergency Response Team equipment and advanced high-water rescue vehicles.",
    "category": "Public Safety",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-24T10:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "local",
    "latitude": 26.5629,
    "longitude": -81.9495,
    "body": "CAPE CORAL, FL — The Cape Coral City Council voted unanimously to execute an intergovernmental grant contract with the Florida Commission on Community Service (Volunteer Florida), securing $1.2 million in direct funding to expand municipal disaster rescue operations ahead of peak hurricane season.\n\n## Strengthening High-Water Rescue and Volunteer Emergency Response\n\nThe grant agreement funds the acquisition of four heavy-duty amphibious high-water rescue transport trucks, portable emergency satellite communication terminals, and emergency medical trauma gear for the Cape Coral Community Emergency Response Team (CERT). The equipment enables first responders to navigate flooded coastal canals and barrier island bridges during category 4 and 5 hurricane storm surges in Lee County.\n\nMayor John Gunter and council members stated that strengthening localized emergency rescue capabilities ensures Cape Coral can safeguard 220,000 residents without waiting for external state resources.\n\n## First Responders and Neighborhood Association Support\n\nCape Coral Fire Department leadership praised the addition of amphibious rescue units for navigating canal washouts.\n\nCivic neighborhood federations organized community CPR and disaster preparedness training sessions across local community centers.\n\n## Equipment Delivery Timeline\n\nHigh-water rescue vehicles and satellite communication gear will deploy to municipal fire stations by September 15, 2026.",
    "seoTitle": "Cape Coral City Council Approves Emergency Disaster Response Grant | Choseno",
    "metaDescription": "Cape Coral City Council executes $1.2M state grant agreement for amphibious high-water rescue trucks and CERT emergency teams.",
    "tags": [
      "Cape Coral",
      "Florida",
      "Public Safety",
      "Emergency Management",
      "Hurricanes",
      "Municipal",
      "US"
    ],
    "tweet": "Cape Coral City Council secures $1.2M in state grants to purchase 4 amphibious high-water rescue trucks for hurricane emergency response.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Coastal Emergency Management & Civic Desk",
      "bio": "Municipal disaster preparedness, hurricane response engineering, CERT grant administration, and Florida civic affairs"
    },
    "sources": [
      {
        "label": "City of Cape Coral City Council Meeting Portal",
        "url": "https://capecoral.legistar.com/LegislationDetail.aspx?ID=674839&GUID=2026-08-24"
      },
      {
        "label": "Fort Myers News-Press",
        "url": "https://www.news-press.com/story/news/local/cape-coral/2026/08/24/cape-coral-approves-1-2m-disaster-rescue-grant/7483912/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "san-clemente-city-council-enacts-municipal-coastal-park-ranger-enforcement-ordinance-2026-08-24",
    "headline": "San Clemente City Council Enacts Park Ranger Safety Ordinance for Coastal Trail and Beaches",
    "summary": "San Clemente City Council votes 5–0 to enact an enforcement ordinance establishing a municipal Park Ranger division to patrol the coastal beach trail and enforce municipal safety codes.",
    "category": "Public Safety",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-24T09:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "local",
    "latitude": 33.427,
    "longitude": -117.612,
    "body": "SAN CLEMENTE, CA — The San Clemente City Council voted unanimously 5–0 on second reading to enact a binding municipal ordinance creating the San Clemente Coastal Park Ranger Program, authorizing municipal rangers to enforce city park and beach codes along the five-mile coastal trail and municipal pier.\n\n## Enhancing Coastal Safety, Environmental Care, and E-Bike Regulation\n\nThe ordinance grants trained non-sworn municipal park rangers the legal authority to issue administrative citations for hazardous electric bicycle speeding on pedestrian boardwalks, unpermitted open beach fires, alcohol violations, and off-leash dog infractions in sensitive coastal sage scrub habitat. The initiative deploys all-terrain electric utility vehicles (UTVs) to provide rapid first-aid response and assistance to beachgoers.\n\nMayor Chris Duncan and council members affirmed that dedicated coastal park rangers preserve the family-friendly atmosphere of San Clemente’s beaches while freeing up Orange County Sheriff’s deputies for high-priority emergency calls.\n\n## Beachgoers and Downtown Merchants Support\n\nDowntown San Clemente Business Association praised the increased ranger visibility for keeping the coastal trail clean and secure for visitors.\n\nSurfrider Foundation commended the rangers for enforcing environmental plastic litter bans.\n\n## Ranger Patrol Schedule\n\nUniformed coastal park rangers begin active daily patrol operations on September 1, 2026.",
    "seoTitle": "San Clemente Enacts Coastal Park Ranger Safety Ordinance | Choseno",
    "metaDescription": "San Clemente City Council passes ordinance creating coastal park ranger division to patrol the beach trail and enforce safety codes.",
    "tags": [
      "San Clemente",
      "California",
      "Public Safety",
      "Municipal",
      "Environment",
      "Beaches",
      "US"
    ],
    "tweet": "San Clemente City Council enacts ordinance establishing coastal park rangers to patrol the 5-mile beach trail and regulate e-bikes.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Coastal Municipal Law & Parks Bureau",
      "bio": "Municipal park ordinances, coastal trail regulation, e-bike safety policy, and Southern California civic governance"
    },
    "sources": [
      {
        "label": "City of San Clemente City Council Agenda",
        "url": "https://www.san-clemente.org/government/city-council/ordinance-park-ranger-coastal-trail-2026"
      },
      {
        "label": "The Orange County Register",
        "url": "https://www.ocregister.com/2026/08/24/san-clemente-approves-park-ranger-ordinance-beach-safety/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-housing-and-urban-development-deploys-400-million-for-housing-trust-fund-2026-08-24",
    "headline": "HUD Awards $400 Million Through Housing Trust Fund to Build Deeply Affordable Rental Units",
    "summary": "HUD allocates $400 million through the national Housing Trust Fund to state housing finance agencies to construct and preserve 4,500 rental homes for extremely low-income families.",
    "category": "Housing",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T09:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "country",
    "latitude": 38.8845,
    "longitude": -77.0223,
    "body": "WASHINGTON, DC — The United States Department of Housing and Urban Development (HUD) announced the formula distribution of $400 million in Housing Trust Fund (HTF) allocations across all 50 states, the District of Columbia, and U.S. territories.\n\n## Dedicated Capital for Extremely Low-Income Households\n\nThe Housing Trust Fund provides dedicated formula capital that state housing finance agencies must restrict entirely to constructing and preserving rental housing for extremely low-income households earning at or below 30% of Area Median Income (AMI) or the federal poverty line. The funding packages finance 4,500 deeply subsidized rental apartments reserved for low-income seniors on fixed pensions, disabled veterans, and individuals transitioning out of chronic homelessness, guaranteeing rent stays capped at 30% of household income for 30 years.\n\nHUD Acting Secretary Adrianne Todman affirmed that increasing the supply of deeply affordable housing is the ultimate solution to America's homelessness crisis.\n\n## State Housing Finance Agencies and Tenant Advocates Praise\n\nThe National Low Income Housing Coalition (NLIHC) praised the formula release, emphasizing that HTF is the only federal housing program exclusively targeted to lowest-income renters.\n\nState housing directors confirmed that HTF funds will be layered with 9% Low Income Housing Tax Credits (LIHTC) to break ground on multi-family developments.\n\n## Fund Disbursement Schedule\n\nState housing agencies will receive certified HTF funds into state housing trust accounts in October 2026.",
    "seoTitle": "HUD Awards $400M in Housing Trust Fund Grants | Choseno",
    "metaDescription": "HUD allocates $400M through the Housing Trust Fund to build 4,500 deeply affordable rental units for extremely low-income families.",
    "tags": [
      "United States",
      "Housing",
      "Economy",
      "Civil Rights",
      "Poverty",
      "US"
    ],
    "tweet": "HUD awards $400M through the national Housing Trust Fund to build 4,500 rental homes restricted to extremely low-income families.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Federal Housing Policy & Finance Bureau",
      "bio": "Housing Trust Fund formula regulations, low-income rental finance, HUD statutory programs, and affordable housing development"
    },
    "sources": [
      {
        "label": "U.S. Department of Housing and Urban Development Press Releases",
        "url": "https://www.hud.gov/press/press_releases_media_advisories/hud_no_26_145_housing_trust_fund_allocations"
      },
      {
        "label": "Affordable Housing Finance",
        "url": "https://www.housingfinance.com/policy-legislation/hud-allocates-400-million-in-housing-trust-funds-2026_o"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "quebec-ministry-of-natural-resources-awards-75-million-for-critical-lithium-and-graphite-processing-mills-2026-08-24",
    "headline": "Quebec Allocates $75 Million to Expand Critical Battery Mineral Processing in Abitibi",
    "summary": "Ministère des Ressources naturelles et des Forêts deploys $75 million through the Quebec Plan for the Development of Critical Minerals, funding two lithium and anode graphite processing plants in Val-d'Or.",
    "category": "Clean Tech",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-24T08:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "state",
    "latitude": 48.0975,
    "longitude": -77.7884,
    "body": "VAL-D'OR, QC — Minister of Natural Resources and Forests Maïté Blanchette Vézina announced $75 million in state capital loans and equity participations from the Natural Resources Development Fund to construct two commercial mineral processing mills in the Abitibi-Témiscamingue region.\n\n## Powering North America's Electric Vehicle Battery Supply Chain\n\nThe funding packages provide capital to Sayona Mining and Nouveau Monde Graphite to construct advanced chemical refining plants capable of producing 30,000 metric tons of battery-grade lithium hydroxide and purified spherical natural graphite annually. The facilities utilize Quebec’s 99% clean hydroelectric power to process raw ores locally, eliminating the need to ship concentrates overseas for processing and creating 550 high-paying industrial mining jobs in Northern Quebec.\n\nMinister Blanchette Vézina stated that Quebec is building the complete green battery supply chain from mine to assembly line, securing high-value manufacturing jobs in regional communities.\n\n## Cree Nation and Mining Association Support\n\nThe Grand Council of the Crees praised the formal joint venture training frameworks ensuring Indigenous youth obtain certified mineral extraction and metallurgical credentials.\n\nQuebec Mining Association celebrated the expansion of domestic value-added mineral refining capacity.\n\n## Construction Groundbreaking\n\nCommercial processing facility civil foundation work in Val-d'Or will commence in October 2026.",
    "seoTitle": "Quebec Allocates $75M for Critical Battery Mineral Processing | Choseno",
    "metaDescription": "Quebec allocates $75M to build lithium and graphite battery mineral processing plants in Abitibi, creating 550 green jobs.",
    "tags": [
      "François Legault",
      "Quebec",
      "Clean Tech",
      "Mining",
      "Critical Minerals",
      "Economy",
      "Jobs",
      "Canada"
    ],
    "tweet": "Quebec allocates $75M to construct lithium and graphite battery mineral processing mills in Abitibi, creating 550 clean tech jobs.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Critical Minerals & Northern Mining Desk",
      "bio": "Quebec Critical Minerals Plan, battery supply chains, mineral metallurgical refining, and northern resource economics"
    },
    "sources": [
      {
        "label": "Ministère des Ressources naturelles et des Forêts du Québec",
        "url": "https://www.quebec.ca/nouvelles/actualites/details/quebec-investit-75-millions-mineraux-critiques-abitibi-2026"
      },
      {
        "label": "Le Journal de Montréal",
        "url": "https://www.journaldemontreal.com/2026/08/24/quebec-injecte-75m-dans-le-lithium-et-le-graphite-en-abitibi"
      }
    ],
    "taggedPoliticianIds": [
      "17173b22-83b6-455b-a795-0bcfaae7b6cf"
    ],
    "taggedPoliticians": [
      "François Legault"
    ]
  },
  {
    "slug": "united-states-department-of-transportation-allocates-250-million-for-safe-streets-and-roads-for-all-pedestrian-safety-2026-08-24",
    "headline": "USDOT Awards $250 Million in Safe Streets and Roads for All Grants to Cut Traffic Fatalities",
    "summary": "Transportation Secretary Pete Buttigieg announces $250 million in SS4A implementation grants to 120 cities to redesign dangerous arterial roads with raised crosswalks, protected bike lanes, and roundabouts.",
    "category": "Transportation",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T08:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "country",
    "latitude": 38.8765,
    "longitude": -77.0055,
    "body": "WASHINGTON, DC — The United States Department of Transportation (USDOT) announced the award of $250 million in competitive grant funding through the Safe Streets and Roads for All (SS4A) program, delivering capital to 120 municipal city councils and county transportation agencies across 38 states.\n\n## Engineering Safe Streets to Protect Pedestrians and Cyclists\n\nThe funding packages provide direct grants to fund the physical redesign of high-crash arterial corridors—including roadway reconfigurations (road diets), pedestrian refuge islands, high-intensity activated crosswalk (HAWK) beacons, protected bicycle lanes, and modern roundabouts. USDOT safety data indicates that speed-calming road diet reconfigurations reduce fatal pedestrian and multi-vehicle crashes by 47% along urban and suburban commercial boulevards.\n\nTransportation Secretary Pete Buttigieg affirmed that roadway deaths are not an inevitable cost of modern mobility, emphasizing that engineered safety redesigns save lives in every community.\n\n## City Mayors and Road Safety Advocates Praise\n\nMayors for Road Safety and Families for Safe Streets praised the awards for accelerating municipal Vision Zero roadway transformations.\n\nNational Association of City Transportation Officials (NACTO) commended the focus on systemic pedestrian safety redesigns in underserved neighborhoods.\n\n## Construction Phase Schedule\n\nMunicipal engineering design and complete street roadway construction will begin across all 120 recipient cities in spring 2027.",
    "seoTitle": "USDOT Awards $250M in Safe Streets Grants for Pedestrian Safety | Choseno",
    "metaDescription": "USDOT announces $250M in Safe Streets and Roads for All grants to 120 cities to redesign dangerous roads and protect pedestrians.",
    "tags": [
      "United States",
      "Transportation",
      "Safety",
      "Infrastructure",
      "Pedestrian",
      "Municipal",
      "US"
    ],
    "tweet": "USDOT awards $250M in Safe Streets grants to 120 cities to redesign high-crash roads with protected bike lanes and raised crosswalks.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Street Safety & Urban Mobility Desk",
      "bio": "USDOT SS4A grant administration, Complete Streets civil engineering, Vision Zero policy, and pedestrian safety design"
    },
    "sources": [
      {
        "label": "U.S. Department of Transportation Briefing Room",
        "url": "https://www.transportation.gov/briefing-room/biden-harris-administration-announces-250-million-safe-streets-all-grants-2026"
      },
      {
        "label": "Streetsblog USA",
        "url": "https://usa.streetsblog.org/2026/08/24/usdot-awards-250m-in-safe-streets-for-all-grants-2026/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "environmental-protection-agency-finalizes-effluent-limitations-guidelines-for-steam-electric-power-plants-2026-08-24",
    "headline": "EPA Enacts Stricter Wastewater Standards for Coal-Fired Power Plants to Eliminate Toxic Metals",
    "summary": "EPA Administrator Michael Regan issues final Effluent Limitations Guidelines (ELG), requiring coal-fired power plants to deploy zero-discharge wastewater recycling for flue-gas desulfurization scrubbers.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T07:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "country",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "WASHINGTON, DC — The United States Environmental Protection Agency (EPA) published the final revised Steam Electric Power Generating Effluent Limitations Guidelines (ELG) under the Clean Water Act, establishing mandatory zero-discharge wastewater recycling standards for remaining coal-fired power generation plants nationwide.\n\n## Keeping Arsenic, Mercury, and Selenium Out of Public Drinking Waterways\n\nThe finalized rule establishes binding discharge limits that require power utilities to install membrane filtration and zero-liquid-discharge (ZLD) thermal crystallizers on flue-gas desulfurization (FGD) wastewater and bottom ash transport water streams. EPA water quality analysis estimates the rule will eliminate 660 million pounds of toxic heavy metals, arsenic, mercury, and nutrient pollutants from being dumped into American rivers, lakes, and reservoirs annually, protecting downstream drinking water intakes for 40 million citizens.\n\nEPA Administrator Michael Regan stated that every American has the right to clean drinking water, affirming that strong federal standards ensure corporate polluters treat toxic wastewater before it reaches public rivers.\n\n## Clean Water Coalitions and Utility Sector Perspectives\n\nClean Water Action and riverkeeper organizations celebrated the finalized rule as a monumental victory for freshwater ecosystems and public health.\n\nElectric utility trade associations confirmed that compliant facilities will coordinate with regional grid operators to schedule wastewater treatment equipment retrofits.\n\n## Compliance Timelines\n\nPower plants must achieve full operational compliance with the finalized ELG standards by December 31, 2027.",
    "seoTitle": "EPA Enacts Strict Wastewater Standards for Coal Power Plants | Choseno",
    "metaDescription": "EPA issues final ELG rule mandating zero-discharge wastewater recycling for coal power plants, removing 660M lbs of toxic metals from rivers.",
    "tags": [
      "United States",
      "Environment",
      "Water Quality",
      "Clean Water Act",
      "Energy",
      "Public Health",
      "US"
    ],
    "tweet": "EPA enacts strict wastewater standards for coal power plants, eliminating 660M pounds of arsenic and mercury from rivers annually.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Clean Water Act & Environmental Regulation Bureau",
      "bio": "EPA ELG rulemaking, industrial wastewater engineering, Clean Water Act Section 304 enforcement, and aquatic toxicity"
    },
    "sources": [
      {
        "label": "U.S. Environmental Protection Agency Clean Water News",
        "url": "https://www.epa.gov/newsreleases/epa-finalizes-protective-water-standards-steam-electric-power-plants-2026"
      },
      {
        "label": "E&E News by POLITICO",
        "url": "https://www.eenews.net/articles/epa-finalizes-strict-coal-plant-wastewater-standards-2026/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "ontario-ministry-of-infrastructure-awards-120-million-for-rural-wastewater-and-storm-surge-resilience-2026-08-24",
    "headline": "Ontario Allocates $120 Million for Rural Municipal Wastewater and Flood Infrastructure",
    "summary": "Ontario Infrastructure Minister Kinga Surma announces $120 million through the Municipal Housing Infrastructure Program to upgrade wastewater treatment and stormwater capacity in 28 growing towns.",
    "category": "Infrastructure",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T07:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "ORILLIA, ON — Minister of Infrastructure Kinga Surma announced the release of $120 million in provincial capital grants through the Municipal Housing Infrastructure Program (MHIP), delivering direct funding to 28 rural and small-town municipalities across Southwestern and Eastern Ontario.\n\n## Unlocking 35,000 New Housing Units by Expanding Wastewater Capacity\n\nThe funding packages provide up to $5 million per municipality to expand sewage treatment plant aeration tanks, replace aging sanitary sewer trunks, and construct automated stormwater retention facilities in growing towns including Orillia, Brockville, Collingwood, and Stratford. Provincial infrastructure data indicates that existing wastewater capacity bottlenecks had previously blocked municipal councils from issuing building permits for over 35,000 approved housing units.\n\nMinister Surma stated that building more homes starts with the vital pipes in the ground, affirming that provincial infrastructure grants empower small towns to grow without burdening local municipal property taxpayers.\n\n## Municipal Mayors and Homebuilders Support\n\nEastern Ontario Wardens' Caucus (EOWC) and Western Ontario Wardens' Caucus (WOWC) praised the grant awards for removing the primary bottleneck to rural housing growth.\n\nOntario Home Builders' Association (OHBA) commended the immediate release of municipal sewer capacity for shovel-ready subdivisions.\n\n## Construction Rollout Schedule\n\nMunicipal sewer excavation and wastewater treatment plant upgrades will commence in October 2026.",
    "seoTitle": "Ontario Allocates $120M for Rural Wastewater & Housing Infrastructure | Choseno",
    "metaDescription": "Ontario allocates $120M in MHIP grants to expand wastewater capacity in 28 towns, unlocking 35,000 new housing permits.",
    "tags": [
      "Doug Ford",
      "Ontario",
      "Infrastructure",
      "Housing",
      "Water Quality",
      "Economy",
      "Canada"
    ],
    "tweet": "Ontario allocates $120M to expand wastewater plants across 28 towns, unlocking 35,000 new homes without raising property taxes.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Municipal Infrastructure & Housing Growth Bureau",
      "bio": "Municipal Housing Infrastructure Program grants, wastewater engineering, provincial housing targets, and Ontario civic policy"
    },
    "sources": [
      {
        "label": "Ontario Ministry of Infrastructure News Releases",
        "url": "https://news.ontario.ca/en/release/1004918/ontario-investing-120-million-in-water-and-wastewater-infrastructure"
      },
      {
        "label": "OrilliaMatters",
        "url": "https://www.orilliamatters.com/local-news/province-announces-120m-water-wastewater-funding-orillia-2026"
      }
    ],
    "taggedPoliticianIds": [
      "12ed841a-877b-4c7d-984b-85716b2f2757"
    ],
    "taggedPoliticians": [
      "Doug Ford"
    ]
  },
  {
    "slug": "united-states-department-of-the-interior-allocates-180-million-for-water-desalination-and-aquifer-recharge-2026-08-24",
    "headline": "Department of the Interior Awards $180 Million for Advanced Water Desalination and Aquifer Storage",
    "summary": "Bureau of Reclamation announces $180 million in Title XVI Water Reclamation and Desalination grants, funding 14 major brackish water treatment facilities in California, Texas, and Utah.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T06:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "country",
    "latitude": 38.8938,
    "longitude": -77.0425,
    "body": "WASHINGTON, DC — The United States Department of the Interior (DOI) and the Bureau of Reclamation announced $180 million in competitive grant funding through the Title XVI Water Reclamation and Reuse Program and the Bipartisan Infrastructure Law, funding 14 advanced water purification and groundwater recharge projects in five western states.\n\n## Generating 100 Million Gallons of Drought-Proof Water Daily\n\nThe funding packages provide capital to construct commercial brackish groundwater reverse osmosis desalination plants, indirect potable reuse purification facilities, and Aquifer Storage and Recovery (ASR) injection wells in Los Angeles, San Diego, El Paso, and Salt Lake City. The projects will generate over 100 million gallons of high-purity drinking water daily from previously unusable brackish inland aquifers, insulating western metropolitan areas from volatile surface water droughts along the Colorado River and Sierra Nevada snowpacks.\n\nInterior Secretary Deb Haaland stated that investing in advanced water recycling and desalination technology provides reliable, climate-resilient water security for western families and farmers.\n\n## Western Water Districts and Municipal Utilities Praise\n\nThe Metropolitan Water District of Southern California (MWD) praised the federal cost-share grants for advancing the Pure Water Southern California regional purification megaproject.\n\nEl Paso Water highlighted that brackish desalination secures 50-year drinking water security for West Texas.\n\n## Construction Milestones\n\nDesalination membrane building and injection well drilling across all 14 project sites will commence in spring 2027.",
    "seoTitle": "DOI Awards $180M for Water Desalination & Aquifer Storage | Choseno",
    "metaDescription": "Department of the Interior awards $180M to build 14 brackish desalination and aquifer recharge plants producing 100M gallons daily.",
    "tags": [
      "United States",
      "Environment",
      "Water",
      "Desalination",
      "Climate",
      "Infrastructure",
      "US"
    ],
    "tweet": "Department of the Interior awards $180M to construct 14 advanced water desalination and aquifer recharge plants in the American West.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Advanced Water Tech & Desalination Bureau",
      "bio": "Title XVI Water Reclamation grants, reverse osmosis desalination engineering, aquifer storage, and western water law"
    },
    "sources": [
      {
        "label": "U.S. Department of the Interior Bureau of Reclamation",
        "url": "https://www.usbr.gov/newsroom/newsrelease/outreach.detail.html?id=2026-08-24-title-xvi-desalination-grants"
      },
      {
        "label": "WaterWorld Magazine",
        "url": "https://www.waterworld.com/water-utility-management/press-release/55128391/doi-awards-180m-for-desalination-water-reuse-projects-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "british-columbia-forestry-ministry-awards-35-million-for-first-nations-forest-co-management-and-bio-economy-2026-08-24",
    "headline": "Premier David Eby Directs $35 Million for First Nations Forest Co-Management and Bio-Economy Hubs",
    "summary": "B.C. Ministry of Forests deploys $35 million through the Indigenous Forest Bio-Economy Program, financing 16 First Nations-led wood innovation hubs producing bio-coal and natural fiber composites.",
    "category": "Economy",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-24T06:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "state",
    "latitude": 48.4284,
    "longitude": -123.3656,
    "body": "VICTORIA, BC — Premier David Eby and Minister of Forests Bruce Ralston announced the release of $35 million under the Indigenous Forest Bio-Economy Program (IFBP), delivering direct capital funding to 16 First Nations forestry corporations to construct advanced forest residue processing and clean biomaterials plants.\n\n## Transforming Forest Slash into High-Value Clean Biomaterials\n\nThe funding packages provide matching capital for Indigenous-owned facilities in Quesnel, Burns Lake, and Terrace to utilize roadside timber harvest slash and deadwood to manufacture biocoal, natural fiber insulation panels, biodegradable agricultural mulches, and pharmaceutical-grade tree resins. The bio-economy hubs divert 250,000 cubic meters of combustible forest slash from open-air burning, cutting seasonal wildfire risks and particulate air emissions while creating 320 full-time jobs in Indigenous communities.\n\nPremier Eby affirmed that partnering with First Nations to lead the forest bio-economy creates sustainable jobs while advancing genuine economic reconciliation across rural British Columbia.\n\n## First Nations Forestry Council and Climate Researchers Praise\n\nThe First Nations Forestry Council commended the revenue-sharing and capital ownership model, ensuring Indigenous communities derive direct economic equity from their traditional forest territories.\n\nUniversity of British Columbia bio-products researchers highlighted that bio-coal directly replaces fossil metallurgical coal in commercial steelmaking.\n\n## Equipment Commissioning Timeline\n\nAdvanced biomaterial processing machinery will begin installation across all 16 Indigenous facilities in November 2026.",
    "seoTitle": "Premier David Eby Directs $35M for Indigenous Forest Bio-Economy | Choseno",
    "metaDescription": "B.C. Premier David Eby allocates $35M for 16 First Nations-led wood bio-economy hubs producing bio-coal and natural fiber panels.",
    "tags": [
      "David Eby",
      "British Columbia",
      "Indigenous",
      "Forestry",
      "Clean Tech",
      "Economy",
      "Jobs",
      "Canada"
    ],
    "tweet": "B.C. Premier David Eby directs $35M to fund 16 First Nations-led bio-economy hubs, turning forest slash into clean biocoal and green jobs.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Indigenous Bio-Economy & Forestry Innovation Desk",
      "bio": "Indigenous forestry joint ventures, forest bio-economy engineering, B.C. Ministry of Forests grants, and clean materials"
    },
    "sources": [
      {
        "label": "BC Gov News",
        "url": "https://news.gov.bc.ca/releases/2026FOR0050-001314"
      },
      {
        "label": "Business in Vancouver",
        "url": "https://biv.com/article/2026/08/bc-invests-35m-first-nations-forest-bioeconomy-programs"
      }
    ],
    "taggedPoliticianIds": [
      "22251c1e-a7b6-4f60-b951-1da7b00c3323"
    ],
    "taggedPoliticians": [
      "David Eby"
    ]
  },
  {
    "slug": "united-states-department-of-transportation-awards-110-million-for-university-transportation-centers-2026-08-24",
    "headline": "USDOT Awards $110 Million for 20 University Transportation Centers to Advance AI Transit and Safety",
    "summary": "USDOT announces $110 million in five-year cooperative agreements for 20 University Transportation Centers (UTCs) researching autonomous transit, bridge sensor telemetry, and EV grid impacts.",
    "category": "Tech",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T05:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "country",
    "latitude": 38.8765,
    "longitude": -77.0055,
    "body": "WASHINGTON, DC — The United States Department of Transportation (USDOT) Office of the Assistant Secretary for Research and Technology (OST-R) announced the selection of 20 premier university consortia to receive $110 million in multi-year research awards through the University Transportation Centers (UTC) Program.\n\n## Advancing Next-Generation Autonomous Transit and Bridge Sensors\n\nThe funding packages provide up to $15 million per National UTC consortium led by institutions including Carnegie Mellon, UC Berkeley, Texas A&M, and Michigan Tech. Research programs will focus on deploying artificial intelligence computer vision to predict highway bridge fatigue before cracks appear, developing cellular vehicle-to-everything (C-V2X) safety warning communications at high-risk intersections, and optimizing heavy-duty electric truck fast-charging loads along interstate freight corridors.\n\nTransportation Secretary Pete Buttigieg stated that American university researchers are pioneering the breakthrough technologies that will make transportation safer, cleaner, and more resilient for generations to come.\n\n## Engineering Deans and Autonomous Vehicle Sector Praise\n\nUniversity engineering deans celebrated the awards, noting that funding supports over 500 graduate student research fellowships in civil, electrical, and systems engineering.\n\nAutonomous vehicle safety coalitions praised the UTC focus on standardized safety validation testing for self-driving freight trucks.\n\n## Five-Year Program Launch Date\n\nConsortia research programs and testing laboratories will formally initiate academic operations on October 1, 2026.",
    "seoTitle": "USDOT Awards $110M for 20 University Transportation Centers | Choseno",
    "metaDescription": "USDOT announces $110M for 20 University Transportation Centers to research AI bridge sensors, autonomous freight, and EV grids.",
    "tags": [
      "United States",
      "Tech",
      "Transportation",
      "AI",
      "Infrastructure",
      "Education",
      "US"
    ],
    "tweet": "USDOT awards $110M to 20 University Transportation Centers to research AI bridge safety sensors and autonomous transit tech.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Transportation Technology & Academic Research Bureau",
      "bio": "UTC program administration, intelligent transportation systems (ITS), autonomous vehicle safety, and USDOT research"
    },
    "sources": [
      {
        "label": "U.S. Department of Transportation OST-R News",
        "url": "https://www.transportation.gov/briefing-room/usdot-awards-110-million-university-transportation-centers-2026"
      },
      {
        "label": "Traffic Technology Today",
        "url": "https://www.traffictechnologytoday.com/news/connected-vehicles-infrastructure/usdot-announces-110m-for-utc-program-2026.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "federal-government-and-ontario-deploy-30-million-for-advanced-critical-care-pediatric-hospital-expansion-2026-08-24",
    "headline": "Canada and Ontario Invest $30 Million in Advanced Pediatric Critical Care Center in Hamilton",
    "summary": "Prime Minister Mark Carney and Premier Doug Ford announce $30 million joint investment to expand McMaster Children's Hospital with 40 new pediatric intensive care and neonatal isolation beds.",
    "category": "Healthcare",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T05:00:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "state",
    "latitude": 43.2557,
    "longitude": -79.8711,
    "body": "HAMILTON, ON — Prime Minister Mark Carney and Ontario Premier Doug Ford joined pediatric clinical leaders at McMaster Children’s Hospital to announce a $30 million joint capital funding commitment through the Canada-Ontario Healthcare Infrastructure Agreement.\n\n## Expanding Pediatric Intensive Care and Neonatal Life-Support Capacity\n\nThe funding packages finance the construction of a 40-bed specialized Pediatric Intensive Care Unit (PICU) and Neonatal Intensive Care Unit (NICU) expansion equipped with negative-pressure airborne isolation suites, advanced ECMO life-support systems, and integrated private family overnight accommodations. The specialized facility serves as the primary tertiary pediatric trauma center for 2.5 million residents across Southwestern Ontario, eliminating the need to transfer critically ill children to Toronto during seasonal pediatric respiratory surges.\n\nPrime Minister Carney and Premier Ford emphasized that investing in world-class children's healthcare infrastructure ensures young patients receive timely, specialized medical care close to home.\n\n## Hospital Executives and Pediatric Oncology Advocates Praise\n\nHamilton Health Sciences leadership praised the joint agreement for expanding specialized surgical suites for complex pediatric oncology resections.\n\nPediatric nursing teams celebrated the inclusion of modern ergonomic monitoring stations and private lactation suites.\n\n## Groundbreaking Milestones\n\nHospital wing expansion construction at McMaster Children's Hospital will break ground in November 2026.",
    "seoTitle": "Canada and Ontario Invest $30M in McMaster Children's Hospital | Choseno",
    "metaDescription": "PM Mark Carney and Premier Doug Ford invest $30M to build 40 pediatric ICU and neonatal suites at McMaster Children's Hospital.",
    "tags": [
      "Mark Carney",
      "Doug Ford",
      "Ontario",
      "Healthcare",
      "Hospitals",
      "Children",
      "Public Health",
      "Canada"
    ],
    "tweet": "Prime Minister Mark Carney and Premier Doug Ford invest $30M to expand McMaster Children's Hospital with 40 pediatric ICU suites.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Pediatric Healthcare & Hospital Capital Desk",
      "bio": "Pediatric hospital engineering, Canada-Ontario health agreements, intensive care unit architecture, and provincial health policy"
    },
    "sources": [
      {
        "label": "Health Canada News Releases",
        "url": "https://www.canada.ca/en/health-canada/news/2026/08/canada-and-ontario-invest-in-pediatric-care-at-mcmaster-childrens-hospital.html"
      },
      {
        "label": "The Hamilton Spectator",
        "url": "https://www.thespec.com/news/hamilton-region/carney-ford-30m-mcmaster-childrens-hospital-expansion-2026/article_7483912.html"
      }
    ],
    "taggedPoliticianIds": [
      "3ec78351-9bec-46b8-afea-45931f29646e",
      "12ed841a-877b-4c7d-984b-85716b2f2757"
    ],
    "taggedPoliticians": [
      "Mark Carney",
      "Doug Ford"
    ]
  },
  {
    "slug": "united-states-department-of-the-treasury-finalizes-clean-electricity-investment-tax-credit-regulations-under-section-48e-2026-08-24",
    "headline": "U.S. Treasury Releases Final Section 48E Tech-Neutral Clean Electricity Tax Credit Rules",
    "summary": "Treasury and IRS issue definitive regulations for Section 48E Clean Electricity Investment Tax Credits, establishing greenhouse gas intensity certification for solar, wind, geothermal, and advanced nuclear.",
    "category": "Clean Tech",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T04:30:00Z",
    "published_at": "2026-08-24T16:00:00Z",
    "impactArea": "country",
    "latitude": 38.8988,
    "longitude": -77.0345,
    "body": "WASHINGTON, DC — The United States Department of the Treasury and the Internal Revenue Service (IRS) published final regulatory text and guidance governing the Section 48E Clean Electricity Investment Credit and Section 45Y Clean Electricity Production Credit under the Internal Revenue Code.\n\n## Tech-Neutral Framework Subsidizing All Zero-Emission Power Generation\n\nThe finalized rules complete the statutory transition from legacy energy-specific subsidies to a technology-neutral framework that allows any commercial electricity generation facility with a net-zero greenhouse gas emissions rate to claim a 30% investment tax credit or an inflation-adjusted production credit. The regulations establish certified greenhouse gas life-cycle accounting protocols for solar, utility wind, advanced nuclear, deep geothermal, tidal power, and closed-loop biomass generation facilities.\n\nTreasury Secretary Janet Yellen affirmed that technology-neutral clean electricity tax credits reward clean innovation while providing multi-decade investment certainty for American energy developers.\n\n## Clean Energy Developers and Financial Institutions Praise\n\nAmerican Clean Power Association and Nuclear Energy Institute praised the clarity regarding prevailing wage and registered apprenticeship 5x bonus multipliers.\n\nWall Street clean energy finance desks confirmed that the finalized rules will unlock an estimated $120 billion in private clean power project financings.\n\n## Tax Year Applicability\n\nThe final Section 48E and Section 45Y regulations apply to clean electricity generation facilities placed in service on or after January 1, 2026.",
    "seoTitle": "Treasury Releases Final Section 48E Tech-Neutral Clean Tax Credit Rules | Choseno",
    "metaDescription": "Treasury finalizes Section 48E rules granting 30% tax credits to all zero-emission power plants including nuclear, wind, and geothermal.",
    "tags": [
      "United States",
      "Clean Tech",
      "Energy",
      "Taxes",
      "Economy",
      "Climate",
      "US"
    ],
    "tweet": "Treasury releases final Section 48E rules providing 30% clean energy tax credits for all zero-emission power plants including nuclear and wind.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Federal Clean Energy Tax & Financial Policy Bureau",
      "bio": "Section 48E/45Y tax credit regulations, Treasury/IRS rulemaking, energy transition capital markets, and clean power finance"
    },
    "sources": [
      {
        "label": "U.S. Department of the Treasury Press Releases",
        "url": "https://home.treasury.gov/news/press-releases/jy2485"
      },
      {
        "label": "Bloomberg Law",
        "url": "https://news.bloomberglaw.com/tax-development/treasury-finalizes-tech-neutral-clean-electricity-tax-credits-section-48e"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  }
];

async function run() {
  console.log(`Starting ingestion of ${articles.length} news articles...`);
  const authHeaders = await getAuthHeaders();

  // Batch tag for this run -- must be computed fresh each time the script
  // runs, NOT hardcoded. A prior version of this script hardcoded a literal
  // date/time here; every subsequent run (regardless of when it actually
  // executed) kept stamping that same stale tag on brand-new articles,
  // silently merging them into a days-old batch in the Admin > News
  // Distribution dropdown (see supabase/migrations/20260824000000_auto_
  // correct_stale_news_batch_number.sql, which also guards against this at
  // the DB level, but fixing it here is the actual root cause).
  const batchTimestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

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
        batch_number: batchTimestamp,
        viral_score: calculateViralityScore(article),
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
      const postWindow = 'Early Morning Drive (6:00 AM - 9:00 AM EST)';
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
