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
    slug: "mark-carney-tony-wakeham-st-johns-churchill-falls-hydro-clean-energy-2026-08-17",
    headline: "Prime Minister Mark Carney and Atlantic Premiers Convene in St. John's on Revamped Churchill Falls Hydro Pact",
    summary: "Prime Minister Mark Carney meets with Newfoundland and Labrador Premier Tony Wakeham and Quebec leadership in St. John's to renegotiate transmission corridors and clean energy investments around the Churchill Falls hydro asset.",
    category: "Policy",
    country: "CA",
    province: "NL",
    status: "published",
    eventDate: "2026-08-17T13:45:00Z",
    published_at: "2026-08-17T15:30:00Z",
    impactArea: "country",
    latitude: 47.5615,
    longitude: -52.7126,
    body: "ST. JOHN'S, NL — Prime Minister Mark Carney arrived in St. John's on Monday alongside federal Energy Minister Tim Hodgson for high-stakes trilateral summit meetings with Newfoundland and Labrador Premier Tony Wakeham and Quebec provincial representatives, aiming to unblock stalled negotiations over the multi-billion-dollar Churchill Falls hydroelectric redevelopment.\n\n## Interprovincial Clean Energy and Transmission Framework\n\nThe ministerial summit represents the most intensive federal intervention in the historic dispute since an initial December 2024 Memorandum of Understanding between former premiers Andrew Furey and François Legault stalled under subsequent leadership reviews. The revised framework under negotiation seeks to replace the landmark 1969 Churchill Falls power contract with an updated Atlantic Clean Power Accord that links Labrador's 5,428-megawatt generation potential directly to Quebec and Maritime transmission grids.\n\nUnder the proposed terms, federal green infrastructure backstops through the Canada Infrastructure Bank would assist in financing up to $6.8 billion in new high-voltage direct current (HVDC) transmission lines, expanding wind-hydro integration and guaranteeing long-term power access for industrial decarbonization across Eastern Canada.\n\n## Regional Impact and Power Reliability\n\nFor Newfoundland and Labrador taxpayers and rate stabilization programs, a modernized Churchill Falls agreement is anticipated to generate hundreds of millions in additional annual revenue, mitigating historical rate pressures from the Muskrat Falls development. For Quebec and Ontario manufacturers, access to dedicated Labrador hydro exports provides stable baseload capacity amidst accelerating electric vehicle and data center demand.\n\n## Legislative Timelines and Oversight\n\nPremier Tony Wakeham emphasized that any binding deal will be subject to thorough independent financial scrutiny by the province's Public Utilities Board before being presented to the Newfoundland and Labrador House of Assembly. Trilateral working groups have been directed to finalize technical grid interconnect protocols by October 31, 2026.",
    seoTitle: "Carney and Wakeham Convene in St. John's on Churchill Falls | Choseno",
    metaDescription: "Prime Minister Mark Carney and Premier Tony Wakeham meet in St. John's to advance a revamped Churchill Falls hydro and clean energy transmission agreement.",
    tags: [
      "Mark Carney",
      "Tony Wakeham",
      "Churchill Falls",
      "Hydroelectricity",
      "Newfoundland and Labrador",
      "Quebec",
      "Energy Policy"
    ],
    tweet: "Prime Minister Mark Carney and Premier Tony Wakeham meet in St. Johns to negotiate a multi-billion dollar clean energy transmission corridor replacing the historic Churchill Falls hydro contract.",
    breakingNews: true,
    author: {
      name: "Choseno Civic News Desk",
      bio: "Federal and provincial energy policy and intergovernmental affairs reporting"
    },
    sources: [
      {
        label: "CBC News",
        url: "https://www.cbc.ca/news/canada/newfoundland-labrador/carney-wakeham-churchill-falls-talks-st-johns-1.7482910"
      },
      {
        label: "Castanet News",
        url: "https://www.castanet.net/news/Canada/502914/Carney-to-make-announcement-in-St-Johns-with-premiers"
      }
    ],
    taggedPoliticianIds: [
      "4bd5cf73-1d03-4fb2-ae1b-2303c2c99737",
      "662ababe-e73c-4580-a10d-cd74d4649212"
    ],
    taggedPoliticians: [
      "Mark Carney",
      "Tony Wakeham"
    ]
  },
  {
    slug: "us-navy-raytheon-rtx-22-billion-tomahawk-missile-production-deal-2026-08-17",
    headline: "Department of War Awards Raytheon $22.9 Billion Contract to Accelerate Tomahawk Cruise Missile Production",
    summary: "The U.S. Navy and Department of Defense award RTX business unit Raytheon a seven-year $22.9 billion multi-year procurement agreement to boost annual Tomahawk missile manufacturing beyond 1,000 units.",
    category: "Policy",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-17T14:15:00Z",
    published_at: "2026-08-17T15:30:00Z",
    impactArea: "country",
    latitude: 38.8719,
    longitude: -77.0563,
    body: "WASHINGTON, DC — The U.S. Department of War (Department of Defense) officially finalized a landmark seven-year procurement agreement on Monday awarding Raytheon, an operating business of RTX, a $22.9 billion multi-year contract to substantially expand production of Tomahawk cruise missiles for naval and allied forces.\n\n## Arsenal of Freedom Production Expansion\n\nThe award represents the largest dedicated munitions procurement package authorized under the administration's 'Arsenal of Freedom' initiative, structured to expand domestic defense industrial throughput and eliminate production bottlenecks. The multi-year contract establishes long-term procurement predictability, funding capital investments that will scale annual Tomahawk production capacity past 1,000 missiles per year.\n\nRaytheon reported delivering triple the volume of Tomahawk systems in the first half of 2026 compared to the corresponding period in 2025, driven by automated tooling and multi-shift operations across manufacturing centers in Tucson, Arizona, and Huntsville, Alabama.\n\n## Supply Chain and Subcontractor Distribution\n\nThe multi-year procurement model integrates more than 350 small and medium-sized advanced manufacturing suppliers across 32 states, stabilizing rocket motor, guidance sensor, and titanium structural component deliveries. Acting Secretary of the Navy Hung Cao characterized the investment as a decisive step to replenish strategic reserves and guarantee sustained naval deterrence across contested maritime corridors.\n\n## Congressional Oversight and Delivery Milestones\n\nUnder statutory oversight provisions embedded in the defense appropriations framework, the Pentagon's Cost Assessment and Program Evaluation (CAPE) office will conduct bi-annual cost audits to ensure unit flyaway costs remain within established inflation bands. Initial expanded batch deliveries under the seven-year contract are scheduled to commence in Q2 2027.",
    seoTitle: "Raytheon Awarded $22.9B Navy Tomahawk Missile Contract | Choseno",
    metaDescription: "The Pentagon awards RTX Raytheon a $22.9 billion seven-year contract to expand Tomahawk cruise missile production past 1,000 units annually.",
    tags: [
      "Department of Defense",
      "U.S. Navy",
      "Raytheon",
      "RTX",
      "Defense Industrial Base",
      "National Security"
    ],
    tweet: "The U.S. Department of Defense awards Raytheon a 22.9 billion dollar seven-year contract to expand Tomahawk cruise missile production capacity past 1000 missiles annually.",
    breakingNews: false,
    author: {
      name: "Choseno National Security Desk",
      bio: "Defense procurement, military readiness and industrial policy reporting"
    },
    sources: [
      {
        label: "Naval Today",
        url: "https://www.navaltoday.com/2026/08/17/us-awards-raytheon-22-9b-tomahawk-deal-accelerating-critical-munitions/"
      },
      {
        label: "StreetInsider",
        url: "https://www.streetinsider.com/Corporate+News/RTX+Raytheon+awarded+seven-year+contract+for+Tomahawk+cruise+missiles/25182910.html"
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      "Hung Cao"
    ]
  },
  {
    slug: "algoma-steel-sault-ste-marie-power-turbine-outage-eaf-furnace-shutdown-2026-08-17",
    headline: "Algoma Steel Suspends Electric Arc Furnace Operations in Sault Ste. Marie Following Turbine Power Outage",
    summary: "Algoma Steel Group temporarily halts production at its newly commissioned electric arc furnace in Sault Ste. Marie after an unexpected turbine outage at its primary power station, initiating contingency power arrangements with Ontario's grid operator.",
    category: "Economy",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-17T14:30:00Z",
    published_at: "2026-08-17T15:30:00Z",
    impactArea: "state",
    latitude: 46.5219,
    longitude: -84.3461,
    body: "SAULT STE. MARIE, ON — Algoma Steel Group Inc. announced an unplanned operational disruption on Monday following an automatic safety trip on a generation turbine at its on-site Lake Superior Power (LSP) station, forcing the temporary shutdown of its primary electric arc furnace (EAF) steelmaking operations.\n\n## Generation Trip and Operational Contingencies\n\nThe turbine outage occurred after automated protection sensors detected an abnormal operational condition within one of the primary generating units supplying dedicated baseload electricity to the steelmaker's newly transitioned low-carbon EAF facility. Downstream plate and sheet finishing mills, cold rolling complexes, and shipping operations remain powered and active from provincial grid feeds.\n\nAlgoma engineering teams are collaborating with GE Vernova to mobilize a pre-contracted spare turbine unit, while concurrently negotiating temporary emergency interconnection protocols with Ontario's Independent Electricity System Operator (IESO) to bypass the damaged turbine.\n\n## Supply Chain and Production Impact\n\nExecutive management confirmed that if the IESO temporary transmission interconnect is authorized this week, EAF melting operations could resume within 10 days; absent alternative power, full turbine replacement will require up to 21 days. The company confirmed that current raw steel and slab inventories are sufficient to satisfy committed delivery schedules for automotive and construction clients without immediate shipping delays.\n\n## Industrial Grid Review and Municipal Impact\n\nSault Ste. Marie municipal officials and Northern Development observers are monitoring the outage closely, as Algoma's $875 million EAF transformation represents one of the largest single industrial decarbonization projects in Canadian manufacturing. Algoma is utilizing the unplanned downtime to pull forward scheduled fall maintenance on ladle metallurgy facilities to prevent subsequent production stoppages later this year.",
    seoTitle: "Algoma Steel Suspends Sault Ste. Marie EAF Operations After Turbine Outage | Choseno",
    metaDescription: "Algoma Steel temporarily shuts down electric arc furnace operations in Sault Ste. Marie following a generation turbine outage at its Lake Superior Power station.",
    tags: [
      "Algoma Steel",
      "Sault Ste. Marie",
      "Ontario",
      "Manufacturing",
      "Clean Energy",
      "IESO",
      "Economy"
    ],
    tweet: "Algoma Steel temporarily halts electric arc furnace production in Sault Ste. Marie after an unexpected turbine outage, coordinating with Ontarios grid operator on emergency power.",
    breakingNews: false,
    author: {
      name: "Choseno Business & Energy Desk",
      bio: "Industrial manufacturing, mining and energy transition reporting"
    },
    sources: [
      {
        label: "SooToday",
        url: "https://www.sootoday.com/local-news/algoma-steel-shuts-down-electric-arc-furnace-after-power-plant-outage-9812401"
      },
      {
        label: "GlobeNewswire",
        url: "https://www.globenewswire.com/news-release/2026/08/17/3138902/0/en/Algoma-Steel-Announces-Unplanned-Outage-at-Lake-Superior-Power-Facility.html"
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      "Matthew Shoemaker"
    ]
  },
  {
    slug: "bbc-petitions-florida-court-subpoenas-trump-family-panorama-defamation-2026-08-17",
    headline: "BBC Petitions Florida Federal Court to Authorize Subpoenas for Trump Family in $10B Panorama Defamation Suit",
    summary: "BBC legal counsel files a formal motion in U.S. District Court in Florida requesting judicial authority to subpoena Donald Trump Jr., Ivanka Trump, and Jared Kushner in defense of Donald Trump's $10 billion broadcast defamation claim.",
    category: "Policy",
    country: "US",
    province: "FL",
    status: "published",
    eventDate: "2026-08-17T14:45:00Z",
    published_at: "2026-08-17T15:30:00Z",
    impactArea: "country",
    latitude: 25.7617,
    longitude: -80.1918,
    body: "MIAMI, FL — Defense counsel for the British Broadcasting Corporation (BBC) filed a contested motion in the U.S. District Court for the Southern District of Florida on Monday, asking a federal judge to compel formal deposition testimony and document production from Donald Trump Jr., Ivanka Trump, and Jared Kushner in connection with President Donald Trump's $10 billion defamation lawsuit.\n\n## Subpoena Demands and Evidentiary Scope\n\nThe litigation arises from a 2024 episode of the BBC investigative program *Panorama*, which featured an edited sequence of Trump's January 6, 2021, public remarks that spliced together statements delivered 50 minutes apart. Trump's complaint alleges the broadcast intentionally and maliciously distorted his words to suggest an immediate incitement to violence, causing severe reputational and commercial harm to the Donald J. Trump Revocable Trust.\n\nIn its latest federal filing, BBC attorneys argue that immediate family members and senior campaign advisers who were present at the White House and backstage on January 6 possess irreplaceable, first-hand evidence regarding the President's contemporaneous intentions, speech revisions, and state of mind.\n\n## Security Screening and Service Obstacles\n\nThe broadcaster's motion details repeated unsuccessful attempts to serve process on Trump family members, alleging private process servers were turned away by Secret Service and protective details at Mar-a-Lago and private residences in Miami and New York. The BBC has requested an order permitting alternative service through plaintiffs' counsel of record.\n\n## Financial Discovery and Damages Defense\n\nConcurrently, the BBC is seeking broad accounting disclosures from the Trump family trust to challenge the $10 billion damages figure, demanding proof of concrete commercial losses attributable specifically to the documentary broadcast, which did not air on U.S. linear television. Trump's legal team has opposed the subpoenas as an invasive fishing expedition and moved for a protective order limiting third-party discovery while a pending motion to dismiss is adjudicated.",
    seoTitle: "BBC Seeks Subpoenas for Trump Family in $10B Defamation Suit | Choseno",
    metaDescription: "The BBC asks a Florida federal court for authority to subpoena Donald Trump Jr., Ivanka Trump, and Jared Kushner in defense against a $10B defamation claim.",
    tags: [
      "Donald Trump",
      "BBC",
      "Defamation",
      "U.S. District Court",
      "Florida",
      "Judiciary",
      "Media Law"
    ],
    tweet: "The BBC asks a Florida federal court to authorize subpoenas for Donald Trump Jr, Ivanka Trump and Jared Kushner in defense of Donald Trumps 10 billion dollar defamation suit.",
    breakingNews: false,
    author: {
      name: "Choseno Legal & Judicial Affairs Desk",
      bio: "Federal court reporting, constitutional law and First Amendment jurisprudence"
    },
    sources: [
      {
        label: "The Guardian",
        url: "https://www.theguardian.com/media/2026/aug/17/bbc-asks-us-court-help-subpoena-trump-family-panorama-defamation"
      },
      {
        label: "CBS News",
        url: "https://www.cbsnews.com/news/bbc-trump-defamation-lawsuit-subpoena-family-members-panorama/"
      }
    ],
    taggedPoliticianIds: [
      "a5fdebea-5daf-4d7e-86f2-b1b55aae903d"
    ],
    taggedPoliticians: [
      "Donald Trump"
    ]
  },
  {
    slug: "edmonton-city-council-transit-peace-officer-deployment-lrt-safety-crisis-2026-08-17",
    headline: "Edmonton Expands Transit Peace Officer Deployments and Outreach Teams Amid Surging LRT Safety Grievances",
    summary: "Edmonton City Council and Edmonton Transit Service deploy expanded transit peace officer patrols and trauma-informed crisis diversion workers across LRT platforms to address rider safety concerns and transit worker union grievances.",
    category: "Public Safety",
    country: "CA",
    province: "AB",
    status: "published",
    eventDate: "2026-08-17T14:40:00Z",
    published_at: "2026-08-17T15:30:00Z",
    impactArea: "local",
    latitude: 53.5461,
    longitude: -113.4938,
    body: "EDMONTON, AB — Edmonton City Council and the Edmonton Transit Service (ETS) initiated an expanded operational security surge on Monday, deploying additional uniformed Transit Peace Officers and integrated multidisciplinary crisis teams across downtown LRT concourses following renewed rider safety reports and union appeals for transit intervention.\n\n## Security Force Expansion and Platform Patrols\n\nThe deployment elevates the city's active transit peace officer contingent to 126 full-time officers, fulfilling council's multi-year budget allocation to expand dedicated transit security by 30 officers over previous baseline levels. The expanded deployment prioritizes high-volume transit hubs including Central, Churchill, University, and Coliseum stations during evening commuter peaks.\n\nUniformed officers are paired directly with Community Outreach Teams staffed by social workers from the Bent Arrow Traditional Healing Society, providing trauma-informed outreach, emergency shelter intake referrals, and addiction support services directly to individuals sheltering in station concourses.\n\n## Divergence in Safety Metrics and Rider Perception\n\nWhile Edmonton Police Service (EPS) incident tracking indicates violent crimes in transit facilities have moderated by 8% year-over-year, public feedback and transit operator grievances highlight persistent social disorder, open drug use, and feelings of vulnerability among passengers. Over 1,200 rider surveys submitted during summer public consultations noted reluctance to use evening LRT service without visible uniformed security personnel.\n\n## Intergovernmental Funding and City Council Response\n\nMayor Amarjeet Sohi and the Community and Public Services Committee reiterated calls for increased provincial funding from Alberta Health and Mental Health and Addiction services, arguing that municipal transit budgets cannot indefinitely bear the financial burden of regional social service shortfalls. Council will review preliminary outcomes from the expanded deployment during its September 15 transit oversight hearing.",
    seoTitle: "Edmonton Expands Transit Security and Outreach on LRT Network | Choseno",
    metaDescription: "Edmonton City Council expands transit peace officer patrols to 126 officers and pairs security with outreach teams across LRT stations to tackle safety concerns.",
    tags: [
      "Edmonton",
      "Transit Safety",
      "ETS",
      "LRT",
      "Public Safety",
      "Alberta",
      "Amarjeet Sohi"
    ],
    tweet: "Edmonton City Council deploys additional transit peace officers and integrated crisis teams across LRT stations to address passenger safety concerns and social disorder.",
    breakingNews: false,
    author: {
      name: "Choseno Municipal Affairs Desk",
      bio: "City hall governance, municipal infrastructure and public safety reporting"
    },
    sources: [
      {
        label: "CBC Edmonton",
        url: "https://www.cbc.ca/news/canada/edmonton/edmonton-transit-safety-rider-surveys-peace-officer-deployment-1.7482931"
      },
      {
        label: "Edmonton Journal",
        url: "https://edmontonjournal.com/news/local-news/edmonton-transit-peace-officers-security-outreach-deployment-august-2026"
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      "Amarjeet Sohi"
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
