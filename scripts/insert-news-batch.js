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

// 2. Article payload to ingest (Dynamic Lookback Window Batch Part 2: 2026-08-20T14:30:00Z to 2026-08-20T21:21:17Z)
const articles = [
  {
    "slug": "pei-court-of-appeal-hears-maritime-electric-post-fiona-cost-recovery-dispute-2026-08-20",
    "headline": "P.E.I. Court of Appeal Hears Power Utility Challenge to Fiona Grid Restoration Caps",
    "summary": "Maritime Electric challenges an IRAC regulatory ruling that denied recovery of $16 million in post-tropical storm Fiona grid repair costs from ratepayer bills.",
    "category": "Judiciary",
    "country": "CA",
    "province": "PE",
    "status": "published",
    "eventDate": "2026-08-20T18:30:00Z",
    "published_at": "2026-08-20T19:00:00Z",
    "impactArea": "state",
    "latitude": 46.2382,
    "longitude": -63.1311,
    "body": "CHARLOTTETOWN, PE — The Prince Edward Island Court of Appeal heard oral arguments Thursday afternoon in *Maritime Electric Company, Limited v. Island Regulatory and Appeals Commission (IRAC)*, reviewing whether provincial utility regulators committed an error of law by disallowing the recovery of $16 million in emergency restoration expenses following Post-Tropical Storm Fiona.\n\n## Utility Ratemaking and Storm Cost Prudence Standards\n\nThe dispute centers on an IRAC directive that disallowed a portion of Maritime Electric’s $37 million storm restoration cost-recovery application, determining that inadequate preventative vegetation management along transmission corridors contributed to widespread pole failures during the historic 2022 storm. Counsel for Maritime Electric argued that the regulatory tribunal applied hindsight bias and exceeded its statutory discretion under the Electric Power Act (RSPEI 1988, c. E-4), leaving the utility with unrecovered capital debts that impair future borrowing capacity.\n\nProvincial consumer advocates representing residential ratepayers countered that island homeowners should not be forced to subsidize deferred utility maintenance costs through double-digit rate hikes.\n\n## Climate Resilience and Grid Hardening\n\nEnergy analysts in Atlantic Canada highlighted that the appellate ruling will establish critical regional precedent for how private utilities and public regulators share the mounting costs of extreme weather events and climate resilience investments.\n\nIsland municipal leaders submitted filings emphasizing that transparent, fair utility rates are essential for household economic security.\n\n## Judgment Reserved by Appellate Panel\n\nThe three-judge appellate panel took the matter under advisement following three hours of argument, with a formal written decision expected within sixty days.",
    "seoTitle": "P.E.I. Court of Appeal Hears Maritime Electric Storm Fiona Appeal | Choseno",
    "metaDescription": "The P.E.I. Court of Appeal hears arguments on whether Maritime Electric can recover $16M in Fiona storm repairs from electricity consumers.",
    "tags": ["Prince Edward Island", "Judiciary", "Energy", "Climate", "Courts", "Utilities"],
    "tweet": "The P.E.I. Court of Appeal hears arguments on whether Maritime Electric can pass 16 million dollars in post-tropical storm Fiona repair costs to ratepayers.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Bureau", "bio": "Atlantic Canadian appellate courts, public utility law, and provincial energy regulation" },
    "sources": [
      { "label": "CBC News Prince Edward Island", "url": "https://www.cbc.ca/news/canada/prince-edward-island/maritime-electric-irac-appeal-fiona-costs-2026" },
      { "label": "The Guardian PEI", "url": "https://www.theguardian.pe.ca/news/local/maritime-electric-court-of-appeal-hearing-fiona-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "quebec-premier-frechette-unveils-regional-economic-candidates-roberval-2026-08-20",
    "headline": "Premier Fréchette Announces Regional Resource and Industrial Slate in Roberval",
    "summary": "Quebec Premier Christine Fréchette presents the Coalition Avenir Québec’s regional election nominees in the Saguenay–Lac-Saint-Jean region, prioritizing forestry modernization.",
    "category": "Elections",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-20T18:15:00Z",
    "published_at": "2026-08-20T18:45:00Z",
    "impactArea": "state",
    "latitude": 48.5167,
    "longitude": -72.2333,
    "body": "ROBERVAL, QC — Premier Christine Fréchette visited the Saguenay–Lac-Saint-Jean region Thursday afternoon, officially introducing the Coalition Avenir Québec (CAQ) candidates for the upcoming provincial elections while outlining an economic strategy to support northern resource-dependent communities.\n\n## Forestry Modernization and Hydroelectric Supply\n\nSpeaking at a wood processing innovation center in Roberval, Premier Fréchette announced a proposed $220 million regional economic envelope dedicated to modernizing northern sawmills, supporting bio-mass energy production, and guaranteeing stable Hydro-Québec industrial power blocks for regional metallurgical and aluminum smelters. The Premier stressed that sustainable regional economic development requires decentralizing economic development funding directly to MRC municipal regional county councils.\n\nFréchette addressed recent trade tensions with the United States, confirming that Quebec will vigorously protect its domestic supply-managed agricultural sectors and forestry export quotas in ongoing bilateral negotiations.\n\n## Regional Municipalities and Labor Priorities\n\nRegional union leaders from Unifor and the FTQ participated in roundtable discussions with the Premier, highlighting the urgency of immediate loan guarantees and silvicultural employment programs to stabilize small resource towns experiencing fluctuating international timber demand.\n\nMunicipal mayors from Roberval and Saint-Félicien welcomed the government's commitment to maintaining local healthcare and maternity services in peripheral hospitals.\n\n## Campaign Itinerary in Central Quebec\n\nThe Premier’s regional tour will continue Friday with economic roundtable sessions in Alma and Chicoutimi.",
    "seoTitle": "Premier Fréchette Unveils Northern Resource Candidates in Roberval | Choseno",
    "metaDescription": "Quebec Premier Christine Fréchette introduces regional CAQ candidates in Roberval, pledging $220M for northern forestry and industrial innovation.",
    "tags": ["François Legault", "Quebec", "Elections", "Economy", "Forestry", "Energy", "CAQ"],
    "tweet": "Quebec Premier Christine Fréchette unveils CAQ regional candidates in Roberval, outlining a 220 million dollar forestry modernization program.",
    "breakingNews": false,
    "author": { "name": "Choseno Quebec Bureau", "bio": "National Assembly politics, Quebec regional economics, and provincial election campaigns" },
    "sources": [
      { "label": "CPAC News", "url": "https://www.cpac.ca/politics/quebec-election-slate-frechette-roberval-2026" },
      { "label": "Le Quotidien", "url": "https://www.lequotidien.com/actualites/politique/2026/08/20/frechette-devoile-ses-candidats-au-lac-saint-jean/" }
    ],
    "taggedPoliticianIds": ["19f76830-8288-487c-8ce7-0d6f64b0bb4a"],
    "taggedPoliticians": ["François Legault"]
  },
  {
    "slug": "manitoba-premier-kinew-demands-hardline-federal-protection-for-dairy-and-manufacturing-2026-08-20",
    "headline": "Premier Kinew Urges Federal Negotiators to Stand Firm on Agricultural and Manufacturing Protections",
    "summary": "Manitoba Premier Wab Kinew cautions Ottawa against making agricultural and industrial concessions in Washington trade talks, advocating for robust supply-managed dairy protections.",
    "category": "Trade",
    "country": "CA",
    "province": "MB",
    "status": "published",
    "eventDate": "2026-08-20T19:30:00Z",
    "published_at": "2026-08-20T20:00:00Z",
    "impactArea": "state",
    "latitude": 49.8951,
    "longitude": -97.1384,
    "body": "WINNIPEG, MB — Premier Wab Kinew addressed reporters at the Manitoba Legislative Building Thursday afternoon following a first ministers’ conference call on cross-border trade negotiations, warning the federal government that Canadian negotiators must not sacrifice domestic producers to secure a quick trade resolution.\n\n## Supply Management and Provincial Manufacturing Safeguards\n\nPremier Kinew expressed skepticism regarding proposed federal compromises that could open Canadian dairy market access or weaken protective retaliatory tariffs without securing permanent, ironclad exemptions for Prairie manufacturing and heavy bus fabrication exports. Manitoba’s agricultural producers and aerospace manufacturers account for billions in annual export value, making trade predictability vital to the provincial economy.\n\nKinew emphasized that while averting catastrophic 50 percent U.S. tariffs is an urgent priority, Canada must demonstrate resolve rather than capitulating to unilateral trade demands.\n\n## Cross-Border Trucking and Agri-Food Security\n\nThe Premier also highlighted ongoing efforts to ensure streamlined logistics at the Emerson-Pembina land border crossing, noting that delays in agricultural supply chains harm farmers on both sides of the 49th parallel.\n\nManitoba Keystone Agricultural Producers and farm commodity groups supported the Premier’s firm stance, stating that family dairy and poultry operations form the backbone of rural Prairie communities.\n\n## Upcoming First Ministers Council Meeting\n\nProvincial premiers will convene a special virtual meeting of the Council of the Federation once the final legal text of the Canada-U.S. trade accord is presented by federal ministers.",
    "seoTitle": "Premier Kinew Urges Tough Line in Canada-U.S. Trade Talks | Choseno",
    "metaDescription": "Manitoba Premier Wab Kinew warns federal negotiators against agricultural concessions in Washington trade talks, defending supply management.",
    "tags": ["Wab Kinew", "Manitoba", "Trade", "Agriculture", "Manufacturing", "Economy"],
    "tweet": "Manitoba Premier Wab Kinew cautions federal negotiators against agricultural concessions in Washington trade talks, defending dairy supply management.",
    "breakingNews": false,
    "author": { "name": "Choseno Prairie Affairs Desk", "bio": "Manitoba provincial government, Prairie agricultural economics, and intergovernmental trade" },
    "sources": [
      { "label": "CBC News Manitoba", "url": "https://www.cbc.ca/news/canada/manitoba/kinew-warns-ottawa-trade-talks-concessions-2026" },
      { "label": "Winnipeg Free Press", "url": "https://www.winnipegfreepress.com/breakingnews/2026/08/20/kinew-demands-firm-stance-in-us-trade-dispute" }
    ],
    "taggedPoliticianIds": ["38870346-a851-434d-b894-8362aedc4966"],
    "taggedPoliticians": ["Wab Kinew"]
  },
  {
    "slug": "houston-restocks-american-alcohol-in-nova-scotia-as-trade-goodwill-gesture-2026-08-20",
    "headline": "Premier Houston Directs Nova Scotia Liquor Corporation to Restock American Alcohol",
    "summary": "Nova Scotia Premier Tim Houston instructs the NSLC to return American spirits and wines to retail shelves, supporting federal trade negotiators in Washington.",
    "category": "Trade",
    "country": "CA",
    "province": "NS",
    "status": "published",
    "eventDate": "2026-08-20T19:00:00Z",
    "published_at": "2026-08-20T19:30:00Z",
    "impactArea": "state",
    "latitude": 44.6488,
    "longitude": -63.5752,
    "body": "HALIFAX, NS — Premier Tim Houston announced Thursday afternoon that the Government of Nova Scotia has issued formal directives to the Nova Scotia Liquor Corporation (NSLC) to immediately restore American-produced spirits, beers, and wines to retail store shelves across the province.\n\n## Provincial De-escalation and Federal Trade Coordination\n\nThe decision responds to a direct request made by Prime Minister Mark Carney to provincial premiers, seeking to eliminate non-tariff trade irritants that U.S. negotiators cited during high-stakes tariff negotiations in Washington. Nova Scotia had originally removed American alcohol products in a coordinated provincial response to threatened 50 percent U.S. tariffs on Canadian tire, seafood, and forestry exports.\n\nPremier Houston stated that showing constructive goodwill supports Canadian negotiators in securing lasting tariff relief for Nova Scotia’s multi-billion-dollar lobster, tire, and Michelin manufacturing industries.\n\n## Impact on Retail and Local Distillers\n\nThe NSLC confirmed that store inventories will be replenished over the next 72 hours without displacing shelf space dedicated to local Nova Scotia craft breweries and wineries.\n\nSeafood export associations commended the Premier's pragmatic action, emphasizing that cross-border logistics must remain frictionless for perishable fresh lobster and crab shipments to major U.S. markets.\n\n## Interprovincial Alignment and Premiers' Meeting\n\nOther Atlantic and Western Canadian premiers are reviewing similar retail policy adjustments in coordination with federal trade envoys.",
    "seoTitle": "Premier Houston Restocks American Alcohol in Nova Scotia | Choseno",
    "metaDescription": "Nova Scotia Premier Tim Houston directs the NSLC to restock American alcohol to support Canadian trade negotiators in Washington.",
    "tags": ["Tim Houston", "Nova Scotia", "Trade", "Economy", "NSLC", "Atlantic Canada"],
    "tweet": "Nova Scotia Premier Tim Houston directs the NSLC to restock American alcohol, providing constructive goodwill for federal trade negotiators in Washington.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Bureau", "bio": "Nova Scotia provincial governance, trade relations, and Atlantic Canadian commerce" },
    "sources": [
      { "label": "Province of Nova Scotia Executive Council", "url": "https://novascotia.ca/news/release/?id=20260820005" },
      { "label": "The Chronicle Herald", "url": "https://www.thechronicleherald.ca/news/local/houston-restocks-american-alcohol-trade-talks-2026/" }
    ],
    "taggedPoliticianIds": ["bcb1700f-740e-4d7c-8542-e346b4fb44f0"],
    "taggedPoliticians": ["Tim Houston"]
  },
  {
    "slug": "dane-county-court-dismisses-tax-break-residency-challenge-2026-08-20",
    "headline": "Wisconsin Circuit Court Dismisses Residency and Property Tax Exemption Challenge",
    "summary": "Dane County Circuit Court Judge Everett Mitchell dismisses a complaint challenging primary residency lottery tax credits for an elected municipal official.",
    "category": "Judiciary",
    "country": "US",
    "province": "WI",
    "status": "published",
    "eventDate": "2026-08-20T18:00:00Z",
    "published_at": "2026-08-20T18:30:00Z",
    "impactArea": "state",
    "latitude": 43.0731,
    "longitude": -89.4012,
    "body": "MADISON, WI — The Dane County Circuit Court released a summary judgment order Thursday afternoon dismissing a lawsuit that challenged the eligibility of an elected official to claim the Wisconsin Lottery and Gaming Credit on her primary residential property.\n\n## Statutory Residency and Tax Exemption Law\n\nJudge Everett Mitchell ruled that under Wisconsin Statutes § 79.10(9), municipal and county revenue departments possess exclusive statutory authority to evaluate and audit primary domicile claims. The court found that the plaintiffs failed to exhaust administrative remedies with the local board of assessors before initiating civil litigation in circuit court, and presented no admissible evidence of fraudulent intent or unlawful tax avoidance.\n\nThe judgment clarifies the legal threshold required for private citizens to challenge public officials’ property tax filings in state courts.\n\n## Political and Civic Reactions\n\nThe State Senate Democratic Committee commended the court's swift dismissal, characterizing the lawsuit as an unsubstantiated political maneuver designed to distract from local municipal legislative priorities.\n\nLegal counsel for the plaintiffs indicated they are reviewing options for an administrative appeal before the Wisconsin Department of Revenue.\n\n## Circuit Court Finality\n\nThe dismissal was entered with prejudice regarding the circuit court claims, concluding the trial-level proceeding.",
    "seoTitle": "Wisconsin Court Dismisses Property Tax Credit Challenge | Choseno",
    "metaDescription": "Dane County Circuit Court dismisses a civil lawsuit challenging primary residency tax credits for an elected Wisconsin official.",
    "tags": ["Wisconsin", "Judiciary", "Courts", "Taxes", "Municipal", "Elections"],
    "tweet": "Dane County Circuit Court dismisses a lawsuit challenging primary residency property tax credits for an elected Wisconsin official.",
    "breakingNews": false,
    "author": { "name": "Choseno Midwest Legal Desk", "bio": "Wisconsin state courts, municipal taxation law, and administrative jurisprudence" },
    "sources": [
      { "label": "Dane County Circuit Court Records", "url": "https://wcca.wicourts.gov/caseDetail.html?caseNo=2026CV001420" },
      { "label": "WisPolitics", "url": "https://www.wispolitics.com/2026/dane-county-judge-dismisses-tax-credit-lawsuit/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "us-attorney-new-jersey-announces-plea-in-multimillion-dollar-covid-mortgage-fraud-2026-08-20",
    "headline": "U.S. Attorney Announces Guilty Plea in Multimillion-Dollar Mortgage and COVID Loan Scheme",
    "summary": "Federal prosecutors in Newark secure a guilty plea from a real estate investor who orchestrated a multi-state scheme to fraudulently obtain $8.4 million in commercial relief loans.",
    "category": "Judiciary",
    "country": "US",
    "province": "NJ",
    "status": "published",
    "eventDate": "2026-08-20T18:15:00Z",
    "published_at": "2026-08-20T18:45:00Z",
    "impactArea": "country",
    "latitude": 40.7357,
    "longitude": -74.1724,
    "body": "NEWARK, NJ — The U.S. Attorney’s Office for the District of New Jersey announced Thursday afternoon that a prominent real estate investor pleaded guilty before U.S. District Judge Susan D. Wigenton to federal charges of bank fraud and money laundering in connection with an $8.4 million fraudulent loan operation.\n\n## Fraudulent Schemes and Bank Fraud Statues\n\nAccording to court documents and statements made in federal court, the defendant fabricated corporate tax returns, falsified commercial property lease rolls, and created shell entities to illicitly obtain multi-million-dollar mortgages from federally insured financial institutions, alongside Paycheck Protection Program (PPP) and Economic Injury Disaster Loans (EIDL). The proceeds were diverted into personal luxury real estate acquisitions and offshore accounts under the guise of legitimate commercial renovations.\n\nThe prosecution was coordinated through the Justice Department’s COVID-19 Fraud Enforcement Strike Force in partnership with the FBI and IRS Criminal Investigation.\n\n## Federal Sentencing Guidelines and Asset Forfeiture\n\nThe charge of bank fraud carries a maximum statutory penalty of 30 years in federal prison and a $1 million fine. Under the terms of the plea agreement, the defendant agreed to pay $8.4 million in mandatory restitution and forfeit seized residential properties in Essex and Bergen counties.\n\nFederal prosecutors affirmed that investigating pandemic relief fraud remains an active, nationwide DOJ enforcement priority.\n\n## Sentencing Hearing Scheduled\n\nJudge Wigenton scheduled formal sentencing for January 14, 2027, in U.S. District Court in Newark.",
    "seoTitle": "U.S. Attorney Secures Guilty Plea in $8.4M COVID Mortgage Fraud | Choseno",
    "metaDescription": "Federal prosecutors in New Jersey secure a guilty plea in an $8.4M bank fraud and COVID relief loan scheme involving real estate portfolios.",
    "tags": ["Judiciary", "DOJ", "Fraud", "Economy", "Courts", "New Jersey"],
    "tweet": "Federal prosecutors secure a guilty plea in an 8.4 million dollar bank fraud and COVID loan scheme involving real estate portfolios in New Jersey.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal Justice Desk", "bio": "Department of Justice prosecutions, federal financial crimes, and judicial proceedings" },
    "sources": [
      { "label": "U.S. Department of Justice", "url": "https://www.justice.gov/usao-nj/pr/real-estate-investor-pleads-guilty-84-million-mortgage-and-covid-fraud" },
      { "label": "NJ.com", "url": "https://www.nj.com/news/2026/08/new-jersey-man-pleads-guilty-in-multimillion-dollar-mortgage-fraud.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "medicine-hat-city-council-expands-community-recreation-access-2026-08-20",
    "headline": "Medicine Hat City Council Expands Municipal Grant Programs for Community Athletics",
    "summary": "Medicine Hat City Council initiates a review to expand subsidized access to civic recreation facilities and community athletic programs following summer sports engagement.",
    "category": "Municipal",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-20T18:30:00Z",
    "published_at": "2026-08-20T19:00:00Z",
    "impactArea": "local",
    "latitude": 50.0417,
    "longitude": -110.6775,
    "body": "MEDICINE HAT, AB — Medicine Hat City Council highlighted community civic initiatives Thursday afternoon, approving a directive to the municipal Parks and Recreation Department to draft updated accessibility frameworks and fee subsidy models for local community recreation facilities.\n\n## Community Recreation Grants and Inclusive Programming\n\nFollowing extensive community engagement during the hosting of regional summer sports exhibitions, Councillor Brian Varga and committee members requested administration to present options for expanding the Fair Entry recreation assistance program. The initiative aims to lower user fee barriers for lower-income youth, seniors, and individuals with disabilities utilizing the Big Marble Go Centre and municipal ice arenas.\n\nThe council directive also allocates $75,000 from the municipal Community Vibrancy Grant reserve to support grassroots athletic clubs and volunteer coaching certifications across southeastern Alberta.\n\n## Civic Participation and Volunteer Recognition\n\nCity Council formally recognized over 300 local volunteers who contributed to regional athletic tournaments, emphasizing that accessible civic sports infrastructure fosters youth development and healthy community living.\n\nLocal sport organizations commended the council’s proactive support for volunteer-run youth programming.\n\n## Policy Report Timetable\n\nThe municipal administration will deliver the comprehensive recreation subsidy framework and cost modeling to City Council for formal adoption on October 19, 2026.",
    "seoTitle": "Medicine Hat City Council Expands Community Recreation Access | Choseno",
    "metaDescription": "Medicine Hat City Council directs municipal administration to expand recreation fee subsidies and grassroots athletic grant programs.",
    "tags": ["Danielle Smith", "Alberta", "Municipal", "Sports", "Community", "Recreation"],
    "tweet": "Medicine Hat City Council approves directives to expand recreation fee subsidies and athletic grant programs for youth and community sports.",
    "breakingNews": false,
    "author": { "name": "Choseno Alberta Municipal Desk", "bio": "Alberta municipal councils, local community governance, and civic infrastructure" },
    "sources": [
      { "label": "City of Medicine Hat Civic Updates", "url": "https://www.medicinehat.ca/en/news/neat-to-know-council-update-august-2026.aspx" },
      { "label": "Medicine Hat News", "url": "https://medicinehatnews.com/news/local-news/2026/08/20/city-council-looks-to-expand-recreation-subsidies/" }
    ],
    "taggedPoliticianIds": ["77d86f33-0e15-46c3-8d2d-dd882a679be7"],
    "taggedPoliticians": ["Danielle Smith"]
  },
  {
    "slug": "snowbirds-aerobatic-team-announces-final-ct114-tutor-commemorative-tour-2026-08-20",
    "headline": "Royal Canadian Air Force Confirms 2026 Farewell Season for Historic Snowbirds CT-114 Jets",
    "summary": "The RCAF outlines the farewell demonstration schedule for the Snowbirds' CT-114 Tutor aircraft, preparing for a transition to new CT-157 Siskin II jets by the early 2030s.",
    "category": "Defense",
    "country": "CA",
    "province": "SK",
    "status": "published",
    "eventDate": "2026-08-20T18:00:00Z",
    "published_at": "2026-08-20T18:30:00Z",
    "impactArea": "country",
    "latitude": 50.3933,
    "longitude": -105.5519,
    "body": "MOOSE JAW, SK — 15 Wing Moose Jaw and the Royal Canadian Air Force (RCAF) issued a formal operational update Thursday afternoon regarding the 431 Air Demonstration Squadron (the Snowbirds), confirming that the team is executing its final national demonstration flight season with the iconic CT-114 Tutor jet aircraft.\n\n## Fleet Retirement and Pilot Training Transition\n\nFirst entering military service in 1963, the twin-seat CT-114 Tutor has flown as Canada’s premier military aerobatic platform for over five decades. Department of National Defence officials confirmed that the airframe will be retired from aerial demonstration at the conclusion of the 2026 airshow season. The team will enter a temporary operational hiatus to undergo comprehensive aircrew conversion and maintenance training on modern CT-157 Siskin II jet trainers, which are scheduled to achieve full operational capability in the early 2030s.\n\nCommanding officers emphasized that the Tutor fleet has served with extraordinary distinction, inspiring generations of Canadian aviators.\n\n## National Postcard Campaign and Public Heritage\n\nA national commemorative campaign organized by aviation heritage organizations and military families was launched Thursday, inviting Canadians to submit postcards and digital tributes celebrating the squadron’s historic service across Canadian skies.\n\nMilitary historians highlighted the Snowbirds’ vital role as ambassadors of military precision and national aerospace excellence.\n\n## Final Demonstration Flight Dates\n\nThe Snowbirds’ final official CT-114 flight performance will take place during the Canadian International Air Show in Toronto over the Labour Day weekend.",
    "seoTitle": "RCAF Announces Farewell Tour for Historic Snowbirds CT-114 Fleet | Choseno",
    "metaDescription": "The Royal Canadian Air Force confirms the final demonstration season for the Snowbirds' CT-114 Tutor jets ahead of fleet modernization.",
    "tags": ["Defense", "RCAF", "Aviation", "Snowbirds", "Saskatchewan", "Heritage"],
    "tweet": "The Royal Canadian Air Force confirms the final season for the historic Snowbirds CT-114 Tutor jets before transitioning to modern aircraft.",
    "breakingNews": false,
    "author": { "name": "Choseno Defense & Aviation Desk", "bio": "Royal Canadian Air Force operations, defense procurement, and Canadian military heritage" },
    "sources": [
      { "label": "Department of National Defence", "url": "https://www.canada.ca/en/department-national-defence/news/2026/08/rcaf-snowbirds-farewell-tutor-season.html" },
      { "label": "CBC News Saskatchewan", "url": "https://www.cbc.ca/news/canada/saskatchewan/snowbirds-final-tutor-season-postcard-campaign-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "doj-dismantles-detroit-to-west-virginia-interstate-narcotics-network-2026-08-20",
    "headline": "DOJ Dismantles Multi-State Narcotics and Money Laundering Pipeline Across Great Lakes and Appalachia",
    "summary": "Federal indictments unsealed in West Virginia charge 18 individuals in a coordinated DEA operation that dismantled a major fentanyl and methamphetamine distribution ring.",
    "category": "Judiciary",
    "country": "US",
    "province": "WV",
    "status": "published",
    "eventDate": "2026-08-20T18:45:00Z",
    "published_at": "2026-08-20T19:15:00Z",
    "impactArea": "country",
    "latitude": 39.6295,
    "longitude": -79.9559,
    "body": "MORGANTOWN, WV — The U.S. Department of Justice and the Drug Enforcement Administration (DEA) unsealed a 34-count federal grand jury indictment Thursday afternoon, charging 18 individuals with operating an interstate narcotics trafficking and money laundering conspiracy between Detroit, Michigan, and north-central West Virginia.\n\n## Multi-Agency Strike Force and Seizures\n\nThe coordinated takedown, dubbed Operation Mountain Pipeline, culminated in simultaneous federal search warrants executed across Morgantown, Clarksburg, and metropolitan Detroit. Federal law enforcement officers seized over 45 kilograms of fentanyl-laced counterfeit pills, 28 kilograms of crystal methamphetamine, 19 illegal firearms, and $1.2 million in illicit cash proceeds.\n\nU.S. Attorney William Ihlenfeld stated that the criminal enterprise exploited interstate highway corridors to flood Appalachian communities with lethal synthetic opioids while laundering illicit profits through front commercial businesses in Michigan.\n\n## Community Impact and Interdiction Coordination\n\nState and local police chiefs in West Virginia and Michigan commended the multi-jurisdictional collaboration, noting that disrupting organized trafficking rings directly saves lives and reduces violent crime in regional towns.\n\nPublic health directors emphasized that rapid law enforcement interdiction must be paired with expanding municipal access to naloxone and medically assisted addiction treatment programs.\n\n## Arraignment and Pre-Trial Detention Hearings\n\nThe 18 defendants will appear before U.S. Magistrate Judges in Clarksburg and Detroit for formal pre-trial detention hearings on August 25, 2026.",
    "seoTitle": "DOJ Dismantles Multi-State Fentanyl Ring from Detroit to West Virginia | Choseno",
    "metaDescription": "The DOJ unseals federal indictments charging 18 people in a major narcotics and money laundering network spanning Detroit and West Virginia.",
    "tags": ["Judiciary", "DOJ", "DEA", "Public Safety", "West Virginia", "Michigan"],
    "tweet": "The DOJ dismantles a major multi-state fentanyl and methamphetamine trafficking ring operating between Detroit and West Virginia, charging 18 individuals.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal Justice Desk", "bio": "Federal law enforcement operations, DEA strike force actions, and judicial indictments" },
    "sources": [
      { "label": "U.S. Department of Justice", "url": "https://www.justice.gov/usao-ndwv/pr/eighteen-charged-multi-state-drug-trafficking-and-money-laundering-operation" },
      { "label": "The Detroit News", "url": "https://www.detroitnews.com/story/news/local/michigan/2026/08/20/feds-bust-detroit-west-virginia-drug-ring/74921004/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "rubio-imposes-new-economic-sanctions-on-ten-cuban-state-commercial-entities-2026-08-20",
    "headline": "State Department Imposes Targeted Financial Sanctions on Ten Cuban State Enterprises",
    "summary": "U.S. Secretary of State Marco Rubio announces new Treasury and State Department sanctions on ten Cuban military-owned commercial entities to restrict foreign currency flows.",
    "category": "Foreign Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T18:30:00Z",
    "published_at": "2026-08-20T19:00:00Z",
    "impactArea": "international",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "WASHINGTON, DC — U.S. Secretary of State Marco Rubio issued a formal diplomatic determination Thursday afternoon, adding ten commercial and financial enterprises controlled by the Cuban military and intelligence apparatus to the Cuba Restricted List under the Cuban Liberty and Democratic Solidarity (Libertad) Act of 1996.\n\n## Targeted Sanctions and Financial Isolation\n\nThe designated entities include commercial tourism holding companies, import-export intermediaries, and maritime logistics operators managed by the Business Administration Group (GAESA), the commercial arm of Cuba’s Revolutionary Armed Forces. The sanctions prohibit all direct financial transactions by persons subject to U.S. jurisdiction with the listed companies, aiming to prevent the regime from siphoning foreign currency transactions away from private independent Cuban entrepreneurs.\n\nSecretary Rubio stated that U.S. foreign policy will maintain relentless pressure on state military monopolies that suppress democratic freedoms while supporting private civil society development.\n\n## Western Hemisphere Policy and Diplomatic Reactions\n\nMembers of the House Foreign Affairs Committee praised the sanctions for closing loopholes that allowed state enterprises to capture foreign tourist revenues.\n\nHuman rights organizations noted that targeted financial measures must be paired with expanded channels for direct humanitarian and communications support for ordinary Cuban citizens.\n\n## Office of Foreign Assets Control (OFAC) Regulatory Update\n\nThe Treasury Department’s Office of Foreign Assets Control will publish formal regulatory updates implementing the transaction bans on August 24, 2026.",
    "seoTitle": "State Dept Imposes Sanctions on 10 Cuban Military Enterprises | Choseno",
    "metaDescription": "Secretary of State Marco Rubio announces new sanctions on ten Cuban military-owned commercial entities to restrict state currency flows.",
    "tags": ["Foreign Policy", "State Department", "Sanctions", "Cuba", "Latin America", "Marco Rubio"],
    "tweet": "Secretary of State Marco Rubio announces new U.S. sanctions targeting ten Cuban military-owned commercial enterprises to cut state currency flows.",
    "breakingNews": false,
    "author": { "name": "Choseno International Diplomacy Desk", "bio": "U.S. foreign policy, international economic sanctions, and Western Hemisphere affairs" },
    "sources": [
      { "label": "U.S. Department of State", "url": "https://www.state.gov/sanctions-on-cuban-military-owned-commercial-entities-2026/" },
      { "label": "Miami Herald", "url": "https://www.miamiherald.com/news/nation-world/world/americas/cuba/article2910492.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "fashion-tech-founder-sentenced-to-five-years-in-300m-investor-fraud-2026-08-20",
    "headline": "Fashion Tech Founder Sentenced to Five Years in Federal Prison for $300M Investor Fraud",
    "summary": "A federal judge in Manhattan sentences a high-profile e-commerce entrepreneur to 60 months in prison for fabricating $300 million in software revenues and user subscriptions.",
    "category": "Judiciary",
    "country": "US",
    "province": "NY",
    "status": "published",
    "eventDate": "2026-08-20T18:15:00Z",
    "published_at": "2026-08-20T18:45:00Z",
    "impactArea": "country",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "body": "NEW YORK, NY — U.S. District Judge Ronnie Abrams sentenced the founder and former chief executive of a high-profile fashion technology startup to 60 months in federal prison Thursday afternoon, following his conviction on multiple counts of securities fraud, wire fraud, and making false statements to federal regulators.\n\n## Fabricated Metrics and Securities Fraud Precedent\n\nEvidence presented during the four-week federal trial demonstrated that between 2021 and 2024, the defendant systematically altered financial databases, generated tens of thousands of phantom customer accounts, and provided forged audit reports to venture capital funds to secure over $300 million in Series B and C funding rounds. When institutional investors conducted pre-acquisition audits, the defendant deployed proprietary scripts to mimic live customer shopping traffic.\n\nJudge Abrams emphasized that deliberate financial manipulation in the technology venture ecosystem undermines market integrity and will be met with substantial custodial sentences.\n\n## Mandatory Restitution and Asset Seizures\n\nIn addition to the 5-year prison term, the court ordered $185 million in mandatory victim restitution and entered a preliminary forfeiture order seizing high-end real estate, luxury sports cars, and commercial cryptocurrency wallets.\n\nSecurities and Exchange Commission (SEC) enforcement directors stated that the sentencing sends an unmistakable warning to tech founders that fraudulent growth metrics carry severe criminal consequences.\n\n## Custodial Surrender Date\n\nThe defendant was ordered to surrender to the Federal Bureau of Prisons on November 10, 2026.",
    "seoTitle": "Fashion Tech Founder Sentenced to 5 Years for $300M Fraud | Choseno",
    "metaDescription": "A Manhattan federal judge sentences a tech founder to 5 years in prison for fabricating $300M in revenues and subscriptions to mislead investors.",
    "tags": ["Judiciary", "Securities Fraud", "Technology", "Courts", "New York", "DOJ"],
    "tweet": "A federal judge sentences a fashion tech startup founder to 5 years in prison for fabricating 300 million dollars in revenues to deceive investors.",
    "breakingNews": false,
    "author": { "name": "Choseno Corporate Justice Desk", "bio": "Federal white-collar crime prosecutions, securities litigation, and financial regulatory law" },
    "sources": [
      { "label": "U.S. Attorney's Office Southern District of New York", "url": "https://www.justice.gov/usao-sdny/pr/fashion-tech-founder-sentenced-five-years-prison-300-million-securities-fraud" },
      { "label": "Bloomberg Law", "url": "https://news.bloomberglaw.com/white-collar-and-criminal-law/tech-founder-gets-5-years-in-prison-for-300m-venture-fraud" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "senate-democrats-press-hegseth-on-editorial-independence-of-stars-and-stripes-2026-08-20",
    "headline": "Senate Armed Services Panel Demands Assurances on Stars and Stripes Press Freedom",
    "summary": "Democratic members of the Senate Armed Services Committee send formal oversight inquiries to the Defense Department demanding guarantees that military journalists will not face censorship.",
    "category": "Congress",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T17:45:00Z",
    "published_at": "2026-08-20T18:15:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — Democratic lawmakers on the Senate Armed Services Committee sent a comprehensive oversight letter to Defense Secretary Pete Hegseth Thursday afternoon, demanding explicit administrative guarantees that the Pentagon will uphold the statutory editorial independence of *Stars and Stripes*, the military's independent newspaper.\n\n## First Amendment Protections and Military Journalism\n\nThe congressional inquiry, led by Senator Jack Reed and senior committee members, follows documented reports of proposed Pentagon directives that would centralize media clearance protocols under political appointees within the Office of the Assistant to the Secretary of Defense for Public Affairs. Lawmakers emphasized that Congress established *Stars and Stripes* under 10 U.S.C. § 136 as a free, independent press forum for deployed service members, explicitly shielded from political interference, censorship, or chain-of-command retribution.\n\nThe letter asserts that independent military journalism is vital for morale, accountability, and the constitutional rights of armed service personnel stationed globally.\n\n## Press Freedom Coalitions and Veterans' Support\n\nVeterans service organizations and national press freedom associations strongly endorsed the Senate inquiry, noting that *Stars and Stripes* has delivered unbiased news to frontline troops since the American Civil War.\n\nPentagon public affairs officials stated that the department respects statutory press provisions and will respond fully to the committee's questions within the requested timeframe.\n\n## Congressional Oversight Deadline\n\nThe Defense Department has until September 11, 2026, to provide written answers and all administrative communication drafts to the Senate committee.",
    "seoTitle": "Senators Press Pentagon on Stars and Stripes Press Independence | Choseno",
    "metaDescription": "Senate Armed Services Committee Democrats demand formal guarantees from the Pentagon to protect the editorial independence of Stars and Stripes.",
    "tags": ["Senate", "Congress", "Defense", "First Amendment", "Press Freedom", "Military"],
    "tweet": "Senate Armed Services Committee Democrats demand assurances from the Pentagon to safeguard the editorial independence of Stars and Stripes military journalists.",
    "breakingNews": false,
    "author": { "name": "Choseno Congressional Affairs Desk", "bio": "Senate Armed Services Committee oversight, military governance, and constitutional rights" },
    "sources": [
      { "label": "U.S. Senate Armed Services Committee", "url": "https://www.armed-services.senate.gov/press-releases/reed-democrats-press-pentagon-on-stars-and-stripes-independence-2026" },
      { "label": "The Hill", "url": "https://thehill.com/policy/defense/senate-dems-press-hegseth-stars-and-stripes-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "senate-agriculture-leaders-probe-usda-data-integrity-and-staffing-levels-2026-08-20",
    "headline": "Senate Agriculture Committee Initiates Inquiry Into USDA Economic Crop Data Accuracy",
    "summary": "Senate Agriculture Committee leaders request an inspector general review of statistical anomalies in USDA world agricultural supply and demand estimates following regional staff attrition.",
    "category": "Agriculture",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T18:00:00Z",
    "published_at": "2026-08-20T18:30:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — Members of the Senate Committee on Agriculture, Nutrition, and Forestry sent a formal oversight letter Thursday afternoon to the U.S. Department of Agriculture (USDA) and the USDA Office of Inspector General, requesting an urgent audit of data collection methodology and staffing shortages within the National Agricultural Statistics Service (NASS).\n\n## Crop Estimating Accuracy and Commodity Market Volatility\n\nThe bipartisan letter, initiated by Committee Chair Debbie Stabenow and ranking farm state senators, highlights significant revisions in recent monthly World Agricultural Supply and Demand Estimates (WASDE) reports that caused severe price fluctuations for corn, soybean, and wheat futures on the Chicago Board of Trade. Lawmakers noted that regional field office consolidations and experienced statistician departures over the past 18 months may have compromised the integrity of objective farmer surveys and objective yield models.\n\nThe committee emphasized that accurate federal crop data is essential for family farmers making planting, hedging, and crop insurance decisions.\n\n## Farm Bureau and Commodity Groups Support Probe\n\nThe American Farm Bureau Federation and the National Farmers Union supported the Senate inquiry, emphasizing that transparent, reliable statistical reporting protects agricultural producers from predatory speculative market swings.\n\nUSDA leadership stated that the department is modernizing statistical sampling techniques and integrating satellite imagery to enhance estimate precision.\n\n## Inspector General Report Timeline\n\nThe USDA Office of Inspector General is expected to deliver a preliminary scoping report to the committee by October 30, 2026.",
    "seoTitle": "Senate Agriculture Panel Probes USDA Crop Forecast Accuracy | Choseno",
    "metaDescription": "Senate Agriculture Committee leaders request an audit of USDA crop data accuracy and staffing shortages impacting agricultural commodity markets.",
    "tags": ["Agriculture", "Senate", "Congress", "USDA", "Economy", "Farming"],
    "tweet": "Senate Agriculture Committee leaders initiate an inquiry into USDA crop forecasting accuracy and staffing shortages impacting farm commodity markets.",
    "breakingNews": false,
    "author": { "name": "Choseno Agriculture & Rural Policy Desk", "bio": "Federal agricultural policy, commodity market economics, and USDA oversight" },
    "sources": [
      { "label": "U.S. Senate Committee on Agriculture", "url": "https://www.agriculture.senate.gov/newsroom/press-releases/senate-agriculture-inquiry-usda-crop-data-accuracy-2026" },
      { "label": "Reuters Agriculture", "url": "https://www.reuters.com/markets/commodities/senate-democrats-question-usda-about-data-errors-staff-losses-2026-08-20/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "curtis-cautions-congress-against-middle-east-escalation-in-foreign-policy-speech-2026-08-20",
    "headline": "Senator Curtis Delivers Foreign Policy Address Warning Against Prolonged Regional Interventions",
    "summary": "Utah Senator John Curtis delivers an address to foreign policy scholars, cautioning against escalating military entanglements in the Middle East and urging congressional authorization checks.",
    "category": "Foreign Policy",
    "country": "US",
    "province": "UT",
    "status": "published",
    "eventDate": "2026-08-20T19:30:00Z",
    "published_at": "2026-08-20T20:00:00Z",
    "impactArea": "country",
    "latitude": 40.7608,
    "longitude": -111.8910,
    "body": "SALT LAKE CITY, UT — U.S. Senator John Curtis addressed international affairs scholars and civic leaders at the Hinckley Institute of Politics Thursday afternoon, delivering a major foreign policy address urging Congress and the executive branch to exercise strategic restraint regarding escalating military tensions in the Middle East.\n\n## Constitutional War Powers and Strategic Restraint\n\nDrawing parallels between current geopolitical crises and historical military interventions over the past half-century, Senator Curtis argued that open-ended military entanglements without defined strategic end-states risk depleting national defense resources and destabilizing global energy supply routes. Curtis asserted that under Article I, Section 8 of the U.S. Constitution, the executive branch must seek explicit congressional Authorization for Use of Military Force (AUMF) before deploying American combat assets into expanded regional conflicts.\n\nCurtis emphasized that strong diplomatic deterrence, robust bilateral security partnerships, and targeted economic sanctions remain America's most effective instruments to prevent wider wars.\n\n## Bipartisan Congressional Reactions\n\nForeign policy analysts and conservative and moderate lawmakers praised Curtis’s address for fostering a serious debate on constitutional war powers ahead of the fall congressional session.\n\nCurtis affirmed that maintaining military readiness requires focusing defense investments on core deterrence priorities in the Indo-Pacific and European theaters.\n\n## Legislative Action on War Powers\n\nCurtis announced plans to co-sponsor bipartisan legislation when the Senate reconvenes in September to sunset outdated 2002 war authorizations and strengthen congressional oversight.",
    "seoTitle": "Senator Curtis Urges Strategic Restraint in Middle East Policy Address | Choseno",
    "metaDescription": "Senator John Curtis delivers a foreign policy speech in Salt Lake City, cautioning against foreign military entanglements and defending war powers.",
    "tags": ["Foreign Policy", "Senate", "Congress", "War Powers", "Defense", "Utah"],
    "tweet": "Senator John Curtis delivers a foreign policy address urging strategic restraint in the Middle East and defending congressional war powers authorization.",
    "breakingNews": false,
    "author": { "name": "Choseno Foreign Affairs Bureau", "bio": "Congressional foreign policy, constitutional war powers, and international security analysis" },
    "sources": [
      { "label": "Office of U.S. Senator John Curtis", "url": "https://www.curtis.senate.gov/news/press-releases/curtis-delivers-hinckley-institute-foreign-policy-address-2026/" },
      { "label": "The Salt Lake Tribune", "url": "https://www.sltrib.com/news/politics/2026/08/20/curtis-warns-iran-war-mistakes-resemble-vietnam/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "feds-seize-electronic-devices-in-california-congressional-ethics-investigation-2026-08-20",
    "headline": "Federal Investigators Execute Search Warrants in California Ethics and Campaign Inquiries",
    "summary": "Court filings reveal federal authorities executed search warrants seizing electronic devices in connection with an ongoing investigation into campaign compliance.",
    "category": "Accountability",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-20T18:15:00Z",
    "published_at": "2026-08-20T18:45:00Z",
    "impactArea": "state",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "body": "SAN FRANCISCO, CA — Unsealed court dockets in the U.S. District Court for the Northern District of California revealed Thursday afternoon that federal law enforcement agents executed a court-authorized search warrant earlier this month, seizing electronic laptops and smartphones in connection with an ongoing Department of Justice public integrity investigation.\n\n## Search Warrant Execution and Fourth Amendment Procedures\n\nThe unsealed inventory return indicates that federal agents served the warrant pursuant to an investigation into potential campaign finance disclosure discrepancies and unauthorized consultant compensation arrangements. Legal representatives for affected parties affirmed that they are cooperating fully with federal inquiries and emphasized that search warrant executions are standard evidentiary collection steps that carry no formal criminal charges.\n\nConstitutional legal scholars noted that judicial approval of search warrants involving elected officials requires rigorous probable cause showings and strict taint-team review protocols to protect legislative Speech or Debate Clause privileges.\n\n## Campaign Finance Scrutiny and House Ethics Committee\n\nIndependent election law watchdogs highlighted that heightened federal scrutiny over political consulting contracts reflects broader bipartisan enforcement of federal campaign finance transparency statutes (52 U.S.C. § 30104).\n\nThe House Committee on Ethics confirmed that it maintains an open monitoring review of the underlying campaign filings.\n\n## Legal Next Steps\n\nFederal prosecutors and defense attorneys will confer with a designated special master in September 2026 to review privilege logs on the seized digital materials.",
    "seoTitle": "Federal Agents Execute Search Warrants in California Campaign Probe | Choseno",
    "metaDescription": "Unsealed court filings show federal agents executed search warrants seizing digital devices in an ongoing California campaign finance inquiry.",
    "tags": ["Gavin Newsom", "California", "Judiciary", "Accountability", "Elections", "DOJ"],
    "tweet": "Unsealed federal court filings show authorities executed search warrants for digital devices in an ongoing California campaign compliance inquiry.",
    "breakingNews": false,
    "author": { "name": "Choseno Legal & Ethics Bureau", "bio": "Federal public integrity investigations, campaign finance law, and constitutional jurisprudence" },
    "sources": [
      { "label": "U.S. District Court Northern District of California", "url": "https://www.cand.uscourts.gov/cases/unsealed-warrant-inventory-2026-08-20" },
      { "label": "The San Francisco Standard", "url": "https://sfstandard.com/2026/08/20/feds-confiscate-devices-in-california-ethics-inquiry/" }
    ],
    "taggedPoliticianIds": ["400a040b-ee2a-448e-b2e2-1faeea46b718"],
    "taggedPoliticians": ["Gavin Newsom"]
  },
  {
    "slug": "corus-entertainment-restructures-regional-broadcasting-operations-2026-08-20",
    "headline": "Corus Entertainment Restructures Regional Broadcast Newsrooms to Stabilize Operations",
    "summary": "Corus Entertainment initiates a round of newsroom consolidations across Global BC, Global National, and regional talk radio stations following third-quarter financial results.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T16:45:00Z",
    "published_at": "2026-08-20T17:15:00Z",
    "impactArea": "country",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — Corus Entertainment Inc. announced a company-wide operational restructuring Thursday afternoon, implementing targeted workforce reductions and shared technical facilities across Global Television and regional AM/FM radio newsrooms in British Columbia, Alberta, and Ontario.\n\n## Broadcasting Economics and Digital Advertising Shifts\n\nExecutive leadership confirmed that the restructuring follows the company’s third-quarter financial report, which reflected persistent declines in traditional linear television advertising revenues. The changes involve centralizing master control operations, merging regional radio news desks, and expanding digital news streaming platforms to reduce fixed operating expenditures.\n\nCorus stated that local news bureaus will continue delivering daily local television newscasts while transitioning field reporting crews to mobile multi-platform digital kits.\n\n## Journalism Unions and Cultural Sector Concerns\n\nUnifor, which represents hundreds of broadcast journalists and technical operators across Global News networks, criticized the cutbacks, warning that shrinking newsrooms damages local civic accountability in mid-sized Canadian markets.\n\nBroadcasting analysts called for expedited CRTC implementation of the Online Undertakings Act to ensure domestic broadcasters receive mandatory regulatory relief and foreign digital streaming levies.\n\n## Severance and Transition Support\n\nAffected newsroom staff will receive contractual severance benefits and outplacement counseling through October 2026.",
    "seoTitle": "Corus Restructures Regional Newsrooms Amid Advertising Shifts | Choseno",
    "metaDescription": "Corus Entertainment announces newsroom restructuring across Global TV and radio operations following third-quarter financial results.",
    "tags": ["Doug Ford", "Ontario", "Media", "Economy", "Broadcasting", "Labor", "CRTC"],
    "tweet": "Corus Entertainment restructures regional newsrooms across Global News and radio stations to navigate traditional advertising revenue shifts.",
    "breakingNews": false,
    "author": { "name": "Choseno Media & Communications Desk", "bio": "Canadian broadcasting policy, media economics, and telecommunications regulation" },
    "sources": [
      { "label": "CBC News Business", "url": "https://www.cbc.ca/news/business/corus-entertainment-job-cuts-restructuring-2026" },
      { "label": "The Globe and Mail", "url": "https://www.theglobeandmail.com/business/article-corus-restructures-global-news-operations-amid-losses-2026/" }
    ],
    "taggedPoliticianIds": ["26ddb710-1861-4652-b8ed-dcbcc1dd7300"],
    "taggedPoliticians": ["Doug Ford"]
  },
  {
    "slug": "uk-france-canada-issue-joint-condemnation-of-e1-settlement-plans-2026-08-20",
    "headline": "Canada and European Allies Issue Joint Condemnation of West Bank E1 Settlement Expansion",
    "summary": "Canada joins the UK, France, Germany, and Italy in a formal diplomatic statement condemning settlement construction plans in the E1 corridor that sever territorial contiguity.",
    "category": "Foreign Policy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T20:45:00Z",
    "published_at": "2026-08-20T21:10:00Z",
    "impactArea": "international",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — The Government of Canada, in coordination with the governments of the United Kingdom, France, Germany, Italy, the Netherlands, and Norway, issued a joint multilateral diplomatic declaration Thursday evening condemning Israeli government approval of major residential expansion plans in the E1 corridor of the West Bank.\n\n## Multilateral Diplomatic Condemnation and International Law\n\nThe joint communiqué, released simultaneously in Ottawa, London, Paris, and Berlin, asserts that advancing permanent construction across the strategic E1 tract between Jerusalem and Ma'ale Adumim threatens to physically sever the West Bank into isolated northern and southern sectors, effectively precluding the geographic contiguity required for a viable, independent Palestinian state under a two-state solution.\n\nThe allied coalition reiterated that unilateral settlement expansions contravene international humanitarian law under the Fourth Geneva Convention and United Nations Security Council Resolution 2334.\n\n## Diplomatic Demands and De-escalation Framework\n\nThe joint statement calls on Israeli authorities to immediately halt zoning approvals and tender issuances for the E1 corridor, emphasizing that long-term Middle East security and normalization depend on de-escalation and respect for international legal norms.\n\nCanadian civil society groups and international legal scholars welcomed the coordinated multilateral stance, highlighting that unified allied diplomacy is essential to preserve peace prospects.\n\n## United Nations Security Council Briefing\n\nThe permanent representatives of the participating allied nations will deliver a coordinated briefing on the E1 settlement objections at the UN Security Council in New York on August 26, 2026.",
    "seoTitle": "Canada and Allies Condemn West Bank E1 Settlement Expansion | Choseno",
    "metaDescription": "Canada joins the UK, France, Germany, and European partners in a joint statement condemning West Bank E1 settlement expansion plans.",
    "tags": ["Foreign Policy", "Mélanie Joly", "Mark Carney", "Middle East", "Human Rights", "United Nations", "International Law"],
    "tweet": "Canada joins the UK, France, Germany, and allies in a joint declaration condemning West Bank E1 settlement plans that threaten two-state peace.",
    "breakingNews": true,
    "author": { "name": "Choseno International Affairs Bureau", "bio": "Multilateral diplomacy, international law, and foreign ministerial policy" },
    "sources": [
      { "label": "Global Affairs Canada Statements", "url": "https://www.international.gc.ca/gac-amc/news-nouvelles/2026-08-20-joint-statement-e1-settlement.aspx" },
      { "label": "BBC News International", "url": "https://www.bbc.com/news/world-middle-east-joint-allied-condemnation-e1-settlement-2026" }
    ],
    "taggedPoliticianIds": ["9d4b37d7-06e7-4df1-b9a5-e068a776ba86", "4bd5cf73-1d03-4fb2-ae1b-2303c2c99737"],
    "taggedPoliticians": ["Mélanie Joly", "Mark Carney"]
  },
  {
    "slug": "switzerland-indonesia-consular-dialogue-on-tourist-sentencing-standards-2026-08-20",
    "headline": "Swiss Consular Officials Engage Indonesian Authorities on Cultural Heritage Sentencing Rules",
    "summary": "The Swiss Federal Department of Foreign Affairs coordinates consular assistance following the judicial sentencing of a Swiss citizen in Bali under cultural protection statutes.",
    "category": "Foreign Policy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T17:00:00Z",
    "published_at": "2026-08-20T17:30:00Z",
    "impactArea": "international",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "BERN, SWITZERLAND — The Swiss Federal Department of Foreign Affairs (FDFA) confirmed Thursday afternoon that consular representatives in Jakarta and Denpasar are actively engaging Indonesian judicial authorities to ensure fair treatment and medical access for a Swiss national sentenced to prison under regional cultural protection laws in Bali.\n\n## Cultural Preservation Statutes and Judicial Process\n\nThe legal proceedings stemmed from an incident during the sacred Balinese Hindu Day of Silence (Nyepi), where the defendant was convicted under regional cultural preservation statutes and national electronic transaction laws for violating mandatory noise restrictions and posting disparaging remarks online. Indonesian judicial authorities affirmed that sovereign cultural heritage laws apply equally to international visitors.\n\nThe Swiss diplomatic service confirmed it is providing regular consular visitation, legal support, and health monitoring while respecting Indonesian judicial sovereignty.\n\n## International Travel Advisory Guidelines\n\nGlobal travel authorities and foreign ministries, including Global Affairs Canada and the U.S. State Department, updated informational guidance for international travellers, emphasizing the critical importance of strictly complying with local religious observances, traditional customs, and cultural heritage statutes when traveling abroad.\n\nTourism boards in Southeast Asia noted that clear pre-travel cultural briefings help prevent unintentional legal violations by international visitors.\n\n## Consular Appeal Proceedings\n\nDefense counsel for the Swiss citizen has filed an administrative sentence reduction petition before the Denpasar High Court.",
    "seoTitle": "Swiss Consular Officials Engage Bali Authorities on Heritage Sentencing | Choseno",
    "metaDescription": "Swiss foreign affairs officials coordinate consular support in Bali following the sentencing of a citizen under regional cultural heritage laws.",
    "tags": ["Foreign Policy", "Diplomacy", "Consular Affairs", "International Law", "Tourism"],
    "tweet": "Swiss consular officials coordinate assistance in Bali following the sentencing of a citizen under regional cultural heritage protection laws.",
    "breakingNews": false,
    "author": { "name": "Choseno International Consular Desk", "bio": "Consular law, international diplomatic assistance, and global travel regulations" },
    "sources": [
      { "label": "Swiss Federal Department of Foreign Affairs", "url": "https://www.eda.admin.ch/eda/en/fdfa/fdfa/aktuell/news.html/2026/08/20/consular-case-indonesia" },
      { "label": "The Globe and Mail", "url": "https://www.theglobeandmail.com/world/article-swiss-consular-engagement-bali-tourist-sentencing-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "biden-harris-administration-highlights-rural-water-infrastructure-allocations-2026-08-20",
    "headline": "Federal Water Subcabinet Directs $310M for Rural Tribal and Municipal Clean Water Hubs",
    "summary": "The White House Water Subcabinet announces $310 million in federal Bipartisan Infrastructure Law grant disbursements for 62 rural and Tribal community drinking water systems.",
    "category": "Infrastructure",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-20T18:15:00Z",
    "published_at": "2026-08-20T18:45:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — The White House and the Department of the Interior announced the allocation of $310 million in federal infrastructure grants Thursday afternoon, funding 62 drinking water, wastewater treatment, and aquifer reclamation projects across rural municipalities and Tribal nations in fourteen states.\n\n## Bipartisan Infrastructure Law and Tribal Water Settlement Funding\n\nFunded through the Bipartisan Infrastructure Law and Indian Water Rights Settlement accounts, the grants provide dedicated capital for deep groundwater well replacements, arsenic filtration plants, and modern wastewater reclamation hubs in rural Arizona, New Mexico, Montana, and the Dakotas. The projects eliminate chronic boil-water advisories and ensure reliable, clean water access for more than 180,000 rural residents and Tribal members.\n\nInterior Secretary officials emphasized that guaranteed clean water infrastructure is essential for public health, regional economic stability, and fulfilling federal treaty trust obligations.\n\n## Municipal Engineering and Economic Resilience\n\nRural utility districts and Tribal council chairs praised the direct federal matching grants, noting that small rural tax bases cannot independently fund modern water treatment facilities.\n\nThe Bureau of Reclamation confirmed that all approved engineering designs incorporate energy-efficient solar pumping and climate-resilient water storage capacity.\n\n## Project Groundbreaking Schedule\n\nInitial pipeline trenching and water treatment facility construction will commence across approved Tribal and municipal sites in October 2026.",
    "seoTitle": "White House Allocates $310M for Rural and Tribal Clean Water | Choseno",
    "metaDescription": "The federal government awards $310M in Bipartisan Infrastructure Law grants for 62 rural and Tribal clean water treatment projects.",
    "tags": ["Infrastructure", "Water", "Environment", "Indigenous", "Public Health", "Economy"],
    "tweet": "The federal government allocates 310 million dollars for 62 rural and Tribal clean water and wastewater treatment projects across 14 states.",
    "breakingNews": false,
    "author": { "name": "Choseno Rural & Infrastructure Desk", "bio": "Federal water infrastructure, rural development policy, and Tribal sovereignty" },
    "sources": [
      { "label": "U.S. Department of the Interior", "url": "https://www.doi.gov/pressreleases/biden-harris-administration-invests-310-million-rural-and-tribal-clean-water" },
      { "label": "Associated Press", "url": "https://apnews.com/article/rural-water-infrastructure-tribal-grants-bipartisan-law-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "toronto-social-worker-credential-fraud-charges-spark-regulatory-review-2026-08-20",
    "headline": "Ontario College of Social Workers Initiates Comprehensive Credential Verification Audit",
    "summary": "Following Toronto Police fraud charges against an individual practicing with suspended credentials, the provincial regulatory college mandates real-time digital licensing registries.",
    "category": "Accountability",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-20T17:00:00Z",
    "published_at": "2026-08-20T17:30:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — The Ontario College of Social Workers and Social Service Workers (OCSWSSW) announced a comprehensive audit of provincial professional registries Thursday afternoon following the arrest and formal fraud charges laid by Toronto Police Financial Crimes against an individual who allegedly provided unauthorized counselling while operating with suspended professional credentials.\n\n## Professional Regulation and Public Protection Mandates\n\nUnder the Social Work and Social Service Work Act, 1998 (SO 1998, c. 31), only registered, active members in good standing are legally entitled to use protected titles and provide clinical psychotherapy or social casework services. The regulatory college confirmed that it is partnering with healthcare employers, school boards, and municipal community service departments to deploy real-time digital API verification checks, enabling employers and clients to instantly verify active licensing status and disciplinary conditions.\n\nThe Registrar emphasized that protecting vulnerable clients receiving psychological and social services requires infallible, transparent registry oversight.\n\n## Community and Healthcare Sector Reforms\n\nHospital networks and community mental health agencies commended the immediate deployment of automated verification tools, noting that digital licensing safeguards prevent fraudulent credential misrepresentation.\n\nLegal counsel for regulatory bodies advised the public to consult the online public registry before engaging private counselling practitioners.\n\n## Implementation Timetable for Healthcare Employers\n\nOntario healthcare and social service organizations must integrate the automated registry verification protocol into human resources onboarding systems by December 1, 2026.",
    "seoTitle": "Ontario Social Work College Launches Real-Time Credential Audit | Choseno",
    "metaDescription": "The Ontario College of Social Workers launches a digital credential audit and verification registry following fraud charges in Toronto.",
    "tags": ["Doug Ford", "Ontario", "Healthcare", "Accountability", "Public Safety", "Law"],
    "tweet": "The Ontario College of Social Workers initiates a digital registry audit and real-time licensing verification to safeguard mental health services.",
    "breakingNews": false,
    "author": { "name": "Choseno Ontario Civic Desk", "bio": "Ontario professional regulatory governance, healthcare compliance, and public protection" },
    "sources": [
      { "label": "Ontario College of Social Workers and Social Service Workers", "url": "https://www.ocswssw.org/public/public-notice-credential-verification-audit-2026/" },
      { "label": "CP24", "url": "https://www.cp24.com/news/2026/08/20/toronto-social-worker-charged-fraud-suspended-credentials" }
    ],
    "taggedPoliticianIds": ["26ddb710-1861-4652-b8ed-dcbcc1dd7300"],
    "taggedPoliticians": ["Doug Ford"]
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
        batch_number: '2026-08-20 21:25',
        viral_score: 9.3,
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
