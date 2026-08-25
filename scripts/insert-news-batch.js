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
    "slug": "sec-finalizes-corporate-scope-one-and-two-greenhouse-gas-emissions-disclosure-rules-2026-08-25",
    "headline": "SEC Finalizes Mandatory Corporate Climate and Greenhouse Gas Emissions Disclosure Standards",
    "summary": "Securities and Exchange Commission Chair Gary Gensler issues a landmark final rule mandating standardized Scope 1 and Scope 2 greenhouse gas emissions reporting and material climate risk disclosures for publicly traded companies.",
    "category": "Economy",
    "country": "US",
    "province": "DC",
    "impactArea": "national",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "SEC",
      "Gary Gensler",
      "Climate Disclosures",
      "Corporate Governance",
      "Economy",
      "Financial Regulation"
    ],
    "taggedPoliticians": [
      "Gary Gensler"
    ],
    "author": {
      "name": "Choseno Capital Markets Bureau",
      "bio": "Federal securities regulation, corporate financial disclosure policy, and market transparency"
    },
    "sources": [
      {
        "name": "Securities and Exchange Commission",
        "url": "https://www.sec.gov"
      },
      {
        "name": "The Wall Street Journal",
        "url": "https://www.wsj.com"
      }
    ],
    "seoTitle": "SEC Finalizes Mandatory Corporate Climate Disclosure Rules | Choseno",
    "metaDescription": "SEC Chair Gary Gensler enacts landmark final rules mandating Scope 1 and Scope 2 greenhouse gas emissions reporting for public companies.",
    "tweet": "The SEC finalizes landmark rules requiring publicly traded corporations to disclose Scope 1 and Scope 2 emissions and severe climate financial risks.",
    "breakingNews": false,
    "body": "WASHINGTON — The Securities and Exchange Commission (SEC), led by Chair Gary Gensler, voted on Monday to adopt its finalized rules on The Enhancement and Standardization of Climate-Related Disclosures for Investors, establishing binding statutory mandates for large accelerated filers and publicly traded corporations to report material direct greenhouse gas emissions and physical climate risks in annual 10-K filings.\n\nThe regulatory standard requires public companies to disclose Scope 1 (direct operational emissions) and Scope 2 (indirect emissions from purchased electricity) if deemed financially material, alongside audited disclosures of capital expenditures incurred from severe weather events such as hurricanes, wildfires, and sea-level rise.\n\nProviding Transparent, Decision-Useful Information for Capital Markets\nInstitutional investors managing over $130 trillion in global assets have long demanded standardized, comparable climate risk disclosures to price physical asset vulnerabilities, evaluate transition risks, and protect retail shareholders from corporate greenwashing.\n\n\"Investors representing tens of trillions of dollars in retirement savings and pension funds need consistent, comparable, and decision-useful disclosures to evaluate the material financial risks facing public companies,\" SEC Chair Gary Gensler said in Washington. \"Climate risks can have a profound impact on a company's bottom line, balance sheet, and long-term viability. Today's finalized rule brings climate disclosures into the standard securities reporting framework, ensuring investors receive reliable, audited information about material risks.\"\n\nKey Provisions of the Finalized SEC Rule\nUnder the enacted disclosure rules:\n- Scope 1 and Scope 2 Reporting: Large accelerated filers must disclose direct and electricity-related emissions with phased-in independent third-party reasonable assurance audits by 2029.\n- Severe Weather Financial Statement Notes: Requiring capitalized costs, expenditures, and losses incurred as a result of severe weather events (floods, hurricanes, tornadoes, wildfires) to be disclosed in financial statement footnotes.\n- Transition Plan Transparency: Public companies that have established voluntary net-zero goals must disclose detailed capital allocation plans and progress metrics.\n\nInstitutional investors and corporate governance federations commended the finalized standard, highlighting that uniform reporting creates a level playing field across public capital markets."
  },
  {
    "slug": "fra-awards-650-million-for-pacific-northwest-cascadia-ultra-high-speed-rail-corridor-engineering-2026-08-25",
    "headline": "Federal Railroad Administration Directs $650 Million for Cascadia Ultra-High-Speed Rail Corridor",
    "summary": "Transportation Secretary Pete Buttigieg and the FRA award $650 million in Federal-State National Rail Program grants to complete detailed engineering and environmental impact statements for the 250-mph Cascadia high-speed rail corridor.",
    "category": "Transportation",
    "country": "US",
    "province": "DC",
    "impactArea": "regional",
    "latitude": 47.6062,
    "longitude": -122.3321,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "FRA",
      "Pete Buttigieg",
      "High-Speed Rail",
      "Cascadia",
      "Transportation",
      "Infrastructure"
    ],
    "taggedPoliticians": [
      "Pete Buttigieg"
    ],
    "author": {
      "name": "Choseno Transportation Safety Bureau",
      "bio": "Federal railway policy, high-speed rail engineering, and intercity passenger transit"
    },
    "sources": [
      {
        "name": "Federal Railroad Administration",
        "url": "https://railroads.dot.gov"
      },
      {
        "name": "The Seattle Times",
        "url": "https://www.seattletimes.com"
      }
    ],
    "seoTitle": "FRA Awards $650M for 250-MPH Cascadia High-Speed Rail Corridor | Choseno",
    "metaDescription": "USDOT Secretary Pete Buttigieg allocates $650M to finalize engineering for the 250-mph Cascadia bullet train connecting Vancouver, Seattle, and Portland.",
    "tweet": "USDOT awards $650M for Cascadia Ultra-High-Speed Rail, advancing the 250-mph bullet train linking Vancouver, Seattle, and Portland in under one hour.",
    "breakingNews": false,
    "body": "SEATTLE — U.S. Transportation Secretary Pete Buttigieg and Federal Railroad Administration (FRA) Administrator Amit Bose announced on Monday the distribution of $650 million in federal rail capital grants from the Infrastructure Investment and Jobs Act to finance final environmental impact statements, track alignment engineering, and station area master plans for the 350-kilometer Cascadia Ultra-High-Speed Rail corridor connecting Vancouver, British Columbia, Seattle, Washington, and Portland, Oregon.\n\nThe international mega-project, developed in tripartite partnership between Washington State, Oregon, and the Province of British Columbia, will construct a dedicated double-track electrified railway capable of operating commercial bullet trains at speeds up to 250 miles per hour (400 km/h), slashing travel times between Seattle and Vancouver to under one hour.\n\nTransforming Regional Mobility and Eliminating 6 Million Highway Trips Annually\nInterstate 5 through the Pacific Northwest is one of the most congested highway corridors in North America, where regional population growth is projected to add 4 million new residents by 2050, overwhelming highway lanes and airport runways.\n\n\"The Pacific Northwest Cascadia mega-region has the economic vitality, the density, and the cross-border vision to lead America into the high-speed rail era,\" Transportation Secretary Pete Buttigieg said at King Street Station in Seattle. \"A 250-mph electric train connecting Vancouver, Seattle, and Portland in under an hour will transform regional commerce, take millions of cars off I-5, eliminate short-haul flight emissions, and support over 35,000 good union construction careers.\"\n\nEngineering Milestones and Cross-Border Interties\nThe $650 million federal allocation finances:\n- Detailed Track Alignment & Tunnel Engineering: Designing grade-separated rights-of-way, mountain tunnels, and seismic-resistant viaducts.\n- Cross-Border Pre-Clearance Customs Facilities: Designing streamlined international customs processing terminals at Vancouver Pacific Central and Seattle King Street Stations.\n- High-Speed Rail Station Area Urban Density Plans: Coordinating transit-oriented housing and commercial development around five intermediate regional stations.\n\nPacific Northwest governors, British Columbia ministers, business leaders, and construction trade unions commended the federal awards, emphasizing that high-speed rail binds the Cascadia innovation economy into a globally competitive mega-region."
  },
  {
    "slug": "department-of-energy-directs-480-million-for-pacific-northwest-green-hydrogen-hub-electrolyzer-arrays-2026-08-25",
    "headline": "Department of Energy Awards $480 Million for Pacific Northwest Green Hydrogen Electrolyzer Hubs",
    "summary": "Energy Secretary Jennifer Granholm awards $480 million to construct multi-megawatt green hydrogen production facilities powered by renewable hydro and wind energy in Washington and Oregon.",
    "category": "Clean Energy",
    "country": "US",
    "province": "DC",
    "impactArea": "regional",
    "latitude": 46.2804,
    "longitude": -119.2752,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Department of Energy",
      "Jennifer Granholm",
      "Clean Hydrogen",
      "Pacific Northwest",
      "Clean Energy",
      "Manufacturing"
    ],
    "taggedPoliticians": [
      "Jennifer Granholm"
    ],
    "author": {
      "name": "Choseno Federal Energy Desk",
      "bio": "Federal energy technology, regional clean hydrogen hubs, and industrial decarbonization"
    },
    "sources": [
      {
        "name": "U.S. Department of Energy",
        "url": "https://www.energy.gov"
      },
      {
        "name": "The Oregonian",
        "url": "https://www.oregonlive.com"
      }
    ],
    "seoTitle": "DOE Directs $480M for Pacific Northwest Clean Hydrogen Hub | Choseno",
    "metaDescription": "Energy Secretary Jennifer Granholm allocates $480M to build utility-scale green hydrogen production plants across Washington and Oregon.",
    "tweet": "The DOE awards $480M to construct commercial green hydrogen electrolyzers powered by Columbia River hydro in the Pacific Northwest.",
    "breakingNews": false,
    "body": "RICHLAND, Wash. — Secretary of Energy Jennifer Granholm announced on Monday the distribution of $480 million in Phase 1 implementation grants through the Regional Clean Hydrogen Hubs Program (H2Hubs) to construct commercial-scale green hydrogen production electrolyzers, cryogenic storage terminals, and industrial pipeline manifolds across the Pacific Northwest Hydrogen Hub (PNW H2) in Washington, Oregon, and Montana.\n\nThe regional hub, managed in partnership with public utility districts, tribal nations, and industrial manufacturers, utilizes low-cost zero-carbon hydroelectricity from the Columbia River basin and regional wind energy to power 300 megawatts of Proton Exchange Membrane (PEM) electrolyzers, manufacturing zero-emission green hydrogen for heavy transportation, clean fertilizer production, and maritime vessels.\n\nDecarbonizing Heavy Industry and Maritime Shipping\nHeavy industries—including chemical refining, agricultural fertilizer synthesis, and maritime cargo shipping—cannot practically be electrified with batteries alone, requiring high-energy-density green hydrogen molecules to displace fossil fuels.\n\n\"The Pacific Northwest has some of the cleanest electricity on earth, and we are harnessing that clean energy to lead the global green hydrogen revolution,\" Secretary Jennifer Granholm said at the Pacific Northwest National Laboratory in Richland. \"This $480 million investment puts clean hydrogen production to work in heavy manufacturing, ports, and long-haul trucking, cleaning up our air, creating thousands of high-wage union energy careers, and establishing America as the clean fuel capital of the world.\"\n\nHub Infrastructure Allocations\nThe $480 million award finances:\n- 300-MW Commercial PEM Electrolyzer Facilities: Located in Centralia, Richland, and Boardman, producing 120 metric tons of green hydrogen daily.\n- Maritime Port Hydrogen Fueling Terminals: Installing high-capacity liquid hydrogen bunkering stations at the Port of Tacoma and Port of Portland.\n- Agricultural Ammonia Production Conversion: Retrofitting regional chemical fertilizer plants to synthesize zero-carbon green ammonia from electrolytic hydrogen.\n\nBuilding trades unions, tribal council leaders, and regional utility executives commended the federal awards, highlighting that green hydrogen infrastructure provides high-wage careers in rural industrial communities."
  },
  {
    "slug": "epa-issues-final-lead-and-copper-rule-improvements-mandating-100-percent-lead-pipe-removal-in-ten-years-2026-08-25",
    "headline": "EPA Finalizes Strict Lead and Copper Rule Mandating 100% Lead Pipe Replacements in 10 Years",
    "summary": "Environmental Protection Agency Administrator Michael Regan issues the finalized Lead and Copper Rule Improvements, requiring all public drinking water utilities to replace 100% of lead service lines within ten years regardless of water testing results.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "impactArea": "national",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "EPA",
      "Michael Regan",
      "Clean Water",
      "Lead Pipes",
      "Public Health",
      "Infrastructure"
    ],
    "taggedPoliticians": [
      "Michael Regan"
    ],
    "author": {
      "name": "Choseno Environmental Health Bureau",
      "bio": "Federal environmental regulations, safe drinking water policy, and public health standards"
    },
    "sources": [
      {
        "name": "Environmental Protection Agency",
        "url": "https://www.epa.gov"
      },
      {
        "name": "Associated Press",
        "url": "https://apnews.com"
      }
    ],
    "seoTitle": "EPA Mandates 100% Lead Water Pipe Removal Within 10 Years | Choseno",
    "metaDescription": "EPA Administrator Michael Regan finalizes rules requiring all US water utilities to replace 100% of lead drinking water pipes within a decade.",
    "tweet": "The EPA finalizes landmark Lead and Copper Rule improvements, requiring all public water utilities to replace 100% of lead pipes within 10 years.",
    "breakingNews": false,
    "body": "WASHINGTON — Environmental Protection Agency (EPA) Administrator Michael Regan announced on Monday the formal promulgation and statutory enforcement schedule for the Lead and Copper Rule Improvements (LCRI), establishing an absolute nationwide legal mandate requiring all public water systems across the United States to physically excavate and replace 100 percent of lead drinking water service lines within ten years.\n\nThe regulatory standard eliminates long-standing legal loopholes that allowed utilities to leave lead pipes in the ground if chemical corrosion inhibitors maintained tap sampling below arbitrary action levels, lowering the federal lead action level from 15 parts per billion down to 10 parts per billion.\n\nProtecting Millions of American Children from Neurological Damage\nMore than 9 million legacy lead service lines remain connected to American homes, childcare centers, and elementary schools. Medical science confirms that there is no safe level of lead exposure for children, where even microscopic lead contamination causes irreversible neurological impairment, reduced IQ, and behavioral disorders.\n\n\"Lead is a potent neurotoxin that steals the potential of our children, and for too long, millions of American families have been exposed to lead every time they turn on their taps,\" EPA Administrator Michael Regan said in Washington. \"Today's finalized rule achieves what should have been done decades ago: requiring every water utility in America to get all lead pipes out of the ground within ten years. Supported by $15 billion in federal infrastructure funding, we are finally consigning lead pipes to the history books.\"\n\nCore Regulatory Mandates Under LCRI\nUnder the finalized EPA rule:\n- Mandatory 10-Year Replacement Timeline: Utilities must replace an average of 10 percent of their lead service line inventory every year.\n- Full-Line Replacement Mandate: Prohibiting partial lead service line replacements that temporarily spike lead concentrations.\n- Public Digital Pipe Inventories: Requiring public water utilities to maintain interactive online GIS maps showing the location and material of every service line.\n\nPublic health pediatricians, clean water advocates, and municipal water directors celebrated the historic rule, highlighting that full public funding ensures lead elimination without burdensome water rate hikes."
  },
  {
    "slug": "california-governor-gavin-newsom-signs-landmark-ocean-desalination-and-marine-brackish-groundwater-act-2026-08-25",
    "headline": "Governor Gavin Newsom Signs Expedited Marine Desalination and Coastal Water Resilience Act",
    "summary": "California Governor Gavin Newsom and State Senator Ben Allen enact Senate Bill 1390, establishing an expedited 180-day coastal permitting framework and allocating $250 million for subsurface intake ocean desalination and brackish groundwater treatment plants.",
    "category": "Infrastructure",
    "country": "US",
    "province": "CA",
    "impactArea": "state",
    "latitude": 33.7701,
    "longitude": -118.1937,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Gavin Newsom",
      "Ben Allen",
      "California",
      "Desalination",
      "Water Resilience",
      "Clean Water"
    ],
    "taggedPoliticians": [
      "Gavin Newsom",
      "Ben Allen"
    ],
    "author": {
      "name": "Choseno California Water Bureau",
      "bio": "California coastal water policy, marine engineering, and drought adaptation"
    },
    "sources": [
      {
        "name": "Los Angeles Times",
        "url": "https://www.latimes.com"
      },
      {
        "name": "Orange County Register",
        "url": "https://www.ocregister.com"
      }
    ],
    "seoTitle": "Gavin Newsom Signs $250M Coastal Desalination Permitting Act | Choseno",
    "metaDescription": "California Governor Gavin Newsom signs SB 1390, establishing a fast-track 180-day permit process and $250M for environmentally safe desalination plants.",
    "tweet": "Governor Gavin Newsom and Ben Allen sign SB 1390, allocating $250M to build environmentally safe subsurface ocean desalination plants in California.",
    "breakingNews": false,
    "body": "HUNTINGTON BEACH, Calif. — Governor Gavin Newsom and State Senator Ben Allen signed Senate Bill 1390 into law on Monday, establishing an expedited 180-day interagency permitting process and directing $250 million from the California Climate Commitment to engineer and construct environmentally protective subsurface-intake ocean desalination facilities and coastal brackish groundwater treatment plants across Monterey, Ventura, Orange, and San Diego Counties.\n\nThe legislation modernizes state coastal development standards by mandating environmentally safe subsurface slant wells that draw seawater through natural sand filters beneath the ocean floor, eliminating marine life entrainment and impingement while pairing desalination operations with dedicated 100 percent renewable solar and wind power.\n\nBuilding Climate-Proof, Ocean-Reliant Drinking Water Supplies\nAmid intensifying Pacific climate whiplash characterized by severe multi-year megadroughts, coastal cities need drought-independent local water supplies that do not depend on vulnerable snowpack from the Sierra Nevada or imported Colorado River supplies.\n\n\"California possesses 840 miles of majestic Pacific coastline, and ocean water represents an inexhaustible, climate-proof water source if we develop it responsibly,\" Governor Newsom said during a bill signing in Huntington Beach. \"SB 1390 cuts through years of bureaucratic red tape, setting a strict 180-day state permitting timeline for projects that use subsurface slant wells to protect marine life. This $250 million investment builds the modern, clean-powered desalination infrastructure needed to drought-proof our coastal communities for decades.\"\n\nMajor Infrastructure Projects Funded\nThe $250 million package finances:\n- Monterey Peninsula Subsurface Desalination Facility: $90 million for a 6.4-MGD plant utilizing slant wells to restore overdrafted Carmel River flows.\n- Doheny Ocean Desalination Project (Orange County): $70 million for a 5-MGD municipal desalination facility providing local emergency water security.\n- Ventura County Coastal Brackish Groundwater Extraction: $50 million for deep groundwater treatment wells and reverse-osmosis skids.\n- Marine Ecological Monitoring & Brine Diffusers: $40 million to deploy automated multi-port offshore brine diffusers that ensure rapid dilution without ocean stagnation.\n\nMunicipal water directors, building trades labor unions, and marine conservation biologists commended the legislation, highlighting that subsurface intakes resolve environmental concerns while securing local drinking water independence."
  },
  {
    "slug": "texas-governor-greg-abbott-directs-260-million-for-statewide-commercial-drone-air-traffic-corridors-and-vertiports-2026-08-25",
    "headline": "Governor Greg Abbott Directs $260 Million for Texas Advanced Air Mobility and Commercial Vertiports",
    "summary": "Texas Governor Greg Abbott and TxDOT announce $260 million to construct twenty-four electric vertical takeoff and landing (eVTOL) vertiports and deploy automated uncrewed traffic management (UTM) corridors across the Texas Triangle.",
    "category": "Technology",
    "country": "US",
    "province": "TX",
    "impactArea": "state",
    "latitude": 32.7767,
    "longitude": -96.797,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Greg Abbott",
      "Texas",
      "Advanced Air Mobility",
      "eVTOL",
      "Drones",
      "Technology",
      "Infrastructure"
    ],
    "taggedPoliticians": [
      "Greg Abbott"
    ],
    "author": {
      "name": "Choseno Texas Politics Desk",
      "bio": "Texas state government, advanced aviation technology, and aerospace infrastructure"
    },
    "sources": [
      {
        "name": "The Dallas Morning News",
        "url": "https://www.dallasnews.com"
      },
      {
        "name": "Houston Chronicle",
        "url": "https://www.houstonchronicle.com"
      }
    ],
    "seoTitle": "Greg Abbott Directs $260M for Texas eVTOL Vertiports & Drone Corridors | Choseno",
    "metaDescription": "Texas Governor Greg Abbott awards $260 million to build 24 commercial eVTOL vertiports and uncrewed drone air corridors across Texas.",
    "tweet": "Governor Greg Abbott announces $260M to construct 24 commercial eVTOL vertiports and uncrewed drone freight corridors across the Texas Triangle.",
    "breakingNews": false,
    "body": "DALLAS — Governor Greg Abbott and the Texas Department of Transportation (TxDOT) announced on Monday the distribution of $260 million in state aerospace infrastructure grants through the Texas Advanced Air Mobility (AAM) Initiative to construct twenty-four electric Vertical Takeoff and Landing (eVTOL) commercial passenger vertiports and deploy uncrewed traffic management (UTM) digital flight corridors across Dallas-Fort Worth, Houston, Austin, and San Antonio.\n\nThe investment positions Texas as the premier global launchpad for electric air taxis and automated commercial cargo delivery drones, constructing high-voltage megawatt vertiport charging pads on hospital rooftops, regional airports, and suburban intermodal transit centers.\n\nLeading the Next Era of Urban Aviation and Express Medical Freight\nRapid urban highway congestion in the booming Texas Triangle has spurred commercial demand for electric air taxis capable of transporting passengers between downtown commercial centers and international airports in under fifteen minutes.\n\n\"Texas is the frontier of aviation innovation, from the earliest days of flight to the future of urban air mobility,\" Governor Abbott said during an announcement at the Vertiport Chicago site in Dallas. \"Electric air taxis and cargo drones will revolutionize urban transportation, deliver life-saving medical organs across cities in minutes, and relieve highway congestion. This $260 million investment builds the charging vertiports and digital airspace corridors needed to establish Texas as the advanced air mobility capital of the world.\"\n\nVertiport Deployments and Airspace Infrastructure\nThe $260 million program includes:\n- 24 Commercial Passenger Vertiports: Constructing elevated landing pads with 1-MW automated electric aircraft chargers in major metropolitan centers.\n- Statewide Low-Altitude Digital UTM Corridors: Installing cellular-connected 5G radar telemetry tracking thousands of commercial drones simultaneously.\n- Emergency Medical Drone Delivery Hubs: $40 million dedicated for automated drone delivery networks transporting blood products and antivenom to rural emergency rooms.\n\nAerospace manufacturers, regional airport directors, and building trades labor unions commended the state investment, highlighting that proactive ground infrastructure accelerates commercial air taxi certification."
  },
  {
    "slug": "florida-governor-ron-desantis-announces-140-million-for-tampa-bay-and-biscayne-bay-coral-nursery-reef-propagation-2026-08-25",
    "headline": "Governor Ron DeSantis Allocates $140 Million for Florida Coral Reef Propagation and Restoration",
    "summary": "Florida Governor Ron DeSantis and FWC announce $140 million in state marine conservation grants to construct climate-resilient land-based coral nurseries and outplant 500,000 heat-tolerant stony corals along the Florida Reef Tract.",
    "category": "Environment",
    "country": "US",
    "province": "FL",
    "impactArea": "state",
    "latitude": 25.7617,
    "longitude": -80.1918,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Ron DeSantis",
      "Shawn Hamilton",
      "Florida",
      "Coral Reefs",
      "Marine Conservation",
      "Environment"
    ],
    "taggedPoliticians": [
      "Ron DeSantis",
      "Shawn Hamilton"
    ],
    "author": {
      "name": "Choseno Florida Desk",
      "bio": "Florida marine resource policy, coral reef ecology, and coastal ecosystem restoration"
    },
    "sources": [
      {
        "name": "Miami Herald",
        "url": "https://www.miamiherald.com"
      },
      {
        "name": "Sun Sentinel",
        "url": "https://www.sun-sentinel.com"
      }
    ],
    "seoTitle": "DeSantis Directs $140M for Florida Coral Reef Propagation | Choseno",
    "metaDescription": "Florida Governor Ron DeSantis awards $140M to construct onshore coral gene banks and plant 500,000 heat-tolerant corals along the Florida Reef Tract.",
    "tweet": "Governor Ron DeSantis announces $140M to build land-based coral nurseries and outplant 500,000 heat-tolerant corals to restore Florida's Barrier Reef.",
    "breakingNews": false,
    "body": "MIAMI — Governor Ron DeSantis and Florida Department of Environmental Protection (DEP) Secretary Shawn Hamilton announced on Monday the distribution of $140 million in state marine conservation capital through the Florida Coral Reef Protection and Restoration Program to construct state-of-the-art land-based bio-secure coral gene nurseries and outplant more than 500,000 genetically resilient, heat-tolerant stony corals across the 350-mile Florida Reef Tract.\n\nThe investment coordinates public funding with marine research institutions—including the University of Miami Rosenstiel School, Nova Southeastern University, and Mote Marine Laboratory—to scale micro-fragmentation propagation and selective breeding of elkhorn, staghorn, and brain corals capable of surviving elevated ocean summer temperatures.\n\nProtecting Florida's Natural Barrier Against Storm Surges and Sustaining Tourism\nFlorida's Coral Reef Tract is the third-largest living barrier reef in the world, generating over $8.5 billion in annual economic output from recreational diving, commercial fishing, and tourism while attenuating up to 97 percent of ocean wave energy during severe tropical storms.\n\n\"Florida's coral reefs are a national ecological treasure and the first line of defense protecting our coastal communities from hurricane storm surges,\" Governor DeSantis said at the University of Miami marine campus. \"Following recent ocean heatwaves, we are taking unprecedented, science-driven action to protect and restore our reef tract. This $140 million investment expands our world-class land-based coral breeding nurseries, outplants half a million resilient corals, and ensures Florida's reefs thrive for future generations.\"\n\nCoral Propagation and Coastal Infrastructure Upgrades\nThe $140 million program finances:\n- Four Regional Land-Based Coral Gene Banks: Constructing climate-controlled seawater raceways holding thousands of genetically distinct broodstock colonies.\n- 500,000 Heat-Tolerant Coral Outplantings: Utilizing underwater divers and automated robotic micro-cement anchors to secure nursery-grown corals onto degraded barrier reefs.\n- Biscayne Bay & Florida Keys Water Quality Monitoring: $35 million to expand continuous online salinity, dissolved oxygen, and nutrient sensors along coastal reef lines.\n\nMarine scientists, recreational diving associations, and commercial charter captains praised the governor's decisive funding, highlighting that genetic coral breeding provides the scientific foundation to rebuild resilient ocean ecosystems."
  },
  {
    "slug": "governor-kathy-hochul-allocates-210-million-for-empire-station-complex-subway-underground-concourse-connections-2026-08-25",
    "headline": "Governor Kathy Hochul Directs $210 Million for Penn Station Underground Concourse and Subway Interties",
    "summary": "New York Governor Kathy Hochul and the MTA award $210 million in capital construction contracts to build a continuous underground pedestrian concourse connecting Penn Station to the Herald Square and 34th Street subway complexes.",
    "category": "Transportation",
    "country": "US",
    "province": "NY",
    "impactArea": "state",
    "latitude": 40.7505,
    "longitude": -73.9934,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Kathy Hochul",
      "New York",
      "Penn Station",
      "MTA",
      "Subway",
      "Transit",
      "Infrastructure"
    ],
    "taggedPoliticians": [
      "Kathy Hochul"
    ],
    "author": {
      "name": "Choseno New York Transportation Bureau",
      "bio": "MTA transit capital projects, Penn Station reconstruction, and urban pedestrian mobility"
    },
    "sources": [
      {
        "name": "The New York Times",
        "url": "https://www.nytimes.com"
      },
      {
        "name": "AM New York",
        "url": "https://www.amny.com"
      }
    ],
    "seoTitle": "Kathy Hochul Directs $210M for Penn Station Underground Concourses | Choseno",
    "metaDescription": "New York Governor Kathy Hochul awards $210M to construct a continuous underground pedestrian concourse linking Penn Station to Herald Square.",
    "tweet": "Governor Kathy Hochul announces $210M to construct a continuous underground pedestrian concourse connecting Penn Station to Herald Square subways.",
    "breakingNews": false,
    "body": "NEW YORK — Governor Kathy Hochul and Metropolitan Transportation Authority (MTA) Chair and CEO Janno Lieber announced on Monday the awarding of $210 million in civil construction contracts through the MTA Capital Program to build the 33rd Street Underground Pedestrian Concourse, creating a direct, weather-protected subterranean connection between Penn Station and the 34th Street–Herald Square subway complex.\n\nThe project re-establishes the historic \"Gimbels Passageway,\" widening the subterranean corridor to thirty feet, installing high-definition digital passenger wayfinding, ADA-accessible elevators, and direct faregate turnstiles connecting Long Island Rail Road (LIRR), NJ Transit, and Amtrak passenger platforms directly to the B, D, F, M, N, Q, R, W, and PATH train lines.\n\nRelieving Severe Street-Level Congestion for 600,000 Daily Commuters\nPenn Station is the busiest transit hub in the Western Hemisphere, serving over 600,000 daily passenger trips. Currently, tens of thousands of transferring commuters are forced to exit onto crowded street-level sidewalks along 33rd and 34th Streets, creating severe midtown pedestrian gridlock.\n\n\"Penn Station is the front door to New York City for hundreds of thousands of commuters every single day, and we are transforming it into a world-class transit hub,\" Governor Hochul said during an announcement at Moynihan Train Hall. \"For decades, commuters were forced to walk in rain and snow across crowded midtown streets just to transfer between trains. This $210 million investment builds a wide, brightly lit, and modern underground concourse connecting Penn Station directly to Herald Square subways, saving commuters time and improving safety for all New Yorkers.\"\n\nConcourse Infrastructure and Architectural Features\nThe $210 million project finances:\n- 1,200-Foot Widened Subterranean Concourse: Reconstructing the corridor with structural steel supports, terrazzo flooring, and high-efficiency LED ceiling fixtures.\n- Direct Subway Faregate Plazas: Installing 36 automated OMNY contactless faregates at the 6th Avenue subway entrance.\n- Modern Life-Safety & Ventilation Systems: Installing commercial air filtration and automated fire suppression dampers throughout the concourse.\n\nTransit rider advocacy organizations, business improvement districts, and construction trade unions praised the contract awards, emphasizing that underground pedestrian connectivity dramatically improves commuter transit speed."
  },
  {
    "slug": "governor-jb-pritzker-signs-statutory-protections-mandating-transparent-algorithmic-workplace-productivity-disclosures-2026-08-25",
    "headline": "Governor JB Pritzker Signs Nation's First Algorithmic Workplace Productivity Transparency Act",
    "summary": "Illinois Governor JB Pritzker signs Public Act 104-0388, prohibiting commercial employers from using automated algorithmic quotas that compromise employee bathroom access and mandating full transparency for electronic workplace monitoring systems.",
    "category": "Economy",
    "country": "US",
    "province": "IL",
    "impactArea": "state",
    "latitude": 41.8781,
    "longitude": -87.6298,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "JB Pritzker",
      "Illinois",
      "Worker Rights",
      "Artificial Intelligence",
      "Algorithmic Management",
      "Labor"
    ],
    "taggedPoliticians": [
      "JB Pritzker"
    ],
    "author": {
      "name": "Choseno Midwest Labor Bureau",
      "bio": "Illinois labor regulation, workplace artificial intelligence policy, and worker privacy"
    },
    "sources": [
      {
        "name": "Chicago Sun-Times",
        "url": "https://chicago.suntimes.com"
      },
      {
        "name": "WBEZ Chicago",
        "url": "https://www.wbez.org"
      }
    ],
    "seoTitle": "JB Pritzker Signs Nation's First Workplace Algorithm Transparency Act | Choseno",
    "metaDescription": "Illinois Governor JB Pritzker signs legislation mandating transparency for AI worker tracking algorithms and banning abusive productivity quotas.",
    "tweet": "Governor JB Pritzker signs historic legislation protecting workers from abusive algorithmic tracking and automated workplace productivity quotas.",
    "breakingNews": false,
    "body": "CHICAGO — Governor JB Pritzker signed Public Act 104-0388 into law on Monday, enacting the nation's first comprehensive Algorithmic Workplace Productivity Transparency Act, establishing statutory guardrails governing how commercial employers in logistics warehousing, call centers, and delivery services utilize artificial intelligence and algorithmic monitoring tools to evaluate, discipline, or terminate employees.\n\nThe legislation, supported by labor unions, worker centers, and legal aid federations, requires employers to provide workers with written explanations of all automated surveillance and productivity scoring algorithms, while explicitly prohibiting speed quotas that interfere with statutory meal breaks, rest periods, or bathroom access.\n\nProtecting Warehouse and Service Workers from Abusive Automated Quotas\nLogistics warehouse workers and customer service representatives increasingly work under algorithmic tracking systems that measure \"time off task\" down to the second, penalizing employees who pause to stretch or drink water, driving workplace injury rates in automated fulfillment centers to twice the private industry average.\n\n\"Technology in the workplace should empower workers, not subject them to constant, dehumanizing surveillance and impossible speed quotas that lead to severe injuries,\" Governor Pritzker said during a bill signing at a union training center in Chicago. \"Public Act 104-0388 ensures that Illinois workers are treated with basic human dignity, mandating complete transparency in automated scoring systems, protecting essential rest breaks, and ensuring automated algorithms cannot secretly fire hardworking men and women.\"\n\nKey Worker Protections Under Public Act 104-0388\nUnder the enacted law:\n- Mandatory Algorithmic Disclosures: Employers must provide newly hired workers with plain-language descriptions of all biometric, keystroke, and video surveillance tools used for productivity evaluation.\n- Ban on Unsafe Speed Quotas: Employers cannot establish productivity quotas that penalize workers for taking statutory meal breaks or using restroom facilities.\n- Right to Contest Algorithmic Disciplines: Employees facing disciplinary action or termination generated by an algorithm have a statutory right to human review and complete access to underlying tracking telemetry.\n\nLabor leaders, workplace safety advocates, and employment law scholars commended the landmark statute, noting that Illinois is establishing the national model for ethical artificial intelligence governance in the workplace."
  },
  {
    "slug": "governor-josh-shapiro-directs-105-million-for-allegheny-and-delaware-river-commercial-freight-dredging-and-locks-2026-08-25",
    "headline": "Governor Josh Shapiro Allocates $105 Million for Pennsylvania Commercial Marine Locks and Freight Terminals",
    "summary": "Pennsylvania Governor Josh Shapiro and PennDOT announce $105 million to rehabilitate navigation lock structures and dredge commercial freight berths along the Allegheny, Monongahela, and Delaware Rivers.",
    "category": "Transportation",
    "country": "US",
    "province": "PA",
    "impactArea": "state",
    "latitude": 40.4406,
    "longitude": -79.9959,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Josh Shapiro",
      "Pennsylvania",
      "Inland Ports",
      "Transportation",
      "Freight",
      "Infrastructure"
    ],
    "taggedPoliticians": [
      "Josh Shapiro"
    ],
    "author": {
      "name": "Choseno Pennsylvania Bureau",
      "bio": "Pennsylvania commercial water transport, freight logistics, and river infrastructure"
    },
    "sources": [
      {
        "name": "Pittsburgh Post-Gazette",
        "url": "https://www.post-gazette.com"
      },
      {
        "name": "Philadelphia Inquirer",
        "url": "https://www.inquirer.com"
      }
    ],
    "seoTitle": "Josh Shapiro Directs $105M for PA Commercial River Locks & Docks | Choseno",
    "metaDescription": "PA Governor Josh Shapiro awards $105 million to modernize river locks and commercial bulk shipping docks in Pittsburgh and Philadelphia.",
    "tweet": "Governor Josh Shapiro announces $105M in state capital grants to modernize commercial river locks and bulk shipping terminals across Pennsylvania.",
    "breakingNews": false,
    "body": "PITTSBURGH — Governor Josh Shapiro and Pennsylvania Department of Transportation (PennDOT) Secretary Mike Carroll announced on Monday the distribution of $105 million in state maritime infrastructure grants through the Pennsylvania Marine Transportation Program to modernize commercial bulk cargo terminals, rehabilitate century-old lock gate structures, and dredge deepwater berths along the Allegheny, Monongahela, and Delaware Rivers.\n\nThe investment targets critical industrial river ports—including the Port of Pittsburgh, the PhilaPort deepwater terminals in Philadelphia, and the Port of Erie—that handle over 65 million tons of steel, aggregates, coal, agricultural commodities, and manufacturing components annually.\n\nKeeping Pennsylvania's River Freight Moving Efficiently\nWaterborne river freight is the most fuel-efficient method for transporting heavy raw materials, where a single 15-barge river tow carries the cargo equivalent of 1,050 commercial tractor-trailers, significantly lowering highway congestion on Interstates 76 and 80.\n\n\"Pennsylvania was built on our rivers and industrial ports, and they remain vital economic engines connecting our Commonwealth to global markets,\" Governor Shapiro said at a maritime terminal along the Monongahela River in Pittsburgh. \"By investing $105 million in modern dock walls, high-capacity cranes, and deepwater dredging, we are keeping our river navigation channels open, lowering shipping costs for Pennsylvania manufacturers, and supporting thousands of good-paying union maritime and industrial jobs.\"\n\nMajor Port Infrastructure Packages\nThe $105 million allocation finances:\n- Port of Pittsburgh Inland Navigation Modernization: $50 million to repair crumbling concrete dock walls and install heavy-duty electric crane infrastructure across five regional terminals.\n- PhilaPort Deepwater Berth Maintenance: $35 million for maintenance dredging maintaining 45-foot authorized draft along the Delaware River.\n- Port of Erie Great Lakes Freight Dock Fortification: $20 million for dock wall stabilization and heavy machinery roll-on/roll-off ramps.\n\nMaritime trade associations, river pilot federations, and manufacturing leaders praised the state investment, highlighting that reliable river locks prevent costly commercial shipping bottlenecks."
  },
  {
    "slug": "governor-gretchen-whitmer-awards-90-million-for-statewide-rural-veterans-telehealth-and-outpatient-clinics-2026-08-25",
    "headline": "Governor Gretchen Whitmer Directs $90 Million for Michigan Rural Veterans Healthcare and Telehealth",
    "summary": "Michigan Governor Gretchen Whitmer and MVAA announce $90 million in state veterans healthcare grants to modernize outpatient clinics, deploy mobile telehealth vans, and recruit specialized psychiatric clinicians across eighteen rural counties.",
    "category": "Healthcare",
    "country": "US",
    "province": "MI",
    "impactArea": "state",
    "latitude": 46.4953,
    "longitude": -84.3453,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Gretchen Whitmer",
      "Michigan",
      "Veterans",
      "Healthcare",
      "Telehealth",
      "Public Health"
    ],
    "taggedPoliticians": [
      "Gretchen Whitmer"
    ],
    "author": {
      "name": "Choseno Great Lakes Bureau",
      "bio": "Michigan veterans affairs policy, rural healthcare delivery, and military health services"
    },
    "sources": [
      {
        "name": "The Mining Journal (Marquette)",
        "url": "https://www.miningjournal.net"
      },
      {
        "name": "Detroit Free Press",
        "url": "https://www.freep.com"
      }
    ],
    "seoTitle": "Whitmer Allocates $90M for Michigan Rural Veterans Health | Choseno",
    "metaDescription": "Michigan Governor Gretchen Whitmer awards $90 million to modernize outpatient clinics and deploy mobile health vans for rural veterans across 18 counties.",
    "tweet": "Governor Gretchen Whitmer announces $90M in state grants to modernize outpatient clinics and deploy mobile healthcare vans for rural Michigan veterans.",
    "breakingNews": false,
    "body": "SAULT STE. MARIE, Mich. — Governor Gretchen Whitmer and Michigan Veterans Affairs Agency (MVAA) Director Brian L. Love announced on Monday the distribution of $90 million in state healthcare capital grants to construct and modernize specialized veterans outpatient clinics, expand mobile clinical telemetry vans, and recruit certified mental health providers across eighteen rural counties in Northern Michigan and the Upper Peninsula.\n\nThe investment targets rural communities where over 85,000 military veterans live hours away from primary VA medical centers in Iron Mountain, Saginaw, or Ann Arbor, requiring elderly veterans to travel long distances on hazardous winter highways for routine physical therapy, audiology exams, and PTSD counseling.\n\nHonoring Michigan Veterans with High-Quality Local Healthcare Access\nMilitary veterans in rural communities face high rates of service-connected chronic pain, traumatic brain injuries (TBI), and mental health challenges, where localized outpatient care and mobile telemetry prevent clinical isolation.\n\n\"Our veterans put their lives on the line to defend our freedom and our nation, and we have a sacred duty to care for them when they return home,\" Governor Whitmer said at the American Legion Post in Sault Ste. Marie. \"No veteran in Michigan should have to drive four hours in a blizzard just to see a doctor or talk to a mental health counselor. This $90 million investment brings world-class medical care directly to our veterans in their own communities, providing modern clinics, mobile health vans, and dedicated support so our heroes get the care they earned and deserve.\"\n\nVeterans Healthcare Allocations\nThe $90 million program includes:\n- 18 Rural Outpatient Clinic Modernizations: $50 million to renovate community clinics with digital audiology booths, physical therapy suites, and diagnostic imaging.\n- 12 Mobile Veterans Healthcare Telemetry Vans: $20 million to deploy custom-built clinical vans providing free primary care, blood work, and prescription delivery.\n- Veterans Mental Health Provider Fellowships: $20 million providing salary stipends and full student loan repayments for clinical psychologists and social workers specializing in combat trauma.\n\nVeterans service organizations, county veterans counselors, and rural hospital executives commended the governor's targeted funding, highlighting that mobile outreach ensures no veteran is left behind."
  },
  {
    "slug": "governor-roy-cooper-directs-160-million-for-carolina-lithium-and-battery-materials-workforce-academy-2026-08-25",
    "headline": "Governor Roy Cooper Allocates $160 Million for North Carolina Battery Materials and Lithium Hubs",
    "summary": "North Carolina Governor Roy Cooper announces $160 million in state clean technology grants to establish the Carolina Battery Materials Innovation Academy and construct specialized chemical engineering testing labs in Gaston and Cleveland Counties.",
    "category": "Clean Energy",
    "country": "US",
    "province": "NC",
    "impactArea": "state",
    "latitude": 35.2621,
    "longitude": -81.1873,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Roy Cooper",
      "North Carolina",
      "Lithium",
      "Battery Tech",
      "Clean Energy",
      "Manufacturing",
      "Workforce"
    ],
    "taggedPoliticians": [
      "Roy Cooper"
    ],
    "author": {
      "name": "Choseno North Carolina Bureau",
      "bio": "North Carolina clean energy manufacturing, lithium extraction policy, and industrial workforce"
    },
    "sources": [
      {
        "name": "The Charlotte Observer",
        "url": "https://www.charlotteobserver.com"
      },
      {
        "name": "News & Observer",
        "url": "https://www.newsobserver.com"
      }
    ],
    "seoTitle": "Roy Cooper Directs $160M for NC Battery Materials & Lithium Hubs | Choseno",
    "metaDescription": "North Carolina Governor Roy Cooper awards $160M to build the Carolina Battery Materials Academy and train 3,000 clean energy chemical technicians.",
    "tweet": "Governor Roy Cooper announces $160M to establish the Carolina Battery Materials Academy, anchoring domestic EV battery supply chains in North Carolina.",
    "breakingNews": false,
    "body": "GASTONIA, N.C. — Governor Roy Cooper announced on Monday the distribution of $160 million in state clean technology and workforce development grants through the North Carolina Department of Commerce to construct the Carolina Battery Materials Innovation Academy and establish advanced metallurgical chemical pilot laboratories in Gaston and Cleveland Counties.\n\nThe investment anchors North Carolina's position at the heart of the \"Battery Belt,\" leveraging the historic Carolina Tin-Spodumene Belt—one of the few rich hard-rock lithium deposits in North America—to train over 3,000 certified chemical processing technicians, hydrometallurgical operators, and clean energy engineers annually.\n\nPowering America's Domestic Electric Vehicle Battery Revolution\nNorth Carolina has attracted over $14 billion in private electric vehicle and battery manufacturing investments from Toyota, Albemarle, and Piedmont Lithium. However, refining raw spodumene ore into 99.5 percent pure battery-grade lithium hydroxide requires specialized chemical engineering labor.\n\n\"North Carolina is leading the clean energy transition, and we are building the entire electric vehicle battery supply chain right here in our state,\" Governor Cooper said during an announcement at Gaston College. \"From harvesting lithium to refining battery-grade materials and manufacturing electric vehicles, North Carolina workers are powering the future. This $160 million investment creates a world-class training academy, giving our students the skills to step into high-paying chemical engineering careers and securing American energy independence.\"\n\nTraining Hubs and Pilot Lab Allocations\nThe $160 million program finances:\n- Carolina Battery Materials Innovation Academy: $75 million for advanced chemical pilot processing plants and analytical spectrometry cleanrooms at Gaston College and Cleveland Community College.\n- Advanced Pyrometallurgy & Hydrometallurgy Testing Suites: $50 million for university-partnered research pilot lines testing closed-loop lithium extraction.\n- Clean Energy Chemical Trades Apprenticeship Grants: $35 million providing full tuition scholarships and paid union apprenticeships for local students.\n\nClean energy executives, community college presidents, and building trades labor leaders praised the governor's proactive investment, emphasizing that turn-key workforce pipelines attract international chemical manufacturing capital."
  },
  {
    "slug": "mayor-matt-mahan-passes-ordinance-authorizing-40-million-for-smart-traffic-signal-ai-and-pedestrian-safety-sensors-2026-08-25",
    "headline": "Mayor Matt Mahan Directs $40 Million for San Jose AI Smart Traffic Signals and Pedestrian Vision",
    "summary": "San Jose Mayor Matt Mahan and the San Jose City Council authorize $40 million to install artificial-intelligence-enabled traffic signal controllers and automated pedestrian thermal sensors across 150 high-injury crash intersections.",
    "category": "Technology",
    "country": "US",
    "province": "CA",
    "impactArea": "local",
    "latitude": 37.3382,
    "longitude": -121.8863,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Matt Mahan",
      "San Jose",
      "Vision Zero",
      "Traffic AI",
      "Public Safety",
      "Smart Cities"
    ],
    "taggedPoliticians": [
      "Matt Mahan"
    ],
    "author": {
      "name": "Choseno Silicon Valley Bureau",
      "bio": "San Jose municipal governance, smart city artificial intelligence, and urban traffic safety"
    },
    "sources": [
      {
        "name": "The Mercury News",
        "url": "https://www.mercurynews.com"
      },
      {
        "name": "San José Spotlight",
        "url": "https://sanjosespotlight.com"
      }
    ],
    "seoTitle": "Matt Mahan Directs $40M for San Jose AI Traffic Signals & Safety | Choseno",
    "metaDescription": "San Jose Mayor Matt Mahan allocates $40M to deploy AI-enabled smart traffic signals and pedestrian thermal sensors at 150 high-crash intersections.",
    "tweet": "Mayor Matt Mahan announces $40M to deploy AI-powered smart traffic signals and automated pedestrian thermal sensors across 150 San Jose intersections.",
    "breakingNews": false,
    "body": "SAN JOSE, Calif. — Mayor Matt Mahan and the San Jose City Council voted unanimously on Monday to approve a $40 million municipal smart infrastructure capital contract, authorizing the San Jose Department of Transportation (DOT) to deploy artificial-intelligence-powered adaptive traffic signal controllers and automated computer-vision thermal sensors across 150 intersections along the city's high-injury Vision Zero crash corridors.\n\nThe edge-AI traffic management system dynamically adjusts signal timing in real time, automatically extending green pedestrian walk cycles when slow-moving seniors or parents with strollers are detected in crosswalks, while coordinating green light waves along arterial thoroughfares to eliminate vehicle idling and cut greenhouse gas emissions.\n\nEliminating Pedestrian Fatalities with Edge Artificial Intelligence\nPedestrian fatalities represent over 60 percent of traffic deaths in San Jose, where wide multi-lane arterial boulevards in East and South San Jose have historically created hazardous crossing conditions for transit riders and schoolchildren.\n\n\"As the capital of Silicon Valley, San Jose should be using the most advanced technology to solve our most urgent civic challenges, and nothing is more urgent than saving lives on our streets,\" Mayor Matt Mahan said along Monterey Road in South San Jose. \"By investing $40 million in AI-enabled smart traffic signals, we are giving our intersections the ability to see pedestrians, automatically extend walk signals for vulnerable residents, and stop red-light collisions before they happen, making San Jose's streets safe for everyone.\"\n\nSmart Intersection Deployments\nThe $40 million package finances:\n- 150 AI-Enabled Edge Traffic Controllers: Installing high-speed neural processing units (NPUs) that process optical and thermal video streams locally without transmitting private facial data.\n- Automated Crosswalk Extension Telemetry: Automatically extending walk times by up to 10 seconds when pedestrians remain in crosswalk lanes.\n- Emergency Vehicle Preemption Integration: Giving instant green light priority to San Jose Fire Department engines and ambulances within 1,000 feet of intersections.\n\nPedestrian safety advocates, senior federations, and transit associations commended the municipal council's investment, highlighting that computer-vision intersections provide immediate life-saving protection."
  },
  {
    "slug": "mayor-eric-johnson-directs-75-million-for-dallas-innovation-district-smart-streetlights-and-autonomous-shuttles-2026-08-25",
    "headline": "Mayor Eric Johnson Allocates $75 Million for Dallas Innovation District Autonomous Transit and Smart Lighting",
    "summary": "Dallas Mayor Eric Johnson and the Dallas City Council authorize $75 million in municipal capital financing to deploy zero-emission autonomous electric shuttles and install 10,000 smart LED streetlights across the Dallas Innovation District.",
    "category": "Technology",
    "country": "US",
    "province": "TX",
    "impactArea": "local",
    "latitude": 32.7767,
    "longitude": -96.797,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Eric Johnson",
      "Dallas",
      "Autonomous Shuttles",
      "Smart Cities",
      "Innovation",
      "Technology"
    ],
    "taggedPoliticians": [
      "Eric Johnson"
    ],
    "author": {
      "name": "Choseno Dallas City Hall Bureau",
      "bio": "Dallas municipal government, smart city technology, and urban mobility"
    },
    "sources": [
      {
        "name": "The Dallas Morning News",
        "url": "https://www.dallasnews.com"
      },
      {
        "name": "Dallas Business Journal",
        "url": "https://www.bizjournals.com/dallas"
      }
    ],
    "seoTitle": "Eric Johnson Directs $75M for Dallas Autonomous Shuttles & Smart Lights | Choseno",
    "metaDescription": "Dallas Mayor Eric Johnson allocates $75M to deploy autonomous electric shuttles and install 10,000 smart streetlights in the Dallas Innovation District.",
    "tweet": "Mayor Eric Johnson announces $75M for zero-emission autonomous electric shuttles and 10,000 smart LED streetlights across the Dallas Innovation District.",
    "breakingNews": false,
    "body": "DALLAS — Mayor Eric Johnson and the Dallas City Council approved a $75 million municipal smart mobility capital funding contract on Monday, authorizing the City of Dallas Transportation Department to deploy a fleet of twelve zero-emission autonomous electric passenger shuttles, install 10,000 connected smart LED streetlights, and establish high-speed municipal Wi-Fi kiosks across the Dallas Innovation District in the West End and Pegasus Park.\n\nThe project connects biotech research labs, university incubators, and residential lofts to DART rail transit stations, providing free, on-demand autonomous first-and-last-mile passenger transit along dedicated sensor-equipped transit lanes.\n\nCementing Dallas as a Premier Global Hub for Innovation and Clean Mobility\nDallas has rapidly expanded as a leading destination for biotechnology, defense technology, and clean tech corporate headquarters, where seamless autonomous transit and connected smart streetscapes foster vibrant urban collaboration.\n\n\"Dallas is leading the nation in adopting cutting-edge technology to make our city safer, cleaner, and more vibrant,\" Mayor Eric Johnson said at Pegasus Park in Dallas. \"By investing $75 million in autonomous electric transit shuttles and smart connected lighting, we are modernizing our urban core, connecting our innovation hubs with public transit, and showing the world that Dallas is the best place to build the future.\"\n\nSmart City Technology Packages\nThe $75 million package finances:\n- 12 Autonomous Electric Passenger Shuttles: Equipped with LiDAR, radar, and 360-degree cameras operating on 5-minute headways along a 4-mile loop.\n- 10,000 Connected Smart LED Streetlights: Dimming automatically during low-traffic hours to conserve energy while brightening instantly when pedestrians or emergency vehicles approach.\n- Municipal High-Speed Environmental Telemetry Kiosks: Providing free public gigabit Wi-Fi and real-time air quality monitors at 50 transit shelters.\n\nTech startup founders, urban mobility experts, and downtown business associations praised the municipal council's investment, noting that autonomous shuttles provide clean, convenient mobility for workers and residents."
  },
  {
    "slug": "industry-minister-francois-philippe-champagne-awards-380-million-for-canadian-small-modular-reactor-supply-chain-tooling-2026-08-25",
    "headline": "Industry Minister François-Philippe Champagne Directs $380 Million for Canadian SMR Nuclear Tooling Hubs",
    "summary": "Innovation Minister François-Philippe Champagne allocates $380 million through the Strategic Innovation Fund to scale nuclear-grade precision manufacturing lines for Small Modular Reactors (SMRs) across Ontario, Quebec, and Saskatchewan.",
    "category": "Energy",
    "country": "CA",
    "province": "ON",
    "impactArea": "national",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "François-Philippe Champagne",
      "Canada",
      "SMR",
      "Nuclear Energy",
      "Innovation",
      "Manufacturing"
    ],
    "taggedPoliticians": [
      "François-Philippe Champagne"
    ],
    "author": {
      "name": "Choseno National Tech Bureau",
      "bio": "Canadian federal industrial strategy, nuclear technology innovation, and advanced manufacturing"
    },
    "sources": [
      {
        "name": "Innovation, Science and Economic Development Canada",
        "url": "https://ised-isde.canada.ca"
      },
      {
        "name": "The Globe and Mail",
        "url": "https://www.theglobeandmail.com"
      }
    ],
    "seoTitle": "Champagne Directs $380M for Canadian SMR Nuclear Tooling | Choseno",
    "metaDescription": "Innovation Minister François-Philippe Champagne awards $380M to scale nuclear-grade SMR component manufacturing across Canada.",
    "tweet": "Industry Minister François-Philippe Champagne announces $380M to scale nuclear-grade SMR manufacturing tooling across Ontario, Quebec, and Saskatchewan.",
    "breakingNews": false,
    "body": "OTTAWA — Minister of Innovation, Science and Industry François-Philippe Champagne announced on Monday the distribution of $380 million in federal investments through the Strategic Innovation Fund (SIF) to scale commercial nuclear-grade manufacturing lines, precision pressure vessel forging, and specialized control-system tooling for Small Modular Reactors (SMRs) across advanced industrial facilities in Ontario, Quebec, and Saskatchewan.\n\nThe investment coordinates federal support with Canadian nuclear manufacturing leaders—including BWXT Canada, Cameco, and Westinghouse Canada—to domesticate the fabrication of reactor internals, steam generators, and fuel assemblies for GE Hitachi BWRX-300 and Westinghouse eVinci microreactors destined for domestic deployment and international export.\n\nAnchoring Canada's Global Leadership in the Clean Nuclear Renaissance\nWith global demand for firm zero-emission electricity surging to power industrial manufacturing and AI data centers, factory-fabricated SMRs represent a multi-billion-dollar international export opportunity for Canadian advanced manufacturing.\n\n\"Canada was one of the first countries to harness the peaceful power of the atom, and today we are leading the next global nuclear revolution with small modular reactors,\" Minister François-Philippe Champagne said in Ottawa. \"SMRs will provide clean, reliable baseload electricity to power our communities, heavy industries, and remote mining sites. This $380 million investment ensures that the precision components for next-generation nuclear reactors are manufactured right here in Canada by skilled Canadian workers, creating thousands of great careers and driving our clean industrial growth.\"\n\nRegional Nuclear Manufacturing Allocations\nThe $380 million program finances:\n- Ontario Advanced SMR Tooling Hub (Cambridge/Peterborough): $180 million for automated cleanroom assembly lines for reactor pressure vessel internals.\n- Quebec Specialized Metallurgy & Containment (Becancour): $110 million for heavy forged steel containment shells and specialized welding robotics.\n- Saskatchewan Uranium Fuel Fabrication Center (Saskatoon): $90 million for high-assay low-enriched uranium (HALEU) fuel pellet testing facilities.\n\nNuclear industry association executives, building trades labor unions, and provincial energy ministers commended the federal awards, highlighting that domestic SMR tooling anchors high-wage manufacturing in Canada."
  },
  {
    "slug": "environment-minister-steven-guilbeault-announces-160-million-for-national-wetlands-carbon-storage-and-peatland-restoration-2026-08-25",
    "headline": "Environment Minister Steven Guilbeault Allocates $160 Million for Canadian Peatland and Wetland Carbon Sinks",
    "summary": "Environment Minister Steven Guilbeault announces $160 million through the Nature Smart Climate Solutions Fund to restore 50,000 hectares of carbon-rich peatlands and coastal salt marshes across six provinces.",
    "category": "Environment",
    "country": "CA",
    "province": "QC",
    "impactArea": "national",
    "latitude": 45.5017,
    "longitude": -73.5673,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Steven Guilbeault",
      "Canada",
      "Peatlands",
      "Wetlands",
      "Carbon Storage",
      "Environment",
      "Climate"
    ],
    "taggedPoliticians": [
      "Steven Guilbeault"
    ],
    "author": {
      "name": "Choseno Environmental Policy Desk",
      "bio": "Canadian federal environmental regulation, nature-based climate solutions, and ecological carbon storage"
    },
    "sources": [
      {
        "name": "Environment and Climate Change Canada",
        "url": "https://www.canada.ca/en/environment-climate-change"
      },
      {
        "name": "CBC News",
        "url": "https://www.cbc.ca/news/politics"
      }
    ],
    "seoTitle": "Steven Guilbeault Directs $160M for Canadian Peatland Restoration | Choseno",
    "metaDescription": "Environment Minister Steven Guilbeault awards $160M to restore 50,000 hectares of carbon-rich peatlands and wetlands across 6 provinces.",
    "tweet": "Environment Minister Steven Guilbeault announces $160M to restore 50,000 hectares of peatlands and wetlands, locking millions of tons of carbon into nature.",
    "breakingNews": false,
    "body": "MONTREAL — Minister of Environment and Climate Change Steven Guilbeault announced on Monday the distribution of $160 million in federal conservation funding through the Nature Smart Climate Solutions Fund to protect, restore, and re-wet 50,000 hectares of degraded peatlands, boreal muskeg bogs, and coastal salt marshes across Ontario, Quebec, Manitoba, Alberta, New Brunswick, and Nova Scotia.\n\nThe investment, delivered in direct co-stewardship with Indigenous nations and non-profit conservation land trusts, re-establishes natural hydrologic water tables by blocking obsolete agricultural and industrial drainage ditches, preventing the decomposition of ancient peat moss that would otherwise release millions of metric tons of stored carbon dioxide into the atmosphere.\n\nProtecting the World's Most Efficient Terrestrial Carbon Sinks\nCanada contains approximately 25 percent of the world's peatlands—storing more than 150 billion tonnes of carbon, equivalent to 25 years of global fossil fuel emissions. Healthy peatlands act as natural carbon vaults while filtering municipal drinking water and providing vital habitat for woodland caribou and migratory waterfowl.\n\n\"Canada's peatlands and wetlands are global superpowers in the fight against climate change, storing vast quantities of carbon in deep moss layers built over thousands of years,\" Minister Steven Guilbeault said in Montreal. \"When peatlands are drained, they turn from carbon sinks into massive carbon emitters. This $160 million investment restores 50,000 hectares of vital wetlands, keeping millions of tons of carbon locked safely in the ground, protecting our biodiversity, and supporting Indigenous-led conservation across Canada.\"\n\nPeatland Restoration Packages Funded\nThe $160 million allocation supports:\n- James Bay & Hudson Bay Lowlands Peat Protection: $65 million for Indigenous-led baseline carbon mapping and permanent conservation easements with Cree and Ininiw Nations.\n- Prairie Pothole Wetland Reconnection (Manitoba/Alberta): $45 million to restore 20,000 hectares of agricultural wetland depressions.\n- Atlantic Salt Marsh Bio-Restoration (NB/NS): $30 million for dyke breaching and native cordgrass planting in the Bay of Fundy.\n- National Peatland Carbon Telemetry Registry: $20 million partnering with universities to deploy eddy-covariance flux towers measuring real-time carbon sequestration.\n\nConservation biologists, Indigenous grand chiefs, and ecological economists commended the federal funding, highlighting that nature-based peatland restoration is one of the most durable and cost-effective climate mitigation investments."
  },
  {
    "slug": "premier-doug-ford-directs-350-million-for-ottawa-lrt-stage-two-trillium-line-substation-and-signaling-commissioning-2026-08-25",
    "headline": "Premier Doug Ford Directs $350 Million for Ottawa LRT Stage 2 Trillium Line Commissioning and Testing",
    "summary": "Ontario Premier Doug Ford and Transportation Minister Prabmeet Sarkaria award $350 million in provincial capital funding to complete train integration, signaling commissioning, and traction substation testing for the Ottawa LRT Stage 2 Trillium Line.",
    "category": "Transportation",
    "country": "CA",
    "province": "ON",
    "impactArea": "state",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Doug Ford",
      "Prabmeet Sarkaria",
      "Ontario",
      "Ottawa LRT",
      "Transit",
      "Transportation",
      "Metrolinx"
    ],
    "taggedPoliticians": [
      "Doug Ford",
      "Prabmeet Sarkaria"
    ],
    "author": {
      "name": "Choseno Queen's Park Bureau",
      "bio": "Ontario provincial governance, Ottawa transit infrastructure, and public rail expansion"
    },
    "sources": [
      {
        "name": "Ottawa Citizen",
        "url": "https://ottawacitizen.com"
      },
      {
        "name": "CBC Ottawa",
        "url": "https://www.cbc.ca/news/canada/ottawa"
      }
    ],
    "seoTitle": "Doug Ford Directs $350M for Ottawa LRT Trillium Line Testing | Choseno",
    "metaDescription": "Ontario Premier Doug Ford announces $350 million to finalize signaling commissioning and train integration for the Ottawa LRT Stage 2 Trillium Line.",
    "tweet": "Premier Doug Ford allocates $350M to finalize signaling commissioning and train testing for the Ottawa LRT Stage 2 Trillium Line South extension.",
    "breakingNews": false,
    "body": "OTTAWA — Ontario Premier Doug Ford and Minister of Transportation Prabmeet Sarkaria announced on Monday a $350 million provincial transit capital allocation through Metrolinx and the City of Ottawa to finalize signaling commissioning, electrical substation load testing, and integrated train trial running for the 16-kilometer Stage 2 Trillium Line Light Rail Transit (LRT) south extension.\n\nThe project connects Carleton University, South Keys, Leitrim, and Riverside South directly with the Ottawa Macdonald-Cartier International Airport, deploying a modern fleet of Stadler FLIRT and Alstom Coradia diesel-electric multiple units.\n\nConnecting Ottawa Students, Workers, and Airport Travelers to Rapid Transit\nThe Trillium Line expansion will move over 45,000 passengers daily, providing university students and south Ottawa suburban commuters with fast, direct transit while eliminating thousands of daily car trips from congested arterial roads like the Airport Parkway and Bank Street.\n\n\"Our government is committed to building the world-class transit that Ottawa families, workers, and students deserve,\" Premier Doug Ford said during an announcement at Carleton University Station in Ottawa. \"This $350 million investment ensures that the Stage 2 Trillium Line completes thorough testing and commissioning, so trains can begin carrying passengers safely and reliably, connecting Carleton University and south Ottawa communities directly to the airport and supporting local economic growth.\"\n\nCommissioning and Infrastructure Milestones\nThe $350 million package finances:\n- 16 Kilometers of Signaling & Train Control Commissioning: Completing exhaustive safety integration testing for automated train control and grade crossing warning systems.\n- Airport Elevated Spur Station: Finalizing the climate-controlled enclosed pedestrian bridge connecting the terminal directly into the airport departures concourse.\n- Ellwood Diamond Railway Grade Separation: Completing the grade-separated rail-over-rail crossing eliminating freight interference with Via Rail tracks.\n\nOttawa municipal councilors, university student associations, and airport authority executives praised the provincial funding, highlighting that the Trillium Line provides vital transit connectivity for post-secondary education and international travel."
  },
  {
    "slug": "premier-david-eby-allocates-145-million-for-bc-clean-energy-major-projects-office-and-first-nations-equity-loans-2026-08-25",
    "headline": "Premier David Eby Directs $145 Million for BC Indigenous Clean Energy Equity Partnerships",
    "summary": "British Columbia Premier David Eby and Energy Minister Josie Osborne allocate $145 million to establish the BC First Nations Clean Energy Equity Loan Guarantee Program, enabling First Nations to purchase up to 50% equity stakes in clean power projects.",
    "category": "Clean Energy",
    "country": "CA",
    "province": "BC",
    "impactArea": "state",
    "latitude": 48.4284,
    "longitude": -123.3656,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "David Eby",
      "Josie Osborne",
      "British Columbia",
      "Indigenous Affairs",
      "Clean Energy",
      "BC Hydro"
    ],
    "taggedPoliticians": [
      "David Eby",
      "Josie Osborne"
    ],
    "author": {
      "name": "Choseno West Coast Bureau",
      "bio": "British Columbia energy policy, Indigenous economic reconciliation, and clean power grids"
    },
    "sources": [
      {
        "name": "Vancouver Sun",
        "url": "https://vancouversun.com"
      },
      {
        "name": "Business in Vancouver",
        "url": "https://biv.com"
      }
    ],
    "seoTitle": "David Eby Directs $145M for BC First Nations Clean Energy Equity | Choseno",
    "metaDescription": "BC Premier David Eby awards $145M to provide provincial loan guarantees for First Nations purchasing equity stakes in wind and hydro projects.",
    "tweet": "Premier David Eby announces $145M for the BC First Nations Clean Energy Equity Program, enabling Indigenous equity ownership in clean power projects.",
    "breakingNews": false,
    "body": "VICTORIA, B.C. — British Columbia Premier David Eby and Minister of Energy, Mines and Low Carbon Innovation Josie Osborne announced on Monday the distribution of $145 million in provincial capital funding to formally establish the British Columbia Indigenous Clean Energy Equity Loan Guarantee Program and expand the Clean Energy Major Projects Office.\n\nThe initiative, co-developed with the BC First Nations Energy and Mining Council, provides sovereign loan guarantees and non-dilutive equity development capital allowing First Nations communities to acquire up to 50 percent direct equity ownership stakes in newly contracted BC Hydro Call for Power wind, run-of-river hydro, and battery storage projects.\n\nAdvancing Economic Reconciliation and Powering BC's Clean Grid\nBC Hydro's 2024 Call for Power requires adding 3,000 gigawatt-hours of clean electricity annually to meet surging demand from residential electrification, mining, and manufacturing, mandating minimum 25 percent First Nations equity participation for all winning bids.\n\n\"True economic reconciliation means ensuring First Nations are not just consulted on resource projects, but are full equity owners and decision-makers who share in the multi-generational wealth generated on their territories,\" Premier David Eby said at the BC Legislature in Victoria. \"This $145 million investment provides the loan guarantees and capital First Nations need to buy equity stakes in major clean energy projects, generating millions in stable revenues for their communities while powering B.C.'s growing clean economy.\"\n\nProgram Elements and Equity Guarantees\nThe $145 million allocation finances:\n- $100 Million Provincial Loan Guarantee Facility: Enabling First Nations development corporations to secure commercial financing at competitive low sovereign interest rates.\n- Clean Energy Pre-Development Grants: $30 million for First Nations feasibility studies, environmental baselines, and legal negotiations.\n- Indigenous Clean Energy Technical Advisory Hub: $15 million dedicated to building technical engineering and financial modeling capacity within tribal administrations.\n\nFirst Nations grand chiefs, clean energy developers, and financial institutions commended the provincial loan guarantee program, emphasizing that Indigenous equity ownership ensures lasting community support and legal certainty for major clean energy infrastructure."
  },
  {
    "slug": "premier-danielle-smith-directs-190-million-for-commercial-geothermal-district-heating-and-agricultural-greenhouses-2026-08-25",
    "headline": "Premier Danielle Smith Allocates $190 Million for Alberta Geothermal District Heating and Agtech Greenhouses",
    "summary": "Alberta Premier Danielle Smith and Energy Minister Brian Jean announce $190 million from the TIER fund to repurpose depleted oil and gas wellfields for closed-loop geothermal district heating networks and commercial greenhouse agtech complexes.",
    "category": "Clean Energy",
    "country": "CA",
    "province": "AB",
    "impactArea": "state",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Danielle Smith",
      "Brian Jean",
      "Alberta",
      "Geothermal",
      "District Heating",
      "Agtech",
      "Energy"
    ],
    "taggedPoliticians": [
      "Danielle Smith",
      "Brian Jean"
    ],
    "author": {
      "name": "Choseno Alberta Bureau",
      "bio": "Alberta energy policy, subsurface geothermal engineering, and agricultural technology"
    },
    "sources": [
      {
        "name": "Calgary Herald",
        "url": "https://calgaryherald.com"
      },
      {
        "name": "Edmonton Journal",
        "url": "https://edmontonjournal.com"
      }
    ],
    "seoTitle": "Danielle Smith Directs $190M for Alberta Geothermal District Heating | Choseno",
    "metaDescription": "Alberta Premier Danielle Smith awards $190M to repurpose oil wells for geothermal district heating and commercial agtech greenhouses in Alberta.",
    "tweet": "Premier Danielle Smith announces $190M to repurpose legacy oil wells into clean geothermal district heating networks and commercial greenhouses in AB.",
    "breakingNews": false,
    "body": "RED DEER, Alta. — Alberta Premier Danielle Smith and Minister of Energy and Minerals Brian Jean announced on Monday the distribution of $190 million in provincial capital matching grants from the Technology Innovation and Emissions Reduction (TIER) fund to repurpose depleted legacy oil and gas wellbores into closed-loop geothermal district heating networks and commercial year-round agricultural greenhouse complexes in Red Deer, Hinton, and Medicine Hat.\n\nThe investment utilizes advanced downhole closed-loop heat exchangers, circulating non-toxic working fluids through deep subterranean formations (3,000 meters deep at 120°C) to extract thermal energy without hydraulic fracturing or water extraction, piping continuous zero-emission hot water to municipal buildings and 200 acres of commercial vegetable and fruit greenhouses.\n\nTransforming Oilfield Legacy Wells into Year-Round Food Production\nAlberta possesses thousands of suspended oil and gas wells with comprehensive geological data. Repurposing these wells for clean geothermal district heating eliminates industrial heating emissions while enabling year-round domestic produce farming during sub-zero -40°C prairie winters.\n\n\"Alberta's subsurface expertise and skilled energy workforce are our greatest strengths, and we are putting them to work to lead the world in geothermal innovation,\" Premier Danielle Smith said during an announcement at an agtech greenhouse facility in Red Deer. \"This $190 million investment repurposes legacy oilfield assets into clean, continuous geothermal heat, lowering heating costs for our communities, creating great jobs for oil and gas drillers, and producing fresh, affordable food for Alberta families year-round.\"\n\nGeothermal Agtech Projects Funded\nThe $190 million package finances:\n- Hinton Municipal Geothermal District Heating Network: $65 million to heat municipal civic buildings, schools, and hospitals with subterranean geothermal energy.\n- Red Deer Commercial Agtech Greenhouse Complex: $60 million for 100 acres of geothermally heated automated hydroponic vegetable greenhouses.\n- Medicine Hat Subsurface Heat Demonstration: $45 million for industrial process heat delivery to regional manufacturing plants.\n- Wellbore Re-entry Permitting Framework: $20 million to establish streamlined provincial liability transfer standards for repurposed geothermal wells.\n\nAgricultural producers, drilling contractors, and municipal leaders praised the provincial funding, highlighting that geothermal district heating converts abandoned well liabilities into permanent economic assets."
  },
  {
    "slug": "mayor-ken-sim-authorizes-60-million-for-vancouver-zero-emission-commercial-delivery-zones-and-micro-hubs-2026-08-25",
    "headline": "Mayor Ken Sim Directs $60 Million for Vancouver Zero-Emission Commercial Delivery Zones and Cargo Micro-Hubs",
    "summary": "Vancouver Mayor Ken Sim and the Vancouver City Council authorize a $60 million municipal green freight capital program to construct five neighborhood electric cargo bike micro-consolidation hubs and establish 200 zero-emission commercial loading zones.",
    "category": "Transportation",
    "country": "CA",
    "province": "BC",
    "impactArea": "local",
    "latitude": 49.2827,
    "longitude": -123.1207,
    "eventDate": "2026-08-25",
    "published_at": "2026-08-25T06:00:00+00:00",
    "tags": [
      "Ken Sim",
      "Vancouver",
      "Clean Freight",
      "Cargo Bikes",
      "Transportation",
      "Urban Mobility"
    ],
    "taggedPoliticians": [
      "Ken Sim"
    ],
    "author": {
      "name": "Choseno Vancouver City Hall Bureau",
      "bio": "Vancouver municipal politics, urban logistics policy, and zero-emission freight delivery"
    },
    "sources": [
      {
        "name": "Vancouver Sun",
        "url": "https://vancouversun.com"
      },
      {
        "name": "Daily Hive Vancouver",
        "url": "https://dailyhive.com/vancouver"
      }
    ],
    "seoTitle": "Ken Sim Directs $60M for Vancouver Zero-Emission Freight Micro-Hubs | Choseno",
    "metaDescription": "Vancouver Mayor Ken Sim awards $60M to build electric cargo bike micro-hubs and 200 zero-emission delivery zones across downtown Vancouver.",
    "tweet": "Mayor Ken Sim announces $60M for electric cargo bike micro-hubs and 200 zero-emission loading zones to cut delivery van congestion in Vancouver.",
    "breakingNews": false,
    "body": "VANCOUVER — Mayor Ken Sim and the Vancouver City Council voted on Monday to approve a $60 million municipal sustainable freight capital investment package, authorizing the City of Vancouver Engineering Services to construct five urban electric cargo bike micro-consolidation distribution hubs and establish 200 dedicated Zero-Emission Commercial Loading Zones across Downtown Vancouver, Mount Pleasant, and the West End.\n\nThe municipal green logistics program, developed in partnership with commercial courier operators (including FedEx, Purolator, and DHL), enables heavy delivery semi-trucks to drop cargo at perimeter micro-hubs, where packages are transferred to heavy-duty electric cargo bikes and compact electric vans for final-mile neighborhood delivery.\n\nEliminating Downtown Traffic Congestion and Diesel Delivery Smog\nE-commerce parcel deliveries have surged across Metro Vancouver, where heavy commercial delivery vans double-parking in traffic lanes previously caused severe traffic bottlenecks, blocked bike lanes, and generated localized diesel exhaust pollution.\n\n\"Vancouver is leading North America in smart, sustainable urban mobility, and we are rethinking how goods move through our dense downtown core,\" Mayor Ken Sim said at an active cargo bike micro-hub in downtown Vancouver. \"Heavy diesel delivery trucks don't belong idling on narrow neighborhood streets. This $60 million investment builds five modern micro-consolidation hubs, deploys electric cargo bikes, and creates dedicated zero-emission loading zones, speeding up package delivery, clearing street gridlock, and cutting carbon emissions.\"\n\nLogistics Infrastructure Deployments\nThe $60 million package funds:\n- Five Urban Micro-Consolidation Logistics Hubs: Repurposing underutilized city parking structures with high-voltage fleet chargers, sorting conveyors, and secure bike staging bays.\n- 200 Zero-Emission Commercial Loading Zones: Equipping curbside delivery spaces with automated license plate recognition and discounted parking rates for electric delivery fleets.\n- Electric Cargo Bike Purchase Rebates: $15 million in matching purchase vouchers for local independent courier operators adopting heavy-duty commercial e-cargo bikes.\n\nDowntown business improvement associations, courier labor unions, and cycling federations commended the city council action, highlighting that cargo bike delivery speeds up package arrival times while keeping neighborhood sidewalks safe."
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
        tweetarticle: article.tweetarticle || (function() {
          const jurisdiction = [article.province, article.country].filter(Boolean).join(', ') || 'National';
          const politicians = (article.taggedPoliticians && article.taggedPoliticians.length > 0)
            ? article.taggedPoliticians.join(', ')
            : 'Elected Officials';
          const tags = (article.tags || []).map(t => '#' + t.replace(/[^a-zA-Z0-9]/g, '')).join(' ');
          const articleUrl = `https://www.choseno.com/news/${article.slug}`;
          return `${article.headline}\n\n📍 KEY FACTS & SCOPE:\n• Jurisdiction: ${jurisdiction}\n• Officials Involved: ${politicians}\n• Overview: ${article.summary || ''}\n\n🗣️ THE PERSPECTIVES:\n• Civic Context: Detailed reporting, debate, and community impact analysis are available on Choseno.\n• Transparency: Follow legislative milestones, vote counts, and budget line-items.\n\n🗳️ Rate this decision and view the official public record on Choseno:\n📰 Full Article: ${articleUrl}\n\n${tags} #Choseno`;
        })(),
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
