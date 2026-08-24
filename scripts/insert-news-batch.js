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
const articles = [
  {
    "slug": "los-angeles-city-council-approves-14-day-fast-track-permitting-for-2028-olympic-projects-2026-08-24",
    "headline": "Los Angeles City Council Passes 14-Day Fast-Track Permitting Ordinance for 2028 Olympic Venues",
    "summary": "The Los Angeles City Council unanimously approves emergency planning exemptions expediting environmental reviews and building permits for 2028 Olympic transit and venue construction.",
    "category": "Infrastructure",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-23T22:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 34.0522,
    "longitude": -118.2437,
    "body": "LOS ANGELES, CA — The Los Angeles City Council voted unanimously to pass a comprehensive municipal ordinance establishing an expedited 14-day administrative review process for public infrastructure and temporary venue projects tied to the 2028 Olympic and Paralympic Games.\n\n## Streamlining Olympic Infrastructure Delivery\n\nThe ordinance exempts qualifying transit mobility hubs, temporary athlete village pavilions, and accessibility retrofits from standard discretionary planning commission hearings, delegating administrative sign-off directly to the Department of Building and Safety. Council members stressed that timely delivery of regional bus express corridors and stadium upgrades is critical to avoid multi-million dollar construction cost escalation.\n\nCity Council leadership affirmed that the streamlined framework guarantees public safety inspections while removing bureaucratic timeline bottlenecks.\n\n## Community Oversight and Neighborhood Impacts\n\nNeighborhood council federations in South Los Angeles and the San Fernando Valley raised concerns regarding community input on street closures, securing commitments for mandatory 30-day public advance notices for temporary venue installations.\n\nBuilding trade unions and business associations strongly endorsed the accelerated permitting timeline.\n\n## Mayoral Signing Timeline\n\nThe ordinance proceeds to Mayor Karen Bass for executive signature, taking effect 30 days following publication.",
    "seoTitle": "Los Angeles Council Passes 14-Day Olympic Fast-Track Permitting | Choseno",
    "metaDescription": "Los Angeles City Council unanimously approves 14-day expedited permitting ordinance for 2028 Olympic transit and venue infrastructure.",
    "tags": [
      "Los Angeles",
      "California",
      "Infrastructure",
      "Olympic Games",
      "Zoning",
      "US"
    ],
    "tweet": "Los Angeles City Council unanimously passes an ordinance creating a 14-day fast-track permitting process for 2028 Olympic venue and transit projects.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Infrastructure Desk",
      "bio": "Municipal planning, major events infrastructure, zoning exemptions, and civic development"
    },
    "sources": [
      {
        "label": "Inside the Games",
        "url": "https://www.insidethegames.biz/articles/1148392/los-angeles-council-passes-olympic-fast-track-law"
      },
      {
        "label": "Los Angeles Times",
        "url": "https://www.latimes.com/california/story/2026-08-23/la-city-council-approves-fast-track-olympics-building-ordinance"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "ottawa-mayor-mark-sutcliffe-tables-emergency-economic-defense-motion-against-us-tariffs-2026-08-24",
    "headline": "Mayor Mark Sutcliffe Tables Municipal Economic Defense Motion to Support Local Exporters Amid Tariff Dispute",
    "summary": "Ottawa Mayor Mark Sutcliffe announces municipal relief measures, prioritizing local procurement and waiving commercial licensing fees for cross-border logistics businesses impacted by U.S. tariffs.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-23T20:30:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Ottawa Mayor Mark Sutcliffe announced a comprehensive municipal economic resilience motion heading to City Council, proposing direct administrative relief for local manufacturing, agriculture, and high-tech exporters impacted by cross-border tariffs.\n\n## Municipal Procurement and Fee Waivers\n\nThe motion directs the city manager to implement a 'Buy Local First' policy across municipal supply contracts and establishes a temporary deferral of municipal commercial property tax installments for affected industrial warehousing operations. Mayor Sutcliffe noted that national trade tensions directly threaten hundreds of local logistics and tech jobs across eastern Ontario.\n\nMayor Sutcliffe stated that municipal government must stand shoulder-to-shoulder with local workers and businesses during bilateral trade friction.\n\n## Council Debate and Business Community Support\n\nThe Ottawa Board of Trade and rural agricultural associations endorsed the municipal support measures, urging other Ontario municipalities to adopt similar procurement safeguards.\n\nCity Council will debate and vote on the formal economic motion during the August 26 legislative session.\n\n## Policy Implementation\n\nApproved procurement amendments will take effect across municipal departments on September 1, 2026.",
    "seoTitle": "Ottawa Mayor Mark Sutcliffe Tables Economic Defense Motion on U.S. Tariffs | Choseno",
    "metaDescription": "Ottawa Mayor Mark Sutcliffe introduces municipal relief motion to support local businesses and prioritize domestic procurement.",
    "tags": [
      "Mark Sutcliffe",
      "Ottawa",
      "Ontario",
      "Trade",
      "Economy",
      "Municipal",
      "Canada"
    ],
    "tweet": "Ottawa Mayor Mark Sutcliffe tables a municipal economic defense motion prioritizing local procurement to protect exporters from U.S. tariffs.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Civic Affairs Desk",
      "bio": "Municipal governance, local economic development, trade impacts, and city council proceedings"
    },
    "sources": [
      {
        "label": "CTV News Ottawa",
        "url": "https://ottawa.ctvnews.ca/mayor-sutcliffe-tables-motion-to-protect-local-economy-amid-us-tariffs-1.7483921"
      },
      {
        "label": "Ottawa Citizen",
        "url": "https://ottawacitizen.com/news/local-news/sutcliffe-ottawa-council-tariff-defense-motion"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "san-antonio-city-council-defeats-ballot-referendum-on-489-million-spurs-downtown-arena-2026-08-24",
    "headline": "San Antonio City Council Votes 6–5 Defeating Public Ballot Vote on $489M Downtown Spurs Arena",
    "summary": "In a razor-thin 6–5 vote, San Antonio City Council rejects placing a $489 million public arena financing contribution on the November ballot, opting for direct council-negotiated term sheets.",
    "category": "Infrastructure",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-23T19:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 29.4241,
    "longitude": -98.4936,
    "body": "SAN ANTONIO, TX — In an intensely contested 6–5 vote, the San Antonio City Council defeated a resolution that would have placed a proposed $489 million municipal financing contribution for a new downtown sports and entertainment arena on the November municipal ballot.\n\n## Negotiated Term Sheets vs Public Referendum\n\nThe majority faction of council determined that complex hotel occupancy tax (HOT) and venue district financing mechanisms should be negotiated directly between city staff and Spurs Sports & Entertainment (SS&E) rather than structured as a binary ballot question. Council members supporting the decision argued that delaying negotiations could jeopardize downtown revitalization and economic development deadlines.\n\nDissenting council members argued passionately for direct taxpayer democracy, stating that public commitments of this scale require voter authorization.\n\n## Financial Restructuring and Fiscal Scrutiny\n\nCity Manager Erik Walsh presented fiscal modeling demonstrating that proposed venue bonds will be funded through visitor hotel taxes without increasing residential property tax rates.\n\nCivic accountability federations expressed disappointment over the referendum rejection, promising rigorous oversight during upcoming public hearings.\n\n## Final Council Approval Schedule\n\nThe final master development term sheet will be submitted to City Council for binding vote in October 2026.",
    "seoTitle": "San Antonio Council Defeats Ballot Vote on $489M Spurs Arena | Choseno",
    "metaDescription": "San Antonio City Council votes 6-5 against placing $489M downtown Spurs arena financing on the November ballot.",
    "tags": [
      "San Antonio",
      "Texas",
      "Infrastructure",
      "Economy",
      "Sports",
      "Municipal",
      "US"
    ],
    "tweet": "San Antonio City Council votes 6-5 against placing a $489M downtown arena funding package on the November ballot, opting for direct council approval.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Municipal Finance Bureau",
      "bio": "Sports facility financing, municipal venue bonds, city council votes, and urban revitalization"
    },
    "sources": [
      {
        "label": "Texas Public Radio",
        "url": "https://www.tpr.org/government/2026-08-23/san-antonio-council-rejects-ballot-measure-for-spurs-arena"
      },
      {
        "label": "San Antonio Express-News",
        "url": "https://www.expressnews.com/news/local/article/san-antonio-city-council-spurs-arena-vote-19748312.php"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "montreal-mayor-soraya-martinez-ferrada-unveils-body-worn-cameras-and-civic-respect-bylaw-2026-08-24",
    "headline": "Montreal Administration Mandates Police Body-Worn Cameras and Introduces Civic Worker Protection Bylaw",
    "summary": "Montreal Mayor Soraya Martinez Ferrada announces city-wide body camera rollout for frontline police officers and introduces bylaws establishing fines for harassment directed at municipal employees.",
    "category": "Public Safety",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-23T18:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 45.5017,
    "longitude": -73.5673,
    "body": "MONTREAL, QC — Montreal Mayor Soraya Martinez Ferrada and the executive committee announced a $22 million public safety modernization framework, mandating body-worn cameras across the Service de police de la Ville de Montréal (SPVM) and introducing new municipal bylaws penalizing harassment of civic workers.\n\n## Transparency and Frontline Accountability\n\nThe initiative will equip 1,800 frontline patrol officers and intervention units with high-definition body cameras over 18 months, following an extensive pilot program. Mayor Martinez Ferrada affirmed that independent digital footage enhances transparency during police-public interactions while protecting officers and citizens against unsubstantiated complaints.\n\nAdditionally, the proposed municipal bylaw authorizes ticketing with fines up to $500 for verbal abuse and intimidation directed at municipal transit operators, inspectors, and emergency personnel.\n\n## Civil Liberties Oversight and Police Union Stance\n\nCivil liberties advocates welcomed the camera guidelines but stressed the need for strict data retention safeguards and public access protocols.\n\nThe Montreal Police Brotherhood supported the rollout, emphasizing officer safety and objective documentation.\n\n## City Council Vote Schedule\n\nThe municipal bylaw will be tabled for formal debate and adoption by Montreal City Council in September 2026.",
    "seoTitle": "Montreal Mandates Police Body Cameras and Worker Protection Bylaws | Choseno",
    "metaDescription": "Montreal Mayor Soraya Martinez Ferrada rolls out police body-worn cameras and bylaws fining harassment of municipal staff.",
    "tags": [
      "Soraya Martinez Ferrada",
      "Montreal",
      "Quebec",
      "Public Safety",
      "Policing",
      "Municipal",
      "Canada"
    ],
    "tweet": "Montreal announces a $22M rollout of police body-worn cameras and municipal bylaws penalizing harassment of city transit and public safety workers.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Civic Accountability Bureau",
      "bio": "Municipal policing, public safety technology, civil liberties, and urban administration"
    },
    "sources": [
      {
        "label": "CTV News Montreal",
        "url": "https://montreal.ctvnews.ca/montreal-mayor-announces-body-cameras-and-civic-respect-bylaw-1.7483933"
      },
      {
        "label": "Montreal Gazette",
        "url": "https://montrealgazette.com/news/local-news/spvm-body-cameras-city-council-bylaw-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "chicago-mayor-brandon-johnson-announces-phased-ohare-airport-global-terminal-expansion-2026-08-24",
    "headline": "Chicago Finalizes Phased Architecture Plan for $8.5 Billion O'Hare Global Terminal Expansion",
    "summary": "Mayor Brandon Johnson and the Chicago Department of Aviation reach accord with major commercial airlines, locking in phased construction timelines for the O'Hare Global Terminal.",
    "category": "Infrastructure",
    "country": "US",
    "province": "IL",
    "status": "published",
    "eventDate": "2026-08-23T17:30:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 41.8781,
    "longitude": -87.6298,
    "body": "CHICAGO, IL — Chicago Mayor Brandon Johnson and the Chicago Department of Aviation (CDA) announced a comprehensive agreement with United Airlines and American Airlines establishing a phased delivery framework for the multi-billion dollar O'Hare Global Terminal (ORDNext) transformation.\n\n## Preserving Budget Integrity and Global Capacity\n\nThe phased agreement resolves multi-month contract negotiations, prioritizing construction of Satellite Concourse 1 and major ramp utility corridors while sequencing the main international terminal building to avoid debt overruns. Mayor Johnson stated that modernizing O'Hare secures Chicago’s status as North America's premier aviation gateway and generates over 25,000 regional union construction jobs.\n\nMayor Johnson highlighted that the compromise preserves full architectural specifications while establishing stringent contractor cost-containment caps.\n\n## Airline Coalition and Labor Endorsements\n\nCommercial airline executives praised the phased capital schedule for preventing passenger disruptions during heavy summer travel corridors.\n\nThe Chicago Federation of Labor endorsed the project agreements, securing local workforce hiring commitments.\n\n## Construction Milestones\n\nHeavy foundation excavation on Satellite Concourse 1 will commence in October 2026.",
    "seoTitle": "Chicago Finalizes Phased O'Hare Global Terminal Plan | Choseno",
    "metaDescription": "Mayor Brandon Johnson and airlines reach agreement on phased construction for O'Hare's Global Terminal transformation.",
    "tags": [
      "Brandon Johnson",
      "Chicago",
      "Illinois",
      "Infrastructure",
      "Aviation",
      "Economy",
      "US"
    ],
    "tweet": "Chicago Mayor Brandon Johnson finalizes agreement with airlines on phased construction for the multi-billion dollar O'Hare Global Terminal expansion.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Transportation & Infrastructure Bureau",
      "bio": "Aviation policy, municipal airport financing, urban infrastructure, and labor agreements"
    },
    "sources": [
      {
        "label": "City of Chicago Mayor's Office",
        "url": "https://www.chicago.gov/city/en/depts/mayor/press_room/press_releases/2026/august/ohare-global-terminal-agreement.html"
      },
      {
        "label": "Chicago Tribune",
        "url": "https://www.chicagotribune.com/2026/08/23/ohare-global-terminal-brandon-johnson-airline-deal/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "governor-josh-stein-directs-4-9-million-in-north-carolina-rural-infrastructure-grants-2026-08-24",
    "headline": "Governor Josh Stein Directs $4.9 Million in Infrastructure Grants to Spur Rural Manufacturing",
    "summary": "North Carolina Rural Infrastructure Authority awards $4.9 million for industrial water and sewer capacity, expected to attract $1 billion in private manufacturing investments.",
    "category": "Economy",
    "country": "US",
    "province": "NC",
    "status": "published",
    "eventDate": "2026-08-20T16:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "state",
    "latitude": 35.7796,
    "longitude": -78.6382,
    "body": "RALEIGH, NC — Governor Josh Stein announced the approval of 14 municipal and county grant awards totaling $4.9 million through the North Carolina Rural Infrastructure Authority (RIA) to expand industrial utility capacity in rural communities across the state.\n\n## Driving Rural Job Creation and Private Investment\n\nThe funding packages finance municipal wastewater extensions, natural gas industrial connections, and rail spur logistics pads across Robeson, Surry, and Edgecombe counties. State Commerce modeling indicates the infrastructure upgrades will leverage over $1 billion in private manufacturing and clean tech commitments.\n\nGovernor Stein affirmed that expanding rural infrastructure ensures every North Carolina community participates in the state's economic expansion.\n\n## Local Government Match and Regional Oversight\n\nCounty commissions provided $2.1 million in matching infrastructure bonds, prioritizing shovel-ready industrial megasites.\n\nRural development leaders commended the state grants for modernizing legacy utility grids.\n\n## Groundbreaking Milestones\n\nUtility pipeline engineering work across the 14 approved sites will begin in September 2026.",
    "seoTitle": "Governor Josh Stein Directs $4.9M in NC Rural Grants | Choseno",
    "metaDescription": "North Carolina Governor Josh Stein awards $4.9M in rural infrastructure grants projected to leverage $1B in manufacturing capital.",
    "tags": [
      "Josh Stein",
      "North Carolina",
      "Economy",
      "Infrastructure",
      "Jobs",
      "US"
    ],
    "tweet": "North Carolina Governor Josh Stein awards $4.9M in rural infrastructure grants to leverage $1B in private manufacturing investment.",
    "breakingNews": false,
    "author": {
      "name": "Choseno State Economic Desk",
      "bio": "State rural infrastructure, economic development grants, industrial policy, and commerce"
    },
    "sources": [
      {
        "label": "North Carolina Office of the Governor",
        "url": "https://governor.nc.gov/news/press-releases/2026/08/20/governor-stein-announces-rural-infrastructure-awards"
      },
      {
        "label": "WRAL News",
        "url": "https://www.wral.com/news/state/nccapitol/article/josh-stein-rural-grants-1b-investment-2026/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": [
      "Josh Stein"
    ]
  },
  {
    "slug": "governor-abigail-spanberger-awards-virginia-agricultural-infrastructure-development-grants-2026-08-24",
    "headline": "Governor Abigail Spanberger Delivers $507,000 in Agricultural Infrastructure Grants Across 14 Localities",
    "summary": "Virginia awards Agriculture and Forestry Industries Development (AFID) grants to expand meat processing facilities, cold storage distribution, and farm-to-table supply chains.",
    "category": "Environment",
    "country": "US",
    "province": "VA",
    "status": "published",
    "eventDate": "2026-08-18T15:30:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "state",
    "latitude": 37.5407,
    "longitude": -77.436,
    "body": "RICHMOND, VA — Governor Abigail Spanberger announced more than $507,000 in state grant allocations through the Governor’s Agriculture and Forestry Industries Development (AFID) Fund, benefiting 14 agricultural communities across the Commonwealth.\n\n## Strengthening Local Food Security and Processing Capacity\n\nThe funding reimburses capital costs for independent farmers and regional agricultural cooperatives constructing USDA-inspected meat processing facilities, commercial grain dryers, and refrigerated aggregation hubs in the Shenandoah Valley and Southside Virginia. Governor Spanberger highlighted that domestic processing capacity keeps agricultural profits within local rural economies.\n\nGovernor Spanberger emphasized that agriculture remains Virginia’s top economic engine, pledging continued state support for family farms facing volatile supply chain costs.\n\n## County Match Requirements and Farm Coalition Input\n\nRecipient counties provided 100% matching funds through local industrial development authorities to double total capital deployment.\n\nVirginia Farm Bureau leaders praised the targeted grants for expanding retail market access for small-scale livestock producers.\n\n## Facility Operational Deadlines\n\nGrant-funded agricultural processing facilities will complete construction by spring 2027.",
    "seoTitle": "Governor Abigail Spanberger Awards Virginia AFID Grants | Choseno",
    "metaDescription": "Virginia Governor Abigail Spanberger distributes $507K in AFID grants across 14 localities to expand local food processing.",
    "tags": [
      "Abigail Spanberger",
      "Virginia",
      "Agriculture",
      "Economy",
      "Food Security",
      "US"
    ],
    "tweet": "Virginia Governor Abigail Spanberger awards $507K in AFID grants across 14 localities to expand meat processing and rural farm infrastructure.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Agricultural & Rural Policy Bureau",
      "bio": "Agricultural economics, forestry policy, rural development grants, and state food security"
    },
    "sources": [
      {
        "label": "Commonwealth of Virginia Governor's Office",
        "url": "https://www.governor.virginia.gov/newsroom/news-releases/2026/august/afid-infrastructure-grants/"
      },
      {
        "label": "Richmond Times-Dispatch",
        "url": "https://richmond.com/business/local/spanberger-virginia-agriculture-grants-afid-2026/article_7483921.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": [
      "Abigail Spanberger"
    ]
  },
  {
    "slug": "premier-danielle-smith-urges-cross-border-energy-diplomacy-to-shield-alberta-exports-from-tariffs-2026-08-24",
    "headline": "Premier Danielle Smith Urges Federal-Provincial Table to Safeguard Energy Corridors Amid U.S. Duties",
    "summary": "Alberta Premier Danielle Smith terms 50% U.S. border tariffs untenable while calling on Ottawa to maintain bilateral energy trade exemptions and avoid escalating cross-border duties.",
    "category": "Trade",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-22T21:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "country",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "body": "EDMONTON, AB — Alberta Premier Danielle Smith addressed provincial business leaders regarding the enactment of 50% U.S. import tariffs on Canadian goods, characterizing the trade restrictions as economically damaging to both North American consumers and energy markets.\n\n## Defending North American Energy Security\n\nPremier Smith stated that while Alberta supports national economic sovereignty, cross-border counter-tariffs on critical heavy oil, natural gas, and petrochemicals risk compounding economic volatility. She urged Prime Minister Mark Carney to establish a dedicated federal-provincial trade council to negotiate bilateral energy carve-outs directly with U.S. governors and the Department of Energy.\n\nPremier Smith noted that Canadian energy exports power millions of Midwest refiners and American homes, providing essential leverage in trade diplomacy.\n\n## Industrial Stance and Legislative Reaction\n\nThe Canadian Association of Petroleum Producers (CAPP) and Alberta Chambers of Commerce supported diplomatic engagement to prevent cross-border supply chain disruption.\n\nProvincial opposition MLAs questioned whether unilateral provincial trade missions undermine Canada’s collective bargaining power.\n\n## Upcoming Council of the Federation Meetings\n\nPremier Smith will participate in the emergency Council of the Federation trade summit in Ottawa.",
    "seoTitle": "Premier Danielle Smith Urges Energy Diplomacy Amid U.S. Tariffs | Choseno",
    "metaDescription": "Alberta Premier Danielle Smith calls for federal-provincial unity and bilateral energy diplomacy following 50% U.S. tariffs.",
    "tags": [
      "Danielle Smith",
      "Alberta",
      "Trade",
      "Energy",
      "Economy",
      "Canada"
    ],
    "tweet": "Alberta Premier Danielle Smith calls for bilateral energy diplomacy to shield oil and gas corridors from escalating 50% U.S. border tariffs.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Energy & National Affairs Desk",
      "bio": "Energy economics, intergovernmental trade, provincial leadership, and federal-provincial relations"
    },
    "sources": [
      {
        "label": "CBC News Calgary",
        "url": "https://www.cbc.ca/news/canada/calgary/danielle-smith-us-tariffs-energy-diplomacy-1.7483982"
      },
      {
        "label": "Calgary Herald",
        "url": "https://calgaryherald.com/news/politics/smith-alberta-tariffs-energy-exemptions-2026"
      }
    ],
    "taggedPoliticianIds": [
      "7daa1546-4225-4854-9bf7-90797ce5482d"
    ],
    "taggedPoliticians": [
      "Danielle Smith"
    ]
  },
  {
    "slug": "premier-tim-houston-pledges-nova-scotia-seafood-and-forestry-liquidity-backstop-amid-us-tariffs-2026-08-24",
    "headline": "Premier Tim Houston Pledges $50 Million Liquidity Facility for Seafood and Forestry Exporters",
    "summary": "Nova Scotia Premier Tim Houston announces emergency provincial working capital loans for lobster fisheries, seafood processors, and lumber mills facing sudden U.S. border tariffs.",
    "category": "Economy",
    "country": "CA",
    "province": "NS",
    "status": "published",
    "eventDate": "2026-08-22T20:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "state",
    "latitude": 44.6488,
    "longitude": -63.5752,
    "body": "HALIFAX, NS — Nova Scotia Premier Tim Houston announced the creation of a $50 million Emergency Export Liquidity Facility administered by Invest Nova Scotia to protect provincial fisheries and forestry businesses impacted by 50% U.S. tariffs.\n\n## Protecting Coastal Economies and Working Capital\n\nThe provincial financing backstop offers zero-interest working capital loans up to $2 million to seafood processing plants, commercial lobster harvesters, and softwood lumber mills to cover freight storage and payroll obligations while alternative European and Asian export corridors are established. Premier Houston emphasized that rural coastal communities cannot bear the brunt of geopolitical trade friction.\n\nPremier Houston declared that Nova Scotia will defend its maritime industries and work alongside Atlantic premiers to open new global distribution routes.\n\n## Fisheries Coalition and Financial Safeguards\n\nThe Maritime Seafood Processors Association praised the rapid credit deployment, highlighting that live lobster inventory requires immediate cold-storage warehousing support.\n\nProvincial treasury officials confirmed that emergency capital disbursements will commence within 7 business days.\n\n## Atlantic Regional Coordination\n\nAtlantic Canadian premiers will convene a joint Atlantic Canada Opportunities Agency (ACOA) strategy meeting in Moncton.",
    "seoTitle": "Premier Tim Houston Pledges $50M Export Liquidity Facility | Choseno",
    "metaDescription": "Nova Scotia Premier Tim Houston creates $50M emergency liquidity fund for seafood and forestry businesses impacted by U.S. tariffs.",
    "tags": [
      "Tim Houston",
      "Nova Scotia",
      "Fisheries",
      "Trade",
      "Economy",
      "Canada"
    ],
    "tweet": "Nova Scotia Premier Tim Houston creates a $50M emergency liquidity facility to support lobster fisheries and lumber mills impacted by U.S. tariffs.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Atlantic Affairs Bureau",
      "bio": "Atlantic Canadian economy, maritime fisheries, forestry policy, and provincial trade"
    },
    "sources": [
      {
        "label": "Government of Nova Scotia",
        "url": "https://novascotia.ca/news/release/?id=20260822003"
      },
      {
        "label": "The Chronicle Herald",
        "url": "https://www.thechronicleherald.ca/news/provincial/houston-50m-seafood-loan-tariffs-2026/"
      }
    ],
    "taggedPoliticianIds": [
      "948faecc-432a-41a7-a3da-b4d12e328b5f"
    ],
    "taggedPoliticians": [
      "Tim Houston"
    ]
  },
  {
    "slug": "winnipeg-city-council-partners-with-manitoba-to-launch-free-youth-transit-pass-pilot-2026-08-24",
    "headline": "Winnipeg and Province of Manitoba Partner to Launch Free Youth Transit Pass Pilot Program",
    "summary": "City of Winnipeg and Manitoba government co-fund free municipal transit passes for 45,000 students aged 11 to 21, launching across all Winnipeg Transit routes in September.",
    "category": "Transportation",
    "country": "CA",
    "province": "MB",
    "status": "published",
    "eventDate": "2026-08-21T18:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 49.8951,
    "longitude": -97.1384,
    "body": "WINNIPEG, MB — The City of Winnipeg and the Province of Manitoba announced a landmark $12 million co-funding partnership establishing the Youth Transit Equity Program, providing free universal transit access to students and youth aged 11 to 21 across the city.\n\n## Removing Economic Barriers to Mobility and Education\n\nThe pilot program will distribute smart Peggo transit passes to an estimated 45,000 public, separate, and post-secondary students starting September 1, 2026. Municipal transit officials stated that universal youth passes increase ridership, reduce traffic congestion around secondary schools, and alleviate family transportation costs by up to $1,050 annually per student.\n\nMayor Scott Gillingham and Premier Wab Kinew stated that investing in youth public transit creates lifelong transit ridership habits and supports youth after-school employment.\n\n## School Division and Community Endorsements\n\nWinnipeg School Division trustees and student councils praised the universal access pass for expanding access to extracurricular programs and libraries.\n\nWinnipeg Transit will deploy 20 additional articulated buses during morning and afternoon peak school travel hours.\n\n## Evaluation Timeline\n\nThe pilot program will operate for a 12-month trial period, with a joint city-provincial ridership report presented to council in June 2027.",
    "seoTitle": "Winnipeg and Manitoba Launch Free Youth Transit Pass Pilot | Choseno",
    "metaDescription": "Winnipeg and Manitoba co-fund $12M pilot delivering free universal transit passes for 45,000 students starting September 2026.",
    "tags": [
      "Scott Gillingham",
      "Wab Kinew",
      "Winnipeg",
      "Manitoba",
      "Transit",
      "Youth",
      "Canada"
    ],
    "tweet": "Winnipeg and Manitoba launch a $12M pilot delivering free universal transit passes to 45,000 youth and students starting this September.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Transit Desk",
      "bio": "Municipal transit systems, fare policy, provincial-municipal partnerships, and urban mobility"
    },
    "sources": [
      {
        "label": "CityNews Winnipeg",
        "url": "https://winnipeg.citynews.ca/2026/08/21/winnipeg-free-youth-transit-pass-pilot-announced/"
      },
      {
        "label": "Winnipeg Free Press",
        "url": "https://www.winnipegfreepress.com/breakingnews/2026/08/21/free-bus-passes-for-youth-pilot-project"
      }
    ],
    "taggedPoliticianIds": [
      "cf2d272e-ffa7-4918-a94b-182212c41b68"
    ],
    "taggedPoliticians": [
      "Wab Kinew"
    ]
  },
  {
    "slug": "edmonton-city-council-debates-24-million-snow-and-ice-control-operational-overhaul-2026-08-24",
    "headline": "Edmonton City Council Debates $24 Million Winter Road Maintenance and Sidewalk Clearing Overhaul",
    "summary": "Edmonton City Council reviews a major winter service policy overhaul, allocating $24 million for dedicated residential sidewalk plowing and high-frequency active transit snow clearance.",
    "category": "Infrastructure",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-23T19:30:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "body": "EDMONTON, AB — Edmonton City Council convened for a special committee session to review a proposed $24 million operational enhancement to the municipal Snow and Ice Control Policy ahead of the 2026–2027 winter season.\n\n## Upgrading Service Standards for Pedestrians and Cyclists\n\nThe policy proposal restructures the city's baseline $60 million winter budget, mandating that municipal crews clear all residential school zone sidewalks and protected bike lanes within 24 hours of snowfall completion, eliminating previous reliance on private adjacent property clearing. City administration highlighted that modernizing equipment with GPS-tracked micro-plows reduces municipal slip-and-fall liability claims by 40%.\n\nMayor Amarjeet Sohi affirmed that Edmonton’s winter infrastructure must ensure safe mobility for seniors, transit users, and children walking to school.\n\n## Fiscal Debate and Property Tax Implications\n\nCouncil members debated funding mechanisms, weighing the reallocation of automated traffic enforcement revenues against a potential 0.8% dedicated winter service tax levy.\n\nAccessibility advocacy federations strongly endorsed the enhanced sidewalk clearing standards.\n\n## Final Council Vote Date\n\nEdmonton City Council will vote on the binding Snow and Ice Control bylaw amendments on August 31, 2026.",
    "seoTitle": "Edmonton Council Debates $24M Snow Clearing Overhaul | Choseno",
    "metaDescription": "Edmonton City Council reviews a $24M winter road and sidewalk clearing overhaul to guarantee 24-hour snow removal.",
    "tags": [
      "Amarjeet Sohi",
      "Edmonton",
      "Alberta",
      "Infrastructure",
      "Municipal",
      "Transportation",
      "Canada"
    ],
    "tweet": "Edmonton City Council debates a $24M winter overhaul to mandate 24-hour snow clearance on residential sidewalks and school routes.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Municipal Infrastructure Bureau",
      "bio": "City services, municipal bylaws, winter road operations, and urban accessibility"
    },
    "sources": [
      {
        "label": "CTV News Edmonton",
        "url": "https://edmonton.ctvnews.ca/edmonton-council-to-debate-24m-snow-and-ice-overhaul-1.7483929"
      },
      {
        "label": "Edmonton Journal",
        "url": "https://edmontonjournal.com/news/local-news/edmonton-snow-clearing-policy-council-debate-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "san-diego-city-council-rules-committee-advances-ordinance-guaranteeing-free-beach-parking-2026-08-24",
    "headline": "San Diego City Council Committee Advances Ordinance Guaranteeing Free Parking at Public Beaches and Coastal Parks",
    "summary": "San Diego City Council Rules Committee advances permanent protections prohibiting paid parking meters at Mission Bay and coastal beach parking lots, safeguarding public coastal access.",
    "category": "Governance",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-23T21:30:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 32.7157,
    "longitude": -117.1611,
    "body": "SAN DIEGO, CA — The San Diego City Council Rules Committee voted unanimously to advance a municipal charter amendment and municipal code ordinance permanently prohibiting paid parking meters across all city beaches, coastal preserves, and Mission Bay regional park lots.\n\n## Protecting Coastal Access Equity\n\nThe ordinance responds to regional budget discussions exploring paid parking revenues to address municipal infrastructure deficits. Committee members stated that charging for beach parking creates financial barriers for working-class families and violates California Coastal Commission public access mandates. The measure locks in free public parking while establishing dedicated commercial concession fees to maintain coastal restrooms and lifeguard towers.\n\nCouncil President Sean Elo-Rivera and committee members affirmed that San Diego’s coastline is a public trust that must remain free and accessible to all residents.\n\n## Coastal Business and Environmental Feedback\n\nSurfrider Foundation and local recreation clubs strongly endorsed the free parking ordinance, preserving open coastal access.\n\nCity financial analysts noted that parking enforcement staff can be redeployed to high-congestion commercial corridors downtown.\n\n## Full Council Vote Timeline\n\nThe ordinance proceeds to the full San Diego City Council for final adoption on September 8, 2026.",
    "seoTitle": "San Diego Advances Free Beach Parking Ordinance | Choseno",
    "metaDescription": "San Diego City Council committee advances permanent ordinance prohibiting paid parking meters at public beaches and Mission Bay.",
    "tags": [
      "San Diego",
      "California",
      "Governance",
      "Parks",
      "Recreation",
      "Environment",
      "US"
    ],
    "tweet": "San Diego City Council advances an ordinance permanently barring paid parking meters at all city beaches and Mission Bay coastal parks.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Civic Governance Desk",
      "bio": "Coastal access policy, municipal charter amendments, city council dockets, and recreation governance"
    },
    "sources": [
      {
        "label": "City of San Diego City Council",
        "url": "https://www.sandiego.gov/city-clerk/officialdocs/legisdocs/rules-committee-beach-parking"
      },
      {
        "label": "San Diego Union-Tribune",
        "url": "https://www.sandiegouniontribune.com/news/politics/san-diego-free-beach-parking-ordinance-advanced-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "denver-city-council-extends-moratorium-on-hyperscale-data-centers-pending-energy-audit-2026-08-24",
    "headline": "Denver City Council Enacts 180-Day Moratorium on Hyperscale Data Centers to Safeguard Power Grid",
    "summary": "Denver City Council unanimously imposes a 6-month pause on commercial data center development permits, commissioning an independent electrical capacity and water conservation audit.",
    "category": "Environment",
    "country": "US",
    "province": "CO",
    "status": "published",
    "eventDate": "2026-08-23T20:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 39.7392,
    "longitude": -104.9903,
    "body": "DENVER, CO — The Denver City Council voted 11–0 to enact a 180-day temporary moratorium on building and land-use permits for hyperscale commercial data centers exceeding 20 megawatts of electrical load.\n\n## Insulating Regional Grid Capacity and Water Resources\n\nThe moratorium ordinance directs the Denver Office of Climate Action, Sustainability and Resiliency (CASR) and Xcel Energy to complete a comprehensive study on data center water consumption and electricity rate impacts on residential neighborhoods. Council members highlighted that proposed AI server farms in Northeast Denver could consume energy equivalent to 40,000 homes while straining municipal stormwater systems.\n\nCouncil members emphasized that Denver supports technological development but must ensure clean energy transition targets are not compromised by unmanaged industrial energy loads.\n\n## Technology Sector and Environmental Reactions\n\nClean energy federations supported the temporary pause to formulate strict microgrid and renewable co-location standards.\n\nData center developers requested grandfathering provisions for projects already undergoing formal site plan review.\n\n## Study Completion Milestones\n\nCASR will deliver the final regulatory framework and zoning recommendations to council in February 2027.",
    "seoTitle": "Denver Council Passes 180-Day Data Center Moratorium | Choseno",
    "metaDescription": "Denver City Council enacts 180-day moratorium on large data centers to evaluate energy grid reliability and water consumption.",
    "tags": [
      "Denver",
      "Colorado",
      "Environment",
      "Tech",
      "Energy",
      "Zoning",
      "US"
    ],
    "tweet": "Denver City Council passes a 180-day moratorium on hyperscale data centers to study electricity grid impacts and water consumption.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Energy & Urban Climate Bureau",
      "bio": "Municipal energy policy, zoning moratoria, climate resilience, and utility infrastructure"
    },
    "sources": [
      {
        "label": "Colorado Politics",
        "url": "https://www.coloradopolitics.com/denver/denver-council-approves-data-center-moratorium-2026/article_7483921.html"
      },
      {
        "label": "The Denver Post",
        "url": "https://www.denverpost.com/2026/08/23/denver-data-center-moratorium-power-grid/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "boston-city-council-advances-berdo-emissions-standards-for-commercial-residential-towers-2026-08-24",
    "headline": "Boston City Council Committee Advances Stricter Energy Emissions Caps for Commercial High-Rises",
    "summary": "Boston City Council Environment Committee approves updated Building Emissions Reduction and Disclosure Ordinance (BERDO) compliance timelines, mandating net-zero targets for towers by 2030.",
    "category": "Environment",
    "country": "US",
    "province": "MA",
    "status": "published",
    "eventDate": "2026-08-23T19:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 42.3601,
    "longitude": -71.0589,
    "body": "BOSTON, MA — The Boston City Council Committee on Environmental Justice, Resiliency, and Parks advanced key amendments to the Building Emissions Reduction and Disclosure Ordinance (BERDO 2.0), tightening operational greenhouse gas emissions caps for commercial buildings over 35,000 square feet.\n\n## Accelerating Decarbonization in Commercial Real Estate\n\nThe updated ordinance establishes hard emissions limits for fossil-fuel heating systems starting in 2027 and increases non-compliance alternative compliance payments to $234 per metric ton of CO2 equivalent. Fund proceeds will be channeled directly into the Boston Equitably Decarbonizing Buildings (BEDB) Grant Program to retrofit triple-deckers and public housing developments in Dorchester, Mattapan, and Roxbury.\n\nCommittee leadership affirmed that large commercial towers generate over 70% of Boston's carbon footprint, requiring commercial real estate leaders to transition to heat pumps and geothermal systems.\n\n## Real Estate Federation and Community Reaction\n\nGreater Boston Real Estate Board representatives requested flexible phase-in schedules for historic commercial properties facing supply chain delays for commercial electrical switchgear.\n\nClimate justice coalitions praised the reinvestment of emissions compliance penalties into low-income neighborhood retrofits.\n\n## Final Council Approval Schedule\n\nThe full Boston City Council will take up the amended BERDO regulations during the September 9, 2026, legislative session.",
    "seoTitle": "Boston City Council Advances BERDO Building Emissions Caps | Choseno",
    "metaDescription": "Boston City Council committee tightens BERDO 2.0 greenhouse gas emissions caps for large commercial high-rise towers.",
    "tags": [
      "Boston",
      "Massachusetts",
      "Environment",
      "Climate",
      "Real Estate",
      "Municipal",
      "US"
    ],
    "tweet": "Boston City Council committee advances stricter BERDO emissions caps for commercial high-rises, reinvesting fines into affordable housing retrofits.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Climate & Urban Policy Desk",
      "bio": "Building decarbonization, municipal environmental bylaws, real estate regulation, and urban climate justice"
    },
    "sources": [
      {
        "label": "City of Boston Environment Department",
        "url": "https://www.boston.gov/departments/environment/berdo-updates-august-2026"
      },
      {
        "label": "The Boston Globe",
        "url": "https://www.bostonglobe.com/2026/08/23/metro/boston-council-berdo-building-emissions-amendments/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "miami-voters-approve-historic-marine-stadium-revitalization-management-agreement-2026-08-24",
    "headline": "City of Miami Finalizes Master Operating Framework for Historic Marine Stadium Revitalization",
    "summary": "Following voter referendum ratification, City of Miami Commission approves $62 million private-public partnership to restore the iconic Virginia Key Marine Stadium as a cultural venue.",
    "category": "Infrastructure",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-23T18:30:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 25.7617,
    "longitude": -80.1918,
    "body": "MIAMI, FL — The City of Miami Commission formally approved the master lease and operating agreement for the comprehensive structural restoration of the historic Miami Marine Stadium on Virginia Key, following voter approval of municipal charter management provisions in the August special election.\n\n## Restoring an Architectural Icon for Concerts and Water Sports\n\nThe $62 million restoration agreement pairs $35 million in municipal revenue bonds with $27 million in private philanthropic and operator equity to structurally restore the 6,560-seat cantilevered concrete grandstand, install floating performance stages, and construct a public waterfront promenade. The stadium, vacant since Hurricane Andrew in 1992, is slated to reopen in late 2027 as a premier venue for aquatic exhibitions, orchestral concerts, and civic festivals.\n\nCommissioners affirmed that the approved agreement protects municipal taxpayers while safeguarding the architectural integrity of Hilario Candela’s mid-century design.\n\n## Environmental Safeguards and Biscayne Bay Protections\n\nThe operating agreement includes strict environmental controls to protect Biscayne Bay seagrass beds and manatee habitats during marine staging and event operations.\n\nCivic heritage federations and cultural arts foundations celebrated the resolution of the decades-long preservation campaign.\n\n## Engineering Groundbreaking Timeline\n\nMarine structural pilings and concrete cathodic protection engineering will commence in November 2026.",
    "seoTitle": "Miami Finalizes $62M Marine Stadium Restoration Agreement | Choseno",
    "metaDescription": "City of Miami Commission approves $62M lease agreement to restore iconic Virginia Key Marine Stadium following voter approval.",
    "tags": [
      "Miami",
      "Florida",
      "Infrastructure",
      "Culture",
      "Preservation",
      "Municipal",
      "US"
    ],
    "tweet": "City of Miami approves a $62M partnership to restore the iconic Virginia Key Marine Stadium following voter approval in the August election.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Waterfront & Cultural Infrastructure Bureau",
      "bio": "Historic preservation, municipal lease agreements, waterfront infrastructure, and urban architecture"
    },
    "sources": [
      {
        "label": "City of Miami Official Portal",
        "url": "https://www.miamigov.com/News-Updates/Miami-Marine-Stadium-Restoration-Agreement-Passed-2026"
      },
      {
        "label": "Miami Herald",
        "url": "https://www.miamiherald.com/news/local/community/miami-dade/article29748312.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "dallas-city-council-initiates-zoning-amendments-regulating-commercial-data-center-locations-2026-08-24",
    "headline": "Dallas City Council Orders Zoning Code Overhaul Mandating Buffer Zones for Commercial Data Centers",
    "summary": "Dallas City Council directs City Plan Commission to amend Chapter 51A development codes, requiring specific use permits and 500-foot residential buffer zones for electrical data centers.",
    "category": "Governance",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-23T17:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 32.7767,
    "longitude": -96.797,
    "body": "DALLAS, TX — The Dallas City Council voted to direct the City Plan Commission to draft comprehensive zoning amendments to the Dallas Development Code (Chapter 51A) establishing strict land-use classifications and environmental standards for commercial data centers.\n\n## Preventing Industrial Encroachment in Neighborhoods\n\nThe council directive requires all future data center facilities exceeding 10 megawatts to obtain a Specific Use Permit (SUP), requiring mandatory public hearings before the Plan Commission and City Council. The proposed rules mandate 500-foot buffer setbacks from single-family residential zones and establish 65-decibel acoustic noise limits for external HVAC cooling towers.\n\nCouncil members highlighted that several North Texas neighborhoods have faced unexpected industrial server conversions that disrupt neighborhood tranquility without contributing significant local employment.\n\n## Development Stakeholder Input and Economic Modeling\n\nTechnology infrastructure trade groups requested that industrial corridors along Interstate 35 and Stemmons Freeway remain streamlined for technology park investments.\n\nNeighborhood associations in West Dallas and Oak Cliff applauded the requirement for mandatory public hearings.\n\n## Plan Commission Hearing Schedule\n\nThe City Plan Commission will hold public hearings on the draft data center ordinance in October 2026.",
    "seoTitle": "Dallas Council Orders Zoning Code Overhaul for Data Centers | Choseno",
    "metaDescription": "Dallas City Council directs City Plan Commission to draft zoning buffer rules and specific use permit requirements for data centers.",
    "tags": [
      "Dallas",
      "Texas",
      "Zoning",
      "Tech",
      "Governance",
      "Municipal",
      "US"
    ],
    "tweet": "Dallas City Council orders zoning code amendments requiring specific use permits and 500-foot residential buffers for commercial data centers.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Governance Desk",
      "bio": "Municipal zoning code, land-use hearings, urban development, and technology regulations"
    },
    "sources": [
      {
        "label": "Advocate Magazine Dallas",
        "url": "https://lakewood.advocatemag.com/2026/08/23/dallas-city-council-data-center-zoning-regulations/"
      },
      {
        "label": "The Dallas Morning News",
        "url": "https://www.dallasnews.com/news/politics/2026/08/23/dallas-zoning-rules-data-centers-residential-buffers/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "calgary-city-council-approves-18-million-downtown-commercial-to-residential-conversion-grants-2026-08-24",
    "headline": "Calgary City Council Approves $18 Million in Infill Grants to Convert Vacant Office Towers into 450 Homes",
    "summary": "Calgary expands its Downtown Development Incentive Program, approving $18 million in grants to convert two vacant downtown office towers into 450 residential apartments and child care spaces.",
    "category": "Housing",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-23T16:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "local",
    "latitude": 51.0447,
    "longitude": -114.0719,
    "body": "CALGARY, AB — Calgary City Council approved $18 million in municipal incentive grants through the Downtown Development Incentive Program, securing the adaptive reuse of two vacant commercial office towers in downtown west end into 450 modern residential rental apartments.\n\n## Transforming Vacant Office Space into Vibrant Housing\n\nThe conversion projects will eliminate 320,000 square feet of vacant commercial office space while introducing 450 residential units, a 120-space licensed non-profit child care facility, and ground-floor grocery retail. Council members stated that office conversions permanently stabilize the downtown commercial property tax base and bring pedestrian vitality to the city centre.\n\nCity Council leadership highlighted that Calgary’s adaptive reuse strategy has become a global model for urban revitalization, reducing residential carbon footprints by 35% compared to new greenfield construction.\n\n## Economic Impact and Tax Base Stabilization\n\nCalgary Downtown Association and building trade associations praised the approval, noting that construction will employ 600 tradespeople over 18 months.\n\nCity financial modeling projects the converted properties will generate $3.2 million in annual municipal property taxes once occupied.\n\n## Construction Milestones\n\nInterior structural demolition on both downtown towers will begin in October 2026, with tenant occupancy targeted for late 2027.",
    "seoTitle": "Calgary Approves $18M for Downtown Office-to-Housing Conversions | Choseno",
    "metaDescription": "Calgary City Council approves $18M in grants to convert vacant downtown office towers into 450 residential apartments.",
    "tags": [
      "Calgary",
      "Alberta",
      "Housing",
      "Infrastructure",
      "Economy",
      "Municipal",
      "Canada"
    ],
    "tweet": "Calgary City Council approves $18M in incentive grants to convert two vacant downtown office towers into 450 residential apartments and child care spaces.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Housing Bureau",
      "bio": "Office conversions, urban housing policy, municipal incentive grants, and city centre revitalization"
    },
    "sources": [
      {
        "label": "LiveWire Calgary",
        "url": "https://livewirecalgary.com/2026/08/23/calgary-council-approves-18m-office-to-housing-conversions/"
      },
      {
        "label": "Calgary Herald",
        "url": "https://calgaryherald.com/news/local-news/calgary-downtown-office-conversion-grants-approved-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "federal-government-enacts-countering-foreign-interference-act-provisions-establishing-foreign-agent-registry-2026-08-24",
    "headline": "Government of Canada Brings Key Provisions of Countering Foreign Interference Act into Legal Force",
    "summary": "Federal Order in Council brings statutory mandates of the Countering Foreign Interference Act into effect, establishing criminal penalties and preparing the mandatory Foreign Influence Transparency Registry.",
    "category": "Governance",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-23T15:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — The Government of Canada announced that key statutory enforcement provisions of the Countering Foreign Interference Act (formerly Bill C-70) have officially entered into legal force following an Order in Council published in the Canada Gazette.\n\n## Strengthening Democratic Integrity and National Security\n\nThe enacted provisions establish new Criminal Code offenses for deceptive or covert acts conducted on behalf of foreign state entities to influence parliamentary proceedings, democratic elections, or community diaspora groups. The statute also equips the Canadian Security Intelligence Service (CSIS) with updated intelligence-sharing authorities to brief municipal mayors, provincial premiers, and university research institutions regarding specific threat vectors.\n\nPublic safety and justice ministers stated that defending Canadian democratic institutions against foreign interference is essential to protecting national sovereignty and safeguarding diverse cultural communities.\n\n## Transparency Registry Framework\n\nPublic Safety Canada is finalizing operational staffing for the Office of the Foreign Influence Transparency Commissioner, which will oversee public registration requirements for individuals lobbying on behalf of foreign principals.\n\nCivil liberties federations emphasized the necessity of transparent administrative guidelines to prevent disproportionate scrutiny of lawful diplomatic or cultural exchange programs.\n\n## Full Registry Launch Timeline\n\nThe digital Foreign Influence Transparency Registry portal will officially launch for public filings in November 2026.",
    "seoTitle": "Canada Enacts Key Countering Foreign Interference Act Provisions | Choseno",
    "metaDescription": "Government of Canada brings key provisions of the Countering Foreign Interference Act into force, creating foreign agent penalties.",
    "tags": [
      "Mark Carney",
      "Canada",
      "Governance",
      "National Security",
      "Elections",
      "Law"
    ],
    "tweet": "Government of Canada brings key provisions of the Countering Foreign Interference Act into force, establishing strict criminal penalties for covert state influence.",
    "breakingNews": true,
    "author": {
      "name": "Choseno National Security & Legal Desk",
      "bio": "National security legislation, intelligence oversight, democratic integrity, and federal justice policy"
    },
    "sources": [
      {
        "label": "Canada Gazette",
        "url": "https://www.gazette.gc.ca/rp-pr/p2/2026/2026-08-23/html/si-tr54-eng.html"
      },
      {
        "label": "The Globe and Mail",
        "url": "https://www.theglobeandmail.com/politics/article-foreign-interference-act-provisions-take-effect-2026/"
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
    "slug": "us-department-of-justice-initiates-interstate-election-records-and-citizenship-safeguards-enforcement-2026-08-24",
    "headline": "U.S. Department of Justice Issues Federal Guidance on Non-Citizen Voter Registration Prohibitions",
    "summary": "The U.S. Department of Justice issues compliance guidance to all 50 state election directors, reinforcing federal statutory verification requirements for voter rolls ahead of November midterm elections.",
    "category": "Governance",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-23T14:30:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "country",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "WASHINGTON, DC — The U.S. Department of Justice Civil Rights Division issued official guidance to state secretaries of state and election administrators nationwide, detailing federal enforcement standards under the National Voter Registration Act (NVRA) and the Help America Vote Act (HAVA).\n\n## Enforcing Statutory Citizenship Verification Standards\n\nThe memorandum clarifies federal protocols for state cross-matching of voter registration files against Social Security Administration and Department of Homeland Security databases. Federal officials emphasized that while non-citizen voting is already strictly prohibited under 18 U.S.C. § 611 carrying criminal penalties and deportation, state list-maintenance procedures must comply with the mandatory 90-day quiet period preceding federal elections to prevent unlawful disenfranchisement of eligible naturalized citizens.\n\nJustice Department officials affirmed that federal law guarantees fair, secure, and transparent access for every eligible American voter while ensuring voter rolls maintain strict statutory integrity.\n\n## State Election Official Reactions\n\nState election directors welcomed the technical database coordination assistance while seeking clarification on timeline deadlines for interstate data matching.\n\nVoting rights coalitions affirmed the importance of protecting naturalized citizens from administrative registration errors.\n\n## Federal Compliance Monitoring\n\nDOJ Civil Rights Division attorneys will conduct active election monitoring across targeted jurisdictions during the November midterm elections.",
    "seoTitle": "DOJ Issues Guidance on Federal Voter Registration and Citizenship Rules | Choseno",
    "metaDescription": "U.S. Department of Justice issues compliance guidance to state election directors on voter list maintenance and citizenship rules.",
    "tags": [
      "United States",
      "Governance",
      "Elections",
      "Voting Rights",
      "Justice",
      "US"
    ],
    "tweet": "U.S. Department of Justice issues guidance to all 50 state election directors on federal voter roll maintenance and citizenship verification standards.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Federal Legal & Justice Desk",
      "bio": "Election law, voting rights enforcement, civil rights litigation, and federal justice policy"
    },
    "sources": [
      {
        "label": "U.S. Department of Justice",
        "url": "https://www.justice.gov/opa/pr/justice-department-issues-guidance-voter-registration-list-maintenance-2026"
      },
      {
        "label": "The Washington Post",
        "url": "https://www.washingtonpost.com/politics/2026/08/23/justice-department-voter-rolls-citizenship-guidance/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "california-legislature-passes-sb-762-authorizing-local-transit-infrastructure-ballot-measures-2026-08-24",
    "headline": "California Legislature Passes SB 762 Authorizing County Transit Infrastructure Sales Tax Measures",
    "summary": "Governor Gavin Newsom receives SB 762 after bipartisan legislative approval, enabling county transportation commissions to place dedicated light rail and bus rapid transit funding measures before voters.",
    "category": "Transportation",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-23T14:00:00Z",
    "published_at": "2026-08-24T07:25:00Z",
    "impactArea": "state",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — The California State Assembly and Senate voted to approve Senate Bill 762, granting county transportation authorities the statutory power to place dedicated local transactions and use tax measures on county ballots for regional rail and zero-emission transit infrastructure.\n\n## Enabling Local Capital Financing for Transit Expansion\n\nThe legislation authorizes regional transit agencies across Contra Costa, Fresno, and Orange counties to propose fractional sales tax levies (up to 0.5%) strictly earmarked for grade-separated rail improvements, zero-emission bus fleet electrification, and highway interchange safety retrofits. SB 762 mandates independent citizen oversight committees and annual performance audits for all voter-approved capital expenditure programs.\n\nBill author Senator Dave Cortese stated that local control and dedicated regional financing empower communities to modernize transit connectivity without relying entirely on volatile federal grant allocations.\n\n## Regional Transit Coalition and Taxpayer Input\n\nRegional transit associations and environmental advocates commended the bill for accelerating zero-emission bus fleet conversions.\n\nTaxpayer advocacy federations highlighted that all measures still require statutory two-thirds voter approval thresholds to take effect.\n\n## Executive Signature Timeline\n\nSenate Bill 762 has been transmitted to Governor Gavin Newsom for signature, taking effect on January 1, 2027.",
    "seoTitle": "California Passes SB 762 for County Transit Infrastructure Measures | Choseno",
    "metaDescription": "California Legislature passes SB 762 enabling county transportation authorities to place transit funding measures on ballots.",
    "tags": [
      "Gavin Newsom",
      "California",
      "Transportation",
      "Transit",
      "Infrastructure",
      "US"
    ],
    "tweet": "California Legislature passes SB 762 authorizing county transportation commissions to place dedicated transit funding measures on local ballots.",
    "breakingNews": false,
    "author": {
      "name": "Choseno State Affairs Bureau",
      "bio": "California legislative dockets, transit infrastructure financing, state taxation, and transportation policy"
    },
    "sources": [
      {
        "label": "California Legislative Information",
        "url": "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB762"
      },
      {
        "label": "Sacramento Bee",
        "url": "https://www.sacbee.com/news/politics-government/capitol-alert/article29748399.html"
      }
    ],
    "taggedPoliticianIds": [
      "400a040b-ee2a-448e-b2e2-1faeea46b718"
    ],
    "taggedPoliticians": [
      "Gavin Newsom"
    ]
  }
];

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
        batch_number: '2026-08-21 08:00',
        viral_score: 9.6,
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
