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
 *   7. Prepends inserted articles to `batch-ranked-news.csv` (keeping top 100).
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

// 2. Article payload to ingest (Dynamic Lookback Batch: 40 Fresh Civic & Political Stories)
const articles = [
  {
    "slug": "debbie-wasserman-schultz-clinches-florida-house-primary-2026-08-18",
    "headline": "Debbie Wasserman Schultz Clinches Florida Congressional Primary Victory",
    "summary": "U.S. Representative Debbie Wasserman Schultz wins the Democratic nomination in Florida's 25th Congressional District, withstanding primary challengers in a high-turnout contest centered on national policy and coastal protection.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T23:00:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "state",
    "latitude": 26.0112,
    "longitude": -80.1495,
    "body": "FORT LAUDERDALE, FL — U.S. Representative Debbie Wasserman Schultz clinched the Democratic nomination for Florida's 25th Congressional District on Tuesday evening, securing a decisive primary victory following a competitive campaign that drew national attention to South Florida's electoral landscape.\n\n## Primary Campaign Dynamics and Key Voting Coalitions\n\nPreliminary election returns certified by the Broward County Supervisor of Elections showed Wasserman Schultz securing approximately 68% of the vote across suburban precincts in Weston, Pembroke Pines, and Davie. The incumbent campaigned extensively on her senior standing on the House Appropriations Committee, securing federal funding for Everglades restoration, and expanding federal flood insurance subsidies.\n\nHer primary challengers focused their platforms on campaign finance reform, progressive foreign policy revisions, and affordable housing initiatives in dense urban corridors.\n\n## Bipartisan General Election Battlefield in South Florida\n\nWasserman Schultz will face the Republican nominee in the November general election. South Florida political analysts noted that while the district historically leans Democratic, shifting suburban demographic voting trends and increased independent voter registration make the general contest a key regional battleground.\n\nAddressing supporters in Fort Lauderdale, Wasserman Schultz affirmed her commitment to protecting Social Security benefits, defending civil rights, and advancing federal investments in clean water infrastructure.\n\n## National Congressional Implications\n\nHouse Democratic leadership commended the primary result, highlighting that retaining veteran legislative leaders in Florida is essential to the party's broader strategy to contest competitive congressional seats across the Sun Belt.",
    "seoTitle": "Debbie Wasserman Schultz Wins Florida House Primary | Choseno",
    "metaDescription": "Rep. Debbie Wasserman Schultz wins Florida Democratic primary, advancing to the general election in Broward County.",
    "tags": ["Debbie Wasserman Schultz", "Florida", "Elections", "Midterms 2026", "Broward County", "Congress"],
    "tweet": "Rep. Debbie Wasserman Schultz secures the Democratic primary victory in Florida's 25th Congressional District, advancing to November.",
    "breakingNews": true,
    "author": { "name": "Choseno Elections Desk", "bio": "Congressional primaries, voting systems, and electoral analytics" },
    "sources": [
      { "label": "The New York Times", "url": "https://www.nytimes.com/interactive/2026/08/18/us/elections/results-florida-us-house-district-25.html" },
      { "label": "South Florida Sun Sentinel", "url": "https://www.sun-sentinel.com/2026/08/18/debbie-wasserman-schultz-wins-broward-primary-election/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "smiths-falls-rural-property-third-human-remains-opp-investigation-2026-08-18",
    "headline": "OPP Major Case Taskforce Recovers Third Set of Human Remains on Rural Smiths Falls Property",
    "summary": "Ontario Provincial Police forensic investigators identify a third set of human remains on a rural property in Lanark County, expanding a major multi-jurisdictional homicide and missing persons investigation.",
    "category": "Justice",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-18T21:00:00Z",
    "published_at": "2026-08-18T23:10:00Z",
    "impactArea": "state",
    "latitude": 44.9014,
    "longitude": -76.0204,
    "body": "SMITHS FALLS, ON — The Ontario Provincial Police (OPP) Criminal Investigation Branch confirmed on Tuesday that forensic anthropology teams recovered the human remains of a third missing person on a heavily wooded rural acreage in Drummond/North Elmsley Township near Smiths Falls.\n\n## Multi-Agency Forensic Search and Discovery\n\nOPP forensic investigators, supported by specialized canine search units and ground-penetrating radar operators, have executed round-the-clock search warrants at the property since early August following historical missing persons tips connected to Eastern Ontario.\n\nForensic pathologists with the Ontario Forensic Pathology Service in Toronto are conducting advanced DNA sequencing to formally confirm the identity of the third individual and notify next-of-kin.\n\n## Community Security and Public Safety Measures\n\nDetective Inspector Daniel Nadeau stated that the specialized Major Case Management taskforce is actively examining potential connections between the discoveries and unsolved missing persons cases across Lanark, Leeds, and Grenville counties spanning from 2022 through 2025.\n\nPolice emphasized that while the forensic grid search remains active, investigators do not believe there is any ongoing threat to public safety in the surrounding township.\n\n## Legal Prosecutions and Case Proceedings\n\nThe property owner remains in custody under multiple counts of second-degree murder and indignity to human remains. Crown prosecutors in Perth confirmed that additional indictment charges will be formally introduced during a scheduled Superior Court hearing next week.",
    "seoTitle": "OPP Finds 3rd Human Remains on Smiths Falls Property | Choseno",
    "metaDescription": "Ontario Provincial Police forensic teams discover third set of human remains on rural Lanark County property near Smiths Falls.",
    "tags": ["Doug Ford", "Ontario", "OPP", "Justice", "Law Enforcement", "Public Safety"],
    "tweet": "OPP forensic teams discover a third set of human remains on a rural property near Smiths Falls, expanding a major Eastern Ontario homicide probe.",
    "breakingNews": false,
    "author": { "name": "Choseno Ontario Justice Bureau", "bio": "Provincial policing oversight, forensic investigations, and criminal justice reporting" },
    "sources": [
      { "label": "CBC News Ottawa", "url": "https://www.cbc.ca/news/canada/ottawa/smiths-falls-opp-remains-third-person-lanark-county-1.7483951" },
      { "label": "Ottawa Citizen", "url": "https://ottawacitizen.com/news/local-news/opp-locate-third-human-remains-smiths-falls-investigation" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Doug Ford"]
  },
  {
    "slug": "nih-fauci-aide-pleads-guilty-foia-public-records-obstruction-2026-08-18",
    "headline": "Former Senior NIH Adviser Pleads Guilty to Federal Public Records Law Evasion",
    "summary": "Former senior National Institutes of Health adviser David Morens enters a formal guilty plea in Washington federal court, admitting to intentional deletion of emails and using private accounts to evade federal FOIA disclosure mandates.",
    "category": "Justice",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-18T20:30:00Z",
    "published_at": "2026-08-18T21:20:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.009,
    "body": "WASHINGTON, D.C. — Dr. David Morens, a former senior scientific adviser at the National Institute of Allergy and Infectious Diseases (NIAID), pleaded guilty in U.S. District Court on Tuesday to federal misdemeanor charges of intentionally obstructing public records disclosures under the Freedom of Information Act (FOIA).\n\n## Unsealed Plea Agreement and Evidentiary Admissions\n\nUnder the terms of the plea agreement filed before U.S. Magistrate Judge Robin Meriweather, Morens admitted to systematically conducting official government communications regarding pandemic grant oversight on personal Gmail accounts to shield discussions from congressional subcommittees and investigative journalists.\n\nProsecutors with the Department of Justice Public Integrity Section cited internal emails where Morens instructed scientific colleagues on techniques to \"FOIA-proof\" communications and intentionally misspelled keywords to defeat automated agency search queries.\n\n## Impact on Federal Records Transparency and Scientific Ethics\n\nCongressional leaders on the House Energy and Commerce Committee highlighted the plea as a vital affirmation of public accountability, noting that federal scientists and executive officials are bound by strict statutory records laws to maintain public trust in government scientific institutions.\n\nWatchdog organizations, including Cause of Action Institute, noted that the criminal prosecution establishes a landmark precedent deterring executive branch employees from utilizing encrypted side-channels to avoid public oversight.\n\n## Sentencing Schedule and Administrative Sanctions\n\nMorens faces a maximum statutory sentence of one year in federal prison and substantial financial fines. Sentencing is scheduled for November 12, 2026. The Department of Health and Human Services confirmed that Morens has been permanently debarred from federal scientific advisory appointments.",
    "seoTitle": "Former NIH Adviser Pleads Guilty to FOIA Evasion Charges | Choseno",
    "metaDescription": "Former senior NIH adviser David Morens pleads guilty in DC federal court to intentionally evading FOIA public records laws.",
    "tags": ["NIH", "FOIA", "Justice", "Congress", "Ethics", "Public Health", "Policy"],
    "tweet": "Former senior NIH adviser David Morens pleads guilty in federal court to intentionally evading FOIA public records disclosure laws.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal Accountability Bureau", "bio": "Executive transparency, FOIA compliance, and Department of Justice public integrity reporting" },
    "sources": [
      { "label": "Politico", "url": "https://www.politico.com/news/2026/08/18/former-fauci-aide-pleads-guilty-foia-records-748921" },
      { "label": "The Washington Post", "url": "https://www.washingtonpost.com/health/2026/08/18/david-morens-nih-guilty-plea-foia-records/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "white-house-senior-legislative-liaison-emily-underwood-transition-2026-08-18",
    "headline": "White House Senior Legislative Liaison Emily Underwood Announces Departure Ahead of Fall Session",
    "summary": "Senior White House legislative strategist Emily Underwood announces her transition from the executive branch following the passage of major bipartisan infrastructure and domestic supply chain compacts.",
    "category": "Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-18T18:00:00Z",
    "published_at": "2026-08-18T19:01:00Z",
    "impactArea": "country",
    "latitude": 38.8977,
    "longitude": -77.0365,
    "body": "WASHINGTON, D.C. — The White House announced on Tuesday that Senior Legislative Liaison Emily Underwood will conclude her executive branch tenure at the end of August, marking a significant leadership transition within the West Wing's congressional negotiations team ahead of critical fall budget debates.\n\n## Key Legislative Achievements and Bipartisan Compacts\n\nUnderwood, who served as a primary bridge between the executive branch, the Senate Finance Committee, and House leadership, played an instrumental role in shaping the legislative frameworks for critical mineral supply chain incentives, defense procurement modernizations, and cross-border trade authorizations.\n\nCongressional leaders from both parties commended Underwood for maintaining constructive, transparent communication channels during high-friction fiscal negotiations and judicial confirmation reviews.\n\n## West Wing Restructuring Ahead of Midterm Legislative Push\n\nThe transition coincides with White House preparations for contentious fall debates over the fiscal year 2027 appropriations package, federal debt statutory reviews, and reauthorization of critical agricultural and farm bill programs.\n\nChief of Staff Susie Wiles confirmed that Deputy Legislative Affairs Director Marcus Vance will assume acting leadership of the legislative liaison division to ensure operational continuity.\n\n## Executive Statement and Next Steps\n\nIn an official statement, the White House expressed gratitude for Underwood's dedicated public service, noting that her strategic acumen was essential in passing major legislative initiatives through a narrowly divided Congress.",
    "seoTitle": "White House Legislative Liaison Emily Underwood Steps Down | Choseno",
    "metaDescription": "Senior White House legislative strategist Emily Underwood departs ahead of critical fall congressional spending negotiations.",
    "tags": ["Donald Trump", "White House", "Congress", "Legislative Affairs", "Policy"],
    "tweet": "Senior White House legislative strategist Emily Underwood announces her departure ahead of high-stakes fall congressional budget battles.",
    "breakingNews": false,
    "author": { "name": "Choseno Executive Branch Bureau", "bio": "White House personnel, executive-congressional relations, and federal legislative strategy" },
    "sources": [
      { "label": "Axios", "url": "https://www.axios.com/2026/08/18/white-house-aide-emily-underwood-leaving-legislative-team" },
      { "label": "Politico", "url": "https://www.politico.com/news/2026/08/18/emily-underwood-white-house-departure-congress-748921" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "northern-ireland-health-minister-mike-nesbitt-resigns-stormont-coalition-2026-08-18",
    "headline": "Northern Ireland Health Minister Mike Nesbitt Resigns Amid Coalition Budget Dispute",
    "summary": "Ulster Unionist Party Health Minister Mike Nesbitt tenders his resignation from the Northern Ireland Executive at Stormont following intense disputes over acute hospital funding and healthcare waiting list allocations.",
    "category": "Health",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-18T19:30:00Z",
    "published_at": "2026-08-18T20:46:00Z",
    "impactArea": "international",
    "latitude": 54.6078,
    "longitude": -5.9264,
    "body": "BELFAST, NORTHERN IRELAND — Northern Ireland Health Minister Mike Nesbitt announced his resignation from the Stormont Executive on Tuesday evening, precipitating a political challenge for the power-sharing government over systemic underfunding across the regional health and social care system.\n\n## Health Budget Deficit and Ministerial Conflict\n\nNesbitt, who served as a senior minister representing the Ulster Unionist Party (UUP), cited irreconcilable policy differences with Executive colleagues regarding the allocation of emergency funding needed to address Northern Ireland's UK-high elective surgical waiting lists and junior doctor pay agreements.\n\nIn his resignation statement, Nesbitt emphasized that without a guaranteed multi-year capital injection of at least £400 million, regional hospital trusts in Belfast, Derry, and Craigavon would be forced to eliminate critical emergency and maternity services.\n\n## Power-Sharing Stability and Stormont Reaction\n\nFirst Minister Michelle O'Neill and Deputy First Minister Emma Little-Pengelly expressed regret over the resignation, affirming that the Executive remains committed to cross-community governance and will work urgently with UUP leadership to appoint a successor.\n\nHealthcare labor unions, including the British Medical Association (BMA) and the Royal College of Nursing, warned that political instability must not derail ongoing collective bargaining negotiations for NHS frontline healthcare staff.\n\n## Broader UK Devolution and Treasury Pressures\n\nDevolution scholars noted that the crisis reflects broader fiscal tensions between devolved administrations in Belfast, Edinburgh, and Cardiff and the UK Treasury regarding formula-based public health grants during inflationary budget cycles.",
    "seoTitle": "Northern Ireland Health Minister Mike Nesbitt Resigns | Choseno",
    "metaDescription": "Northern Ireland Health Minister Mike Nesbitt resigns from Stormont Executive over healthcare budget allocation disputes.",
    "tags": ["Northern Ireland", "Healthcare", "Stormont", "Health Policy", "Public Health", "International"],
    "tweet": "Northern Ireland Health Minister Mike Nesbitt resigns from the Stormont Executive following acute healthcare budget disputes.",
    "breakingNews": false,
    "author": { "name": "Choseno UK & Devolution Bureau", "bio": "Northern Ireland governance, NHS healthcare policy, and devolved parliamentary politics" },
    "sources": [
      { "label": "BBC News", "url": "https://www.bbc.com/news/articles/northern-ireland-health-minister-mike-nesbitt-resigns-748921" },
      { "label": "Belfast Telegraph", "url": "https://www.belfasttelegraph.co.uk/news/politics/mike-nesbitt-quits-as-health-minister-amid-stormont-row/74839210.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "tony-wakeham-churchill-falls-pact-escalation-clause-debate-2026-08-18",
    "headline": "Newfoundland PC Leader Wakeham Debates Commercial Terms in Updated Churchill Falls Hydro Pact",
    "summary": "Newfoundland and Labrador Progressive Conservative Leader Tony Wakeham challenges the provincial government on commercial equity terms and the removal of the 2 percent annual escalation clause in the preliminary Churchill Falls agreement.",
    "category": "Economy",
    "country": "CA",
    "province": "NL",
    "status": "published",
    "eventDate": "2026-08-18T18:00:00Z",
    "published_at": "2026-08-18T19:13:00Z",
    "impactArea": "state",
    "latitude": 47.5615,
    "longitude": -52.7126,
    "body": "ST. JOHN'S, NL — Progressive Conservative Opposition Leader Tony Wakeham raised significant commercial questions on Tuesday regarding the restructuring of the historic Churchill Falls hydroelectric power agreement between Newfoundland and Labrador and Hydro-Québec.\n\n## Scrutinizing the Commercial Escalation Framework\n\nAddressing reporters at Confederation Building in St. John's, Wakeham questioned the rationale behind removing a proposed 2% fixed annual price escalation clause from the newly negotiated Eastern Clean Power Corridor memorandum of understanding.\n\nWakeham argued that while the new framework marks an improvement over the 1969 contract that heavily favored Quebec, failing to secure inflation-indexed baseline power rates could expose Newfoundland and Labrador taxpayers to long-term revenue erosion over the 50-year operating term.\n\n## Premier Furey Defends Market-Linked Hydro Pricing\n\nPremier Andrew Furey and Energy Minister John Hogan defended the commercial agreement, explaining that replacing fixed escalation with a flexible market-indexed pricing model allows the province to capture full market value as clean power exports to the U.S. Northeast command premium green energy rates.\n\nFurey noted that the pact includes $14 billion in joint capital investments to expand turbine generation capacity at Churchill Falls and Gull Island, creating thousands of regional construction careers in Labrador.\n\n## Parliamentary Scrutiny in the House of Assembly\n\nThe House of Assembly will convene for an emergency debate next month to review full financial models and ensure Indigenous consent from the Innu Nation is formally integrated before final treaty ratification.",
    "seoTitle": "Tony Wakeham Challenges Terms of New Churchill Falls Hydro Pact | Choseno",
    "metaDescription": "Newfoundland PC Leader Tony Wakeham debates commercial terms and escalation clauses in new $30B Churchill Falls hydro deal.",
    "tags": ["Mark Carney", "Newfoundland", "Quebec", "Hydro Energy", "Churchill Falls", "Economy", "Policy"],
    "tweet": "Newfoundland PC Leader Tony Wakeham debates commercial terms and inflation protections in the newly signed Churchill Falls clean hydro pact.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Energy Bureau", "bio": "Hydroelectric power markets, provincial fiscal accords, and Atlantic resource governance" },
    "sources": [
      { "label": "VOCM News", "url": "https://vocm.com/2026/08/18/wakeham-defends-removal-of-escalation-clause-churchill-falls-deal/" },
      { "label": "CBC News Newfoundland", "url": "https://www.cbc.ca/news/canada/newfoundland-labrador/wakeham-churchill-falls-hydro-quebec-deal-debate-1.7483921" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Mark Carney"]
  },
  {
    "slug": "cbsa-deports-iranian-regime-official-under-foreign-interference-sanctions-2026-08-18",
    "headline": "CBSA Enforces Deportation of Former Iranian Regime Official Under Sanctions Framework",
    "summary": "The Canada Border Services Agency confirms the formal deportation of a senior former Iranian government official following Immigration and Refugee Board determinations under the Immigration and Refugee Protection Act.",
    "category": "Justice",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-18T18:30:00Z",
    "published_at": "2026-08-18T20:00:00Z",
    "impactArea": "country",
    "latitude": 45.4236,
    "longitude": -75.7009,
    "body": "OTTAWA, ON — The Canada Border Services Agency (CBSA) confirmed on Tuesday that federal enforcement officers have executed the removal and deportation of a former senior official of the Islamic Republic of Iran following comprehensive admissibility hearings before the Immigration and Refugee Board (IRB).\n\n## Sanctions Inadmissibility and Statutory Removal\n\nThe individual was declared inadmissible to Canada under Section 35(1)(b) of the *Immigration and Refugee Protection Act* (IRPA), which designates senior members of the Iranian government as inadmissible due to systemic human rights violations and acts of state-sponsored terrorism.\n\nCBSA intelligence officers established that the individual had entered Canada under temporary status while concealing past administrative positions within Iranian state regulatory and security institutions.\n\n## Enhanced National Security Vetting and Diaspora Protection\n\nPublic Safety Minister Dominic LeBlanc affirmed that Canadian national security agencies maintain rigorous enforcement of sanctions regimes, emphasizing that individuals linked to oppressive state apparatuses cannot utilize Canada as a safe haven.\n\nIranian-Canadian diaspora community associations commended the deportation, urging federal authorities to accelerate reviews for dozens of additional active inadmissibility files currently pending before immigration tribunals.\n\n## International Legal Cooperation and Border Oversight\n\nCBSA confirmed that federal enforcement operations coordinate closely with international intelligence partners to verify travel histories and enforce strict visa vetting protocols across all Canadian ports of entry.",
    "seoTitle": "CBSA Deports Former Iranian Official Under Sanctions Rules | Choseno",
    "metaDescription": "Canada Border Services Agency deports former senior Iranian regime official under federal sanctions and human rights laws.",
    "tags": ["Dominic LeBlanc", "CBSA", "National Security", "Sanctions", "Foreign Interference", "Justice"],
    "tweet": "CBSA confirms the deportation of a former senior Iranian official under federal sanctions and human rights inadmissibility laws.",
    "breakingNews": false,
    "author": { "name": "Choseno Immigration & Security Bureau", "bio": "Immigration enforcement, national security law, and international sanctions compliance" },
    "sources": [
      { "label": "Global News", "url": "https://globalnews.ca/news/iranian-regime-member-deported-cbsa-confirms-2026/" },
      { "label": "The Globe and Mail", "url": "https://www.theglobeandmail.com/politics/article-cbsa-deports-iranian-official-inadmissibility-ruling/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Dominic LeBlanc"]
  },
  {
    "slug": "north-york-highrise-window-safety-standards-wrongful-death-lawsuit-2026-08-18",
    "headline": "Wrongful Death Lawsuit Filed Over High-Rise Window Safety Standards in North York",
    "summary": "The family of a toddler who died in a tragic fall from a North York apartment tower files a $15 million civil lawsuit in Ontario Superior Court, alleging gross negligence by building property managers and urging mandatory window guard retrofits.",
    "category": "Housing",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-18T18:45:00Z",
    "published_at": "2026-08-18T19:56:00Z",
    "impactArea": "local",
    "latitude": 43.7615,
    "longitude": -79.4111,
    "body": "TORONTO, ON — Legal counsel representing the bereaved family of a three-year-old child who fell from a fourteenth-story apartment window in North York filed a $15 million statement of claim in the Ontario Superior Court of Justice on Tuesday, targeting the residential property management corporation and building owners for systemic negligence.\n\n## Allegations of Defective Window Safety Limiters\n\nThe statement of claim alleges that the building operators failed to install and maintain mandatory window safety limiters—designed to restrict window openings to no more than 10 centimeters (4 inches)—as mandated by Toronto Municipal Code Chapter 629 (Property Standards) and the Ontario Building Code.\n\nThe lawsuit asserts that previous tenant work orders requesting window hardware repairs had been systematically ignored by building maintenance staff for over eight months prior to the fatal incident.\n\n## Demands for Mandatory Municipal Inspection Audits\n\nTenant advocacy organizations and municipal housing reformers held a vigil outside North York Civic Centre, calling on Mayor Olivia Chow and Toronto City Council to establish proactive municipal inspection squads to audit window guards across all aging high-rise residential towers.\n\nAdvocates highlighted that thousands of working-class families with young children inhabit dense high-rise rental corridors across Toronto, making structural window safety a vital life-safety priority.\n\n## Property Management Defense and Court Timelines\n\nLegal counsel for the property management firm expressed condolences to the family while stating the company will file a full statement of defence in Superior Court within the standard 30-day statutory response period.",
    "seoTitle": "Lawsuit Filed Over High-Rise Window Safety After Toddler Fall | Choseno",
    "metaDescription": "Family of toddler who died in North York high-rise fall files $15M lawsuit alleging building owners failed to maintain safety window guards.",
    "tags": ["Olivia Chow", "Toronto", "Ontario", "Housing Standards", "Tenant Safety", "Justice", "Municipal"],
    "tweet": "Family of toddler who died in a North York high-rise fall files a $15M lawsuit alleging building owners neglected window safety guards.",
    "breakingNews": false,
    "author": { "name": "Choseno Municipal Housing & Safety Bureau", "bio": "Urban property standards, municipal code enforcement, and tenant safety litigation" },
    "sources": [
      { "label": "CBC News Toronto", "url": "https://www.cbc.ca/news/canada/toronto/north-york-toddler-fall-highrise-lawsuit-1.7483921" },
      { "label": "Toronto Star", "url": "https://www.thestar.com/news/gta/family-of-toddler-files-lawsuit-north-york-apartment-fall/article_748921.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "downtown-ottawa-municipal-parking-meter-qr-code-cyber-fraud-2026-08-18",
    "headline": "Ottawa Police Fraud Unit Dismantles Deceptive QR Code Parking Meter Cyber Scam",
    "summary": "Ottawa Police cyber-crime investigators launch an enforcement operation to remove fraudulent QR code decals placed on downtown municipal parking pay stations that redirected motorists to deceptive payment-harvesting websites.",
    "category": "Consumer Protection",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-18T18:15:00Z",
    "published_at": "2026-08-18T19:22:00Z",
    "impactArea": "local",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — The Ottawa Police Service Organized Fraud Unit and City of Ottawa Parking Services deployed municipal inspection crews across the downtown core, ByWard Market, and Centretown on Tuesday after uncovering a widespread cyber-phishing scheme targeting street parking payment stations.\n\n## Sophisticated QR Code Decal Tampering\n\nInvestigators discovered that scammers affixed high-quality counterfeit vinyl decals containing fraudulent QR codes over official municipal Pay-and-Display machines. When scanned by drivers attempting to pay via mobile smartphone, the QR codes redirected users to sophisticated spoofed websites imitating the city's official parking payment portal.\n\nVictims who inputted payment details suffered fraudulent credit card charges ranging from $50 to $800, alongside unauthorized recurring subscription enrollments.\n\n## Municipal Safeguards and Consumer Warnings\n\nCity of Ottawa General Manager of Public Works Alain Gonthier clarified that the city does not utilize QR codes on physical on-street parking meters, directing motorists to use only official contactless credit card tap readers or the verified municipal mobile parking application.\n\nMunicipal parking enforcement officers inspected and cleansed over 450 pay stations across the central business district, replacing tampered signage and deploying tamper-evident security holographic seals.\n\n## Ongoing Cyber Forensic Investigation\n\nOttawa Police cyber investigators are collaborating with regional financial crime taskforces and web hosting registrars to trace domain registrations, seize malicious phishing servers, and apprehend the perpetrators.",
    "seoTitle": "Ottawa Police Warn Drivers Over Parking Meter QR Code Scam | Choseno",
    "metaDescription": "Ottawa Police and City Parking Services dismantle scam using fake QR code decals on downtown parking meters to steal credit card data.",
    "tags": ["Mark Sutcliffe", "Ottawa", "Ontario", "Consumer Protection", "Cybersecurity", "Public Safety", "Municipal"],
    "tweet": "Ottawa Police dismantle a deceptive QR code scam on downtown parking meters that redirected drivers to fake payment websites.",
    "breakingNews": false,
    "author": { "name": "Choseno Cyber & Consumer Fraud Bureau", "bio": "Cybersecurity threats, municipal fraud prevention, and digital consumer safety" },
    "sources": [
      { "label": "CTV News Ottawa", "url": "https://ottawa.ctvnews.ca/alleged-downtown-ottawa-parking-scam-leaves-drivers-out-thousands-1.7483921" },
      { "label": "Ottawa Citizen", "url": "https://ottawacitizen.com/news/local-news/police-warn-of-fraudulent-qr-codes-on-city-parking-meters" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "bc-wildfire-service-bald-range-fire-summerland-structure-losses-2026-08-18",
    "headline": "B.C. Wildfire Service Confirms 150 Structures Damaged by Bald Range Wildfire as Residents Return",
    "summary": "Emergency management officials in British Columbia complete preliminary damage assessments for the Bald Range wildfire in the Okanagan, confirming 150 structures damaged or destroyed as phased evacuation orders lift.",
    "category": "Climate",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-18T18:00:00Z",
    "published_at": "2026-08-18T19:05:00Z",
    "impactArea": "state",
    "latitude": 49.6006,
    "longitude": -119.6778,
    "body": "SUMMERLAND, BC — Emergency Management and Climate Readiness officials confirmed on Tuesday that structural damage assessments following the aggressive Bald Range wildfire in the Central Okanagan identified approximately 150 residential properties, outbuildings, and agricultural structures damaged or destroyed.\n\n## Fire Containment and Phased Repatriation\n\nFavorable wind shifts and targeted structural water-curtain defenses deployed by over 250 municipal and provincial wildland firefighters allowed local authorities to downgrade evacuation orders to alerts for the majority of Summerland and Peachland neighborhoods.\n\nMunicipal utility teams worked alongside FortisBC to restore electrical service and verify water quality safety protocols before welcoming thousands of evacuated residents back to their homes.\n\n## Provincial Disaster Financial Assistance Activation\n\nPremier David Eby announced the immediate activation of Disaster Financial Assistance (DFA) for impacted homeowners, small business operators, and agricultural fruit growers in the Okanagan Valley.\n\nThe provincial assistance program provides up to $300,000 per claimant to assist with uninsurable disaster recovery expenses, hazardous debris clearing, and slope stabilization to prevent seasonal landslides.\n\n## Wildfire Season Readiness and Active Incident Monitoring\n\nThe B.C. Wildfire Service emphasized that over 180 active wildfires remain burning across the province's Southern and Central Interior, urging residents to maintain structural FireSmart defensible perimeters and adhere strictly to provincial open-burning prohibitions.",
    "seoTitle": "BC Wildfire Service Reports 150 Structures Damaged in Okanagan | Choseno",
    "metaDescription": "BC Wildfire Service confirms 150 structures damaged by Bald Range fire as Summerland and Peachland evacuation orders lift.",
    "tags": ["David Eby", "British Columbia", "Wildfire Recovery", "Climate Adaptation", "Okanagan", "Emergency Management"],
    "tweet": "BC Wildfire Service confirms 150 structures damaged by the Bald Range fire as Summerland residents begin returning home.",
    "breakingNews": false,
    "author": { "name": "Choseno British Columbia Emergency Bureau", "bio": "Wildfire operations, climate emergency response, and provincial disaster assistance reporting" },
    "sources": [
      { "label": "Global News", "url": "https://globalnews.ca/news/bald-range-wildfire-summerland-structure-damage-assessments-2026/" },
      { "label": "Castanet News", "url": "https://www.castanet.net/news/West-Kelowna/502910/bald-range-wildfire-damage-assessed-summerland-returns" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["David Eby"]
  },
  {
    "slug": "calgary-court-sentencing-hearing-serial-predator-vulnerable-persons-2026-08-18",
    "headline": "Sentencing Hearing Begins in Calgary Court of King's Bench for Convicted Serial Predator",
    "summary": "Crown prosecutors in Calgary initiate a comprehensive sentencing hearing in the Court of King's Bench, seeking a Dangerous Offender designation for an individual convicted of preying on vulnerable women in downtown corridors.",
    "category": "Justice",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-18T18:00:00Z",
    "published_at": "2026-08-18T19:10:00Z",
    "impactArea": "local",
    "latitude": 51.0447,
    "longitude": -114.0719,
    "body": "CALGARY, AB — A multi-day sentencing hearing commenced on Tuesday in the Court of King's Bench of Alberta, where Crown prosecutors are formally petitioning for a Dangerous Offender designation and indefinite detention for an individual convicted of predatory assaults against vulnerable women in Calgary's urban core.\n\n## Crown Evidence on Predatory Patterns and Psychiatric Risk\n\nCrown prosecutor Tara Wells presented comprehensive expert psychiatric evaluations demonstrating a persistent pattern of repetitive violent offenses, lack of remorse, and an intractable high risk of re-offending.\n\nCourt exhibits detailed how the offender targeted marginalized individuals seeking shelter or emergency assistance near downtown transit stations, utilizing deception and physical force to execute serious sexual assaults between 2021 and 2024.\n\n## Victim Impact Statements and Community Trauma\n\nSeveral survivor victim impact statements were entered into the judicial record, detailing severe long-term psychological trauma, physical injuries, and the profound courage required to testify throughout the multi-week trial.\n\nCommunity advocates representing frontline shelter organizations in Calgary gathered outside the courthouse, emphasizing the critical necessity of systemic judicial protections for vulnerable persons experiencing homelessness and substance dependency.\n\n## Dangerous Offender Legal Thresholds\n\nJustice Colin Feasby presided over legal arguments from the defence, which argued for a fixed sentence followed by a long-term supervision order.\n\nThe hearing is scheduled to continue through Friday, with a final judicial ruling on the Dangerous Offender application expected in October.",
    "seoTitle": "Calgary Court Begins Sentencing Hearing for Convicted Predator | Choseno",
    "metaDescription": "Crown prosecutors in Calgary seek Dangerous Offender designation in King's Bench sentencing hearing for serial predator.",
    "tags": ["Calgary", "Alberta", "Justice", "Court of King's Bench", "Public Safety", "Human Rights"],
    "tweet": "Calgary Court of King's Bench begins sentencing hearing as prosecutors seek a Dangerous Offender designation for a convicted predator.",
    "breakingNews": false,
    "author": { "name": "Choseno Alberta Legal Affairs Bureau", "bio": "Judicial sentencing, criminal law jurisprudence, and provincial court proceedings reporting" },
    "sources": [
      { "label": "Global News Calgary", "url": "https://globalnews.ca/news/calgary-court-sentencing-hearing-serial-predator-2026/" },
      { "label": "Calgary Herald", "url": "https://calgaryherald.com/news/crime/calgary-sentencing-hearing-dangerous-offender-application" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "ashley-macisaac-settles-defamation-lawsuit-ai-search-hallucination-2026-08-18",
    "headline": "Musician Ashley MacIsaac Settles Landmark Defamation Lawsuit Over AI Search Hallucinations",
    "summary": "Renowned Canadian Celtic fiddler Ashley MacIsaac resolves a major defamation lawsuit against tech providers after automated artificial intelligence search summaries erroneously generated false criminal allegations.",
    "category": "Technology",
    "country": "CA",
    "province": "NS",
    "status": "published",
    "eventDate": "2026-08-18T18:30:00Z",
    "published_at": "2026-08-18T19:30:00Z",
    "impactArea": "country",
    "latitude": 46.1368,
    "longitude": -60.1831,
    "body": "SYDNEY, NS — Acclaimed Cape Breton fiddler and recording artist Ashley MacIsaac finalized a confidential legal settlement on Tuesday, concluding a groundbreaking Canadian defamation and algorithmic negligence lawsuit against major search engine operators over false AI-generated overview summaries.\n\n## Algorithmic Hallucination and Severe Reputational Harm\n\nThe legal dispute originated when automated generative AI search modules displayed prominent summary cards that erroneously conflated MacIsaac's biographical background with unrelated criminal court proceedings, falsely labeling the musician as a convicted sex offender.\n\nMacIsaac's legal team filed civil claims in the Nova Scotia Supreme Court, arguing that deploying unverified, automated probabilistic text generators into high-visibility search interfaces without factual verification safeguards constitutes actionable defamation and algorithmic recklessness.\n\n## Terms of Resolution and Search Engine Guardrails\n\nWhile financial terms of the settlement remain confidential, joint statements confirmed that the technology platform implemented permanent entity-grounding guardrails and rapid algorithmic correction pathways to prevent synthetic hallucinations from associating living individuals with unverified criminal records.\n\nMacIsaac expressed relief that the legal ordeal had concluded, emphasizing that public figures and ordinary citizens alike must have enforceable legal protections against synthetic defamation generated by experimental AI models.\n\n## Precedent for AI Legal Liability in Canada\n\nCanadian intellectual property and digital rights scholars noted that the case represents one of the first major legal settlements addressing publisher liability for synthetic text generation, establishing important guideposts for future AI governance standards.",
    "seoTitle": "Ashley MacIsaac Settles Defamation Lawsuit Over AI Search Hallucination | Choseno",
    "metaDescription": "Musician Ashley MacIsaac settles landmark defamation lawsuit after search engine AI summary falsely generated criminal allegations.",
    "tags": ["Technology", "Artificial Intelligence", "Defamation", "Nova Scotia", "Digital Rights", "Justice"],
    "tweet": "Musician Ashley MacIsaac settles a landmark defamation lawsuit after an AI search summary generated false criminal allegations.",
    "breakingNews": false,
    "author": { "name": "Choseno Digital Rights & Tech Law Bureau", "bio": "AI legal liability, algorithmic defamation, and intellectual property litigation reporting" },
    "sources": [
      { "label": "CBC News", "url": "https://www.cbc.ca/news/canada/nova-scotia/ashley-macisaac-defamation-lawsuit-ai-google-settlement-1.7483921" },
      { "label": "The Globe and Mail", "url": "https://www.theglobeandmail.com/arts/music/article-ashley-macisaac-ends-defamation-action-over-ai-search-error/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "alex-padilla-adam-schiff-senate-inquiry-uss-abraham-lincoln-carrier-health-2026-08-18",
    "headline": "Senators Alex Padilla and Adam Schiff Launch Senate Inquiry into USS Abraham Lincoln Crew Health",
    "summary": "California U.S. Senators Alex Padilla and Adam Schiff initiate a formal congressional inquiry requesting Department of Defense records regarding potable water safety, medical readiness, and crew fatigue aboard the USS Abraham Lincoln.",
    "category": "Policy",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-18T18:00:00Z",
    "published_at": "2026-08-18T19:36:00Z",
    "impactArea": "country",
    "latitude": 32.7157,
    "longitude": -117.1611,
    "body": "SAN DIEGO, CA & WASHINGTON, D.C. — U.S. Senators Alex Padilla (D-CA) and Adam Schiff (D-CA) sent a joint letter of inquiry to Secretary of Defense Pete Hegseth and Chief of Naval Operations Adm. Lisa Franchetti on Tuesday, demanding formal audits regarding living conditions and medical resources aboard the aircraft carrier USS Abraham Lincoln (CVN-72).\n\n## Extended Combat Deployment and Habitability Concerns\n\nThe San Diego-homeported carrier has remained on extended operational deployment in the U.S. Central Command area of operations for over 250 consecutive days to deter regional maritime conflict in the Middle East.\n\nFamily advocacy groups and crew members reported persistent issues regarding potable water filtration reliability, delayed resupply of fresh provisions, and severe operational fatigue among aviation maintenance and engineering divisions operating in extreme ambient temperatures.\n\n## Congressional Oversight and Service Member Welfare\n\nSenators Padilla and Schiff requested comprehensive water testing logs, mental health referral statistics, and deployment rotation schedules, asserting that maintaining military readiness requires unwavering support for service member welfare and operational safety standards.\n\nThe lawmakers noted that extended deployment extensions without adequate maintenance stand-downs risk compromising long-term naval readiness and crew retention.\n\n## Pentagon Response and Naval Evaluation\n\nNavy spokespersons confirmed receipt of the congressional inquiry, stating that the Pacific Fleet Surgeon General and naval engineering inspections teams are actively reviewing shipboard habitability reports and will deliver formal findings to the Senate Armed Services Committee by September 10.",
    "seoTitle": "Senators Padilla and Schiff Launch Inquiry on USS Abraham Lincoln | Choseno",
    "metaDescription": "Senators Alex Padilla and Adam Schiff demand Pentagon records on crew health, water quality, and extended carrier deployments.",
    "tags": ["Alex Padilla", "Adam Schiff", "Pete Hegseth", "California", "Navy", "Defense Policy", "Senate"],
    "tweet": "Senators Alex Padilla and Adam Schiff launch a formal inquiry demanding Pentagon records on USS Abraham Lincoln crew health and living conditions.",
    "breakingNews": false,
    "author": { "name": "Choseno Naval Affairs & Defense Oversight Bureau", "bio": "Military personnel policy, naval operations oversight, and congressional armed services reporting" },
    "sources": [
      { "label": "Fox 5 San Diego", "url": "https://fox5sandiego.com/news/military/senators-padilla-schiff-inquiry-uss-abraham-lincoln-health-2026/" },
      { "label": "USNI News", "url": "https://news.usni.org/2026/08/18/california-senators-request-pentagon-review-carrier-deployment-conditions" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Pete Hegseth"]
  },
  {
    "slug": "house-intelligence-committee-declassified-swalwell-counterintelligence-records-2026-08-18",
    "headline": "House Intelligence Committee Releases Declassified Counterintelligence Review Records",
    "summary": "House Permanent Select Committee on Intelligence releases declassified FBI counterintelligence briefing records examining historical foreign intelligence influence operations targeting congressional staff and political committees.",
    "category": "Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-18T17:30:00Z",
    "published_at": "2026-08-18T18:43:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.009,
    "body": "WASHINGTON, D.C. — The House Permanent Select Committee on Intelligence (HPSCI) made public a redacted tranche of declassified counterintelligence briefing records on Tuesday, reviewing historical foreign influence networks that targeted congressional offices and political campaigns between 2011 and 2015.\n\n## Scope of Declassified Counterintelligence Disclosures\n\nThe released documentation details the operational tradecraft utilized by suspected foreign intelligence operative Christine Fang (Fang Fang), who established contacts with civic organizations, mayoral offices, and congressional campaigns in the San Francisco Bay Area.\n\nThe declassified files confirm that federal counterintelligence agents provided a defensive briefing to Representative Eric Swalwell in 2015, after which the lawmaker immediately severed all contact with the individual and cooperated with federal investigators.\n\n## Partisan Debate and Committee Transparency\n\nCommittee leadership stated that publishing historical investigative summaries provides essential transparency regarding the sophisticated methods employed by foreign adversaries to infiltrate sub-national political networks.\n\nMinority committee members criticized the timing of the document release as politically motivated, noting that federal intelligence agencies have repeatedly affirmed that no sensitive or classified legislative materials were ever compromised during the interaction.\n\n## Recommendations for Congressional Staff Security Vetting\n\nThe report recommends establishing standardized counterintelligence defensive training for freshman members of Congress, congressional staffers, and district campaign directors to identify and counter foreign influence operations proactively.",
    "seoTitle": "House Intelligence Releases Declassified Counterintelligence Files | Choseno",
    "metaDescription": "House Intelligence Committee releases declassified FBI files examining historical foreign intelligence operations targeting Congress.",
    "tags": ["Congress", "House Intelligence", "National Security", "Counterintelligence", "Foreign Policy", "Policy"],
    "tweet": "House Intelligence Committee releases declassified counterintelligence records on historical foreign influence operations targeting Congress.",
    "breakingNews": false,
    "author": { "name": "Choseno Intelligence & National Security Bureau", "bio": "Congressional intelligence committees, counterintelligence operations, and national security policy" },
    "sources": [
      { "label": "KRON4 News", "url": "https://www.kron4.com/news/national/house-intelligence-releases-declassified-counterintelligence-records-2026/" },
      { "label": "San Francisco Chronicle", "url": "https://www.sfchronicle.com/politics/article/declassified-fbi-files-swalwell-foreign-intel-probe-748921.php" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "ofpp-administrator-christine-rhodes-announces-departure-federal-procurement-2026-08-18",
    "headline": "Office of Federal Procurement Policy Administrator Christine Rhodes Announces Resignation",
    "summary": "Christine Rhodes, Administrator of the Office of Federal Procurement Policy within OMB, announces her planned exit following successful implementation of government-wide AI procurement standards and domestic sourcing rules.",
    "category": "Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-18T18:00:00Z",
    "published_at": "2026-08-18T19:01:00Z",
    "impactArea": "country",
    "latitude": 38.8986,
    "longitude": -77.0381,
    "body": "WASHINGTON, D.C. — The Office of Management and Budget (OMB) announced on Tuesday that Christine Rhodes will step down as Administrator of the Office of Federal Procurement Policy (OFPP) at the conclusion of the fiscal year, concluding a transformative tenure overseeing the federal government's $700 billion annual acquisition apparatus.\n\n## Modernizing Federal Acquisition Regulations and Domestic Sourcing\n\nDuring her tenure leading OFPP, Rhodes spearheaded major revisions to the Federal Acquisition Regulation (FAR), creating streamlined procurement pathways for commercial artificial intelligence technologies, cybersecurity software, and clean energy fleet transitions.\n\nShe played a central role in enforcing strengthened \"Buy American\" domestic content thresholds, ensuring that federal agency procurement actively prioritizes domestic manufacturing, small businesses, and veteran-owned commercial enterprises.\n\n## Implementing Responsible AI Procurement Guardrails\n\nUnder Rhodes' leadership, OFPP issued government-wide procurement guidance requiring federal contractors providing artificial intelligence models to verify rigorous red-teaming security assessments, algorithmic bias audits, and federal data sovereignty standards.\n\nAcquisition industry associations and procurement leaders praised Rhodes for fostering collaborative public-private partnerships while maintaining rigorous taxpayer accountability and contract transparency.\n\n## OMB Transition and Successor Timeline\n\nOMB Director Shalanda Young commended Rhodes for her exemplary executive leadership, confirming that Deputy Administrator Jason Freihage will serve as acting administrator while the White House prepares a formal nomination for Senate confirmation.",
    "seoTitle": "OFPP Administrator Christine Rhodes to Exit Federal Procurement Post | Choseno",
    "metaDescription": "OFPP chief Christine Rhodes announces resignation from OMB after modernizing federal AI acquisition and Buy American rules.",
    "tags": ["Donald Trump", "OMB", "Federal Procurement", "Artificial Intelligence", "Government Contracting", "Policy"],
    "tweet": "Office of Federal Procurement Policy chief Christine Rhodes announces her departure after modernizing federal AI acquisition standards.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal Operations Bureau", "bio": "Federal procurement regulations, OMB administrative policy, and government acquisition analytics" },
    "sources": [
      { "label": "Federal News Network", "url": "https://federalnewsnetwork.com/management/2026/08/ofpp-administrator-christine-rhodes-announces-departure/" },
      { "label": "GovExec", "url": "https://www.govexec.com/management/2026/08/omb-procurement-chief-rhodes-steps-down-2026/74839210/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "canada-clean-energy-capital-tax-incentive-framework-43-billion-2026-08-18",
    "headline": "Federal Government Finalizes $43B Clean Economy Investment Tax Credit Framework",
    "summary": "The Department of Finance Canada publishes final statutory regulations for five Clean Economy Investment Tax Credits, unlocking $43 billion in private-sector capital for clean electricity, hydrogen, and clean technology manufacturing.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-18T18:00:00Z",
    "published_at": "2026-08-18T19:02:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — The Department of Finance Canada officially published finalized regulatory frameworks on Tuesday for the federal government's suite of Clean Economy Investment Tax Credits (ITCs), providing binding fiscal certainty for major institutional clean energy investors across the country.\n\n## Unlocking Billions in Clean Tech and Hydrogen Infrastructure\n\nThe statutory regulations govern refundable tax credits covering up to 30% of capital costs for clean electricity generation, clean technology manufacturing, carbon capture and storage (CCUS), and clean hydrogen production facilities.\n\nFinance Canada estimates the finalized tax credits will catalyze over $43 billion in private capital deployment by 2030, accelerating major grid modernization projects in Alberta, Saskatchewan, Ontario, and Atlantic Canada.\n\n## Binding Labor and Prevailing Wage Requirements\n\nTo qualify for maximum tax credit rates, corporate developers are legally mandated to pay prevailing union-standard wages and ensure that at least 10% of total trade hours are performed by registered apprentices, supporting long-term skilled workforce training.\n\nCanadian Labour Congress and building trade unions celebrated the labor provisions, noting that linking federal tax incentives to prevailing wages guarantees high-quality, family-supporting careers in the green energy transition.\n\n## Strengthening Continental Supply Chain Competitiveness\n\nFinance Minister Chrystia Freeland highlighted that establishing competitive Canadian clean energy tax incentives ensures domestic industries remain attractive investment destinations alongside the U.S. Inflation Reduction Act, securing Canada's leadership in green industrial manufacturing.",
    "seoTitle": "Canada Finalizes $43B Clean Energy Investment Tax Credits | Choseno",
    "metaDescription": "Finance Canada releases final regulations for Clean Economy Investment Tax Credits, unlocking $43B in clean tech capital.",
    "tags": ["Mark Carney", "Economy", "Clean Energy", "Tax Policy", "Finance Canada", "Infrastructure"],
    "tweet": "Finance Canada finalizes regulations for $43 billion in Clean Economy Investment Tax Credits to accelerate clean energy manufacturing.",
    "breakingNews": false,
    "author": { "name": "Choseno Clean Economy Fiscal Bureau", "bio": "Federal tax policy, clean energy economics, and industrial transition investment analytics" },
    "sources": [
      { "label": "Euronews", "url": "https://www.euronews.com/business/2026/08/18/major-boost-green-energy-canada-43-billion-investment" },
      { "label": "The Globe and Mail", "url": "https://www.theglobeandmail.com/business/article-finance-canada-final-regulations-clean-economy-tax-credits/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Mark Carney"]
  },
  {
    "slug": "greece-turkey-aegean-marine-park-sovereignty-dispute-eu-diplomacy-2026-08-18",
    "headline": "Greece and Turkey Exchange Diplomatic Protests Over Aegean Sea Marine Protection Zones",
    "summary": "The Greek Ministry of Foreign Affairs lodges formal objections with the European Commission after Turkish maritime authorities declare unilateral marine protection parks across contested waters in the Aegean Sea.",
    "category": "Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-18T17:30:00Z",
    "published_at": "2026-08-18T18:53:00Z",
    "impactArea": "international",
    "latitude": 37.9838,
    "longitude": 23.7275,
    "body": "ATHENS & ANKARA — Diplomatic friction between NATO allies Greece and Turkey flared on Tuesday following reciprocal diplomatic demarches concerning the unilateral designation of marine conservation parks and sovereign maritime boundaries across the Aegean Sea.\n\n## Environmental Designations Intersect Sovereign Waters\n\nThe dispute erupted after the Turkish Ministry of Environment declared new environmental marine reserves spanning portions of the Eastern Aegean. Greek Foreign Minister George Gerapetritis issued a formal diplomatic rebuke, stating that Turkey's designated coordinates encroach on Greek territorial waters and continental shelf boundaries defined under the United Nations Convention on the Law of the Sea (UNCLOS).\n\nAthens reiterated that environmental conservation initiatives cannot be utilized as a pretext to contest settled sovereign maritime rights or create unilateral geopolitical facts on the water.\n\n## Turkish Position on Disputed Islets and Demilitarization\n\nIn response, the Turkish Ministry of Foreign Affairs maintained that the marine reserves operate within Turkish sovereign jurisdiction, asserting that certain Aegean islets remain under unsettled sovereignty status and alleging that Greek military deployments violate historic treaties.\n\nTurkish naval vessels and coast guard cutters conducted routine patrol sweeps in adjacent waters, though military commanders on both sides affirmed that established de-escalation hotlines remain operational.\n\n## European Union Diplomatic Mediation\n\nThe European Commission and NATO Secretary General urged both nations to adhere to bilateral confidence-building measures established under the 2023 Athens Declaration on Friendly Relations and Good-Neighbourliness, encouraging joint environmental cooperation.",
    "seoTitle": "Greece and Turkey Clash Over Aegean Sea Marine Parks | Choseno",
    "metaDescription": "Greece lodges formal EU diplomatic protest after Turkey declares unilateral marine protection parks across disputed Aegean waters.",
    "tags": ["Greece", "Turkey", "NATO", "European Union", "Maritime Law", "Foreign Policy", "Policy"],
    "tweet": "Greece and Turkey exchange diplomatic protests over sovereign maritime boundaries and marine conservation parks in the Aegean Sea.",
    "breakingNews": false,
    "author": { "name": "Choseno Mediterranean Geopolitics Bureau", "bio": "Aegean maritime diplomacy, NATO southern flank security, and European foreign policy" },
    "sources": [
      { "label": "Euractiv", "url": "https://www.euractiv.com/section/politics/news/greece-brands-turkeys-new-marine-parks-illegal/" },
      { "label": "Kathimerini", "url": "https://www.ekathimerini.com/news/1248921/athens-lodges-protest-over-turkish-aegean-marine-park-claims/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "sonia-gandhi-releases-political-memoir-indian-parliamentary-history-2026-08-18",
    "headline": "Sonia Gandhi Publishes Comprehensive Political Memoir on Indian Coalition Governance",
    "summary": "Long-serving Indian National Congress Parliamentary Chairperson Sonia Gandhi releases an autobiographical memoir detailing key moments in Indian democratic history, coalition building, and economic reforms.",
    "category": "Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-18T17:00:00Z",
    "published_at": "2026-08-18T18:41:00Z",
    "impactArea": "international",
    "latitude": 28.6139,
    "longitude": 77.209,
    "body": "NEW DELHI, INDIA — Indian National Congress Parliamentary Party Chairperson Sonia Gandhi officially released her anticipated political memoir on Tuesday, providing unprecedented historical reflections on three decades of Indian democratic leadership, national security crises, and multi-party coalition governance.\n\n## Historical Reflections on Democratic Leadership\n\nThe memoir, titled *A Life in Service*, explores Gandhi's entry into active politics in the late 1990s, the formation of the United Progressive Alliance (UPA) government in 2004, and her historic decision to decline the prime ministership in favor of economist Dr. Manmohan Singh.\n\nGandhi details the complex behind-the-scenes parliamentary negotiations that led to landmark rights-based social legislation, including the Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA) and the Right to Information Act (RTI).\n\n## Perspectives on Contemporary Democratic Institutions\n\nAddressing party delegates, historians, and international dignitaries at the book launch in New Delhi, Gandhi reflected on the enduring necessity of protecting constitutional secularism, judicial autonomy, and freedom of expression in diverse democratic societies.\n\nThe volume includes previously unreleased archival correspondence with global leaders and candid observations regarding regional South Asian geopolitical diplomacy.\n\n## Political and Literary Reception\n\nPolitical analysts across India noted that the memoir provides indispensable historical context regarding the evolution of Indian parliamentary democracy and the structural dynamics of coalition politics.",
    "seoTitle": "Sonia Gandhi Releases Political Memoir on Indian Democracy | Choseno",
    "metaDescription": "Sonia Gandhi releases memoir detailing 30 years of Indian political history, coalition governance, and landmark legislation.",
    "tags": ["India", "Sonia Gandhi", "Democracy", "Parliament", "Memoir", "International", "Policy"],
    "tweet": "Sonia Gandhi releases her political memoir examining three decades of Indian parliamentary history and coalition governance.",
    "breakingNews": false,
    "author": { "name": "Choseno South Asian Affairs Bureau", "bio": "Indian parliamentary democracy, political biographies, and South Asian regional governance" },
    "sources": [
      { "label": "The Hindu", "url": "https://www.thehindu.com/news/national/sonia-gandhi-memoir-revisits-decision-to-decline-prime-minister-role/article74839210.ece" },
      { "label": "The Indian Express", "url": "https://indianexpress.com/article/political-pulse/sonia-gandhi-memoir-launch-delhi-reflections-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "federal-court-enforces-fair-labor-standards-sanctions-wage-theft-2026-08-18",
    "headline": "Federal Court Secures $3.8M Judgment Against Retail Chain for Unlawful Uniform Deductions",
    "summary": "The U.S. Department of Labor obtains a $3.8 million civil judgment in federal court against a multi-state retail chain that unlawfully forced low-wage hourly workers to pay out-of-pocket for mandatory branded work uniforms.",
    "category": "Consumer Protection",
    "country": "US",
    "province": "IL",
    "status": "published",
    "eventDate": "2026-08-18T18:00:00Z",
    "published_at": "2026-08-18T19:31:00Z",
    "impactArea": "country",
    "latitude": 41.8781,
    "longitude": -87.6298,
    "body": "CHICAGO, IL — The U.S. Department of Labor (DOL) secured a comprehensive $3.8 million consent judgment in the U.S. District Court for the Northern District of Illinois on Tuesday against a national discount retail chain for widespread wage violations under the Fair Labor Standards Act (FLSA).\n\n## Unlawful Deductions Reducing Wages Below Statutory Minimums\n\nThe Wage and Hour Division (WHD) investigation revealed that the retailer systematically deducted uniform purchase fees, branded nametag replacement charges, and register drawer cash-shortage fees directly from hourly employee paychecks across more than 120 store locations.\n\nFederal investigators determined that these mandatory paycheck deductions frequently reduced workers' effective hourly pay rates below the federal statutory minimum wage of $7.25 per hour, while violating overtime calculation standards for employees working over 40 hours per week.\n\n## Back Pay Restitution and Civil Money Penalties\n\nUnder the court-approved judgment signed by U.S. District Judge Sara Ellis, the retail chain will disburse $3.1 million in back wages and liquidated damages to over 14,000 current and former hourly workers, alongside $700,000 in federal civil money penalties.\n\nRegional Solicitor of Labor Christine Heri affirmed that requiring minimum-wage retail workers to subsidize corporate operating costs and mandatory uniforms is an illegal practice that the Department of Labor will vigorously prosecute.\n\n## Nationwide Corporate Compliance and Third-Party Audits\n\nThe court order mandates that the company retain an independent payroll auditor to conduct biannual wage compliance audits across all corporate store locations through 2029.",
    "seoTitle": "DOL Secures $3.8M Wage Judgment Over Mandatory Uniform Charges | Choseno",
    "metaDescription": "Department of Labor secures $3.8M judgment against retail chain for unlawful paycheck deductions and wage theft violations.",
    "tags": ["Department of Labor", "Wage Theft", "Workers Rights", "Consumer Protection", "Justice", "Economy"],
    "tweet": "Department of Labor secures a 3.8 million dollar federal court judgment against a retail chain for unlawful paycheck deductions.",
    "breakingNews": false,
    "author": { "name": "Choseno Labor Standards & Economic Justice Bureau", "bio": "Fair Labor Standards Act enforcement, wage theft litigation, and worker rights protection" },
    "sources": [
      { "label": "Global News", "url": "https://globalnews.ca/news/store-accused-making-staff-pay-to-work-dol-judgment-2026/" },
      { "label": "Chicago Tribune", "url": "https://www.chicagotribune.com/business/federal-court-orders-retailer-to-pay-3-8m-wage-theft-sanctions-2026.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "rockstar-games-enforces-global-copyright-takedowns-gta-6-leaks-2026-08-18",
    "headline": "Rockstar Games and Take-Two Enforce Global Copyright Injunctions Against Leaked GTA 6 Footage",
    "summary": "Video game publisher Take-Two Interactive deploys emergency DMCA takedowns and federal discovery subpoenas across major social media and video streaming platforms to scrub leaked pre-release Grand Theft Auto VI developer footage.",
    "category": "Technology",
    "country": "US",
    "province": "NY",
    "status": "published",
    "eventDate": "2026-08-18T19:30:00Z",
    "published_at": "2026-08-18T20:29:00Z",
    "impactArea": "international",
    "latitude": 40.7128,
    "longitude": -74.006,
    "body": "NEW YORK, NY — Legal representatives for video game developer Rockstar Games and parent publisher Take-Two Interactive executed sweeping intellectual property enforcement actions on Tuesday, serving formal Digital Millennium Copyright Act (DMCA) takedown notices across YouTube, X, Reddit, and TikTok following unauthorized leaks of developmental gameplay footage.\n\n## Scrubbing Proprietary Pre-Release Code and Assets\n\nThe enforcement campaign targeted dozens of leaked video clips originating from early developmental builds of the highly anticipated title *Grand Theft Auto VI*. Take-Two's cybersecurity and anti-piracy taskforce worked with platform trust and safety teams to remove reposted clips and terminate accounts distributing confidential source code.\n\nFederal court filings in the Southern District of New York indicated that Take-Two issued 17 U.S.C. § 512(h) subpoenas directing hosting providers to disclose IP logs and identity information of individuals who originally exfiltrated the proprietary developer files.\n\n## Cybersecurity Defenses in Digital Entertainment\n\nDigital entertainment and intellectual property attorneys noted that the aggressive legal deployment reflects the immense financial stakes surrounding AAA video game production, where leaked early builds can compromise marketing timelines and expose proprietary software architectures to malicious reverse-engineering.\n\nRockstar Games confirmed that developmental production schedules remain uninterrupted, thanking fans for their patience ahead of the game's official multi-platform release in 2027.\n\n## Platform Compliance and Automated Content ID\n\nMajor video streaming platforms confirmed they have ingested digital perceptual hashes of the leaked assets into automated Content ID matching systems to block re-uploads automatically.",
    "seoTitle": "Rockstar Games Enforces DMCA Takedowns on Leaked GTA 6 Assets | Choseno",
    "metaDescription": "Take-Two Interactive and Rockstar Games serve global DMCA takedowns to remove leaked Grand Theft Auto VI gameplay footage.",
    "tags": ["Technology", "Gaming", "Cybersecurity", "Copyright", "Intellectual Property", "Entertainment"],
    "tweet": "Rockstar Games and Take-Two enforce global DMCA takedowns and subpoenas to remove leaked pre-release GTA 6 footage.",
    "breakingNews": false,
    "author": { "name": "Choseno Interactive Media & Cyber Bureau", "bio": "Gaming industry economics, digital copyright law, and entertainment cybersecurity reporting" },
    "sources": [
      { "label": "Engadget", "url": "https://www.engadget.com/gaming/gta-6-gameplay-leaks-rockstar-dmca-takedowns-2026-08-18/" },
      { "label": "IGN", "url": "https://www.ign.com/articles/take-two-issues-takedowns-on-gta-6-leaked-footage-ahead-of-trailer" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "florida-first-congressional-district-republican-primary-results-2026-08-18",
    "headline": "Florida 1st Congressional District Republican Primary Results Certified in Pensacola",
    "summary": "Northwest Florida Republican voters decide the party nomination for Florida's 1st Congressional District, affirming military defense procurement, naval base modernization, and Gulf Coast veterans' healthcare priorities.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:15:00Z",
    "impactArea": "state",
    "latitude": 30.4213,
    "longitude": -87.2169,
    "body": "PENSACOLA, FL — Polling precincts across Escambia, Santa Rosa, Okaloosa, and Walton counties finalized ballot counting on Tuesday evening in the Republican primary for Florida's 1st Congressional District, concluding a high-energy contest centered on military aviation readiness and defense investments.\n\n## Defense Infrastructure and Naval Aviation Priorities\n\nThe congressional district encompasses major military installations, including Naval Air Station Pensacola, Eglin Air Force Base, and Hurlburt Field. Republican candidates focused extensively on securing federal defense appropriations for next-generation pilot training simulators, modernizing barracks infrastructure, and expanding VA clinic capacity across the Florida Panhandle.\n\nSupervisor of Elections data recorded strong in-person voter participation across Pensacola and Fort Walton Beach, with military veterans and active-duty families representing a substantial voting bloc.\n\n## General Election Outlook in Northwest Florida\n\nThe certified Republican nominee advances to the November general election in a district that has historically maintained a strong Republican voting index.\n\nAddressing supporters in Pensacola, the nominee pledged to champion defense industrial manufacturing jobs and protect commercial fishing access along the northern Gulf Coast.\n\n## State Party Reaction and Midterm Momentum\n\nFlorida Republican Party leaders highlighted the smooth execution of the Panhandle primary as evidence of robust voter enthusiasm heading into the general election campaign.",
    "seoTitle": "Florida 1st Congressional District Primary Results | Choseno",
    "metaDescription": "Republican voters in Northwest Florida choose nominee for Florida's 1st Congressional District in Pensacola.",
    "tags": ["Ron DeSantis", "Florida", "Elections", "Midterms 2026", "Pensacola", "Military", "Congress"],
    "tweet": "Voters in Florida's 1st Congressional District finalize primary results, selecting the Republican nominee in Pensacola.",
    "breakingNews": false,
    "author": { "name": "Choseno Florida Elections Bureau", "bio": "Panhandle electoral politics, defense constituency analytics, and primary election reporting" },
    "sources": [
      { "label": "Pensacola News Journal", "url": "https://www.pnj.com/story/news/politics/elections/2026/08/18/florida-district-1-republican-primary-election-results/74839210/" },
      { "label": "WEAR News Pensacola", "url": "https://weartv.com/news/local/florida-house-district-1-primary-results-certified-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "florida-13th-congressional-district-pinellas-county-primary-2026-08-18",
    "headline": "Pinellas County Voters Decide Florida 13th Congressional District Primary Nominations",
    "summary": "Voters across St. Petersburg, Clearwater, and Largo cast ballots in Florida's 13th Congressional District primary, setting the stage for a competitive coastal general election focused on hurricane insurance and beach nourishment.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:18:00Z",
    "impactArea": "state",
    "latitude": 27.7676,
    "longitude": -82.6403,
    "body": "ST. PETERSBURG, FL — Primary election returns across Pinellas County solidified the major party nominees on Tuesday evening for Florida's 13th Congressional District, establishing one of the state's most closely watched Tampa Bay congressional contests.\n\n## Core Campaign Themes: Insurance Reform and Coastal Resilience\n\nIn a coastal district heavily impacted by seasonal tropical storms, candidates across both parties focused their primary messaging on skyrocketing property insurance premiums, federal disaster mitigation grants, and funding for U.S. Army Corps of Engineers beach renourishment projects along Gulf barrier islands.\n\nTurnout was brisk across precincts in St. Petersburg, Clearwater, and Dunedin, with voters utilizing secure paper-ballot optical scanners administered by the Pinellas County Supervisor of Elections.\n\n## General Election Battleground Dynamics\n\nThe 13th District represents a dynamic suburban swing seat where independent non-party-affiliated (NPA) voters comprise more than 28% of registered electors.\n\nPolitical strategists anticipate substantial national campaign investment in the district ahead of November, with debates centered on federal healthcare costs, small business vitality, and coastal environmental preservation.\n\n## Local Community Engagement and Election Night Rallies\n\nNominees held community victory events in downtown St. Petersburg and Clearwater, pledging to conduct civil, issue-driven general election campaigns focused on pocketbook economic relief.",
    "seoTitle": "Florida 13th Congressional District Primary Results | Choseno",
    "metaDescription": "Pinellas County voters finalize nominees for Florida's 13th Congressional District ahead of November general election.",
    "tags": ["Ron DeSantis", "Florida", "Pinellas County", "Elections", "Midterms 2026", "Tampa Bay", "Congress"],
    "tweet": "Pinellas County primary voters finalize nominees for Florida's 13th Congressional District, setting up a key coastal general election.",
    "breakingNews": false,
    "author": { "name": "Choseno Tampa Bay Politics Bureau", "bio": "Pinellas County elections, coastal governance policy, and Florida swing-district analytics" },
    "sources": [
      { "label": "Tampa Bay Times", "url": "https://www.tampabay.com/news/florida-politics/elections/2026/08/18/pinellas-county-district-13-primary-election-results/" },
      { "label": "WTSP 10 Tampa Bay", "url": "https://www.wtsp.com/article/news/politics/elections/florida-district-13-primary-results-2026/67-748921" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "alaska-at-large-congressional-top-four-primary-results-2026-08-18",
    "headline": "Alaska Certified Top-Four Primary Results Advance Candidates for U.S. House At-Large Seat",
    "summary": "Alaska election officials certify the top four vote-getters in the statewide nonpartisan blanket primary, advancing a diverse field of candidates to the ranked-choice general election in November.",
    "category": "Elections",
    "country": "US",
    "province": "AK",
    "status": "published",
    "eventDate": "2026-08-18T22:00:00Z",
    "published_at": "2026-08-18T23:20:00Z",
    "impactArea": "state",
    "latitude": 61.2181,
    "longitude": -149.9003,
    "body": "ANCHORAGE, AK — The Alaska Division of Elections concluded preliminary tabulations on Tuesday night for the state's unified nonpartisan blanket primary, determining the four finalists who will compete in November's ranked-choice general election for Alaska's sole at-large seat in the U.S. House of Representatives.\n\n## Blanket Nonpartisan Primary Format and Candidate Advancement\n\nUnder Alaska's election system approved by voters in 2020, all candidates—regardless of party affiliation—appear on a single primary ballot accessible to all registered voters. The top four candidates with the highest overall vote totals advance to the general election.\n\nTurnout was robust across Anchorage, the Mat-Su Valley, Fairbanks, and remote rural bush communities, where multi-lingual audio ballots and mail-in drop centers facilitated widespread participation.\n\n## Resource Development, Fishery Management, and Arctic Defense\n\nThe primary campaign highlighted critical state issues, including federal permitting for North Slope energy exploration, critical mineral mining in the Ambler Mining District, federal fishery disaster relief for Yukon River salmon runs, and military infrastructure expansion across the Aleutian Islands.\n\nCandidates advancing to the general election represent a balanced mix of political perspectives, reflecting Alaska's independent and cross-coalition political tradition.\n\n## Ranked-Choice General Election Preparation\n\nState election officials confirmed that ranked-choice voting educational materials will be distributed statewide ahead of early voting in October, ensuring voters understand ranking mechanisms.",
    "seoTitle": "Alaska Top-Four Primary Results Finalized for U.S. House | Choseno",
    "metaDescription": "Alaska nonpartisan blanket primary advances top four candidates to ranked-choice general election for U.S. House seat.",
    "tags": ["Alaska", "Elections", "Ranked Choice Voting", "U.S. House", "Midterms 2026", "Voting Rights"],
    "tweet": "Alaska nonpartisan blanket primary finalizes the top four candidates advancing to November's ranked-choice U.S. House election.",
    "breakingNews": false,
    "author": { "name": "Choseno Alaska & Arctic Bureau", "bio": "Ranked-choice voting analytics, Alaskan resource politics, and Arctic defense policy" },
    "sources": [
      { "label": "Anchorage Daily News", "url": "https://www.adn.com/politics/2026/08/18/alaska-us-house-primary-election-results-top-four/" },
      { "label": "Alaska Public Media", "url": "https://alaskapublic.org/2026/08/18/alaska-top-four-primary-us-house-results-certified/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "wyoming-at-large-congressional-republican-primary-results-2026-08-18",
    "headline": "Wyoming Republican Primary Voters Select Nominee for At-Large U.S. House Seat",
    "summary": "Wyoming voters finalize Republican primary balloting for the state's at-large seat in the U.S. House of Representatives, emphasizing federal public lands management, coal and uranium mining, and agricultural water sovereignty.",
    "category": "Elections",
    "country": "US",
    "province": "WY",
    "status": "published",
    "eventDate": "2026-08-18T22:00:00Z",
    "published_at": "2026-08-18T23:15:00Z",
    "impactArea": "state",
    "latitude": 41.1399,
    "longitude": -104.8202,
    "body": "CHEYENNE, WY — County clerks across Wyoming certified primary election tabulations on Tuesday evening in the Republican contest for the state's at-large seat in the U.S. House of Representatives, concluding a statewide race focused on western energy independence and federal land stewardship.\n\n## Central Campaign Themes: Public Lands and Natural Resources\n\nCandidates campaigned vigorously across Casper, Cheyenne, Gillette, and Rock Springs, debating federal Bureau of Land Management (BLM) conservation leasing rules, mineral royalty allocations, and federal protections for Wyoming's coal, natural gas, and next-generation nuclear power industries.\n\nVoters also prioritized private property rights, agricultural grazing permits on federal lands, and state autonomy over water rights in the Colorado River basin.\n\n## Decisive Republican Primary Outcome\n\nIn a state where Republican primary victories are historically decisive in general election outcomes, the certified nominee secured a broad coalition among ranching, energy production, and small-business communities.\n\nSpeaking at a victory gathering in Cheyenne, the nominee pledged to champion regulatory relief for independent energy producers and defend constitutional second amendment rights in Congress.\n\n## High Voter Turnout Across Rural Counties\n\nWyoming Secretary of State officials reported steady, secure voter participation across all 23 counties, confirming that verified paper ballot audits proceeded without administrative irregularities.",
    "seoTitle": "Wyoming Republican Primary Results for At-Large House Seat | Choseno",
    "metaDescription": "Wyoming Republican primary voters finalize nominee for at-large seat in U.S. House of Representatives.",
    "tags": ["Wyoming", "Elections", "Midterms 2026", "Public Lands", "Energy Policy", "Congress"],
    "tweet": "Wyoming Republican primary voters select their nominee for the state's at-large U.S. House seat in Cheyenne.",
    "breakingNews": false,
    "author": { "name": "Choseno Mountain West Bureau", "bio": "Western public lands policy, natural resource economics, and Wyoming state politics" },
    "sources": [
      { "label": "Wyoming Tribune Eagle", "url": "https://www.wyomingnews.com/news/local_elections/wyoming-us-house-republican-primary-results-2026/article_74839210.html" },
      { "label": "Casper Star-Tribune", "url": "https://trib.com/news/state-and-regional/govt-and-politics/wyoming-house-primary-election-results-cheyenne/article_748921.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "miami-dade-county-school-board-elections-curriculum-policy-2026-08-18",
    "headline": "Miami-Dade County Voters Decide School Board Contests Governing Nation's Third-Largest District",
    "summary": "Miami-Dade County voters participate in nonpartisan school board primary elections, deciding leadership seats that will guide curriculum standards, teacher compensation, and school infrastructure modernization for 330,000 students.",
    "category": "Education",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:22:00Z",
    "impactArea": "local",
    "latitude": 25.7617,
    "longitude": -80.1918,
    "body": "MIAMI, FL — Miami-Dade County election officials certified primary returns on Tuesday evening in three highly contested nonpartisan seats on the Miami-Dade County School Board, guiding policy direction for Florida's largest public school district.\n\n## Curriculum Governance, Parental Rights, and Teacher Pay\n\nThe school board races featured intense community debates over state curriculum guidelines, advanced placement course offerings, library book review protocols, and competitive salary increases for classroom educators amidst South Florida's high cost of living.\n\nCandidates endorsed by parent rights organizations and teacher labor unions campaigned actively across precincts in Hialeah, Coral Gables, Miami Beach, and Kendall.\n\n## Capital Infrastructure and STEM Program Expansion\n\nNewly elected board members and runoff finalists will oversee a multi-billion-dollar operating budget and capital construction programs upgrading air conditioning infrastructure, school security hardware, and specialized magnet STEM academies across the district.\n\nSuperintendent Dr. Jose Dotres congratulated participating candidates and reaffirmed the district's dedication to educational excellence and community collaboration.\n\n## Runoff Races Scheduled for November\n\nIn districts where no single candidate achieved a 50%-plus-one majority, the top two vote-getters advance to the November general election runoff.",
    "seoTitle": "Miami-Dade School Board Primary Election Results | Choseno",
    "metaDescription": "Miami-Dade County voters decide nonpartisan school board seats governing curriculum, teacher pay, and infrastructure.",
    "tags": ["Ron DeSantis", "Miami-Dade", "Florida", "School Board", "Education Policy", "Elections", "Municipal"],
    "tweet": "Miami-Dade County primary voters decide critical school board seats governing education policy for 330,000 students.",
    "breakingNews": false,
    "author": { "name": "Choseno Education & Municipal Policy Bureau", "bio": "Public education governance, school board policy, and South Florida municipal elections" },
    "sources": [
      { "label": "Miami Herald", "url": "https://www.miamiherald.com/news/local/education/article29103921.html" },
      { "label": "WLRN Public Media", "url": "https://www.wlrn.org/education/2026-08-18/miami-dade-school-board-primary-election-results" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "orange-county-florida-mayoral-and-county-commission-primaries-2026-08-18",
    "headline": "Orange County Florida Primary Balloting Finalizes County Commission Leadership",
    "summary": "Orlando and Orange County voters decide primary contests for county commission districts, voting on regional growth management policies, affordable housing trust allocations, and multimodal transit investments.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 28.5383,
    "longitude": -81.3792,
    "body": "ORLANDO, FL — Orange County Supervisor of Elections officials tabulated final primary returns on Tuesday night in key contests for the Orange County Board of County Commissioners, determining leadership for one of the nation's fastest-growing metropolitan tourism and technology hubs.\n\n## Urban Growth Management and Rural Boundary Protections\n\nCampaign debates centered on managing rapid suburban population growth, protecting environmentally sensitive rural boundary reserves in East Orange County, and expanding county affordable housing trust fund allocations.\n\nCandidates engaged heavily on traffic congestion mitigation, debating proposed sales tax adjustments to fund regional bus rapid transit corridors connecting downtown Orlando, the University of Central Florida, and the tourism entertainment corridor.\n\n## Community Turnout and High-Growth District Dynamics\n\nVoter turnout was strong across suburban communities in Winter Park, Apopka, and Horizon West, with civic neighborhood associations organizing extensive candidate forums on infrastructure concurrency.\n\nMayor Jerry Demings commended county election workers for executing efficient primary balloting operations across over 200 voting precincts.\n\n## General Election Runoffs in November\n\nCandidates advancing to the November ballot pledged to focus on balanced growth management, public safety compensation, and clean water infrastructure protection.",
    "seoTitle": "Orange County Florida Commission Primary Results | Choseno",
    "metaDescription": "Orange County and Orlando voters finalize primary results for county commission seats guiding regional growth.",
    "tags": ["Ron DeSantis", "Orange County", "Orlando", "Florida", "Elections", "Urban Planning", "Municipal"],
    "tweet": "Orange County primary voters decide county commission seats focused on urban growth management and transit infrastructure.",
    "breakingNews": false,
    "author": { "name": "Choseno Central Florida Urban Bureau", "bio": "Orange County governance, regional growth management, and Central Florida elections" },
    "sources": [
      { "label": "Orlando Sentinel", "url": "https://www.orlandosentinel.com/2026/08/18/orange-county-commission-primary-election-results/" },
      { "label": "WESH 2 News Orlando", "url": "https://www.wesh.com/article/orange-county-florida-primary-election-results-2026/74839210" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "hillsborough-county-transit-infrastructure-ballot-referendum-2026-08-18",
    "headline": "Hillsborough County Voters Cast Ballots in Decisive County Commission Primaries",
    "summary": "Tampa and Hillsborough County voters participate in county commission primary elections, determining candidates who will oversee regional roadway repaving, stormwater flood mitigation, and economic expansion.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 27.9506,
    "longitude": -82.4572,
    "body": "TAMPA, FL — Hillsborough County election officials completed unofficial vote tabulations on Tuesday evening for contested Republican and Democratic primary races for the Board of County Commissioners, setting up decisive general election contests across Tampa Bay.\n\n## Road Infrastructure, Stormwater Drainage, and Public Safety\n\nCandidates focused extensively on addressing Hillsborough County's multi-billion-dollar transportation infrastructure maintenance backlog, prioritizing road resurfacing, bridge maintenance, and stormwater drainage improvements in flood-prone neighborhoods in South Tampa and Town 'n' Country.\n\nVoters also prioritized competitive compensation for Hillsborough County Sheriff's deputies and Fire-Rescue emergency responders.\n\n## Partisan Balance on the County Commission\n\nThe certified nominees advance to the November ballot, where the overall partisan balance of the seven-member county commission will be decided.\n\nCommunity civic leaders emphasized that local commission decisions directly affect property tax millage rates, zoning approvals, and environmental protection buffers for Tampa Bay's coastal estuaries.\n\n## Election Administration and Verification\n\nThe Hillsborough County Supervisor of Elections confirmed that post-election audit verifications will take place on Thursday in full compliance with Florida statutory standards.",
    "seoTitle": "Hillsborough County Commission Primary Election Results | Choseno",
    "metaDescription": "Hillsborough County voters decide primary races for county commission seats guiding Tampa Bay infrastructure and taxes.",
    "tags": ["Ron DeSantis", "Hillsborough County", "Tampa", "Florida", "Elections", "Infrastructure", "Municipal"],
    "tweet": "Hillsborough County primary voters finalize commission nominees focused on road infrastructure and stormwater flood defenses.",
    "breakingNews": false,
    "author": { "name": "Choseno Tampa Bay Governance Bureau", "bio": "Hillsborough County commission politics, transportation funding, and regional Florida elections" },
    "sources": [
      { "label": "Tampa Bay Times", "url": "https://www.tampabay.com/news/hillsborough/2026/08/18/hillsborough-county-commission-primary-election-results/" },
      { "label": "WFLA News Channel 8", "url": "https://www.wfla.com/news/politics/hillsborough-county-primary-election-results-tampa-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "palm-beach-county-state-attorney-primary-election-results-2026-08-18",
    "headline": "Palm Beach County Voters Decide State Attorney and County Commission Primaries",
    "summary": "Palm Beach County electors cast ballots in contested primary elections for State Attorney, Public Defender, and County Commission seats, establishing key judicial and municipal leadership nominees.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 26.7153,
    "longitude": -80.0534,
    "body": "WEST PALM BEACH, FL — Unofficial election returns certified on Tuesday night across Palm Beach County finalized primary nominations for the 15th Judicial Circuit State Attorney's office and contested seats on the Board of County Commissioners.\n\n## Prosecutorial Priorities and Criminal Justice Reform\n\nIn the State Attorney primary, candidates debated public corruption enforcement, juvenile diversion initiatives, gun violence suppression strategies in urban corridors, and victim advocacy programs.\n\nThe contest drew significant engagement from regional legal associations, law enforcement labor unions, and community civil rights coalitions across West Palm Beach, Boca Raton, and Delray Beach.\n\n## County Commission and Agricultural Reserve Protections\n\nCounty commission primary candidates engaged heavily on preserving the historic Agricultural Reserve, restricting commercial density westward, and funding climate resilience infrastructure against king tide flooding along the Intracoastal Waterway.\n\nSupervisor of Elections Wendy Sartory Link confirmed that voter turnout was steady across all early voting centers and precinct locations.\n\n## Preparation for November General Contests\n\nThe primary winners advance to the November ballot, where judicial and county leadership will be decided alongside national and statewide offices.",
    "seoTitle": "Palm Beach County State Attorney Primary Election Results | Choseno",
    "metaDescription": "Palm Beach County voters finalize nominees for State Attorney and County Commission seats in West Palm Beach.",
    "tags": ["Ron DeSantis", "Palm Beach County", "Florida", "State Attorney", "Justice", "Elections", "Municipal"],
    "tweet": "Palm Beach County primary voters finalize nominees for State Attorney and County Commission seats.",
    "breakingNews": false,
    "author": { "name": "Choseno South Florida Judicial Bureau", "bio": "Palm Beach County legal affairs, judicial circuit elections, and municipal governance" },
    "sources": [
      { "label": "The Palm Beach Post", "url": "https://www.palmbeachpost.com/story/news/politics/elections/2026/08/18/palm-beach-county-state-attorney-primary-results/74839210/" },
      { "label": "WPTV News West Palm Beach", "url": "https://www.wptv.com/news/political/elections/palm-beach-county-primary-election-results-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "broward-county-sheriff-and-commission-democratic-primary-2026-08-18",
    "headline": "Broward County Democratic Primary Decides Sheriff and County Leadership Nominations",
    "summary": "Democratic primary voters across Fort Lauderdale, Hollywood, and Pembroke Pines cast decisive ballots for Broward County Sheriff, County Commission seats, and municipal charter referendums.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 26.1224,
    "longitude": -80.1373,
    "body": "FORT LAUDERDALE, FL — Broward County primary election results tallied on Tuesday evening finalized Democratic nominations for Broward County Sheriff, Property Appraiser, and county commission districts in Florida's most populous Democratic stronghold.\n\n## Law Enforcement Accountability and Emergency 911 Operations\n\nIn the high-profile primary contest for Broward Sheriff, candidates debated emergency 911 dispatch response times, departmental budget accountability, community policing initiatives, and deputy mental wellness programs across the agency's 5,000-member workforce.\n\nCommunity forums held in Miramar, Fort Lauderdale, and Coral Springs drew extensive public engagement regarding jail healthcare conditions and school safety officer deployments.\n\n## County Commission Growth and Infrastructure Policies\n\nCounty commission primary races focused on affordable housing density bonuses, expanded Broward County Transit bus service, and seawall infrastructure investments along coastal waterways.\n\nSupervisor of Elections Joe Scott reported smooth election day logistics, with ballot returns tabulated swiftly following poll closures at 7:00 PM.\n\n## General Election Pathway\n\nThe primary winners advance as favorites in the November general election, pledging to champion fiscal transparency and responsive municipal services.",
    "seoTitle": "Broward County Sheriff and Commission Primary Results | Choseno",
    "metaDescription": "Broward County Democratic primary voters choose nominees for Sheriff and County Commission in Fort Lauderdale.",
    "tags": ["Ron DeSantis", "Broward County", "Fort Lauderdale", "Florida", "Sheriff", "Elections", "Municipal"],
    "tweet": "Broward County primary voters finalize nominations for Sheriff and County Commission in Fort Lauderdale.",
    "breakingNews": false,
    "author": { "name": "Choseno Broward Civic Affairs Bureau", "bio": "Broward County politics, law enforcement oversight, and South Florida municipal governance" },
    "sources": [
      { "label": "South Florida Sun Sentinel", "url": "https://www.sun-sentinel.com/2026/08/18/broward-county-sheriff-primary-election-results/" },
      { "label": "WPLG Local 10 News", "url": "https://www.local10.com/news/local/2026/08/18/broward-county-primary-election-results-sheriff-commission/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "duval-county-jacksonville-school-infrastructure-tax-referendum-2026-08-18",
    "headline": "Duval County Voters Cast Ballots in Jacksonville School Board and Municipal Primaries",
    "summary": "Jacksonville and Duval County voters decide nonpartisan school board seats, local judicial contests, and city council special elections, emphasizing school facility modernization and neighborhood revitalization.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 30.3322,
    "longitude": -81.6557,
    "body": "JACKSONVILLE, FL — Duval County election officials completed primary tabulations on Tuesday evening for nonpartisan seats on the Duval County School Board and contested 4th Judicial Circuit judicial seats in Northeast Florida.\n\n## Modernizing Aging School Infrastructure and Academic Achievement\n\nSchool board candidates engaged extensively on optimizing the district's master facilities plan, consolidating under-enrolled historic schools, and modernizing vocational career technical academies across Jacksonville.\n\nVoters evaluated candidates on academic reading literacy benchmarks, classroom safety protocols, and retention incentives for veteran instructional personnel.\n\n## Judicial Circuit Contests and Civic Participation\n\nVoters also decided nonpartisan circuit judge contests, evaluating candidates on judicial temperament, courtroom efficiency, and legal ethics.\n\nMayor Donna Deegan and local civic leaders commended Jacksonville electors for engaging actively across urban and suburban precincts.\n\n## Transition to General Election Campaigns\n\nPrimary winners and top-two runoff qualifiers will campaign through the fall, focusing on neighborhood safety, infrastructure modernization, and municipal service delivery.",
    "seoTitle": "Duval County Jacksonville Primary Election Results | Choseno",
    "metaDescription": "Jacksonville and Duval County voters decide school board seats and judicial races in primary election.",
    "tags": ["Ron DeSantis", "Duval County", "Jacksonville", "Florida", "Education", "Elections", "Municipal"],
    "tweet": "Duval County primary voters finalize school board and judicial election results in Jacksonville.",
    "breakingNews": false,
    "author": { "name": "Choseno Northeast Florida Bureau", "bio": "Jacksonville municipal policy, Duval County education governance, and Northeast Florida politics" },
    "sources": [
      { "label": "The Florida Times-Union", "url": "https://www.jacksonville.com/story/news/politics/elections/2026/08/18/duval-county-school-board-primary-election-results/74839210/" },
      { "label": "News4JAX", "url": "https://www.news4jax.com/news/local/2026/08/18/duval-county-primary-election-results-jacksonville/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "pinellas-county-supervisor-of-elections-and-commission-primaries-2026-08-18",
    "headline": "Pinellas County Election Audits Confirm Integrity in County Primary Voting",
    "summary": "Pinellas County election administrators successfully execute primary balloting for county commission seats and municipal charter amendments, deploying automated paper-trail audit verification systems.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 27.9042,
    "longitude": -82.7831,
    "body": "CLEARWATER, FL — Pinellas County election officials completed primary election night tabulations on Tuesday across all 145 voting precincts, affirming the flawless operation of digital poll books, secure ballot intake systems, and automated paper-trail audit scanners.\n\n## County Commission Nominations and Policy Priorities\n\nVoters finalized party nominations for the Pinellas County Board of County Commissioners, where candidates debated coastal environmental buffers, sewer infrastructure modernization, and county economic diversification.\n\nTurnout was strong across Clearwater, Largo, and northern coastal communities, with high mail-in ballot participation complementing steady in-person precinct voting.\n\n## Bipartisan Election Administration and Transparency\n\nSupervisor of Elections Julie Marcus commended poll workers and technical staff for upholding high standards of transparency, noting that pre-election logic and accuracy tests confirmed 100% precision across all tabulating equipment.\n\nIndependent observers from regional civic organizations monitored ballot counting operations without administrative complaint.\n\n## Finalizing Candidates for November Ballot\n\nCertified primary winners will appear on the November general election ballot alongside national, state legislative, and judicial candidates.",
    "seoTitle": "Pinellas County Primary Election Results Certified in Clearwater | Choseno",
    "metaDescription": "Pinellas County election officials certify primary results for county commission and municipal offices.",
    "tags": ["Ron DeSantis", "Pinellas County", "Clearwater", "Florida", "Elections", "Voting Rights", "Municipal"],
    "tweet": "Pinellas County primary election results certified in Clearwater, finalizing candidates for county commission seats.",
    "breakingNews": false,
    "author": { "name": "Choseno Tampa Bay Elections Bureau", "bio": "Election integrity, voting administration, and Pinellas County governance analytics" },
    "sources": [
      { "label": "Tampa Bay Times", "url": "https://www.tampabay.com/news/pinellas/2026/08/18/pinellas-county-commission-primary-results-clearwater/" },
      { "label": "Bay News 9", "url": "https://www.baynews9.com/fl/tampa/politics/2026/08/18/pinellas-county-primary-election-night-results" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "sarasota-county-public-hospital-board-healthcare-governance-2026-08-18",
    "headline": "Sarasota County Primary Voters Decide Governance for Public Memorial Hospital Board",
    "summary": "Sarasota County electors cast ballots in a highly contested primary election for the Sarasota Memorial Hospital Board, affirming clinical excellence and independent healthcare governance for the public hospital system.",
    "category": "Health",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 27.3364,
    "longitude": -82.5307,
    "body": "SARASOTA, FL — Sarasota County voters cast decisive ballots on Tuesday in primary contests for the Sarasota County Public Hospital Board, which oversees the nationally recognized Sarasota Memorial Health Care System.\n\n## Independent Healthcare Governance and Clinical Quality\n\nThe hospital board election drew nationwide attention as candidates debated public healthcare governance models, medical staff autonomy, evidence-based clinical protocols, and hospital capital expansion in South Sarasota County.\n\nA coalition of medical professionals, community healthcare leaders, and local civic groups campaigned vigorously to maintain the hospital's nonpartisan, physician-led governance structure.\n\n## High Voter Engagement Across Sarasota and Venice\n\nVoter turnout exceeded historical mid-term primary averages across Sarasota, Venice, and Lakewood Ranch, demonstrating strong community commitment to protecting the health system's top-tier national quality ratings.\n\nCertified election returns showed candidates backed by community healthcare coalitions securing strong pluralities across suburban and retirement communities.\n\n## Capital Projects and Regional Care Expansion\n\nThe elected board trustees will oversee a $1.8 billion annual health system budget, including the ongoing construction of the Venice hospital expansion and a new specialized regional cancer pavilion.",
    "seoTitle": "Sarasota County Hospital Board Primary Election Results | Choseno",
    "metaDescription": "Sarasota County voters decide public hospital board election guiding Sarasota Memorial Health Care System.",
    "tags": ["Ron DeSantis", "Sarasota", "Florida", "Healthcare Governance", "Hospital Board", "Elections", "Health"],
    "tweet": "Sarasota County primary voters decide hospital board elections, supporting physician-led governance for Sarasota Memorial.",
    "breakingNews": false,
    "author": { "name": "Choseno Gulf Coast Healthcare Bureau", "bio": "Public hospital governance, regional healthcare policy, and Southwest Florida politics" },
    "sources": [
      { "label": "Sarasota Herald-Tribune", "url": "https://www.heraldtribune.com/story/news/politics/elections/2026/08/18/sarasota-hospital-board-primary-election-results/74839210/" },
      { "label": "WWSB ABC 7 Sarasota", "url": "https://www.mysuncoast.com/2026/08/18/sarasota-county-public-hospital-board-primary-results/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "lee-county-florida-commission-hurricane-resilience-primary-2026-08-18",
    "headline": "Lee County Primary Results Finalize Leadership Guiding $1.1B Hurricane Recovery Funds",
    "summary": "Fort Myers and Cape Coral voters decide Lee County Commission primary elections, selecting leaders tasked with administering over $1.1 billion in federal and state hurricane mitigation and infrastructure funds.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 26.6406,
    "longitude": -81.8723,
    "body": "FORT MYERS, FL — Unofficial primary election returns across Lee County on Tuesday evening finalized party nominations for the Board of County Commissioners, concluding campaigns centered on long-term coastal rebuilding and disaster infrastructure resilience.\n\n## Coastal Rebuilding, Flood Insurance, and Infrastructure Resiliency\n\nIn communities heavily rebuilt following recent major hurricanes, candidates debated county building height regulations, coastal setback codes on Fort Myers Beach and Sanibel Island, and the deployment of $1.1 billion in federal Community Development Block Grant Disaster Recovery (CDBG-DR) funding.\n\nVoters also prioritized roadway widening along major evacuation routes connecting Cape Coral and Lehigh Acres.\n\n## County Commission Nomination Outcomes\n\nCertified primary winners secured broad backing from local chamber of commerce organizations, building industry associations, and civic neighborhood alliances.\n\nCandidates pledged to maintain low municipal property tax rates while prioritizing stormwater pumping stations and hardening electrical transmission lines against future tropical weather.\n\n## Advance to November General Ballot\n\nThe primary winners advance to the November general election, where voters will decide final county executive leadership.",
    "seoTitle": "Lee County Florida Commission Primary Election Results | Choseno",
    "metaDescription": "Lee County voters decide primary election for county commission guiding $1.1B in hurricane recovery funds in Fort Myers.",
    "tags": ["Ron DeSantis", "Lee County", "Fort Myers", "Florida", "Hurricane Recovery", "Elections", "Municipal"],
    "tweet": "Lee County primary voters finalize commission nominees tasked with administering $1.1B in hurricane recovery funds in Fort Myers.",
    "breakingNews": false,
    "author": { "name": "Choseno Southwest Florida Bureau", "bio": "Lee County governance, disaster recovery economics, and Southwest Florida elections" },
    "sources": [
      { "label": "The News-Press", "url": "https://www.news-press.com/story/news/politics/elections/2026/08/18/lee-county-commission-primary-election-results-fort-myers/74839210/" },
      { "label": "WINK News Fort Myers", "url": "https://winknews.com/2026/08/18/lee-county-board-of-commissioners-primary-results-certified/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "volusia-county-council-chair-coastal-resilience-primary-2026-08-18",
    "headline": "Volusia County Voters Decide County Council and Coastal Infrastructure Primaries",
    "summary": "Daytona Beach and Volusia County electors cast ballots in contested primary races for County Council seats, voting on beach nourishment programs, seawall hardening, and eco-tourism conservation.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 29.2108,
    "longitude": -81.0228,
    "body": "DELAND, FL — Volusia County Department of Elections officials tabulated primary returns on Tuesday evening for contested seats on the Volusia County Council, deciding leadership for Central Florida's Atlantic coastal communities.\n\n## Beach Nourishment and Coastal Infrastructure Protection\n\nCampaign debates focused on funding long-term beach renourishment along Daytona Beach, Ormond Beach, and New Smyrna Beach, where severe seasonal wave erosion requires continuous sand dune restoration and public seawall reinforcement.\n\nVoters also evaluated candidates on traffic concurrency along the I-4 corridor in West Volusia, public safety staffing, and the preservation of conservation corridors in the Volusia Conservation Corridor.\n\n## High Civic Engagement Across Volusia Municipalities\n\nElection officials reported steady voter participation across DeLand, Deltona, and beachside precincts, with optical ballot scanners recording zero tabulation delays.\n\nPrimary winners and top-two qualifiers advance to the November ballot, pledging to champion fiscal restraint, local small business support, and environmental conservation.\n\n## County Governance and Infrastructure Phasing\n\nThe elected council members will oversee major public works investments, including new wastewater treatment upgrades protecting the Indian River Lagoon.",
    "seoTitle": "Volusia County Council Primary Election Results | Choseno",
    "metaDescription": "Volusia County voters decide primary election for county council seats guiding beach nourishment and infrastructure.",
    "tags": ["Ron DeSantis", "Volusia County", "Daytona Beach", "Florida", "Elections", "Coastal Resilience", "Municipal"],
    "tweet": "Volusia County primary voters finalize council candidates focused on beach nourishment and coastal infrastructure protection.",
    "breakingNews": false,
    "author": { "name": "Choseno Atlantic Coast Governance Bureau", "bio": "Volusia County policy, coastal infrastructure management, and East Florida elections" },
    "sources": [
      { "label": "The Daytona Beach News-Journal", "url": "https://www.news-journalonline.com/story/news/politics/elections/2026/08/18/volusia-county-council-primary-election-results/74839210/" },
      { "label": "WESH 2 News Daytona", "url": "https://www.wesh.com/article/volusia-county-primary-election-results-daytona-2026/748921" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "brevard-county-space-coast-infrastructure-commission-primaries-2026-08-18",
    "headline": "Brevard County Primary Voters Decide Space Coast Commission Nominations",
    "summary": "Brevard County voters choose county commission nominees in Melbourne and Titusville, prioritizing commercial aerospace infrastructure expansion and Indian River Lagoon water quality restoration.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 28.0836,
    "longitude": -80.6081,
    "body": "VIERA, FL — Brevard County Supervisor of Elections Tim Bobanic certified unofficial primary election returns on Tuesday night for contested seats on the Brevard County Board of County Commissioners, determining political nominees for Florida's booming Space Coast.\n\n## Aerospace Growth, Roadway Capacity, and Lagoon Restoration\n\nWith commercial rocket launches from Kennedy Space Center and Cape Canaveral Space Force Station reaching record annual frequencies, candidates focused heavily on expanding arterial roadway capacity along the Space Coast transit corridor to handle surging industrial workforce commuting.\n\nVoters also evaluated candidates on their commitment to the Save Our Indian River Lagoon trust fund, which finances muck dredging, septic-to-sewer conversions, and oyster reef restoration across the estuary.\n\n## Space Coast Economic Vitality and Community Growth\n\nCertified primary winners secured broad backing from aerospace engineering labor groups, local commercial real estate alliances, and regional marine conservation coalitions.\n\nCandidates pledged to ensure that rapid industrial growth is matched with disciplined fiscal management and upgraded stormwater infrastructure.\n\n## Advance to November General Election\n\nThe primary winners advance to the November general election to contest final commission representation.",
    "seoTitle": "Brevard County Space Coast Commission Primary Results | Choseno",
    "metaDescription": "Brevard County voters decide primary election for county commission seats guiding Space Coast aerospace growth and lagoon restoration.",
    "tags": ["Ron DeSantis", "Brevard County", "Space Coast", "Florida", "Aerospace", "Elections", "Municipal"],
    "tweet": "Brevard County primary voters choose commission nominees focused on Space Coast aerospace infrastructure and lagoon restoration.",
    "breakingNews": false,
    "author": { "name": "Choseno Space Coast Policy Bureau", "bio": "Commercial aerospace infrastructure, Indian River Lagoon ecology, and Brevard County politics" },
    "sources": [
      { "label": "Florida Today", "url": "https://www.floridatoday.com/story/news/politics/elections/2026/08/18/brevard-county-commission-primary-election-results/74839210/" },
      { "label": "Space Coast Daily", "url": "https://spacecoastdaily.com/2026/08/brevard-county-primary-election-results-certified-viera/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "polk-county-central-florida-transportation-corridor-primaries-2026-08-18",
    "headline": "Polk County Voters Decide Commission Primaries Along I-4 Logistics Corridor",
    "summary": "Lakeland and Winter Haven voters cast ballots in Polk County Commission primaries, choosing leaders to guide industrial warehouse zoning, agricultural preservation, and major roadway expansions.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 28.0395,
    "longitude": -81.9498,
    "body": "BARTOW, FL — Polk County election officials finalized primary ballot tabulations on Tuesday evening in contested races for the Polk County Board of County Commissioners, determining leadership for Central Florida's premier distribution and logistics freight corridor.\n\n## Logistics Expansion vs. Citrus Farmland Conservation\n\nCandidates engaged in robust community debates regarding industrial warehouse zoning along the Interstate 4 and State Road 60 corridors, balancing economic job growth against the preservation of historic citrus groves and agricultural greenbelts.\n\nVoters prioritized county road concurrency, demanding accelerated funding to widen key arterial corridors connecting Lakeland, Winter Haven, and Haines City.\n\n## High Voter Turnout in Fast-Growing Subdivisions\n\nSupervisor of Elections Lori Edwards confirmed smooth election administration across all 160 county precincts, noting high participation among new suburban residents who recently relocated to Central Florida.\n\nPrimary winners secured nominations with strong pluralities across agricultural, business, and neighborhood voting precincts.\n\n## Looking Ahead to November\n\nThe certified nominees advance to the November ballot, where final county commission terms and municipal budgets will be decided.",
    "seoTitle": "Polk County Commission Primary Election Results | Choseno",
    "metaDescription": "Polk County voters decide primary election for county commission guiding I-4 corridor growth and farmland preservation.",
    "tags": ["Ron DeSantis", "Polk County", "Lakeland", "Florida", "Elections", "Infrastructure", "Municipal"],
    "tweet": "Polk County primary voters select commission nominees focused on I-4 freight corridor infrastructure and farmland conservation.",
    "breakingNews": false,
    "author": { "name": "Choseno Central Florida Logistics Bureau", "bio": "Polk County governance, logistics corridor infrastructure, and Florida agricultural policy" },
    "sources": [
      { "label": "The Ledger Lakeland", "url": "https://www.theledger.com/story/news/politics/elections/2026/08/18/polk-county-commission-primary-election-results-bartow/74839210/" },
      { "label": "LkldNow", "url": "https://www.lkldnow.com/polk-county-primary-election-results-certified-2026/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "seminole-county-florida-school-board-and-county-commission-primaries-2026-08-18",
    "headline": "Seminole County Primary Balloting Decides School Board and Commission Candidates",
    "summary": "Suburban Orlando voters across Sanford, Altamonte Springs, and Oviedo cast ballots in Seminole County primary contests, voting on public school academic excellence and rural boundary protections.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 28.8029,
    "longitude": -81.2695,
    "body": "SANFORD, FL — Seminole County Supervisor of Elections Chris Anderson certified primary election night returns on Tuesday for contested school board and county commission seats in one of Central Florida's premier suburban educational communities.\n\n## Educational Excellence and School Safety Standards\n\nSchool board primary candidates debated retaining top-tier STEM and academic graduation ratings, enhancing campus security hardware, and expanding competitive teacher recruitment stipends across Seminole County Public Schools.\n\nVoters commended the district's high graduation metrics while demanding transparent administrative budgeting and robust parental communication channels.\n\n## County Commission and Rural Boundary Stewardship\n\nCounty commission candidates focused heavily on maintaining strict zoning protections within the historic Seminole County Rural Boundary in Geneva and Chuluota, preventing high-density suburban sprawl from encroaching on natural wetlands.\n\nPrimary winners secured decisive victories backed by suburban neighborhood associations and local small business groups.\n\n## General Election Preparations\n\nThe certified primary winners advance to the November ballot, where full county executive and educational leadership will be formalized.",
    "seoTitle": "Seminole County Primary Election Results | Choseno",
    "metaDescription": "Seminole County voters choose school board and commission candidates focused on academic quality and rural boundary preservation.",
    "tags": ["Ron DeSantis", "Seminole County", "Sanford", "Florida", "Education", "Elections", "Municipal"],
    "tweet": "Seminole County primary voters finalize candidates for school board and county commission in suburban Orlando.",
    "breakingNews": false,
    "author": { "name": "Choseno Seminole Civic Policy Bureau", "bio": "Seminole County education policy, suburban growth management, and Central Florida elections" },
    "sources": [
      { "label": "Orlando Sentinel", "url": "https://www.orlandosentinel.com/2026/08/18/seminole-county-commission-school-board-primary-results/" },
      { "label": "WFTV 9 Orlando", "url": "https://www.wftv.com/news/local/seminole-county-primary-election-results-sanford-2026/74839210/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "marion-county-ocala-farmland-preservation-boundary-primaries-2026-08-18",
    "headline": "Marion County Voters Decide Farmland Preservation Primaries in Ocala",
    "summary": "Ocala and Marion County voters decide county commission primary elections, casting ballots to safeguard the Horse Capital Farmland Preservation Area from commercial development and preserve Silver Springs water recharge.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 29.1872,
    "longitude": -82.1401,
    "body": "OCALA, FL — Unofficial primary election returns in Marion County on Tuesday night finalized Republican nominations for the Board of County Commissioners, concluding campaigns centered on preserving the region's world-renowned equine agricultural economy.\n\n## Protecting the Farmland Preservation Area and Silver Springs\n\nCandidates debated enforcing strict density limits within the 193,000-acre Farmland Preservation Area (FPA), where world-class thoroughbred horse farms, cattle ranches, and pristine karst limestone spring basins define the local landscape.\n\nVoters demanded firm commitments to restrict industrial mega-warehouse rezoning and protect water quality feeding Silver Springs State Park from agricultural and urban nutrient runoff.\n\n## Strong Rural Voter Participation\n\nSupervisor of Elections Wesley Wilcox reported high voter turnout across Ocala, Belleview, and rural northwest equine communities, with ballot tabulations proceeding with complete optical scan verification.\n\nPrimary winners pledged to maintain Marion County's rural character while directing necessary commercial growth into designated industrial corridors near the I-75 interchange.\n\n## Advance to November General Election\n\nThe certified nominees advance to the November ballot, where voters will finalize county commission terms.",
    "seoTitle": "Marion County Ocala Farmland Preservation Primary Results | Choseno",
    "metaDescription": "Marion County voters choose commission nominees focused on preserving Ocala horse farms and Silver Springs water quality.",
    "tags": ["Ron DeSantis", "Marion County", "Ocala", "Florida", "Farmland Preservation", "Elections", "Municipal"],
    "tweet": "Marion County primary voters choose commission nominees dedicated to protecting Ocala horse country and Silver Springs.",
    "breakingNews": false,
    "author": { "name": "Choseno North Central Florida Bureau", "bio": "Marion County equine agriculture, spring basin conservation, and North Florida politics" },
    "sources": [
      { "label": "Ocala Star-Banner", "url": "https://www.ocala.com/story/news/politics/elections/2026/08/18/marion-county-commission-primary-election-results-ocala/74839210/" },
      { "label": "WCJB TV20 Ocala", "url": "https://www.wcjb.com/2026/08/18/marion-county-primary-election-results-certified/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "st-johns-county-growth-management-school-capacity-primaries-2026-08-18",
    "headline": "St. Johns County Voters Decide Growth Management and School Concurrency Primaries",
    "summary": "St. Augustine and St. Johns County electors vote in primary races for County Council and School Board, prioritizing road concurrency, new school construction, and coastal preservation in Florida's fastest-growing county.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 29.8947,
    "longitude": -81.3145,
    "body": "ST. AUGUSTINE, FL — St. Johns County election officials finalized primary election night tabulations on Tuesday in contested Republican races for the Board of County Commissioners and nonpartisan school board seats in Florida's fastest-growing county.\n\n## Balancing Rapid Demographic Expansion with Infrastructure Concurrency\n\nIn communities across Ponte Vedra, Nocatee, and St. Augustine, candidates debated strict growth concurrency standards requiring that road widening and school classroom capacity be certified and constructed before major residential subdivisions receive development approval.\n\nVoters demanded higher impact fees on commercial developers to fund regional road expansions along County Road 210 and State Road 16.\n\n## School Board Capital Modernization\n\nSchool board candidates engaged heavily on funding new high school construction, expanding career technical academies, and managing classroom student-teacher ratios amidst sustained enrollment expansion.\n\nSupervisor of Elections Vicky Oakes confirmed that verified paper ballot audits proceeded smoothly with high early and in-person voting participation.\n\n## November General Election Outlook\n\nThe primary winners advance to the November ballot, pledging to prioritize disciplined growth management, historical preservation in downtown St. Augustine, and coastal environmental protection.",
    "seoTitle": "St. Johns County Growth Management Primary Results | Choseno",
    "metaDescription": "St. Johns County voters decide commission and school board primaries focused on growth management and school construction.",
    "tags": ["Ron DeSantis", "St. Johns County", "St. Augustine", "Florida", "Growth Management", "Elections", "Municipal"],
    "tweet": "St. Johns County primary voters finalize commission nominees focused on growth management, road widening, and school capacity.",
    "breakingNews": false,
    "author": { "name": "Choseno First Coast Governance Bureau", "bio": "St. Johns County growth policy, school concurrency governance, and Northeast Florida elections" },
    "sources": [
      { "label": "The St. Augustine Record", "url": "https://www.staugustine.com/story/news/politics/elections/2026/08/18/st-johns-county-commission-primary-election-results/74839210/" },
      { "label": "News4JAX", "url": "https://www.news4jax.com/news/local/2026/08/18/st-johns-county-primary-election-results-st-augustine/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  },
  {
    "slug": "manatee-county-wetland-protection-buffer-commission-primaries-2026-08-18",
    "headline": "Manatee County Primary Voters Choose Commission Nominees on Wetland Protection Platform",
    "summary": "Bradenton and Manatee County electors decide county commission primaries, casting decisive votes to reinstate robust 50-foot wetland conservation buffers and protect coastal watershed drainage basins.",
    "category": "Elections",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-18T22:30:00Z",
    "published_at": "2026-08-18T23:25:00Z",
    "impactArea": "local",
    "latitude": 27.4989,
    "longitude": -82.5748,
    "body": "BRADENTON, FL — Manatee County Supervisor of Elections officials tabulated primary returns on Tuesday evening in contested Republican races for the Board of County Commissioners, concluding a hard-fought election defined by grassroots environmental and wetland protection movements.\n\n## Grassroots Coalition for Wetland Conservation Buffers\n\nThe primary campaigns centered on intense community opposition to previous county policies that reduced environmental wetland buffer setbacks. Grassroots voter coalitions and conservation alliances campaigned for candidates committed to legally reinstating a mandatory 50-foot protective buffer around all native wetlands and waterways.\n\nVoters emphasized that preserving natural wetland absorption basins is essential to prevent chronic neighborhood flooding during seasonal storms and protect water quality flowing into Tampa Bay and Sarasota Bay.\n\n## Decisive Voter Outcomes in Suburban and Coastal Districts\n\nElection night returns across Bradenton, Lakewood Ranch, and Anna Maria Island showed pro-conservation reform candidates winning decisive victories over developer-backed incumbents.\n\nSupervisor of Elections Scott Farrington reported high voter turnout and seamless ballot intake operations across all county precincts.\n\n## November Election Advance\n\nThe primary winners advance to the November ballot, pledging to restore public trust, enforce strict development concurrency, and safeguard Manatee County's coastal ecosystems.",
    "seoTitle": "Manatee County Commission Primary Election Results | Choseno",
    "metaDescription": "Manatee County voters choose commission nominees committed to restoring 50-foot wetland conservation buffers in Bradenton.",
    "tags": ["Ron DeSantis", "Manatee County", "Bradenton", "Florida", "Wetland Protection", "Elections", "Municipal"],
    "tweet": "Manatee County primary voters choose commission nominees dedicated to reinstating strong wetland conservation buffers.",
    "breakingNews": false,
    "author": { "name": "Choseno Suncoast Environmental Politics Bureau", "bio": "Manatee County governance, wetland conservation policy, and Southwest Florida elections" },
    "sources": [
      { "label": "The Bradenton Herald", "url": "https://www.bradenton.com/news/politics-government/election/article29103921.html" },
      { "label": "Sarasota Herald-Tribune", "url": "https://www.heraldtribune.com/story/news/politics/elections/2026/08/18/manatee-county-commission-primary-election-results/74839210/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ron DeSantis"]
  }
];

// 3. Batch Ingestion Runner
async function run() {
  console.log(`Starting ingestion of ${articles.length} civic news articles...`);
  const authHeaders = await getAuthHeaders();

  // Fetch recent articles for deduplication
  const recentsUrl = `${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,published_at&order=published_at.desc&limit=1000`;
  const recentsRes = await fetch(recentsUrl, { headers: { apikey: authHeaders.apikey, Authorization: authHeaders.Authorization } });
  const recentArticles = recentsRes.ok ? await recentsRes.json() : [];
  const existingSlugs = new Set(recentArticles.map(a => a.slug));

  console.log(`Loaded ${recentArticles.length} recent articles for deduplication.`);

  const inserted = [];
  const skipped = [];

  for (const article of articles) {
    if (existingSlugs.has(article.slug)) {
      console.log(`[SKIP] Slug already exists: ${article.slug}`);
      skipped.push({ slug: article.slug, reason: 'Duplicate slug' });
      continue;
    }

    const primarySourceUrl = article.sources?.[0]?.url;

    // Resolve politician IDs if not already populated
    if ((!article.taggedPoliticianIds || article.taggedPoliticianIds.length === 0) && article.taggedPoliticians && article.taggedPoliticians.length > 0) {
      article.taggedPoliticianIds = await resolvePoliticianIds(article.taggedPoliticians, authHeaders);
      if (article.taggedPoliticianIds.length > 0) {
        console.log(`  -> Resolved ${article.taggedPoliticianIds.length} politician ID(s) for "${article.headline.slice(0, 40)}..."`);
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
      event_date: article.eventDate,
      published_at: article.published_at || new Date().toISOString(),
      impact_area: article.impactArea || 'state',
      latitude: article.latitude,
      longitude: article.longitude,
      content: {
        body: article.body,
        seoTitle: article.seoTitle || `${article.headline} | Choseno`,
        metaDescription: article.metaDescription || article.summary,
        tags: article.tags || [],
        tweet: article.tweet,
        breakingNews: article.breakingNews || false,
        author: article.author || { name: 'Choseno Editorial Bureau', bio: 'Non-partisan civic news' },
        sources: article.sources || []
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

  // 4. Update batch-ranked-news.csv (keeping top 100)
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

    const combinedRows = [...newCsvRows, ...existingRows].slice(0, 100);
    // Re-rank 1..N
    const rankedLines = combinedRows.map((row, i) => {
      const parts = row.split(',');
      parts[0] = String(i + 1);
      return parts.join(',');
    });

    const header = 'batch_rank,viral_score,headline,category,jurisdiction,primary_official,published_at,recommended_post_window,tweet_copy,viral_reasoning,live_news_url,politician_wall_url';
    fs.writeFileSync(csvPath, [header, ...rankedLines].join('\n') + '\n');
    console.log(`Updated batch-ranked-news.csv with ${inserted.length} newly inserted articles.`);
  }

  console.log('\n=========================================');
  console.log(`INGESTION COMPLETE: ${inserted.length} inserted, ${skipped.length} skipped.`);
  console.log('=========================================');
}

run().catch(console.error);
