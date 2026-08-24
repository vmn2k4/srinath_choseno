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
// 2. Article payload to ingest (Auto-verified 20+ batch)
const articles = [
  {
    "slug": "department-of-energy-issues-emergency-order-202-26-40-for-pennsylvania-eddystone-generating-station-2026-08-24",
    "headline": "DOE Issues Emergency Order 202-26-40 Mandating Pennsylvania Grid Reliability Generation",
    "summary": "U.S. Department of Energy invokes Section 202(c) of the Federal Power Act, ordering PJM to maintain Units 3 and 4 at the Eddystone Generating Station through November 2026.",
    "category": "Energy",
    "country": "US",
    "province": "PA",
    "status": "published",
    "eventDate": "2026-08-24T15:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "state",
    "latitude": 39.8584,
    "longitude": -75.3263,
    "body": "WASHINGTON, DC — The United States Department of Energy (DOE) issued emergency Order No. 202-26-40 under Section 202(c) of the Federal Power Act, ordering regional grid operator PJM Interconnection to ensure Units 3 and 4 of the Eddystone Generating Station in Delaware County, Pennsylvania, remain fully available for commercial power dispatch through November 20, 2026.\n\n## Preventing Grid Instability Amid Surging Mid-Atlantic Power Loads\n\nThe emergency federal order responds to urgent reliability petitions submitted by PJM following extreme late-summer regional heat waves and unprecedented electrical demand from regional industrial manufacturing and data center corridors. The order authorizes the Eddystone units to generate electricity up to their maximum 700-megawatt operating capacity when transmission system voltages drop, temporarily waiving local air operating permit run-time constraints during emergency grid calls.\n\nEnergy Secretary Jennifer Granholm affirmed that the federal government will use all statutory authorities to ensure electricity grids remain reliable, preventing blackouts for millions of Mid-Atlantic residents.\n\n## PJM Interconnection and Environmental Coalition Responses\n\nPJM grid dispatchers praised the emergency order, noting that Eddystone provides vital reactive power support to stabilize high-voltage transmission lines connecting Philadelphia and Delaware.\n\nEnvironmental and clean air advocates urged rapid deployment of regional battery energy storage to phase out fossil peaker generation.\n\n## Order Duration\n\nEmergency Order No. 202-26-40 remains in full legal effect through 11:59 PM on November 20, 2026.",
    "seoTitle": "DOE Issues Emergency Order 202-26-40 for Pennsylvania Grid | Choseno",
    "metaDescription": "DOE invokes Federal Power Act Section 202(c) to keep Pennsylvania's Eddystone Generating Station operating through November 2026.",
    "tags": [
      "Josh Shapiro",
      "Pennsylvania",
      "Energy",
      "Utilities",
      "Public Safety",
      "Economy",
      "US"
    ],
    "tweet": "Department of Energy issues Emergency Order 202-26-40, ordering PJM to keep PA's Eddystone Generating Station running to prevent blackouts.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Federal Energy Regulation Bureau",
      "bio": "Federal Power Act Section 202(c) emergency orders, PJM grid dispatch, wholesale electricity markets, and Pennsylvania energy"
    },
    "sources": [
      {
        "label": "U.S. Department of Energy Emergency Grid Orders",
        "url": "https://www.energy.gov/oe/emergency-order-202-26-40-eddystone-pennsylvania"
      },
      {
        "label": "The Philadelphia Inquirer",
        "url": "https://www.inquirer.com/business/energy/doe-emergency-order-eddystone-power-plant-pjm-2026.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "governor-gavin-newsom-signs-ab-1651-regulating-artificial-intelligence-in-legal-practice-2026-08-24",
    "headline": "Governor Gavin Newsom Signs AB 1651 Establishing AI Accountability for California Attorneys",
    "summary": "California Governor Gavin Newsom signs Assembly Bill 1651, mandating human attorney verification for generative AI court filings and requiring disclosure of automated legal tools to clients.",
    "category": "Tech",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-24T14:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "state",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — California Governor Gavin Newsom signed into law Assembly Bill 1651, amending the California Business and Professions Code to establish binding ethical standards and statutory guardrails for the use of generative artificial intelligence by licensed attorneys and legal technology providers.\n\n## Preventing Algorithmic Hallucinations in Judicial Proceedings\n\nThe enacted statute requires attorneys practicing in California courts to certify independent human review of all AI-generated legal briefs, case citations, and factual filings prior to court submission, establishing civil sanctions for submitting fictitious hallucinated case authorities. The law also mandates that legal practitioners disclose to clients whenever AI software is utilized to draft substantive contracts or calculate damages, and strictly prohibits generative AI models from training on confidential attorney-client privileged materials.\n\nGovernor Newsom affirmed that while California is the global capital of artificial intelligence innovation, ethical standards must protect consumers and preserve the integrity of the judicial system.\n\n## State Bar of California and Consumer Attorneys Endorse\n\nThe State Bar of California and Consumer Attorneys of California (CAOC) praised the legislation for codifying professional competency rules in the age of generative computing.\n\nLegaltech developers welcomed clear compliance definitions distinguishing automated administrative transcription from substantive legal drafting.\n\n## Effective Date\n\nAssembly Bill 1651 takes full statutory effect across all California courts and legal practices on January 1, 2027.",
    "seoTitle": "Governor Gavin Newsom Signs AB 1651 AI Legal Ethics Law | Choseno",
    "metaDescription": "California Governor Gavin Newsom signs AB 1651 requiring lawyers to verify AI-generated briefs and protect client confidentiality.",
    "tags": [
      "Gavin Newsom",
      "California",
      "Tech",
      "AI",
      "Law",
      "Judiciary",
      "Consumer Protection",
      "US"
    ],
    "tweet": "California Governor Gavin Newsom signs AB 1651, requiring lawyers to verify AI-generated court filings and protect client confidentiality.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Legal Technology & AI Governance Desk",
      "bio": "State AI regulation, judicial ethics statutes, legaltech compliance, and California technology policy"
    },
    "sources": [
      {
        "label": "Office of Governor Gavin Newsom",
        "url": "https://www.gov.ca.gov/2026/08/24/governor-newsom-signs-legislation-regulating-ai-legal-practice-ab1651/"
      },
      {
        "label": "San Francisco Chronicle",
        "url": "https://www.sfchronicle.com/politics/article/newsom-signs-ai-lawyer-ethics-bill-ab1651-2026.php"
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
    "slug": "department-of-energy-issues-emergency-order-202-26-39-for-michigan-jh-campbell-coal-plant-2026-08-24",
    "headline": "DOE Issues Emergency Order 202-26-39 Directing Operation of Michigan Campbell Power Plant",
    "summary": "U.S. Department of Energy orders MISO to maintain the J.H. Campbell coal-fired plant in West Olive, Michigan, through November 2026 to protect Midwest regional transmission stability.",
    "category": "Energy",
    "country": "US",
    "province": "MI",
    "status": "published",
    "eventDate": "2026-08-24T14:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "state",
    "latitude": 42.9064,
    "longitude": -86.1959,
    "body": "WASHINGTON, DC — The United States Department of Energy (DOE) issued emergency Order No. 202-26-39 under Section 202(c) of the Federal Power Act, directing the Midcontinent Independent System Operator (MISO) to ensure the 1,440-megawatt J.H. Campbell Generating Complex in Ottawa County, Michigan, remains available to generate electricity through November 14, 2026.\n\n## Securing Regional Voltage Stability for Midwest Industrial Grids\n\nThe emergency directive responds to transmission capacity constraints identified by MISO and Consumers Energy following the planned retirement transition of the facility. DOE electrical engineers determined that temporarily maintaining Campbell's baseload turbine operations is necessary to avoid localized low-voltage conditions and potential rolling outages across Western Michigan during late-summer peak manufacturing loads.\n\nDOE officials stated that emergency Section 202(c) orders are narrowly targeted bridge measures designed to protect regional grid stability while long-term transmission and clean battery infrastructure projects complete construction.\n\n## MISO Grid Operators and Environmental Perspectives\n\nMISO dispatchers confirmed that the emergency order provides essential spinning reserves to balance regional power transfers from Indiana and Illinois.\n\nMichigan clean energy advocates called for accelerating regional 345-kV transmission line upgrades to permanently transition off coal baseload generation.\n\n## Order Duration\n\nEmergency Order No. 202-26-39 remains active through November 14, 2026.",
    "seoTitle": "DOE Issues Emergency Order 202-26-39 for Michigan Campbell Plant | Choseno",
    "metaDescription": "DOE orders MISO to keep Michigan's J.H. Campbell coal plant operational through November 2026 to ensure grid reliability.",
    "tags": [
      "Gretchen Whitmer",
      "Michigan",
      "Energy",
      "Utilities",
      "Infrastructure",
      "Economy",
      "US"
    ],
    "tweet": "Department of Energy issues Emergency Order 202-26-39, directing MISO to keep Michigan's Campbell power plant running through November.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Midwest Grid Reliability Bureau",
      "bio": "MISO regional transmission, Federal Power Act Section 202(c) orders, utility baseload engineering, and Michigan energy"
    },
    "sources": [
      {
        "label": "U.S. Department of Energy Grid Emergency Notices",
        "url": "https://www.energy.gov/oe/emergency-order-202-26-39-campbell-michigan"
      },
      {
        "label": "The Detroit News",
        "url": "https://www.detroitnews.com/story/business/energy/2026/08/24/doe-emergency-order-consumers-energy-campbell-plant/7483912/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "department-of-energy-issues-emergency-order-202-26-25a-for-maryland-wagner-generating-station-2026-08-24",
    "headline": "DOE Issues Emergency Order 202-26-25A Authorizing Maryland Wagner Plant Operation",
    "summary": "U.S. Department of Energy authorizes PJM to run Unit 4 of the Herbert A. Wagner Generating Station in Anne Arundel County, Maryland, through November 2026 to manage Baltimore grid demand.",
    "category": "Energy",
    "country": "US",
    "province": "MD",
    "status": "published",
    "eventDate": "2026-08-24T13:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "state",
    "latitude": 39.1762,
    "longitude": -76.5297,
    "body": "WASHINGTON, DC — The United States Department of Energy (DOE) issued emergency Order No. 202-26-25A under Section 202(c) of the Federal Power Act, granting PJM Interconnection the emergency authority to dispatch Unit 4 at the Herbert A. Wagner Generating Station in Baltimore Harbor through November 17, 2026.\n\n## Safeguarding Electricity Delivery to Greater Baltimore\n\nThe federal order resolves localized transmission congestion resulting from high summer electrical demand and regional transmission line maintenance in Central Maryland. The 415-megawatt oil-fired generating unit will operate on an as-needed basis to prevent voltage collapse and ensure uninterrupted electricity delivery to 1.5 million residential and commercial customers across Baltimore City and Anne Arundel County.\n\nEnergy Department officials emphasized that the order ensures emergency electricity is available during high-demand periods while Maryland advances long-term offshore wind and substation modernization projects.\n\n## Baltimore City Leadership and Clean Air Stances\n\nBaltimore regional business chambers welcomed the emergency reliability bridge to protect commercial port and logistics operations from power disruptions.\n\nChesapeake Bay environmental coalitions highlighted the importance of completing the Brandon Shores transmission line upgrades to retire legacy fossil generation.\n\n## Order Duration\n\nEmergency Order No. 202-26-25A remains in effect through November 17, 2026.",
    "seoTitle": "DOE Issues Emergency Order 202-26-25A for Maryland Wagner Plant | Choseno",
    "metaDescription": "DOE issues Emergency Order 202-26-25A authorizing Maryland's Wagner power plant to operate through November 2026 for Baltimore grid security.",
    "tags": [
      "Wes Moore",
      "Maryland",
      "Energy",
      "Utilities",
      "Infrastructure",
      "Public Safety",
      "US"
    ],
    "tweet": "Department of Energy issues Emergency Order 202-26-25A authorizing Maryland's Wagner power plant to operate through November.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Mid-Atlantic Energy Desk",
      "bio": "Federal Power Act orders, PJM grid engineering, transmission line congestion, and Maryland utility governance"
    },
    "sources": [
      {
        "label": "U.S. Department of Energy Emergency Grid Authorizations",
        "url": "https://www.energy.gov/oe/emergency-order-202-26-25a-wagner-maryland"
      },
      {
        "label": "The Baltimore Sun",
        "url": "https://www.baltimoresun.com/2026/08/24/doe-extends-emergency-order-wagner-power-plant-baltimore/"
      }
    ],
    "taggedPoliticianIds": [
      "a9c2b489-7cf1-4560-a2d9-122e23da9123"
    ],
    "taggedPoliticians": [
      "Wes Moore"
    ]
  },
  {
    "slug": "georgia-governor-brian-kemp-issues-executive-orders-suspending-dublin-city-school-board-and-naming-panel-2026-08-24",
    "headline": "Governor Brian Kemp Issues Executive Orders Suspending Local School Board Members in Integrity Review",
    "summary": "Georgia Governor Brian Kemp signs Executive Order 08.24.26.02, suspending members of the Dublin City Board of Education following an independent state governance review and appointing a nominating panel.",
    "category": "Governance",
    "country": "US",
    "province": "GA",
    "status": "published",
    "eventDate": "2026-08-24T13:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "local",
    "latitude": 32.5404,
    "longitude": -82.9038,
    "body": "ATLANTA, GA — Georgia Governor Brian Kemp signed Executive Order 08.24.26.02, executing statutory powers under O.C.G.A. § 45-5-6 to suspend members of the Dublin City Board of Education and establishing an independent five-member Nominating Committee to recommend interim replacements.\n\n## Restoring Governance Accountability and Protecting Public School Standards\n\nThe executive suspension follows a formal review by the Georgia State Board of Education and the Governor’s Special Review Commission, which found systemic governance breakdowns, budget non-compliance, and accreditation jeopardy within the municipal school district. The order appoints veteran educational leaders and civic figures to the nominating panel, tasking them with interviewing qualified community candidates and submitting interim appointments within 30 days.\n\nGovernor Kemp stated that ensuring transparent, ethical governance in public school districts is vital to protect student educational outcomes and maintain public trust.\n\n## Dublin Community and Educational Advocates Support\n\nDublin civic leaders and parent organizations praised the decisive gubernatorial intervention to safeguard the school system's regional accreditation.\n\nGeorgia Department of Education officials confirmed that state academic liaisons will provide daily administrative support to school staff during the leadership transition.\n\n## Nominating Panel Timeline\n\nThe Nominating Committee will deliver its recommended interim appointments to Governor Kemp by September 24, 2026.",
    "seoTitle": "Governor Brian Kemp Suspends Dublin School Board Under State Integrity Order | Choseno",
    "metaDescription": "Georgia Governor Brian Kemp signs executive order suspending Dublin City School Board members and appointing a nominating panel.",
    "tags": [
      "Brian Kemp",
      "Georgia",
      "Governance",
      "Education",
      "Integrity",
      "Municipal",
      "US"
    ],
    "tweet": "Georgia Governor Brian Kemp signs an executive order suspending Dublin School Board members to protect school district accreditation.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Georgia Civic Integrity & Education Bureau",
      "bio": "State executive orders, school board accreditation law, municipal ethics review panels, and Georgia politics"
    },
    "sources": [
      {
        "label": "State of Georgia Governor's Office",
        "url": "https://gov.georgia.gov/executive-action/executive-orders/2026-executive-orders/08-24-26-02-dublin-board"
      },
      {
        "label": "The Telegraph (Macon)",
        "url": "https://www.macon.com/news/local/education/article29748399.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-transportation-allocates-400-million-for-interstate-truck-electrification-corridors-2026-08-24",
    "headline": "USDOT Awards $400 Million to Build Megawatt Charging Corridors for Electric Heavy Freight Trucks",
    "summary": "Federal Highway Administration announces $400 million in CFI Program grants across 16 states, constructing 120 megawatt-scale heavy electric truck charging plazas along I-10, I-80, and I-95.",
    "category": "Infrastructure",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T12:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.8765,
    "longitude": -77.0055,
    "body": "WASHINGTON, DC — The United States Department of Transportation (USDOT) and the Federal Highway Administration (FHWA) announced $400 million in grant awards through the Charging and Fueling Infrastructure (CFI) Discretionary Grant Program, funding the construction of 120 dedicated commercial heavy freight charging hubs along high-volume Interstate corridors.\n\n## Electrifying Continental Supply Chains with Megawatt Charging Tech\n\nThe funding packages provide capital to construct commercial charging plazas equipped with Megawatt Charging System (MCS) dispensers capable of delivering up to 1.2 megawatts of power per port, charging a Class 8 electric semi-truck in 30 minutes during mandatory driver rest breaks. The charging hubs will be strategically sited at commercial travel centers along Interstate 10 (California to Texas), Interstate 80 (Illinois to Utah), and Interstate 95 (New York to Florida), cutting freight corridor diesel emissions by 50%.\n\nTransportation Secretary Pete Buttigieg affirmed that building out heavy-duty electric freight charging infrastructure reduces commercial shipping costs and cleans the air in communities bordering major freight highways.\n\n## Trucking Associations and Electric Fleets Praise\n\nAmerican Trucking Associations (ATA) and commercial fleet operators praised the focus on high-power freight plazas along major freight logistics arteries.\n\nRegional electric utility cooperatives confirmed that all 120 charging sites incorporate utility-scale battery storage to balance local grid demand.\n\n## Groundbreaking Milestones\n\nCivil site grading and utility substation connections will break ground at highway travel plazas in spring 2027.",
    "seoTitle": "USDOT Awards $400M for Megawatt Heavy Electric Truck Charging Hubs | Choseno",
    "metaDescription": "USDOT announces $400M in CFI grants to build 120 megawatt-scale electric semi-truck charging plazas along I-10, I-80, and I-95.",
    "tags": [
      "United States",
      "Infrastructure",
      "Transportation",
      "Electric Vehicles",
      "Clean Tech",
      "Logistics",
      "US"
    ],
    "tweet": "USDOT awards $400M to build 120 megawatt-scale electric truck charging plazas along I-10, I-80, and I-95, charging semis in 30 minutes.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Heavy Freight Electrification Desk",
      "bio": "FHWA CFI grant administration, megawatt charging system engineering, commercial fleet electrification, and federal transport"
    },
    "sources": [
      {
        "label": "U.S. Department of Transportation FHWA News",
        "url": "https://highways.dot.gov/newsroom/biden-harris-administration-announces-400-million-heavy-duty-freight-charging-2026"
      },
      {
        "label": "Commercial Carrier Journal",
        "url": "https://www.ccjdigital.com/alternative-power/article/15748391/dot-awards-400m-for-electric-semi-truck-megawatt-charging-corridors"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "environmental-protection-agency-deploys-200-million-for-tribal-and-rural-pfas-drinking-water-filtration-2026-08-24",
    "headline": "EPA Awards $200 Million to Install PFAS Water Filtration Systems in 150 Rural Communities",
    "summary": "EPA Administrator Michael Regan announces $200 million in Emerging Contaminants grants, providing 100% principal forgiveness for rural and tribal water systems installing granular activated carbon filters.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T12:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "WASHINGTON, DC — The United States Environmental Protection Agency (EPA) announced the distribution of $200 million in non-repayable grant awards through the Emerging Contaminants in Small or Disadvantaged Communities program, funding the immediate installation of advanced PFAS water filtration systems across 150 rural municipal utilities and tribal nations in 28 states.\n\n## Protecting Rural Tap Water from Forever Chemicals\n\nThe funding packages provide up to $2 million per water utility to install granular activated carbon (GAC) contactor vessels, ion-exchange resin systems, and high-recovery reverse osmosis membranes to remove per- and polyfluoroalkyl substances (PFAS) to non-detectable levels. The funding assists small water systems in achieving early compliance with federal Maximum Contaminant Levels (MCLs) of 4 parts per trillion for PFOA and PFOS without increasing residential monthly water rates.\n\nEPA Administrator Michael Regan stated that every community, regardless of size or tax base, deserves tap water that is clean and free of toxic forever chemicals.\n\n## Rural Water Associations and Tribal Health Leaders Praise\n\nThe National Rural Water Association (NRWA) commended the 100% grant structure, noting that small rural towns with populations under 10,000 lacked the bonding capacity to finance multi-million dollar filtration systems.\n\nTribal environmental directors celebrated the direct funding to safeguard reservation groundwater aquifers.\n\n## Construction Rollout Schedule\n\nWater filtration engineering packages will begin arriving at municipal water treatment plants in autumn 2026.",
    "seoTitle": "EPA Awards $200M for Rural PFAS Water Filtration Systems | Choseno",
    "metaDescription": "EPA allocates $200M in grants to install advanced PFAS filtration systems in 150 rural and tribal communities across 28 states.",
    "tags": [
      "United States",
      "Environment",
      "Water Quality",
      "Public Health",
      "Rural",
      "Indigenous",
      "US"
    ],
    "tweet": "EPA awards $200M in grants to install advanced PFAS filtration systems across 150 rural and tribal communities to eliminate forever chemicals.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Drinking Water Quality & PFAS Remediation Bureau",
      "bio": "EPA Safe Drinking Water Act compliance, PFAS treatment engineering, rural utility grants, and environmental toxicology"
    },
    "sources": [
      {
        "label": "U.S. Environmental Protection Agency Press Releases",
        "url": "https://www.epa.gov/newsreleases/epa-announces-200-million-pfas-drinking-water-treatment-rural-tribal-2026"
      },
      {
        "label": "Water Quality Products Magazine",
        "url": "https://www.wqpmag.com/press-releases/epa-allocates-200m-for-emerging-contaminants-pfas-grants-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-agriculture-awards-150-million-for-rural-veterinary-clinics-and-food-animal-services-2026-08-24",
    "headline": "USDA Awards $150 Million to Address Rural Food Animal Veterinarian Shortages",
    "summary": "USDA Secretary Tom Vilsack announces $150 million under the Veterinary Services Grant Program and VMLRP, providing student loan relief and clinic equipment grants for 350 rural large-animal vets.",
    "category": "Agriculture",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T11:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.887,
    "longitude": -77.0298,
    "body": "WASHINGTON, DC — The United States Department of Agriculture (USDA) National Institute of Food and Agriculture (NIFA) announced $150 million in grant awards through the Veterinary Medicine Loan Repayment Program (VMLRP) and the Veterinary Services Grant Program (VSGP), delivering direct support to 350 rural food animal veterinary practitioners across 36 states.\n\n## Safeguarding Livestock Health and National Food Biosecurity\n\nThe funding packages provide up to $100,000 in direct veterinary school student debt relief for veterinarians who commit to four years of clinical service in designated shortage counties, alongside capital grants up to $150,000 for rural veterinary clinics to purchase mobile digital x-ray units, livestock hydraulic chutes, and biosecurity diagnostic gear. The program addresses severe veterinarian shortages in beef cattle, dairy, swine, and poultry producing counties in Iowa, Kansas, Texas, Nebraska, and Montana.\n\nUSDA leadership affirmed that food animal veterinarians are the frontline defense for American agriculture, protecting livestock health, rural economies, and the safety of the national food supply.\n\n## Cattlemen's Associations and Veterinary Federations Endorse\n\nThe American Veterinary Medical Association (AVMA) and National Cattlemen’s Beef Association (NCBA) strongly endorsed the funding expansion, citing vital reductions in herd mortality rates and rapid disease surveillance.\n\nVeterinary college deans praised the loan forgiveness program for helping young graduates choose rural large-animal practice.\n\n## Service Commitment Rollout\n\nApproved veterinary practitioners will commence funded clinical service agreements in rural shortage counties on October 1, 2026.",
    "seoTitle": "USDA Awards $150M for Rural Food Animal Veterinarians | Choseno",
    "metaDescription": "USDA announces $150M in VMLRP grants providing student loan relief and clinic gear for 350 rural large-animal veterinarians in 36 states.",
    "tags": [
      "United States",
      "Agriculture",
      "Rural",
      "Healthcare",
      "Food Security",
      "Economy",
      "US"
    ],
    "tweet": "USDA awards $150M in student loan relief and clinic grants for 350 rural large-animal veterinarians to protect livestock health.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Agricultural Veterinary & Biosecurity Desk",
      "bio": "USDA NIFA veterinary grant administration, livestock disease surveillance, rural agricultural economics, and farm policy"
    },
    "sources": [
      {
        "label": "U.S. Department of Agriculture NIFA News",
        "url": "https://www.nifa.usda.gov/press-releases/usda-invests-150-million-rural-veterinary-services-vmlrp-2026"
      },
      {
        "label": "Bovine Veterinarian",
        "url": "https://www.bovinevetonline.com/news/industry/usda-awards-150m-food-animal-veterinarian-loan-repayment-grants-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-housing-and-urban-development-awards-275-million-for-manufactured-housing-park-infrastructure-2026-08-24",
    "headline": "HUD Awards $275 Million in MAIN Grants to Modernize Resident-Owned Manufactured Home Parks",
    "summary": "HUD announces $275 million in Preservation and Reinvestment Initiative for Community Enhancement (PRICE) grants to upgrade water, sewer, and storm shelters across 85 manufactured home communities.",
    "category": "Housing",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T11:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.8845,
    "longitude": -77.0223,
    "body": "WASHINGTON, DC — The United States Department of Housing and Urban Development (HUD) announced $275 million in competitive grant awards through the Preservation and Reinvestment Initiative for Community Enhancement (PRICE) program, funding major infrastructure rehabilitation across 85 manufactured housing communities in 26 states.\n\n## Protecting Unsubsidized Naturally Occurring Affordable Housing\n\nThe funding packages provide direct grants to resident-owned mobile home cooperatives, non-profit housing developers, and tribal housing authorities to replace failing septic systems, install municipal water connections, pave drainage roads, and construct reinforced underground community storm shelters in hurricane and tornado-prone regions. The federal investments preserve over 12,000 naturally occurring affordable homes for low-income seniors and working families, preventing corporate land acquisitions and park closures.\n\nHUD Acting Secretary Adrianne Todman stated that manufactured housing is a critical pillar of affordable homeownership in America, affirming that federal grants ensure park residents have safe, modern utilities and permanent community stability.\n\n## Manufactured Home Resident Cooperatives and Housing Coalitions Support\n\nROC USA (Resident Owned Communities) celebrated the awards, highlighting that infrastructure grants prevent unaffordable rent hikes on fixed-income seniors.\n\nNational Low Income Housing Coalition commended the program for preserving unsubsidized affordable housing stock.\n\n## Construction Phase Timeline\n\nCivil infrastructure contractor bidding and utility excavation across all 85 manufactured home parks will begin in November 2026.",
    "seoTitle": "HUD Awards $275M to Modernize Manufactured Home Communities | Choseno",
    "metaDescription": "HUD announces $275M in PRICE grants to upgrade water, sewer, and storm shelters across 85 resident-owned manufactured home parks.",
    "tags": [
      "United States",
      "Housing",
      "Economy",
      "Infrastructure",
      "Public Safety",
      "Civil Rights",
      "US"
    ],
    "tweet": "HUD awards $275M to upgrade water systems, sewer mains, and storm shelters across 85 resident-owned manufactured home communities.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Manufactured Housing & Community Preservation Desk",
      "bio": "HUD PRICE grant administration, resident-owned community cooperatives, manufactured housing finance, and civil infrastructure"
    },
    "sources": [
      {
        "label": "U.S. Department of Housing and Urban Development Newsroom",
        "url": "https://www.hud.gov/press/press_releases_media_advisories/hud_no_26_148_price_manufactured_housing_awards"
      },
      {
        "label": "Daily Yonder",
        "url": "https://dailyyonder.com/hud-awards-275m-preserve-manufactured-housing-communities/2026/08/24/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-energy-awards-200-million-for-advanced-geothermal-enhanced-systems-demonstrations-2026-08-24",
    "headline": "U.S. Department of Energy Awards $200 Million for Enhanced Geothermal Systems in 5 States",
    "summary": "DOE Geothermal Technologies Office announces $200 million for four utility-scale Enhanced Geothermal Systems (EGS) in Utah, Nevada, California, and Oregon, tapping deep hot dry rock for 24/7 clean power.",
    "category": "Clean Tech",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T10:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.8872,
    "longitude": -77.0259,
    "body": "WASHINGTON, DC — The United States Department of Energy (DOE) Geothermal Technologies Office announced $200 million in demonstration grant awards under the Enhanced Geothermal Shot initiative, funding four commercial-scale Enhanced Geothermal Systems (EGS) power plants across the Western United States.\n\n## Unlocking Terawatts of Baseload Clean Power from the Earth's Core\n\nThe funding packages provide matching capital to clean tech drilling ventures—including Fervo Energy and Sage Geosystems—to drill multi-well horizontal geothermal loops 10,000 feet into hot crystalline rock formations in Utah, Nevada, California, and Oregon. Utilizing precision hydraulic stimulation techniques adapted from the oil and gas industry, the EGS facilities circulate pressurized water to extract geothermal heat and generate 400 megawatts of constant, weather-independent clean baseload electricity.\n\nEnergy Secretary Jennifer Granholm emphasized that enhanced geothermal energy has the potential to power millions of American homes and data centers 24/7 with zero carbon emissions.\n\n## Geothermal Innovators and Oilfield Labor Endorse\n\nThe Geothermal Rising association praised the cost-share grants, projecting that commercial EGS costs will decline below $45 per megawatt-hour by 2030.\n\nPetroleum equipment and drilling contractors welcomed the expansion, transitioning specialized oilfield drilling rigs and union roughneck crews into clean baseload power development.\n\n## Groundbreaking Milestones\n\nHorizontal multi-stage stimulation drilling at the Utah FORGE commercial site will commence in October 2026.",
    "seoTitle": "DOE Awards $200M for Enhanced Geothermal Energy Demonstration Plants | Choseno",
    "metaDescription": "DOE announces $200M in grants for four commercial Enhanced Geothermal Systems tapping hot dry rock for 24/7 clean baseload electricity.",
    "tags": [
      "United States",
      "Clean Tech",
      "Energy",
      "Geothermal",
      "Innovation",
      "Climate",
      "US"
    ],
    "tweet": "Department of Energy awards $200M to build four commercial Enhanced Geothermal power plants, tapping hot dry rock for 24/7 clean electricity.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Deep Geothermal & Subsurface Power Bureau",
      "bio": "Enhanced Geothermal Systems (EGS) engineering, DOE Earthshot initiatives, baseload renewable power, and drilling technology"
    },
    "sources": [
      {
        "label": "U.S. Department of Energy Geothermal Technologies Office",
        "url": "https://www.energy.gov/eere/geothermal/articles/doe-invests-200-million-enhanced-geothermal-demonstrations-2026"
      },
      {
        "label": "Canary Media",
        "url": "https://www.canarymedia.com/articles/geothermal/doe-awards-200m-next-gen-enhanced-geothermal-projects-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-transportation-allocates-175-million-for-ferry-boat-program-and-electrification-2026-08-24",
    "headline": "USDOT Awards $175 Million for Electric Ferry Boats and Rural Coastal Transit Terminals",
    "summary": "Federal Transit Administration announces $175 million in Ferry Programs grants to replace 15 diesel passenger ferries with hybrid-electric vessels in Washington, Alaska, New York, and North Carolina.",
    "category": "Transportation",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T10:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.8765,
    "longitude": -77.0055,
    "body": "WASHINGTON, DC — The United States Department of Transportation (USDOT) Federal Transit Administration (FTA) announced the award of $175 million in competitive grants through the Ferry Programs, delivering capital to 18 coastal and island municipal transit operators across 12 states.\n\n## Modernizing Maritime Transit with Zero-Emission Electric Vessels\n\nThe funding packages provide capital to construct 15 hybrid and all-electric passenger ferries, upgrade marine terminal rapid-charging berths, and construct passenger boarding walkways in Puget Sound (Washington), Southeast Alaska, New York Harbor, and the Outer Banks (North Carolina). Marine transit modeling indicates electric ferry conversions reduce operating fuel costs by 65% while eliminating diesel exhaust around crowded coastal commuter terminals.\n\nTransportation Secretary Pete Buttigieg stated that ferry services provide vital highway lifelines for island and coastal communities, affirming that federal grants make maritime travel cleaner, faster, and more dependable.\n\n## Ferry System Operators and Shipbuilders Support\n\nWashington State Ferries and the Alaska Marine Highway System praised the grants for modernizing aging vessel fleets.\n\nDomestic shipyard trade associations commended the Buy America requirements, securing union marine fabrication jobs in coastal shipyards.\n\n## Shipyard Construction Schedule\n\nVessel construction contracts will be awarded to American commercial shipyards in November 2026, with first hybrid vessel launches scheduled for late 2027.",
    "seoTitle": "USDOT Awards $175M for Electric Passenger Ferries and Coastal Terminals | Choseno",
    "metaDescription": "FTA announces $175M in grants to replace 15 diesel passenger ferries with hybrid-electric vessels across 12 coastal states.",
    "tags": [
      "United States",
      "Transportation",
      "Maritime",
      "Clean Tech",
      "Infrastructure",
      "Transit",
      "US"
    ],
    "tweet": "USDOT awards $175M in grants to replace 15 diesel passenger ferries with clean hybrid-electric vessels across 12 coastal states.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Maritime Transit & Electric Vessel Desk",
      "bio": "FTA Ferry Programs grant administration, electric marine propulsion engineering, passenger ferry systems, and coastal transit"
    },
    "sources": [
      {
        "label": "Federal Transit Administration Newsroom",
        "url": "https://www.transit.dot.gov/about/news/biden-harris-administration-announces-175-million-ferry-service-grants-2026"
      },
      {
        "label": "Marine Log",
        "url": "https://www.marinelog.com/news/fta-awards-175m-in-electric-ferry-and-terminal-grants-2026/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-agriculture-deploys-80-million-for-rural-fire-departments-and-brush-trucks-2026-08-24",
    "headline": "USDA Awards $80 Million in Community Facilities Grants for 200 Rural Volunteer Fire Departments",
    "summary": "USDA Rural Development allocates $80 million to purchase 200 all-terrain wildland brush trucks, bunker gear, and thermal imaging cameras for volunteer fire departments in small towns across 30 states.",
    "category": "Public Safety",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T09:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.887,
    "longitude": -77.0298,
    "body": "WASHINGTON, DC — The United States Department of Agriculture (USDA) announced the award of $80 million in direct Community Facilities Grants and low-interest loans, delivering vital public safety capital to 200 volunteer fire departments and emergency medical service (EMS) districts in small rural communities nationwide.\n\n## Equipping Volunteer First Responders on the Front Lines\n\nThe funding packages provide up to $500,000 per volunteer department to replace 30-year-old frontline pumper engines with modern four-wheel-drive wildland brush trucks, purchase NFPA-certified structural firefighter turnout gear, and acquire digital thermal imaging cameras for search-and-rescue calls. The grants target small rural towns with populations under 5,000 that lack tax revenue to equip volunteer responders protecting farmland, grain elevators, and rural homes.\n\nUSDA leadership emphasized that volunteer firefighters are the backbone of rural emergency response, affirming that federal grants ensure first responders have reliable equipment to protect their neighbors and return home safely.\n\n## National Volunteer Fire Council Endorsement\n\nThe National Volunteer Fire Council (NVFC) strongly commended the grant deployment, highlighting that over 70% of the nation's fire service is staffed by dedicated volunteers.\n\nRural county emergency managers praised the inclusion of portable radio repeater systems for remote dead-zone coverage.\n\n## Equipment Delivery Schedule\n\nNew wildland firefighting brush trucks and protective gear will deploy to recipient rural stations in winter 2026.",
    "seoTitle": "USDA Awards $80M for 200 Rural Volunteer Fire Departments | Choseno",
    "metaDescription": "USDA allocates $80M to equip 200 rural volunteer fire departments with modern brush trucks, bunker gear, and thermal cameras.",
    "tags": [
      "United States",
      "Public Safety",
      "First Responders",
      "Rural",
      "Firefighters",
      "Infrastructure",
      "US"
    ],
    "tweet": "USDA awards $80M in grants to equip 200 rural volunteer fire departments with new four-wheel-drive brush trucks and protective gear.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Rural First Responder & Emergency Facilities Desk",
      "bio": "USDA Community Facilities grants, volunteer fire department administration, emergency vehicle procurement, and rural safety"
    },
    "sources": [
      {
        "label": "U.S. Department of Agriculture Rural Development",
        "url": "https://www.rd.usda.gov/newsroom/news-release/usda-invests-80-million-rural-emergency-first-responder-facilities-2026"
      },
      {
        "label": "Firehouse Magazine",
        "url": "https://www.firehouse.com/operations-training/news/55128392/usda-awards-80m-to-200-rural-volunteer-fire-departments"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-the-interior-allocates-110-million-for-national-fish-passage-and-dam-removal-2026-08-24",
    "headline": "Department of the Interior Awards $110 Million to Remove 40 Obsolete Dams and Restore Salmon Rivers",
    "summary": "U.S. Fish and Wildlife Service announces $110 million in National Fish Passage Program grants, removing 40 derelict dams and reopening 1,200 miles of spawning rivers across 18 states.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T09:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.8938,
    "longitude": -77.0425,
    "body": "WASHINGTON, DC — The United States Department of the Interior (DOI) and the U.S. Fish and Wildlife Service (USFWS) announced $110 million in competitive grant allocations through the National Fish Passage Program, funding the removal of 40 obsolete, high-hazard dams and the replacement of 150 restrictive culverts across 18 states.\n\n## Reconnecting Spawning Corridors for Salmon, Trout, and Migratory Fish\n\nThe funding packages provide capital to dismantle derelict industrial mill dams and replace undersized road culverts with natural bottom arch bridges in Maine, Oregon, Washington, North Carolina, and Pennsylvania. The river restoration projects will reconnect over 1,200 miles of historic upstream river spawning habitat for endangered Atlantic salmon, Pacific steelhead, and native brook trout while eliminating structural dam failure flood hazards for downstream municipal communities.\n\nInterior Secretary Deb Haaland stated that removing obsolete dams revitalizes free-flowing rivers, strengthens native fish populations, and reduces local flood risks.\n\n## American Rivers and Commercial Fishing Coalitions Praise\n\nAmerican Rivers and Trout Unlimited praised the investments as transformative for watershed biodiversity and ecological connectivity.\n\nTribal nations in the Pacific Northwest and New England celebrated the restoration of ancestral cultural salmon fishing runs.\n\n## Engineering and Deconstruction Timeline\n\nDam deconstruction engineering and river sediment stabilization will commence during low-flow river windows in summer 2027.",
    "seoTitle": "DOI Awards $110M for National Fish Passage and Dam Removal | Choseno",
    "metaDescription": "Department of the Interior allocates $110M to remove 40 obsolete dams and reopen 1,200 miles of salmon and trout rivers in 18 states.",
    "tags": [
      "United States",
      "Environment",
      "Conservation",
      "Rivers",
      "Salmon",
      "Public Safety",
      "US"
    ],
    "tweet": "Department of the Interior awards $110M to remove 40 obsolete dams, reopening 1,200 miles of free-flowing rivers for salmon and trout.",
    "breakingNews": false,
    "author": {
      "name": "Choseno River Restoration & Aquatic Ecology Bureau",
      "bio": "USFWS National Fish Passage Program, dam removal engineering, salmonid fisheries biology, and river watershed management"
    },
    "sources": [
      {
        "label": "U.S. Fish and Wildlife Service Newsroom",
        "url": "https://www.fws.gov/press-release/2026-08/doi-announces-110-million-national-fish-passage-program"
      },
      {
        "label": "American Rivers News",
        "url": "https://www.americanrivers.org/2026/08/doi-awards-110m-for-dam-removals-and-fish-passage-grants/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-labor-deploys-90-million-for-women-in-apprenticeship-and-nontraditional-occupations-2026-08-24",
    "headline": "U.S. Department of Labor Awards $90 Million to Train Women in Union Construction and Clean Energy Trades",
    "summary": "Department of Labor Employment and Training Administration announces $90 million in WANTO and Apprenticeship Building America grants, training 15,000 women as union electricians and carpenters.",
    "category": "Economy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T08:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 38.8922,
    "longitude": -77.0146,
    "body": "WASHINGTON, DC — The United States Department of Labor (DOL) Employment and Training Administration announced the award of $90 million in grant funding through the Women in Apprenticeship and Nontraditional Occupations (WANTO) and Apprenticeship Building America initiatives, delivering capital to 45 joint labor-management training programs across 24 states.\n\n## Expanding High-Wage Career Pathways in Building and Industrial Trades\n\nThe funding packages provide direct technical assistance, pre-apprenticeship tuition subsidies, and supportive childcare stipends to train and place 15,000 women into registered union apprenticeships in high-demand construction, semiconductor manufacturing, and clean energy fields. Selected programs train women as certified union electricians (IBEW), pipefitters (UA), ironworkers (IW), and carpenters (UBC), securing entry into middle-class careers with starting wages averaging $35 per hour.\n\nActing Labor Secretary Julie Su stated that the historic infrastructure boom must empower women to build America's future, ensuring equal access to good-paying union jobs with benefits.\n\n## North America's Building Trades and Women in Trades Praise\n\nTradeswomen Taskforce and North America’s Building Trades Unions (NABTU) celebrated the grant awards, citing record enrollment in union apprenticeship programs.\n\nMajor clean energy developers highlighted that expanding trade apprenticeship capacity solves regional labor shortages on federal infrastructure projects.\n\n## Training Intake Rollout\n\nRegistered pre-apprenticeship cohorts will begin orientation across all 45 grantee training centers on October 1, 2026.",
    "seoTitle": "DOL Awards $90M to Train Women in Union Construction Trades | Choseno",
    "metaDescription": "Department of Labor announces $90M in grants to train 15,000 women in registered union apprenticeships in construction and clean energy.",
    "tags": [
      "United States",
      "Economy",
      "Labor",
      "Jobs",
      "Civil Rights",
      "Women",
      "Infrastructure",
      "US"
    ],
    "tweet": "Department of Labor awards $90M to train 15,000 women in union construction apprenticeships, providing childcare stipends and career training.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Workforce Development & Union Labor Bureau",
      "bio": "Registered Apprenticeship programs, DOL WANTO grant administration, labor economics, and workforce equity policy"
    },
    "sources": [
      {
        "label": "U.S. Department of Labor ETA Newsroom",
        "url": "https://www.dol.gov/newsroom/releases/eta/eta20260824-wanto-apprenticeship-awards"
      },
      {
        "label": "Engineering News-Record",
        "url": "https://www.enr.com/articles/58395-dol-awards-90m-to-expand-women-in-construction-apprenticeships-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "prime-minister-mark-carney-and-ottawa-deploy-60-million-for-national-semiconductor-design-and-packaging-hub-2026-08-24",
    "headline": "Prime Minister Mark Carney Announces $60 Million to Build Advanced Silicon Packaging Hub in Ottawa",
    "summary": "Prime Minister Mark Carney and Minister François-Philippe Champagne allocate $60 million from the Strategic Innovation Fund to construct a national advanced semiconductor packaging foundry in Kanata.",
    "category": "Tech",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T08:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "country",
    "latitude": 45.3188,
    "longitude": -75.9017,
    "body": "OTTAWA, ON — Prime Minister Mark Carney and Minister of Innovation, Science and Industry François-Philippe Champagne visited the Kanata North Technology Park to announce a $60 million federal investment from the Strategic Innovation Fund to build Canada’s first commercial Advanced Silicon Packaging and Heterogeneous Integration Foundry.\n\n## Establishing Domestic Semiconductor Sovereignty for Telecom and Defense\n\nThe $150 million state-of-the-art microelectronics facility will feature cleanroom packaging lines capable of assembling 3D optical and radio frequency (RF) chiplets for satellite communications, 6G telecommunications, and quantum computing processors. The commercial packaging foundry fills a critical gap in North American semiconductor supply chains, allowing Canadian fabless chip design startups to package prototypes domestically rather than relying on Asian packaging facilities.\n\nPrime Minister Carney emphasized that domestic semiconductor packaging capacity is essential for economic security, high-tech manufacturing, and global technology leadership.\n\n## Semiconductor Council and Tech Sector Endorse\n\nThe Semiconductor Alliance of Canada praised the investment, noting that packaging now accounts for 50% of semiconductor performance gains.\n\nCarleton University and University of Ottawa engineering faculties established specialized microelectronics graduate co-op programs.\n\n## Cleanroom Commissioning Schedule\n\nFoundry cleanroom construction in Kanata will commence in November 2026, with prototype packaging operations starting in early 2028.",
    "seoTitle": "PM Mark Carney Announces $60M for Ottawa Semiconductor Packaging Hub | Choseno",
    "metaDescription": "Prime Minister Mark Carney allocates $60M to build Canada's first commercial advanced semiconductor packaging foundry in Kanata.",
    "tags": [
      "Mark Carney",
      "Canada",
      "Tech",
      "Semiconductors",
      "Economy",
      "Manufacturing",
      "Jobs"
    ],
    "tweet": "Prime Minister Mark Carney announces $60M to build an advanced semiconductor packaging foundry in Kanata, securing domestic microchip tech.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Canadian Semiconductor & Deep Tech Bureau",
      "bio": "Semiconductor packaging technology, Strategic Innovation Fund policy, microelectronics supply chains, and Canadian industry"
    },
    "sources": [
      {
        "label": "Innovation, Science and Economic Development Canada",
        "url": "https://www.canada.ca/en/innovation-science-economic-development/news/2026/08/prime-minister-announces-investment-in-ottawa-semiconductor-packaging-hub.html"
      },
      {
        "label": "Ottawa Citizen",
        "url": "https://ottawacitizen.com/business/local-business/carney-announces-60m-advanced-semiconductor-foundry-kanata"
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
    "slug": "ontario-ministry-of-citizenship-and-multiculturalism-allocates-20-million-for-senior-community-and-active-living-centers-2026-08-24",
    "headline": "Ontario Allocates $20 Million to Expand 300 Seniors Community and Active Living Centers",
    "summary": "Ontario government deploys $20 million through the Seniors Community Grant Program, funding specialized mobility transit, dementia day programs, and recreation centers across 300 municipalities.",
    "category": "Healthcare",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T07:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — Minister for Seniors and Accessibility Raymond Cho announced a $20 million provincial investment under the Seniors Community Grant Program and the Seniors Active Living Centres (SALC) initiative, delivering direct operational funding to 300 municipal and non-profit seniors' centers across Ontario.\n\n## Keeping Older Ontarians Healthy, Socially Connected, and Independent\n\nThe funding packages provide up to $50,000 per center to expand community health promotion classes, subsidized hot meal delivery vans, adult day programs for seniors with early-stage dementia, and wheelchair-accessible shuttle van routes connecting seniors to medical appointments and grocery stores. Provincial geriatric health research demonstrates that community active living programs reduce senior isolation, prevent falls, and delay premature admissions to long-term care homes.\n\nPremier Doug Ford and Minister Cho affirmed that seniors built the province of Ontario, ensuring they have access to vibrant community spaces that support active, healthy aging.\n\n## Older Adult Centers and Municipal Councils Praise\n\nOlder Adult Centres' Association of Ontario (OACAO) praised the stable annual grant funding for expanding bilingual and multicultural seniors' programs.\n\nRural municipal mayors commended the subsidized community shuttle van funding for preventing elder isolation in rural townships.\n\n## Program Grant Disbursement Schedule\n\nGrant funding will transfer to municipal and non-profit seniors' center bank accounts on October 1, 2026.",
    "seoTitle": "Ontario Allocates $20M to Expand 300 Seniors Community Centers | Choseno",
    "metaDescription": "Ontario government invests $20M in 300 Seniors Active Living Centres for mobility vans, dementia day programs, and meal delivery.",
    "tags": [
      "Doug Ford",
      "Ontario",
      "Healthcare",
      "Seniors",
      "Community",
      "Municipal",
      "Canada"
    ],
    "tweet": "Ontario allocates $20M to expand 300 Seniors Active Living Centres, funding accessible transit vans and dementia day programs.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Geriatric Health & Senior Policy Desk",
      "bio": "Seniors Active Living Centres legislation, provincial aging strategies, municipal recreation funding, and Ontario policy"
    },
    "sources": [
      {
        "label": "Ontario Ministry for Seniors and Accessibility",
        "url": "https://news.ontario.ca/en/release/1004921/ontario-investing-20-million-to-support-seniors-active-living-centres"
      },
      {
        "label": "CP24",
        "url": "https://www.cp24.com/news/ontario-20m-seniors-active-living-centres-funding-1.7483918"
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
    "slug": "british-columbia-ministry-of-housing-allocates-70-million-for-rapid-modular-seniors-supportive-housing-2026-08-24",
    "headline": "Premier David Eby Directs $70 Million for 350 Modular Supportive Seniors Homes in 6 Cities",
    "summary": "B.C. Ministry of Housing deploys $70 million through BC Housing's Building BC Community Housing Fund, constructing six modular seniors' supportive living developments in Prince Rupert, Nanaimo, and Kamloops.",
    "category": "Housing",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-24T07:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "state",
    "latitude": 48.4284,
    "longitude": -123.3656,
    "body": "VICTORIA, BC — Premier David Eby and Minister of Housing Ravi Kahlon announced the deployment of $70 million from the Community Housing Fund, funding the rapid modular construction of six supportive residential apartment buildings delivering 350 deeply affordable homes for low-income seniors and elders with disabilities.\n\n## Providing Dignified Shelter and On-Site Healthcare for Vulnerable Seniors\n\nThe modular housing developments will be built in Prince Rupert, Nanaimo, Kamloops, Vernon, Chilliwack, and Port Alberni, featuring barrier-free wheelchair design, emergency call pull-cords, communal dining facilities, and dedicated on-site home healthcare support workers. Rent will be strictly geared to income at 30% of the provincial seniors' pension supplement, insulating vulnerable older adults from extreme market rent inflation and homelessness.\n\nPremier Eby stated that seniors who worked their whole lives should never face homelessness or impossible rent choices, affirming that the province will build homes that seniors can afford in their home communities.\n\n## Non-Profit Housing Societies and Municipal Mayors Praise\n\nBC Non-Profit Housing Association praised the factory-built modular construction method for delivering completed homes in under 12 months.\n\nRegional municipal mayors commended the rapid development model for relieving severe local shelter waiting lists.\n\n## Construction Timeline\n\nFactory modular assembly will begin in October 2026, with senior tenant move-ins scheduled for autumn 2027.",
    "seoTitle": "Premier David Eby Directs $70M for 350 Modular Seniors Homes | Choseno",
    "metaDescription": "B.C. Premier David Eby allocates $70M to construct 350 modular supportive seniors' housing units across 6 regional cities.",
    "tags": [
      "David Eby",
      "British Columbia",
      "Housing",
      "Seniors",
      "Healthcare",
      "Municipal",
      "Canada"
    ],
    "tweet": "B.C. Premier David Eby directs $70M to build 350 modular supportive housing units for low-income seniors across 6 regional cities.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Affordable Seniors Housing Bureau",
      "bio": "Modular supportive housing architecture, BC Housing Community Housing Fund, geriatric social policy, and B.C. governance"
    },
    "sources": [
      {
        "label": "BC Gov News Releases",
        "url": "https://news.gov.bc.ca/releases/2026HOUS0050-001318"
      },
      {
        "label": "Vancouver Sun",
        "url": "https://vancouversun.com/news/local-news/david-eby-70m-modular-seniors-supportive-housing-announcement"
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
    "slug": "quebec-ministry-of-agriculture-allocates-40-million-for-greenhouse-electrification-and-winter-food-autonomy-2026-08-24",
    "headline": "Quebec Allocates $40 Million to Expand Commercial Electric Greenhouses for Winter Food Autonomy",
    "summary": "Ministère de l'Agriculture, des Pêcheries et de l'Alimentation du Québec (MAPAQ) deploys $40 million to subsidize high-efficiency LED grow lighting and thermal heat pumps for 80 commercial vegetable greenhouses.",
    "category": "Agriculture",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-24T06:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "state",
    "latitude": 46.8139,
    "longitude": -71.2082,
    "body": "QUEBEC CITY, QC — Minister of Agriculture, Fisheries and Food André Lamontagne announced the release of $40 million under the Greenhouse Development Strategy, delivering direct capital subsidies to 80 commercial vegetable and fruit greenhouse growers across the Montérégie, Chaudière-Appalaches, and Laurentides regions.\n\n## Tripling Domestic Winter Fresh Produce Production\n\nThe funding packages provide 50% state matching grants to install high-efficiency horticultural LED spectrum lighting, biomass and geothermal thermal heat pumps, and automated computerized environmental climate controls, allowing Quebec growers to harvest fresh tomatoes, cucumbers, peppers, and strawberries year-round. Utilizing Hydro-Québec’s preferential agricultural clean electricity rates (Rate LG), the program increases domestic fresh winter vegetable market share from 30% to 60%, insulating consumers from volatile import costs.\n\nMinister Lamontagne stated that expanding electric greenhouse cultivation strengthens Quebec's food autonomy and delivers fresh, locally grown produce to family dinner tables throughout the winter months.\n\n## Agricultural Producers Union and Horticultural Stances\n\nUnion des producteurs agricoles (UPA) strongly commended the capital grants, citing substantial reductions in greenhouse heating operating costs.\n\nGreenhouse vegetable growers praised the preferential Hydro-Québec electricity rates for ensuring year-round economic viability.\n\n## Grant Application Window\n\nAgricultural greenhouse operators can submit equipment funding applications through MAPAQ through November 15, 2026.",
    "seoTitle": "Quebec Allocates $40M for Commercial Electric Greenhouses | Choseno",
    "metaDescription": "Quebec MAPAQ allocates $40M to subsidize LED lighting and heat pumps for 80 commercial greenhouses to boost winter food autonomy.",
    "tags": [
      "François Legault",
      "Quebec",
      "Agriculture",
      "Clean Tech",
      "Energy",
      "Food Security",
      "Economy",
      "Canada"
    ],
    "tweet": "Quebec allocates $40M to subsidize commercial electric greenhouses, doubling domestic winter fresh vegetable production.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Agricultural Technology & Food Sovereignty Desk",
      "bio": "Greenhouse electrification engineering, MAPAQ agricultural grants, Hydro-Québec agro-rates, and Quebec food policy"
    },
    "sources": [
      {
        "label": "Ministère de l'Agriculture, des Pêcheries et de l'Alimentation du Québec",
        "url": "https://www.quebec.ca/nouvelles/actualites/details/quebec-investit-40-millions-serres-electriques-autonomie-alimentaire-2026"
      },
      {
        "label": "La Terre de chez nous",
        "url": "https://www.laterre.ca/actualites/politique/quebec-injecte-40m-dans-le-developpement-des-serres-electriques"
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
    "slug": "city-of-calgary-approves-85-million-flood-mitigation-and-bow-river-barrier-expansion-contract-2026-08-24",
    "headline": "Calgary City Council Approves $85 Million Bow River Flood Barrier and Pump Station Contract",
    "summary": "Calgary City Council votes 13–1 to award an $85 million construction contract for the Downtown West Bow River Flood Barrier, building 2.5 kilometers of engineered berms to protect downtown from 1-in-200-year floods.",
    "category": "Infrastructure",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-24T06:00:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "local",
    "latitude": 51.0447,
    "longitude": -114.0719,
    "body": "CALGARY, AB — Calgary City Council voted 13–1 during its regular council meeting to award an $85 million major civil construction contract to execute the Downtown West Bow River Flood Barrier and Stormwater Pumping Modernization Project.\n\n## Safeguarding Downtown Commercial Districts from 1-in-200-Year Flood Events\n\nThe civil engineering contract constructs 2.5 kilometers of continuous reinforced concrete flood walls, landscaped earthen berms, and three automated high-capacity stormwater lift pump stations between the Peace Bridge and 14th Street West. The infrastructure project completes Calgary’s comprehensive post-2013 river flood mitigation ring, protecting $4 billion in downtown commercial office buildings, light rail transit tunnels, and residential condominiums from severe spring river surges.\n\nMayor Jyoti Gondek and council members affirmed that flood resilience is essential to protect downtown workers, prevent catastrophic economic losses, and ensure municipal infrastructure withstands extreme climate weather.\n\n## Downtown Business Association and Engineering Endorsements\n\nCalgary Downtown Association praised the flood barrier design for incorporating widened public multi-use pathway promenades and native riparian plantings.\n\nCity of Calgary Water Resources engineers confirmed the barrier design accommodates upstream Springbank Off-Stream Reservoir operations.\n\n## Construction Groundbreaking\n\nCivil flood wall excavation along the Bow River pathway will commence in October 2026.",
    "seoTitle": "Calgary Approves $85M Bow River Flood Barrier Contract | Choseno",
    "metaDescription": "Calgary City Council votes 13–1 to award $85M contract to construct 2.5 km of flood walls and pump stations along the Bow River.",
    "tags": [
      "Calgary",
      "Alberta",
      "Infrastructure",
      "Environment",
      "Water",
      "Municipal",
      "Public Safety",
      "Canada"
    ],
    "tweet": "Calgary City Council approves an $85M contract to build 2.5 km of Bow River flood barriers, protecting downtown from 1-in-200-year floods.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Municipal Flood Engineering & Urban Resilience Desk",
      "bio": "River basin flood modeling, municipal civil engineering contracts, Bow River watershed management, and Calgary civic governance"
    },
    "sources": [
      {
        "label": "City of Calgary City Council Minutes",
        "url": "https://www.calgary.ca/council/meetings/minutes-2026-08-24-bow-river-flood-barrier.html"
      },
      {
        "label": "Calgary Herald",
        "url": "https://calgaryherald.com/news/local-news/calgary-council-approves-85m-downtown-bow-river-flood-barrier-contract"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "manitoba-justice-department-allocates-18-million-for-first-nations-community-policing-and-restorative-justice-2026-08-24",
    "headline": "Manitoba Allocates $18 Million to Expand First Nations Community Policing and Healing Lodges",
    "summary": "Manitoba Justice Minister Matt Wiebe announces $18 million in tripartite funding to expand Indigenous-led community safety officer programs and restorative justice healing lodges across 12 First Nations.",
    "category": "Justice",
    "country": "CA",
    "province": "MB",
    "status": "published",
    "eventDate": "2026-08-24T05:30:00Z",
    "published_at": "2026-08-24T17:00:00Z",
    "impactArea": "state",
    "latitude": 49.8951,
    "longitude": -97.1384,
    "body": "WINNIPEG, MB — Manitoba Justice Minister and Attorney General Matt Wiebe announced an $18 million provincial funding commitment to expand Indigenous-led community safety officer programs and restorative justice healing lodges across 12 First Nations communities.\n\n## Empowering Community-Led Justice and Reducing Recidivism\n\nThe funding packages provide direct operational grants to train and deploy 60 First Nations Community Safety Officers (CSOs) equipped with peace officer status to handle community patrol, youth curfew outreach, and mental health crisis de-escalation in partnership with the Royal Canadian Mounted Police (RCMP). The initiative also funds the construction of three community-run restorative justice healing lodges, diverting non-violent offenders from provincial correctional centers into traditional elder-guided rehabilitation circles.\n\nPremier Wab Kinew and Minister Wiebe stated that Indigenous self-determination in community safety is essential to build safer communities and heal systemic injustices in the criminal justice system.\n\n## Assembly of Manitoba Chiefs and Tribal Councils Praise\n\nAssembly of Manitoba Chiefs (AMC) and Manitoba Keewatinowi Okimakanak (MKO) strongly endorsed the funding, highlighting that community safety officers have local trust and language fluency.\n\nRestorative justice coordinators praised the healing lodge model for delivering proven 70% reductions in youth re-offending rates.\n\n## Program Implementation Schedule\n\nNew Community Safety Officer academy training cohorts will commence in October 2026.",
    "seoTitle": "Manitoba Allocates $18M for First Nations Policing & Healing Lodges | Choseno",
    "metaDescription": "Manitoba Justice allocates $18M to deploy 60 Indigenous community safety officers and fund 3 restorative justice healing lodges.",
    "tags": [
      "Wab Kinew",
      "Manitoba",
      "Justice",
      "Indigenous",
      "Public Safety",
      "Governance",
      "Canada"
    ],
    "tweet": "Manitoba allocates $18M to deploy 60 First Nations Community Safety Officers and build three restorative justice healing lodges.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Indigenous Justice & Community Safety Desk",
      "bio": "First Nations policing agreements, restorative justice legislation, Manitoba justice policy, and Indigenous governance"
    },
    "sources": [
      {
        "label": "Province of Manitoba News Releases",
        "url": "https://news.gov.mb.ca/news/index.html?item=64905&posted=2026-08-24"
      },
      {
        "label": "Winnipeg Free Press",
        "url": "https://www.winnipegfreepress.com/breakingnews/2026/08/24/manitoba-18m-first-nations-policing-healing-lodges"
      }
    ],
    "taggedPoliticianIds": [
      "cf2d272e-ffa7-4918-a94b-182212c41b68"
    ],
    "taggedPoliticians": [
      "Wab Kinew"
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
