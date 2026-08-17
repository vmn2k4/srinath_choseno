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
    "slug": "mark-carney-10-billion-gull-island-churchill-falls-clean-energy-package-2026-08-17",
    "headline": "Prime Minister Mark Carney Commits $10 Billion Federal Guarantee in $70B Eastern Clean Power Corridor",
    "summary": "Prime Minister Mark Carney confirms a $10 billion federal clean energy financing commitment alongside Newfoundland and Labrador and Quebec leadership to unlock the $70 billion Gull Island and Churchill Falls expansion, adding thousands of megawatts of baseload power to Eastern grids.",
    "category": "Economy",
    "country": "CA",
    "province": "NL",
    "status": "published",
    "eventDate": "2026-08-17T17:45:00Z",
    "published_at": "2026-08-17T18:45:00Z",
    "impactArea": "country",
    "latitude": 53.535,
    "longitude": -64.316,
    "body": "ST. JOHN'S, NL \u2014 Prime Minister Mark Carney finalized a monumental intergovernmental energy accord in St. John's on Monday, confirming a $10 billion federal financing package through the Canada Infrastructure Bank and federal green loan guarantees to anchor a $70 billion clean electricity corridor across Labrador and Quebec.\n\n## Trilateral Energy Framework and Gull Island Development\n\nThe trilateral agreement between Ottawa, Newfoundland and Labrador Premier Tony Wakeham, and Quebec provincial leadership establishes the binding capital structure to modernize the Churchill Falls hydroelectric station and construct the long-anticipated Gull Island generation facility on the lower Churchill River. Together, the projects are engineered to triple Churchill Falls' generation potential, unlocking over 7,500 megawatts of clean, reliable baseload electricity for Eastern Canada and northeastern U.S. interconnects.\n\nThe $10 billion federal commitment includes low-cost sovereign debt guarantees and direct transmission equity backstops, lowering borrowing costs for provincial utilities Hydro-Qu\u00e9bec and NL Hydro while funding high-voltage direct current (HVDC) transmission lines traversing northern Quebec and the Maritimes.\n\n## Macroeconomic and Employment Impact\n\nIndependent economic modelling released alongside the announcement projects the $70 billion infrastructure corridor will support 23,000 direct and indirect construction and engineering jobs over a 15-year buildout. The development is estimated to contribute $31 billion directly to Canada's gross domestic product through 2040, providing heavy industrial manufacturers in Ontario and Quebec with stable electricity rates insulated from fossil fuel price volatility.\n\n## Legislative Oversight and Environmental Approvals\n\nPrime Minister Carney emphasized that federal environmental assessment panels and joint Indigenous co-ownership agreements with Innu Nation leadership will be prioritized throughout 2027. Bilateral technical teams will deliver final engineering design specifications to parliamentary and provincial oversight committees by December 15, 2026.",
    "seoTitle": "Carney Commits $10B Federal Financing for $70B Clean Energy Corridor | Choseno",
    "metaDescription": "Prime Minister Mark Carney confirms $10B in federal financing to unlock the $70B Churchill Falls and Gull Island clean power expansion in Labrador.",
    "tags": [
      "Mark Carney",
      "Churchill Falls",
      "Gull Island",
      "Clean Energy",
      "Hydroelectricity",
      "Newfoundland and Labrador",
      "Quebec",
      "Economy"
    ],
    "tweet": "Prime Minister Mark Carney commits 10 billion dollars in federal financing toward a 70 billion dollar clean energy expansion at Churchill Falls and Gull Island.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Energy & Civic Desk",
      "bio": "Federal clean energy policy, mega-infrastructure and intergovernmental affairs reporting"
    },
    "sources": [
      {
        "label": "Government of Canada",
        "url": "https://www.canada.ca/en/natural-resources-canada/news/2026/08/prime-minister-announces-historic-clean-energy-investments-in-labrador-and-quebec.html"
      },
      {
        "label": "CBC News",
        "url": "https://www.cbc.ca/news/canada/newfoundland-labrador/carney-wakeham-10-billion-clean-energy-gull-island-churchill-falls-1.7482955"
      }
    ],
    "taggedPoliticianIds": [
      "4bd5cf73-1d03-4fb2-ae1b-2303c2c99737"
    ],
    "taggedPoliticians": [
      "Mark Carney"
    ]
  },
  {
    "slug": "pierre-poilievre-canada-us-tariffs-softwood-lumber-ultimatum-2026-08-17",
    "headline": "Pierre Poilievre Demands Removal of U.S. Softwood Lumber Tariffs Ahead of August 19 Trade Deadline",
    "summary": "Conservative Leader Pierre Poilievre issues a four-point trade ultimatum demanding Prime Minister Mark Carney insist on the complete elimination of U.S. softwood lumber duties and Buy America exemptions in final-hour tariff negotiations with Washington.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-17T17:50:00Z",
    "published_at": "2026-08-17T18:45:00Z",
    "impactArea": "country",
    "latitude": 45.4248,
    "longitude": -75.6997,
    "body": "OTTAWA, ON \u2014 Conservative Leader Pierre Poilievre held a high-profile press conference on Parliament Hill on Monday, demanding that the federal government reject unilateral concessions and make the permanent elimination of U.S. softwood lumber tariffs a mandatory precondition for any bilateral trade resolution before Wednesday's August 19 tariff deadline.\n\n## Four-Point Trade Ultimatum\n\nFlanked by Conservative Canada-U.S. Relations Critic Shuvaloy Majumdar, Poilievre released a formal policy letter dispatched to Prime Minister Mark Carney and Trade Minister Dominic LeBlanc. The opposition framework outlines four non-negotiable terms for Canadian negotiators in Washington:\n1. Complete elimination of all U.S. countervailing and anti-dumping duties on Canadian softwood lumber, which currently hover near 45%;\n2. Permanent exemption of Canadian steel and aluminum from sectoral import caps and Section 232 levies;\n3. Reaffirmation of tariff-free cross-border automotive manufacturing under the USMCA rules of origin; and\n4. Comprehensive waivers for Canadian contractors and suppliers from federal and municipal 'Buy America' procurement restrictions.\n\nPoilievre criticized the government's negotiating posture, asserting that Canadian officials have repeatedly offered digital services tax adjustments and border enforcement concessions without securing binding protections for forestry workers in British Columbia, Quebec, and New Brunswick.\n\n## Cross-Border Economic Stakes and Sector Exposure\n\nThe standoff comes as Washington prepares to enact 50% across-the-board tariffs on $28 billion in targeted Canadian exports on August 19 unless an executive agreement is finalized. Industry groups, including the Forest Products Association of Canada and Canadian Manufacturers & Exporters, warn that without tariff relief, thousands of mill jobs across rural communities remain acutely vulnerable.\n\n## Parliamentary Debate and Opposition Strategy\n\nPoilievre confirmed that Conservative MPs will demand an emergency debate in the House of Commons upon Parliament's return if tariffs take effect on Wednesday, pledging to introduce statutory measures requiring parliamentary ratification for any major bilateral trade concessions.",
    "seoTitle": "Pierre Poilievre Issues Softwood Lumber Ultimatum Ahead of Tariffs | Choseno",
    "metaDescription": "Conservative Leader Pierre Poilievre demands zero tariffs on Canadian softwood lumber as Canada-U.S. trade deadline looms on August 19.",
    "tags": [
      "Pierre Poilievre",
      "Mark Carney",
      "Trade Policy",
      "Softwood Lumber",
      "Tariffs",
      "USMCA",
      "Economy"
    ],
    "tweet": "Conservative Leader Pierre Poilievre demands the federal government reject trade concessions and secure zero tariffs on Canadian softwood lumber ahead of August 19.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Parliamentary Affairs Desk",
      "bio": "Federal politics, international trade negotiations and opposition oversight reporting"
    },
    "sources": [
      {
        "label": "Conservative Party of Canada",
        "url": "https://www.conservative.ca/press-releases/poilievre-calls-for-backbone-in-us-trade-negotiations-demands-end-to-softwood-lumber-tariffs"
      },
      {
        "label": "National Post",
        "url": "https://nationalpost.com/news/politics/poilievre-carney-us-trade-tariffs-softwood-lumber-deadline"
      }
    ],
    "taggedPoliticianIds": [
      "a0d8ee32-8927-48bc-9a98-fee27dd02d51"
    ],
    "taggedPoliticians": [
      "Pierre Poilievre"
    ]
  },
  {
    "slug": "raul-torrez-new-mexico-meta-942-million-judgment-youth-safety-bills-2026-08-17",
    "headline": "New Mexico Secures $942 Million Final Judgment Against Meta as AG Ra\u00fal Torrez Drafts Child Safety AI Bills",
    "summary": "New Mexico Attorney General Ra\u00fal Torrez secures a landmark $942 million court-ordered penalty and public nuisance abatement fund against Meta, simultaneously introducing state legislation to regulate AI chatbot interactions with minors.",
    "category": "Technology",
    "country": "US",
    "province": "NM",
    "status": "published",
    "eventDate": "2026-08-17T17:55:00Z",
    "published_at": "2026-08-17T18:45:00Z",
    "impactArea": "state",
    "latitude": 35.687,
    "longitude": -105.9378,
    "body": "SANTA FE, NM \u2014 New Mexico Attorney General Ra\u00fal Torrez announced a landmark legal and regulatory victory on Monday following a final state district court order establishing a total financial penalty of $942 million against Meta Platforms Inc. for deceptive practices and public nuisance violations regarding youth safety.\n\n## Judgment Structure and Mandatory Abatement Fund\n\nThe historic $942 million total judgment combines two distinct judicial rulings in New Mexico's state litigation against the social media conglomerate:\n- A $375 million civil penalty awarded by a state jury in March 2026 finding Meta liable for consumer fraud and deceptive trade practices by concealing algorithmic harms from parents and children;\n- A $567 million equitable public nuisance abatement fund finalized this month, requiring Meta to finance statewide mental health clinics, adolescent crisis counseling networks, and school-based digital literacy programs over the next eight years.\n\nIn addition to monetary penalties, the state court issued permanent injunctive relief mandating that Meta disable overnight push notifications for minors, enforce strict age verification mechanisms, and block unverified adult accounts from initiating direct messaging with teenage users in New Mexico.\n\n## Expansion into AI Chatbot and Emerging Tech Regulation\n\nLeveraging the legal victory, Attorney General Torrez unveiled two upcoming state legislative bills drafted in collaboration with legislative leaders in Santa Fe. The proposed statutes expand state consumer protection oversight beyond conventional social feeds to encompass generative artificial intelligence chatbots, conversational companions, and algorithmic recommender engines accessible to minors under 18.\n\nThe legislation will require developers of commercial conversational agents to implement mandatory safety guardrails preventing manipulative emotional conditioning, self-harm discussions, and unmonitored data collection from children.\n\n## Appellate Strategy and National State AG Precedent\n\nMeta issued a formal response stating its intention to appeal the $942 million judgment to the New Mexico Court of Appeals, arguing the penalties exceed statutory caps under state law. However, attorneys general from 42 other states are reviewing the New Mexico ruling as a foundational model for multi-state trial remedies currently underway in federal court in California.",
    "seoTitle": "New Mexico Wins $942M Meta Judgment as AG Torrez Prepares AI Safety Bills | Choseno",
    "metaDescription": "New Mexico AG Ra\u00fal Torrez secures a $942M penalty and abatement fund against Meta, unveiling new state legislation targeting AI chatbot child safety.",
    "tags": [
      "Ra\u00fal Torrez",
      "New Mexico",
      "Meta",
      "Youth Safety",
      "Artificial Intelligence",
      "Technology",
      "Judiciary"
    ],
    "tweet": "New Mexico Attorney General Raul Torrez secures a 942 million dollar judgment against Meta and introduces state legislation restricting AI chatbot interactions with minors.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Tech Policy & Legal Desk",
      "bio": "Digital privacy, consumer protection and state attorney general litigation reporting"
    },
    "sources": [
      {
        "label": "Office of the New Mexico Attorney General",
        "url": "https://www.nmag.gov/news/press-releases/ag-torrez-secures-942-million-judgment-against-meta-advances-youth-ai-safety-legislation"
      },
      {
        "label": "The Washington Post",
        "url": "https://www.washingtonpost.com/technology/2026/08/17/new-mexico-meta-942-million-penalty-youth-mental-health/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": [
      "Ra\u00fal Torrez"
    ]
  },
  {
    "slug": "danielle-smith-alberta-digital-refinery-data-centre-grid-levy-2026-08-17",
    "headline": "Premier Danielle Smith Advances 'Digital Refinery' Strategy with 2% Grid Levy for Large Alberta Data Centres",
    "summary": "Premier Danielle Smith champions Alberta's transition toward AI 'digital refineries' to monetize natural gas, outlining a new 2% corporate levy structure for facilities exceeding 75 megawatts while safeguarding provincial power grid stability.",
    "category": "Technology",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-17T18:00:00Z",
    "published_at": "2026-08-17T18:45:00Z",
    "impactArea": "state",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "body": "EDMONTON, AB \u2014 Premier Danielle Smith articulated Alberta's industrial strategy for high-performance computing on Monday, promoting the expansion of artificial intelligence data centres as 'digital refineries' that convert Alberta's vast natural gas reserves into high-value global compute power while enforcing a new 2% fiscal levy on grid-connected facilities.\n\n## Digital Refineries and Natural Gas Monetization\n\nAddressing municipal delegates and energy executives in Edmonton, Premier Smith framed AI computing clusters as a direct technological evolution of Alberta's resource economy. Under this industrial model, abundant stranded natural gas is converted directly to on-site electricity, powering large-scale AI accelerator farms that export digital compute models rather than raw physical hydrocarbons.\n\nSmith highlighted ongoing development around a proposed $13 billion Meta hyperscale data centre campus in Sturgeon County as an anchor investment. To balance energy growth with residential grid security, Alberta has enacted a dedicated regulatory framework effective December 31, 2026, requiring commercial computing projects exceeding 75 megawatts to pay a 2% grid infrastructure levy, which can be credited against provincial corporate income tax upon achieving verified on-site power generation thresholds.\n\n## Water Conservation and Off-Grid Mandates\n\nAmid public feedback from summer town halls concerning power consumption and municipal water tables, the Alberta Electric System Operator (AESO) has been instructed to fast-track off-grid 'behind-the-meter' generation approvals. Facilities operating self-contained natural gas turbines with carbon capture readiness or closed-loop cooling systems will receive accelerated interconnection permits, ensuring residential consumers do not experience electricity rate spikes.\n\n## Interprovincial Infrastructure Alignment\n\nConcurrently, Premier Smith noted that discussions with Ontario Premier Doug Ford regarding the proposed 3,300-kilometre 'Northern Shield Energy Corridor' from Hardisty to Sarnia remain ongoing, emphasizing that Alberta's dual-track energy approach advances both traditional oil refinery feeds and cutting-edge digital compute infrastructure.",
    "seoTitle": "Danielle Smith Advances Digital Refinery Strategy in Alberta | Choseno",
    "metaDescription": "Premier Danielle Smith details Alberta's AI digital refinery strategy, introducing a 2% grid levy on data centres exceeding 75 megawatts.",
    "tags": [
      "Danielle Smith",
      "Alberta",
      "Data Centres",
      "Digital Refineries",
      "Energy Policy",
      "Technology",
      "AESO"
    ],
    "tweet": "Premier Danielle Smith advances Albertas digital refinery strategy, implementing a 2 percent grid levy on data centres exceeding 75 megawatts to balance power reliability.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Energy & Technology Desk",
      "bio": "Western Canadian energy policy, AI compute infrastructure and regulatory strategy reporting"
    },
    "sources": [
      {
        "label": "Government of Alberta",
        "url": "https://www.alberta.ca/release.cfm?xID=91280Danielle-Smith-digital-refineries-data-centre-grid-framework"
      },
      {
        "label": "Calgary Herald",
        "url": "https://calgaryherald.com/business/energy/danielle-smith-alberta-data-centres-digital-refinery-meta-investment"
      }
    ],
    "taggedPoliticianIds": [
      "77d86f33-0e15-46c3-8d2d-dd882a679be7"
    ],
    "taggedPoliticians": [
      "Danielle Smith"
    ]
  },
  {
    "slug": "ron-desantis-florida-primary-eve-gubernatorial-senate-succession-2026-08-17",
    "headline": "Florida Prepares for Crucial August 18 Primary to Determine Gubernatorial and U.S. Senate Succession",
    "summary": "On the eve of Florida's pivotal statewide primary election, voters prepare to choose nominees to succeed term-limited Governor Ron DeSantis and fill the vacant U.S. Senate seat previously held by Secretary of State Marco Rubio.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-17T18:05:00Z",
    "published_at": "2026-08-17T18:45:00Z",
    "impactArea": "state",
    "latitude": 30.4383,
    "longitude": -84.2807,
    "body": "TALLAHASSEE, FL \u2014 Florida election supervisors across 67 counties completed final voting machine logic testing on Monday as more than 1.8 million mail-in and early in-person ballots were logged ahead of Tuesday's August 18 statewide primary election, which will decide the party nominees vying to succeed term-limited Governor Ron DeSantis.\n\n## High-Stakes Gubernatorial Primary\n\nWith Governor DeSantis barred by Florida's constitution from seeking a third consecutive four-year term, competitive primary battles have unfolded in both major parties. On the Republican ballot, candidates have sought to align with the Governor's conservative policy record on deregulation, education reform, and capital punishment enforcement while navigating endorsements from former President Donald Trump.\n\nDemocratic contenders have centered campaigns on property insurance affordability, public utility rate relief, and abortion access amendments that appeared on recent statewide ballots.\n\n## U.S. Senate Special Election Nomination\n\nVoters will simultaneously select candidates in a high-stakes special election primary to fill the remainder of the U.S. Senate term previously held by Marco Rubio, who resigned following his appointment as U.S. Secretary of State. Governor DeSantis appointed Florida Attorney General Ashley Moody on an interim basis to serve until voters elect a permanent senator in November.\n\n## Executive Actions and Capital Punishment Scrutiny\n\nThe primary eve comes amidst intense scrutiny surrounding executive clemency. The Florida Conference of Catholic Bishops and criminal justice organizations submitted formal petitions urging Governor DeSantis to grant clemency to death row inmate William Silvia, scheduled for execution on August 18. DeSantis's office confirmed the administration will not stay the lawful sentence, maintaining the state's longstanding capital punishment enforcement record.\n\nFlorida polling precincts open Tuesday at 7:00 a.m. and close at 7:00 p.m. local time, with early results expected shortly thereafter.",
    "seoTitle": "Florida Primary Preview: Gubernatorial and U.S. Senate Succession | Choseno",
    "metaDescription": "Florida voters prepare for the August 18 primary election to decide party nominees for Governor and U.S. Senate special election.",
    "tags": [
      "Ron DeSantis",
      "Florida",
      "Elections",
      "U.S. Senate",
      "Gubernatorial Primary",
      "Ashley Moody",
      "Politics"
    ],
    "tweet": "Florida voters head to the polls on August 18 for statewide primaries to select party nominees for the governors office and the open U.S. Senate special election.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Elections & Political Desk",
      "bio": "State electoral politics, gubernatorial transitions and primary campaign reporting"
    },
    "sources": [
      {
        "label": "Florida Division of Elections",
        "url": "https://dos.fl.gov/elections/for-voters/election-dates/2026-primary-election-overview"
      },
      {
        "label": "Miami Herald",
        "url": "https://www.miamiherald.com/news/politics-government/state-politics/article291039104.html"
      }
    ],
    "taggedPoliticianIds": [
      "fc437e5a-1d25-4904-959e-88add7928b50"
    ],
    "taggedPoliticians": [
      "Ron DeSantis"
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
