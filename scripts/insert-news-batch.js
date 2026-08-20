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
      const query = `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,politician_slug&role=eq.politician&or=(full_name.ilike.*${encodeURIComponent(name)}*,politician_slug.ilike.*${encodeURIComponent(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}*)&limit=1`;
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

// 2. Article payload to ingest (Dynamic Lookback Batch: 20 Fresh Civic & Political Stories)
const articles = [
  {
    "slug": "carney-calls-on-premiers-to-end-provincial-us-alcohol-bans-2026-08-20",
    "headline": "Prime Minister Carney Requests Provinces Lift Bans on American Alcohol as Trade Accord Finalizes",
    "summary": "Prime Minister Mark Carney asks provincial premiers to restore U.S. alcohol products to retail shelves as part of bilateral trade terms averting steep cross-border tariffs.",
    "category": "Trade",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T00:00:00Z",
    "published_at": "2026-08-20T00:30:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Prime Minister Mark Carney formally requested Wednesday evening that Canadian provincial governments immediately end their retaliatory restrictions on American wine, beer, and spirits as negotiators in Ottawa and Washington complete the legal drafting of a comprehensive trade memorandum.\n\n## Bilateral Trade Framework and Liquor Board Directives\n\nFollowing a direct high-level conference call between Prime Minister Carney and U.S. President Donald Trump, the White House agreed to pause punitive 50 percent tariffs on $20 billion worth of Canadian industrial and consumer goods. In reciprocal discussions with Canada's 10 provincial premiers, Carney highlighted that the removal of provincial procurement and shelf-space boycotts—originally instituted across eight provinces in response to prior U.S. tariff actions—is a central condition of the draft cross-border pact.\n\nProvincial liquor control boards, including Ontario's LCBO, British Columbia's LDB, and Quebec's SAQ, had pulled thousands of American product lines earlier this year, affecting an estimated $1.2 billion in annual U.S. beverage exports.\n\n## Provincial Reactions and Dairy Protections\n\nNova Scotia Premier Tim Houston and Saskatchewan Premier Scott Moe confirmed receiving the prime minister's briefing, noting that while the trade landscape remains volatile, federal negotiators succeeded in maintaining core protections for Canada's supply-managed dairy and poultry sectors without introducing new quota surcharges.\n\nRetail associations and hospitality industry groups welcomed the directive, projecting that restocking shelves will lower operating costs for restaurants and restore normal supply chains ahead of the fall retail season.\n\n## Implementation Timelines and Regulatory Filings\n\nProvincial cabinet orders and liquor board directives are expected to take effect over the next 72 hours as bilateral legal teams review technical annexes before the final signing deadline scheduled for Friday, August 21, 2026.",
    "seoTitle": "Carney Requests Provinces End US Alcohol Bans | Choseno",
    "metaDescription": "Prime Minister Mark Carney asks Canadian premiers to lift bans on US alcohol as Ottawa and Washington finalize a draft trade accord to avert tariffs.",
    "tags": ["Mark Carney", "Tim Houston", "Trade", "Tariffs", "Economy", "CUSMA", "Alcohol"],
    "tweet": "Prime Minister Mark Carney asks Canadian provinces to lift bans on American alcohol products as Ottawa and Washington finalize a draft trade deal to avert tariffs.",
    "breakingNews": true,
    "author": { "name": "Choseno Trade & Foreign Affairs Desk", "bio": "Federal trade diplomacy, international agreements, and cross-border commerce" },
    "sources": [
      { "label": "CBC News", "url": "https://www.cbc.ca/news/politics/carney-provinces-us-alcohol-trade-deal-2026" },
      { "label": "paNOW", "url": "https://panow.com/2026/08/19/carney-briefs-premiers-on-us-trade-agreement/" }
    ],
    "taggedPoliticianIds": ["4bd5cf73-1d03-4fb2-ae1b-2303c2c99737"],
    "taggedPoliticians": ["Mark Carney"]
  },
  {
    "slug": "white-house-imposes-economic-sanctions-enforcement-on-iranian-trade-2026-08-20",
    "headline": "White House Tightens Secondary Economic Sanctions Targeting Global Maritime and Energy Ties to Tehran",
    "summary": "President Donald Trump announces aggressive secondary sanctions enforcement against foreign entities and financial networks facilitating Iranian energy exports and maritime commerce.",
    "category": "Foreign Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T00:15:00Z",
    "published_at": "2026-08-20T00:45:00Z",
    "impactArea": "country",
    "latitude": 38.8977,
    "longitude": -77.0365,
    "body": "WASHINGTON, DC — President Donald Trump announced late Wednesday what administration officials described as a sweeping economic enforcement operation aimed at cutting off foreign commerce, illicit banking channels, and crude oil transshipments connected to Iran.\n\n## Sanctions Framework and Executive Authority\n\nThe presidential directive leverages authorities under the International Emergency Economic Powers Act (IEEPA) and Treasury Department Office of Foreign Assets Control (OFAC) regulations to penalize international shipping firms, trading houses, and regional financial intermediaries. The enforcement campaign specifically mandates severe secondary penalties, including expulsion from the U.S. dollar clearing system, for foreign banks facilitating transactions for Iranian state-owned petroleum entities.\n\nThe announcement comes amid heightened maritime security alerts near the Strait of Hormuz and reports of regional defense escalations involving advanced drone technology.\n\n## Diplomatic and Energy Market Consequences\n\nGlobal energy markets experienced immediate price volatility, with Brent crude futures advancing 2.4 percent to $84.10 per barrel during Asian trading hours. In Tehran, Iranian President Masoud Pezeshkian reiterated that while diplomatic negotiations remain an avenue to end the regional crisis, economic blockades will not alter state defense policies.\n\nCongressional foreign affairs leaders signaled bipartisan support for rigorous oversight, while multinational energy conglomerates began auditing shipping manifests across Persian Gulf ports to ensure compliance with the updated Treasury guidance.\n\n## Federal Agency Directives and Reporting Milestones\n\nThe U.S. Treasury Department and the State Department will issue formal compliance notices to international port operators and maritime insurance underwriters within five business days.",
    "seoTitle": "White House Tightens Secondary Economic Sanctions on Iran | Choseno",
    "metaDescription": "President Donald Trump announces enhanced secondary sanctions targeting foreign financial networks and shipping firms conducting commerce with Iran.",
    "tags": ["Donald Trump", "Foreign Policy", "Economy", "Sanctions", "Energy", "Treasury"],
    "tweet": "The White House expands secondary sanctions enforcement against foreign banks and shipping firms conducting commerce with Iran to halt illicit energy exports.",
    "breakingNews": true,
    "author": { "name": "Choseno National Security Desk", "bio": "White House foreign policy, international sanctions, and geopolitical analysis" },
    "sources": [
      { "label": "Al Jazeera", "url": "https://www.aljazeera.com/news/2026/8/20/trump-announces-economic-operation-iran-sanctions" },
      { "label": "The Wall Street Journal", "url": "https://www.wsj.com/world/middle-east/trump-plan-iran-economy-dubai-trade-2026" }
    ],
    "taggedPoliticianIds": ["a5fdebea-5daf-4d7e-86f2-b1b55aae903d"],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "kennedy-center-board-delays-signage-modifications-pending-federal-ruling-2026-08-20",
    "headline": "Kennedy Center Agrees in Court to Pause Exterior Renaming Modifications Until September 8",
    "summary": "Federal court filings confirm the Kennedy Center board of trustees will not install exterior plaza signage bearing Donald Trump's name prior to a September hearing.",
    "category": "Judiciary",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T00:30:00Z",
    "published_at": "2026-08-20T01:00:00Z",
    "impactArea": "country",
    "latitude": 38.8957,
    "longitude": -77.0563,
    "body": "WASHINGTON, DC — Legal counsel for the John F. Kennedy Center for the Performing Arts confirmed in U.S. District Court Wednesday that the institution will maintain protective tarps and halt any physical efforts to affix President Donald Trump's name to the building's exterior before at least September 8, 2026.\n\n## Statutory Authority and Judicial Restraints\n\nThe formal stipulation filed in the District of Columbia resolves an emergency injunction request brought by arts advocates and Democratic lawmakers, including Trustee Representative Joyce Beatty. The legal dispute centers on whether the center's board of trustees exceeded its statutory powers under the John F. Kennedy Center Act (20 U.S.C. § 76h) by voting to designate exterior grounds as 'President Donald J. Trump Plaza' in recognition of capital renovation donations.\n\nPlaintiffs argue that only an act of the United States Congress can alter or append official naming designations to the national cultural monument.\n\n## Board Debate and Civic Accountability\n\nThe temporary standstill keeps large protective tarps over newly altered facade letters that had triggered nationwide protests and heated debate within the performing arts community. Legal observers noted that the agreement prevents potential architectural damage or further contempt motions while the court reviews underlying administrative law questions.\n\nCongressional oversight committees have requested full meeting minutes and donor disclosure logs from the board's executive committee to evaluate whether public funding covenants were complied with during the renovation authorization.\n\n## Scheduled Proceedings and Decision Timeline\n\nU.S. District Court Judge Richard Leon ordered both parties to submit cross-motions for summary judgment by August 28, with oral arguments set for September 8, 2026.",
    "seoTitle": "Kennedy Center Halts Exterior Signage Changes Until Sept 8 | Choseno",
    "metaDescription": "The Kennedy Center agrees in federal court to pause exterior renaming alterations and leave protective tarps in place until a September 8 hearing.",
    "tags": ["Kennedy Center", "Judiciary", "Donald Trump", "Congress", "Accountability", "Washington DC"],
    "tweet": "The Kennedy Center agrees in federal court to halt exterior plaza renaming work and keep protective tarps in place until a scheduled September 8 hearing.",
    "breakingNews": false,
    "author": { "name": "Choseno Legal & Judicial Affairs Desk", "bio": "Federal courts, constitutional law, and statutory oversight" },
    "sources": [
      { "label": "The Washington Post", "url": "https://www.washingtonpost.com/politics/2026/08/19/kennedy-center-tarp-indefinitely-court-filing/" },
      { "label": "AP News", "url": "https://apnews.com/article/kennedy-center-trump-name-court-hearing-september-2026" }
    ],
    "taggedPoliticianIds": ["a5fdebea-5daf-4d7e-86f2-b1b55aae903d"],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "senate-democrats-demand-oversight-of-foreign-health-data-mandates-2026-08-20",
    "headline": "Senate Democratic Leadership Questions Executive Mandates Requiring Foreign Health Data for Humanitarian Aid",
    "summary": "Senate Minority Leader Chuck Schumer and senior committee members challenge administration requirements compelling foreign aid recipients to share biometric and medical records.",
    "category": "Accountability",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-19T23:30:00Z",
    "published_at": "2026-08-20T00:15:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — Senate Minority Leader Chuck Schumer and seven ranking members of Senate foreign relations and health panels dispatched a formal oversight letter Wednesday demanding the immediate revocation of new administrative conditions tying U.S. humanitarian relief to foreign citizen health data collection.\n\n## Oversight Inquiry and Foreign Assistance Policy\n\nThe inquiry, addressed to Secretary of State Marco Rubio and United States Agency for International Development (USAID) leadership, challenges a newly instituted policy requiring non-governmental relief partners to transfer anonymized patient diagnostic registries and biometric data to federal databases as a prerequisite for global health grants.\n\nLawmakers cited statutory privacy protections under the Foreign Assistance Act and international humanitarian conventions, arguing that the surveillance mandates violate basic medical ethics and threaten to deter vulnerable populations in conflict zones from seeking emergency healthcare and infectious disease treatment.\n\n## Public Health and Diplomatic Concerns\n\nGlobal health non-profits and clinical organizations warned that conditioning emergency treatments on data sharing undermines decades of trust in American humanitarian assistance. Public health researchers testified before congressional staff that similar administrative burdens during previous epidemics caused clinic attendance drops of up to 35 percent.\n\nMinority Leader Schumer affirmed that the caucus will leverage upcoming appropriations debates to insert explicit statutory bans against foreign medical data collection riders.\n\n## Committee Deadlines and Agency Response\n\nThe State Department and USAID were given until September 2, 2026, to provide complete legal justifications, privacy impact assessments, and records of communications with international aid partners.",
    "seoTitle": "Schumer Challenges Foreign Health Data Mandates for Aid | Choseno",
    "metaDescription": "Senate Democratic Leader Chuck Schumer challenges new administration requirements linking foreign humanitarian aid to mandatory medical data sharing.",
    "tags": ["Chuck Schumer", "Senate", "Humanitarian Aid", "State Department", "Healthcare", "Privacy"],
    "tweet": "Senate Democratic Leader Chuck Schumer and committee leaders challenge federal mandates requiring foreign medical data sharing as a condition for humanitarian aid.",
    "breakingNews": false,
    "author": { "name": "Choseno Congressional Affairs Desk", "bio": "Legislative investigations, Senate committee hearings, and federal oversight" },
    "sources": [
      { "label": "ProPublica", "url": "https://www.propublica.org/article/senators-criticize-trump-administration-foreign-health-data-aid-2026" },
      { "label": "The Hill", "url": "https://thehill.com/homenews/senate/schumer-rubio-humanitarian-aid-health-data-2026" }
    ],
    "taggedPoliticianIds": ["b0e16d47-d85a-4702-8e73-7187c8c2dd2d"],
    "taggedPoliticians": ["Chuck Schumer"]
  },
  {
    "slug": "montana-court-upholds-legislative-ballot-access-amid-term-limit-dispute-2026-08-20",
    "headline": "Montana District Court Rebuffs Attorney General and Restores Two Lawmakers to General Election Ballot",
    "summary": "A Montana state district judge invalidates an attorney general opinion, allowing two incumbent Republican lawmakers to remain on the November ballot ahead of certification.",
    "category": "Elections",
    "country": "US",
    "province": "MT",
    "status": "published",
    "eventDate": "2026-08-19T23:45:00Z",
    "published_at": "2026-08-20T00:30:00Z",
    "impactArea": "province",
    "latitude": 46.5891,
    "longitude": -112.0391,
    "body": "HELENA, MT — In a high-stakes constitutional ruling issued late Wednesday, Lewis and Clark County District Court Judge Michael McMahon struck down an official legal interpretation by Montana Attorney General Austin Knudsen, ordering state election officials to certify two legislative candidates for the November general election.\n\n## Constitutional Interpretation of Term Limits\n\nThe dispute centered on Article IV, Section 8 of the Montana Constitution, which limits state representatives and senators to eight years in any 16-year window. Attorney General Knudsen had issued a binding legal opinion declaring that partial legislative terms served due to midterm appointments counted toward the full eight-year cap, thereby disqualifying Representatives Llew Jones and Steve Fitzpatrick.\n\nJudge McMahon ruled that the Attorney General's interpretation contradicted established statutory precedent and historical secretary of state administrative guidelines, holding that voters' right to ballot access must prevail absent unambiguous constitutional disqualification.\n\n## Impact on General Election Certification\n\nThe decision prevents a major vacancy on legislative ballots across northern and central Montana districts where Jones and Fitzpatrick had already secured their respective party nominations. The Montana Secretary of State’s Elections Division confirmed that candidate listings have been updated in accordance with the court order.\n\nCivic groups and legal analysts noted that the swift ruling provides clarity for county election administrators who face a strict August 20 statutory deadline to finalize and print municipal ballots for overseas and military voters.\n\n## Supreme Court Appeal Proceedings\n\nThe Montana Department of Justice filed an emergency notice of appeal to the Montana Supreme Court, requesting an expedited review before county ballot proofs are dispatched to commercial printers Thursday afternoon.",
    "seoTitle": "Montana Court Overrules Attorney General on Legislative Ballot Access | Choseno",
    "metaDescription": "A Montana district judge invalidates an Attorney General opinion, ensuring two incumbent lawmakers remain on the general election ballot.",
    "tags": ["Montana", "Elections", "Judiciary", "Constitution", "Term Limits", "Ballot Access"],
    "tweet": "A Montana district judge overrules the state Attorney General, restoring two incumbent lawmakers to the November general election ballot ahead of printing deadlines.",
    "breakingNews": false,
    "author": { "name": "Choseno State & Electoral Desk", "bio": "State supreme courts, constitutional law, and election administration" },
    "sources": [
      { "label": "Flathead Beacon", "url": "https://flatheadbeacon.com/2026/08/19/montana-judge-ballot-access-term-limits-jones-fitzpatrick/" },
      { "label": "KPAX News", "url": "https://www.kpax.com/news/montana-politics/ruling-restores-candidates-to-ballot-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "pennsylvania-governor-shapiro-enacts-guardrails-on-hyperscale-ai-data-centers-2026-08-20",
    "headline": "Governor Shapiro Issues Executive Order Mandating Grid and Water Protections for AI Data Center Hubs",
    "summary": "Pennsylvania Governor Josh Shapiro establishes stringent utility, water recycling, and community impact requirements for hyperscale data center developments exceeding 50 MW.",
    "category": "Energy",
    "country": "US",
    "province": "PA",
    "status": "published",
    "eventDate": "2026-08-20T00:00:00Z",
    "published_at": "2026-08-20T00:45:00Z",
    "impactArea": "province",
    "latitude": 40.2732,
    "longitude": -76.8867,
    "body": "HARRISBURG, PA — Pennsylvania Governor Josh Shapiro signed an executive order late Wednesday establishing comprehensive environmental and utility guardrails for all commercial and hyperscale artificial intelligence data center developments across the commonwealth.\n\n## Regulatory Standards and Grid Resiliency Rules\n\nUnder Executive Order 2026-04, developers proposing facilities with power demands greater than 50 megawatts must submit certified grid-impact assessments to the Pennsylvania Public Utility Commission (PUC) and PJM Interconnection. The order mandates that data center operators contract for dedicated zero-carbon generation or battery storage capacity to cover peak demand spikes, ensuring local residential and commercial ratepayers are shielded from electricity price surges.\n\nAdditionally, facilities must incorporate closed-loop water cooling systems and prove that municipal aquifers will not experience depletion during summer peak loads.\n\n## Community Impact and Municipal Tax Protections\n\nThe executive action follows growing pushback from township supervisors in Lancaster, Lehigh, and Berks counties, where rapid data center expansions have strained local water tables and electric substations. The order establishes a Host Community Benefit Fund requiring developers to contribute 0.75 percent of total capital expenditure toward local emergency services and electrical distribution infrastructure.\n\nLabor organizations, including the Pennsylvania Building and Construction Trades Council, endorsed the framework, noting it couples rigorous environmental safeguards with prevailing wage requirements on all construction sites.\n\n## Administrative Review and Implementation Milestones\n\nThe Department of Environmental Protection and the PUC have 45 days to publish standardized permitting templates and open public comment dockets for pending regional development applications.",
    "seoTitle": "Governor Shapiro Enacts AI Data Center Grid Guardrails | Choseno",
    "metaDescription": "Pennsylvania Governor Josh Shapiro signs an executive order requiring utility and water protections for hyperscale AI data centers exceeding 50 MW.",
    "tags": ["Josh Shapiro", "Pennsylvania", "Energy", "AI", "Technology", "Infrastructure", "Environment"],
    "tweet": "Pennsylvania Governor Josh Shapiro issues an executive order establishing strict grid and water safeguards for hyperscale AI data centers exceeding 50 megawatts.",
    "breakingNews": false,
    "author": { "name": "Choseno State Energy & Infrastructure Desk", "bio": "State executive policy, power grid resilience, and technology regulation" },
    "sources": [
      { "label": "Pennsylvania Office of the Governor", "url": "https://www.governor.pa.gov/newsroom/executive-order-ai-data-center-guardrails-2026" },
      { "label": "Spotlight PA", "url": "https://www.spotlightpa.org/news/2026/08/shapiro-data-center-power-water-executive-order/" }
    ],
    "taggedPoliticianIds": ["b79d61e5-8476-45f0-9eed-a7d6304f6eac"],
    "taggedPoliticians": ["Josh Shapiro"]
  },
  {
    "slug": "edmonton-city-council-approves-2-5m-fire-station-retrofit-reallocation-2026-08-20",
    "headline": "Edmonton City Council Reallocates $2.5M in Capital Funds to Accelerate Core Fire Station Retrofit",
    "summary": "Edmonton City Council votes 11–2 to redirect $2.5 million toward modernizing the Wîhkwêntôwin Fire Station, prioritizing emergency response coverage in high-density neighborhoods.",
    "category": "Municipal",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-19T23:30:00Z",
    "published_at": "2026-08-20T00:15:00Z",
    "impactArea": "city",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "body": "EDMONTON, AB — Edmonton City Council approved an 11–2 motion Wednesday evening to reallocate $2.5 million from delayed municipal facility renewals directly into structural retrofits for the historic Wîhkwêntôwin Fire Station.\n\n## Budget Reallocation and Facility Modernization\n\nThe funding adjustment enables Edmonton Fire Rescue Services (EFRS) to upgrade structural apparatus bays, install specialized diesel exhaust extraction systems, and modernize decontamination zones needed to support heavy tactical ladder trucks. The station, located in one of the city's most densely populated urban cores, has seen emergency response calls increase by 28 percent over the past three years due to rapid infill and residential high-rise construction.\n\nCity administration confirmed that the capital transfer will not require additional municipal borrowing or adjustments to property tax projections.\n\n## Council Debate and Neighborhood Safety Priorities\n\nWard Councillors Anne Stevenson and Michael Janz championed the motion, pointing out that aging municipal infrastructure at the core station had caused equipment maintenance delays and constrained paramedic handoffs during peak operational hours.\n\nCouncillors who opposed the motion cited concerns regarding the postponement of planned community centre upgrades in suburban wards, but the majority concluded that emergency response times must take precedence in capital scheduling.\n\n## Construction Scheduling and Service Continuity\n\nProcurement tenders for the mechanical and structural upgrades will be issued in September 2026, with construction phased over eight months to maintain 24/7 frontline emergency service coverage across downtown Edmonton.",
    "seoTitle": "Edmonton Council Reallocates $2.5M for Fire Station Retrofit | Choseno",
    "metaDescription": "Edmonton City Council approves an 11–2 vote reallocating $2.5M to retrofit the Wîhkwêntôwin Fire Station and boost core emergency response capacity.",
    "tags": ["Edmonton", "City Council", "Infrastructure", "Public Safety", "Alberta", "Emergency Services"],
    "tweet": "Edmonton City Council votes 11 to 2 to reallocate 2.5 million dollars in capital funding to accelerate structural upgrades at the core Wîhkwêntôwin Fire Station.",
    "breakingNews": false,
    "author": { "name": "Choseno Alberta Municipal Desk", "bio": "City council proceedings, municipal budgeting, and local public safety" },
    "sources": [
      { "label": "Taproot Edmonton", "url": "https://edmonton.taproot.news/briefs/2026/08/19/council-approves-fire-station-retrofit-reallocation" },
      { "label": "Edmonton Journal", "url": "https://edmontonjournal.com/news/local-news/city-hall/edmonton-council-funds-wihkwentowin-fire-station-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "california-commission-confirms-four-appellate-justices-unanimous-vote-2026-08-20",
    "headline": "California Judicial Commission Unanimously Confirms Four Appellate Court Justices in San Francisco",
    "summary": "The California Commission on Judicial Appointments confirms four new appellate justices nominated by Governor Gavin Newsom to serve on regional Courts of Appeal.",
    "category": "Judiciary",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-20T00:30:00Z",
    "published_at": "2026-08-20T01:00:00Z",
    "impactArea": "province",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "body": "SAN FRANCISCO, CA — The California Commission on Judicial Appointments voted unanimously Wednesday evening to confirm four judicial nominees to the state's Courts of Appeal, filling key vacancies across the Second, Third, and Fourth Appellate Districts.\n\n## Commission Proceedings and Judicial Panel\n\nThe confirmation panel—chaired by California Supreme Court Chief Justice Patricia Guerrero, alongside Attorney General Rob Bonta and senior presiding appellate justices—conducted formal public hearings evaluating the nominees' constitutional jurisprudence, administrative trial records, and State Bar Commission on Judicial Nominees Evaluation ratings.\n\nThe confirmed jurists include seasoned trial court judges and appellate practitioners nominated by Governor Gavin Newsom to address significant case backlogs in civil and administrative appeals.\n\n## Appellate Caseload and Regional Distribution\n\nThe appointments will reinforce appellate benches handling complex commercial litigation, environmental quality disputes under the California Environmental Quality Act (CEQA), and constitutional appeals stemming from recent state legislative enactments.\n\nLegal advocacy organizations appearing before the commission commended the nominees for their extensive judicial experience and diverse legal backgrounds spanning public defense, municipal law, and commercial litigation.\n\n## Investiture Schedules and Formal Oaths\n\nThe four newly confirmed justices will take their judicial oaths of office during private ceremonies in late August before assuming full active caseload duties for the upcoming fall appellate court term.",
    "seoTitle": "California Confirms Four Appellate Court Justices | Choseno",
    "metaDescription": "The California Commission on Judicial Appointments unanimously confirms four new appellate justices nominated by Governor Gavin Newsom.",
    "tags": ["Gavin Newsom", "California", "Judiciary", "Courts", "Appointments", "Rob Bonta"],
    "tweet": "The California Commission on Judicial Appointments unanimously confirms four new appellate court justices nominated by Governor Gavin Newsom.",
    "breakingNews": false,
    "author": { "name": "Choseno California Judicial Desk", "bio": "State appellate courts, judicial appointments, and California constitutional law" },
    "sources": [
      { "label": "Judicial Branch of California", "url": "https://newsroom.courts.ca.gov/news/commission-confirms-four-appellate-justices-august-2026" },
      { "label": "Daily Journal California", "url": "https://www.dailyjournal.com/articles/382910-commission-confirms-newsom-appellate-nominees-2026" }
    ],
    "taggedPoliticianIds": ["400a040b-ee2a-448e-b2e2-1faeea46b718"],
    "taggedPoliticians": ["Gavin Newsom"]
  },
  {
    "slug": "manitoba-premier-kinew-expands-parkland-regional-hospital-recovery-plan-2026-08-20",
    "headline": "Premier Kinew Outlines $12M Infrastructure Restoration and Clinical Staffing Boost for Parkland Hospital",
    "summary": "Manitoba Premier Wab Kinew details a $12 million rehabilitation plan for Dauphin Regional Health Centre, expanding surgical capacity and restoring flood-damaged facilities.",
    "category": "Healthcare",
    "country": "CA",
    "province": "MB",
    "status": "published",
    "eventDate": "2026-08-19T23:15:00Z",
    "published_at": "2026-08-20T00:00:00Z",
    "impactArea": "province",
    "latitude": 51.1494,
    "longitude": -100.0502,
    "body": "DAUPHIN, MB — Manitoba Premier Wab Kinew visited the Parkland region Wednesday evening to announce $12 million in dedicated provincial capital to fully restore and expand clinical facilities at Dauphin Regional Health Centre following severe summer storm damage.\n\n## Hospital Restoration and Surgical Capacity Expansion\n\nThe funding package provides $7.5 million for flood mitigation, electrical substation hardening, and structural remediation across the facility's basement diagnostic suites, alongside $4.5 million to modernize two primary operating theatres. The upgrades will allow the regional health centre to resume elective surgeries and double local endoscopy procedures, reducing patient travel to Brandon and Winnipeg.\n\nPremier Kinew also confirmed that the province's ongoing healthcare recruitment initiative has added 14 permanent registered nurses and two general surgeons to Prairie Mountain Health since May.\n\n## Rural Health Access and Regional Delivery\n\nMunicipal leaders from Dauphin, Gilbert Plains, and surrounding First Nations communities highlighted that preserving comprehensive 24/7 emergency and surgical capabilities is critical for rural patient stabilization across Western Manitoba.\n\nThe Manitoba Nurses Union commended the investment, noting that modernizing hospital equipment is essential to retaining frontline healthcare workers in rural health authorities.\n\n## Tender Deadlines and Construction Phases\n\nManitoba Health will release construction tenders next week, with structural remediation scheduled to finish by November 2026 and upgraded surgical suites fully operational by February 2027.",
    "seoTitle": "Premier Kinew Details $12M Parkland Hospital Plan | Choseno",
    "metaDescription": "Manitoba Premier Wab Kinew announces $12 million to restore and expand surgical services at Dauphin Regional Health Centre in Parkland.",
    "tags": ["Wab Kinew", "Manitoba", "Healthcare", "Infrastructure", "Rural Health", "Hospitals"],
    "tweet": "Manitoba Premier Wab Kinew announces 12 million dollars to restore and expand surgical capacity at the flood-damaged Dauphin Regional Health Centre.",
    "breakingNews": false,
    "author": { "name": "Choseno Prairie Affairs Desk", "bio": "Manitoba and Saskatchewan governance, rural healthcare, and regional infrastructure" },
    "sources": [
      { "label": "CBC Manitoba", "url": "https://www.cbc.ca/news/canada/manitoba/kinew-dauphin-hospital-restoration-funding-2026" },
      { "label": "Winnipeg Free Press", "url": "https://www.winnipegfreepress.com/breakingnews/2026/08/19/kinew-announces-dauphin-hospital-upgrades" }
    ],
    "taggedPoliticianIds": ["38870346-a851-434d-b894-8362aedc4966"],
    "taggedPoliticians": ["Wab Kinew"]
  },
  {
    "slug": "texas-attorney-general-issues-tax-rate-compliance-warnings-to-110-cities-2026-08-20",
    "headline": "Texas Attorney General Warns Over 110 Municipalities of Statutory Limits on Property Tax Rate Increases",
    "summary": "Texas Attorney General Ken Paxton sends formal compliance notices to over 110 cities and counties, enforcing statutory 3.5 percent voter-approval tax rate limits under SB 2.",
    "category": "Fiscal Policy",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-19T23:30:00Z",
    "published_at": "2026-08-20T00:15:00Z",
    "impactArea": "province",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "body": "AUSTIN, TX — The Office of the Texas Attorney General issued formal legal compliance warning letters Wednesday evening to more than 110 municipal and county governments across Texas, demanding strict adherence to state statutory caps on local property tax revenue growth.\n\n## Statutory Framework and SB 2 Voter-Approval Caps\n\nThe advisory notices instruct city councils and county commissioners that under the Texas Property Tax Reform and Transparency Act (Senate Bill 2), any proposed property tax levy generating more than a 3.5 percent increase in maintenance and operations revenue must receive mandatory voter approval on the November general election ballot.\n\nThe Attorney General's office cautioned local jurisdictions against using creative debt exemptions or certificate of obligation reclassifications to bypass public referendum requirements, warning that non-compliant tax rates will face immediate state injunctions and nullification.\n\n## Municipal Budgets and Public Safety Services\n\nCity managers and municipal league representatives across Dallas, Fort Worth, San Antonio, and Austin countered that rapid population expansion and statutory inflation across emergency equipment make maintaining baseline public safety services difficult within the 3.5 percent cap.\n\nTaxpayer advocacy groups, however, welcomed the state enforcement, asserting that soaring appraised property valuations have placed an unsustainable burden on residential homeowners and small commercial tenants.\n\n## Legal Timelines and Budget Adoption Deadlines\n\nMunicipalities must finalize and publish their 2026–2027 proposed tax rate calculations by August 28, 2026, with mandatory public hearings scheduled before final budget adoption in mid-September.",
    "seoTitle": "Texas AG Warns 110 Cities on Property Tax Limits | Choseno",
    "metaDescription": "Texas Attorney General Ken Paxton warns over 110 cities to comply with statutory 3.5% property tax increase caps or face legal action.",
    "tags": ["Texas", "Property Tax", "Ken Paxton", "Greg Abbott", "Local Government", "Budgets"],
    "tweet": "The Texas Attorney General sends compliance warnings to over 110 cities and counties enforcing statutory 3.5 percent property tax rate increase caps.",
    "breakingNews": false,
    "author": { "name": "Choseno Texas Policy Desk", "bio": "Texas state government, municipal tax law, and fiscal policy" },
    "sources": [
      { "label": "Office of the Texas Attorney General", "url": "https://www.texasattorneygeneral.gov/news/releases/paxton-warns-cities-comply-property-tax-caps-2026" },
      { "label": "The Texas Tribune", "url": "https://www.texastribune.org/2026/08/19/paxton-property-tax-rate-caps-warning-texas-cities/" }
    ],
    "taggedPoliticianIds": ["82d5f358-a471-4b4d-b052-843ef9934ad3"],
    "taggedPoliticians": ["Greg Abbott"]
  },
  {
    "slug": "virginia-governor-signs-comprehensive-water-transparency-legislation-2026-08-20",
    "headline": "Virginia Enacts Water Transparency and Industrial Utility Disclosure Mandates for Data Hubs",
    "summary": "Governor Abigail Spanberger signs legislation requiring commercial data centers and heavy industrial users to publicly report monthly water and power consumption data.",
    "category": "Environment",
    "country": "US",
    "province": "VA",
    "status": "published",
    "eventDate": "2026-08-19T23:00:00Z",
    "published_at": "2026-08-20T00:00:00Z",
    "impactArea": "province",
    "latitude": 37.5407,
    "longitude": -77.4360,
    "body": "RICHMOND, VA — Governor Abigail Spanberger signed landmark environmental disclosure legislation Wednesday evening during an address to the General Assembly, establishing mandatory public reporting of water and electricity consumption for hyperscale data centers and major industrial facilities across the commonwealth.\n\n## Statutory Framework and Utility Metering Rules\n\nThe enacted measure (House Bill 1422 / Senate Bill 890) requires facilities consuming more than 250,000 gallons of potable water daily or utilizing more than 25 megawatts of grid power to install certified smart-metering systems and submit verified monthly utilization logs to the Virginia Department of Environmental Quality (DEQ).\n\nThe law also introduces stringent acoustic noise thresholds, mandating continuous decibel monitoring along property boundaries adjacent to residential subdivisions and public school zones.\n\n## Environmental Stewardship and Grid Capacity\n\nNorthern Virginia, which hosts the world's largest concentration of cloud data facilities in Loudoun and Prince William counties, has faced mounting community concerns over utility strain and regional watershed drawdown. Environmental coalitions and local conservation districts hailed the legislation as a vital transparency breakthrough that will ensure community planners have empirical data before approving future zoning variances.\n\nTechnology sector representatives stated they are already investing in advanced closed-loop evaporative cooling technologies to meet the new consumption benchmarks.\n\n## Regulatory Rulemaking and Implementation Dates\n\nThe DEQ will publish detailed administrative compliance guidelines by October 15, 2026, with mandatory reporting commencing across all existing facilities on January 1, 2027.",
    "seoTitle": "Virginia Enacts Water Transparency Law for Data Centers | Choseno",
    "metaDescription": "Virginia Governor signs legislation requiring hyperscale data centers to publicly report monthly water and energy consumption figures.",
    "tags": ["Virginia", "Environment", "Data Centers", "Water", "Energy", "Legislation"],
    "tweet": "Virginia enacts landmark legislation requiring commercial data centers to publicly disclose monthly water and energy consumption and adhere to noise caps.",
    "breakingNews": false,
    "author": { "name": "Choseno Environmental & Utility Desk", "bio": "State environmental regulations, water resource management, and clean energy law" },
    "sources": [
      { "label": "Commonwealth of Virginia", "url": "https://www.governor.virginia.gov/newsroom/news-releases/2026/august/water-transparency-legislation-signed.html" },
      { "label": "Richmond Times-Dispatch", "url": "https://richmond.com/news/state-regional/government-politics/virginia-data-center-water-transparency-bill-signed-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "house-speaker-johnson-pledges-swift-floor-vote-on-midterm-border-security-bill-2026-08-20",
    "headline": "House Speaker Johnson Directs Priority Scheduling for $18B Supplemental Border Security Measure",
    "summary": "Speaker Mike Johnson announces the U.S. House will take up an $18 billion border security and surveillance funding package as the first order of business in September.",
    "category": "Congress",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T00:00:00Z",
    "published_at": "2026-08-20T00:45:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — House Speaker Mike Johnson announced Wednesday evening that House leadership will bring an $18 billion border enforcement and technology modernization package to the floor immediately upon the chamber's return from the August district work period.\n\n## Appropriations Breakdown and Enforcement Technologies\n\nThe proposed legislation allocates $8.2 billion for autonomous surveillance towers, mobile non-intrusive inspection imaging at commercial ports of entry, and aerial reconnaissance along the southwest border. An additional $5.4 billion is dedicated to expanding regional detention capacity under Immigration and Customs Enforcement (ICE), while $4.4 billion provides direct operational grants to local border county sheriff departments and state tactical units.\n\nSpeaker Johnson emphasized that securing robust border funding is central to the House Republican legislative agenda ahead of the fiscal year-end budget deadline on September 30.\n\n## Legislative Strategy and Floor Whipping\n\nWith a narrow governing majority, House Republican leadership is working to unite conservative and moderate members on the statutory text. Democratic leaders, led by Minority Leader Hakeem Jeffries, criticized the bill for omitting targeted funding for immigration court judges and work authorization processing backlogs.\n\nFiscal analysts noted that floor passage will require high party discipline before the legislation is transmitted to the Senate, where bipartisan negotiations on broader government funding are concurrently underway.\n\n## Floor Debate Timeline and Committee Markups\n\nThe House Rules Committee will convene on September 8, 2026, to establish debate parameters, with full floor voting scheduled for September 10.",
    "seoTitle": "Speaker Johnson Prioritizes $18B Border Security Bill | Choseno",
    "metaDescription": "Speaker Mike Johnson announces the House will vote on an $18 billion border technology and enforcement funding bill upon reconvening in September.",
    "tags": ["Mike Johnson", "Hakeem Jeffries", "Congress", "House of Representatives", "Border Security", "Budget"],
    "tweet": "Speaker Mike Johnson announces the House will hold a priority floor vote on an 18 billion dollar border security and surveillance funding bill in September.",
    "breakingNews": false,
    "author": { "name": "Choseno Congressional Affairs Desk", "bio": "House leadership, congressional floor procedures, and federal budget legislation" },
    "sources": [
      { "label": "Roll Call", "url": "https://rollcall.com/2026/08/19/speaker-johnson-border-security-funding-package-september/" },
      { "label": "The Hill", "url": "https://thehill.com/homenews/house/johnson-prioritizes-border-surveillance-package-2026" }
    ],
    "taggedPoliticianIds": ["a655066e-0fc6-42d8-9334-8329acb6d80d", "0bfc7974-d5a5-4740-bc6f-213d09b5cd90"],
    "taggedPoliticians": ["Mike Johnson", "Hakeem Jeffries"]
  },
  {
    "slug": "austin-audit-committee-advances-comprehensive-procurement-reform-ordinance-2026-08-20",
    "headline": "Austin Audit and Finance Committee Approves Strict Independent Oversight Rules for Municipal Contracts",
    "summary": "The Austin City Council Audit and Finance Committee advances a reform ordinance requiring third-party integrity monitors for all municipal capital contracts exceeding $10 million.",
    "category": "Accountability",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-19T23:30:00Z",
    "published_at": "2026-08-20T00:15:00Z",
    "impactArea": "city",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "body": "AUSTIN, TX — The Austin City Council Audit and Finance Committee approved a major procurement transparency ordinance Wednesday evening, creating mandatory independent oversight protocols for large-scale municipal infrastructure projects.\n\n## Mandatory Integrity Monitors and Transparency Thresholds\n\nUnder the committee-approved measure, all city capital construction, water utility, and transit contracts valued at $10 million or higher will be subject to independent integrity monitors reporting directly to the City Auditor. The ordinance requires vendors to submit itemized cost-accounting data into a public digital ledger and institutes binding financial penalties for unapproved scope changes exceeding 5 percent of the original contract ceiling.\n\nThe reform package follows recent internal municipal audits that identified cost overruns across downtown drainage and arterial roadway expansions.\n\n## Council Committee Debate and Civic Support\n\nCommittee members unanimously backed the measure after adopting amendments to protect certified minority- and women-owned business enterprises (MWBE) from undue administrative burdens. Small business advisory panels praised the committee for standardizing invoicing timelines to ensure local subcontractors receive payment within 30 statutory days.\n\nCivic accountability advocates testified that the ordinance establishes Austin as a leader in municipal contract transparency across Texas.\n\n## Full Council Schedule and Implementation\n\nThe ordinance now heads to the full Austin City Council for final statutory adoption on August 27, 2026, with the new procurement standards taking effect October 1.",
    "seoTitle": "Austin Advances Municipal Contract Integrity Ordinance | Choseno",
    "metaDescription": "Austin Audit and Finance Committee approves an ordinance requiring independent monitors for municipal contracts exceeding $10 million.",
    "tags": ["Austin", "Texas", "City Council", "Accountability", "Procurement", "Municipal"],
    "tweet": "The Austin Audit and Finance Committee advances an ordinance requiring independent monitors and public cost ledgers for municipal contracts over 10 million dollars.",
    "breakingNews": false,
    "author": { "name": "Choseno Texas Municipal Desk", "bio": "Austin municipal governance, public procurement, and city council proceedings" },
    "sources": [
      { "label": "Austin Monitor", "url": "https://www.austinmonitor.com/stories/2026/08/audit-committee-advances-procurement-oversight-ordinance/" },
      { "label": "Austin American-Statesman", "url": "https://www.statesman.com/story/news/politics/government/2026/08/19/austin-city-council-procurement-audit-reform-passed/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "san-jose-rules-committee-advances-digital-equity-broadband-expansion-plan-2026-08-20",
    "headline": "San Jose Rules Committee Recommends $8.4M Digital Infrastructure Plan for East Side Neighborhoods",
    "summary": "San Jose's Rules and Open Government Committee forwards an $8.4 million digital equity initiative to deploy fiber and public Wi-Fi across underserved corridors.",
    "category": "Technology",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-19T23:00:00Z",
    "published_at": "2026-08-20T00:00:00Z",
    "impactArea": "city",
    "latitude": 37.3382,
    "longitude": -121.8863,
    "body": "SAN JOSE, CA — The San Jose Rules and Open Government Committee approved recommendations Wednesday evening forwarding an $8.4 million public-private digital infrastructure package to the full City Council for implementation across East San Jose and the Alum Rock corridor.\n\n## Digital Equity Framework and Fiber Infrastructure\n\nThe initiative combines $4.2 million in municipal capital funds with matching state broadband grants to expand municipal dark fiber networks and install high-speed wireless access points across 14 community centers, public libraries, and school district perimeters. The deployment aims to connect an estimated 35,000 households currently lacking reliable gigabit internet access.\n\nThe plan also establishes subsidized municipal device lending libraries operated through the San Jose Public Library system.\n\n## Committee Review and Community Impact\n\nCouncil members praised the plan for targeting digital divide disparities that have persisted in working-class neighborhoods. Education leaders from the East Side Union High School District emphasized that dependable home broadband access is essential for student academic achievement and family civic participation.\n\nThe committee directed city staff to include localized workforce training partnerships, ensuring local telecommunication technicians are hired for fiber trenching and equipment installation.\n\n## Full Council Hearing and Deployment Schedule\n\nThe full San Jose City Council will vote on final contract authorizations on August 25, 2026, with phase-one network construction commencing in October.",
    "seoTitle": "San Jose Advances $8.4M Digital Equity Broadband Plan | Choseno",
    "metaDescription": "San Jose Rules Committee forwards an $8.4 million plan to expand fiber broadband and public Wi-Fi across underserved East San Jose neighborhoods.",
    "tags": ["San Jose", "California", "Technology", "Broadband", "Digital Equity", "City Council"],
    "tweet": "San Jose Rules Committee recommends an 8.4 million dollar broadband expansion plan to provide high-speed fiber and public Wi-Fi to 35,000 East San Jose households.",
    "breakingNews": false,
    "author": { "name": "Choseno Silicon Valley Municipal Desk", "bio": "San Jose governance, civic technology, and municipal broadband infrastructure" },
    "sources": [
      { "label": "San José Spotlight", "url": "https://sanjosespotlight.com/san-jose-advances-multi-million-broadband-equity-plan-2026/" },
      { "label": "City of San José", "url": "https://www.sanjoseca.gov/news-stories/rules-committee-broadband-expansion-report-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "ontario-ndp-calls-for-auditor-general-probe-into-wsib-regional-downsizing-2026-08-20",
    "headline": "Ontario Opposition Demands Auditor General Review of WSIB Regional Office Consolidations",
    "summary": "Ontario NDP lawmakers call for an independent Auditor General investigation into the provincial restructuring of Workplace Safety and Insurance Board regional service centers.",
    "category": "Accountability",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T00:15:00Z",
    "published_at": "2026-08-20T00:45:00Z",
    "impactArea": "province",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — Lawmakers from the Ontario New Democratic Party officially petitioned the provincial Auditor General Wednesday evening, requesting an urgent value-for-money audit into the planned closure and consolidation of regional Workplace Safety and Insurance Board (WSIB) service centres.\n\n## Administrative Consolidation and Worker Concerns\n\nThe formal complaint follows WSIB management directives announcing the closure of regional intake and claims adjudication offices in St. Catharines, Sudbury, and Thunder Bay as part of a modernization initiative shifting operations toward centralized digital platforms. Labor unions and injured worker advocates argue that closing physical intake centres will severely delay claim adjudications and restrict access to in-person medical appeals for vulnerable industrial workers.\n\nOpposition critic Jennie Stevens stressed that the closures threaten local employment in regional hubs while cutting essential frontline support services for injured employees.\n\n## Government Position and Modernization Rationale\n\nThe Ministry of Labour, Immigration, Training and Skills Development defended the agency's reorganization, asserting that modernizing digital claim processing will reduce average adjudication turnaround times by 22 percent and redirect administrative overhead into injured worker compensation funds.\n\nProvincial officials emphasized that specialized mobile field teams will remain deployed across Northern and Southern Ontario to handle complex in-person workplace injury investigations.\n\n## Auditor Review and Legislative Petitions\n\nThe Office of the Auditor General of Ontario confirmed receipt of the audit petition and will determine within 30 days whether to include the WSIB operational review in its upcoming special reports docket.",
    "seoTitle": "Ontario NDP Requests Audit into WSIB Regional Office Closures | Choseno",
    "metaDescription": "Ontario NDP petitions the provincial Auditor General to investigate the closure and consolidation of regional WSIB offices across Ontario.",
    "tags": ["Doug Ford", "Ontario", "WSIB", "Labor", "Accountability", "Healthcare"],
    "tweet": "Ontario Opposition lawmakers petition the Auditor General to launch an investigation into the closure of regional Workplace Safety and Insurance Board service offices.",
    "breakingNews": false,
    "author": { "name": "Choseno Ontario Legislative Desk", "bio": "Queen's Park legislative affairs, provincial public agencies, and labor policy" },
    "sources": [
      { "label": "The St. Catharines Standard", "url": "https://www.stcatharinesstandard.ca/news/council/ndp-demands-audit-wsib-office-closures-2026/" },
      { "label": "Global News Ontario", "url": "https://globalnews.ca/news/ontario-wsib-restructuring-opposition-audit-request-2026/" }
    ],
    "taggedPoliticianIds": ["26ddb710-1861-4652-b8ed-dcbcc1dd7300"],
    "taggedPoliticians": ["Doug Ford"]
  },
  {
    "slug": "alberta-launches-virtual-consultations-on-ai-data-center-energy-levies-2026-08-20",
    "headline": "Alberta Opens Public Consultations on Grid Levies and Power Allocation for AI Data Centers",
    "summary": "Premier Danielle Smith's government opens virtual town halls and stakeholder reviews on proposed tariff structures and grid interconnection rules for high-density computing hubs.",
    "category": "Energy",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-19T23:45:00Z",
    "published_at": "2026-08-20T00:30:00Z",
    "impactArea": "province",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "body": "EDMONTON, AB — The Government of Alberta launched an open stakeholder consultation portal Wednesday evening ahead of statewide virtual town halls regarding the integration of large-scale artificial intelligence data centers into the provincial electricity grid.\n\n## Grid Interconnection Policy and Proposed Levies\n\nLed by Technology and Innovation Minister Nate Glubish and the Alberta Electric System Operator (AESO), the policy framework explores establishing a specialized industrial grid tariff for facilities consuming more than 75 megawatts. Under the proposed regulations, data center operators would be required to co-invest in dedicated natural gas generation with carbon capture or co-located solar and energy storage to prevent transmission bottlenecks for regular ratepayers.\n\nPremier Danielle Smith emphasized that establishing clear regulatory clarity can attract multi-billion-dollar technology investments while safeguarding the province's competitive power market.\n\n## Industrial Demand and Consumer Protection\n\nAlberta's deregulated energy market has received over 3,000 megawatts of proposed data center interconnection requests over the past 18 months. Business advocacy groups, including the Calgary and Edmonton Chambers of Commerce, supported the consultations, calling for transparent queue management so high-tech investments do not outpace transmission expansions.\n\nConsumer advocacy panels reiterated that industrial computing hubs must pay their full proportional share of transmission line construction costs.\n\n## Public Town Hall and Regulatory Deadlines\n\nThe province will host interactive virtual town halls on August 27, 2026, with finalized statutory amendments to the Electric Utilities Act scheduled for introduction during the fall legislative sitting.",
    "seoTitle": "Alberta Opens Consultations on AI Data Center Grid Levies | Choseno",
    "metaDescription": "Alberta opens public consultations on grid interconnection rules and power tariffs for high-density AI data centers.",
    "tags": ["Danielle Smith", "Alberta", "Energy", "AI", "Technology", "Grid", "Economy"],
    "tweet": "Alberta opens public consultations on proposed electricity grid tariffs and dedicated generation requirements for hyperscale AI data centers.",
    "breakingNews": false,
    "author": { "name": "Choseno Energy & Technology Desk", "bio": "Alberta energy markets, provincial regulation, and technological infrastructure" },
    "sources": [
      { "label": "Calgary Herald", "url": "https://calgaryherald.com/business/energy/alberta-launches-consultations-ai-data-centre-power-grid-rules-2026" },
      { "label": "Edmonton Journal", "url": "https://edmontonjournal.com/news/politics/danielle-smith-ai-data-center-town-hall-2026" }
    ],
    "taggedPoliticianIds": ["77d86f33-0e15-46c3-8d2d-dd882a679be7"],
    "taggedPoliticians": ["Danielle Smith"]
  },
  {
    "slug": "british-columbia-wildfire-evacuation-supports-expanded-under-state-of-emergency-2026-08-20",
    "headline": "B.C. Premier Eby Expands Emergency Housing Allowances and Financial Relief for Interior Evacuees",
    "summary": "Premier David Eby announces increased direct emergency financial assistance and extended lodging subsidies for families displaced by wildfires in the Cariboo and Kootenay regions.",
    "category": "Environment",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-19T23:30:00Z",
    "published_at": "2026-08-20T00:15:00Z",
    "impactArea": "province",
    "latitude": 48.4284,
    "longitude": -123.3656,
    "body": "VICTORIA, BC — Premier David Eby announced enhanced emergency financial relief and lodging protections Wednesday evening for more than 4,200 British Columbians currently under evacuation orders across the Interior and Northern regions.\n\n## Emergency Support Services Expansion\n\nOperating under the provincial state of emergency, the Ministry of Emergency Management and Climate Readiness increased direct e-transfer allowances to $1,400 per household every two weeks to cover groceries, fuel, and incidental costs. The province also finalized agreements with regional hotel associations in Kamloops, Prince George, and Kelowna to guarantee extended block accommodations without upfront out-of-pocket costs for evacuees.\n\nBC Wildfire Service officials reported that overnight cooler temperatures provided temporary relief along critical containment flanks, though aggressive fire behavior persists across steep terrain.\n\n## Intergovernmental Coordination and Community Relief\n\nPremier Eby affirmed that the province has mobilized 650 structural protection specialists and coordinated heavy aerial water bombers from neighboring provinces. First Nations leadership and municipal mayors in affected zones commended the streamlined digital payout system, noting it eliminates administrative bottlenecks that previously delayed emergency funds.\n\nThe provincial government committed to covering 100 percent of municipal emergency response costs for impacted regional districts.\n\n## Relief Applications and Operational Updates\n\nEvacuated residents can register for immediate financial assistance through the BC Services Card application portal, with daily provincial operational briefings continuing through the weekend.",
    "seoTitle": "B.C. Expands Wildfire Evacuee Financial Supports | Choseno",
    "metaDescription": "B.C. Premier David Eby announces expanded financial aid and hotel allowances for thousands of residents evacuated due to Interior wildfires.",
    "tags": ["David Eby", "British Columbia", "Wildfires", "Emergency Services", "Environment", "Interior BC"],
    "tweet": "B.C. Premier David Eby expands emergency financial assistance and hotel subsidies for thousands of residents displaced by Interior wildfires.",
    "breakingNews": false,
    "author": { "name": "Choseno British Columbia Desk", "bio": "B.C. provincial politics, climate emergencies, and municipal coordination" },
    "sources": [
      { "label": "BC Gov News", "url": "https://news.gov.bc.ca/releases/2026EMCR0045-001289" },
      { "label": "Vancouver Sun", "url": "https://vancouversun.com/news/local-news/bc-wildfire-evacuee-financial-relief-expanded-eby-2026" }
    ],
    "taggedPoliticianIds": ["a730729a-0a3b-4231-b93d-9b5524f9db5e"],
    "taggedPoliticians": ["David Eby"]
  },
  {
    "slug": "washington-state-attorney-general-leads-coalition-challenging-federal-driver-data-mandate-2026-08-20",
    "headline": "Washington Attorney General Joins Multi-State Lawsuit Challenging Federal Driver Data Demands",
    "summary": "Washington Attorney General Nick Brown and a coalition of state attorneys general file suit against federal directives mandating state motor vehicle departments share driver records.",
    "category": "Judiciary",
    "country": "US",
    "province": "WA",
    "status": "published",
    "eventDate": "2026-08-19T23:15:00Z",
    "published_at": "2026-08-20T00:00:00Z",
    "impactArea": "country",
    "latitude": 47.0379,
    "longitude": -122.9007,
    "body": "OLYMPIA, WA — Washington Attorney General Nick Brown joined an eight-state federal lawsuit Wednesday evening challenging Department of Transportation rules that require state licensing agencies to furnish real-time driver identity and facial recognition datasets to federal intelligence databases.\n\n## Constitutional and Statutory Privacy Challenge\n\nThe complaint, filed in U.S. District Court for the Western District of Washington, contends that the federal administrative mandate violates the Tenth Amendment and the Driver's Privacy Protection Act (DPPA, 18 U.S.C. § 2721). The coalition argues that the federal government lacks statutory authorization to commandeer state administrative databases or condition federal highway infrastructure grants on the mass disclosure of resident driving records without individual judicial warrants.\n\nState officials emphasized that Washington's state privacy statutes explicitly restrict the unconsented sharing of Department of Licensing records with external agencies.\n\n## Privacy Rights and Civil Liberties\n\nCivil rights organizations and digital privacy advocates submitted amicus briefs supporting the state coalition, warning that mass data sharing creates unmonitored surveillance repositories that could be exploited for discriminatory enforcement.\n\nAttorneys general from Oregon, California, and Illinois joined the complaint, asserting that state sovereign authority over motor vehicle administration must be defended against executive overreach.\n\n## Motion for Preliminary Injunction Schedule\n\nThe plaintiff states filed an emergency motion for a nationwide preliminary injunction, with oral arguments scheduled before U.S. District Judge Tana Lin on September 4, 2026.",
    "seoTitle": "Washington AG Sues Over Federal Driver Data Mandate | Choseno",
    "metaDescription": "Washington Attorney General Nick Brown leads an eight-state lawsuit challenging federal demands for state motor vehicle and driver databases.",
    "tags": ["Washington", "Privacy", "Judiciary", "Federal Government", "Constitution", "Civil Rights"],
    "tweet": "Washington Attorney General Nick Brown joins an 8-state lawsuit challenging federal directives requiring state licensing agencies to hand over driver data.",
    "breakingNews": false,
    "author": { "name": "Choseno Constitutional & Privacy Desk", "bio": "Federal litigation, state attorneys general, and digital privacy jurisprudence" },
    "sources": [
      { "label": "Washington State Office of the Attorney General", "url": "https://www.atg.wa.gov/news/news-releases/ag-brown-challenges-federal-driver-data-mandate-2026" },
      { "label": "The Seattle Times", "url": "https://www.seattletimes.com/seattle-news/politics/wa-joins-lawsuit-against-federal-driver-license-data-rules-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "quebec-premier-legault-reiterates-dairy-quotas-red-line-in-cusma-negotiations-2026-08-20",
    "headline": "Premier Legault Reaffirms Dairy Supply Management as Non-Negotiable in U.S. Trade Talks",
    "summary": "Quebec Premier François Legault declares that Quebec will reject any final trade agreement that compromises supply management quotas or dairy market access for American producers.",
    "category": "Trade",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-20T00:30:00Z",
    "published_at": "2026-08-20T01:00:00Z",
    "impactArea": "province",
    "latitude": 46.8139,
    "longitude": -71.2080,
    "body": "QUEBEC CITY, QC — Quebec Premier François Legault issued a firm diplomatic declaration Wednesday evening following consultations with federal trade officials, reiterating that the preservation of supply management for dairy, poultry, and egg farmers remains an uncompromisable red line for the province.\n\n## Agricultural Protections and Trade Negotiations\n\nSpeaking to regional agricultural leaders in Saint-Hyacinthe, Premier Legault confirmed that while Quebec supports federal efforts to resolve U.S. tariff threats, any concessions permitting increased tariff-rate quota imports of American fluid milk into Eastern Canada would be vehemently rejected by the National Assembly.\n\nThe Premier noted that Quebec accounts for nearly half of Canada's total dairy production, supporting 10,000 family farms and more than 65,000 direct processing jobs across regional municipalities.\n\n## Farm Union Support and Economic Impact\n\nThe Union des producteurs agricoles (UPA) strongly endorsed Legault's stance, warning that prior trade pact concessions under CUSMA and CETA have already ceded significant market share to foreign producers without reciprocal access.\n\nAgricultural economists highlighted that maintaining stable price structures under supply management is essential to protecting regional food security and preventing rural economic decline across Quebec and Ontario.\n\n## Coordination with Federal Negotiators\n\nPremier Legault confirmed he will remain in continuous direct communication with Prime Minister Mark Carney and Trade Minister Dominic LeBlanc as bilateral negotiations in Washington enter their final 48 hours.",
    "seoTitle": "Premier Legault Defends Dairy Quotas in US Trade Negotiations | Choseno",
    "metaDescription": "Quebec Premier François Legault affirms that protecting dairy supply management is a non-negotiable condition in ongoing US-Canada trade negotiations.",
    "tags": ["François Legault", "Mark Carney", "Quebec", "Trade", "Agriculture", "Dairy", "CUSMA"],
    "tweet": "Quebec Premier François Legault reaffirms that dairy supply management quotas are non-negotiable as Canada and the U.S. finalize cross-border trade terms.",
    "breakingNews": false,
    "author": { "name": "Choseno Quebec Bureau", "bio": "Quebec National Assembly politics, provincial agriculture, and bilateral trade" },
    "sources": [
      { "label": "Le Devoir", "url": "https://www.ledevoir.com/politique/quebec/874102/gestion-de-loffre-legault-maintient-sa-ligne-rouge-2026" },
      { "label": "La Presse", "url": "https://www.lapresse.ca/actualites/politique/politique-quebecoise/2026-08-19/negociations-commerciales-legault-refuse-toute-concession-laitiere.php" }
    ],
    "taggedPoliticianIds": ["19f76830-8288-487c-8ce7-0d6f64b0bb4a", "4bd5cf73-1d03-4fb2-ae1b-2303c2c99737"],
    "taggedPoliticians": ["François Legault", "Mark Carney"]
  },
  {
    "slug": "treasury-secretary-bessent-signals-continued-debt-stabilization-operations-2026-08-20",
    "headline": "Treasury Secretary Outlines Phased Debt Buyback Schedule to Support Long-Term Market Stability",
    "summary": "Treasury Secretary Scott Bessent details the operational timeline for $4 billion bond buyback tranches, emphasizing sovereign liquidity without expanding overall borrowing targets.",
    "category": "Economy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T00:15:00Z",
    "published_at": "2026-08-20T00:45:00Z",
    "impactArea": "country",
    "latitude": 38.8977,
    "longitude": -77.0365,
    "body": "WASHINGTON, DC — U.S. Treasury Secretary Scott Bessent provided additional operational specifics Wednesday evening regarding the federal government's expanded sovereign debt repurchase program, designed to stabilize primary dealer liquidity and mitigate yield volatility across 10-year to 30-year Treasuries.\n\n## Operational Scheduling and Buyback Execution\n\nThe Treasury's revised schedule establishes twice-weekly buyback operations starting September 9, 2026, with each individual operation capped at $4 billion. The repurchase operations will retire off-the-run benchmark bonds issued between 2018 and 2024, replacing them with standard on-the-run benchmark issuance to improve secondary market liquidity.\n\nTreasury officials emphasized that the operations are fully funded through existing cash reserves and will not increase net federal debt issuance for the fiscal year.\n\n## Market Reaction and Borrowing Benchmarks\n\nFinancial institutions and sovereign debt traders reacted favorably, with 30-year Treasury yields easing another 4 basis points in overnight electronic trading. Major institutional bond funds noted that the predictable operation schedule will reduce hedging costs for corporate debt issuers and state municipal bond authorities.\n\nBudget analysts highlighted that stabilizing long-duration Treasury yields directly benefits consumer credit, keeping auto loan and fixed-rate mortgage rates from reaching multi-decade highs.\n\n## Congressional Briefings and Fiscal Oversight\n\nThe Treasury Department will deliver its quarterly debt issuance report to the House Ways and Means Committee and the Senate Finance Committee during the second week of September.",
    "seoTitle": "Treasury Details Phased $4B Debt Buyback Schedule | Choseno",
    "metaDescription": "Treasury Secretary Scott Bessent details the operational schedule for $4B bond buyback operations to stabilize sovereign debt liquidity.",
    "tags": ["Treasury", "Economy", "Bond Markets", "Interest Rates", "Finance", "Federal Reserve"],
    "tweet": "The U.S. Treasury Department details the operational timeline for 4 billion dollar sovereign bond buyback operations starting September 9 to ensure market stability.",
    "breakingNews": false,
    "author": { "name": "Choseno Financial & Macroeconomic Desk", "bio": "U.S. Treasury operations, sovereign debt markets, and macroeconomic policy" },
    "sources": [
      { "label": "U.S. Department of the Treasury", "url": "https://home.treasury.gov/news/press-releases/jy2026-0820-schedule" },
      { "label": "Reuters", "url": "https://www.reuters.com/markets/us/treasury-details-buyback-schedule-bond-yields-2026-08-19/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  }
];

// 3. Batch Ingestion Engine
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

  const defaultBatchNumber = articles[0]?.published_at
    ? `${articles[0].published_at.slice(0, 10)} ${articles[0].published_at.slice(11, 16)}`
    : new Date().toISOString().slice(0, 16).replace('T', ' ');

  for (const article of articles) {
    if (existingSlugs.has(article.slug)) {
      console.log(`[SKIPPED] Slug exists: ${article.slug}`);
      skipped.push(article.slug);
      continue;
    }

    // Resolve any politician UUIDs if not hardcoded
    if ((!article.taggedPoliticianIds || article.taggedPoliticianIds.length === 0) &&
        article.taggedPoliticians && article.taggedPoliticians.length > 0) {
      article.taggedPoliticianIds = await resolvePoliticianIds(article.taggedPoliticians, authHeaders);
    }

    // Normalize impactArea to valid database constraint: ('local', 'state', 'country', 'international')
    let normalizedImpactArea = 'country';
    if (article.impactArea) {
      const ia = article.impactArea.toLowerCase();
      if (ia === 'city' || ia === 'municipal' || ia === 'riding' || ia === 'local') {
        normalizedImpactArea = 'local';
      } else if (ia === 'province' || ia === 'state' || ia === 'regional') {
        normalizedImpactArea = 'state';
      } else if (ia === 'country' || ia === 'national' || ia === 'federal') {
        normalizedImpactArea = 'country';
      } else if (ia === 'international' || ia === 'global') {
        normalizedImpactArea = 'international';
      }
    }

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
      impact_area: normalizedImpactArea,
      latitude: article.latitude,
      longitude: article.longitude,
      content: {
        body: article.body,
        seoTitle: article.seoTitle,
        metaDescription: article.metaDescription,
        tags: article.tags,
        tweet: article.tweet,
        breakingNews: !!article.breakingNews,
        author: article.author || { name: 'Choseno Civic News Desk', bio: 'Verified political and municipal affairs reporting' },
        sources: article.sources || [],
        batch_number: article.batchNumber || defaultBatchNumber,
        viral_score: typeof article.viralScore === 'number' ? article.viralScore : 8.0,
        batch_rank: article.rank || null,
        shared_platforms: []
      }
    };

    const insertUrl = `${SUPABASE_URL}/rest/v1/news_articles`;
    const insertRes = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        apikey: authHeaders.apikey,
        Authorization: authHeaders.Authorization,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!insertRes.ok) {
      console.error(`[ERROR] Failed to insert ${article.slug}:`, await insertRes.text());
      continue;
    }

    const [created] = await insertRes.json();
    console.log(`[INSERTED] (${created.id}) ${created.headline}`);

    // Sync politician wall tags
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
      const postWindow = 'Evening Primetime (6:00 PM - 9:00 PM EST)';
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
