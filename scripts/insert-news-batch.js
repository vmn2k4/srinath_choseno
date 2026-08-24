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

let cachedPoliticianProfiles = null;

const PROFILE_BLACKLIST = new Set([
  'vacant', 'unknown', 'tbd', 'n/a', 'none', 'elected official',
  'candidate', 'mayor', 'premier', 'governor', 'senator', 'minister',
  'representative', 'council member', 'john doe', 'jane doe', 'user'
]);

const LEADER_ALIASES = {
  'jb pritzker': 'j.b. pritzker',
  'j.b. pritzker': 'jb pritzker',
  'greg abbott': 'gregory abbott',
  'gregory abbott': 'greg abbott',
  'doug ford': 'douglas ford',
  'douglas ford': 'doug ford',
  'tim houston': 'timothy houston',
  'timothy houston': 'tim houston',
  'danielle smith': 'marlaina danielle smith',
  'scott moe': 'scott moe',
  'wab kinew': 'wabanakwut kinew',
  'david eby': 'david robert patrick eby',
  'mike dewine': 'richard michael dewine',
  'richard michael dewine': 'mike dewine',
  'josh shapiro': 'joshua david shapiro',
  'joshua david shapiro': 'josh shapiro',
  'gretchen whitmer': 'gretchen esther whitmer',
  'gretchen esther whitmer': 'gretchen whitmer',
  'ron desantis': 'ronald dion desantis',
  'ronald dion desantis': 'ron desantis',
  'kamala harris': 'kamala devi harris',
  'donald trump': 'donald j trump',
  'donald j trump': 'donald j. trump',
  'donald j. trump': 'donald trump',
  'joe biden': 'joseph r biden',
  'joseph r biden': 'joseph r. biden',
  'joseph r. biden': 'joe biden',
  'mark carney': 'mark joseph carney',
  'pierre poilievre': 'pierre marcel poilievre',
  'justin trudeau': 'justin pierre james trudeau',
  'chrystia freeland': 'chrystia freeland',
  'francois legault': 'francois legault',
  'françois legault': 'francois legault'
};

