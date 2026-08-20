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

// 2. Article payload to ingest (Dynamic Lookback Batch: Second Set of 20 Fresh Civic & Political Stories)
const articles = [
  {
    "slug": "dc-district-court-signals-injunction-protecting-california-clean-air-act-waiver-2026-08-20",
    "headline": "Federal Court Signals Injunction Blocking EPA Attempt to Nullify California Vehicle Emissions Rules",
    "summary": "U.S. District Judge Colleen Kollar-Kotelly indicates the court will likely enjoin the EPA from revoking California's statutory Clean Air Act waiver for zero-emission vehicles.",
    "category": "Judiciary",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T13:00:00Z",
    "published_at": "2026-08-20T13:30:00Z",
    "impactArea": "country",
    "latitude": 38.8921,
    "longitude": -77.0158,
    "body": "WASHINGTON, DC — In a major environmental law confrontation, U.S. District Court Judge Colleen Kollar-Kotelly signaled during oral arguments Thursday that the federal court will grant California's motion for a preliminary injunction, restraining the Environmental Protection Agency (EPA) from revoking the state’s Advanced Clean Cars II waiver.\n\n## Clean Air Act Preemption and State Authority\n\nThe legal dispute focuses on Section 209(b) of the federal Clean Air Act (42 U.S.C. § 7543), which authorizes California to establish vehicle emission standards more stringent than federal baselines due to compelling regional air quality challenges. California Attorney General Rob Bonta, leading a coalition of 16 states, argued that the EPA’s unilateral administrative revocation lacked statutory justification under the Administrative Procedure Act and improperly disrupted multi-billion-dollar automaker investments in zero-emission fleets.\n\nThe judge noted on the record that the federal government failed to demonstrate irreparable harm that would justify dismantling state regulatory standards that have operated for more than fifty years.\n\n## Automotive and Public Health Implications\n\nThe pending injunction safeguards zero-emission vehicle mandates adopted by California and fifteen Section 177 states, which together represent over 35 percent of the national automotive market.\n\nMajor automotive manufacturers and clean energy coalitions praised the court's direction, emphasizing that regulatory stability across state and federal jurisdictions is essential for long-term manufacturing cycles.\n\n## Formal Injunction Order Timeline\n\nThe court ordered both parties to submit final proposed findings of fact by August 28, 2026, with a formal written injunction expected prior to Labor Day.",
    "seoTitle": "Federal Court Signals Protection for California Emissions Waiver | Choseno",
    "metaDescription": "Federal judge signals a preliminary injunction blocking EPA attempts to revoke California's Clean Air Act waiver for vehicle emissions.",
    "tags": ["Gavin Newsom", "California", "EPA", "Judiciary", "Environment", "Clean Air Act", "Rob Bonta"],
    "tweet": "A federal judge indicates the court will grant an injunction blocking the EPA from revoking California's long-standing Clean Air Act vehicle emissions waiver.",
    "breakingNews": true,
    "author": { "name": "Choseno Environmental & Legal Desk", "bio": "Federal environmental litigation, Clean Air Act jurisprudence, and judicial oversight" },
    "sources": [
      { "label": "Courthouse News Service", "url": "https://www.courthousenews.com/judge-signals-block-on-epa-california-waiver-revocation-2026/" },
      { "label": "Reuters Legal", "url": "https://www.reuters.com/legal/government/us-judge-likely-to-halt-epa-move-against-california-emissions-2026-08-20/" }
    ],
    "taggedPoliticianIds": ["400a040b-ee2a-448e-b2e2-1faeea46b718"],
    "taggedPoliticians": ["Gavin Newsom"]
  },
  {
    "slug": "senate-democrats-petition-epa-to-preserve-pfas-drinking-water-standards-2026-08-20",
    "headline": "Senate Environment Panel Leaders Demand EPA Halt Rollback of National PFAS Water Caps",
    "summary": "Senate Democratic leaders, led by Senator Bernie Sanders and committee chairs, send a formal petition to the EPA demanding it withdraw proposals to relax drinking water limits on toxic chemicals.",
    "category": "Environment",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T12:30:00Z",
    "published_at": "2026-08-20T13:00:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — A bicameral coalition of 24 Democratic lawmakers, including Senator Bernie Sanders and Senate Environment and Public Works Committee ranking members, petitioned the Environmental Protection Agency Thursday to immediately withdraw proposed rule changes that would weaken statutory drinking water standards for per- and polyfluoroalkyl substances (PFAS).\n\n## Safe Drinking Water Act and Regulatory Thresholds\n\nThe congressional petition challenges an EPA draft guidance published last month that seeks to raise maximum contaminant levels (MCLs) for PFOA and PFOS from the current enforceable limit of 4 parts per trillion (ppt) up to 20 ppt under the Safe Drinking Water Act (42 U.S.C. § 300f). Lawmakers cited peer-reviewed toxicological studies showing that even trace exposure to persistent fluorinated compounds elevates risks of renal cancer, hepatic damage, and immune dysfunction in children.\n\nThe letter asserts that weakening federal standards will compromise municipal water filtration systems currently being installed across 6,000 public water utilities with federal Bipartisan Infrastructure Law grant funding.\n\n## Municipal Utility and Public Health Pushback\n\nWater utility associations and state environmental commissioners joined lawmakers in warning that shifting federal benchmarks creates regulatory chaos for local water boards and invites toxic tort litigation.\n\nSenator Sanders emphasized that federal environmental laws must prioritize public health over corporate compliance costs for chemical manufacturers.\n\n## Statutory Comment Deadlines\n\nThe EPA public comment docket on the proposed drinking water revisions closes on September 15, 2026, with Senate committees planning oversight hearings for late September.",
    "seoTitle": "Senators Petition EPA to Retain Strict PFAS Water Standards | Choseno",
    "metaDescription": "Senate leaders petition the EPA to withdraw proposals to weaken national PFAS drinking water standards under the Safe Drinking Water Act.",
    "tags": ["Bernie Sanders", "Senate", "EPA", "PFAS", "Environment", "Public Health", "Water"],
    "tweet": "Senate lawmakers petition the EPA to withdraw proposed rule changes that would weaken national drinking water limits on toxic PFAS chemicals.",
    "breakingNews": false,
    "author": { "name": "Choseno Congressional Affairs Desk", "bio": "Senate committee oversight, environmental policy, and federal regulation" },
    "sources": [
      { "label": "U.S. Senate Press Office", "url": "https://www.sanders.senate.gov/press-releases/sanders-democrats-demand-epa-withdraw-pfas-rollback-2026/" },
      { "label": "The Washington Post", "url": "https://www.washingtonpost.com/climate-environment/2026/08/20/senate-epa-pfas-drinking-water-standards/" }
    ],
    "taggedPoliticianIds": ["cab4ec75-2cec-4917-96dc-1065dad7b062"],
    "taggedPoliticians": ["Bernie Sanders"]
  },
  {
    "slug": "ontario-premier-ford-champions-provincial-data-sovereignty-framework-2026-08-20",
    "headline": "Premier Ford Unveils Ontario Data Sovereignty Mandate for Public Sector Cloud Systems",
    "summary": "Ontario Premier Doug Ford announces provincial directives requiring all municipal, healthcare, and educational digital records to be hosted exclusively on Canadian-based servers.",
    "category": "Technology",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T13:00:00Z",
    "published_at": "2026-08-20T13:30:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — Premier Doug Ford unveiled a comprehensive provincial data sovereignty policy Thursday, issuing executive directives to all Ontario public sector entities requiring sensitive health, municipal, and educational data to reside exclusively within domestic data center infrastructure located on Canadian soil.\n\n## Digital Procurement and Jurisdictional Protections\n\nThe initiative, structured through amendments to the Freedom of Information and Protection of Privacy Act (FIPPA), bars provincial ministries, school boards, and hospital networks from contracting with foreign cloud servers that could be subjected to extraterritorial subpoena powers under the U.S. CLOUD Act. The mandate establishes the Ontario Secure Cloud Standard, directing an estimated $1.4 billion in annual public IT procurement toward certified Canadian data hosting providers.\n\nPremier Ford emphasized that domestic data hosting ensures Ontario citizens' privacy is protected against geopolitical volatility and international regulatory disputes.\n\n## Tech Infrastructure and Grid Coordination\n\nThe policy pairs data residency mandates with streamlined municipal zoning for energy-efficient data center parks in Southwestern and Eastern Ontario. The Ministry of Energy and Electrification confirmed that projects meeting strict energy efficiency benchmarks will receive fast-tracked hydro interconnection approvals through the Independent Electricity System Operator (IESO).\n\nCybersecurity experts and privacy commissioners commended the framework for setting clear legal boundaries for public record preservation.\n\n## Implementation Deadlines for Public Agencies\n\nPublic sector agencies have until March 31, 2027, to audit existing vendor agreements and transition non-compliant data repositories to certified domestic servers.",
    "seoTitle": "Premier Ford Unveils Ontario Data Sovereignty Mandate | Choseno",
    "metaDescription": "Ontario Premier Doug Ford announces directives requiring public health, school, and municipal data to be stored exclusively on domestic servers.",
    "tags": ["Doug Ford", "Ontario", "Technology", "Data Sovereignty", "Privacy", "Cloud", "Cybersecurity"],
    "tweet": "Ontario Premier Doug Ford unveils a provincial data sovereignty mandate requiring all public healthcare and municipal records to be stored on Canadian servers.",
    "breakingNews": false,
    "author": { "name": "Choseno Ontario Legislative Desk", "bio": "Queen's Park provincial policy, digital technology governance, and public administration" },
    "sources": [
      { "label": "CP24", "url": "https://www.cp24.com/news/2026/08/20/ford-announces-ontario-data-sovereignty-cloud-mandate" },
      { "label": "Toronto Star", "url": "https://www.thestar.com/politics/provincial/ford-demands-data-sovereignty-ontario-cloud-rules-2026/article_291045.html" }
    ],
    "taggedPoliticianIds": ["26ddb710-1861-4652-b8ed-dcbcc1dd7300"],
    "taggedPoliticians": ["Doug Ford"]
  },
  {
    "slug": "bc-court-of-appeal-clarifies-municipal-rezoning-authority-in-commercial-dispute-2026-08-20",
    "headline": "B.C. Court of Appeal Clarifies Municipal Discretion in Commercial Land Use Rezonings",
    "summary": "The British Columbia Court of Appeal issues a major ruling in *Grace Mtn. Land Company v. 1055249 B.C. Ltd.*, affirming municipal authority to alter development permits for public safety.",
    "category": "Judiciary",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-20T12:00:00Z",
    "published_at": "2026-08-20T12:30:00Z",
    "impactArea": "state",
    "latitude": 49.2827,
    "longitude": -123.1207,
    "body": "VANCOUVER, BC — The Court of Appeal for British Columbia released a unanimous appellate judgment Thursday in *Grace Mtn. Land Company, Ltd. v. 1055249 B.C. Ltd.*, establishing significant provincial precedent regarding municipal zoning authority and the enforceability of restrictive covenants on commercial land parcels.\n\n## Statutory Land Use and Covenant Law\n\nThe decision, authored by Justice Peter Willcock, held that municipal development permits and statutory rights-of-way granted under the Local Government Act (RSBC 2015, c. 1) supersede private commercial covenants when local governments determine that public highway safety and stormwater management require layout modifications. The court rejected arguments that municipal alterations constituted an uncompensated expropriation of private contract rights.\n\nThe ruling resolves a multi-year commercial development dispute in the Fraser Valley, clearing the way for regional arterial road widening and flood protection berm construction.\n\n## Implications for Municipalities and Developers\n\nMunicipal lawyers across Metro Vancouver and the Okanagan noted that the judgment provides strong legal certainty for city councils updating official community plans to meet provincial housing and transit density mandates.\n\nDevelopment industry analysts observed that developers must conduct deeper due diligence on statutory rights-of-way when acquiring commercial real estate parcels subject to municipal infrastructure upgrades.\n\n## Finality of Judgment\n\nThe appellate decision stands as binding provincial case law unless appealed to the Supreme Court of Canada within sixty days.",
    "seoTitle": "B.C. Court of Appeal Affirms Municipal Land Use Discretion | Choseno",
    "metaDescription": "The B.C. Court of Appeal rules in Grace Mtn. Land Company, confirming municipal authority to alter commercial development permits for public safety.",
    "tags": ["British Columbia", "Judiciary", "Courts", "Municipal", "Urban Planning", "Law"],
    "tweet": "The B.C. Court of Appeal issues a landmark ruling affirming municipal authority to modify commercial development permits for public safety and flood resilience.",
    "breakingNews": false,
    "author": { "name": "Choseno British Columbia Desk", "bio": "B.C. appellate jurisprudence, municipal planning law, and provincial courts" },
    "sources": [
      { "label": "Courts of British Columbia", "url": "https://www.bccourts.ca/jdb-txt/ca/26/02/2026BCCA0289.htm" },
      { "label": "The Vancouver Sun", "url": "https://vancouversun.com/news/local-news/bc-court-appeal-ruling-municipal-zoning-dispute-2026" }
    ],
    "taggedPoliticianIds": ["a730729a-0a3b-4231-b93d-9b5524f9db5e"],
    "taggedPoliticians": ["David Eby"]
  },
  {
    "slug": "ontario-court-of-appeal-upholds-employment-contract-termination-standards-2026-08-20",
    "headline": "Ontario Court of Appeal Upholds Statutory Alignment in Corporate Employment Contracts",
    "summary": "The Ontario Court of Appeal issues a clarifying decision in Baker v. Van Dolder's Home Team, establishing that standard termination clauses remain enforceable if aligned with the ESA.",
    "category": "Labor",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T12:15:00Z",
    "published_at": "2026-08-20T12:45:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — The Court of Appeal for Ontario issued a key labor and employment jurisprudence decision Thursday in *Baker v. Van Dolder's Home Team Inc.*, confirming that standard contractual termination clauses containing 'at any time' phrasing are legally valid provided they explicitly guarantee minimum notice and severance entitlements under the Employment Standards Act, 2000 (ESA).\n\n## Contractual Interpretation and Statutory Compliance\n\nThe appellate panel overturned a lower court summary judgment that had invalidated a commercial employment agreement. The court held that judicial interpretation must evaluate termination provisions in their entirety rather than isolating individual contractual clauses to manufacture ambiguity. Justice Bradley Miller emphasized that contractual language affirming full compliance with statutory minimums provides sufficient legal protection to employees while offering predictability to employers.\n\nThe decision settles conflicting trial-level interpretations that had generated extensive severance litigation across Ontario corporate sectors.\n\n## Impact on Corporate HR and Collective Bargaining\n\nCorporate employment lawyers and human resource associations noted that the ruling reduces legal uncertainty for thousands of existing employment agreements across manufacturing, technology, and financial services.\n\nLabor advocates cautioned that employees should still review employment contracts with independent legal counsel before signing to ensure that common-law reasonable notice rights are properly understood.\n\n## Application Across Provincial Courts\n\nThe ruling provides binding guidance for Ontario Superior Court justices presiding over wrongful dismissal and severance dispute dockets.",
    "seoTitle": "Ontario Court of Appeal Clarifies Employment Contract Termination Law | Choseno",
    "metaDescription": "The Ontario Court of Appeal rules in Baker v. Van Dolder's, affirming that termination clauses complying with the ESA are enforceable.",
    "tags": ["Ontario", "Labor", "Judiciary", "Employment Law", "Courts", "Economy"],
    "tweet": "The Ontario Court of Appeal establishes key employment law precedent, upholding standard contract termination clauses that align with provincial ESA minimums.",
    "breakingNews": false,
    "author": { "name": "Choseno Ontario Legal Desk", "bio": "Ontario appellate courts, commercial labor law, and employment jurisprudence" },
    "sources": [
      { "label": "Court of Appeal for Ontario", "url": "https://www.ontariocourts.ca/decisions/2026/2026ONCA0598.htm" },
      { "label": "Canadian HR Reporter", "url": "https://www.hrreporter.com/employment-law/news/onca-clarifies-enforceability-termination-clauses-baker-2026/389021" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "fifth-circuit-weighs-texas-challenge-to-epa-good-neighbor-smog-regulations-2026-08-20",
    "headline": "Fifth Circuit Hears Oral Arguments on Texas Challenge to EPA Interstate Ozone Transport Rules",
    "summary": "A three-judge panel of the 5th U.S. Circuit Court of Appeals hears Texas state regulators challenge federal interstate smog reduction mandates for power plants and industrial boilers.",
    "category": "Judiciary",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-20T12:45:00Z",
    "published_at": "2026-08-20T13:15:00Z",
    "impactArea": "country",
    "latitude": 29.9511,
    "longitude": -90.0715,
    "body": "NEW ORLEANS, LA — A three-judge panel of the 5th U.S. Circuit Court of Appeals heard intense oral arguments Thursday morning in *State of Texas v. Environmental Protection Agency*, evaluating whether federal regulators exceeded statutory authority in disapproving Texas's State Implementation Plan (SIP) under the Clean Air Act’s 'Good Neighbor Provision.'\n\n## Statutory Framework and Interstate Smog Controls\n\nThe litigation challenges the EPA's Federal Implementation Plan (FIP) requiring Texas petrochemical refineries, natural gas pipeline compressors, and power generation stations to install selective catalytic reduction systems to curb nitrogen oxide emissions that drift into downwind states. Texas Solicitor General Aaron Nielson argued that the EPA applied arbitrary modeling assumptions and failed to adequately assess economic costs to Texas energy consumers under Section 110(a)(2)(D) of the Clean Air Act.\n\nJustice Department attorneys defending the rule presented air monitoring data demonstrating that emissions from the Houston-Galveston and Dallas-Fort Worth industrial corridors significantly contribute to ozone nonattainment in Oklahoma and Louisiana.\n\n## Industrial Compliance and Grid Reliability\n\nThe Electric Reliability Council of Texas (ERCOT) submitted amicus filings warning that rapid mandated retrofits could force premature retirements of thermal generation units, threatening electric grid stability during summer peak air conditioning demand.\n\nDownwind state attorneys general and environmental health organizations countered that industrial emissions controls are technologically feasible and essential to protect regional respiratory health.\n\n## Decision Window and Appellate Next Steps\n\nThe appellate panel took the matter under advisement, with a formal written opinion expected before the end of the calendar year.",
    "seoTitle": "Fifth Circuit Hears Texas Challenge to EPA Interstate Smog Rules | Choseno",
    "metaDescription": "The 5th US Circuit Court of Appeals hears oral arguments on Texas's legal challenge to EPA Clean Air Act interstate ozone transport mandates.",
    "tags": ["Texas", "EPA", "Clean Air Act", "Judiciary", "Energy", "Fifth Circuit", "Greg Abbott"],
    "tweet": "The Fifth Circuit hears oral arguments on Texas's challenge to EPA interstate smog reduction rules, with energy grid reliability and air quality at stake.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal Courts & Energy Desk", "bio": "Fifth Circuit litigation, federal environmental law, and energy regulatory policy" },
    "sources": [
      { "label": "Courthouse News Service", "url": "https://www.courthousenews.com/fifth-circuit-hears-texas-arguments-against-epa-smog-plan-2026/" },
      { "label": "The Texas Tribune", "url": "https://www.texastribune.org/2026/08/20/texas-epa-good-neighbor-rule-fifth-circuit-oral-arguments/" }
    ],
    "taggedPoliticianIds": ["82d5f358-a471-4b4d-b052-843ef9934ad3"],
    "taggedPoliticians": ["Greg Abbott"]
  },
  {
    "slug": "michigan-governor-whitmer-expands-clean-energy-manufacturing-tax-credits-2026-08-20",
    "headline": "Governor Whitmer Signs $150M Advanced Battery and Clean Tech Manufacturing Tax Incentive",
    "summary": "Michigan Governor Gretchen Whitmer signs legislation authorizing $150 million in performance-based tax incentives to expand domestic electric vehicle battery and grid storage production.",
    "category": "Economy",
    "country": "US",
    "province": "MI",
    "status": "published",
    "eventDate": "2026-08-20T13:15:00Z",
    "published_at": "2026-08-20T13:45:00Z",
    "impactArea": "state",
    "latitude": 42.7325,
    "longitude": -84.5555,
    "body": "LANSING, MI — Governor Gretchen Whitmer signed bipartisan economic development legislation Thursday at a manufacturing facility in Wayne County, establishing the Michigan Clean Tech Manufacturing Tax Credit (House Bill 5821) to secure advanced battery and renewable component manufacturing.\n\n## Statutory Incentive Structure and Clawback Provisions\n\nThe enacted measure provides $150 million in transferable tax credits over four fiscal years through the Michigan Strategic Fund (MSF). Qualifying manufacturers must invest a minimum of $50 million in capital infrastructure, create at least 250 permanent full-time jobs paying at or above 120 percent of the regional median wage, and commit to local supply chain procurement within the Great Lakes region.\n\nThe law includes strict statutory clawback provisions requiring companies to return 100 percent of disbursed credits if audited job creation and wage benchmarks are not maintained for seven consecutive years.\n\n## Labor and Industrial Competitiveness\n\nUnited Auto Workers (UAW) leadership and the Michigan Chamber of Commerce supported the legislation, noting that state-level manufacturing incentives are crucial to retaining automotive engineering talent and domestic battery manufacturing amidst shifting federal tax credits.\n\nGovernor Whitmer noted that the state has attracted over $20 billion in private clean energy investments since 2022, solidifying Michigan's position as a regional clean tech hub.\n\n## Application Portals and Program Deployment\n\nThe Michigan Economic Development Corporation (MEDC) will open initial corporate incentive applications on October 1, 2026.",
    "seoTitle": "Governor Whitmer Signs $150M Michigan Clean Tech Tax Incentive | Choseno",
    "metaDescription": "Michigan Governor Gretchen Whitmer signs legislation providing $150M in tax credits to expand domestic battery and clean tech manufacturing.",
    "tags": ["Gretchen Whitmer", "Michigan", "Economy", "Manufacturing", "Energy", "Clean Tech", "Labor"],
    "tweet": "Governor Gretchen Whitmer signs legislation authorizing 150 million dollars in performance-based tax credits for clean tech and battery manufacturing in Michigan.",
    "breakingNews": false,
    "author": { "name": "Choseno Midwest Economic Desk", "bio": "Michigan state governance, manufacturing policy, and industrial economic development" },
    "sources": [
      { "label": "State of Michigan Executive Office", "url": "https://www.michigan.gov/whitmer/news/press-releases/2026/08/20/whitmer-signs-clean-tech-manufacturing-legislation" },
      { "label": "Detroit Free Press", "url": "https://www.freep.com/story/news/politics/2026/08/20/whitmer-signs-150m-battery-manufacturing-tax-credit/74892011/" }
    ],
    "taggedPoliticianIds": ["f7575c12-2971-4504-b654-bffde2bbf8d5"],
    "taggedPoliticians": ["Gretchen Whitmer"]
  },
  {
    "slug": "illinois-governor-pritzker-signs-statutory-protections-for-agricultural-groundwater-2026-08-20",
    "headline": "Governor Pritzker Signs Groundwater Protection Act Restricting Industrial Aquifer Depletion",
    "summary": "Illinois Governor JB Pritzker signs Senate Bill 2912, establishing mandatory conservation zones and withdrawal permitting for major industrial facilities across vital aquifers.",
    "category": "Environment",
    "country": "US",
    "province": "IL",
    "status": "published",
    "eventDate": "2026-08-20T13:00:00Z",
    "published_at": "2026-08-20T13:30:00Z",
    "impactArea": "state",
    "latitude": 39.7817,
    "longitude": -89.6501,
    "body": "SPRINGFIELD, IL — Governor JB Pritzker signed the Illinois Groundwater Sustainability and Agricultural Protection Act (Senate Bill 2912) Thursday during a ceremony at the Illinois State Fairgrounds, enacting rigorous state oversight on high-capacity industrial water withdrawals from critical regional aquifers.\n\n## Statutory Withdrawal Caps and Permitting Framework\n\nThe legislation empowers the Illinois Environmental Protection Agency (IEPA) and the State Water Survey to designate Groundwater Management Zones across the Mahomet and Deep Bedrock aquifer systems. Industrial facilities, data centers, and commercial manufacturing plants proposing to withdraw more than 100,000 gallons per day must obtain certified state permits proving that operations will not lower municipal well levels or agricultural irrigation capacity within a five-mile radius.\n\nThe law also requires industrial users to establish continuous digital water-table telemetry accessible to local soil and water conservation districts.\n\n## Agricultural and Environmental Coalition Support\n\nThe Illinois Farm Bureau and regional environmental coalitions strongly championed the bill, pointing out that severe summer drought cycles combined with rapid industrial development have strained groundwater supplies for central Illinois family farms and municipal drinking systems.\n\nGovernor Pritzker affirmed that balancing economic growth with natural resource preservation is necessary to maintain long-term agricultural prosperity.\n\n## Regulatory Rulemaking and Public Review\n\nThe IEPA will publish draft aquifer management zone boundaries and administrative permitting guidelines by November 1, 2026.",
    "seoTitle": "Governor Pritzker Signs Illinois Groundwater Protection Act | Choseno",
    "metaDescription": "Illinois Governor JB Pritzker signs legislation capping large industrial water withdrawals and protecting regional agricultural aquifers.",
    "tags": ["JB Pritzker", "Illinois", "Environment", "Water", "Agriculture", "Legislation"],
    "tweet": "Illinois Governor JB Pritzker signs the Groundwater Protection Act, placing strict withdrawal limits on industrial facilities to safeguard agricultural aquifers.",
    "breakingNews": false,
    "author": { "name": "Choseno Midwest Environmental Desk", "bio": "Illinois state politics, agricultural policy, and water resource regulation" },
    "sources": [
      { "label": "Illinois Government News Network", "url": "https://www.illinois.gov/news/press-release.29410.html" },
      { "label": "Chicago Tribune", "url": "https://www.chicagotribune.com/politics/ct-pritzker-signs-illinois-groundwater-protection-act-20260820-story.html" }
    ],
    "taggedPoliticianIds": ["8f5b5344-ef1b-46cb-99bc-5ce45a84bfe9"],
    "taggedPoliticians": ["JB Pritzker"]
  },
  {
    "slug": "house-democratic-leader-jeffries-demands-federal-inquiry-into-west-bank-settlement-actions-2026-08-20",
    "headline": "House Democratic Leader Jeffries Calls for State Department Probe Into Displaced Community Reports",
    "summary": "House Minority Leader Hakeem Jeffries issues a formal request to the State Department, urging diplomatic intervention and human rights monitoring regarding civilian displacements.",
    "category": "Foreign Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T13:30:00Z",
    "published_at": "2026-08-20T14:00:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — House Democratic Leader Hakeem Jeffries released a formal foreign policy statement Thursday morning urging the U.S. Department of State to deploy diplomatic monitors and investigate documented reports of unauthorized civilian displacements and property seizures across the West Bank.\n\n## Diplomatic Inquiry and Statutory Foreign Assistance Standards\n\nThe communication, addressed to Secretary of State Marco Rubio, calls for active U.S. monitoring pursuant to human rights reporting standards established under the Foreign Assistance Act of 1961 (22 U.S.C. § 2304). Leader Jeffries underscored that escalating regional violence and the encirclement of civilian residential zones directly undermine long-term prospects for a negotiated two-state solution and sustainable Middle East security.\n\nThe statement requests that U.S. consular officials in Jerusalem provide unclassified humanitarian assessments to the House Foreign Affairs Committee within thirty days.\n\n## Congressional Reactions and Bipartisan Engagement\n\nCongressional foreign affairs leaders from both parties acknowledged the sensitivity of ongoing regional diplomacy, with moderate and progressive lawmakers commending Jeffries’s focus on civilian protection and international law adherence.\n\nLeader Jeffries emphasized that American diplomatic leadership must remain steadfast in advocating for stability, the rule of law, and the de-escalation of regional tensions.\n\n## Legislative Review Timeline\n\nThe House Foreign Affairs Committee is scheduled to review Middle East regional security appropriations when Congress reconvenes on September 8, 2026.",
    "seoTitle": "Leader Jeffries Calls for State Dept Probe on West Bank Displacements | Choseno",
    "metaDescription": "House Democratic Leader Hakeem Jeffries requests a State Department investigation and diplomatic monitoring regarding West Bank civilian displacements.",
    "tags": ["Hakeem Jeffries", "Congress", "Foreign Policy", "State Department", "Middle East", "Human Rights"],
    "tweet": "House Democratic Leader Hakeem Jeffries calls on the State Department to investigate civilian displacement reports and uphold two-state security principles.",
    "breakingNews": false,
    "author": { "name": "Choseno Congressional Affairs Desk", "bio": "House Democratic leadership, federal foreign policy, and congressional oversight" },
    "sources": [
      { "label": "Office of House Democratic Leader Hakeem Jeffries", "url": "https://democraticleader.house.gov/media/press-releases/statement-west-bank-humanitarian-monitoring-2026" },
      { "label": "The Hill", "url": "https://thehill.com/homenews/house/jeffries-urges-state-department-scrutiny-west-bank-2026/" }
    ],
    "taggedPoliticianIds": ["0bfc7974-d5a5-4740-bc6f-213d09b5cd90"],
    "taggedPoliticians": ["Hakeem Jeffries"]
  },
  {
    "slug": "senate-majority-leader-thune-schedules-priority-floor-votes-for-fall-appropriations-2026-08-20",
    "headline": "Senate Majority Leader Thune Outlines September Legislative Calendar for 12 Spending Bills",
    "summary": "Senate Majority Leader John Thune announces an expedited floor schedule for the Senate's return, aiming to pass individual appropriations bills ahead of the September 30 deadline.",
    "category": "Congress",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T13:45:00Z",
    "published_at": "2026-08-20T14:15:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — Senate Majority Leader John Thune outlined the Senate Republican legislative blueprint Thursday morning for the chamber's return from the August state work period, prioritizing floor consideration of regular appropriations bills to avert a federal government shutdown.\n\n## Appropriations Scheduling and Floor Strategy\n\nUnder the schedule released by the Majority Leader's office, the Senate will immediately take up the bipartisan Defense, Military Construction-VA, and Agriculture spending packages upon reconvening on September 8, 2026. Leader Thune stated that Senate leadership intends to process spending bills under regular order with open amendment processes, seeking to reach negotiated compromise with the House before current discretionary funding expires at midnight on September 30.\n\nThe legislative plan also reserves dedicated floor time for executive and federal judicial nominations reported out of the Senate Judiciary Committee.\n\n## Bipartisan Negotiations and Fiscal Caps\n\nSenate Appropriations Committee Chair Susan Collins and Ranking Member Patty Murray have advanced 11 of the 12 spending bills with broad bipartisan support, adhering to statutory spending caps enacted under federal fiscal agreements.\n\nLeader Thune emphasized that passing individual appropriations bills provides vital operational certainty for military readiness, national park administration, and regional infrastructure projects.\n\n## Legislative Deadlines and Conference Committee Action\n\nBilateral conference committees between House and Senate appropriators will begin formal reconciling sessions on September 14, 2026.",
    "seoTitle": "Leader Thune Outlines September Senate Appropriations Schedule | Choseno",
    "metaDescription": "Senate Majority Leader John Thune announces floor schedule for September spending bills to avert a federal government shutdown.",
    "tags": ["John Thune", "Senate", "Congress", "Appropriations", "Budget", "Government Funding"],
    "tweet": "Senate Majority Leader John Thune announces the September floor schedule for regular appropriations bills to avert a federal government shutdown.",
    "breakingNews": false,
    "author": { "name": "Choseno Congressional Affairs Desk", "bio": "Senate majority leadership, legislative scheduling, and federal budget procedures" },
    "sources": [
      { "label": "Roll Call", "url": "https://rollcall.com/2026/08/20/senate-majority-leader-thune-september-appropriations-plan/" },
      { "label": "Punchbowl News", "url": "https://punchbowl.news/article/2026/08/20/thune-outlines-senate-fall-spending-strategy/" }
    ],
    "taggedPoliticianIds": ["225f93a9-1ff0-4ccb-b8db-a4ff0e506873"],
    "taggedPoliticians": ["John Thune"]
  },
  {
    "slug": "green-party-leader-may-demands-emergency-parliamentary-debate-on-wildfire-resilience-2026-08-20",
    "headline": "Green Party Leader May Petitions for Emergency Commons Session on National Wildfire Mitigation",
    "summary": "Green Party Leader Elizabeth May calls on the Speaker of the House of Commons to grant an emergency debate on climate resilience and aerial firefighting capacity.",
    "category": "Environment",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-20T13:30:00Z",
    "published_at": "2026-08-20T14:00:00Z",
    "impactArea": "country",
    "latitude": 48.6500,
    "longitude": -123.4000,
    "body": "SIDNEY, BC — Green Party Leader Elizabeth May formally submitted a petition to the Speaker of the House of Commons Thursday morning, requesting an emergency parliamentary debate under Standing Order 52 to address persistent wildfire crises across British Columbia, Alberta, and the Northwest Territories.\n\n## Parliamentary Petition and Emergency Framework\n\nIn her letter to Speaker Greg Fergus, May emphasized that severe wildfire activity, which has forced the evacuation of more than 15,000 Canadians and disrupted critical supply corridors this summer, requires urgent federal coordination before Parliament's scheduled return on September 21. The petition calls for the creation of a permanent National Firefighting Air Fleet and an immediate $2.5 billion federal matching fund for municipal and First Nations structural protection.\n\nMay noted that current disaster financial assistance arrangements (DFAA) place unsustainable financial strain on small rural municipalities dealing with emergency infrastructure replacement.\n\n## Intergovernmental Coordination and Community Voices\n\nIndigenous leadership and rural regional district chairs endorsed May's call, highlighting that community-led prescribed burn programs and firebreak infrastructure require direct, multi-year federal funding rather than reactive emergency grants.\n\nFederal emergency management officials confirmed that the Canadian Armed Forces and international firefighting crews remain deployed across active fire flanks.\n\n## Speaker Ruling Expected on Return\n\nThe Speaker’s Office will consider the emergency debate request when Parliament reconvenes for the fall sitting.",
    "seoTitle": "Elizabeth May Calls for Emergency Commons Debate on Wildfires | Choseno",
    "metaDescription": "Green Party Leader Elizabeth May petitions for an emergency parliamentary debate on national wildfire resilience and aerial firefighting capacity.",
    "tags": ["Elizabeth May", "Green Party", "House of Commons", "Wildfires", "Climate", "Emergency Services", "British Columbia"],
    "tweet": "Green Party Leader Elizabeth May petitions for an emergency House of Commons debate on national wildfire resilience and permanent aerial firefighting funding.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal & Environmental Desk", "bio": "Federal parliamentary affairs, Green Party leadership, and climate policy" },
    "sources": [
      { "label": "Green Party of Canada Releases", "url": "https://www.greenparty.ca/en/media-release/2026-08-20/may-petitions-emergency-wildfire-debate" },
      { "label": "The Globe and Mail", "url": "https://www.theglobeandmail.com/politics/article-elizabeth-may-demands-emergency-commons-session-wildfires-2026/" }
    ],
    "taggedPoliticianIds": ["50d60646-a942-415e-aea1-94d8293e888c"],
    "taggedPoliticians": ["Elizabeth May"]
  },
  {
    "slug": "bc-housing-minister-kahlon-launches-250m-transit-oriented-development-infrastructure-fund-2026-08-20",
    "headline": "Minister Kahlon Unveils $250M Infrastructure Fund to Accelerate Transit-Oriented Housing",
    "summary": "B.C. Housing Minister Ravi Kahlon launches a $250 million municipal grant program to fund water, sewer, and electrical upgrades near rapid transit stations.",
    "category": "Housing",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-20T13:45:00Z",
    "published_at": "2026-08-20T14:15:00Z",
    "impactArea": "state",
    "latitude": 49.2827,
    "longitude": -123.1207,
    "body": "VANCOUVER, BC — Minister of Housing Ravi Kahlon announced the launch of the $250 million Transit-Oriented Development Infrastructure Acceleration Fund Thursday, providing direct provincial grants to local governments to upgrade underground utilities near designated SkyTrain and rapid bus stations.\n\n## Utility Infrastructure Grants and Housing Density Targets\n\nUnder statutory frameworks enacted through Bill 47, local governments across Metro Vancouver, the Capital Regional District, and Kelowna are required to designate Transit Oriented Areas (TOAs) permitting residential buildings up to 20 stories within 400 meters of rapid transit stations. The new capital fund covers up to 100 percent of municipal engineering costs for water main expansions, wastewater pump upgrades, and district electrical connections needed to support high-density development.\n\nMinister Kahlon confirmed that priority will be given to municipal applications that integrate dedicated below-market non-profit rental housing and on-site childcare spaces.\n\n## Municipal Mayors and Development Industry Praise\n\nMayors from Burnaby, Coquitlam, and Surrey commended the grant program, pointing out that utility infrastructure deficits have been the single largest obstacle to translating transit zoning into completed homes.\n\nThe Urban Development Institute stated that the provincial fund will prevent costly development cost charges (DCCs) from inflating purchase prices for first-time homebuyers.\n\n## Application Portals and Funding Awards\n\nMunicipalities can submit phase-one infrastructure grant applications through October 31, 2026, with the first round of capital awards announced in December.",
    "seoTitle": "Minister Kahlon Launches $250M Transit Housing Infrastructure Fund | Choseno",
    "metaDescription": "B.C. Housing Minister Ravi Kahlon announces $250M in municipal grants to build water and power infrastructure near transit housing hubs.",
    "tags": ["Ravi Kahlon", "David Eby", "British Columbia", "Housing", "Transit", "Infrastructure", "Municipal"],
    "tweet": "B.C. Housing Minister Ravi Kahlon launches a 250 million dollar infrastructure fund to help municipalities build water and utility upgrades near transit stations.",
    "breakingNews": false,
    "author": { "name": "Choseno British Columbia Desk", "bio": "B.C. provincial housing strategy, municipal planning, and transit infrastructure" },
    "sources": [
      { "label": "BC Gov News", "url": "https://news.gov.bc.ca/releases/2026HOUS0089-001302" },
      { "label": "Daily Hive Vancouver", "url": "https://dailyhive.com/vancouver/bc-transit-oriented-development-infrastructure-fund-kahlon-2026" }
    ],
    "taggedPoliticianIds": ["472949c0-825a-498c-8a8e-33b6d292286e", "a730729a-0a3b-4231-b93d-9b5524f9db5e"],
    "taggedPoliticians": ["Ravi Kahlon", "David Eby"]
  },
  {
    "slug": "bloc-quebecois-leader-blanchet-sets-conditions-for-fall-parliamentary-cooperation-2026-08-20",
    "headline": "Bloc Québécois Leader Blanchet Demands Senior Care and Dairy Enactments for Fall House Support",
    "summary": "Bloc Québécois Leader Yves-François Blanchet outlines non-negotiable legislative conditions, including increased OAS pensions for seniors aged 65 to 74, for parliamentary cooperation.",
    "category": "Congress",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-20T13:15:00Z",
    "published_at": "2026-08-20T13:45:00Z",
    "impactArea": "country",
    "latitude": 45.5017,
    "longitude": -73.5673,
    "body": "MONTREAL, QC — Bloc Québécois Leader Yves-François Blanchet addressed media in Montreal Thursday morning, laying down strict legislative conditions for the minority government to secure Bloc support on confidence votes when Parliament resumes in September.\n\n## Legislative Conditions and Pension Enhancements\n\nLeader Blanchet reaffirmed that the Bloc caucus will demand immediate passage of private member’s Bill C-319, which increases Old Age Security (OAS) monthly payouts by 10 percent for seniors aged 65 to 74, ending the statutory tier system created in 2022. The Bloc is also demanding immediate royal assent for Bill C-282, which prohibits federal trade negotiators from making concessions on supply-managed dairy, egg, and poultry sectors in future international agreements.\n\nBlanchet stated that if the government fails to implement royal recommendation for the senior pension expansion before October 29, the Bloc will actively support non-confidence motions.\n\n## Parliamentary Arithmetic and Government Strategy\n\nIn the current minority House of Commons, the governing Liberals require support from at least one major opposition party to pass budget measures and maintain confidence. Political strategists noted that Blanchet’s ultimatum increases pressure on federal finance officials during ongoing pre-budget consultations.\n\nSenior advocacy organizations commended the pension push, while fiscal think-tanks noted the measure would add approximately $3.2 billion in annual statutory federal expenditures.\n\n## Fall Caucus Meetings Scheduled\n\nThe Bloc Québécois caucus will convene for its pre-sessional planning retreat in Drummondville on September 9–10, 2026.",
    "seoTitle": "Bloc Leader Blanchet Sets Fall Legislative Demands | Choseno",
    "metaDescription": "Bloc Québécois Leader Yves-François Blanchet outlines demands, including senior pension hikes, to support the minority government this fall.",
    "tags": ["Yves-François Blanchet", "Bloc Québécois", "House of Commons", "Quebec", "Pensions", "Trade", "Seniors"],
    "tweet": "Bloc Québécois Leader Yves-François Blanchet demands senior pension increases and dairy protections as conditions to support the minority government this fall.",
    "breakingNews": false,
    "author": { "name": "Choseno Quebec Bureau", "bio": "Federal parliamentary affairs, Quebec nationalist politics, and social policy" },
    "sources": [
      { "label": "Le Devoir", "url": "https://www.ledevoir.com/politique/canada/874150/blanchet-exige-la-hausse-de-la-pension-de-vieillesse-2026" },
      { "label": "La Presse", "url": "https://www.lapresse.ca/actualites/politique/politique-federale/2026-08-20/ultimatum-du-bloc-quebecois-pensions-et-gestion-de-l-offre.php" }
    ],
    "taggedPoliticianIds": ["2dffb263-e217-4ded-8c2a-26befa6a5a65"],
    "taggedPoliticians": ["Yves-François Blanchet"]
  },
  {
    "slug": "freeland-highlights-clean-economy-investment-tax-credit-implementation-milestones-2026-08-20",
    "headline": "Deputy Prime Minister Freeland Details Delivery of $28B Clean Economy Tax Credits",
    "summary": "Deputy Prime Minister Chrystia Freeland confirms that five major Clean Economy Investment Tax Credits are now operational, driving $28 billion in clean industrial investment.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T13:45:00Z",
    "published_at": "2026-08-20T14:15:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Deputy Prime Minister Chrystia Freeland delivered a comprehensive economic update Thursday regarding the administrative rollout of Canada’s five major Clean Economy Investment Tax Credits (ITCs), confirming that over $28 billion in capital projects are currently progressing through Canada Revenue Agency (CRA) certification portals.\n\n## Statutory Tax Credit Portfolios and Labor Requirements\n\nThe enacted tax credit suite includes refundable credits for Clean Technology (up to 30%), Clean Hydrogen (up to 40%), Clean Electricity (up to 15%), Carbon Capture and Storage (up to 60%), and Clean Technology Manufacturing (up to 30%). Deputy Prime Minister Freeland highlighted that qualifying for maximum credit rates requires companies to pay prevailing union-negotiated wages and ensure that at least 10 percent of trade apprentice hours are utilized on construction sites.\n\nThe Department of Finance estimates that the credits will support the creation of over 85,000 skilled trade jobs over the next five years.\n\n## Industrial Response and Global Competitiveness\n\nClean energy developers in Alberta, Saskatchewan, and Ontario commended the publication of final technical guidance, noting that statutory certainty allows major hydrogen, solar, and battery storage projects to reach final investment decisions (FID).\n\nBuilding Trades Unions praised the labor requirements for guaranteeing competitive wages for Canadian construction workers.\n\n## CRA Certification Dockets and Reporting\n\nThe Canada Revenue Agency will publish its first annual public registry of approved clean economy tax credit allocations in October 2026.",
    "seoTitle": "Freeland Details Delivery of $28B Clean Economy Tax Credits | Choseno",
    "metaDescription": "Deputy Prime Minister Chrystia Freeland confirms five major Clean Economy Tax Credits are fully operational, backing $28B in clean energy projects.",
    "tags": ["Chrystia Freeland", "Economy", "Clean Energy", "Taxes", "Finance", "Labor", "Infrastructure"],
    "tweet": "Deputy Prime Minister Chrystia Freeland confirms five major Clean Economy Tax Credits are fully operational, supporting 28 billion dollars in clean energy investments.",
    "breakingNews": false,
    "author": { "name": "Choseno Financial & Economic Desk", "bio": "Federal fiscal policy, clean economy taxation, and major economic investment" },
    "sources": [
      { "label": "Department of Finance Canada", "url": "https://www.canada.ca/en/department-finance/news/2026/08/deputy-prime-minister-updates-clean-economy-itc-delivery.html" },
      { "label": "BNN Bloomberg", "url": "https://www.bnnbloomberg.ca/business/2026/08/20/freeland-updates-clean-economy-tax-credits-rollout/" }
    ],
    "taggedPoliticianIds": ["4674a6d5-d9c0-4ec8-95ab-9a12cc27b5fa"],
    "taggedPoliticians": ["Chrystia Freeland"]
  },
  {
    "slug": "florida-governor-desantis-signs-maritime-infrastructure-resiliency-grants-2026-08-20",
    "headline": "Governor DeSantis Awards $85M in Coastal Storm Surge and Port Hardening Grants",
    "summary": "Florida Governor Ron DeSantis announces $85 million in Resilient Florida grants to harden seaport bulkheads, stormwater drainage, and municipal seawalls across ten coastal counties.",
    "category": "Infrastructure",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-20T13:30:00Z",
    "published_at": "2026-08-20T14:00:00Z",
    "impactArea": "state",
    "latitude": 30.4383,
    "longitude": -84.2807,
    "body": "TALLAHASSEE, FL — Governor Ron DeSantis announced the distribution of $85 million in state resilience grants Thursday during a press conference in Tampa, funding 24 coastal hardening and flood mitigation infrastructure projects across Florida seaports and coastal municipalities.\n\n## Resilient Florida Grant Allocations\n\nFunded through the state's Resilient Florida Program, the grants provide dedicated capital for deep-water bulkhead elevation at Port Tampa Bay and Port Everglades, high-capacity stormwater pump stations in Pinellas and Lee counties, and natural living shoreline wave attenuation projects in the Florida Keys. The state awards match local municipal bonding funds dollar-for-dollar, accelerating project completion ahead of future hurricane seasons.\n\nGovernor DeSantis stated that protecting critical maritime infrastructure is vital for state commercial logistics and petroleum fuel distribution networks.\n\n## Economic Protection and Property Insurance Mitigation\n\nPort directors and municipal leaders emphasized that hardening coastal infrastructure directly reduces post-storm business disruption and helps mitigate soaring commercial property insurance premiums.\n\nThe Florida Department of Environmental Protection (DEP) confirmed that all 24 funded projects have completed certified hydrological modeling to ensure adjacent communities do not experience adverse flood displacement.\n\n## Construction Timetable and Project Milestones\n\nLocal municipal and port authorities must break ground on approved coastal hardening projects by November 1, 2026, with construction phased over 24 months.",
    "seoTitle": "Governor DeSantis Awards $85M for Coastal Infrastructure Resilience | Choseno",
    "metaDescription": "Florida Governor Ron DeSantis awards $85M in Resilient Florida grants to harden seaport bulkheads and municipal stormwater systems.",
    "tags": ["Ron DeSantis", "Florida", "Infrastructure", "Environment", "Ports", "Resilience"],
    "tweet": "Florida Governor Ron DeSantis awards 85 million dollars in Resilient Florida grants to harden seaport bulkheads and municipal stormwater systems across 10 counties.",
    "breakingNews": false,
    "author": { "name": "Choseno Florida Desk", "bio": "Florida state governance, coastal resilience infrastructure, and executive policy" },
    "sources": [
      { "label": "Executive Office of Governor Ron DeSantis", "url": "https://www.flgov.com/2026/08/20/governor-desantis-awards-85-million-for-coastal-resilience/" },
      { "label": "Tampa Bay Times", "url": "https://www.tampabay.com/news/florida-politics/2026/08/20/desantis-awards-port-tampa-bay-coastal-resilience-grants/" }
    ],
    "taggedPoliticianIds": ["fc437e5a-1d25-4904-959e-88add7928b50"],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "intergovernmental-minister-leblanc-coordinates-border-security-modernization-2026-08-20",
    "headline": "Minister LeBlanc Coordinates $120M Cross-Border Trade Technology Enhancement with U.S.",
    "summary": "Intergovernmental and Trade Minister Dominic LeBlanc details joint Canada-U.S. border technology investments to deploy automated non-intrusive cargo scanners at high-volume crossings.",
    "category": "Trade",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T13:15:00Z",
    "published_at": "2026-08-20T13:45:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Minister of Intergovernmental Affairs and Senior Trade Envoy Dominic LeBlanc announced Thursday that Canada and the United States have agreed to coordinate a $120 million border technology modernization initiative, deploying advanced automated cargo inspection systems across major commercial land ports of entry.\n\n## Bi-National Border Modernization and Supply Chain Velocity\n\nThe joint plan, developed in parallel with ongoing cross-border trade negotiations, installs high-throughput multi-energy X-ray portals and automated license plate verification systems at the Ambassador Bridge (Windsor-Detroit), Blue Water Bridge (Sarnia-Port Huron), and Pacific Highway (Surrey-Blaine) border crossings. The technology enables the Canada Border Services Agency (CBSA) and U.S. Customs and Border Protection (CBP) to scan commercial freight in motion, reducing average customs inspection wait times from 45 minutes to under six minutes per commercial vehicle.\n\nMinister LeBlanc noted that eliminating cross-border freight bottlenecks saves Canadian exporters an estimated $420 million annually in transit logistics overhead.\n\n## Supply Chain Security and Trade Protections\n\nAutomotive manufacturers and trucking associations strongly welcomed the modernization, stating that real-time digital verification strengthens supply chain security while protecting just-in-time manufacturing schedules.\n\nCBSA and CBP officials affirmed that joint data protocols strictly adhere to national privacy statutes and biometric disclosure protections.\n\n## Installation Schedule and Operational Go-Live\n\nPhase-one portal installation will begin at the Ambassador Bridge in October 2026, with full bi-national commercial operational capability scheduled for spring 2027.",
    "seoTitle": "Minister LeBlanc Details $120M Border Trade Technology Upgrade | Choseno",
    "metaDescription": "Minister Dominic LeBlanc announces a $120M joint Canada-US border technology project to deploy high-speed automated cargo inspection systems.",
    "tags": ["Dominic LeBlanc", "Trade", "Border Security", "Economy", "Transportation", "CUSMA"],
    "tweet": "Minister Dominic LeBlanc announces a 120 million dollar joint Canada-U.S. border technology project to deploy high-speed automated commercial cargo scanners.",
    "breakingNews": false,
    "author": { "name": "Choseno Trade & Foreign Affairs Desk", "bio": "Cross-border trade diplomacy, customs modernizations, and bilateral logistics" },
    "sources": [
      { "label": "Global Affairs Canada", "url": "https://www.international.gc.ca/gac-amc/news-nouvelles/2026-08-20-border-trade-technology.aspx" },
      { "label": "Windsor Star", "url": "https://windsorstar.com/news/local-news/leblanc-announces-automated-cargo-scanners-ambassador-bridge-2026" }
    ],
    "taggedPoliticianIds": ["885e12f5-33d9-42a1-8dc9-b276069da88d"],
    "taggedPoliticians": ["Dominic LeBlanc"]
  },
  {
    "slug": "foreign-minister-joly-announces-40m-humanitarian-corridor-support-for-sudan-2026-08-20",
    "headline": "Foreign Minister Joly Directs $40M in Emergency Humanitarian Relief for Displaced Families in Sudan",
    "summary": "Foreign Affairs Minister Mélanie Joly allocates $40 million in emergency Canadian humanitarian assistance to support UN food distribution and medical aid in Sudan and Chad.",
    "category": "Foreign Policy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T13:00:00Z",
    "published_at": "2026-08-20T13:30:00Z",
    "impactArea": "international",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Minister of Foreign Affairs Mélanie Joly announced Thursday that Canada is allocating $40 million in immediate international humanitarian assistance to address severe famine conditions and civilian displacement across Sudan and neighboring refugee transit zones in Chad.\n\n## International Aid Allocation and Humanitarian Partners\n\nChannelled through trusted United Nations agencies, the International Committee of the Red Cross (ICRC), and Canadian non-governmental organizations, the relief funding delivers emergency therapeutic nutrition, potable water purification systems, and mobile trauma medical teams to conflict-impacted populations in Darfur, Khartoum, and Kordofan. Over $12 million is specifically designated for child health and gender-based violence response centers in regional refugee camps.\n\nMinister Joly called on all warring factions in Sudan to respect international humanitarian law and ensure unhindered, safe cross-border access for humanitarian aid convoys.\n\n## Diplomatic Leadership and Multilateral Sanctions\n\nGlobal Affairs Canada confirmed that it is coordinating with international partners in Geneva and New York to expand targeted sanctions against paramilitary commanders and financial networks responsible for blocking humanitarian relief corridors.\n\nCanadian humanitarian aid organizations praised the rapid disbursement, noting that international aid appeals for Sudan remain severely underfunded amid the world's largest displacement crisis.\n\n## Disbursement Timeline and UN Coordination\n\nThe humanitarian funding will be transferred to partner agencies immediately, with emergency food shipments departing from regional logistics hubs over the coming days.",
    "seoTitle": "Minister Joly Announces $40M Emergency Humanitarian Aid for Sudan | Choseno",
    "metaDescription": "Foreign Affairs Minister Mélanie Joly announces $40M in Canadian emergency aid to support food distribution and medical relief in Sudan and Chad.",
    "tags": ["Mélanie Joly", "Foreign Policy", "Humanitarian Aid", "Global Affairs", "Sudan", "United Nations"],
    "tweet": "Foreign Affairs Minister Mélanie Joly directs 40 million dollars in emergency Canadian humanitarian assistance to deliver food and medical relief in Sudan.",
    "breakingNews": false,
    "author": { "name": "Choseno International Affairs Desk", "bio": "Canadian foreign policy, international development assistance, and global diplomacy" },
    "sources": [
      { "label": "Global Affairs Canada", "url": "https://www.international.gc.ca/gac-amc/news-nouvelles/2026-08-20-humanitarian-aid-sudan.aspx" },
      { "label": "CBC News", "url": "https://www.cbc.ca/news/politics/joly-announces-40-million-humanitarian-aid-sudan-2026" }
    ],
    "taggedPoliticianIds": ["9d4b37d7-06e7-4df1-b9a5-e068a776ba86"],
    "taggedPoliticians": ["Mélanie Joly"]
  },
  {
    "slug": "nova-scotia-premier-houston-advances-offshore-wind-and-green-hydrogen-framework-2026-08-20",
    "headline": "Premier Houston Outlines Nova Scotia Offshore Wind Licensing and Clean Energy Export Vision",
    "summary": "Nova Scotia Premier Tim Houston pitches international energy executives in Alberta on the province's competitive advantages for five gigawatts of offshore wind development.",
    "category": "Energy",
    "country": "CA",
    "province": "NS",
    "status": "published",
    "eventDate": "2026-08-20T13:15:00Z",
    "published_at": "2026-08-20T13:45:00Z",
    "impactArea": "state",
    "latitude": 44.6488,
    "longitude": -63.5752,
    "body": "BANFF, AB — Speaking to international energy investors and utility executives Thursday at the Canadian Energy Executive Association annual conference, Nova Scotia Premier Tim Houston outlined the province's regulatory and commercial roadmap to license five gigawatts of offshore wind capacity by 2030.\n\n## Marine Spatial Planning and Crown Lease Auctions\n\nPremier Houston confirmed that the joint federal-provincial Canada-Nova Scotia Offshore Energy Board will launch its inaugural offshore wind seabed call for bids in early 2027. Supported by statutory amendments under Bill 157, the province is streamlining environmental assessments for floating wind turbine arrays situated off the Atlantic coast, aiming to power domestic green hydrogen production hubs in Point Tupper and export clean electricity to New England wholesale markets.\n\nThe Premier noted that Nova Scotia’s world-class offshore wind speeds rival the North Sea, positioning Atlantic Canada as an emerging green energy superpower.\n\n## Local Supply Chains and First Nations Equity\n\nThe provincial strategy mandates that offshore development consortia incorporate at least 10 percent equity participation options for Mi'kmaq First Nations and commit to utilizing local marine engineering and shipyard fabrication facilities in Halifax and Cape Breton.\n\nClean energy trade associations praised the initiative for providing long-term regulatory clarity for international developers.\n\n## Consultation Timelines and Environmental Studies\n\nRegional environmental baseline studies and regional marine spatial consultations will conclude in November 2026 prior to the publication of the final lease auction terms.",
    "seoTitle": "Premier Houston Details Nova Scotia 5 GW Offshore Wind Vision | Choseno",
    "metaDescription": "Nova Scotia Premier Tim Houston presents the province's regulatory plan to license 5 GW of offshore wind and clean hydrogen export hubs by 2030.",
    "tags": ["Tim Houston", "Nova Scotia", "Energy", "Wind Energy", "Clean Tech", "Atlantic Canada", "Indigenous"],
    "tweet": "Nova Scotia Premier Tim Houston outlines the province's plan to license 5 gigawatts of offshore wind and green hydrogen export hubs by 2030.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Bureau", "bio": "Nova Scotia governance, offshore renewable energy, and Atlantic economic development" },
    "sources": [
      { "label": "Province of Nova Scotia Releases", "url": "https://novascotia.ca/news/release/?id=20260820003" },
      { "label": "The Chronicle Herald", "url": "https://www.thechronicleherald.ca/business/houston-pitches-nova-scotia-offshore-wind-banff-conference-2026/" }
    ],
    "taggedPoliticianIds": ["bcb1700f-740e-4d7c-8542-e346b4fb44f0"],
    "taggedPoliticians": ["Tim Houston"]
  },
  {
    "slug": "quebec-premier-legault-announces-180m-critical-minerals-processing-fund-2026-08-20",
    "headline": "Premier Legault Allocates $180M to Expand Lithium and Battery Mineral Refining in Bécancour",
    "summary": "Quebec Premier François Legault commits $180 million from Investissement Québec to expand domestic refining capacity for lithium and battery components in the Energy Transition Valley.",
    "category": "Economy",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-20T13:45:00Z",
    "published_at": "2026-08-20T14:15:00Z",
    "impactArea": "state",
    "latitude": 46.8139,
    "longitude": -71.2080,
    "body": "BÉCANCOUR, QC — Premier François Legault announced Thursday that the Government of Quebec is investing $180 million through Investissement Québec to support the construction and expansion of advanced commercial refining facilities for battery-grade lithium and cathode active materials in the Bécancour Energy Transition Valley.\n\n## Critical Minerals Value Chain and Industrial Strategy\n\nThe provincial funding package provides repayable loans and equity participation for industrial processing hubs converting hard-rock spodumene ore from Northern Quebec into high-purity lithium hydroxide and synthetic graphite. The facilities will directly feed supply chains for automotive battery gigafactories in Quebec, Ontario, and the northeastern United States.\n\nPremier Legault emphasized that developing end-to-end processing within Quebec ensures the province captures the maximum economic value from its natural mineral wealth rather than exporting raw, unrefined concentrate overseas.\n\n## Environmental Standards and Hydro-Québec Power Delivery\n\nThe industrial facilities will be powered by Hydro-Québec’s dedicated clean hydroelectric grid, reducing lifecycle carbon emissions by up to 70 percent compared to conventional refining operations.\n\nRegional municipal mayors and labor unions commended the investment, projecting the creation of over 850 high-paying industrial jobs in the Centre-du-Québec region.\n\n## Construction Milestones and Facility Commissioning\n\nPhase-two refinery expansion construction will break ground in October 2026, with full commercial refining operations slated to go online by mid-2028.",
    "seoTitle": "Premier Legault Announces $180M for Quebec Lithium Refining | Choseno",
    "metaDescription": "Quebec Premier François Legault invests $180M from Investissement Québec to expand critical mineral and lithium refining in Bécancour.",
    "tags": ["François Legault", "Quebec", "Critical Minerals", "Economy", "Battery", "Energy", "Hydro-Québec"],
    "tweet": "Quebec Premier François Legault announces a 180 million dollar provincial investment to expand lithium and battery mineral refining in Bécancour.",
    "breakingNews": false,
    "author": { "name": "Choseno Quebec Bureau", "bio": "Quebec industrial policy, critical minerals, and National Assembly governance" },
    "sources": [
      { "label": "Cabinet du premier ministre du Québec", "url": "https://www.quebec.ca/nouvelles/actualites/details/legault-annonce-180-millions-pour-la-filiere-batterie-becancour-2026" },
      { "label": "Le Soleil", "url": "https://www.lesoleil.com/affaires/2026/08/20/quebec-injecte-180-m-dans-la-vallee-de-la-batterie-a-becancour/" }
    ],
    "taggedPoliticianIds": ["19f76830-8288-487c-8ce7-0d6f64b0bb4a"],
    "taggedPoliticians": ["François Legault"]
  },
  {
    "slug": "texas-governor-abbott-directs-ercot-and-puc-to-audit-data-center-power-draw-2026-08-20",
    "headline": "Governor Abbott Orders Statewide ERCOT Audit of Grid Interconnection Requests for AI Facilities",
    "summary": "Texas Governor Greg Abbott directs the Public Utility Commission and ERCOT to audit all pending data center grid applications, requiring independent backup generation commitments.",
    "category": "Energy",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-20T14:00:00Z",
    "published_at": "2026-08-20T14:30:00Z",
    "impactArea": "state",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "body": "AUSTIN, TX — Governor Greg Abbott issued formal executive directives Thursday morning to the Public Utility Commission of Texas (PUCT) and the Electric Reliability Council of Texas (ERCOT), ordering an immediate forensic audit of more than 40,000 megawatts of commercial interconnection requests submitted by artificial intelligence data centers and crypto-mining facilities.\n\n## Grid Interconnection Audits and Firm Capacity Rules\n\nThe gubernatorial directive requires ERCOT to scrutinize speculative interconnection requests that risk clogging the transmission queue and artificially inflating grid expansion costs for residential consumers. Under the new guidelines, prospective large flexible loads exceeding 75 megawatts will only receive grid approvals if they contract for dedicated dispatchable on-site generation, such as natural gas turbines, or agree to firm, automated curtailment during grid emergencies.\n\nGovernor Abbott affirmed that while Texas remains the premier destination for technological innovation, the state will not compromise grid reliability for residential homeowners and critical businesses.\n\n## Market Impact and Transmission Planning\n\nERCOT CEO Pablo Vegas confirmed that grid operators will implement the audit immediately, removing inactive or non-compliant project applications from the interconnection queue to accelerate viable infrastructure projects.\n\nIndustrial energy consumer panels supported the directive, emphasizing that transparent queue management protects Texas's competitive power market from speculative capacity hoarding.\n\n## Regulatory Rulemaking and Public Reports\n\nThe PUCT will publish initial audit findings and open public rulemaking dockets on large load interconnection standards on September 10, 2026.",
    "seoTitle": "Governor Abbott Orders ERCOT Audit of Data Center Grid Applications | Choseno",
    "metaDescription": "Texas Governor Greg Abbott directs ERCOT and PUCT to audit all pending data center grid interconnection requests to ensure grid reliability.",
    "tags": ["Greg Abbott", "Texas", "Energy", "ERCOT", "Grid", "Technology", "AI"],
    "tweet": "Texas Governor Greg Abbott orders ERCOT and the PUCT to audit all pending data center grid interconnection requests and enforce firm backup power rules.",
    "breakingNews": false,
    "author": { "name": "Choseno Texas Policy Desk", "bio": "Texas energy markets, ERCOT grid reliability, and executive utility regulation" },
    "sources": [
      { "label": "Office of the Texas Governor", "url": "https://gov.texas.gov/news/post/governor-abbott-directs-ercot-puc-to-audit-data-center-interconnection-requests" },
      { "label": "Houston Chronicle", "url": "https://www.houstonchronicle.com/business/energy/article/abbott-orders-ercot-data-center-audit-texas-grid-2026.php" }
    ],
    "taggedPoliticianIds": ["82d5f358-a471-4b4d-b052-843ef9934ad3"],
    "taggedPoliticians": ["Greg Abbott"]
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
        batch_number: '2026-08-20 14:50',
        viral_score: 9.0,
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
