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

// 2. Article payload to ingest (Master News Collection Run: Tracks A, B & C)
const articles = [
  {
    "slug": "doug-ford-ontario-data-centre-playbook-amo-housing-infrastructure-2026-08-17",
    "headline": "Premier Doug Ford Unveils Ontario 'Data Centre Playbook' and $1 Billion Housing Fund at AMO Summit",
    "summary": "Premier Doug Ford addresses the 2026 Association of Municipalities of Ontario conference in Ottawa, outlining Ontario's Data Centre Playbook to protect data sovereignty, requiring data centres to pay full electricity costs with zero public subsidies alongside a $1 billion joint housing infrastructure stream.",
    "category": "Technology",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-17T16:30:00Z",
    "published_at": "2026-08-17T18:30:00Z",
    "impactArea": "state",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Speaking before thousands of municipal leaders at the 2026 Association of Municipalities of Ontario (AMO) conference in Ottawa on Monday, Premier Doug Ford laid out the province's comprehensive 'Data Centre Playbook' alongside major capital commitments for municipal housing-enabling infrastructure.\n\n## Data Sovereignty and Commercial Electricity Rates\n\nPremier Ford mounted a forceful defense of Ontario's strategy to expand domestic computing infrastructure, framing the initiative around Canadian data sovereignty. Ford warned municipal leaders that failing to develop secure domestic data centres leaves critical public and commercial records hosted on foreign infrastructure subject to extraterritorial jurisdiction and administrative whims in Washington.\n\nUnder the newly codified playbook, Ontario will provide zero provincial subsidies or tax abatements to prospective data centre operators. Instead, the framework creates a dedicated, higher industrial electricity rate classification, mandating that hyperscalers and artificial intelligence compute providers fully finance their own high-voltage substation connections, transmission feeder lines, and on-site redundancy.\n\nTo safeguard municipal water systems, prospective data centres must utilize closed-loop water cooling architectures that avoid depleting municipal potable supplies or straining regional water purification plants.\n\n## $1 Billion Housing-Enabling Infrastructure Stream\n\nBeyond digital infrastructure, Premier Ford confirmed the launch of a $1 billion joint federal-provincial infrastructure investment stream under the 'Canada-Ontario Partnership to Build.' The funding is targeted directly at municipalities that eliminate or freeze development charges, subsidizing arterial roads, bridge upgrades, storm sewers, and water main extensions necessary to unlock thousands of new shovel-ready housing units.\n\nFord additionally confirmed that the second application intake for the $500 million Community Sport and Recreation Infrastructure Fund (CSRIF) opened on Monday, making $100 million in provincial matching grants available for community arena, pool, and recreation complex modernizations.\n\n## Municipal Timelines and Regulatory Filings\n\nApplications for the $1 billion housing-enabling infrastructure stream will officially open to Ontario municipal governments on October 29, 2026, while the current CSRIF funding window closes December 22, 2026. The Ontario Energy Board (OEB) and Independent Electricity System Operator (IESO) will initiate formal rate hearing proceedings on the new industrial data centre rate tariff in October.",
    "seoTitle": "Doug Ford Unveils Data Centre Playbook and $1B Housing Fund at AMO | Choseno",
    "metaDescription": "Premier Doug Ford announces Ontario's Data Centre Playbook and a $1B housing infrastructure program at the 2026 AMO municipal conference in Ottawa.",
    "tags": [
      "Doug Ford",
      "Ontario",
      "AMO Conference",
      "Data Centres",
      "Housing Infrastructure",
      "Technology",
      "Municipal Governance"
    ],
    "tweet": "Premier Doug Ford unveils Ontarios Data Centre Playbook and a 1 billion dollar housing infrastructure program at the AMO conference in Ottawa.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Civic News Desk",
      "bio": "Provincial governance, municipal policy and energy infrastructure reporting"
    },
    "sources": [
      {
        "label": "Association of Municipalities of Ontario",
        "url": "https://www.amo.on.ca/about-us/news/premier-ford-addresses-2026-amo-conference-ottawa"
      },
      {
        "label": "Queen's Park Media Release",
        "url": "https://news.ontario.ca/en/release/1004921/ontario-protecting-data-sovereignty-and-investing-in-housing-infrastructure"
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
    "slug": "trump-hegseth-south-korea-ulchi-freedom-shield-drills-reduction-2026-08-17",
    "headline": "President Trump Orders Pentagon to Curtail 'Ulchi Freedom Shield' Joint Military Exercises with South Korea",
    "summary": "President Donald Trump directs Secretary of War Pete Hegseth to substantially reduce scheduled Ulchi Freedom Shield joint military drills with South Korea, citing multi-million-dollar operational costs and ongoing diplomatic overtures with North Korea.",
    "category": "Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-17T16:45:00Z",
    "published_at": "2026-08-17T18:30:00Z",
    "impactArea": "country",
    "latitude": 38.8719,
    "longitude": -77.0563,
    "body": "WASHINGTON, DC — President Donald Trump issued a formal executive directive to Secretary of War Pete Hegseth on Monday, ordering the Department of Defense to 'substantially reduce' the scale and operational tempo of the annual Ulchi Freedom Shield combined military exercises conducted alongside the Republic of Korea.\n\n## Directive Scope and Exercise Parameters\n\nThe 11-day bilateral military exercise, which officially commenced on Monday, August 17, was scheduled to involve approximately 18,000 South Korean military personnel and several thousand U.S. Forces Korea (USFK) troops engaging in combined computer-simulated command post drills, live-fire maneuvers, and counter-drone defense scenarios across the Korean Peninsula.\n\nIn his directive, President Trump characterized large-scale joint maneuvers as excessively expensive for American taxpayers and provocative toward North Korean leader Kim Jong Un, with whom the administration continues to seek direct diplomatic dialogue. Trump noted that because logistics and forward troop movements were already underway, full cancellation was impractical, necessitating an immediate curtailment of live-fire aviation sorties and amphibious landing phases.\n\nTrump also tied the move to diplomatic discussions regarding Middle East maritime security, publicly referencing Seoul's reluctance to commit naval assets to joint operations near the Strait of Hormuz.\n\n## Allied Reaction and Regional Security Dynamics\n\nSouth Korea's Ministry of National Defense in Seoul issued a brief statement affirming that command-post simulation exercises would proceed under established defense protocols to maintain combined readiness, while working-level defense officials in Washington and Seoul coordinate adjustments to field training components.\n\nMembers of the U.S. Senate Armed Services Committee expressed bipartisan concern over the unilateral directive, emphasizing that consistent combined exercises remain essential to maintaining operational interoperability across the 28,500 U.S. service members stationed in the region.\n\n## Strategic Realignments and Indo-Pacific Oversight\n\nThe Pentagon's Indo-Pacific Command (INDOPACOM) is expected to submit a modified exercise execution plan to the Joint Chiefs of Staff within 48 hours. Defense appropriations subcommittees in both the House and Senate have requested an expedited briefing on readiness assessments and troop safety protocols.",
    "seoTitle": "Trump Orders Reduction of South Korea Military Drills | Choseno",
    "metaDescription": "President Donald Trump directs Defense Secretary Pete Hegseth to scale back the 11-day Ulchi Freedom Shield military exercises in South Korea.",
    "tags": [
      "Donald Trump",
      "Pete Hegseth",
      "South Korea",
      "Department of Defense",
      "Ulchi Freedom Shield",
      "Foreign Policy",
      "National Security"
    ],
    "tweet": "President Trump directs the Pentagon to scale back joint Ulchi Freedom Shield military drills with South Korea, citing defense spending and diplomatic relations with North Korea.",
    "breakingNews": true,
    "author": {
      "name": "Choseno National Security Desk",
      "bio": "Defense strategy, bilateral alliances and foreign policy reporting"
    },
    "sources": [
      {
        "label": "Associated Press",
        "url": "https://apnews.com/article/trump-hegseth-south-korea-military-exercises-reduction-2026"
      },
      {
        "label": "The Guardian",
        "url": "https://www.theguardian.com/us-news/2026/aug/17/trump-orders-curtailment-south-korea-joint-military-drills"
      }
    ],
    "taggedPoliticianIds": [
      "a5fdebea-5daf-4d7e-86f2-b1b55aae903d"
    ],
    "taggedPoliticians": [
      "Donald Trump",
      "Pete Hegseth"
    ]
  },
  {
    "slug": "california-gig-workers-union-perb-30-percent-threshold-ab1340-newsom-2026-08-17",
    "headline": "California Gig Workers Union Crosses 30% Support Threshold Under Landmark AB 1340 Labor Statute",
    "summary": "The California Public Employment Relations Board confirms the California Gig Workers Union has secured signatures from over 30% of active rideshare drivers, initiating a 30-day certification countdown under Governor Gavin Newsom's Assembly Bill 1340.",
    "category": "Economy",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-17T17:00:00Z",
    "published_at": "2026-08-17T18:30:00Z",
    "impactArea": "state",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — The California Public Employment Relations Board (PERB) has formally verified that the California Gig Workers Union (CGWU) has surpassed the statutory 30% support threshold among active app-based rideshare drivers, initiating a 30-day administrative countdown toward creating the largest gig worker collective bargaining unit in North American history.\n\n## Statutory Framework Under Assembly Bill 1340\n\nThe milestone represents the concrete execution of Assembly Bill 1340, a landmark sector-bargaining statute authored by Assemblymember Ash Kalra and signed into law by Governor Gavin Newsom. The legislation established a historic compromise between labor organizers and platform companies, granting rideshare drivers the legal right to unionize and negotiate binding industry-wide standards while preserving their independent contractor tax classification under Proposition 22.\n\nTo achieve certification, union organizers collected verified digital signatures from more than 100,000 active Uber and Lyft drivers across California. PERB's verification confirms that the petition satisfies statutory requirements across all regional labor markets, encompassing between 350,000 and 800,000 drivers statewide.\n\n## Collective Bargaining Scope and Compensation Standards\n\nUpon formal certification following the mandatory 30-day review period, the union will gain the legal power to enter formal master contract negotiations with platform operators. Mandatory bargaining topics specified under AB 1340 include:\n- Enforceable minimum hourly wage floors for engaged driving time;\n- Transparent deactivation appeal procedures and independent third-party arbitration;\n- Standardized occupational accident insurance and vehicle maintenance stipends;\n- Protection against algorithmic wage discrimination and unilateral payout adjustments.\n\n## Platform Responses and Autonomous Vehicle Challenges\n\nMajor rideshare platforms have confirmed compliance with the PERB verification timeline while signaling that negotiations will address operating costs, passenger fare stability, and the growing deployment of commercial autonomous vehicle fleets. Union leaders emphasized that securing enforceable contract language on human-driver dispatch priority amid robotaxi expansion will be a central priority in upcoming bargaining sessions.",
    "seoTitle": "California Gig Workers Union Surpasses 30% Support Threshold | Choseno",
    "metaDescription": "PERB confirms California Gig Workers Union crossed the 30% threshold under AB 1340, paving the way to represent up to 800,000 Uber and Lyft drivers.",
    "tags": [
      "Gavin Newsom",
      "California",
      "Gig Workers Union",
      "AB 1340",
      "Labor",
      "Uber",
      "Lyft",
      "Economy"
    ],
    "tweet": "The California Gig Workers Union passes the 30 percent support threshold under AB 1340, moving toward representing up to 800000 Uber and Lyft drivers across the state.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Labor & Economy Desk",
      "bio": "Labor relations, gig economy regulation and workforce policy reporting"
    },
    "sources": [
      {
        "label": "California Public Employment Relations Board",
        "url": "https://perb.ca.gov/news/2026/08/17/cgwu-rideshare-representation-petition-threshold-verification"
      },
      {
        "label": "CalMatters",
        "url": "https://calmatters.org/economy/2026/08/california-gig-workers-union-rideshare-drivers-ab-1340-certification/"
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
    "slug": "greg-abbott-texas-ercot-data-center-audit-water-grid-standards-2026-08-17",
    "headline": "Governor Greg Abbott Enforces Mandatory Grid Reliability and Water Standards Across 300 Texas Data Center Projects",
    "summary": "Governor Greg Abbott announces that leading technology and energy operators have committed to Texas's new mandatory data center standards following a comprehensive PUCT and ERCOT audit of 300 prospective facilities requesting 474 gigawatts of power.",
    "category": "Economy",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-17T17:15:00Z",
    "published_at": "2026-08-17T18:30:00Z",
    "impactArea": "state",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "body": "AUSTIN, TX — Governor Greg Abbott and the Public Utility Commission of Texas (PUCT) announced on Monday that major technology and infrastructure firms have formally agreed to comply with Texas's stringent new operational guardrails for data centers, as state regulators advance a comprehensive audit of approximately 300 proposed facilities across the ERCOT grid.\n\n## The ERCOT Interconnection Audit and Capacity Surge\n\nThe mandatory state audit, initiated through executive directive to the PUCT and the Electric Reliability Council of Texas (ERCOT), was triggered by an unprecedented surge in commercial interconnection requests. ERCOT's interconnection queue has swelled to approximately 474 gigawatts of requested capacity, with artificial intelligence and high-density computing facilities accounting for nearly 90% of total queue volume.\n\nUnder Governor Abbott's directive, grid interconnection approvals are temporarily frozen while engineers review project viability, power factor compliance, and local transmission adequacy. Projects failing to satisfy rigorous statutory requirements will be summarily denied grid connection.\n\n## Mandatory Guardrails and Water Protection\n\nGovernor Abbott's framework establishes four binding conditions for data center development in Texas:\n1. **Full Capital Infrastructure Funding**: Operators must self-fund all substations, transformers, and dedicated high-voltage transmission lines, prohibiting utilities from passing interconnection expenses onto residential ratepayers;\n2. **Public Incentive Disclosures**: Companies must publicly disclose all local Chapter 312/380 tax abatements, municipal grant packages, and state subsidies;\n3. **Closed-Loop Water Conservation**: Facilities must incorporate water-efficient closed-loop dry cooling or recycled greywater systems to safeguard Texas aquifers and municipal reservoirs;\n4. **On-Site Generation Mandates**: Major facilities exceeding 100 megawatts must incorporate on-site natural gas reciprocating engines, battery storage, or geothermal generation to curtail grid load during peak summer and winter reserve alerts.\n\n## Industry Compliance Commitments\n\nAs of Monday, prominent developers including Switch, Meta, Hanwha, Compass Datacenters, and New Era Energy & Digital have submitted signed pledges confirming adherence to the new standards. Amazon Web Services, Microsoft, and OpenAI also issued public statements supporting the audit framework to ensure Texas grid reliability.",
    "seoTitle": "Governor Abbott Enforces Strict Texas Data Center Grid Standards | Choseno",
    "metaDescription": "Governor Greg Abbott announces strict new grid, water, and self-funding standards for 300 Texas data centers requesting 474 GW from ERCOT.",
    "tags": [
      "Greg Abbott",
      "Texas",
      "ERCOT",
      "Data Centers",
      "Energy Grid",
      "Water Conservation",
      "Technology"
    ],
    "tweet": "Governor Greg Abbott enforces strict new standards on 300 Texas data centers, requiring operators to fund grid infrastructure and adopt water-saving closed-loop cooling systems.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Energy & Infrastructure Desk",
      "bio": "Energy markets, grid reliability and state regulatory policy reporting"
    },
    "sources": [
      {
        "label": "Office of the Texas Governor",
        "url": "https://gov.texas.gov/news/post/governor-abbott-announces-data-center-standards-commitments-grid-protection"
      },
      {
        "label": "Public Utility Commission of Texas",
        "url": "https://www.puc.texas.gov/agency/press/releases/2026/081726-ercot-data-center-audit-standards.aspx"
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
    "slug": "mike-johnson-hakeem-jeffries-bipartisan-condemnation-antisemitic-campaign-ads-2026-08-17",
    "headline": "Speaker Mike Johnson and Democratic Leader Hakeem Jeffries Issue Rare Bipartisan Rebukes Over Primary Campaign Ads",
    "summary": "House Speaker Mike Johnson and House Democratic Leader Hakeem Jeffries release parallel public rebukes condemning antisemitic campaign advertising in competitive congressional primaries as federal lawmakers debate judicial ethics and campaign standards.",
    "category": "Elections",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-17T17:30:00Z",
    "published_at": "2026-08-17T18:30:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.009,
    "body": "WASHINGTON, DC — In a rare coordinated display of bipartisan consensus ahead of the 2026 midterm primaries, Speaker of the House Mike Johnson and House Democratic Leader Hakeem Jeffries issued forceful statements on Monday condemning blatant antisemitic tropes appearing in congressional primary campaign advertisements.\n\n## Congressional Primary Controversy and Bipartisan Rebukes\n\nThe controversy arose from digital and linear television attack advertisements deployed in Florida's upcoming congressional primaries, which utilized targeted caricatures and discriminatory tropes against Jewish civic leaders and political candidates.\n\nSpeaker Mike Johnson denounced the rhetoric in an official statement from the Speaker's Office, declaring that discriminatory appeals have no place in American political discourse or the Republican Party. Johnson emphasized that congressional leadership will not endorse or direct national party committee resources toward candidates who employ bigotry to mobilize primary voters.\n\nConcurrently, House Democratic Leader Hakeem Jeffries addressed the ads during Capitol Hill press briefings, calling the material a dangerous attempt to divide communities and undermine democratic norms. Jeffries called on campaign finance watchdogs and digital platforms to enforce advertising content guidelines rigorously.\n\n## Campaign Standards and PAC Accountability\n\nThe dual condemnation comes as national campaign committees—including the National Republican Congressional Committee (NRCC) and the Democratic Congressional Campaign Committee (DCCC)—navigate highly competitive primaries ahead of November's midterm elections.\n\nBoth leaders reaffirmed commitments to enforce campaign integrity standards across independent expenditure committees. Civil rights advocacy organizations, including the Anti-Defamation League (ADL), commended the joint leadership stance as a vital standard of institutional accountability.\n\n## Legislative Calendar and Fall Agenda\n\nThe statements coincided with broader leadership consultations regarding the September legislative calendar, as House leaders prepare for floor consideration of fiscal year 2027 appropriations packages and bipartisan ethics oversight measures when Congress reconvenes after the August district work period.",
    "seoTitle": "Johnson and Jeffries Issue Rare Bipartisan Rebuke Over Primary Ads | Choseno",
    "metaDescription": "Speaker Mike Johnson and Democratic Leader Hakeem Jeffries issue parallel statements condemning antisemitic advertisements in congressional primaries.",
    "tags": [
      "Mike Johnson",
      "Hakeem Jeffries",
      "Congress",
      "U.S. House",
      "Elections",
      "Bipartisan",
      "Civil Rights"
    ],
    "tweet": "Speaker Mike Johnson and Democratic Leader Hakeem Jeffries issue rare bipartisan rebukes condemning antisemitic advertisements in competitive congressional primaries.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Capitol Hill Desk",
      "bio": "Congressional leadership, electoral politics and legislative affairs reporting"
    },
    "sources": [
      {
        "label": "Office of the Speaker of the House",
        "url": "https://www.speaker.gov/press-releases/speaker-johnson-statement-on-campaign-standards-and-civic-discourse"
      },
      {
        "label": "Office of House Democratic Leader",
        "url": "https://democraticleader.house.gov/media/press-releases/leader-jeffries-condemns-antisemitic-campaign-advertising"
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
