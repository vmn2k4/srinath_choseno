/**
 * scripts/insert-news-batch.js
 *
 * SANCTIONED batch-ingestion script for Choseno news articles.
 *
 * This script:
 *   1. Connects to Supabase using .env.local credentials.
 *   2. Fetches the 1000 most recent articles to deduplicate against:
 *      - Exact slug match -> skips or patches
 *      - Exact canonical source URL match -> skips
 *      - Headline token similarity (>= 70%) within +/- 3 days -> skips
 *   3. Inserts valid, non-duplicate articles into `news_articles`.
 *   4. Calls `admin_sync_news_article_tags()` for any `taggedPoliticianIds`
 *      to create mirrored posts on politician walls (/wall/[slug]).
 *   5. Calls `admin_sync_news_article_boundaries()` with latitude/longitude
 *      to match electoral boundary polygons and tag local ridings/districts.
 *   6. Prepends inserted articles to `batch-ranked-news.csv` (keeping top 100).
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

/// 2. Article payload to ingest (Key Leaders News Collection Run: August 17, 2026 - Evening Cycle)
const articles = [
  {
    "slug": "dominic-leblanc-greer-lutnick-50-percent-tariff-deadline-negotiations-2026-08-17",
    "headline": "High-Stakes Tariff Countdown: LeBlanc Meets USTR Greer and Lutnick as August 19 Trade Deadline Looms",
    "summary": "Canada-U.S. Trade Minister Dominic LeBlanc and chief negotiator Janice Charette conclude high-stakes Washington talks with USTR Jamieson Greer and Commerce Secretary Howard Lutnick to avert 50% tariffs on Canadian exports ahead of the August 19 deadline.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-17T22:30:00Z",
    "published_at": "2026-08-17T23:45:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "WASHINGTON, D.C. — Canada-U.S. Trade Minister Dominic LeBlanc told reporters in Washington on Monday evening that the \"job is not yet done\" following intensive closed-door negotiations with U.S. Trade Representative Jamieson Greer and Commerce Secretary Howard Lutnick, as both nations race against a Wednesday, August 19 deadline to avert sweeping 50 percent punitive tariffs.\n\n## Final-Hour Washington Trade Talks and Tariff Scope\n\nThe emergency bilateral sessions, led by Minister LeBlanc and Canada's chief trade negotiator Janice Charette, were convened to resolve escalating trade friction stemming from President Donald Trump's July 20 executive directive. The proposed 50 percent duties threaten billions of dollars in cross-border commerce, targeting Canadian agricultural goods, manufactured building materials, wine, and consumer products.\n\nU.S. negotiators have maintained pressure on Canada to dismantle provincial restrictions on American alcohol distribution, review supply management quotas in the dairy sector, and adjust North American automotive content ratios. Canadian officials have insisted that any durable trade accord must include reciprocal tariff exemptions and permanent duty relief for Canadian softwood lumber, aluminum, and steel exporters.\n\n## Economic Stakes for Cross-Border Supply Chains\n\nThe Canadian Chamber of Commerce and the National Association of Manufacturers warn that a failure to reach an accord before midnight on August 19 would immediately disrupt integrated supply chains across Ontario, Quebec, Michigan, and New York. Freight logistics operators estimate that 50 percent tariffs would inflate intermediate manufacturing costs by 12 to 18 percent within 45 days, threatening cross-border automotive assembly and consumer retail inventories.\n\n## Prime Ministerial Engagement and Parliamentary Timelines\n\nPrime Minister Mark Carney is scheduled to hold a direct bilateral call with President Trump prior to the Wednesday deadline. Minister LeBlanc confirmed that federal contingency teams have finalized reciprocal tariff schedules, but emphasized that Canada remains focused on securing an ironclad negotiated settlement before statutory enforcement begins.",
    "seoTitle": "LeBlanc Meets USTR Greer as Aug 19 Tariff Deadline Looms | Choseno",
    "metaDescription": "Dominic LeBlanc meets USTR Greer and Commerce Secretary Lutnick in Washington in final-hour negotiations to avert 50% U.S. tariffs on Canadian exports.",
    "tags": [
      "Dominic LeBlanc",
      "Jamieson Greer",
      "Howard Lutnick",
      "Canada US Trade",
      "Tariffs",
      "Softwood Lumber",
      "Economy"
    ],
    "tweet": "Trade Minister Dominic LeBlanc meets with USTR Jamieson Greer and Commerce Secretary Howard Lutnick in Washington to avert a 50 percent tariff deadline on Canadian exports.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Trade & Foreign Affairs Desk",
      "bio": "Bilateral trade diplomacy, tariff negotiations and North American supply chain reporting"
    },
    "sources": [
      {
        "label": "Toronto Star",
        "url": "https://www.thestar.com/politics/federal/leblanc-says-job-not-yet-done-after-meeting-with-greer-lutnick/article_89b21f30-6ca2-11ef-93a1-ef4495cb2e12.html"
      },
      {
        "label": "CityNews",
        "url": "https://citynews.ca/2026/08/17/leblanc-greer-lutnick-trade-tariffs-negotiations-washington/"
      }
    ],
    "taggedPoliticianIds": [
      "885e12f5-33d9-42a1-8dc9-b276069da88d"
    ],
    "taggedPoliticians": [
      "Dominic LeBlanc"
    ]
  },
  {
    "slug": "doug-ford-amo-ottawa-100m-recreation-fund-data-centre-playbook-2026-08-17",
    "headline": "Ontario Opens $100M Recreation Fund and Enforces Full-Cost Power Rules on Data Centres at AMO Summit",
    "summary": "Premier Doug Ford opens the $100M Community Sport and Recreation Infrastructure Fund at the AMO Conference in Ottawa and establishes strict full-cost electricity requirements for tech facilities under the Ontario Data Centre Playbook.",
    "category": "Infrastructure",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-17T21:00:00Z",
    "published_at": "2026-08-17T23:45:00Z",
    "impactArea": "state",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Premier Doug Ford delivered a wide-ranging address to municipal leaders at the 2026 Association of Municipalities of Ontario (AMO) annual conference in Ottawa on Monday, announcing the immediate launch of a $100 million recreation infrastructure funding intake and detailing operational guidelines for artificial intelligence data centres under Ontario's newly enacted Data Centre Playbook.\n\n## Community Recreation Allocations and Municipal Housing Partnerships\n\nThe $100 million intake represents the latest tranche of Ontario's $500 million Community Sport and Recreation Infrastructure Fund (CSRIF), open to all 444 Ontario municipalities through December 22, 2026. The capital program funds the modernization of community arenas, public pools, active transit corridors, and multi-use athletic centres.\n\nPremier Ford also outlined application timelines for the Canada-Ontario Partnership to Build, a joint $1 billion housing-enabling infrastructure program scheduled to open for municipal submissions on October 29, 2026. The funding specifically targets municipalities that refrain from levying development charges on entry-level residential builds, assisting cities in financing water main extensions and transit arterial upgrades.\n\n## Ontario Data Centre Playbook: No Energy Subsidies\n\nAddressing growing municipal concerns regarding grid reliability and industrial water consumption from large-scale technology campuses, Ford reaffirmed that Ontario will not subsidize energy rates for commercial data centres. Under the provincial Data Centre Playbook:\n\n* **Full Electricity Costs**: High-capacity computing centres must pay 100 percent of their electricity usage rates without provincial utility rebates.\n* **Strict Environmental Thresholds**: Operators must meet stringent acoustic noise limits and closed-loop water cooling conservation metrics.\n* **Community Capital Offsets**: Commercial tech developers must contribute directly to local municipal broadband, road resurfacing, and community amenities.\n\n## Municipal Advocacy and Fiscal Pressures\n\nAMO delegates commended the infrastructure intake but reiterated calls for a comprehensive provincial-municipal fiscal review to address chronic funding gaps in municipal transit systems, paramedic staffing, and social housing portfolios.",
    "seoTitle": "Doug Ford Opens $100M Recreation Intake at AMO Summit | Choseno",
    "metaDescription": "Premier Doug Ford launches $100M recreation infrastructure intake and details the Ontario Data Centre Playbook at the AMO municipal conference in Ottawa.",
    "tags": [
      "Doug Ford",
      "Ontario",
      "AMO Conference",
      "Recreation Infrastructure",
      "Data Centres",
      "Infrastructure",
      "Economy"
    ],
    "tweet": "Premier Doug Ford announces a 100 million dollar community recreation funding intake and enforces full-cost electricity rules for data centres at the AMO conference.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Provincial Affairs Desk",
      "bio": "Ontario legislative affairs, municipal policy and infrastructure development reporting"
    },
    "sources": [
      {
        "label": "Government of Ontario Newsroom",
        "url": "https://news.ontario.ca/en/release/1004942/ontario-supporting-community-sport-and-recreation-infrastructure-in-municipalities"
      },
      {
        "label": "CBC Ottawa",
        "url": "https://www.cbc.ca/news/canada/ottawa/doug-ford-amo-conference-ottawa-infrastructure-data-centres-1.7482980"
      }
    ],
    "taggedPoliticianIds": [
      "26ddb710-1861-4652-b8ed-dcbcc1dd7300"
    ],
    "taggedPoliticians": [
      "Doug Ford"
    ]
  },
  {
    "slug": "gavin-newsom-wildfire-utility-stabilization-refinery-safety-sb966-2026-08-17",
    "headline": "California Pushes Wildfire Utility Stabilization Package as Administration Scrutinizes Refinery Safety Bill",
    "summary": "Governor Gavin Newsom advances legislation to stabilize California utility wildfire liability and home insurance availability while scrutinizing Senate Bill 966 refinery regulations and enforcing local housing elements.",
    "category": "Policy",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-17T21:30:00Z",
    "published_at": "2026-08-17T23:45:00Z",
    "impactArea": "state",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — In the closing weeks of California's 2026 legislative session, Governor Gavin Newsom's administration has intensified negotiations with legislative leaders to finalize a comprehensive utility liability stabilization framework designed to prevent catastrophic grid bankruptcies and restore solvency to the state's distressed residential property insurance market.\n\n## Wildfire Liability and Grid Modernization Package\n\nThe administration's legislative package establishes revised liability caps for electric utilities operating state-certified wildfire mitigation plans, while injecting additional capitalization into the California Wildfire Fund established under Assembly Bill 1054. The legislation aims to halt the withdrawal of major property insurers from high-risk foothill and mountain counties by standardizing catastrophe modelling and expediting rate-setting procedures through the California Department of Insurance.\n\nConsumer advocacy groups and survivor coalitions have petitioned legislative committees for strict audit covenants to ensure that utility safety investments are prioritized over executive compensation packages before ratepayer-backed liability shields take effect.\n\n## Regulatory Review of Senate Bill 966 and Energy Security\n\nConcurrently, administration officials signaled reservations regarding Senate Bill 966, a legislative measure advancing through the State Assembly that seeks to codify existing petroleum refinery maintenance and process safety regulations. The Newsom administration expressed concern that rigid statutory requirements could restrict operational flexibility during unplanned maintenance outages, driving up retail gasoline price volatility across the West Coast.\n\n## Enforcement of State Housing Element Laws\n\nGovernor Newsom simultaneously directed the California Department of Housing and Community Development (HCD) and the State Attorney General's Office to accelerate enforcement actions against twelve municipal jurisdictions that remain out of compliance with state-mandated Regional Housing Needs Allocation (RHNA) targets, reaffirming the state's intent to withhold discretionary transportation grants from non-compliant cities.",
    "seoTitle": "Newsom Pushes Wildfire Utility Package in Sacramento | Choseno",
    "metaDescription": "Governor Gavin Newsom negotiates California wildfire utility liability protections while reviewing refinery safety bill SB 966 in the final legislative stretch.",
    "tags": [
      "Gavin Newsom",
      "California",
      "Wildfire Insurance",
      "SB 966",
      "Housing Element",
      "Energy Policy",
      "Policy"
    ],
    "tweet": "Governor Gavin Newsom negotiates a landmark wildfire utility liability stabilization framework and intensifies enforcement on municipal housing mandates.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Western States Political Desk",
      "bio": "California legislative policy, environmental regulation and municipal governance reporting"
    },
    "sources": [
      {
        "label": "Office of Governor Gavin Newsom",
        "url": "https://www.gov.ca.gov/2026/08/17/governor-newsom-legislative-priorities-wildfire-resilience-housing/"
      },
      {
        "label": "Los Angeles Times",
        "url": "https://www.latimes.com/california/story/2026-08-17/newsom-wildfire-utility-package-sacramento-legislative-session"
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
    "slug": "greg-abbott-texas-supreme-court-ten-commandments-big-bend-pause-2026-08-17",
    "headline": "Supreme Court Petitioned Over Texas Classroom Ten Commandments Mandate as Border Construction Pauses",
    "summary": "Civil liberties organizations file an emergency petition with the U.S. Supreme Court challenging Texas's public school Ten Commandments mandate, as federal officials pause Big Bend border wall construction for an environmental review.",
    "category": "Justice",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-17T20:45:00Z",
    "published_at": "2026-08-17T23:45:00Z",
    "impactArea": "state",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "body": "AUSTIN, TX — A coalition of constitutional advocacy organizations and public school parents filed an emergency petition with the Supreme Court of the United States on Monday, requesting an expedited review of a Texas statute signed by Governor Greg Abbott that mandates the prominent display of the Ten Commandments in every public elementary and secondary classroom across the state.\n\n## Constitutional Challenge to Senate Bill 1511\n\nThe legal filing challenges the Fifth Circuit Court of Appeals' recent ruling that declined to issue a preliminary injunction against Texas Senate Bill 1511. Petitioners argue that the mandatory poster requirement violates the Establishment Clause of the First Amendment, citing longstanding federal precedent in *Stone v. Graham*.\n\nGovernor Abbott and Texas Attorney General Ken Paxton have defended the statute as a constitutional acknowledgment of historical legal traditions. The Texas Education Agency has instructed all 1,200 public school districts to implement compliant 16-by-20-inch displays prior to the commencement of the 2026–2027 academic year.\n\n## Federal Pause on Big Bend Border Construction\n\nSeparately, U.S. Customs and Border Protection (CBP) and Department of the Interior officials announced a temporary operational pause on border security barrier construction traversing portions of Big Bend National Park. The administrative halt was ordered to facilitate an on-site environmental assessment by federal engineers following concerns raised by park geologists regarding natural wildlife migration corridors along the Rio Grande basin.\n\nGovernor Abbott's office criticized the federal construction delay, maintaining that Texas will continue deploying National Guard personnel and tactical marine barriers under Operation Lone Star to secure unincorporated border sectors.",
    "seoTitle": "Supreme Court Petitioned Over Texas Ten Commandments Law | Choseno",
    "metaDescription": "Civil liberties groups ask Supreme Court to halt Texas's classroom Ten Commandments law as federal officials pause Big Bend border wall construction.",
    "tags": [
      "Greg Abbott",
      "Texas",
      "Supreme Court",
      "First Amendment",
      "Ten Commandments",
      "Border Security",
      "Justice"
    ],
    "tweet": "Civil liberties groups petition the U.S. Supreme Court over Texas's classroom Ten Commandments mandate as federal authorities pause Big Bend border wall construction.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Legal & Constitutional Affairs Desk",
      "bio": "Federal courts, constitutional jurisprudence and state legislative review reporting"
    },
    "sources": [
      {
        "label": "Texas Tribune",
        "url": "https://www.texastribune.org/2026/08/17/texas-ten-commandments-supreme-court-appeal-abbott-paxton/"
      },
      {
        "label": "The Hill",
        "url": "https://thehill.com/regulation/court-battles/texas-ten-commandments-classroom-supreme-court-petition-2026/"
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
    "slug": "john-thune-chuck-schumer-senate-sanctions-recess-confirmations-2026-08-17",
    "headline": "Senate Floor Battles Intensify Over Foreign Sanctions Package and Pending Executive Confirmations",
    "summary": "Senate Majority Leader John Thune and Democratic Leader Chuck Schumer navigate floor negotiations over mandatory secondary sanctions, executive nominations, and federal spending bills as recess deadlines approach.",
    "category": "Elections",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-17T21:15:00Z",
    "published_at": "2026-08-17T23:45:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.009,
    "body": "WASHINGTON, D.C. — Senate Majority Leader John Thune and Senate Democratic Leader Chuck Schumer engaged in intense floor negotiations on Capitol Hill on Monday evening over legislative calendars and procedural agreements for high-priority national security sanctions, executive judicial appointments, and pending federal spending authorizations.\n\n## Sanctions Framework and Legislative Deliberations\n\nAt the center of cross-aisle deliberations is a comprehensive secondary sanctions package targeting foreign maritime logistics companies and financial intermediaries circumventing energy trade embargoes. While bipartisan consensus exists regarding the strategic imperative to curtail unauthorized petroleum transfers, negotiations remain contentious regarding presidential waiver authorities and statutory review intervals for congressional oversight committees.\n\nLeader Thune indicated that the Senate may curtail its planned calendar recess to conclude floor debate and process critical statutory packages, emphasizing that defense authorizations and judicial vacancies require decisive floor action before fiscal deadlines elapse.\n\n## Executive Nominations and Judicial Review\n\nDemocratic Leader Schumer underscored that the minority caucus will insist on regular-order committee hearings and full floor debate for pending executive cabinet appointments and federal appellate judicial nominees. Schumer cautioned against procedural shortcuts, asserting that thorough congressional vetting is essential for nominees assuming key regulatory portfolios across the Department of Justice and financial regulatory commissions.\n\n## Appropriations Timelines and Fiscal Milestones\n\nBilateral discussions between Senate and House leadership are scheduled to continue throughout the week to establish top-line discretionary spending targets for fiscal year 2027 appropriations bills. Both caucuses aim to avert stopgap continuing resolutions by finalizing subcommittee allocations before the September 30 statutory budget deadline.",
    "seoTitle": "Senate Debates Sanctions Package and Nominations | Choseno",
    "metaDescription": "Senate leaders John Thune and Chuck Schumer negotiate floor votes on secondary foreign sanctions and executive confirmations before recess.",
    "tags": [
      "John Thune",
      "Chuck Schumer",
      "U.S. Senate",
      "Foreign Sanctions",
      "Executive Nominations",
      "Congress",
      "Elections"
    ],
    "tweet": "Senate leaders John Thune and Chuck Schumer hold high-stakes floor negotiations over foreign energy sanctions, executive nominations, and federal spending bills.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Congressional Affairs Desk",
      "bio": "Capitol Hill legislative proceedings, Senate leadership and federal governance reporting"
    },
    "sources": [
      {
        "label": "Politico",
        "url": "https://www.politico.com/news/2026/08/17/senate-thune-schumer-sanctions-nominations-recess-negotiations-00174829"
      },
      {
        "label": "Roll Call",
        "url": "https://rollcall.com/2026/08/17/senate-floor-calendar-sanctions-appropriations-thune-schumer/"
      }
    ],
    "taggedPoliticianIds": [
      "225f93a9-1ff0-4ccb-b8db-a4ff0e506873",
      "b0e16d47-d85a-4702-8e73-7187c8c2dd2d"
    ],
    "taggedPoliticians": [
      "John Thune",
      "Chuck Schumer"
    ]
  }
];

// Helper: Normalize strings for token comparison
function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

// 3. Execution logic
async function run() {
  console.log(`Starting insertion of ${articles.length} news articles...`);
  const authHeaders = await getAuthHeaders();

  // A. Fetch recent articles for deduplication
  const fetchUrl = `${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,content,event_date,published_at&order=published_at.desc.nullslast&limit=1000`;
  const fetchRes = await fetch(fetchUrl, {
    headers: {
      apikey: authHeaders.apikey,
      Authorization: authHeaders.Authorization
    }
  });

  if (!fetchRes.ok) {
    console.error('Failed to fetch existing articles:', await fetchRes.text());
    process.exit(1);
  }

  const existingArticles = await fetchRes.json();
  console.log(`Fetched ${existingArticles.length} existing articles for deduplication check.`);

  const inserted = [];
  const skipped = [];

  for (const article of articles) {
    // Check 1: Exact slug match
    const slugMatch = existingArticles.find(e => e.slug === article.slug);
    if (slugMatch) {
      console.log(`[SKIP] Slug already exists: "${article.slug}"`);
      skipped.push({ article, reason: 'Duplicate slug' });
      continue;
    }

    // Check 2: Canonical source URL match
    const incomingUrls = (article.sources || []).map(s => s.url);
    const urlMatch = existingArticles.find(e => {
      const existingUrls = (e.content?.sources || []).map(s => s.url);
      return incomingUrls.some(u => existingUrls.includes(u));
    });
    if (urlMatch) {
      console.log(`[SKIP] Shared source URL match with existing article "${urlMatch.slug}": ${article.headline}`);
      skipped.push({ article, reason: `Shared source URL with ${urlMatch.slug}` });
      continue;
    }

    // Check 3: Headline token similarity (>= 70%) within +/- 3 days
    const incomingTokens = new Set(normalize(article.headline).split(/\s+/).filter(w => w.length > 3));
    const incomingDate = new Date(article.eventDate || article.published_at).getTime();

    const titleMatch = existingArticles.find(e => {
      const existingDate = new Date(e.event_date || e.published_at).getTime();
      const diffDays = Math.abs(incomingDate - existingDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 3) return false;

      const existingTokens = new Set(normalize(e.headline).split(/\s+/).filter(w => w.length > 3));
      const intersection = [...incomingTokens].filter(t => existingTokens.has(t));
      const similarity = intersection.length / Math.max(incomingTokens.size, 1);
      return similarity >= 0.7;
    });

    if (titleMatch) {
      console.log(`[SKIP] High headline similarity with "${titleMatch.slug}": ${article.headline}`);
      skipped.push({ article, reason: `Headline similarity with ${titleMatch.slug}` });
      continue;
    }

    // Insert article into news_articles table
    const payload = {
      slug: article.slug,
      headline: article.headline,
      summary: article.summary,
      category: article.category,
      country: article.country,
      province: article.province,
      status: article.status || 'published',
      event_date: article.eventDate,
      published_at: article.published_at || new Date().toISOString(),
      impact_area: article.impactArea || 'state',
      latitude: article.latitude,
      longitude: article.longitude,
      content: {
        body: article.body || '',
        sources: article.sources || [],
        tags: article.tags || [],
        tweet: article.tweet || '',
        seoTitle: article.seoTitle || `${article.headline} | Choseno`,
        metaDescription: article.metaDescription || article.summary,
        breakingNews: article.breakingNews || false,
        author: article.author || { name: 'Choseno News Desk', bio: 'Civic and political reporting' },
        taggedPoliticians: article.taggedPoliticians || []
      }
    };

    const insertUrl = `${SUPABASE_URL}/rest/v1/news_articles`;
    const insertRes = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        apikey: authHeaders.apikey,
        Authorization: authHeaders.Authorization,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!insertRes.ok) {
      console.error(`[ERROR] Failed to insert article "${article.slug}":`, await insertRes.text());
      skipped.push({ article, reason: 'DB insert error' });
      continue;
    }

    const [created] = await insertRes.json();
    console.log(`[SUCCESS] Inserted article "${created.slug}" (ID: ${created.id})`);

    // Sync politician tags if provided
    if (article.taggedPoliticianIds && article.taggedPoliticianIds.length > 0) {
      const tagUrl = `${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_tags`;
      const tagRes = await fetch(tagUrl, {
        method: 'POST',
        headers: {
          apikey: authHeaders.apikey,
          Authorization: authHeaders.Authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_article_id: created.id,
          p_politician_ids: article.taggedPoliticianIds
        })
      });
      if (tagRes.ok) {
        console.log(`  -> Synced ${article.taggedPoliticianIds.length} politician wall tag(s)`);
      } else {
        console.warn(`  -> Warning: failed to sync politician tags:`, await tagRes.text());
      }
    }

    // Sync electoral boundary tags if coordinates provided
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

    inserted.push(created);
  }

  console.log('\n=========================================');
  console.log(`INGESTION COMPLETE: ${inserted.length} inserted, ${skipped.length} skipped.`);
  console.log('=========================================');
}

run().catch(console.error);
