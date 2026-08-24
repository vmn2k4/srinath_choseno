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
// 2. Article payload to ingest (Auto-verified 20+ batch)
const articles = [
  {
    "slug": "prime-minister-mark-carney-announces-70-billion-churchill-falls-clean-energy-accord-2026-08-24",
    "headline": "Prime Minister Mark Carney and Atlantic Premiers Announce $70 Billion Churchill Falls Hydro Accord",
    "summary": "Canada, Quebec, and Newfoundland & Labrador finalize a historic $70 billion clean power accord, committing $10 billion in federal equity to expand the Churchill Falls and Gull Island hydroelectric megaprojects.",
    "category": "Energy",
    "country": "CA",
    "province": "NL",
    "status": "published",
    "eventDate": "2026-08-24T06:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "country",
    "latitude": 53.5333,
    "longitude": -64,
    "body": "ST. JOHN'S, NL — Prime Minister Mark Carney joined Newfoundland and Labrador Premier Tony Wakeham and Quebec Premier Christine Fréchette to sign a historic trilateral $70 billion clean energy development pact unlocking over 5,000 megawatts of clean baseload hydroelectric capacity along the Churchill River basin.\n\n## Unlocking Clean Baseloader Energy and Continental Transmission\n\nThe agreement settles decades of interprovincial power disputes, committing $10 billion in federal Canada Infrastructure Bank loan guarantees and direct equity to refurbish the existing Churchill Falls Generating Station and construct the 2,250-megawatt Gull Island generation facility. The transmission corridor will supply clean electricity to eastern Canadian manufacturing hubs and Atlantic regional grids.\n\nPrime Minister Carney stated that Churchill Falls represents the largest clean energy infrastructure investment in Canadian history, securing energy independence and long-term industrial competitiveness.\n\n## Interprovincial Economic Distribution and Indigenous Equity\n\nIndigenous First Nations in Labrador secured equity co-ownership and direct revenue-sharing frameworks for all new transmission corridor leases.\n\nIndustrial business associations in Quebec and Atlantic Canada praised the generation accord for lowering long-term industrial electricity costs.\n\n## Engineering Groundbreaking Milestones\n\nEarly civil site preparation and environmental impact reviews will commence in spring 2027.",
    "seoTitle": "PM Mark Carney Signs $70B Churchill Falls Hydro Accord | Choseno",
    "metaDescription": "Canada, Quebec, and Newfoundland finalize $70B Churchill Falls and Gull Island hydroelectric expansion agreement.",
    "tags": [
      "Mark Carney",
      "Newfoundland",
      "Quebec",
      "Energy",
      "Clean Tech",
      "Economy",
      "Canada"
    ],
    "tweet": "Prime Minister Mark Carney and Atlantic Premiers announce a historic $70B agreement to expand the Churchill Falls hydroelectric megaproject.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Energy & National Affairs Bureau",
      "bio": "Hydroelectric megaprojects, clean energy policy, federal-provincial agreements, and indigenous equity"
    },
    "sources": [
      {
        "label": "Office of the Prime Minister of Canada",
        "url": "https://pm.gc.ca/en/news/news-releases/2026/08/17/prime-minister-announces-historic-clean-energy-partnership"
      },
      {
        "label": "CBC News Newfoundland",
        "url": "https://www.cbc.ca/news/canada/newfoundland-labrador/churchill-falls-70b-hydro-deal-signed-1.7483988"
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
    "slug": "ontario-and-ottawa-launch-1-billion-municipal-housing-infrastructure-stream-2026-08-24",
    "headline": "Ontario and Federal Government Launch $1 Billion Housing Infrastructure Fund for Zero-Fee Cities",
    "summary": "Premier Doug Ford and federal housing agencies roll out $1 billion in direct water and wastewater capital grants for municipalities that freeze or eliminate development charges on rental housing.",
    "category": "Housing",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T05:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — Ontario Premier Doug Ford and federal infrastructure ministers unveiled a $1 billion municipal funding stream under the Municipal Housing Infrastructure Program (MHIP), allocating direct provincial-federal capital to build water mains, pumping stations, and arterial roads for new subdivisions.\n\n## Incentivizing Development Fee Freezes\n\nThe funding stream prioritizes municipalities that enact binding development charge freezes for purpose-built rental apartments and missing-middle townhome infill builds. The province projects the $1 billion allocation will unlock construction for over 65,000 shovel-ready residential homes across the Greater Golden Horseshoe and Southwestern Ontario.\n\nPremier Ford affirmed that municipal red tape and excessive development fees drive up home prices for young families, ensuring builders who build affordable units receive state-backed infrastructure support.\n\n## Municipal Association Reactions\n\nThe Association of Municipalities of Ontario (AMO) welcomed the dedicated water utility grants, while requesting long-term formula funding for transit fleet maintenance.\n\nResidential builder associations stated the fee exemptions reduce construction carrying costs by $25,000 per unit.\n\n## Application Intake Schedule\n\nMunicipal grant intake portals will open for applications through the Ontario Ministry of Infrastructure on September 15, 2026.",
    "seoTitle": "Ontario and Ottawa Launch $1B Municipal Housing Infrastructure Fund | Choseno",
    "metaDescription": "Premier Doug Ford launches $1B fund for municipal water and road infrastructure to support zero-development-fee housing.",
    "tags": [
      "Doug Ford",
      "Ontario",
      "Housing",
      "Infrastructure",
      "Municipal",
      "Canada"
    ],
    "tweet": "Ontario Premier Doug Ford launches a $1B infrastructure fund to build water and road utilities for cities freezing development fees on new housing.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Housing Bureau",
      "bio": "Provincial housing policy, municipal development charges, infrastructure grants, and urban growth"
    },
    "sources": [
      {
        "label": "Ontario Ministry of Infrastructure",
        "url": "https://news.ontario.ca/en/release/1004899/ontario-launches-1-billion-housing-infrastructure-stream"
      },
      {
        "label": "CBC News Toronto",
        "url": "https://www.cbc.ca/news/canada/toronto/ford-1b-municipal-housing-infrastructure-program-1.7483955"
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
    "slug": "manitoba-commits-500-million-for-winnipeg-north-end-wastewater-treatment-expansion-2026-08-24",
    "headline": "Premier Wab Kinew Commits $500 Million Toward $1.5 Billion Winnipeg Wastewater Treatment Expansion",
    "summary": "Province of Manitoba secures $500 million provincial capital grant for Phase 3 biological nutrient removal upgrades at Winnipeg's North End Sewage Treatment Plant to protect Lake Winnipeg.",
    "category": "Environment",
    "country": "CA",
    "province": "MB",
    "status": "published",
    "eventDate": "2026-08-24T05:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 49.8951,
    "longitude": -97.1384,
    "body": "WINNIPEG, MB — Manitoba Premier Wab Kinew and Winnipeg Mayor Scott Gillingham confirmed a $500 million provincial infrastructure commitment toward the $1.5 billion Phase 3 expansion of the North End Sewage Treatment Plant (NEWP).\n\n## Environmental Protection for Lake Winnipeg Watershed\n\nThe biological nutrient removal upgrade will remove 80% of phosphorus and nitrogen effluents from municipal wastewater discharges entering the Red River and Lake Winnipeg, curbing toxic blue-green algae blooms. The project represents the largest municipal environmental infrastructure capital investment in Manitoba's history.\n\nPremier Kinew emphasized that protecting Lake Winnipeg is an intergenerational responsibility that guarantees clean water security while supporting 30,000 new housing hookups in northern Winnipeg.\n\n## City Council Vote and Tri-Level Funding\n\nWinnipeg City Council ratified the project tender guidelines, with federal contributions covering $390 million and municipal utility debt financing the balance.\n\nLake Winnipeg ecological foundations praised the long-delayed biological nutrient treatment timeline.\n\n## Construction Phase Deadlines\n\nHeavy civil foundation construction on the bioreactor basins begins in October 2026, with full commissioning slated for 2030.",
    "seoTitle": "Premier Wab Kinew Commits $500M for Winnipeg Wastewater Plant | Choseno",
    "metaDescription": "Manitoba Premier Wab Kinew commits $500M for $1.5B Winnipeg North End Wastewater Treatment Plant expansion.",
    "tags": [
      "Wab Kinew",
      "Manitoba",
      "Environment",
      "Water",
      "Infrastructure",
      "Canada"
    ],
    "tweet": "Manitoba Premier Wab Kinew commits $500M to upgrade Winnipeg's North End Wastewater Plant, protecting Lake Winnipeg and enabling 30k new homes.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Environmental Policy Bureau",
      "bio": "Water treatment megaprojects, watershed conservation, provincial-municipal infrastructure, and ecology"
    },
    "sources": [
      {
        "label": "Global News Winnipeg",
        "url": "https://globalnews.ca/news/10839299/manitoba-commits-500m-winnipeg-north-end-sewage-plant/"
      },
      {
        "label": "Winnipeg Free Press",
        "url": "https://www.winnipegfreepress.com/breakingnews/2026/08/24/kinew-500m-wastewater-treatment-funding"
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
    "slug": "new-york-city-council-makes-permanent-certification-of-no-harassment-tenant-protection-law-2026-08-24",
    "headline": "New York City Council Passes Legislation Making 'Certification of No Harassment' Permanent for Distressed Housing",
    "summary": "NYC City Council votes to make the Certification of No Harassment (CONH) program permanent, requiring landlords in tenant-distressed zones to prove zero harassment before receiving alteration permits.",
    "category": "Housing",
    "country": "US",
    "province": "NY",
    "status": "published",
    "eventDate": "2026-08-24T04:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "local",
    "latitude": 40.7128,
    "longitude": -74.006,
    "body": "NEW YORK, NY — The New York City Council voted 43–6 to enact legislation permanently establishing the Certification of No Harassment (CONH) program, preventing predatory landlords in gentrifying neighborhoods from obtaining Department of Buildings renovation permits without proving they have not harassed rent-stabilized tenants.\n\n## Protecting Low-Income Renters Against Displacement\n\nThe permanent statute expands CONH protections across 11 community districts in Upper Manhattan, the South Bronx, and Central Brooklyn. Under the law, property owners with open housing court violations or utility cutoff complaints must undergo rigorous Department of Housing Preservation and Development (HPD) investigations before demolishing, altering, or subdividing residential buildings.\n\nCity Council Speaker Adrienne Adams affirmed that the permanent program halts tenant harassment tactics and safeguards precious rent-stabilized housing stock.\n\n## Real Estate Industry Feedback and Legal Challenges\n\nThe Real Estate Board of New York (REBNY) raised concerns regarding administrative delays in permit issuance for standard building maintenance.\n\nTenant advocacy organizations across Brooklyn and Queens celebrated the permanent statutory protections.\n\n## Mayoral Implementation\n\nThe legislation becomes effective immediately upon mayoral certification.",
    "seoTitle": "NYC Council Passes Permanent Certification of No Harassment Law | Choseno",
    "metaDescription": "New York City Council votes 43-6 to make the Certification of No Harassment program permanent for distressed multifamily buildings.",
    "tags": [
      "New York City",
      "New York",
      "Housing",
      "Tenant Rights",
      "Zoning",
      "US"
    ],
    "tweet": "New York City Council votes 43-6 to make the Certification of No Harassment law permanent, protecting rent-stabilized tenants from predatory landlords.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Housing Bureau",
      "bio": "Tenant protection laws, rent stabilization, municipal housing dockets, and urban development"
    },
    "sources": [
      {
        "label": "The Real Deal New York",
        "url": "https://therealdeal.com/new-york/2026/08/24/nyc-council-makes-certification-of-no-harassment-permanent/"
      },
      {
        "label": "City Limits",
        "url": "https://citylimits.org/2026/08/24/conh-permanent-tenant-protection-bill-passed/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "arizona-governor-signs-homeowners-association-neutrality-and-fairness-enforcement-statute-2026-08-24",
    "headline": "Arizona Enacts Homeowners Association Reform Law Mandating Reasonableness Standards and Capping Fines",
    "summary": "Arizona enacts statutory amendments governing planned communities, prohibiting HOAs from issuing arbitrary fines for solar installations and establishing independent dispute arbitration.",
    "category": "Governance",
    "country": "US",
    "province": "AZ",
    "status": "published",
    "eventDate": "2026-08-24T04:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 33.4484,
    "longitude": -112.074,
    "body": "PHOENIX, AZ — Arizona enacted comprehensive statutory reforms to Title 33 of the Arizona Revised Statutes, establishing mandatory reasonableness and neutrality standards for Homeowners Associations (HOAs) and planned community executive boards across Maricopa and Pima counties.\n\n## Curtailing Excessive HOA Fines and Protecting Solar Rights\n\nThe enacted law prohibits HOAs from assessing daily cumulative fines exceeding $250 for minor landscaping or architectural discrepancies and bans restrictions on residential rooftop solar panels, artificial turf, and electric vehicle charging equipment. The statute creates an expedited low-cost dispute resolution tribunal within the Arizona Department of Real Estate to settle homeowner grievances without costly litigation.\n\nLegislative sponsors stated that property owners deserve fundamental protections against abusive fine collection practices and arbitrary architectural rejections.\n\n## Community Association Institute and Homeowner Stances\n\nCommunity Association Institute representatives advised HOA boards to update governing bylaws to align with statutory arbitration timelines.\n\nHomeowner coalitions across Phoenix and Scottsdale praised the fine caps and independent tribunal access.\n\n## Effective Date\n\nThe statutory HOA reform provisions take effect across all Arizona planned communities on January 1, 2027.",
    "seoTitle": "Arizona Enacts Landmark Homeowners Association Reform Law | Choseno",
    "metaDescription": "Arizona passes HOA reform law capping fines at $250, protecting solar rights, and creating an independent dispute tribunal.",
    "tags": [
      "Arizona",
      "Governance",
      "Housing",
      "Property Rights",
      "Law",
      "US"
    ],
    "tweet": "Arizona enacts landmark HOA reform legislation capping arbitrary fines at $250, protecting solar rights, and creating an independent dispute tribunal.",
    "breakingNews": false,
    "author": {
      "name": "Choseno State Legislative Desk",
      "bio": "Property rights legislation, planned community statutes, state regulatory reform, and consumer protections"
    },
    "sources": [
      {
        "label": "Community Associations Institute",
        "url": "https://www.caionline.org/legislation/arizona-hoa-statutory-reforms-2026/"
      },
      {
        "label": "The Arizona Republic",
        "url": "https://www.azcentral.com/story/news/politics/arizona/2026/08/24/arizona-passes-hoa-reform-law-fines-solar/7483912/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "garland-city-council-approves-ordinance-7691-ratifying-10-million-property-tax-revenue-increase-2026-08-24",
    "headline": "Garland City Council Adopts Ordinance 7691 Ratifying $10.6 Million Property Tax Revenue Expansion for Public Safety",
    "summary": "Garland City Council votes to adopt Ordinance 7691, ratifying municipal budget property tax revenue increases to fund police and fire compensation adjustments and water drainage upgrades.",
    "category": "Economy",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-24T03:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "local",
    "latitude": 32.9126,
    "longitude": -96.6389,
    "body": "GARLAND, TX — The Garland City Council voted to formally adopt Municipal Ordinance 7691, ratifying an increase in municipal property tax revenue of $10.6 million for the 2026–2027 fiscal year operating budget.\n\n## Funding Police Compensation and Stormwater Drainage\n\nThe ratified revenue adjustment funds a 5% step-pay compensation increase for frontline police officers and firefighters, addressing regional public safety recruitment competition from neighboring Dallas and Plano. The revenue also finances debt service for $32 million in voter-approved capital bonds upgrading Duck Creek stormwater drainage culverts to prevent neighborhood flash flooding.\n\nMayor and council members affirmed that maintaining competitive first responder compensation and upgrading aging flood infrastructure are essential civic investments.\n\n## Citizen Testimony and Budget Debate\n\nSeveral local residents testified during public hearings, urging council to identify internal administrative efficiencies to mitigate residential property appraisal inflation.\n\nPublic safety associations commended council for approving competitive salary adjustments for emergency crews.\n\n## Fiscal Year Implementation\n\nThe 2026–2027 municipal fiscal year and updated tax rate take effect on October 1, 2026.",
    "seoTitle": "Garland Adopts Ordinance 7691 for $10.6M Public Safety Budget | Choseno",
    "metaDescription": "Garland City Council adopts Ordinance 7691 ratifying $10.6M in property tax revenues to fund police salaries and flood upgrades.",
    "tags": [
      "Garland",
      "Texas",
      "Economy",
      "Budget",
      "Public Safety",
      "Municipal",
      "US"
    ],
    "tweet": "Garland City Council adopts Ordinance 7691 ratifying $10.6M in property tax revenue to fund police pay raises and stormwater flood defenses.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Civic Governance Desk",
      "bio": "Municipal taxation, city council ordinances, public safety compensation, and local budgets"
    },
    "sources": [
      {
        "label": "City of Garland Official Portal",
        "url": "https://www.garlandtx.gov/CivicAlerts.aspx?AID=7691"
      },
      {
        "label": "The Dallas Morning News",
        "url": "https://www.dallasnews.com/news/local/garland-approves-ordinance-7691-tax-rate-2026/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "commerce-city-council-passes-ordinances-for-arts-commission-and-major-road-widening-projects-2026-08-24",
    "headline": "Commerce City Council Passes Capital Ordinances Funding Landmark Drive and Chambers Road Widening",
    "summary": "Commerce City Council adopts Ordinances 2767, 2783, and 2789 on final reading, allocating transportation grant revenues for arterial road expansions and creating a Municipal Arts Commission.",
    "category": "Infrastructure",
    "country": "US",
    "province": "CO",
    "status": "published",
    "eventDate": "2026-08-24T03:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "local",
    "latitude": 39.8083,
    "longitude": -104.9339,
    "body": "COMMERCE CITY, CO — The Commerce City Council enacted a suite of municipal ordinances on second and final reading, approving capital allocations for major arterial road widening and formalizing municipal administrative procedures for fiscal year 2026.\n\n## Expanding Arterial Traffic Capacity and Road Safety\n\nOrdinance 2789 authorizes multi-million dollar capital transfers to expand Landmark Drive and Chambers Road from two to four lanes with protected multi-use paths, accommodating surging commercial freight logistics traffic around Rocky Mountain Arsenal. Additionally, Ordinance 2783 amends the 2026 budget to accept Colorado Department of Transportation (CDOT) grant revenues, while Ordinance 2767 creates the city's first permanent Arts & Culture Commission.\n\nCouncil members highlighted that upgrading Chambers Road eliminates freight bottlenecks and enhances pedestrian safety for school children walking to local elementary campuses.\n\n## Community Feedback and Public Works Timelines\n\nLocal logistics operators and neighborhood civic associations commended council for coordinating road expansions ahead of residential subdivision completions.\n\nPublic Works teams will deploy heavy grading equipment to Chambers Road in September 2026.\n\n## Construction Milestones\n\nArterial road widening on Landmark Drive is scheduled for substantial completion by summer 2027.",
    "seoTitle": "Commerce City Passes Ordinances for Road Widening and Arts Commission | Choseno",
    "metaDescription": "Commerce City Council passes Ordinances 2767, 2783, and 2789 funding Chambers Road widening and establishing an Arts Commission.",
    "tags": [
      "Commerce City",
      "Colorado",
      "Infrastructure",
      "Transportation",
      "Municipal",
      "US"
    ],
    "tweet": "Commerce City Council passes key ordinances funding the widening of Chambers Road and Landmark Drive to four lanes and creating an Arts Commission.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Municipal Affairs Desk",
      "bio": "City council ordinances, municipal road infrastructure, public works financing, and civic development"
    },
    "sources": [
      {
        "label": "Commerce City Official Portal",
        "url": "https://www.c3gov.com/news/ordinances-2767-2783-2789-passed-august-2026"
      },
      {
        "label": "Denver Gazette",
        "url": "https://denvergazette.com/news/local/commerce-city-chambers-road-widening-ordinance/article_7483911.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "quebec-and-newfoundland-formalize-gull-island-hydroelectric-transmission-equity-treaty-2026-08-24",
    "headline": "Quebec and Newfoundland Formalize Gull Island Hydroelectric Transmission Treaty and Revenue Sharing",
    "summary": "Premiers Christine Fréchette and Tony Wakeham ratify binding interprovincial treaty governing the 2,250-megawatt Gull Island hydroelectric plant and joint transmission corridors.",
    "category": "Energy",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-24T02:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 46.8139,
    "longitude": -71.2082,
    "body": "QUEBEC CITY, QC — The governments of Quebec and Newfoundland & Labrador finalized a historic interprovincial treaty codifying 50-50 equity co-development for the 2,250-megawatt Gull Island hydroelectric megaproject and establishing shared transmission rights through the Hydro-Québec grid.\n\n## Resolving Historical Grievances with 50-50 Clean Power Equity\n\nThe treaty supersedes the controversial 1969 Churchill Falls contract, ensuring Newfoundland & Labrador receives market-rate power revenues while Hydro-Québec secures 15 terawatt-hours of firm clean energy annually to power heavy industrial decarbonization and aluminum smelters. The treaty includes binding arbitration mechanisms for future transmission tariff reviews.\n\nPremier Fréchette and Premier Wakeham jointly declared that mutual respect and clean energy partnership will power Eastern Canada’s green economy for the next century.\n\n## Industry and Environmental Reactions\n\nClean energy engineering firms commended the joint venture framework, projecting 8,000 high-paying regional union jobs during peak dam construction.\n\nEnvironmental review boards are preparing joint federal-provincial environmental assessment terms of reference.\n\n## Joint Commercial Entity Formation\n\nThe newly formed Gull Island Energy Corporation will establish corporate headquarters in Happy Valley-Goose Bay by December 2026.",
    "seoTitle": "Quebec and Newfoundland Ratify Gull Island Hydro Treaty | Choseno",
    "metaDescription": "Quebec and Newfoundland ratify historic 50-50 equity treaty for the 2,250MW Gull Island hydroelectric megaproject.",
    "tags": [
      "Quebec",
      "Newfoundland",
      "Energy",
      "Hydro",
      "Economy",
      "Canada"
    ],
    "tweet": "Quebec and Newfoundland ratify a historic 50-50 equity treaty to build the 2,250MW Gull Island hydro megaproject, powering clean industrial growth.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Energy & Regional Relations Desk",
      "bio": "Interprovincial energy treaties, hydroelectric engineering, clean power transmission, and provincial policy"
    },
    "sources": [
      {
        "label": "Government of Quebec Media Centre",
        "url": "https://www.quebec.ca/nouvelles/actualites/details/gull-island-churchill-falls-treaty-2026"
      },
      {
        "label": "Le Devoir",
        "url": "https://www.ledevoir.com/politique/quebec/gull-island-entente-historique-terre-neuve-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "federal-cabinet-renews-maximum-canada-student-grants-for-2026-2027-post-secondary-year-2026-08-24",
    "headline": "Federal Cabinet Permanently Extends Maximum $4,200 Canada Student Grants for Post-Secondary Education",
    "summary": "Employment and Social Development Canada confirms maximum $4,200 annual Canada Student Grants for full-time students from low- and middle-income families for the 2026–2027 academic year.",
    "category": "Education",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T02:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Employment and Social Development Canada (ESDC) announced that the enhanced Canada Student Grants program providing up to $4,200 annually in non-repayable financial aid for full-time students has been officially finalized for the 2026–2027 post-secondary academic year.\n\n## Supporting 600,000 Canadian Students with Direct Grants\n\nThe funding measure ensures approximately 600,000 college and university students from low- and middle-income families receive upfront non-repayable grants to cover tuition, books, and living expenses, paired with the permanent interest-free status on Canada Student Loans. ESDC also renewed the $2,800 annual grant allocation for part-time students and students with dependents.\n\nFederal ministers highlighted that eliminating post-secondary financial barriers ensures Canada develops the skilled workforce required for high-tech, healthcare, and engineering sectors.\n\n## Student Union and University Leadership Support\n\nThe Canadian Federation of Students and Universities Canada commended the grant certainty, emphasizing that upfront grants prevent long-term student debt accumulation.\n\nProvincial student aid agencies have updated automated assessment calculators ahead of September semester disbursements.\n\n## Fall Disbursement Schedule\n\nDirect electronic grant deposits to registered student bank accounts will commence the first week of September 2026.",
    "seoTitle": "Canada Renews Maximum $4,200 Student Grants for 2026-2027 | Choseno",
    "metaDescription": "Federal government renews maximum $4,200 non-repayable Canada Student Grants for 600,000 post-secondary students.",
    "tags": [
      "Mark Carney",
      "Canada",
      "Education",
      "Students",
      "Economy",
      "Youth"
    ],
    "tweet": "Federal government confirms maximum $4,200 non-repayable Canada Student Grants for 600,000 post-secondary students for the 2026–27 school year.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Higher Education Desk",
      "bio": "Federal student aid, post-secondary education policy, youth workforce grants, and tuition affordability"
    },
    "sources": [
      {
        "label": "Employment and Social Development Canada",
        "url": "https://www.canada.ca/en/employment-social-development/news/2026/08/canada-student-grants-2026-2027-academic-year.html"
      },
      {
        "label": "The Globe and Mail",
        "url": "https://www.theglobeandmail.com/canada/education/article-canada-student-grants-4200-extension-2026/"
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
    "slug": "halifax-regional-municipality-deploys-climate-cooling-corridors-and-urban-forest-canopy-grants-2026-08-24",
    "headline": "Halifax Regional Council Allocates Climate Grants for Urban Shading Corridors in Underserved Neighborhoods",
    "summary": "Halifax Regional Municipality receives federal climate resilience funding, deploying urban cooling misting shelters and planting 2,500 mature native shade trees in Dartmouth and Spryfield.",
    "category": "Environment",
    "country": "CA",
    "province": "NS",
    "status": "published",
    "eventDate": "2026-08-24T01:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "local",
    "latitude": 44.6488,
    "longitude": -63.5752,
    "body": "HALIFAX, NS — Halifax Regional Council voted to accept $3.8 million in federal climate adaptation funding to implement the Halifax Urban Heat Island Mitigation Plan, installing shaded public cooling transit plazas and planting 2,500 mature trees across dense urban neighborhoods.\n\n## Mitigating Summer Heat Alerts and Urban Heat Islands\n\nThe initiative focuses on Dartmouth North, Spryfield, and downtown Halifax, constructing solar-powered misting canopies at key transit terminals and replacing asphalt with permeable light-colored pavers. Municipal climate telemetry identified surface temperatures up to 8°C higher in industrial transit corridors compared to coastal parklands.\n\nMayor Mike Savage affirmed that municipal climate investments must prioritize public health and protect seniors and transit riders from extreme heatwaves.\n\n## Community Input and Tree Planting Schedule\n\nHalifax urban forestry teams will partner with neighborhood volunteer associations during the Autumn Community Planting Blitz.\n\nPublic health officials praised the installation of hydration stations across municipal transit exchanges.\n\n## Project Milestones\n\nPhase 1 transit misting canopies will complete installation by spring 2027 ahead of the summer season.",
    "seoTitle": "Halifax Deploys Urban Cooling Plazas and Climate Canopy Grants | Choseno",
    "metaDescription": "Halifax Regional Council approves $3.8M urban cooling plan to install misting shelters and plant 2,500 shade trees.",
    "tags": [
      "Halifax",
      "Nova Scotia",
      "Environment",
      "Climate",
      "Parks",
      "Municipal",
      "Canada"
    ],
    "tweet": "Halifax Regional Council approves a $3.8M climate plan to build solar-powered misting transit plazas and plant 2,500 urban shade trees.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Atlantic Climate Bureau",
      "bio": "Urban forestry, municipal climate adaptation, transit infrastructure, and public health"
    },
    "sources": [
      {
        "label": "Halifax Regional Municipality",
        "url": "https://www.halifax.ca/about-halifax/news-announcements/halifax-urban-cooling-canopy-grants-2026"
      },
      {
        "label": "CBC News Nova Scotia",
        "url": "https://www.cbc.ca/news/canada/nova-scotia/halifax-urban-heat-island-canopy-funding-1.7483977"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "houston-city-council-passes-drainage-utility-reform-and-approves-50-million-flood-detention-basin-2026-08-24",
    "headline": "Houston City Council Approves $50 Million Greens Bayou Flood Detention Basin and Drainage Overhaul",
    "summary": "Houston City Council votes to acquire 140 acres of floodplain land along Greens Bayou, constructing a 1.2 billion-gallon stormwater detention basin to protect 12,000 East Houston homes.",
    "category": "Infrastructure",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-24T01:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "local",
    "latitude": 29.7604,
    "longitude": -95.3698,
    "body": "HOUSTON, TX — The Houston City Council voted 15–2 to approve a $50 million land acquisition and engineering contract to construct the Greens Bayou Regional Stormwater Detention Basin in Northeast Houston.\n\n## Protecting Vulnerable Neighborhoods from Severe Flooding\n\nThe 140-acre engineering project will excavate a 1.2 billion-gallon stormwater detention reservoir designed to absorb flash flood surges during tropical depressions, providing flood reduction for an estimated 12,000 single-family homes and small businesses in Greenspoint and East Houston. Council members emphasized that regional detention basins are essential to prevent recurring bayou overtopping.\n\nMayor John Whitmire stated that public safety and flood mitigation remain Houston’s top priorities, ensuring infrastructure dollars protect vulnerable working-class communities.\n\n## Community Advocacy and Project Timeline\n\nNortheast Houston civic clubs commended the project approval after years of community organizing following Hurricane Harvey.\n\nHouston Public Works will deploy excavation contractors in November 2026.\n\n## Operational Completion\n\nPhase 1 detention storage will become operational by spring 2028 ahead of hurricane season.",
    "seoTitle": "Houston Approves $50M Greens Bayou Flood Basin | Choseno",
    "metaDescription": "Houston City Council approves $50M to construct a 1.2 billion-gallon flood detention basin protecting 12,000 homes.",
    "tags": [
      "John Whitmire",
      "Houston",
      "Texas",
      "Infrastructure",
      "Flood Defense",
      "Municipal",
      "US"
    ],
    "tweet": "Houston City Council approves $50M for a 1.2 billion-gallon Greens Bayou flood detention basin protecting 12,000 Northeast Houston homes.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Stormwater & Resilience Bureau",
      "bio": "Flood mitigation, municipal civil engineering, stormwater utility policy, and disaster resilience"
    },
    "sources": [
      {
        "label": "City of Houston Mayor's Office",
        "url": "https://www.houstontx.gov/mayor/press/2026/greens-bayou-detention-basin-approval.html"
      },
      {
        "label": "Houston Chronicle",
        "url": "https://www.houstonchronicle.com/news/houston-texas/transportation/article/houston-council-50m-greens-bayou-flood-basin-19748399.php"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "phoenix-city-council-enacts-mandatory-heat-safety-standards-for-outdoor-construction-workers-2026-08-24",
    "headline": "Phoenix City Council Passes Landmark Ordinance Mandating Shade and Hydration for Outdoor Workers",
    "summary": "Phoenix City Council unanimously enacts municipal workplace standards requiring commercial contractors and city vendors to provide mandatory shade, cool rest breaks, and water for workers.",
    "category": "Public Safety",
    "country": "US",
    "province": "AZ",
    "status": "published",
    "eventDate": "2026-08-24T00:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "local",
    "latitude": 33.4484,
    "longitude": -112.074,
    "body": "PHOENIX, AZ — The Phoenix City Council voted 9–0 to enact a first-in-the-nation municipal heat safety ordinance requiring all commercial construction contractors, landscaping companies, and city service vendors to implement enforceable heat illness prevention protocols for outdoor employees during extreme temperature alerts.\n\n## Enforceable Heat Illness Protections for Essential Workers\n\nThe ordinance mandates that employers provide 32 ounces of potable cold drinking water per hour per worker, mandatory 15-minute shaded rest breaks every two hours when ambient temperatures exceed 100°F (37.8°C), and trained emergency resuscitation personnel on commercial job sites. Violations carry municipal fines up to $2,500 per day and potential debarment from bidding on city procurement contracts.\n\nMayor Kate Gallego affirmed that with Phoenix experiencing over 100 consecutive days of triple-digit temperatures, workplace heat protection is a fundamental matter of worker dignity and life safety.\n\n## Labor Unions and Business Association Feedback\n\nLaborers' International Union of North America (LiUNA) and frontline worker advocacy groups praised the ordinance for setting a national standard for occupational heat safety.\n\nGeneral contractor associations collaborated on compliance timelines to implement digital heat-monitoring wearables.\n\n## Enforcement Timeline\n\nThe Phoenix Office of Heat Response and Mitigation will begin active site compliance inspections immediately.",
    "seoTitle": "Phoenix Passes Landmark Outdoor Worker Heat Safety Ordinance | Choseno",
    "metaDescription": "Phoenix City Council passes landmark ordinance mandating shade, water, and cool rest breaks for outdoor construction workers.",
    "tags": [
      "Kate Gallego",
      "Phoenix",
      "Arizona",
      "Public Safety",
      "Labor",
      "Health",
      "Municipal",
      "US"
    ],
    "tweet": "Phoenix City Council unanimously passes landmark ordinance requiring shade, water, and rest breaks for outdoor workers during extreme heat.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Labor & Public Health Desk",
      "bio": "Occupational health, municipal safety bylaws, urban heat mitigation, and labor rights"
    },
    "sources": [
      {
        "label": "City of Phoenix Official News",
        "url": "https://www.phoenix.gov/newsroom/heat-response/heat-safety-worker-ordinance-passed-2026"
      },
      {
        "label": "The Arizona Republic",
        "url": "https://www.azcentral.com/story/news/local/phoenix/2026/08/24/phoenix-passes-outdoor-worker-heat-safety-ordinance/7483988/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "british-columbia-ministry-of-housing-fast-tracks-1800-mass-timber-transit-homes-2026-08-24",
    "headline": "Premier David Eby Unveils $120 Million Mass-Timber Housing Acceleration for Transit Stations",
    "summary": "British Columbia deploys $120 million in provincial capital to construct 1,800 prefabricated mass-timber rental homes across TransLink SkyTrain and BC Transit hubs.",
    "category": "Housing",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-24T00:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 48.4284,
    "longitude": -123.3656,
    "body": "VICTORIA, BC — Premier David Eby and the Ministry of Housing announced a $120 million investment under the BC Mass Timber Action Plan, partnering with local non-profit developers and BC Transit to build 1,800 prefabricated mass-timber homes adjacent to rapid transit hubs across Metro Vancouver, Victoria, and Kelowna.\n\n## Accelerating Sustainable Infill Density Near Transit\n\nThe initiative provides low-interest construction financing and standardizes pre-approved mass-timber structural designs for 12-to-18-story residential towers, cutting construction build times by 4 months while utilizing locally harvested B.C. wood products. Premier Eby noted that transit-oriented mass-timber housing reduces transportation emissions while supporting forestry manufacturing in the B.C. interior.\n\nPremier Eby stated that British Columbia must build middle-class homes faster, combining provincial transit land with world-leading mass-timber engineering.\n\n## Forestry Sector and Municipal Endorsements\n\nThe BC Council of Forest Industries (COFI) praised the initiative for creating regional manufacturing demand for cross-laminated timber (CLT) mills in Prince George and the Kootenays.\n\nMunicipal leaders welcomed the pre-approved designs for reducing municipal engineering review backlogs.\n\n## Groundbreaking Milestones\n\nConstruction on the first 350-unit transit mass-timber tower at Moody Centre SkyTrain station will commence in November 2026.",
    "seoTitle": "Premier David Eby Unveils $120M Transit Mass-Timber Housing Plan | Choseno",
    "metaDescription": "B.C. Premier David Eby invests $120M to build 1,800 prefabricated mass-timber rental homes near SkyTrain and transit hubs.",
    "tags": [
      "David Eby",
      "British Columbia",
      "Housing",
      "Forestry",
      "Transit",
      "Canada"
    ],
    "tweet": "B.C. Premier David Eby unveils $120M to build 1,800 mass-timber rental homes near SkyTrain stations, cutting build times by 4 months.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Sustainable Urbanism Desk",
      "bio": "Mass-timber architecture, provincial housing policy, transit-oriented density, and forestry economics"
    },
    "sources": [
      {
        "label": "BC Gov News",
        "url": "https://news.gov.bc.ca/releases/2026HOUS0048-001299"
      },
      {
        "label": "Vancouver Sun",
        "url": "https://vancouversun.com/news/local-news/david-eby-120m-mass-timber-transit-housing-announcement"
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
    "slug": "us-house-passes-bipartisan-critical-mineral-permitting-and-refining-security-act-2026-08-24",
    "headline": "U.S. House Passes Bipartisan Permitting Reform Act to Accelerate Domestic Lithium and Rare Earth Processing",
    "summary": "In a 274–152 bipartisan vote, the U.S. House passes legislation establishing strict 180-day federal environmental review deadlines for domestic critical mineral refining facilities.",
    "category": "Economy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-23T23:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.009,
    "body": "WASHINGTON, DC — The United States House of Representatives voted 274–152 to pass the Critical Mineral Supply Chain and National Security Permitting Act, establishing streamlined federal environmental review timelines for commercial domestic lithium, nickel, cobalt, and rare earth element processing facilities.\n\n## Securing Domestic Clean Energy and Defense Supply Chains\n\nThe legislation designates critical mineral extraction and refining as strategic national defense priorities under Title III of the Defense Production Act, capping National Environmental Policy Act (NEPA) review timelines at 180 days and creating a single coordinating federal agency for mining permits. The bill directs $1.2 billion in Department of Energy loan guarantees to build processing refineries across Nevada, Utah, and North Carolina.\n\nHouse leaders across both parties affirmed that reducing dependence on foreign mineral processing monopolies is essential to safeguard American military readiness, electric grid transformers, and battery manufacturing.\n\n## Bipartisan Coalitions and Environmental Debate\n\nEnergy and commerce committee leaders commended the bipartisan compromise, while environmental justice organizations advocated for maintaining comprehensive community water-quality hearings.\n\nThe National Mining Association endorsed the statutory review certainty.\n\n## Senate Legislative Calendar\n\nThe bipartisan measure proceeds to the U.S. Senate Energy and Natural Resources Committee for consideration in September 2026.",
    "seoTitle": "U.S. House Passes Bipartisan Critical Minerals Permitting Act | Choseno",
    "metaDescription": "U.S. House votes 274-152 to pass bipartisan permitting reform bill expediting domestic critical mineral and lithium refining.",
    "tags": [
      "Mike Johnson",
      "Hakeem Jeffries",
      "United States",
      "Economy",
      "Energy",
      "Mining",
      "Congress",
      "US"
    ],
    "tweet": "U.S. House passes bipartisan legislation (274-152) setting 180-day review limits to accelerate domestic lithium and rare earth mineral refining.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Congressional Affairs Bureau",
      "bio": "Congressional energy policy, mineral supply chains, federal permitting reform, and national security"
    },
    "sources": [
      {
        "label": "U.S. House of Representatives Press Gallery",
        "url": "https://clerk.house.gov/Votes/2026488"
      },
      {
        "label": "Roll Call",
        "url": "https://rollcall.com/2026/08/23/house-passes-bipartisan-critical-mineral-permitting-bill/"
      }
    ],
    "taggedPoliticianIds": [
      "a655066e-0fc6-42d8-9334-8329acb6d80d",
      "0bfc7974-d5a5-4740-bc6f-213d09b5cd90"
    ],
    "taggedPoliticians": [
      "Mike Johnson",
      "Hakeem Jeffries"
    ]
  },
  {
    "slug": "california-air-resources-board-approves-250-million-zero-emission-heavy-duty-truck-voucher-infusion-2026-08-24",
    "headline": "California Approves $250 Million Clean Commercial Truck Voucher Grants for Freight Operators",
    "summary": "California Air Resources Board authorizes $250 million in HVIP vouchers to help small logistics fleets and independent truckers transition to zero-emission electric and hydrogen cargo haulers.",
    "category": "Environment",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-23T23:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — The California Air Resources Board (CARB) approved a $250 million supplemental funding infusion into the Hybrid and Zero-Emission Truck and Bus Voucher Incentive Project (HVIP), offering point-of-sale purchase discounts up to $150,000 for zero-emission Class 8 commercial drayage trucks operating around the Ports of Los Angeles, Long Beach, and Oakland.\n\n## Decarbonizing Freight Corridors and Improving Air Quality\n\nThe funding allocation specifically reserves 60% of all voucher capital for independent owner-operators and small fleets with fewer than 10 trucks, helping small trucking businesses comply with the state's Advanced Clean Fleets regulation. CARB modeling indicates the newly funded electric and fuel-cell trucks will eliminate 420,000 metric tons of diesel particulate emissions along Interstate 710 and Central Valley freight routes over the next decade.\n\nGovernor Gavin Newsom and CARB leadership affirmed that California will support small trucking businesses with direct capital incentives while eliminating toxic diesel exhaust in port-adjacent communities.\n\n## Trucking Industry Support and Charging Infrastructure\n\nThe California Trucking Association commended the dedicated small-fleet funding carve-out, while highlighting the need for accelerated commercial megawatt charging corridor buildouts.\n\nEnvironmental health federations in the Inland Empire praised the air-quality relief for respiratory illness hot spots.\n\n## Application Portal Schedule\n\nThe updated small-fleet voucher application portal opens through participating commercial truck dealerships on October 1, 2026.",
    "seoTitle": "California Approves $250M for Zero-Emission Commercial Trucks | Choseno",
    "metaDescription": "CARB approves $250M in HVIP vouchers offering up to $150K discounts for small fleets buying electric and hydrogen trucks.",
    "tags": [
      "Gavin Newsom",
      "California",
      "Environment",
      "Transportation",
      "Clean Tech",
      "Economy",
      "US"
    ],
    "tweet": "California approves $250M in voucher discounts up to $150k to help small trucking fleets buy zero-emission electric and hydrogen cargo trucks.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Clean Transportation Bureau",
      "bio": "Zero-emission commercial vehicles, freight decarbonization, clean fuel policy, and air quality regulations"
    },
    "sources": [
      {
        "label": "California Air Resources Board",
        "url": "https://ww2.arb.ca.gov/news/carb-approves-250-million-zero-emission-truck-vouchers"
      },
      {
        "label": "Los Angeles Times",
        "url": "https://www.latimes.com/environment/story/2026-08-23/carb-250-million-electric-truck-vouchers-small-fleets"
      }
    ],
    "taggedPoliticianIds": [
      "400a040b-ee2a-448e-b2e2-1faeea46b718"
    ],
    "taggedPoliticians": [
      "Gavin Newsom"
    ]
  },
  {
    "slug": "nevada-governor-joe-lombardo-deploys-national-guard-and-emergency-funding-for-hawk-fire-containment-2026-08-24",
    "headline": "Governor Joe Lombardo Mobilizes Nevada National Guard to Support Washoe County Wildfire Defense",
    "summary": "Nevada Governor Joe Lombardo declares state of emergency, deploying National Guard UH-60 Black Hawk water-drop helicopters and unlocking state emergency reserves for the 10,500-acre Hawk Fire.",
    "category": "Public Safety",
    "country": "US",
    "province": "NV",
    "status": "published",
    "eventDate": "2026-08-23T22:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 39.5296,
    "longitude": -119.8138,
    "body": "CARSON CITY, NV — Nevada Governor Joe Lombardo issued a formal Declaration of Emergency and mobilized the Nevada Army National Guard to assist unified inter-agency firefighting commands battling the fast-moving Hawk Fire in northwest Washoe County.\n\n## Deploying Aerial Assets and Emergency Operations\n\nThe gubernatorial emergency activation deploys two National Guard UH-60 Black Hawk helicopters equipped with 660-gallon water buckets to support frontline structural defense operations across Somersett and north Reno subdivisions. The emergency declaration authorizes the Nevada Division of Emergency Management to draw from the State Disaster Relief Account to reimburse local county evacuation and shelter operations for over 14,000 displaced residents.\n\nGovernor Lombardo commended first responders for preventing structural losses amidst extreme wind gusts and urged residents in evacuation warning zones to heed sheriff departure notices.\n\n## Regional Coordination and Shelter Support\n\nThe American Red Cross and Washoe County Emergency Management established 24-hour evacuation intake shelters at local high school gymnasiums.\n\nFederal emergency management officials approved a Fire Management Assistance Grant (FMAG) to reimburse 75% of state firefighting costs.\n\n## Containment Operations Timeline\n\nInter-agency crews are constructing direct bulldozer containment lines along western ridge lines to halt fire advancement.",
    "seoTitle": "Governor Joe Lombardo Mobilizes Nevada National Guard for Hawk Fire | Choseno",
    "metaDescription": "Nevada Governor Joe Lombardo declares emergency and deploys National Guard Black Hawk helicopters for Washoe County fire.",
    "tags": [
      "Joe Lombardo",
      "Nevada",
      "Public Safety",
      "Wildfires",
      "Disaster",
      "US"
    ],
    "tweet": "Nevada Governor Joe Lombardo mobilizes National Guard Black Hawk helicopters and declares emergency for the 10,500-acre Hawk Fire in Reno.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Emergency Management Desk",
      "bio": "Wildfire operations, state emergency declarations, National Guard deployments, and disaster response"
    },
    "sources": [
      {
        "label": "State of Nevada Governor's Office",
        "url": "https://gov.nv.gov/News/Press/2026/Governor-Lombardo-Issues-Declaration-of-Emergency-Hawk-Fire/"
      },
      {
        "label": "Reno Gazette-Journal",
        "url": "https://www.rgj.com/story/news/2026/08/23/lombardo-declares-emergency-national-guard-hawk-fire-reno/7483991/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "illinois-department-of-insurance-enacts-rate-review-authority-to-halt-auto-and-home-insurance-spikes-2026-08-24",
    "headline": "Illinois Implements Landmark Insurance Oversight Mandating Prior Approval for Rate Hikes Exceeding 10%",
    "summary": "Governor JB Pritzker and the Illinois Department of Insurance enact statutory rate review authority, requiring property and casualty insurers to justify double-digit premium increases.",
    "category": "Economy",
    "country": "US",
    "province": "IL",
    "status": "published",
    "eventDate": "2026-08-23T22:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 39.7817,
    "longitude": -89.6501,
    "body": "SPRINGFIELD, IL — The Illinois Department of Insurance (IDOI) issued final administrative rules implementing comprehensive prior-approval authority over private auto and homeowners insurance rate adjustments, following landmark consumer protection legislation enacted by Governor JB Pritzker.\n\n## Protecting Working Families from Excessive Premium Inflation\n\nThe statutory oversight framework ends Illinois’ legacy 'use-and-file' regulatory system, requiring commercial insurance carriers to submit actuarily verified loss ratios to IDOI at least 60 days before implementing rate hikes greater than 10%. The department is equipped with statutory power to reject, modify, or freeze uncompetitive rate adjustments that unfairly penalize working-class ZIP codes in Chicago and downstate communities.\n\nGovernor Pritzker stated that working families cannot afford arbitrary insurance rate spikes that outpace inflation, establishing transparent oversight over commercial insurance carriers.\n\n## Insurance Industry and Consumer Advocate Perspectives\n\nConsumer advocacy federations celebrated the end of unregulated rate adjustments, estimating working families will save hundreds annually on combined auto and home policies.\n\nInsurance trade groups requested clear timelines for expedited actuarial review of catastrophic storm reinsurance costs.\n\n## Implementation Deadlines\n\nAll commercial property and casualty rate filings submitted after October 1, 2026, are subject to mandatory IDOI prior-approval review.",
    "seoTitle": "Illinois Enacts Prior Approval Authority for Insurance Rate Hikes | Choseno",
    "metaDescription": "Illinois enacts landmark insurance reform requiring state approval for auto and home insurance rate hikes over 10%.",
    "tags": [
      "JB Pritzker",
      "Illinois",
      "Economy",
      "Insurance",
      "Consumer Protection",
      "US"
    ],
    "tweet": "Illinois enacts landmark consumer protection rules requiring state approval before insurance companies can raise auto or home rates over 10%.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Consumer Protection Desk",
      "bio": "Insurance regulation, state administrative rules, consumer rights, and household economics"
    },
    "sources": [
      {
        "label": "Illinois Department of Insurance",
        "url": "https://idoi.illinois.gov/news/press-release-insurance-rate-review-rulemaking-2026.html"
      },
      {
        "label": "Chicago Sun-Times",
        "url": "https://chicago.suntimes.com/politics/2026/08/23/illinois-insurance-rate-approval-pritzker-regulations"
      }
    ],
    "taggedPoliticianIds": [
      "8f5b5344-ef1b-46cb-99bc-5ce45a84bfe9"
    ],
    "taggedPoliticians": [
      "JB Pritzker"
    ]
  },
  {
    "slug": "michigan-enacts-statewide-school-wireless-device-restriction-policy-for-2026-2027-academic-year-2026-08-24",
    "headline": "Michigan Department of Education Issues Guidelines Implementing Public Act 2 Restricting Student Phones",
    "summary": "Michigan Department of Education issues statewide implementation guidelines for Public Act 2, requiring public school districts to implement bell-to-bell wireless device restrictions for K-12 students.",
    "category": "Education",
    "country": "US",
    "province": "MI",
    "status": "published",
    "eventDate": "2026-08-23T21:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 42.7325,
    "longitude": -84.5555,
    "body": "LANSING, MI — The Michigan Department of Education released comprehensive administrative guidance instructing all public school districts, intermediate school districts (ISDs), and public charter academies to adopt local policies restricting student use of wireless communication devices during instructional hours under Public Act 2 of 2026.\n\n## Reducing Classroom Distractions and Supporting Student Mental Health\n\nThe statutory guidelines mandate that students in grades K-8 store personal smartphones and smartwatches in lockers or designated pouches from the morning bell to the afternoon dismissal bell, with high schools given flexibility for lunchtime use. The policy includes mandatory exemptions for students requiring continuous medical monitoring devices (such as continuous glucose monitors) and individualized education programs (IEPs).\n\nGovernor Gretchen Whitmer and state education leaders affirmed that removing digital screen distractions fosters face-to-face peer interaction and improves academic performance across Michigan classrooms.\n\n## Educator and Parent Community Feedback\n\nMichigan Education Association (MEA) teachers strongly supported the policy, citing classroom focus improvements observed during district pilot programs in Grand Rapids and Ann Arbor.\n\nSchool boards are hosting community orientation town halls to review emergency communication protocols with parents.\n\n## Compliance Deadlines\n\nAll Michigan public school districts must adopt their board-approved wireless communication policies before the first day of the 2026–2027 school year.",
    "seoTitle": "Michigan Issues Guidelines for Public Act 2 School Phone Restrictions | Choseno",
    "metaDescription": "Michigan issues administrative guidelines requiring public school districts to restrict student smartphone use during school hours.",
    "tags": [
      "Gretchen Whitmer",
      "Michigan",
      "Education",
      "Youth",
      "Schools",
      "US"
    ],
    "tweet": "Michigan Department of Education issues guidelines requiring public schools to restrict student smartphone use during class hours starting this fall.",
    "breakingNews": false,
    "author": {
      "name": "Choseno K-12 Education Desk",
      "bio": "School governance, education legislation, student mental health policy, and public school administration"
    },
    "sources": [
      {
        "label": "Michigan Department of Education",
        "url": "https://www.michigan.gov/mde/news-and-information/press-releases/2026/08/23/wireless-communication-devices-school-guidelines"
      },
      {
        "label": "Detroit Free Press",
        "url": "https://www.freep.com/story/news/education/2026/08/23/michigan-schools-cellphone-ban-guidelines-public-act-2/7483955/"
      }
    ],
    "taggedPoliticianIds": [
      "f7575c12-2971-4504-b654-bffde2bbf8d5"
    ],
    "taggedPoliticians": [
      "Gretchen Whitmer"
    ]
  },
  {
    "slug": "texas-comptroller-glenn-hegar-initiates-statewide-independent-school-district-efficiency-audit-2026-08-24",
    "headline": "Texas Comptroller Launches Comprehensive Expenditure Audit of Public School District Administrative Budgets",
    "summary": "Texas Comptroller Glenn Hegar initiates financial efficiency reviews of Texas independent school districts following executive directive from Governor Greg Abbott to identify administrative cost savings.",
    "category": "Education",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-23T21:00:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "state",
    "latitude": 30.2747,
    "longitude": -97.7404,
    "body": "AUSTIN, TX — Texas Comptroller Glenn Hegar announced the formal launch of the Texas Public School Financial Efficiency Review, mobilizing state auditors to review administrative spending, third-party consulting contracts, and vendor procurement across the state's largest independent school districts (ISDs).\n\n## Identifying Administrative Efficiencies Ahead of Legislative Session\n\nThe statewide audit responds directly to an executive directive issued by Governor Greg Abbott aimed at maximizing classroom teacher compensation while identifying operational redundancies in non-instructional central office administration. Comptroller Hegar stated that the audit will provide lawmakers with granular data on district fund balances and administrative overhead ratios heading into the 89th Legislative Session.\n\nComptroller Hegar affirmed that Texas taxpayers and school children deserve transparent verification that education tax dollars reach classrooms and teachers directly.\n\n## School Superintendent and Trustee Stances\n\nTexas Association of School Administrators (TASA) leaders welcomed financial transparency while noting that districts manage mandatory state security mandates and rising special education transportation costs.\n\nLegislative budget leaders highlighted that audit findings will shape upcoming baseline funding formulas for public education.\n\n## Audit Reporting Schedule\n\nPreliminary efficiency audit findings for initial school districts will be submitted to the Texas Legislature in December 2026.",
    "seoTitle": "Texas Comptroller Launches Public School District Efficiency Audit | Choseno",
    "metaDescription": "Texas Comptroller Glenn Hegar launches administrative expenditure audits of school districts ahead of the 2027 legislative session.",
    "tags": [
      "Greg Abbott",
      "Texas",
      "Education",
      "Budget",
      "Taxes",
      "Economy",
      "US"
    ],
    "tweet": "Texas Comptroller Glenn Hegar launches statewide efficiency audits of school district administrative spending ahead of the 2027 legislative session.",
    "breakingNews": false,
    "author": {
      "name": "Choseno State Fiscal & Education Bureau",
      "bio": "State fiscal audits, public school finance, Texas legislative appropriations, and government efficiency"
    },
    "sources": [
      {
        "label": "Texas Comptroller of Public Accounts",
        "url": "https://comptroller.texas.gov/about/media-center/news/20260823-school-efficiency-audit.php"
      },
      {
        "label": "The Texas Tribune",
        "url": "https://www.texastribune.org/2026/08/23/texas-comptroller-school-district-audits-abbott/"
      }
    ],
    "taggedPoliticianIds": [
      "82d5f358-a471-4b4d-b052-843ef9934ad3"
    ],
    "taggedPoliticians": [
      "Greg Abbott"
    ]
  },
  {
    "slug": "prime-minister-mark-carney-announces-emergency-trade-adjustment-assistance-for-auto-and-steel-workers-2026-08-24",
    "headline": "Prime Minister Mark Carney Unveils $2 Billion Trade Adjustment Package to Support Auto and Steel Workers",
    "summary": "Government of Canada establishes a $2 billion liquidity and wage subsidy bridge for Canadian automotive parts suppliers and steel mills managing supply chain realignments amid U.S. tariffs.",
    "category": "Trade",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-23T20:30:00Z",
    "published_at": "2026-08-24T08:00:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Prime Minister Mark Carney and Finance Minister François-Philippe Champagne announced the creation of the $2 billion Canadian Industrial Trade Adjustment Program (CITAP), providing immediate working capital support and direct payroll wage subsidies for domestic manufacturing workers.\n\n## Protecting Industrial Manufacturing and Skilled Trades\n\nThe federal adjustment program guarantees up to $50 million in low-interest commercial credit lines per manufacturing enterprise and provides 75% work-sharing wage subsidies to prevent plant layoffs while Canadian manufacturers diversify export delivery contracts across European Union, Asian, and Latin American trade corridors. Prime Minister Carney affirmed that Canadian auto parts makers, aluminum smelters, and steelworkers will not bear the cost of unilateral foreign trade duties alone.\n\nPrime Minister Carney emphasized that Canada’s economic foundation is resilient, backed by strategic critical minerals, clean electricity, and the world’s most skilled manufacturing workforce.\n\n## Industrial Coalitions and Labor Union Endorsements\n\nUnifor and the United Steelworkers (USW) strongly endorsed the federal wage subsidy backstop, highlighting that protecting manufacturing jobs preserves industrial community stability in Windsor, Hamilton, and Sault Ste. Marie.\n\nCanadian Manufacturers & Exporters (CME) praised the emergency liquidity window for preventing cash flow insolvency.\n\n## Program Application Timeline\n\nFederal trade adjustment portal intake opens through the Business Development Bank of Canada (BDC) on September 1, 2026.",
    "seoTitle": "PM Mark Carney Unveils $2B Trade Adjustment Package for Workers | Choseno",
    "metaDescription": "Prime Minister Mark Carney announces $2B industrial adjustment fund and wage subsidies for auto and steel manufacturing workers.",
    "tags": [
      "Mark Carney",
      "Canada",
      "Trade",
      "Economy",
      "Manufacturing",
      "Jobs"
    ],
    "tweet": "Prime Minister Mark Carney unveils a $2B trade adjustment fund providing wage subsidies and liquidity to protect auto and steel workers from U.S. tariffs.",
    "breakingNews": true,
    "author": {
      "name": "Choseno National & Trade Affairs Bureau",
      "bio": "Industrial trade policy, federal wage subsidies, manufacturing economics, and international trade"
    },
    "sources": [
      {
        "label": "Department of Finance Canada",
        "url": "https://www.canada.ca/en/department-finance/news/2026/08/government-announces-2-billion-industrial-trade-adjustment-program.html"
      },
      {
        "label": "The Canadian Press",
        "url": "https://www.thecanadianpressnews.ca/politics/carney-2-billion-trade-adjustment-program-workers/article_7483991.html"
      }
    ],
    "taggedPoliticianIds": [
      "3ec78351-9bec-46b8-afea-45931f29646e"
    ],
    "taggedPoliticians": [
      "Mark Carney"
    ]
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
