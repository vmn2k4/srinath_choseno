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
// Matches src/lib/constants/site.ts -- used to call the deployed app's
// og-image generation endpoint after inserting a published article.
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

// 2. Article payload to ingest (Multi-Track Civic News Run: August 17-18, 2026 Night Cycle)
const articles = [
  {
    "slug": "nova-scotia-energy-minister-marco-macleod-resignation-calls-houston-caucus-2026-08-17",
    "headline": "Nova Scotia Energy Minister Resists Resignation Calls Over Lyrics as PC Caucus Confirms Cabinet Post",
    "summary": "Nova Scotia Energy Minister Marco MacLeod faces calls from advocacy groups and opposition MLAs to resign over misogynistic past song lyrics, while Premier Tim Houston's Progressive Conservative caucus affirms his position in cabinet.",
    "category": "Policy",
    "country": "CA",
    "province": "NS",
    "status": "published",
    "eventDate": "2026-08-17T21:00:00Z",
    "published_at": "2026-08-18T00:15:00Z",
    "impactArea": "state",
    "latitude": 44.6488,
    "longitude": -63.5752,
    "body": "HALIFAX, NS — Nova Scotia Energy Minister Marco MacLeod confirmed on Monday that he will not resign from cabinet despite mounting pressure from gender equality organizations and opposition lawmakers following the public disclosure of violent and misogynistic song lyrics recorded prior to his entry into provincial politics.\n\n## Emergence of Recordings and Opposition Scrutiny\n\nThe controversy centers on amateur rap tracks recorded over a decade ago under the performance pseudonym \"Meadowville,\" which contained explicit references to substance abuse and derogatory depictions of violence against women. The recordings resurfaced across social platforms late last week, prompting immediate condemnation from community advocacy organizations.\n\nAdsum for Women & Children, a Halifax-based non-profit providing emergency shelter and housing support, issued a public statement asserting that such content undermines public confidence in provincial executive leadership and warrants removal from ministerial office. Liberal MLA Becky Druhan and NDP opposition critics urged Premier Tim Houston to establish clear ethical standards for ministerial conduct, questioning whether MacLeod can effectively represent the Crown in high-profile intergovernmental and community negotiations.\n\n## Ministerial Apology and PC Caucus Position\n\nMinister MacLeod issued a formal apology acknowledging the \"hurtful and unacceptable language\" used in the decade-old recordings, stating that he takes full personal accountability and has coordinated with digital distributors to remove the catalog from public streaming archives.\n\nThe Progressive Conservative caucus leadership released an official statement confirming that MacLeod retains the confidence of the governing party. The caucus emphasized that the material was produced years prior to his public service career and that MacLeod has demonstrated exemplary constituent advocacy since his appointment as Minister of Energy in May 2026.\n\n## Policy Oversight and Upcoming Legislative Session\n\nMacLeod took over the provincial Energy portfolio earlier this year, overseeing major regulatory files including the Clean Power Plan, offshore wind seabed lease allocations, and provincial utility rate-setting hearings before the Nova Scotia Utility and Review Board (NSUARB). Opposition caucuses indicated they will pursue formal inquiries regarding cabinet vetting protocols when the House of Assembly reconvenes in Halifax.",
    "seoTitle": "Nova Scotia Energy Minister Resists Resignation Calls | Choseno",
    "metaDescription": "Nova Scotia Energy Minister Marco MacLeod faces resignation demands over past lyrics as Premier Tim Houston's PC caucus affirms his cabinet post.",
    "tags": [
      "Marco MacLeod",
      "Tim Houston",
      "Nova Scotia",
      "Halifax",
      "Cabinet Ethics",
      "Energy Policy",
      "Policy"
    ],
    "tweet": "Nova Scotia Energy Minister Marco MacLeod resists resignation calls over past song lyrics as the PC caucus affirms his cabinet portfolio.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Atlantic Bureau",
      "bio": "Maritime provincial politics, cabinet accountability and regional energy policy reporting"
    },
    "sources": [
      {
        "label": "CTV News Atlantic",
        "url": "https://atlantic.ctvnews.ca/calls-for-n-s-energy-minister-to-resign-over-past-song-lyrics-1.7004128"
      },
      {
        "label": "CBC Nova Scotia",
        "url": "https://www.cbc.ca/news/canada/nova-scotia/marco-macleod-energy-minister-song-lyrics-apology-houston-1.7482991"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": [
      "Marco MacLeod",
      "Tim Houston"
    ]
  },
  {
    "slug": "pentagon-hegseth-uss-abraham-lincoln-carrier-deployment-congressional-inquiry-2026-08-17",
    "headline": "Lawmakers Demand Pentagon Accountability Over USS Abraham Lincoln Deployment Conditions",
    "summary": "Twelve federal lawmakers send a formal inquiry to Defense Secretary Pete Hegseth demanding an independent investigation into food shortages, maintenance issues, and crew welfare aboard the USS Abraham Lincoln after 250 days at sea.",
    "category": "Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-17T21:45:00Z",
    "published_at": "2026-08-18T00:15:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.009,
    "body": "WASHINGTON, D.C. — A bipartisan group of twelve members of Congress dispatched a formal oversight letter to Secretary of Defense Pete Hegseth on Monday, demanding an immediate independent inspection and comprehensive review of living conditions, medical readiness, and supply chains aboard the aircraft carrier USS *Abraham Lincoln*.\n\n## Extended 250-Day Sea Deployment and Crew Welfare Concerns\n\nThe Nimitz-class aircraft carrier departed its homeport of San Diego in November 2025 and has operated in the Middle East theatre for more than 250 days, logging over 200 consecutive days without a port call—one of the longest uninterrupted modern sea deployments in U.S. naval history. Accounts shared by military families and investigative reports in *Navy Times* and *Stars and Stripes* detailed widespread potable water interruptions, refrigeration breakdowns, and severe crew exhaustion.\n\nSignatories to the congressional demand letter, including Senate Armed Services Committee member and former Navy combat aviator Senator Mark Kelly, highlighted documented spikes in mental health crises and emergency evacuations aboard the vessel. Lawmakers petitioned for an authorized bipartisan congressional delegation to board the carrier and evaluate shipboard systems firsthand.\n\n## Administration Response and Fleet Reliever Operations\n\nSecretary Hegseth previously defended deployment operational schedules, describing media accounts as \"grossly exaggerated\" while asserting that forward-deployed units in high-readiness zones receive continuous logistical replenishment. President Donald Trump similarly commended the vessel's operational tempo during a weekend press briefing, stating the carrier remains fully mission-capable.\n\nU.S. Central Command (CENTCOM) confirmed that Admiral Brad Cooper conducted an onboard inspection last week to review medical support facilities. Naval Sea Systems Command officials noted that the USS *George Washington* is currently transiting to relieve the *Lincoln*, though operational timelines remain classified.\n\n## Congressional Hearings and Defense Authorization Safeguards\n\nMembers of the House Armed Services Committee indicated they will introduce statutory deployment duration limits in the upcoming National Defense Authorization Act (NDAA) markup, mandating mandatory port-rest intervals for naval personnel during non-declared hostilities.",
    "seoTitle": "Lawmakers Demand Investigation Into USS Abraham Lincoln | Choseno",
    "metaDescription": "Twelve lawmakers petition Defense Secretary Pete Hegseth over extended deployment and crew conditions on the USS Abraham Lincoln.",
    "tags": [
      "Pete Hegseth",
      "Mark Kelly",
      "USS Abraham Lincoln",
      "U.S. Navy",
      "Pentagon",
      "Congress",
      "Policy"
    ],
    "tweet": "Twelve members of Congress demand an immediate Pentagon inquiry into extended deployment conditions aboard the USS Abraham Lincoln.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Defense & National Security Desk",
      "bio": "Military readiness, Pentagon appropriations and congressional defense oversight reporting"
    },
    "sources": [
      {
        "label": "The Hill",
        "url": "https://thehill.com/policy/defense/4831920-lawmakers-hegseth-uss-abraham-lincoln-inquiry/"
      },
      {
        "label": "Stars and Stripes",
        "url": "https://www.stripes.com/branches/navy/2026-08-17/lincoln-carrier-deployment-congressional-letter-hegseth-7481920.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": [
      "Pete Hegseth",
      "Mark Kelly"
    ]
  },
  {
    "slug": "bc-cabinet-shuffle-ravi-kahlon-health-josie-osborne-finance-eby-2026-08-17",
    "headline": "B.C. Cabinet Reorganization Places Ravi Kahlon at Health Helm as Josie Osborne Assumes Finance",
    "summary": "Premier David Eby reshuffles executive portfolios in British Columbia, appointing Ravi Kahlon as Minister of Health and Josie Osborne as Minister of Finance while coordinating $15M in emergency wildfire recovery allocations.",
    "category": "Health",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-17T20:30:00Z",
    "published_at": "2026-08-18T00:15:00Z",
    "impactArea": "state",
    "latitude": 48.4284,
    "longitude": -123.3656,
    "body": "VICTORIA, BC — Premier David Eby announced key ministerial reassignments across the British Columbia executive council on Monday, positioning veteran minister Ravi Kahlon to lead the Ministry of Health and elevating Josie Osborne to the Finance portfolio as the provincial government balances acute healthcare demands with ongoing wildfire disaster relief.\n\n## Executive Reorganization and Ministerial Mandates\n\nThe cabinet reorganization follows Finance Minister Brenda Bailey's decision to take a medical leave of absence for cancer treatment, with Bailey scheduled to return in October as Minister of Jobs and Economic Growth. During the interim period, Energy Minister Adrian Dix has overseen transitional economic files.\n\nUnder the permanent adjustments finalized Monday:\n* **Ravi Kahlon** transitions from Jobs and Economic Growth to become Minister of Health, tasked with expanding regional primary care networks, expediting international physician credentialing, and addressing emergency room staffing pressures across Fraser Health and Interior Health facilities.\n* **Josie Osborne** shifts from Health to assume the Ministry of Finance, taking charge of provincial fiscal forecasting, capital debt management, and the multi-billion-dollar provincial wildfire contingency fund.\n\n## Wildfire Disaster Recovery and Municipal Support\n\nConcurrently, Premier Eby and Emergency Management officials reviewed ongoing disaster response operations as major interior transportation routes, including Highway 97 near Clinton, reopened following containment operations. The province partnered with United Way British Columbia to launch the $15 million United for BC Wildfire Recovery Fund, delivering rapid-response community grants up to $15,000 to local non-profits supporting displaced families and agricultural producers.\n\nMinister of Agriculture Lana Popham released a provincial directive urging British Columbians to prioritize local farm purchases to sustain agricultural producers impacted by smoke and drought conditions throughout the Okanagan and Cariboo regions.\n\n## Fall Legislative Priorities\n\nPremier Eby affirmed that Minister Kahlon and Minister Osborne will present their strategic operational roadmaps when MLAs return to Victoria for the fall legislative sitting, focusing on healthcare capital expansion and long-term climate resilience infrastructure.",
    "seoTitle": "BC Cabinet Shuffle: Ravi Kahlon Appointed Health Minister | Choseno",
    "metaDescription": "Premier David Eby appoints Ravi Kahlon as BC Minister of Health and Josie Osborne as Finance Minister amid wildfire recovery and healthcare restructuring.",
    "tags": [
      "David Eby",
      "Ravi Kahlon",
      "Josie Osborne",
      "British Columbia",
      "Healthcare",
      "Wildfire Recovery",
      "Health"
    ],
    "tweet": "Premier David Eby appoints Ravi Kahlon as BC Minister of Health and Josie Osborne as Minister of Finance amid provincial healthcare and wildfire recovery efforts.",
    "breakingNews": false,
    "author": {
      "name": "Choseno British Columbia Bureau",
      "bio": "B.C. legislative politics, healthcare administration and provincial resource management reporting"
    },
    "sources": [
      {
        "label": "B.C. Government News",
        "url": "https://news.gov.bc.ca/releases/2026PREM0052-001248"
      },
      {
        "label": "Vancouver Sun",
        "url": "https://vancouversun.com/news/politics/bc-cabinet-shuffle-ravi-kahlon-health-josie-osborne-finance-eby"
      }
    ],
    "taggedPoliticianIds": [
      "472949c0-825a-498c-8a8e-33b6d292286e",
      "a2f5f191-cbb6-4dfc-ba15-b77a7d4db517"
    ],
    "taggedPoliticians": [
      "Ravi Kahlon",
      "David Eby"
    ]
  },
  {
    "slug": "ftc-doxo-2-million-settlement-deceptive-search-ads-hidden-fees-2026-08-17",
    "headline": "FTC Orders $2.1M Restitution in Deceptive Search Ad Settlement with Bill Payment Firm Doxo",
    "summary": "The Federal Trade Commission finalizes a $2.1 million settlement and permanent injunction against third-party bill payment operator Doxo over deceptive search ads that impersonated local utilities and municipal service providers.",
    "category": "Justice",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-17T19:30:00Z",
    "published_at": "2026-08-18T00:15:00Z",
    "impactArea": "country",
    "latitude": 38.8931,
    "longitude": -77.0199,
    "body": "WASHINGTON, D.C. — The Federal Trade Commission finalized a $2.1 million consent order and permanent civil injunction against third-party bill payment platform Doxo Inc. and its corporate leadership on Monday, resolving federal enforcement actions regarding deceptive search advertisements and unauthorized consumer service surcharges.\n\n## Deceptive Search Engine Funnels and Utility Impersonation\n\nAccording to the FTC's federal court complaint, Doxo systematically purchased branded search engine advertisements corresponding to thousands of municipal water departments, public school districts, electricity utilities, and regional healthcare clinics. When consumers searched for their official local utility payment portal, search results directed them to Doxo landing pages designed to mimic the aesthetic layout of the authentic service providers.\n\nFederal regulators established that millions of consumers paid routine bills through the platform under the mistaken belief they were transacting directly with their local municipality, incurring recurring monthly \"add-on\" delivery fees ranging from $3 to $15 per transaction without clear upfront disclosure.\n\n## Monetary Restitution and Injunction Terms\n\nUnder the court-approved settlement decree:\n* **$2.1 Million Consumer Restitution**: Doxo will pay $2.1 million into an FTC-administered redress fund dedicated to issuing direct refunds to affected utility and healthcare consumers nationwide.\n* **Strict Marketing Prohibitions**: The company is permanently barred from bidding on search engine keywords that mislead consumers regarding official municipal affiliations.\n* **Clear Fee Disclosures**: All service charges, delivery timelines, and processing fees must be disclosed prominently prior to collecting credit card or bank routing numbers.\n\n## Precedent for Digital Financial Intermediaries\n\nFTC Bureau of Consumer Protection officials emphasized that the settlement serves as a binding regulatory benchmark for fintech payment gateways, warning that algorithmic arbitrage that obscures official public utility payment channels violates Section 5 of the FTC Act.",
    "seoTitle": "FTC Orders $2.1M Restitution in Doxo Deceptive Ad Settlement | Choseno",
    "metaDescription": "FTC secures $2.1M settlement against bill payment platform Doxo over deceptive search engine ads and unauthorized consumer fees.",
    "tags": [
      "Federal Trade Commission",
      "FTC",
      "Doxo",
      "Consumer Protection",
      "Fintech",
      "Search Ads",
      "Justice"
    ],
    "tweet": "The FTC orders bill payment platform Doxo to pay 2.1 million dollars in restitution over deceptive search ads that impersonated local utilities and added fees.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Tech & Consumer Justice Desk",
      "bio": "Consumer protection enforcement, digital privacy and federal financial regulatory reporting"
    },
    "sources": [
      {
        "label": "Federal Trade Commission Press Release",
        "url": "https://www.ftc.gov/news-events/news/press-releases/2026/08/ftc-secures-2-1-million-settlement-doxo-deceptive-bill-pay-practices"
      },
      {
        "label": "Reuters Legal",
        "url": "https://www.reuters.com/legal/government/ftc-doxo-2-million-settlement-search-ad-fees-2026-08-17/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "municipal-coalition-lawsuit-dhs-fema-emergency-grants-voting-conditions-2026-08-17",
    "headline": "Major Cities and Counties Sue Homeland Security Over FEMA Grant Voting Preconditions",
    "summary": "A nationwide coalition of local governments files a federal lawsuit against the Department of Homeland Security, challenging administrative rules that condition federal FEMA and anti-terrorism emergency funding on local voting procedures.",
    "category": "Justice",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-17T20:00:00Z",
    "published_at": "2026-08-18T00:15:00Z",
    "impactArea": "country",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "WASHINGTON, D.C. — A bipartisan coalition of municipal and county governments—including the Metropolitan Government of Nashville and Davidson County, Harris County (Houston), El Paso County, and the City of Columbus, Ohio—filed a landmark federal lawsuit in U.S. District Court on Monday challenging administrative conditions imposed on federal emergency preparedness funding.\n\n## Unlawful Grant Conditioning Allegations\n\nThe complaint names the Department of Homeland Security (DHS) and the Federal Emergency Management Agency (FEMA) as defendants, contesting new federal guidelines that attempt to tie eligibility for State Homeland Security Program (SHSP) grants and Urban Areas Security Initiative (UASI) funds to local election administration practices.\n\nPlaintiffs argue that executive attempts to withhold disaster response, cyber defense, and anti-terrorism funding from jurisdictions that refuse to implement specific federal voting directives violate the Spending Clause and Tenth Amendment of the U.S. Constitution. The municipalities assert that Congress established FEMA grant formulas strictly based on risk assessments, critical infrastructure density, and emergency response capabilities—not municipal electoral procedures.\n\n## Local Emergency Readiness and Budget Exposure\n\nThe contested federal grants allocate over $1.2 billion annually across major metropolitan police, fire rescue, and hazardous materials response divisions. In Harris County alone, federal emergency preparedness grants fund regional emergency communication interoperability systems serving 4.8 million residents.\n\n\"Emergency preparedness funding protects our water treatment facilities, transit hubs, and emergency responders during disasters,\" stated Harris County officials. \"Withholding life-saving disaster grants over unrelated policy disputes puts civilian lives at immediate risk.\"\n\n## Judicial Timelines and Preliminary Injunction Motion\n\nThe municipal coalition filed an accompanying emergency motion for a nationwide preliminary injunction to freeze the enforcement of the grant conditions prior to the September 30 federal fiscal disbursement deadline. Federal district judge hearings on the injunction request are expected within fourteen business days.",
    "seoTitle": "Cities and Counties Sue DHS Over FEMA Grant Conditions | Choseno",
    "metaDescription": "Coalition of cities and counties files federal lawsuit against DHS over rules tying FEMA emergency grants to local voting procedures.",
    "tags": [
      "Homeland Security",
      "FEMA",
      "Federal Grants",
      "Municipal Government",
      "Constitutional Law",
      "Emergency Preparedness",
      "Justice"
    ],
    "tweet": "A nationwide coalition of cities and counties files a federal lawsuit against DHS, challenging rules that tie FEMA emergency disaster grants to voting procedures.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Federal Courts & Municipal Law Desk",
      "bio": "Constitutional jurisprudence, municipal federalism and intergovernmental grants reporting"
    },
    "sources": [
      {
        "label": "The Washington Post",
        "url": "https://www.washingtonpost.com/politics/2026/08/17/cities-counties-sue-dhs-fema-grant-conditions/"
      },
      {
        "label": "Bloomberg Government",
        "url": "https://news.bgov.com/federal-law/cities-counties-challenge-dhs-fema-grant-rules-in-federal-court"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
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

    // Auto-generate the branded share-card PNG and save it to
    // hero_image_url (see api/news/[slug]/og-image/route.ts ->
    // generateNewsArticleOgImage in src/lib/services/news.ts) so the image
    // is a static file, already sitting there, by the time this article is
    // ever shared -- instead of depending on a live next/og render at share
    // time, which is what made the X/Twitter card unreliable. Best-effort:
    // a failure here just leaves the live opengraph-image.tsx route as the
    // fallback, so it never blocks the batch.
    if (created.status === 'published') {
      try {
        const ogRes = await fetch(`${SITE_URL}/api/news/${created.slug}/og-image`, {
          method: 'POST',
          headers: { Authorization: authHeaders.Authorization }
        });
        if (ogRes.ok) {
          console.log(`  -> Generated share-card image`);
        } else {
          console.warn(`  -> Warning: failed to generate share-card image:`, await ogRes.text());
        }
      } catch (ogErr) {
        console.warn(`  -> Warning: failed to generate share-card image:`, ogErr.message);
      }
    }

    inserted.push(created);
  }

  console.log('\n=========================================');
  console.log(`INGESTION COMPLETE: ${inserted.length} inserted, ${skipped.length} skipped.`);
  console.log('=========================================');
}

run().catch(console.error);