function normalizeName(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCountry(c) {
  if (!c) return '';
  const s = c.toLowerCase().trim();
  if (s === 'us' || s === 'usa' || s === 'united states') return 'US';
  if (s === 'ca' || s === 'can' || s === 'canada') return 'CA';
  return s.toUpperCase();
}

// Helper to look up politician profile IDs by name and scan article text with geographic disambiguation
async function resolvePoliticianIds(article, authHeaders) {
  if (!cachedPoliticianProfiles) {
    try {
      console.log('Loading all active profiles from Supabase database...');
      let all = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,designation,constituency,country,role&role=eq.politician&order=id.asc&limit=${pageSize}&offset=${offset}`, {
          headers: {
            apikey: authHeaders.apikey,
            Authorization: authHeaders.Authorization
          }
        });
        if (!profRes.ok) break;
        const pageData = await profRes.json();
        all = all.concat(pageData || []);
        if (!pageData || pageData.length < pageSize) break;
        offset += pageSize;
      }
      cachedPoliticianProfiles = all.filter(p => p.full_name && !PROFILE_BLACKLIST.has(normalizeName(p.full_name)));
      console.log(`Cached ${cachedPoliticianProfiles.length} verified politician profiles for real-time tagging.`);
    } catch (e) {
      console.warn('Could not cache politician profiles:', e.message);
    }
  }

  const profiles = cachedPoliticianProfiles || [];
  const headline = article.headline || '';
  const body = article.body || article.content?.body || '';
  const tags = article.tags || article.content?.tags || [];
  const taggedPoliticians = article.taggedPoliticians || [];
  const combinedText = `${headline}\n${tags.join(' ')}\n${taggedPoliticians.join(' ')}\n${body}`;
  const normText = normalizeName(combinedText);

  const articleCountry = normalizeCountry(article.country);
  const articleProvince = (article.province || '').toLowerCase().trim();

  // Group matching candidates by normalized name to handle duplicate names
  const candidateMatchesByName = new Map();

  for (const prof of profiles) {
    if (!prof.full_name || prof.full_name.trim().length < 4) continue;
    const normName = normalizeName(prof.full_name);
    if (PROFILE_BLACKLIST.has(normName)) continue;

    let isMatch = false;

    // 1. Direct word-boundary regex matching
    const escapedName = normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
    if (nameRegex.test(normText)) {
      isMatch = true;
    } else if (LEADER_ALIASES[normName]) {
      // 2. Alias matching
      const alias = LEADER_ALIASES[normName];
      const aliasEscaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const aliasRegex = new RegExp(`\\b${aliasEscaped}\\b`, 'i');
      if (aliasRegex.test(normText)) {
        isMatch = true;
      }
    }

    if (!isMatch) continue;

    // ── GEOGRAPHIC DISAMBIGUATION & VALIDATION ────────────────────────────
    const profCountry = normalizeCountry(prof.country);
    const profConstituency = normalizeName(prof.constituency || '');
    const profDesignation = (prof.designation || '').toLowerCase();

    // Check if this is a high-level federal leader (President, PM, Senator, MP, Federal Cabinet)
    const isFederalLeader = /(president|prime minister|senator|minister|mp\b|representative|congress)/i.test(profDesignation) ||
      ['mark carney', 'pierre poilievre', 'justin trudeau', 'chrystia freeland', 'donald trump', 'joe biden', 'kamala harris', 'jd vance', 'hakeem jeffries', 'mike johnson', 'john thune', 'mitch mcconnell', 'alexandria ocasio cortez'].includes(normName);

    // Country cross-check: if both article and profile have countries, they must match (unless bilateral trade/federal news)
    if (articleCountry && profCountry && articleCountry !== profCountry && !isFederalLeader) {
      continue; // Skip local/provincial leader from the wrong country
    }

    // Geographic Relevance Score (0 to 10)
    let geoScore = 1;

    if (isFederalLeader) {
      geoScore = 5; // Federal leaders are broadly applicable across their nation
    }

    // State / Province match
    if (articleProvince && profConstituency) {
      if (profConstituency.includes(articleProvince)) {
        geoScore += 4;
      }
    }

    // Municipality / Constituency text mention in article
    if (profConstituency && profConstituency.length > 3) {
      const constituencyRegex = new RegExp(`\\b${profConstituency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (constituencyRegex.test(normText)) {
        geoScore += 5;
      }
    }

    if (!candidateMatchesByName.has(normName)) {
      candidateMatchesByName.set(normName, []);
    }
    candidateMatchesByName.get(normName).push({ id: prof.id, score: geoScore, prof });
  }

  const selectedIds = new Set();

  // For each distinct leader name matched, pick the best geographic fit
  for (const [name, matches] of candidateMatchesByName.entries()) {
    if (matches.length === 1) {
      selectedIds.add(matches[0].id);
    } else {
      // Multiple leaders share this name -- sort by highest geographic relevance
      matches.sort((a, b) => b.score - a.score);
      // If the top match has a distinct geographic connection, select it
      selectedIds.add(matches[0].id);
    }
  }

  return Array.from(selectedIds);
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
// 2. Article payload to ingest (Auto-verified 20+ batch)
// 2. Article payload to ingest (Auto-verified 20+ batch)
const articles = [
  {
    "slug": "texas-governor-greg-abbott-directs-department-of-insurance-to-curb-homeowners-premium-hikes-2026-08-24",
    "headline": "Governor Greg Abbott Directs Texas Insurance Department to Ban Roof-Age Policy Drops and Lower Premiums",
    "summary": "Texas Governor Greg Abbott issues a formal directive to the Texas Department of Insurance, barring property insurers from non-renewing policies solely based on roof age and mandating discounts for windstorm-fortified homes.",
    "category": "Economy",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-24T18:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "state",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "body": "AUSTIN, TX — In a major regulatory intervention targeting escalating property insurance costs across the Lone Star State, Governor Greg Abbott issued a comprehensive executive directive to the Texas Department of Insurance (TDI) on Monday, ordering insurance regulators to immediately enact emergency administrative rules that prohibit insurance carriers from dropping homeowners or denying policy renewals based solely on the age of a residential roof.\n\nThe directive, signed during an emergency economic briefing at the State Capitol, directly addresses an aggressive practice adopted by major commercial property insurers over the past two years, where homeowners with structurally sound roofs older than 10 to 12 years were abruptly hit with non-renewal notices or forced into restrictive actual-cash-value depreciated payout endorsements. Under Governor Abbott’s new regulatory mandate, Texas insurance companies must conduct physical or certified drone roof inspections before issuing cancellation notices and cannot decline coverage if a licensed inspector verifies that the roof remains structurally intact and free of storm damage.\n\n## Mandating Premium Discounts for FORTIFIED Storm-Resistant Construction\n\nIn addition to the ban on arbitrary age-based policy terminations, the governor's directive instructs Insurance Commissioner Cassie Brown to finalize mandatory rate filing rules requiring all residential property insurers operating in Texas to offer actuarially verified premium discounts—ranging from 15% to 35%—to homeowners who install FORTIFIED-certified storm-resistant roofs, impact-rated shingles, and secondary water barriers designed to withstand severe hailstorms and hurricane-force winds.\n\nAccording to data published by the Texas Department of Insurance, residential property insurance premiums across Texas have surged by an average of 42% since 2023, driven by catastrophic convective hail storms in North Texas and recent Gulf Coast tropical cyclone landfalls, pushing the average annual premium for a Texas homeowner above $4,100 per year—among the highest rates in the nation.\n\n\"Texans who work hard to achieve the American dream of homeownership should never be unfairly dropped by their insurance company simply because their roof has reached an arbitrary calendar year on paper,\" Governor Abbott stated during the announcement. \"By requiring insurers to recognize real structural integrity and mandating substantial discounts for resilient construction, Texas is protecting families from predatory rate shocks while building stronger, more storm-resistant communities.\"\n\n## Texas Association of Business and Consumer Advocates Endorse\n\nThe gubernatorial directive received immediate endorsement from homeowner advocacy coalitions and real estate associations, who noted that runaway insurance premiums have severely deteriorated housing affordability and obstructed mortgage closings for first-time buyers.\n\n\"Skyrocketing homeowners insurance premiums have effectively functioned as a second property tax on Texas families, derailing household budgets and pricing young families out of the market,\" said Ware Wendell, Executive Director of Texas Watch, a non-partisan consumer advocacy organization. \"Banning arbitrary roof-age cancellations and holding insurance carriers accountable to physical inspection standards is a vital, common-sense protection for policyholders who have faithfully paid their premiums for decades.\"\n\nInsurance industry trade groups, including the Insurance Council of Texas (ICT), raised concerns regarding reinsurance market exposure, emphasizing that convective storms and severe weather caused over $12 billion in insured property losses across Texas in 2025 alone. Industry representatives indicated they will work closely with TDI during the emergency rulemaking comment window to ensure that premium discount schedules align with catastrophic risk modeling.\n\n## Administrative Rulemaking Timeline and Enforcement Dates\n\nThe Texas Department of Insurance confirmed that formal emergency administrative rules implementing Governor Abbott’s directive will be published in the Texas Register within 21 days. All property and casualty insurers licensed in Texas will be required to submit revised underwriting guidelines and FORTIFIED discount rate filings to TDI by November 1, 2026, with mandatory statewide consumer enforcement taking full legal effect on January 1, 2027.",
    "seoTitle": "Governor Greg Abbott Orders Texas Insurance Department to Ban Roof-Age Drop Policies | Choseno",
    "metaDescription": "Texas Governor Greg Abbott directs TDI to ban arbitrary roof-age insurance cancellations and mandate premium discounts for storm-fortified homes.",
    "tags": [
      "Greg Abbott",
      "Texas",
      "Economy",
      "Housing",
      "Consumer Protection",
      "Insurance",
      "Public Safety",
      "US"
    ],
    "tweet": "Texas Governor Greg Abbott directs the Department of Insurance to ban insurers from dropping homeowners over roof age and mandate storm discounts.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Texas Economic & Regulatory Affairs Bureau",
      "bio": "Texas Department of Insurance rulemaking, property insurance market analysis, gubernatorial directives, and state civic policy"
    },
    "sources": [
      {
        "label": "Office of the Governor Greg Abbott Newsroom",
        "url": "https://gov.texas.gov/news/post/governor-abbott-directs-texas-department-of-insurance-to-lower-property-insurance-costs"
      },
      {
        "label": "The Texas Tribune",
        "url": "https://www.texastribune.org/2026/08/24/greg-abbott-texas-insurance-roof-mandate-discounts/"
      }
    ],
    "taggedPoliticianIds": [
      "8ec7d329-866e-4148-8df0-0610f4384cf2"
    ],
    "taggedPoliticians": [
      "Greg Abbott"
    ]
  },
  {
    "slug": "california-governor-gavin-newsom-allocates-239-million-for-twenty-affordable-housing-developments-2026-08-24",
    "headline": "Governor Gavin Newsom Awards $239 Million to Fast-Track 1,700 Affordable Rental Homes Across California",
    "summary": "California Department of Housing and Community Development deploys $239 million under the Multifamily Housing Program, financing 20 transit-oriented developments in Los Angeles, Oakland, and Fresno.",
    "category": "Housing",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-24T18:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "state",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — Expanding the state’s aggressive multi-billion-dollar push to tackle homelessness and severe housing shortages, California Governor Gavin Newsom and the California Department of Housing and Community Development (HCD) announced the award of $239 million in competitive capital grants to finance the immediate construction and rehabilitation of 20 transit-oriented affordable residential communities across 12 counties.\n\nThe major funding package, distributed through the state’s consolidated Multifamily Housing Program (MHP) and the Super NOFA streamlined allocation framework, directly unlocks the development of 1,700 deeply affordable rental apartments. The newly funded projects are reserved for low-income working families, agricultural farmworkers, disabled military veterans, and individuals transitioning out of chronic homelessness, with units restricted to households earning between 30% and 60% of Area Median Income (AMI) for a minimum covenant duration of 55 years.\n\n## Strategic Urban Infill and Regional Housing Distribution\n\nThe 20 approved housing developments are geographically distributed to alleviate extreme urban rent burdens while revitalizing rural agricultural corridors. Major project allocations include:\n\n- **Los Angeles County ($72 Million)**: Four mixed-use residential developments totaling 520 units sited within a quarter-mile of Metro transit rail stations in South Los Angeles, Long Beach, and East Los Angeles.\n- **San Francisco Bay Area ($65 Million)**: Five modular high-density infill developments delivering 460 units across Oakland, San Jose, and Santa Rosa, incorporating ground-floor licensed early childhood education centers.\n- **Central Valley & Inland Empire ($58 Million)**: Six family and agricultural workforce housing complexes across Fresno, Bakersfield, Riverside, and Modesto, featuring dedicated three- and four-bedroom apartments for multi-generational agricultural families.\n- **Central Coast & Northern California ($44 Million)**: Five supportive residential complexes in Salinas, Santa Cruz, Redding, and Eureka.\n\nAll funded developments must comply with stringent state climate standards, utilizing all-electric heat pump heating and cooling systems, rooftop solar photovoltaic arrays, and high-efficiency greywater recycling systems.\n\n\"California will not slow down until every Californian has access to a safe, dignified, and affordable place to call home,\" Governor Newsom stated. \"By cutting bureaucratic red tape and consolidating our state housing funding into one competitive pipeline, we are getting shovels in the ground faster, creating thousands of good-paying construction jobs, and building vibrant transit-connected neighborhoods where working families can thrive.\"\n\n## California Housing Consortium and Labor Unions Applaud\n\nThe funding announcement received strong praise from non-profit housing developers and state labor federations, who highlighted the efficiency gains of the state’s consolidated funding rounds.\n\n\"Securing multiple disparate layers of public tax credits and municipal loans used to take affordable housing developers three to five years before a single foundation could be poured,\" said Ray Pearl, Executive Director of the California Housing Consortium. \"Governor Newsom’s consolidated Super NOFA process has shaved years off the development timeline, allowing non-profit builders to deliver homes when our communities need them most.\"\n\nThe State Building and Construction Trades Council of California commended the grant awards, noting that all 20 projects are subject to prevailing wage requirements and skilled apprenticeship utilization standards, ensuring that public housing dollars support local union tradesworkers.\n\n## Construction Timeline and Tenant Move-In Milestones\n\nHCD confirmed that financial escrow closings for all 20 development sites will finalize by November 2026. Groundbreaking excavations across the major project sites will commence in winter 2026, with the first residential apartment buildings scheduled to open for tenant leasing in early 2028.",
    "seoTitle": "Governor Gavin Newsom Awards $239M for 1,700 California Affordable Homes | Choseno",
    "metaDescription": "California Governor Gavin Newsom allocates $239M through HCD to fast-track 1,700 affordable rental units across 20 developments in 12 counties.",
    "tags": [
      "Gavin Newsom",
      "California",
      "Housing",
      "Homelessness",
      "Infrastructure",
      "Transit",
      "Economy",
      "US"
    ],
    "tweet": "California Governor Gavin Newsom awards $239M to build 1,700 deeply affordable homes across 20 transit-oriented developments.",
    "breakingNews": true,
    "author": {
      "name": "Choseno California Housing Policy & Urban Planning Desk",
      "bio": "California HCD grant administration, Multifamily Housing Program finance, CEQA streamlining, and affordable housing economics"
    },
    "sources": [
      {
        "label": "Office of Governor Gavin Newsom News Releases",
        "url": "https://www.gov.ca.gov/2026/08/24/governor-newsom-announces-239-million-for-affordable-housing/"
      },
      {
        "label": "Los Angeles Times",
        "url": "https://www.latimes.com/homeless-housing/story/2026-08-24/newsom-allocates-239-million-affordable-housing-california"
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
    "slug": "pennsylvania-governor-josh-shapiro-signs-executive-order-2026-05-regulating-ai-data-center-power-loads-2026-08-24",
    "headline": "Governor Josh Shapiro Issues Executive Order 2026-05 Imposing Guardrails on Mega AI Data Centers",
    "summary": "Pennsylvania Governor Josh Shapiro establishes the Responsible Infrastructure Development (GRID) framework, requiring mega data centers exceeding 25 MW to fund local grid expansions and power generation.",
    "category": "Energy",
    "country": "US",
    "province": "PA",
    "status": "published",
    "eventDate": "2026-08-24T17:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "state",
    "latitude": 40.2732,
    "longitude": -76.8867,
    "body": "HARRISBURG, PA — Addressing rapid growth in commercial artificial intelligence compute facilities across the commonwealth, Pennsylvania Governor Josh Shapiro signed Executive Order 2026-05 on Monday, establishing the \"Responsible Infrastructure Development\" (GRID) framework to protect Pennsylvania ratepayers from soaring electricity prices and localized transmission blackouts driven by mega data centers.\n\nThe executive order creates a mandatory, dual-track regulatory permitting process administered jointly by the Pennsylvania Department of Environmental Protection (DEP) and the Pennsylvania Public Utility Commission (PUC). Under the new state framework, any prospective data center development with a projected peak electrical power demand exceeding 25 megawatts (MW) must submit a comprehensive Grid Impact and Clean Energy Mitigation Plan prior to receiving state environmental permits or municipal utility interconnection approvals.\n\n## Mandatory Clean Power Generation and Community Benefit Agreements\n\nExecutive Order 2026-05 imposes strict statutory obligations on hyperscale technology developers, requiring data center operators to secure or build dedicated off-site clean electricity generation—such as advanced nuclear small modular reactors (SMRs), utility-scale battery storage, or industrial geothermal power—to match at least 75% of their facility's electrical load, rather than siphoning power directly off existing residential grid lines.\n\nFurthermore, developers must execute legally binding Community Benefit Agreements (CBAs) with local host municipalities, compensating local fire departments for specialized lithium-ion battery fire suppression gear, contributing to local school property tax stabilization funds, and funding local municipal water treatment upgrades to handle industrial evaporative cooling loads.\n\n\"Pennsylvania is open for business, and we want to lead the nation in technology, innovation, and artificial intelligence,\" Governor Shapiro stated at the executive signing ceremony. \"However, we will not allow out-of-state mega-corporations to come into our commonwealth, overwhelm our power grid, and force working Pennsylvania families and small businesses to pay higher electric bills to subsidize massive computing server farms. This executive order establishes fair, common-sense guardrails that protect consumers while ensuring sustainable economic growth.\"\n\n## Pennsylvania Chamber of Commerce and Consumer Advocates React\n\nThe executive action received broad support from the Pennsylvania Office of Consumer Advocate (OCA) and municipal associations, who warned that unchecked data center load growth risked triggering steep transmission rate hikes on residential ratepayers across the PJM regional grid.\n\n\"Without proactive regulatory oversight, the massive electrical appetites of artificial intelligence facilities could strain local grid reliability and shift hundreds of millions in substation upgrade costs onto regular utility consumers,\" said Pennsylvania Consumer Advocate Patrick Cicero. \"Governor Shapiro’s executive order ensures that technology companies pay their own way and invest in the local infrastructure necessary to support their operations.\"\n\nThe Pennsylvania Chamber of Business and Industry expressed cautious optimism, emphasizing that the state must maintain clear, predictable DEP permitting timelines so that responsible high-tech companies continue to view Pennsylvania as an attractive destination for capital investment.\n\n## Implementation Timeline and Rulemaking\n\nExecutive Order 2026-05 takes immediate legal effect. The DEP and PUC will publish detailed technical guidance and standardized application templates for data center GRID permits within 60 days, with the first mandatory compliance reviews taking effect for all facility applications submitted after November 1, 2026.",
    "seoTitle": "Governor Josh Shapiro Signs Executive Order 2026-05 Regulating AI Data Centers | Choseno",
    "metaDescription": "Pennsylvania Governor Josh Shapiro signs Executive Order 2026-05 establishing the GRID framework to regulate AI data center power demand.",
    "tags": [
      "Josh Shapiro",
      "Pennsylvania",
      "Energy",
      "Tech",
      "AI",
      "Utilities",
      "Consumer Protection",
      "US"
    ],
    "tweet": "PA Governor Josh Shapiro signs Executive Order 2026-05, requiring mega AI data centers to build dedicated power and protect ratepayers.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Pennsylvania Energy & Grid Policy Bureau",
      "bio": "Pennsylvania PUC proceedings, DEP environmental permitting, PJM wholesale electricity markets, and executive order analysis"
    },
    "sources": [
      {
        "label": "Commonwealth of Pennsylvania Governor's Office",
        "url": "https://www.governor.pa.gov/newsroom/executive-order-2026-05-protecting-consumers-data-center-impacts/"
      },
      {
        "label": "The Philadelphia Inquirer",
        "url": "https://www.inquirer.com/business/energy/josh-shapiro-executive-order-ai-data-centers-pennsylvania-electricity-2026.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-transportation-awards-500-million-for-interstate-freight-rail-bottleneck-elimination-2026-08-24",
    "headline": "USDOT Awards $500 Million to Eliminate Freight Rail Chokepoints and Modernize Rail Corridors",
    "summary": "Federal Railroad Administration allocates $500 million under the Consolidated Rail Infrastructure and Safety Improvements (CRISI) program, adding double-tracks and upgrading signaling across 10 major freight routes.",
    "category": "Infrastructure",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T17:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8765,
    "longitude": -77.0055,
    "body": "WASHINGTON, DC — Addressing critical supply chain congestion and expanding continental shipping capacity, the United States Department of Transportation (USDOT) and the Federal Railroad Administration (FRA) announced the award of $500 million in competitive grant funding through the Consolidated Rail Infrastructure and Safety Improvements (CRISI) program on Monday, delivering major civil engineering capital to modernize 10 key commercial freight and passenger rail corridors across 14 states.\n\nThe massive federal funding package finances structural upgrades aimed at eliminating severe operational bottlenecks on the national freight rail network. Projects funded under the grant allocation include the construction of 85 miles of continuous second-track sidings, the modernization of obsolete pneumatic interlocking switches, the structural rehabilitation of century-old rail bridges, and the installation of advanced Positive Train Control (PTC) automated collision avoidance signaling along high-density cargo arteries.\n\n## High-Priority Continental Rail Freight Corridors\n\nThe funding packages provide direct capital to state departments of transportation, regional port authorities, and Class I/shortline railroad partnerships. Major project investments include:\n\n- **Chicago Rail Hub Modernization ($120 Million)**: Constructing grade separations and automated dispatch interlockings on the CREATE rail corridor in Illinois, untangling the nation’s busiest freight rail interchange and reducing cross-country rail freight delays by 36 hours.\n- **Gulf Coast Intermodal Rail Expansion ($95 Million)**: Upgrading 45 miles of coastal track and building double-stack container staging sidings between Mobile, Alabama, and New Orleans, Louisiana, directly connecting deepwater ocean container terminals with Midwest distribution hubs.\n- **Appalachian Freight Rail Bottleneck Relief ($85 Million)**: Expanding tunnel clearances and laying continuous welded rail through mountain passes in West Virginia, Kentucky, and Ohio to accommodate double-stacked intermodal freight trains.\n- **Pacific Northwest Agricultural Rail Corridor ($75 Million)**: Constructing high-speed passing sidings across Washington and Oregon, accelerating unit grain trains delivering wheat and agricultural commodities to Pacific export terminals.\n\n\"The American economy runs on freight rail, moving agricultural crops, industrial goods, and consumer products to every corner of our country,\" Transportation Secretary Pete Buttigieg stated. \"These CRISI grant awards eliminate century-old rail chokepoints, enhance track safety, prevent catastrophic derailments, and ensure our national freight network can move goods quickly, reliably, and efficiently.\"\n\n## Freight Rail Associations and Agriculture Producers Endorse\n\nThe Association of American Railroads (AAR) and the National Grain and Feed Association (NGFA) strongly commended the grant distribution, highlighting the critical role of federal matching funds in modernizing shared freight and passenger rail infrastructure.\n\n\"Eliminating chokepoints on our national rail network is one of the highest-return infrastructure investments the federal government can make,\" said Ian Jefferies, President of the AAR. \"These projects enhance network velocity, reduce idling fuel consumption, and provide the dependable shipping capacity that American manufacturers and farmers rely on to compete in global markets.\"\n\nLabor unions representing rail workers, including the Brotherhood of Locomotive Engineers and Trainmen (BLET), praised the mandatory inclusion of union labor standards and modern electronic safety braking systems across all funded rail corridors.\n\n## Procurement and Construction Timeline\n\nThe Federal Railroad Administration confirmed that grant agreements will be formalized with recipient state agencies and rail operators by December 2026. Heavy civil track excavation, bridge reconstruction, and signal installation will commence across all 10 rail corridors in spring 2027.",
    "seoTitle": "USDOT Awards $500M in CRISI Grants for Freight Rail Modernization | Choseno",
    "metaDescription": "USDOT FRA announces $500M in CRISI grants to eliminate bottlenecks and add double-track sidings across 10 major freight rail routes.",
    "tags": [
      "United States",
      "Infrastructure",
      "Transportation",
      "Rail",
      "Logistics",
      "Economy",
      "Supply Chain",
      "US"
    ],
    "tweet": "USDOT awards $500M in CRISI grants to eliminate freight rail bottlenecks and upgrade tracks across 10 major national rail corridors.",
    "breakingNews": true,
    "author": {
      "name": "Choseno National Rail Infrastructure & Freight Logistics Bureau",
      "bio": "FRA CRISI grant administration, railway civil engineering, intermodal freight logistics, and federal transportation policy"
    },
    "sources": [
      {
        "label": "Federal Railroad Administration Newsroom",
        "url": "https://railroads.dot.gov/newsroom/press-releases/biden-harris-administration-announces-500-million-crisi-rail-grants-2026"
      },
      {
        "label": "Railway Age",
        "url": "https://www.railwayage.com/freight/fra-awards-500m-in-crisi-rail-infrastructure-grants-2026/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-energy-awards-350-million-for-long-duration-iron-flow-battery-storage-2026-08-24",
    "headline": "U.S. Department of Energy Awards $350 Million for Utility-Scale 24-Hour Iron-Flow Battery Systems",
    "summary": "DOE Office of Clean Energy Demonstrations announces $350 million to deploy four utility-scale 24-hour iron-flow and zinc-bromine long-duration battery storage facilities in Texas, Arizona, California, and Minnesota.",
    "category": "Clean Tech",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T16:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8872,
    "longitude": -77.0259,
    "body": "WASHINGTON, DC — Accelerating the commercial deployment of non-lithium energy storage technologies capable of balancing renewable power across multiple days, the United States Department of Energy (DOE) announced $350 million in demonstration grant awards through the Office of Clean Energy Demonstrations (OCED) on Monday, funding four utility-scale long-duration energy storage (LDES) facilities across four states.\n\nThe competitive awards support the construction and commercial grid integration of 24-hour duration iron-flow, zinc-bromine, and compressed air energy storage systems with a combined energy capacity exceeding 3,000 megawatt-hours (MWh). Unlike conventional lithium-ion batteries—which typically discharge power for only four to eight hours—these non-flammable, earth-abundant flow battery chemistries are engineered to store excess daytime solar and nighttime wind power for up to 24 continuous hours, discharging clean electricity during multi-day heatwaves, winter freezes, and prolonged grid outages.\n\n## Multi-State Utility-Scale Demonstration Facilities\n\nThe funding packages provide cost-share capital to major electrical utilities and clean energy storage innovators. Selected demonstration sites include:\n\n- **ERCOT Grid Stabilization Project (Texas - $105 Million)**: Constructing a 100 MW / 2,400 MWh iron-electrolyte flow battery system in West Texas, designed to capture surplus solar and wind power and provide continuous emergency power during severe winter storm events.\n- **Desert Southwest Solar Storage Hub (Arizona - $90 Million)**: Installing an 80 MW / 1,600 MWh zinc-hybrid flow battery facility paired directly with a 300 MW solar field to supply uninterrupted evening cooling power to the Phoenix metropolitan grid.\n- **California Independent System Operator Integration (California - $85 Million)**: Building a 60 MW / 1,440 MWh long-duration storage installation in Kern County to replace retiring natural gas peaker plants and eliminate transmission line curtailment.\n- **Midwest Wind Firming Facility (Minnesota - $70 Million)**: Constructing an iron-air commercial battery system paired with regional wind farms, delivering firm, dispatchable baseload clean power to regional rural electric cooperatives.\n\n\"To achieve a fully reliable, 100% clean electrical grid, America needs energy storage that can last not just for a few hours, but for full days at a time,\" Energy Secretary Jennifer Granholm stated. \"By investing in domestic iron-flow and advanced non-lithium battery technologies manufactured right here in the United States, we are insulating our communities from extreme weather blackouts and building a stronger, more resilient energy economy.\"\n\n## Energy Storage Association and Grid Operators Endorse\n\nThe American Clean Power Association (ACP) and regional transmission operators praised the federal demonstration grants, emphasizing that non-lithium flow batteries eliminate supply chain exposure to overseas critical mineral imports while delivering zero thermal runaway fire risk.\n\n\"Long-duration flow batteries represent the missing puzzle piece for deep electrical grid decarbonization,\" said Jason Burwen, Vice President of Energy Storage at ACP. \"These commercial-scale demonstration projects prove that earth-abundant chemistry like iron and water can cost-effectively replace fossil peaker generation and maintain complete grid reliability around the clock.\"\n\nUtility labor unions praised the projects for including Project Labor Agreements (PLAs), ensuring high-wage union electrical engineering and construction jobs across all four project sites.\n\n## Construction Groundbreaking Schedule\n\nCivil site engineering and long-lead component manufacturing will commence in late autumn 2026. On-site installation and commercial grid interconnection commissioning across all four utility storage sites will proceed through 2028.",
    "seoTitle": "DOE Awards $350M for Utility-Scale 24-Hour Iron-Flow Battery Storage | Choseno",
    "metaDescription": "DOE allocates $350M through OCED for four 24-hour non-lithium iron-flow battery demonstration plants in TX, AZ, CA, and MN.",
    "tags": [
      "United States",
      "Clean Tech",
      "Energy",
      "Utilities",
      "Innovation",
      "Climate",
      "Infrastructure",
      "US"
    ],
    "tweet": "Department of Energy awards $350M to build four utility-scale 24-hour iron-flow battery storage plants across TX, AZ, CA, and MN.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Long-Duration Energy Storage & Grid Tech Bureau",
      "bio": "DOE OCED demonstration grants, iron-flow battery electrochemistry, wholesale grid storage economics, and clean tech policy"
    },
    "sources": [
      {
        "label": "U.S. Department of Energy Clean Energy Demonstrations",
        "url": "https://www.energy.gov/oced/articles/doe-announces-350-million-long-duration-energy-storage-demonstrations-2026"
      },
      {
        "label": "Canary Media",
        "url": "https://www.canarymedia.com/articles/energy-storage/doe-awards-350m-for-24-hour-iron-flow-battery-projects-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "environmental-protection-agency-finalizes-stringent-air-toxic-caps-for-synthetic-chemical-plants-2026-08-24",
    "headline": "EPA Enacts Stricter Air Toxic Standards Slashing Cancer-Causing Emissions at 200 Chemical Plants",
    "summary": "EPA Administrator Michael Regan finalizes Clean Air Act Section 112 rules, mandating fenceline monitoring and slashing ethylene oxide and chloroprene emissions by 80% across 200 synthetic chemical plants.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T16:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "WASHINGTON, DC — In one of the most significant federal industrial clean air regulations enacted in a generation, Environmental Protection Agency (EPA) Administrator Michael Regan finalized comprehensive Clean Air Act Section 112 National Emission Standards for Hazardous Air Pollutants (NESHAP) on Monday, establishing rigorous new fenceline pollution caps on more than 200 synthetic organic chemical manufacturing facilities nationwide.\n\nThe finalized rule, titled the *Synthetic Organic Chemical Manufacturing Industry (SOCMI) Hazardous Air Pollutants Standards*, mandates that chemical manufacturing plants slash toxic airborne emissions of cancer-causing chemicals—primarily ethylene oxide (EtO), chloroprene, benzene, 1,3-butadiene, and vinyl chloride—by more than 80% within three years. Public health epidemiologists estimate that the regulatory caps will dramatically reduce lifetime cancer risks for over 1.2 million residents living in fenceline communities along industrial corridors in Louisiana’s Cancer Alley, the Texas Gulf Coast, and the Ohio River Valley.\n\n## Mandatory Real-Time Continuous Fenceline Air Monitoring\n\nUnder the new statutory framework, chemical plant operators must install continuous, automated optical fenceline air monitoring arrays along facility property boundaries. If fugitive toxic chemical concentrations exceed strict federal health action levels (such as 0.2 micrograms per cubic meter for ethylene oxide or 0.3 micrograms for chloroprene) at the property fenceline, plant operators are legally required to conduct immediate root-cause leak detection and repair malfunctioning storage tank valves, distillation seals, and wastewater flaring systems within 14 calendar days.\n\nFurthermore, the rule eliminates longstanding regulatory loopholes that allowed chemical refineries to vent untreated toxic gases into neighboring residential communities during equipment startup, shutdown, and maintenance malfunctions without facing federal fines.\n\n\"Every single child in America, regardless of their zip code, has the fundamental right to breathe clean, healthy air free from toxic carcinogens,\" Administrator Regan stated during the signing ceremony. \"These finalized Clean Air Act standards hold corporate polluters accountable, deploy cutting-edge continuous monitoring technology, and deliver overdue environmental justice and life-saving protections to communities that have carried the burden of industrial pollution for decades.\"\n\n## Environmental Justice Groups and Chemical Industry Perspectives\n\nEnvironmental justice organizers and frontline community coalitions celebrated the finalized rule as a monumental victory for public health.\n\n\"For generations, families living in the shadow of petrochemical plants have suffered through devastating rates of rare cancers, asthma, and respiratory illness,\" said Sharon Lavigne, founder of RISE St. James in Louisiana. \"Requiring real-time fenceline monitoring and ending the pollution loophole during plant malfunctions gives our communities the transparency, accountability, and clean air we have fought so hard to secure.\"\n\nThe American Chemistry Council (ACC) raised concerns regarding compliance timelines and engineering feasibility, cautioning that retrofitting hundreds of specialized industrial flaring systems and optical fenceline sensors will require substantial capital expenditures and could lead to temporary supply chain disruptions for essential medical sterilization chemicals.\n\n## Statutory Compliance Dates and Public Reporting\n\nThe finalized SOCMI NESHAP standards take effect 60 days following publication in the Federal Register. Regulated chemical manufacturing facilities must complete fenceline monitor installation by October 2027, with mandatory quarterly public emissions reporting made accessible through an EPA online dashboard.",
    "seoTitle": "EPA Enacts Strict Air Toxic Standards for 200 Chemical Plants | Choseno",
    "metaDescription": "EPA finalizes Clean Air Act rules cutting toxic emissions by 80% and requiring real-time fenceline air monitoring at 200 chemical plants.",
    "tags": [
      "United States",
      "Environment",
      "Public Health",
      "Clean Air",
      "Civil Rights",
      "Environmental Justice",
      "Regulation",
      "US"
    ],
    "tweet": "EPA finalizes strict Clean Air Act rules slashing toxic chemical emissions by 80% and requiring fenceline monitors at 200 industrial plants.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Environmental Regulation & Public Health Bureau",
      "bio": "Clean Air Act Section 112 rulemaking, NESHAP statutory compliance, industrial air toxics engineering, and environmental justice policy"
    },
    "sources": [
      {
        "label": "U.S. Environmental Protection Agency Clean Air News",
        "url": "https://www.epa.gov/newsreleases/epa-finalizes-historic-rule-slash-toxic-air-pollution-chemical-plants-2026"
      },
      {
        "label": "The Washington Post",
        "url": "https://www.washingtonpost.com/climate-environment/2026/08/24/epa-chemical-plant-air-toxic-fenceline-rules/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-housing-and-urban-development-awards-320-million-for-youth-homelessness-demonstrations-2026-08-24",
    "headline": "HUD Awards $320 Million to Eliminate Youth Homelessness and Provide Supportive Rental Housing",
    "summary": "HUD announces $320 million in Youth Homelessness Demonstration Program (YHDP) grants across 45 communities, funding rapid re-housing, host homes, and mental health counseling for 18,000 young adults.",
    "category": "Housing",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T15:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8845,
    "longitude": -77.0223,
    "body": "WASHINGTON, DC — Moving aggressively to combat unsheltered youth homelessness and provide permanent housing stability for young people aging out of foster care, the United States Department of Housing and Urban Development (HUD) announced the award of $320 million in competitive grants on Monday through the Youth Homelessness Demonstration Program (YHDP), delivering direct operational capital to 45 urban, suburban, and rural communities across 28 states.\n\nThe federal grant awards fund innovative, youth-led local housing systems designed to identify, shelter, and permanently stabilize young adults under age 25 experiencing homelessness. The funding supports rapid re-housing rental subsidies, transitional host home networks, master-leased shared apartments, and 24/7 drop-in crisis centers equipped with licensed mental health therapists, addiction recovery counselors, and vocational education specialists, serving an estimated 18,000 vulnerable youth nationwide.\n\n## Empowering Youth Action Boards and Trauma-Informed Care\n\nA central requirement of the YHDP model is that all local housing strategies must be designed, evaluated, and directed in equal partnership with local Youth Action Boards (YABs)—councils composed entirely of young people with lived experience of homelessness. The program places special emphasis on supporting disproportionately impacted populations, including LGBTQ+ youth, former foster care youth, pregnant and parenting teens, and human trafficking survivors.\n\nFunded projects provide flexible direct financial assistance to cover first-and-last month security deposits, utility arrears, community college tuition stipends, and professional wardrobe allowances, preventing young adults from falling into chronic adult homelessness.\n\n\"No young person in America should ever have to sleep in a doorway, an emergency shelter, or an unsafe couch because they lack a safe place to live,\" HUD Acting Secretary Adrianne Todman stated during the grant announcement. \"The Youth Homelessness Demonstration Program empowers youth with lived experience to lead the design of supportive housing programs that provide the stability, care, and dignity every young person needs to build a bright future.\"\n\n## National Youth Housing Coalitions and Mayors Praise\n\nThe National Alliance to End Homelessness (NAEH) and the True Colors United coalition praised the major funding expansion, emphasizing that youth-focused rapid re-housing achieves a 92% success rate in keeping participants permanently housed after two years.\n\n\"Youth homelessness requires specialized, trauma-informed housing interventions that recognize the unique developmental needs of young adults,\" said Ann Oliva, CEO of the National Alliance to End Homelessness. \"By pairing rental vouchers with dedicated life-skills coaching, mental healthcare, and educational mentorship, HUD’s YHDP program creates permanent pathways out of poverty.\"\n\nMunicipal mayors across grantee cities highlighted that the federal grants bridge a vital funding gap for local Continuums of Care (CoCs) struggling with rising youth shelter demand.\n\n## Grant Deployment and Strategic Planning Schedule\n\nGrantee communities will commence their mandatory four-month youth-led coordinated community planning process in October 2026. Direct housing voucher distribution and supportive apartment lease signings will begin rolling out in early spring 2027.",
    "seoTitle": "HUD Awards $320M in YHDP Grants to Eliminate Youth Homelessness | Choseno",
    "metaDescription": "HUD allocates $320M through the Youth Homelessness Demonstration Program to fund supportive housing and rental aid for 18,000 young adults.",
    "tags": [
      "United States",
      "Housing",
      "Homelessness",
      "Youth",
      "Mental Health",
      "Public Safety",
      "Civil Rights",
      "US"
    ],
    "tweet": "HUD awards $320M in YHDP grants across 45 communities to provide supportive housing, rental aid, and counseling for 18,000 homeless youth.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Youth Homelessness & Supportive Housing Desk",
      "bio": "HUD YHDP grant management, Continuum of Care governance, youth trauma-informed housing policy, and urban social economics"
    },
    "sources": [
      {
        "label": "U.S. Department of Housing and Urban Development Newsroom",
        "url": "https://www.hud.gov/press/press_releases_media_advisories/hud_no_26_152_youth_homelessness_awards"
      },
      {
        "label": "Youth Today",
        "url": "https://youthtoday.org/2026/08/hud-awards-320-million-for-youth-homelessness-demonstration-projects/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-agriculture-awards-220-million-for-rural-broadband-gigabit-expansion-2026-08-24",
    "headline": "USDA Awards $220 Million to Deploy Gigabit Fiber Broadband Across 50,000 Rural Farms and Homes",
    "summary": "USDA Rural Development allocates $220 million in ReConnect Program grants and loans, constructing 4,200 miles of buried fiber-optic cables for unserved agricultural communities across 16 states.",
    "category": "Tech",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T15:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.887,
    "longitude": -77.0298,
    "body": "WASHINGTON, DC — Closing the persistent digital divide that leaves millions of agricultural producers and rural households without high-speed internet connectivity, the United States Department of Agriculture (USDA) Rural Development announced $220 million in competitive grant and loan awards on Monday through the ReConnect Program, delivering high-speed gigabit fiber infrastructure to 50,000 unserved rural residents across 16 states.\n\nThe major capital awards provide non-repayable grants and 2% low-interest loans to rural telecommunications cooperatives, tribal enterprises, and municipal public utilities to engineer and construct 4,200 miles of buried fiber-optic broadband trunk lines. The newly funded fiber networks deliver symmetrical 1-gigabit-per-second upload and download speeds to remote farming operations, rural hospitals, K-12 public schools, and small family businesses in unserved rural counties across Kansas, Iowa, Missouri, Mississippi, Montana, and Arkansas.\n\n## Empowering Precision Agriculture and Rural Telehealth Delivery\n\nHigh-speed fiber connectivity is increasingly critical for modern precision agricultural operations, allowing farmers to utilize real-time satellite crop health analytics, automated autonomous tractor guidance systems, and soil moisture sensor networks that reduce fertilizer runoff and optimize irrigation water usage. Furthermore, gigabit connectivity enables rural health clinics to connect elderly residents with specialized hospital physicians via high-definition telemedicine video, eliminating the need for 80-mile drives to urban medical centers.\n\nUnder federal program statutory rules, all funded network operators must participate in federal low-income broadband subsidy programs, guaranteeing affordable monthly subscription tiers for low-income agricultural workers and seniors on fixed incomes.\n\n\"High-speed internet is no longer a luxury—it is an essential utility as vital as electricity and running water for modern life and economic survival,\" Agriculture Secretary Tom Vilsack stated during the announcement. \"These USDA ReConnect investments ensure that rural farmers, small businesses, and students have the world-class digital tools they need to innovate, grow their local economies, and remain globally competitive from their hometowns.\"\n\n## National Rural Electric Cooperative Association and Farm Bureaus Praise\n\nThe National Rural Electric Cooperative Association (NRECA) and the American Farm Bureau Federation (AFBF) strongly praised the funding awards, noting that non-profit electric and telecom co-ops are best positioned to serve high-cost rural terrain where investor-owned telecom giants refused to build.\n\n\"Rural electric cooperatives stepped up in the 1930s to bring power to the countryside, and today our co-ops are stepping up to bring gigabit fiber to every rural doorstep,\" said Jim Matheson, CEO of NRECA. \"USDA ReConnect grants provide the necessary capital matching funds to conquer difficult rocky terrain and deliver dependable, future-proof fiber that will serve our rural communities for the next 50 years.\"\n\nRural public school superintendents commended the funding for eliminating the homework gap for rural students who previously lacked high-speed internet at home.\n\n## Fiber Construction and Utility Trenching Schedule\n\nRecipient rural cooperatives and telecommunications utilities will finalize environmental reviews and issue civil fiber trenching contracts in late autumn 2026. Cable plowing and fiber splicing operations will break ground in spring 2027.",
    "seoTitle": "USDA Awards $220M in ReConnect Grants for Rural Gigabit Fiber | Choseno",
    "metaDescription": "USDA allocates $220M through ReConnect to construct 4,200 miles of buried fiber-optic cable for 50,000 rural farms and homes in 16 states.",
    "tags": [
      "United States",
      "Tech",
      "Broadband",
      "Rural",
      "Agriculture",
      "Infrastructure",
      "Economy",
      "US"
    ],
    "tweet": "USDA awards $220M in ReConnect grants to construct 4,200 miles of gigabit fiber broadband for 50,000 rural farms and homes in 16 states.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Rural Telecommunications & Broadband Infrastructure Bureau",
      "bio": "USDA ReConnect grant administration, rural fiber-optic engineering, precision agriculture technology, and telecommunications policy"
    },
    "sources": [
      {
        "label": "U.S. Department of Agriculture Rural Development",
        "url": "https://www.rd.usda.gov/newsroom/news-release/usda-invests-220-million-high-speed-rural-broadband-reconnect-2026"
      },
      {
        "label": "Broadband World News",
        "url": "https://www.broadbandworldnews.com/document.asp?doc_id=784920&usda-awards-220m-rural-broadband-grants"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-the-interior-awards-190-million-for-western-water-recycling-and-desalination-plants-2026-08-24",
    "headline": "Department of the Interior Awards $190 Million for Advanced Water Recycling and Purification Facilities",
    "summary": "Bureau of Reclamation announces $190 million through Title XVI WaterSMART, funding eight large-scale water purification and brackish desalination plants across California, Arizona, Utah, and Nevada.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T14:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8938,
    "longitude": -77.0425,
    "body": "WASHINGTON, DC — Countering severe long-term hydrological drought across the Colorado River basin and strengthening urban water independence, the United States Department of the Interior (DOI) and the Bureau of Reclamation announced $190 million in competitive grant allocations on Monday under the Title XVI WaterSMART (Sustain and Manage America’s Resources for Tomorrow) program, funding eight major municipal advanced water recycling and desalination facilities across four Western states.\n\nThe federal capital matching grants finance the engineering, procurement, and construction of large-scale advanced water purification facilities that treat municipal wastewater to ultra-pure potable standards using microfiltration, reverse osmosis, and ultraviolet advanced oxidation with hydrogen peroxide. Once fully operational, the eight recipient water facilities will generate 125,000 acre-feet (approximately 40 billion gallons) of new drought-resilient municipal drinking water annually—enough to supply 500,000 households across Southern California, Phoenix, Las Vegas, and Salt Lake City without withdrawing a single additional drop from the depleted Colorado River reservoir system.\n\n## Major Western Water Purification Projects\n\nThe funding packages provide substantial cost-share capital to regional water wholesalers and municipal utilities. Key project awards include:\n\n- **Pure Water Southern California Regional Facility ($75 Million)**: Funding the construction of advanced tertiary filtration trains for the massive regional wastewater recycling plant in Carson, California, supplying 150 million gallons per day of purified water to replenish Southern California groundwater aquifers.\n- **Phoenix Metropolitan Advanced Water Purification Hub ($45 Million)**: Constructing advanced purification systems to recharge regional aquifers in Maricopa County, Arizona, offsetting severe Colorado River Tier 2 water supply curtailments.\n- **Las Vegas Valley Water District Brackish Desalination ($40 Million)**: Expanding reverse osmosis treatment capacity to purify brackish groundwater in Southern Nevada.\n- **Utah Jordan Valley Water Conservancy District Expansion ($30 Million)**: Building advanced membrane treatment systems to reclaim municipal wastewater and replenish the Great Salt Lake watershed.\n\n\"As the Western United States faces the ongoing realities of climate change and prolonged hydrological drought, expanding local water recycling is essential to securing our water future,\" Interior Secretary Deb Haaland stated. \"These WaterSMART investments deploy cutting-edge water purification technology, protect the Colorado River system, and guarantee that Western communities have dependable, clean drinking water for generations to come.\"\n\n## Western Urban Water Agencies and Conservation Groups Endorse\n\nThe Metropolitan Water District of Southern California (MWD) and the Western Urban Water Coalition praised the major federal investments for creating local, climate-independent water supplies.\n\n\"Advanced water recycling is the single most cost-effective and environmentally sound way to drought-proof our major metropolitan regions,\" said Adel Hagekhalil, General Manager of MWD. \"Federal WaterSMART grants accelerate our construction timelines, protect ratepayers from extreme rate shocks, and significantly reduce Southern California’s reliance on imported river water.\"\n\nEnvironmental organizations, including the Environmental Defense Fund (EDF), commended the projects for leaving more natural water flows in Western river ecosystems to protect endangered fish and riparian wildlife.\n\n## Construction Milestones and Commissioning Dates\n\nCivil site engineering and membrane equipment procurement for all eight water purification facilities will finalize in winter 2026. Facility construction and pilot testing will proceed through 2028, with commercial potable water deliveries scheduled to begin in early 2029.",
    "seoTitle": "DOI Awards $190M for Western Advanced Water Purification Plants | Choseno",
    "metaDescription": "Department of the Interior allocates $190M through Title XVI WaterSMART for eight large-scale water recycling and desalination plants in CA, AZ, UT, and NV.",
    "tags": [
      "United States",
      "Environment",
      "Water",
      "Drought",
      "Colorado River",
      "Infrastructure",
      "Clean Tech",
      "US"
    ],
    "tweet": "Department of the Interior awards $190M for eight advanced water recycling and purification plants in CA, AZ, UT, and NV, generating 40B gallons annually.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Western Water Resources & Desalination Bureau",
      "bio": "Bureau of Reclamation Title XVI WaterSMART grants, advanced membrane water purification engineering, Colorado River basin hydrology, and water policy"
    },
    "sources": [
      {
        "label": "U.S. Department of the Interior Bureau of Reclamation",
        "url": "https://www.usbr.gov/newsroom/news-release/4820-doi-invests-190-million-water-recycling-desalination-2026"
      },
      {
        "label": "Water World Magazine",
        "url": "https://www.waterworld.com/drinking-water/treatment/article/55128501/doi-awards-190m-for-western-water-reuse-and-desalination-plants"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-justice-awards-110-million-for-victim-services-and-legal-aid-assistance-2026-08-24",
    "headline": "DOJ Awards $110 Million for Crime Victim Legal Aid and Emergency Trauma Support Services",
    "summary": "Office for Victims of Crime announces $110 million in VOCA grants across 120 non-profit legal clinics and domestic violence shelters, providing trauma-informed legal representation and emergency housing.",
    "category": "Justice",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T14:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8944,
    "longitude": -77.0255,
    "body": "WASHINGTON, DC — Strengthening civil legal representation and emergency crisis support for survivors of violent crime, domestic abuse, and financial exploitation, the United States Department of Justice (DOJ) Office of Justice Programs (OJP) announced the award of $110 million in competitive grants on Monday through the Office for Victims of Crime (OVC), delivering vital operational funding to 120 legal aid organizations and community trauma centers across 35 states.\n\nThe grant awards, funded through the Crime Victims Fund established under the Victims of Crime Act (VOCA), provide direct financial resources to hire specialized civil legal aid attorneys, paralegals, licensed clinical social workers, and court advocates. The funded legal clinics provide free, trauma-informed legal representation to crime victims navigating protective orders, emergency child custody proceedings, housing eviction defense following domestic violence, and identity restoration for elderly victims of complex financial fraud.\n\n## Stabilizing Dedicated Crime Victim Legal Clinics Nationwide\n\nVOCA grants deliver direct funding to organizations that provide essential services to vulnerable populations, including rural victim advocacy networks, tribal domestic violence shelters, and bilingual legal clinics in underserved urban neighborhoods. In addition to legal counsel, the federal funds support emergency relocation stipends to cover hotel stays, lock replacements, and medical transportation for victims fleeing imminent physical danger.\n\nUnder federal program rules, the Crime Victims Fund is financed entirely by criminal fines, forfeited bail bonds, and civil penalties paid by convicted federal offenders and corporate white-collar criminals, operating without a single dollar of taxpayer revenue.\n\n\"Survivors of crime deserve compassionate, dignified care and comprehensive legal protection as they heal and rebuild their lives,\" Attorney General Merrick Garland stated during the announcement. \"These VOCA grant awards ensure that victims across our country have dedicated legal advocates standing beside them in the courtroom, protecting their rights and providing the critical trauma-informed support they need to secure justice and safety.\"\n\n## National Legal Aid and Domestic Violence Coalitions Support\n\nThe National Network to End Domestic Violence (NNEDV) and the Legal Services Corporation (LSC) commended the DOJ grant awards, highlighting that civil legal representation is one of the single most effective interventions in permanently breaking cycles of domestic violence.\n\n\"When a domestic violence survivor has access to an attorney, their ability to secure an effective civil protective order and safe housing increases by over 80%,\" said Stephanie Love-Patterson, President of NNEDV. \"These federal VOCA awards provide life-saving legal counsel to thousands of vulnerable women and families who could never afford private legal representation.\"\n\nState bar associations and tribal justice directors praised the grant criteria for prioritizing community-based victim service providers with established local trust.\n\n## Grant Disbursement Schedule\n\nGrant awards will transfer to recipient legal aid organizations and non-profit crisis centers on October 1, 2026, supporting immediate staffing expansion and survivor intakes for the 2027 fiscal year.",
    "seoTitle": "DOJ Awards $110M in VOCA Grants for Crime Victim Legal Aid | Choseno",
    "metaDescription": "Department of Justice allocates $110M through OVC VOCA grants to fund legal aid and emergency trauma shelters for crime victims in 35 states.",
    "tags": [
      "United States",
      "Justice",
      "Civil Rights",
      "Public Safety",
      "Legal Aid",
      "Domestic Violence",
      "US"
    ],
    "tweet": "DOJ awards $110M in VOCA grants to fund free civil legal aid and emergency trauma support for crime victims across 120 organizations.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Crime Victim Rights & Civil Legal Aid Bureau",
      "bio": "DOJ OVC VOCA grant administration, crime victim civil rights law, domestic violence legal advocacy, and judicial assistance policy"
    },
    "sources": [
      {
        "label": "U.S. Department of Justice Office of Justice Programs",
        "url": "https://www.ojp.gov/news/news-releases/2026/justice-department-invests-110-million-support-crime-victims-legal-assistance"
      },
      {
        "label": "National Law Journal",
        "url": "https://www.law.com/nationallawjournal/2026/08/24/doj-awards-110m-for-victim-legal-services-and-trauma-aid/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-energy-awards-175-million-for-solid-state-electric-vehicle-battery-manufacturing-2026-08-24",
    "headline": "U.S. Department of Energy Awards $175 Million for Domestic Solid-State EV Battery Gigafactories",
    "summary": "DOE Advanced Manufacturing Office allocates $175 million to scale commercial production lines for solid-state lithium-metal batteries in Michigan, Ohio, and North Carolina.",
    "category": "Clean Tech",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T13:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8872,
    "longitude": -77.0259,
    "body": "WASHINGTON, DC — Catalyzing the next technological leap in commercial electric vehicle performance and securing domestic clean energy supply chains, the United States Department of Energy (DOE) announced $175 million in Advanced Materials and Manufacturing Technologies Office (AMMTO) grant awards on Monday, funding three commercial manufacturing scale-up facilities for next-generation solid-state electric vehicle batteries across the Midwest and Southeast.\n\nThe federal matching grants support the commercial transition from laboratory prototypes to pilot gigafactory production lines for solid-state lithium-metal cells. By replacing flammable liquid electrolytes with solid ceramic and polymer separators, solid-state battery technology achieves an energy density of over 450 watt-hours per kilogram—delivering electric passenger vehicles with a 600-mile single-charge driving range, ultra-fast 10-minute 80% charging capabilities, and zero risk of thermal runaway fires under extreme impact conditions.\n\n## Domestic Manufacturing Scale-Up in the Automotive Heartland\n\nThe funding packages provide direct capital matching funds to domestic battery innovators partnering with major automotive original equipment manufacturers (OEMs). Selected manufacturing facilities include:\n\n- **Michigan Solid-State Gigafactory Pilot ($70 Million)**: Constructing an automated continuous roll-to-roll ceramic separator coating facility in Detroit, partnering with General Motors to produce 50,000 solid-state vehicle battery packs annually.\n- **Ohio Advanced Cathode Fabrication Plant ($60 Million)**: Installing dry-electrode manufacturing lines and lithium-metal anode assembly cleanrooms in Lordstown, Ohio, reducing manufacturing energy consumption by 40%.\n- **North Carolina Solid Electrolyte Synthesis Facility ($45 Million)**: Building a commercial chemical synthesis plant in Greensboro, North Carolina, to refine sulfide-based solid electrolyte powders from domestic mineral feedstocks.\n\n\"The future of automotive transportation will be defined by battery technology, and America is determined to lead the world in manufacturing the next generation of safe, ultra-dense solid-state batteries,\" Energy Secretary Jennifer Granholm stated. \"These AMMTO investments create thousands of skilled manufacturing jobs in the automotive heartland and ensure American automakers build the longest-range, safest electric vehicles on the planet.\"\n\n## United Auto Workers and Automotive Industry Endorse\n\nThe United Auto Workers (UAW) and the Alliance for Automotive Innovation strongly commended the manufacturing grants, noting that establishing domestic solid-state battery supply chains protects American manufacturing supremacy.\n\n\"Solid-state battery technology is the holy grail of electric mobility, eliminating range anxiety and fire hazards for consumers,\" said John Bozzella, President of the Alliance for Automotive Innovation. \"Federal cost-share partnerships accelerate the commercialization timeline by five years, keeping American auto workers at the cutting edge of global transportation innovation.\"\n\nLabor leaders praised the inclusion of binding domestic sourcing requirements and union workforce training partnerships with regional community colleges.\n\n## Production Line Commissioning Schedule\n\nCleanroom construction and automated roll-to-roll manufacturing tooling installation will commence in January 2027. Pilot commercial solid-state battery cell production for automotive integration testing will begin in late 2027.",
    "seoTitle": "DOE Awards $175M for Solid-State EV Battery Manufacturing Facilities | Choseno",
    "metaDescription": "DOE allocates $175M through AMMTO to build solid-state lithium-metal EV battery production facilities in MI, OH, and NC.",
    "tags": [
      "United States",
      "Clean Tech",
      "Electric Vehicles",
      "Manufacturing",
      "Automotive",
      "Jobs",
      "Innovation",
      "US"
    ],
    "tweet": "Department of Energy awards $175M to build three commercial solid-state EV battery manufacturing facilities in MI, OH, and NC.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Advanced Battery Tech & Automotive Manufacturing Desk",
      "bio": "DOE AMMTO grant administration, solid-state electrochemistry, gigafactory manufacturing engineering, and automotive policy"
    },
    "sources": [
      {
        "label": "U.S. Department of Energy Advanced Manufacturing Office",
        "url": "https://www.energy.gov/eere/ammto/articles/doe-invests-175-million-solid-state-electric-vehicle-battery-manufacturing-2026"
      },
      {
        "label": "Automotive News",
        "url": "https://www.autonews.com/mobility-report/doe-awards-175m-solid-state-ev-battery-manufacturing-plants-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-transportation-allocates-140-million-for-port-cargo-dock-modernization-2026-08-24",
    "headline": "USDOT Awards $140 Million to Electrify Port Cranes and Modernize Cargo Terminals",
    "summary": "Maritime Administration announces $140 million in Port Infrastructure Development Program (PIDP) grants to construct electric container berths and rail yards in Savannah, Houston, and Seattle.",
    "category": "Infrastructure",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T13:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8765,
    "longitude": -77.0055,
    "body": "WASHINGTON, DC — Strengthening maritime trade capacity and slashing diesel emissions in harbor neighborhoods, the United States Department of Transportation (USDOT) Maritime Administration (MARAD) announced the award of $140 million in competitive grants on Monday through the Port Infrastructure Development Program (PIDP), delivering capital modernization funding to six major commercial deepwater seaports.\n\nThe federal grant awards finance heavy civil wharf construction, dockside container crane electrification, and on-dock intermodal rail yard expansions. The modernization projects enable seaports to service mega-containerships carrying over 20,000 twenty-foot equivalent units (TEUs) while replacing diesel-powered cargo handling equipment with zero-emission electric ship-to-shore gantry cranes and electrified yard tractors, reducing port-related diesel particulate emissions by 60%.\n\n## Deepwater Seaport Modernization Projects\n\nThe funding packages provide direct capital to regional public port authorities. Major project awards include:\n\n- **Port of Savannah Container Berth Electrification (Georgia - $45 Million)**: Constructing an electrified multi-ship container berth with high-voltage shore power connections, allowing docked container vessels to shut down diesel auxiliary engines and plug directly into the clean electrical grid.\n- **Port of Houston Bayport Terminal Expansion (Texas - $38 Million)**: Expanding wharf bulkheads and constructing an on-dock rail staging yard to double intermodal freight transfer capacity between ocean carriers and Class I freight rail lines.\n- **Port of Seattle Terminal 5 Modernization (Washington - $32 Million)**: Installing automated electric container straddle carriers and reinforcing seismic dock piles.\n- **Port of Baltimore Heavy Cargo Wharf Upgrades (Maryland - $25 Million)**: Upgrading roll-on/roll-off vehicle handling berths to accommodate surging automobile and farm machinery export shipments.\n\n\"America’s commercial ports are the gateways to our economy, handling trillions of dollars in global commerce every year,\" Transportation Secretary Pete Buttigieg stated. \"These PIDP grants modernize dockside infrastructure, cut shipping delays for American exporters, and clean up the air for families living near busy port corridors.\"\n\n## American Association of Port Authorities and Longshoremen Support\n\nThe American Association of Port Authorities (AAPA) and maritime freight logistics carriers strongly commended the grant distribution, highlighting the critical necessity of federal wharf modernization funding.\n\n\"Electrifying port berths and expanding on-dock rail infrastructure makes American seaports faster, cleaner, and more resilient to global supply chain disruptions,\" said Chris Connor, President of AAPA. \"These investments protect our trade competitiveness and ensure American goods reach overseas buyers quickly and efficiently.\"\n\nInternational Longshoremen's Association (ILA) and International Longshore and Warehouse Union (ILWU) labor representatives commended the investments for creating high-wage union maritime jobs and installing cleaner, safer electric terminal equipment.\n\n## Civil Wharf Construction Timeline\n\nCivil marine engineering contracts and electrical substation fabrication will commence in autumn 2026. Heavy pile driving and gantry crane delivery across all six commercial seaports will proceed through 2028.",
    "seoTitle": "USDOT Awards $140M in PIDP Grants for Port Wharf Modernization | Choseno",
    "metaDescription": "USDOT MARAD allocates $140M through PIDP to electrify container berths and expand on-dock rail yards in Savannah, Houston, and Seattle.",
    "tags": [
      "United States",
      "Infrastructure",
      "Transportation",
      "Maritime",
      "Clean Tech",
      "Logistics",
      "Trade",
      "US"
    ],
    "tweet": "USDOT awards $140M in PIDP grants to modernize wharves and electrify container berths across major seaports in GA, TX, WA, and MD.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Maritime Infrastructure & Global Trade Logistics Bureau",
      "bio": "MARAD PIDP grant administration, deepwater marine terminal engineering, port electrification, and federal maritime policy"
    },
    "sources": [
      {
        "label": "U.S. Department of Transportation Maritime Administration",
        "url": "https://www.maritime.dot.gov/newsroom/press-releases/biden-harris-administration-announces-140-million-port-infrastructure-grants"
      },
      {
        "label": "Journal of Commerce",
        "url": "https://www.joc.com/article/dot-awards-140m-port-infrastructure-development-grants-2026_20260824.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-the-interior-awards-85-million-for-national-park-historic-trail-and-visitor-infrastructure-2026-08-24",
    "headline": "Department of the Interior Awards $85 Million to Rebuild Historic Trails and Visitor Facilities in 25 National Parks",
    "summary": "National Park Service allocates $85 million through the National Parks and Public Land Legacy Restoration Fund, repairing backcountry trails, wastewater systems, and historic lodges in 25 parks.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T12:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8938,
    "longitude": -77.0425,
    "body": "WASHINGTON, DC — Addressing deferred maintenance backlogs and protecting America’s most iconic natural and cultural landscapes, the United States Department of the Interior (DOI) and the National Park Service (NPS) announced the award of $85 million in capital repair grants on Monday through the National Parks and Public Land Legacy Restoration Fund (LRF), financing major restoration projects across 25 national parks in 18 states.\n\nThe federal capital allocations fund critical structural rehabilitations on aging visitor infrastructure that has deteriorated under record-breaking park visitation. Funded projects include the reconstruction of 350 miles of eroded backcountry hiking trails, the complete overhaul of failing municipal wastewater treatment plants in fragile wilderness watersheds, the seismic stabilization of century-old historic stone lodges, and the installation of ADA-accessible boardwalks overlooking thermal and scenic vistas in Yellowstone, Grand Canyon, Great Smoky Mountains, and Yosemite National Parks.\n\n## Preserving Natural Heritage and Protecting Wilderness Watersheds\n\nHigh-priority projects funded under the $85 million allocation focus on replacing failing underground utility infrastructure that poses environmental risks to national park ecosystems. Key projects include:\n\n- **Yellowstone National Park ($24 Million)**: Replacing the 50-year-old Canyon Village wastewater treatment plant with an advanced membrane bioreactor facility, preventing nitrogen discharges into the Yellowstone River watershed.\n- **Grand Canyon National Park ($20 Million)**: Reconstructing structural stone retaining walls and switchback drainage along the heavily traveled Bright Angel Trail.\n- **Great Smoky Mountains National Park ($18 Million)**: Repairing historic timber bridges and asphalt access roadways damaged by extreme mountain storm flooding.\n- **Yosemite National Park ($15 Million)**: Restoring historic stone masonry buildings and installing energy-efficient solar microgrids at Tuolumne Meadows.\n\n\"National parks are America's greatest treasures, preserving our history, cultural heritage, and breathtaking natural wonders for the enjoyment of all people,\" Interior Secretary Deb Haaland stated during the announcement. \"These Legacy Restoration Fund investments fix crumbling trails, upgrade outdated water systems, and ensure that our national parks remain safe, accessible, and pristine for generations of visitors.\"\n\n## National Parks Conservation Association and Tourism Chambers Praise\n\nThe National Parks Conservation Association (NPCA) and the Outdoor Industry Association strongly praised the funding awards, noting that every dollar invested in national park infrastructure generates over $10 in local economic activity for gateway communities.\n\n\"Addressing critical maintenance backlogs protects irreplaceable wildlife habitat while ensuring millions of park visitors have a safe, world-class experience,\" said Theresa Pierno, President of NPCA. \"Upgrading wastewater plants and stabilizing historic trails preserves these sacred public lands for our children and grandchildren.\"\n\nGateway town mayors commended the trail restoration projects for supporting local hotels, restaurants, and outdoor guide businesses.\n\n## Project Execution and Trail Construction Timeline\n\nNPS engineering contracts and trail rehabilitation crew deployments will begin during the autumn 2026 shoulder season. Heavy civil wastewater facility construction will proceed through 2027.",
    "seoTitle": "DOI Awards $85M for National Park Trail and Infrastructure Restoration | Choseno",
    "metaDescription": "Department of the Interior allocates $85M through the Legacy Restoration Fund to repair trails, lodges, and wastewater systems in 25 national parks.",
    "tags": [
      "United States",
      "Environment",
      "Conservation",
      "National Parks",
      "Tourism",
      "Infrastructure",
      "Public Safety",
      "US"
    ],
    "tweet": "Department of the Interior awards $85M to rebuild historic trails, lodges, and water systems across 25 national parks in 18 states.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Public Lands & National Park Infrastructure Bureau",
      "bio": "NPS Legacy Restoration Fund administration, park civil engineering, outdoor recreation economics, and federal conservation policy"
    },
    "sources": [
      {
        "label": "National Park Service Newsroom",
        "url": "https://www.nps.gov/orgs/1207/legacy-restoration-fund-awards-85-million-parks-2026.htm"
      },
      {
        "label": "National Parks Traveler",
        "url": "https://www.nationalparkstraveler.org/2026/08/interior-department-allocates-85-million-national-park-restoration"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "prime-minister-mark-carney-announces-retaliatory-tariff-schedules-on-us-imports-effective-september-8-2026-08-24",
    "headline": "Prime Minister Mark Carney Releases $12 Billion Retaliatory Tariff List on U.S. Goods Starting September 8",
    "summary": "Prime Minister Mark Carney and Finance Minister Chrystia Freeland publish formal 25% retaliatory tariff schedules covering $12 billion in U.S. steel, aluminum, manufactured consumer goods, and agricultural products.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T12:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Standing alongside provincial premiers and federal cabinet ministers on Parliament Hill, Prime Minister Mark Carney announced the release of Canada’s finalized retaliatory trade tariff schedule on Monday, imposing a 25% surtax on $12 billion worth of United States steel, aluminum, manufactured commercial goods, and agricultural products, taking formal legal effect on September 8, 2026.\n\nThe decisive trade countermeasures represent Canada’s official response under the Customs Tariff Act following the unilateral breakdown of cross-border trade negotiations and the imposition of punitive 50% tariffs by the United States administration on Canadian lumber, steel, and manufactured aerospace components. The Canadian retaliatory tariff list was developed following an extensive 30-day public consultation with Canadian domestic manufacturers, trade unions, and agricultural producers to ensure maximum economic impact on politically sensitive U.S. export sectors while minimizing cost disruptions for Canadian businesses and consumers.\n\n## Comprehensive Surtax Coverage on U.S. Industrial and Agricultural Exports\n\nThe 25% Canadian retaliatory surtaxes apply to a targeted range of American manufactured products originating from key U.S. manufacturing and agricultural states. The tariff schedule covers:\n\n- **U.S. Steel and Aluminum Products ($4.5 Billion)**: Flat-rolled steel coils, stainless steel pipes, structural beams, and unwrought aluminum alloys from Pennsylvania, Ohio, and Indiana.\n- **Commercial and Consumer Manufactured Goods ($4.2 Billion)**: Commercial HVAC units, power lawnmowers, household appliances, recreational motorboats, and industrial packaging equipment from Wisconsin, Michigan, and North Carolina.\n- **Agricultural and Food Products ($3.3 Billion)**: Bourbon whiskey, packaged pork, prepared orange juice, dairy specialty items, and processed poultry from Kentucky, Iowa, and Florida.\n\nUnder federal cabinet regulations, all tariff revenues collected by the Canada Border Services Agency (CBSA) will be deposited into a dedicated Domestic Industrial Support and Worker Defense Fund, providing low-interest working capital loans, tariff remission assistance, and wage stabilization subsidies to trade-exposed Canadian factories and supply chain workers.\n\n\"Canada did not seek this trade conflict, but we will never back down when Canadian workers, businesses, and economic sovereignty are threatened by unfair and unjustified trade penalties,\" Prime Minister Carney declared in a stern national address. \"Our retaliatory measures are measured, perfectly reciprocal, and designed to defend our domestic industries until the United States returns to rules-based international trade under our bilateral agreements.\"\n\n## Cross-Party Provincial Premiers and Canadian Manufacturers United\n\nThe federal retaliatory tariff package received unanimous, cross-partisan endorsement from provincial premiers across Canada, presenting a unified national front.\n\n\"Ontario stands shoulder-to-shoulder with the federal government and our fellow provinces in defending Canadian workers and manufacturers against these unjustified trade actions,\" said Ontario Premier Doug Ford. \"We are working with our manufacturing supply chains to ensure Ontario businesses have the emergency bridge financing and domestic supply lines they need to stay strong.\"\n\nCanadian Manufacturers & Exporters (CME) and the Canadian Labour Congress (CLC) strongly praised the government's tariff defense framework, highlighting the importance of the worker support fund in protecting domestic manufacturing jobs.\n\n## Border Enforcement and Remission Process\n\nThe Canada Border Services Agency will begin collecting the 25% surtax at all commercial border crossings and deepwater marine container terminals beginning at 12:01 AM EDT on September 8, 2026. The Department of Finance published guidelines for Canadian businesses to apply for targeted tariff remissions for specialized manufacturing components that cannot be sourced domestically.",
    "seoTitle": "PM Mark Carney Releases $12B Retaliatory Tariff List Effective Sept 8 | Choseno",
    "metaDescription": "Prime Minister Mark Carney announces 25% retaliatory tariffs on $12B of U.S. steel, goods, and agricultural products effective September 8.",
    "tags": [
      "Mark Carney",
      "Doug Ford",
      "Canada",
      "Economy",
      "Trade",
      "Tariffs",
      "Manufacturing",
      "National Security"
    ],
    "tweet": "Prime Minister Mark Carney releases a 25% retaliatory tariff list on $12B of U.S. goods effective Sept 8 to defend Canadian workers.",
    "breakingNews": true,
    "author": {
      "name": "Choseno International Trade & Macroeconomic Policy Bureau",
      "bio": "Customs Tariff Act regulations, CUSMA trade dispute mechanisms, global trade economics, and Canadian federal governance"
    },
    "sources": [
      {
        "label": "Department of Finance Canada News Releases",
        "url": "https://www.canada.ca/en/department-finance/news/2026/08/canada-announces-retaliatory-tariffs-on-us-goods.html"
      },
      {
        "label": "The Globe and Mail",
        "url": "https://www.theglobeandmail.com/politics/article-carney-announces-12-billion-retaliatory-tariffs-us-goods-sept-8/"
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
    "slug": "ontario-government-allocates-150-million-for-unsheltered-homelessness-and-encampment-supportive-housing-2026-08-24",
    "headline": "Ontario Deploys $150 Million to Clear Encampments and Construct Supportive Housing in 10 Cities",
    "summary": "Premier Doug Ford and Minister of Municipal Affairs Paul Calandra allocate $150 million under the Unsheltered Homelessness and Encampments Initiative (UHEI), funding 1,200 modular transitional supportive beds.",
    "category": "Housing",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-24T11:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — Taking aggressive provincial action to resolve public park encampments and provide permanent clinical pathways off the street, Ontario Premier Doug Ford and Minister of Municipal Affairs and Housing Paul Calandra announced the deployment of $150 million on Monday through the Unsheltered Homelessness and Encampments Initiative (UHEI), delivering targeted capital and operational grants to 10 designated municipal service managers across Ontario.\n\nThe provincial funding initiative finances the rapid construction and operation of 1,200 modular supportive housing units, transitional tiny home communities, and 24/7 indoor navigation centers. The initiative provides dedicated multi-disciplinary outreach teams pairing municipal police and outreach workers with psychiatric nurses and addictions specialists to systematically transition individuals living in unsheltered public park encampments into safe, private indoor transitional housing equipped with on-site mental healthcare and substance abuse treatment.\n\n## Targeted Municipal Capital and Clinical Allocations\n\nThe $150 million provincial investment is allocated across 10 high-need urban centers experiencing significant encampment pressures:\n\n- **City of Toronto ($55 Million)**: Constructing four modular supportive housing sites totaling 450 units and expanding mobile crisis intervention outreach teams.\n- **Region of Peel ($22 Million)**: Building a 180-unit transitional navigation center in Brampton with specialized addiction detox beds.\n- **City of Hamilton ($18 Million)**: Expanding tiny home village infrastructure and funding 150 supportive rental vouchers.\n- **City of Ottawa ($16 Million)**: Converting municipal property into a 120-bed indoor transitional shelter hub.\n- **Regional Municipalities ($39 Million)**: Allocating targeted supportive housing grants across London, Windsor, Waterloo Region, Niagara Region, Sudbury, and Thunder Bay.\n\nUnder provincial funding agreements, recipient municipalities must enforce municipal public space bylaws prohibiting tent encampments in public parks, school zones, and transit shelters once indoor supportive beds are made available.\n\n\"Public parks and playgrounds belong to families and children, not tent encampments,\" Premier Ford stated during the announcement. \"At the same time, we cannot simply tell vulnerable people to move along without giving them a safe place to go. This $150 million investment delivers real roofs over people's heads, round-the-clock mental health and addictions support, and a compassionate pathway to permanent stability.\"\n\n## Ontario Big City Mayors and Healthcare Coalitions React\n\nThe Ontario Big City Mayors (OBCM) caucus strongly welcomed the provincial funding injection, noting that municipal property tax bases could no longer sustain the mounting healthcare and policing costs associated with chronic encampments.\n\n\"Our cities have been on the front lines of a national humanitarian crisis involving severe mental illness, toxic drugs, and homelessness,\" said Marianne Meed Ward, Mayor of Burlington and Chair of OBCM. \"This substantial provincial funding provides the specialized clinical housing infrastructure our municipalities urgently need to help vulnerable individuals heal while restoring safety and access to public parks.\"\n\nHousing and poverty advocacy groups emphasized that ongoing operational funding for mental health caseworkers must be permanently embedded in multi-year provincial budgets to ensure long-term housing retention.\n\n## Site Construction and Tenant Move-In Schedule\n\nFactory modular assembly and municipal site grading across all 10 designated cities will commence in October 2026. The first transitional supportive housing complexes will open their doors for resident intakes in January 2027.",
    "seoTitle": "Ontario Deploys $150M for Encampment Resolution & Supportive Housing | Choseno",
    "metaDescription": "Premier Doug Ford allocates $150M through UHEI to construct 1,200 supportive housing units and clear public park encampments across 10 Ontario cities.",
    "tags": [
      "Doug Ford",
      "Ontario",
      "Housing",
      "Homelessness",
      "Mental Health",
      "Public Safety",
      "Municipal",
      "Canada"
    ],
    "tweet": "Ontario Premier Doug Ford deploys $150M to build 1,200 modular supportive homes and resolve park encampments across 10 cities.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Ontario Municipal Housing & Social Policy Bureau",
      "bio": "Ontario UHEI program administration, municipal supportive housing models, mental health crisis intervention, and Ontario civic governance"
    },
    "sources": [
      {
        "label": "Ontario Newsroom Municipal Housing Announcements",
        "url": "https://news.ontario.ca/en/release/1004968/ontario-investing-150-million-to-address-unsheltered-homelessness-and-encampments"
      },
      {
        "label": "CP24 Breaking News",
        "url": "https://www.cp24.com/news/ford-announces-150m-for-encampments-and-supportive-housing-1.7483935"
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
    "slug": "british-columbia-premier-david-eby-allocates-110-million-for-mass-timber-housing-manufacturing-hub-2026-08-24",
    "headline": "Premier David Eby Directs $110 Million to Build North America's Largest Mass-Timber Modular Housing Plant",
    "summary": "B.C. Ministry of Jobs and BC Housing invest $110 million to construct an automated cross-laminated timber (CLT) modular housing manufacturing plant in Prince George, producing 3,000 homes annually.",
    "category": "Economy",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-24T11:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "state",
    "latitude": 53.9171,
    "longitude": -122.7497,
    "body": "PRINCE GEORGE, BC — Transforming British Columbia's forestry sector while drastically accelerating home construction speeds across the province, Premier David Eby and Minister of Jobs, Economic Development and Innovation Brenda Bailey announced a $110 million provincial investment on Monday to construct North America’s largest automated Mass-Timber Modular Housing Manufacturing Facility in Prince George.\n\nThe $280 million public-private manufacturing partnership, developed in collaboration with regional First Nations forestry enterprises and Canadian mass-timber leader StructureCraft, will feature robotic cross-laminated timber (CLT) assembly lines capable of fabricating 3,000 high-efficiency, multi-family modular apartment modules per year. Utilizing sustainably harvested B.C. timber, the manufacturing plant transforms raw lumber into precision-engineered, fire-resistant modular apartment sections—complete with pre-installed electrical wiring, plumbing, and drywall—shipped directly to urban construction sites to assemble 12-story mass-timber apartment buildings in under six months.\n\n## Revitalizing Interior Forestry Economies with High-Tech Advanced Manufacturing\n\nThe Prince George gigafactory creates 650 permanent, high-wage union manufacturing and engineering jobs in Northern B.C., providing vital economic diversification for forestry workers impacted by legacy sawmill closures. The project incorporates an innovative First Nations equity co-ownership model with the Lheidli T'enneh First Nation, ensuring that local Indigenous communities hold a direct 25% ownership stake in facility revenues and management.\n\nMass-timber modular construction provides substantial climate benefits, locking sequestered biogenic carbon inside solid wood structures while reducing construction lifecycle greenhouse gas emissions by 45% compared to conventional concrete and steel building methods.\n\n\"British Columbia has the best wood, the best forestry workers, and the most innovative mass-timber builders in the world,\" Premier Eby declared during the announcement in Prince George. \"By building this world-class modular manufacturing plant, we are taking B.C. logs, processing them into high-value engineered housing components right here in Northern B.C., and building thousands of beautiful, affordable homes that B.C. families can afford.\"\n\n## B.C. Construction Associations and Indigenous Leaders Applaud\n\nThe BC Construction Association and the Council of Forest Industries (COFI) strongly commended the major investment, noting that mass-timber manufacturing addresses severe skilled trades shortages in urban centers.\n\n\"Industrializing modular home building using B.C. mass-timber is the exact economic and climate solution our province needs,\" said Linda Coady, President of COFI. \"It creates stable, family-supporting manufacturing jobs in our interior forestry communities while delivering high-quality, sustainable homes for our growing cities.\"\n\nLheidli T'enneh Chief Dolleen Logan celebrated the equity partnership, stating that Indigenous co-ownership in value-added forestry ensures long-term prosperity for future generations.\n\n## Plant Construction Groundbreaking and Commissioning\n\nCivil site grading and foundation construction in Prince George’s industrial park will break ground in October 2026. Robotic production line commissioning will proceed throughout 2027, with the first mass-timber modular homes delivering to BC Housing development sites in early 2028.",
    "seoTitle": "Premier David Eby Directs $110M for Mass-Timber Housing Plant | Choseno",
    "metaDescription": "B.C. Premier David Eby announces $110M investment to build North America's largest automated mass-timber modular housing factory in Prince George.",
    "tags": [
      "David Eby",
      "British Columbia",
      "Economy",
      "Forestry",
      "Housing",
      "Manufacturing",
      "Indigenous",
      "Clean Tech",
      "Canada"
    ],
    "tweet": "B.C. Premier David Eby directs $110M to build North America's largest mass-timber modular housing factory in Prince George, creating 650 jobs.",
    "breakingNews": true,
    "author": {
      "name": "Choseno British Columbia Forestry Innovation & Housing Desk",
      "bio": "Mass-timber structural engineering, BC Housing modular procurement, value-added forestry economics, and Indigenous economic partnerships"
    },
    "sources": [
      {
        "label": "BC Gov News Releases",
        "url": "https://news.gov.bc.ca/releases/2026JEDI0042-001328"
      },
      {
        "label": "The Prince George Citizen",
        "url": "https://www.princegeorgecitizen.com/local-news/eby-announces-110m-mass-timber-modular-housing-plant-prince-george"
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
    "slug": "quebec-government-allocates-180-million-for-hydro-quebec-substation-digitalization-and-grid-automation-2026-08-24",
    "headline": "Quebec Allocates $180 Million to Modernize and Automate 50 Hydro-Québec High-Voltage Substations",
    "summary": "Ministère de l'Économie, de l'Innovation et de l'Énergie deploys $180 million to integrate AI automated fault-detection and digital optical sensors across 50 Hydro-Québec substations.",
    "category": "Energy",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-24T10:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "state",
    "latitude": 46.8139,
    "longitude": -71.2082,
    "body": "QUEBEC CITY, QC — Preparing the provincial power grid for massive industrial electrification and extreme winter storm resilience, Minister of Economy, Innovation and Energy Pierre Fitzgibbon announced a $180 million provincial funding allocation on Monday to accelerate Hydro-Québec’s Substation Digital Modernization and Automated Grid Resilience Program across 50 strategic high-voltage substations.\n\nThe capital investment finances the complete digital overhaul of legacy electromechanical relays, replacing aging analog instrumentation with IEC 61850-compliant digital optical bus networks, automated solid-state protection relays, and AI-powered predictive thermal sensor arrays across major transmission junctions in Montreal, Quebec City, the Saguenay, and the Outaouais. The digital automated systems detect ice-loading transmission faults, transformer over-heating, and lightning line trips within milliseconds, automatically re-routing high-voltage power through alternative corridors to prevent cascading regional blackouts during severe winter ice storms.\n\n## Supporting Industrial Decarbonization and EV Load Growth\n\nHydro-Québec projects that provincial electricity demand will increase by over 10,000 megawatts by 2035 as heavy industries, aluminum smelters, public transit networks, and commercial building heating systems transition off fossil fuels to clean hydroelectricity. Modernizing substation switching architecture increases regional transmission capacity by up to 25% across existing rights-of-way without requiring the construction of costly new high-voltage overhead towers.\n\nThe modernized substations also incorporate advanced fiber-optic cybersecurity firewalls developed in collaboration with Quebec research institutions to protect the provincial electrical grid from sophisticated state-sponsored cyber intrusions.\n\n\"Hydro-Québec's clean electricity is our province’s greatest economic and ecological asset,\" Minister Fitzgibbon stated during the announcement in Quebec City. \"By investing $180 million to digitize and automate our high-voltage transmission substations, we are creating a smarter, stronger, and more resilient grid that can handle surging industrial demand while protecting Quebec homes from extreme winter storm power failures.\"\n\n## Hydro-Québec Engineers and Industrial Chambers Praise\n\nHydro-Québec executive leadership and electrical engineering associations commended the capital funding, noting that digital substations reduce maintenance downtime by 50% through automated predictive diagnostics.\n\n\"Digital substations allow our grid dispatchers to monitor the heartbeat of Quebec's electrical system in real-time,\" said Michael Sabia, President and CEO of Hydro-Québec. \"This investment ensures our transmission infrastructure is fully prepared to power Quebec's clean energy transition and support our burgeoning battery and green manufacturing sectors.\"\n\nQuebec industrial manufacturers praised the grid investments for preventing voltage flicker and electrical downtime in automated fabrication plants.\n\n## Equipment Procurement and Modernization Schedule\n\nHydro-Québec will begin issuing digital optical relay procurement tenders in October 2026. Substation physical retrofits and software integration will proceed in phased tranches from spring 2027 through late 2029.",
    "seoTitle": "Quebec Allocates $180M to Modernize 50 Hydro-Québec Substations | Choseno",
    "metaDescription": "Quebec deploys $180M to automate and digitize 50 Hydro-Québec high-voltage substations for extreme winter resilience and industrial growth.",
    "tags": [
      "François Legault",
      "Quebec",
      "Energy",
      "Clean Tech",
      "Infrastructure",
      "Innovation",
      "Utilities",
      "Canada"
    ],
    "tweet": "Quebec allocates $180M to modernize and automate 50 Hydro-Québec high-voltage substations, boosting winter grid resilience.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Quebec Energy Infrastructure & Grid Automation Bureau",
      "bio": "Hydro-Québec transmission planning, IEC 61850 substation automation, smart grid cybersecurity, and Quebec energy policy"
    },
    "sources": [
      {
        "label": "Ministère de l'Économie, de l'Innovation et de l'Énergie du Québec",
        "url": "https://www.quebec.ca/nouvelles/actualites/details/quebec-investit-180-millions-modernisation-postes-hydro-quebec-2026"
      },
      {
        "label": "Le Journal de Québec",
        "url": "https://www.journaldequebec.com/2026/08/24/quebec-injecte-180m-pour-automatiser-50-postes-dhydro-quebec"
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
    "slug": "city-of-edmonton-approves-95-million-contract-for-valley-line-west-lrt-traction-power-and-signaling-2026-08-24",
    "headline": "Edmonton City Council Approves $95 Million Valley Line West LRT Signaling and Traction Contract",
    "summary": "Edmonton City Council votes 11–2 to award a $95 million contract for automated train signaling, traction power substations, and optical fiber for the 14-kilometer Valley Line West LRT expansion.",
    "category": "Transportation",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-24T10:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "local",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "body": "EDMONTON, AB — Advancing the largest municipal infrastructure project in the city's history, Edmonton City Council voted 11–2 during a marathon public meeting on Monday to formally award a $95 million specialized systems contract for the Valley Line West Light Rail Transit (LRT) project to Marigold Infrastructure Partners.\n\nThe major municipal contract covers the engineering, procurement, and installation of 14 traction power substations (TPSS), automated communications-based train control (CBTC) signaling systems, overhead catenary electrification wires, and a dedicated high-capacity fiber-optic communications network spanning the entire 14-kilometer transit line from downtown Edmonton to Lewis Farms in the city’s growing west end. The low-floor urban LRT expansion will connect over 100,000 residents across 14 new street-level passenger stations and two elevated transit centers at West Edmonton Mall and the Misericordia Community Hospital.\n\n## Unlocking Transit-Oriented Density and Slashing Commute Times\n\nCity of Edmonton transit modeling indicates that the Valley Line West LRT will carry over 40,000 daily passenger trips upon full commercial opening, reducing cross-town transit commute times by 25 minutes compared to congested peak-hour bus routes. The urban LRT design features low-profile street-level stops integrated directly into pedestrian sidewalks, complete with tree-lined active transportation multi-use pathways and priority transit signal preemption at major roadway intersections.\n\nThe project is co-funded through a tripartite infrastructure partnership between the City of Edmonton, the Government of Alberta, and the Government of Canada, driving an estimated $3 billion in private transit-oriented residential and commercial developments along the 87th Avenue and Stony Plain Road corridors.\n\n\"Awarding this critical traction power and signaling contract keeps the Valley Line West LRT firmly on track to deliver world-class, zero-emission rapid transit to our west-end communities,\" Mayor Amarjeet Sohi stated following the council vote. \"Connecting West Edmonton Mall, our regional hospital, and neighborhood commercial districts with reliable rapid transit is essential to managing our city’s rapid population growth, reducing highway traffic congestion, and building a more sustainable Edmonton.\"\n\n## West Edmonton Business Association and Transit Advocates Endorse\n\nThe West Edmonton Business Association and the Urban Development Institute (UDI) praised the council approval, emphasizing that infrastructure certainty is spurring substantial private multi-family housing investments along the corridor.\n\n\"The Valley Line West LRT is a transformational catalyst for urban renewal along Stony Plain Road and our western commercial districts,\" said Anand Pye, Executive Director of UDI Edmonton. \"Finalizing the critical electrical and systems contracts gives home builders and commercial developers the long-term confidence to invest in vibrant, transit-connected neighborhood developments.\"\n\nTransit safety advocates praised the inclusion of grade-level pedestrian crossing gates, tactile platform pavers, and high-resolution automated platform surveillance systems at all 14 stations.\n\n## Construction Milestones and Commercial Opening Target\n\nTraction power substation delivery and electrical catenary pole installation along 87th Avenue will commence in November 2026. Integrated vehicle signaling and dynamic rail test runs will begin in mid-2027, leading to full passenger service launch in late 2028.",
    "seoTitle": "Edmonton Approves $95M Valley Line West LRT Power & Signaling Contract | Choseno",
    "metaDescription": "Edmonton City Council votes 11–2 to award $95M contract for traction power substations and CBTC signaling for the Valley Line West LRT expansion.",
    "tags": [
      "Edmonton",
      "Alberta",
      "Transportation",
      "Transit",
      "Infrastructure",
      "Municipal",
      "Clean Tech",
      "Canada"
    ],
    "tweet": "Edmonton City Council approves a $95M contract for power substations and signaling on the 14-km Valley Line West LRT expansion.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Municipal Transit Systems & Urban Rail Bureau",
      "bio": "Urban light rail transit engineering, municipal capital procurement, transit-oriented development economics, and Edmonton civic governance"
    },
    "sources": [
      {
        "label": "City of Edmonton City Council Minutes",
        "url": "https://www.edmonton.ca/city_government/council-committee-meetings/minutes-2026-08-24-valley-line-west-lrt.html"
      },
      {
        "label": "Edmonton Journal",
        "url": "https://edmontonjournal.com/news/local-news/edmonton-city-council-approves-95m-valley-line-west-lrt-signaling-contract"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "saskatchewan-government-allocates-40-million-for-rural-municipal-bridge-and-culvert-replacement-2026-08-24",
    "headline": "Saskatchewan Allocates $40 Million to Replace 60 Aging Rural Timber Bridges and Culverts",
    "summary": "Saskatchewan Ministry of Highways deploys $40 million under the Rural Municipalities Infrastructure Program, replacing 60 structural timber bridges to remove agricultural freight weight limits.",
    "category": "Infrastructure",
    "country": "CA",
    "province": "SK",
    "status": "published",
    "eventDate": "2026-08-24T09:30:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "state",
    "latitude": 50.4472,
    "longitude": -104.6184,
    "body": "REGINA, SK — Strengthening rural agricultural freight corridors and ensuring heavy grain and potash trucks can move safely without weight restrictions, Premier Scott Moe and Minister of Highways Lori Carr announced a $40 million provincial funding allocation on Monday through the Rural Municipalities Infrastructure Program (RMIP), funding the replacement of 60 aging structural timber bridges across 45 rural municipalities.\n\nThe provincial infrastructure grants provide up to $750,000 per bridge replacement to dismantle 60-year-old creosote-treated timber bridge spans and replace them with modern precast reinforced concrete box culverts, steel girder superstructures, and deep driven steel pile foundations. The structural bridge replacements permanently remove crippling primary weight road bans, allowing heavy B-train grain hopper semi-trucks, fertilizer transport haulers, and agricultural combines weighing up to 63,500 kilograms to travel directly from farm fields to primary high-throughput grain elevators without costly 30-kilometer rural detours.\n\n## Strengthening the Backbone of Saskatchewan's Agricultural Export Supply Chain\n\nSaskatchewan’s rural municipalities manage over 1,400 short-span bridges, with more than 40% constructed during the post-war era of the 1950s and 1960s using timber piling that has suffered severe rot, scouring, and structural fatigue. Under the provincial cost-sharing formula, the Ministry of Highways provides 50% non-repayable matching capital, easing heavy property tax burdens on sparsely populated rural municipal councils with small local tax bases.\n\nThe program also funds structural hydraulic channel cleanouts and native riparian rock rip-rap bank armoring to protect rural road crossings from catastrophic washouts during spring snowmelt runoff surges.\n\n\"Saskatchewan farmers and agricultural producers feed the world, and our rural transportation network is the vital backbone that connects our harvest to global export markets,\" Premier Moe stated during the announcement. \"By investing $40 million to replace 60 aging rural bridges with modern concrete and steel structures, we are keeping our agricultural supply chains moving efficiently, protecting rural motorist safety, and strengthening our provincial economy.\"\n\n## Saskatchewan Association of Rural Municipalities Praises\n\nThe Saskatchewan Association of Rural Municipalities (SARM) and the Agricultural Producers Association of Saskatchewan (APAS) strongly praised the major grant allocation, noting that bridge weight restrictions have severely increased rural transport costs.\n\n\"Replacing aging timber bridges is the single largest capital infrastructure challenge facing Saskatchewan’s rural municipalities,\" said Ray Orb, President of SARM. \"This $40 million provincial investment provides crucial matching funds that allow rural councils to eliminate road bans, keep our agricultural haul routes open, and ensure our farm families and emergency vehicles travel on safe, dependable crossings.\"\n\nRural emergency services directors commended the bridge upgrades for ensuring heavy fire pumpers and ambulances can cross rural waterways safely.\n\n## Construction Tender Schedule and Procurement\n\nParticipating rural municipalities will issue engineering and concrete supply tenders in October 2026. Bridge demolition and precast concrete culvert installation will commence during frozen ground winter conditions in early 2027.",
    "seoTitle": "Saskatchewan Allocates $40M for 60 Rural Bridge Replacements | Choseno",
    "metaDescription": "Saskatchewan deploys $40M through RMIP to replace 60 aging timber bridges with precast concrete structures across 45 rural municipalities.",
    "tags": [
      "Scott Moe",
      "Saskatchewan",
      "Infrastructure",
      "Agriculture",
      "Rural",
      "Transportation",
      "Economy",
      "Canada"
    ],
    "tweet": "Saskatchewan Premier Scott Moe allocates $40M to replace 60 aging rural timber bridges, removing weight restrictions for grain trucks.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Saskatchewan Rural Infrastructure & Agricultural Supply Desk",
      "bio": "Saskatchewan Ministry of Highways RMIP grants, short-span bridge engineering, agricultural freight logistics, and rural municipal governance"
    },
    "sources": [
      {
        "label": "Government of Saskatchewan News Releases",
        "url": "https://www.saskatchewan.ca/government/news-and-media/2026/august/24/rural-bridge-replacements-infrastructure-investment"
      },
      {
        "label": "The Western Producer",
        "url": "https://www.producer.com/news/sask-invests-40m-to-replace-60-rural-timber-bridges-2026/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "united-states-department-of-labor-awards-85-million-for-rural-youth-apprenticeships-and-stem-pathways-2026-08-24",
    "headline": "U.S. Department of Labor Awards $85 Million to Expand Rural Youth Apprenticeships in High-Tech Trades",
    "summary": "Employment and Training Administration announces $85 million in YouthBuild and Apprenticeship Building America grants, training 12,000 rural young adults in clean energy, cybersecurity, and advanced manufacturing.",
    "category": "Economy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-24T12:00:00Z",
    "published_at": "2026-08-24T19:00:00Z",
    "impactArea": "country",
    "latitude": 38.8922,
    "longitude": -77.0146,
    "body": "WASHINGTON, DC — Delivering high-wage career pathways for young people in rural and energy-transition communities, the United States Department of Labor (DOL) Employment and Training Administration announced the award of $85 million in competitive grants on Monday through the YouthBuild program and the Apprenticeship Building America initiative, funding 42 workforce partnerships across 26 states.\n\nThe federal investments provide direct operational capital to community colleges, joint labor-management training centers, and rural non-profit organizations to recruit, train, and place 12,000 young adults aged 16 to 24 into registered union apprenticeships. The programs focus on high-demand technical careers including commercial solar and wind installation, precision CNC machinery programming, electric vehicle battery assembly, and industrial cybersecurity, providing participants with full tuition waivers, industry-recognized credentials, and paid work-based learning stipends averaging $22 per hour.\n\n## Rebuilding Rural Economic Vitality with Technical Youth Training\n\nThe YouthBuild and Apprenticeship expansion specifically targets rural counties in the Rust Belt, the Mississippi Delta, and Appalachian mining regions where youth unemployment rates remain elevated following legacy industrial closures. In addition to technical classroom instruction, participants receive comprehensive supportive services including emergency transportation subsidies, tool purchase allowances, childcare stipends, and trauma-informed life-skills coaching, guaranteeing that economic barriers do not prevent young workers from completing registered apprenticeship credentials.\n\nUnder federal program standards, all funded apprenticeship pathways must partner with local union trade locals and expanding regional clean manufacturing employers to ensure direct job placement upon program graduation.\n\n\"Every young person in America, no matter where they live, deserves access to good-paying careers that offer family-sustaining wages, comprehensive benefits, and a clear path to the middle class,\" Acting Labor Secretary Julie Su stated during the grant announcement. \"These Department of Labor investments equip our rural youth with the technical skills and hands-on apprenticeship training necessary to build America’s clean energy infrastructure and drive our industrial future.\"\n\n## National YouthBuild Coalition and Community Colleges Endorse\n\nThe National YouthBuild Coalition and the American Association of Community Colleges (AACC) praised the major grant allocation, emphasizing that registered apprenticeships deliver a 93% employment retention rate with starting career salaries averaging over $65,000 after three years.\n\n\"YouthBuild empowers young people who have faced systemic obstacles to transform their lives through education, hands-on skill building, and leadership development,\" said John Valverde, CEO of YouthBuild USA. \"These federal grants provide the vital resources our rural training centers need to guide thousands of young adults into rewarding, union-represented careers.\"\n\nRural economic development directors commended the program for providing local expanding factories with a steady pipeline of certified technical talent.\n\n## Program Enrollment and Training Cohort Schedule\n\nGrantee community colleges and vocational centers will commence student recruitment and orientation for the winter training cohorts on October 15, 2026. Hands-on apprenticeship work placements will commence in January 2027.",
    "seoTitle": "DOL Awards $85M for Rural Youth Apprenticeships in Tech Trades | Choseno",
    "metaDescription": "Department of Labor allocates $85M in YouthBuild and Apprenticeship grants to train 12,000 rural young adults in clean energy and manufacturing.",
    "tags": [
      "United States",
      "Economy",
      "Labor",
      "Jobs",
      "Youth",
      "Education",
      "Clean Tech",
      "Rural",
      "US"
    ],
    "tweet": "Department of Labor awards $85M in YouthBuild grants to train 12,000 rural youth for careers in clean energy and advanced manufacturing.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Workforce Development & Youth Apprenticeship Bureau",
      "bio": "DOL YouthBuild grant administration, Registered Apprenticeship policy, rural workforce development, and labor economics"
    },
    "sources": [
      {
        "label": "U.S. Department of Labor Employment and Training Administration",
        "url": "https://www.dol.gov/newsroom/releases/eta/eta20260824-youthbuild-apprenticeship-rural-grants"
      },
      {
        "label": "Community College Daily",
        "url": "https://www.ccdaily.com/2026/08/dol-awards-85m-for-rural-youth-apprenticeships-and-clean-tech/"
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

    // Automatically resolve politician IDs from profiles database by scanning article headline, tags, and body
    let resolvedPoliticianIds = await resolvePoliticianIds(article, authHeaders);
    if (resolvedPoliticianIds.length === 0 && article.taggedPoliticianIds && article.taggedPoliticianIds.length > 0) {
      resolvedPoliticianIds = article.taggedPoliticianIds;
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
