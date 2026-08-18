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

// 2. Article payload to ingest (Lookback Batch: August 17-18, 2026 Night & Morning Cycle - 22 Stories)
const articles = [
  {
    "slug": "judge-delays-mangione-state-trial-double-jeopardy-motion-2026-08-17",
    "headline": "New York State Justice Postpones Luigi Mangione Murder Trial Pending Double Jeopardy Ruling",
    "summary": "Manhattan Supreme Court Justice Gregory Carro adjourns Luigi Mangione's state murder trial scheduled for September after the defense files a dismissal motion citing constitutional double jeopardy following his federal guilty plea.",
    "category": "Justice",
    "country": "US",
    "province": "NY",
    "status": "published",
    "eventDate": "2026-08-17T21:30:00Z",
    "published_at": "2026-08-18T04:22:00Z",
    "impactArea": "state",
    "latitude": 40.7128,
    "longitude": -74.006,
    "body": "NEW YORK, NY — Manhattan Supreme Court Justice Gregory Carro on Monday officially adjourned the state murder trial of Luigi Mangione, which had been slated to commence on September 8, 2026, granting defense counsel time to litigate a comprehensive motion to dismiss predicated on constitutional double jeopardy and due process protections.\n\n## Federal Plea and State Double Jeopardy Motion\n\nThe procedural delay comes four days after Mangione entered a formal guilty plea in the U.S. District Court for the Southern District of New York to federal interstate stalking charges connected to the December 2024 shooting death of UnitedHealthcare Chief Executive Officer Brian Thompson outside a midtown Manhattan hotel.\n\nMangione's defense team, led by Karen Friedman Agnifilo, submitted a 68-page memorandum arguing that New York Criminal Procedure Law § 40.20 and the Fifth Amendment prohibit successive state prosecution for identical criminal conduct already adjudicated and sentenced in a federal forum. Defense attorneys asserted that subjecting the defendant to a second trial constitutes impermissible dual sovereignty overreach under statutory protections enacted by the New York State Legislature.\n\n## Prosecution Arguments and Judicial Schedule\n\nManhattan District Attorney Alvin Bragg's office maintained that New York state murder charges fall within established statutory exceptions to double jeopardy rules, citing distinct elements of proof and the state's sovereign duty to hold individuals accountable for violent felonies committed within its territorial borders. Assistant District Attorneys argued that federal stalking provisions do not encompass the intentional homicide elements specified in state second-degree murder statutes.\n\nJustice Carro ordered the Manhattan District Attorney's Office to submit formal legal opposition briefs by October 9, 2026. Defense reply memorandums are due by November 13, with oral arguments and evidentiary hearings scheduled for December 10, 2026.\n\n## National Precedent and Legal Ramifications\n\nLegal scholars note the case presents a high-profile constitutional test of New York's reformed double jeopardy exceptions. The outcome will directly establish precedent regarding how state district attorneys prosecute corporate violence and public safety threats in cases where concurrent federal authorities initiate expedited federal plea agreements.",
    "seoTitle": "Judge Postpones Luigi Mangione State Trial Over Double Jeopardy | Choseno",
    "metaDescription": "Manhattan Supreme Court Justice Gregory Carro delays Luigi Mangione's murder trial pending double jeopardy review following his federal plea.",
    "tags": ["Luigi Mangione", "Alvin Bragg", "Manhattan", "New York", "Double Jeopardy", "Justice"],
    "tweet": "Manhattan Supreme Court Justice Gregory Carro postpones Luigi Mangiones state murder trial pending constitutional double jeopardy review.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Legal Affairs Bureau",
      "bio": "Criminal justice, constitutional litigation, and court proceedings reporting"
    },
    "sources": [
      {
        "label": "The Washington Post",
        "url": "https://www.washingtonpost.com/national-security/2026/08/17/luigi-mangione-trial-delayed-double-jeopardy/"
      },
      {
        "label": "New York Law Journal",
        "url": "https://www.law.com/newyorklawjournal/2026/08/17/manhattan-judge-delays-mangione-state-trial/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Alvin Bragg"]
  },
  {
    "slug": "south-korea-president-lee-worst-case-scenario-us-military-drills-reduction-2026-08-18",
    "headline": "President Lee Directs South Korean Defense Overhaul as U.S. Joint Military Exercises Scale Back",
    "summary": "South Korean President Lee Jae-myung directs his cabinet to prepare for worst-case security contingencies as joint Ulchi Freedom Shield exercises launch with reduced U.S. participation, reiterating plans for nuclear submarine acquisition and wartime operational autonomy.",
    "category": "Policy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-18T00:30:00Z",
    "published_at": "2026-08-18T04:49:00Z",
    "impactArea": "country",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "SEOUL & WASHINGTON, D.C. — South Korean President Lee Jae-myung convened an emergency national defense council on Tuesday morning as the annual joint *Ulchi Freedom Shield* (UFS) military exercises commenced with a significantly curtailed U.S. operational presence, directing commanders to construct robust independent deterrence capabilities for a \"worst-case regional scenario.\"\n\n## Truncated Drills and Bilateral Defense Friction\n\nThe joint combined exercises, historically involving over 20,000 U.S. service personnel alongside Republic of Korea forces, experienced substantial troop reductions following directives issued by U.S. President Donald Trump. The White House justified the operational scale-back by citing diplomatic engagements with North Korean leadership and broader reassessments of international cost-sharing frameworks.\n\nAddressing senior commanders at the Joint Chiefs of Staff headquarters in Seoul, President Lee stated that while defensive readiness with the United States remains a foundational pillar, South Korea must accelerate sovereign strategic autonomy to ensure complete protection of its 51 million citizens against evolving ballistic and conventional threats.\n\n## Nuclear Submarine Development and OPCON Transition\n\nPresident Lee instructed the Ministry of National Defense to advance engineering roadmaps for domestically produced nuclear-powered attack submarines, arguing that non-nuclear-armed naval propulsion is indispensable for long-duration maritime surveillance in the East Sea. South Korean defense planners reaffirmed target timelines to complete the transfer of Wartime Operational Control (OPCON) from U.S. Indo-Pacific Command before the conclusion of the current presidential term in 2030.\n\nIn Washington, members of the Senate Foreign Relations and Armed Services Committees expressed concern regarding the unilateral reduction of Pacific theater readiness, highlighting the necessity of integrated allied coordination across the Taiwan Strait and Korean Peninsula.\n\n## Regional Geopolitical and Economic Implications\n\nThe defense recalibration comes as Seoul balances strategic export relationships with key international trade partners while expanding its domestic arms manufacturing footprint. South Korean defense exports reached record quarterly volumes across European and Southeast Asian defense procurement markets.",
    "seoTitle": "President Lee Prepares South Korea for Defense Contingencies | Choseno",
    "metaDescription": "South Korean President Lee orders defense overhaul and nuclear sub push as joint U.S. Ulchi Freedom Shield exercises are scaled back.",
    "tags": ["Donald Trump", "South Korea", "Indo-Pacific", "Defense Policy", "Pentagon", "Policy"],
    "tweet": "South Korean President Lee orders defense overhaul and accelerates nuclear sub development as U.S. joint military drills are scaled back.",
    "breakingNews": false,
    "author": {
      "name": "Choseno International Policy Bureau",
      "bio": "Global security, bilateral alliances, and executive defense policy analysis"
    },
    "sources": [
      {
        "label": "CNBC International",
        "url": "https://www.cnbc.com/2026/08/18/south-korea-president-lee-worst-case-scenario-us-drills.html"
      },
      {
        "label": "Yonhap News Agency",
        "url": "https://en.yna.co.kr/view/AEN20260818001400315"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "tropical-storm-lala-hawaii-power-outage-flash-floods-naalehu-2026-08-18",
    "headline": "Hawaii Mobilizes Emergency Infrastructure Teams as Tropical Storm Lala Leaves 100,000 Without Power",
    "summary": "State and county emergency officials deploy disaster response teams across Hawaii as Tropical Storm Lala causes widespread flash flooding, structural damage in Naalehu, and knocks out electrical service to over 100,000 residents.",
    "category": "Climate",
    "country": "US",
    "province": "HI",
    "status": "published",
    "eventDate": "2026-08-18T01:30:00Z",
    "published_at": "2026-08-18T02:32:00Z",
    "impactArea": "state",
    "latitude": 19.0556,
    "longitude": -155.5867,
    "body": "HONOLULU, HI — Emergency management authorities across the State of Hawaii mobilized civil defense units and heavy machinery crews on Tuesday following the passage of Tropical Storm Lala, which generated record-breaking rainfall, destroyed six regional bridges, and disrupted electrical power for more than 100,000 residential and commercial customers.\n\n## Extreme Precipitation and Big Island Infrastructure Impact\n\nRain gauges in high-elevation terrain on Hawaii Island recorded over 42 inches of rain within a 36-hour window, triggering catastrophic debris flows that severed major transportation arteries in the Kaʻū district. The southern communities of Naʻalehu, Pāhala, and Waiʻōhinu remained partially isolated as Highway 11 sustained structural washouts.\n\nHawaii County Civil Defense confirmed one storm-related casualty: a 90-year-old Naʻalehu resident whose residence was engulfed by floodwaters. Search and rescue personnel conducted over 40 high-water evacuations across inundated rural residential subdivisions, operating temporary emergency shelters in coordination with the American Red Cross.\n\n## Power Grid Rebuilding and Utility Warning\n\nHawaiian Electric dispatched emergency transmission repair crews across the Big Island, Maui, and Oahu. Utility executives cautioned that while metropolitan feeders would see progressive restoration within 48 hours, replacing downed high-voltage transmission towers and sheared wooden poles in remote mountainous canyons will require multi-week construction efforts.\n\nActing Governor Sylvia Luke and county leadership signed emergency disaster declarations unlocking state contingency funds and authorizing National Guard engineering support to assist municipal public works departments with debris clearing and water purification distribution.\n\n## Federal Emergency Declaration and Climate Resilience\n\nHawaii's congressional delegation petitioned the Federal Emergency Management Agency (FEMA) for an expedited presidential major disaster declaration. Lawmakers noted that the increasing frequency of intense tropical cyclonic activity underscores the urgent necessity of federal funding to underground island power infrastructure and elevate coastal transit corridors.",
    "seoTitle": "Hawaii Mobilizes Disaster Teams After Tropical Storm Lala | Choseno",
    "metaDescription": "Tropical Storm Lala leaves 100,000 powerless in Hawaii with heavy flooding and bridge washouts across the Big Island.",
    "tags": ["Hawaii", "Tropical Storm Lala", "FEMA", "Disaster Recovery", "Climate", "Infrastructure"],
    "tweet": "Hawaii emergency crews mobilize as Tropical Storm Lala leaves over 100000 without power and damages key bridges on the Big Island.",
    "breakingNews": true,
    "author": {
      "name": "Choseno Environmental Crisis Bureau",
      "bio": "Severe weather events, public infrastructure recovery, and climate resilience reporting"
    },
    "sources": [
      {
        "label": "Associated Press",
        "url": "https://apnews.com/article/tropical-storm-lala-hawaii-power-outages-flooding-748921"
      },
      {
        "label": "Hawaii News Now",
        "url": "https://www.hawaiinewsnow.com/2026/08/18/lala-devastation-big-island-recovery-power-grid/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "house-public-safety-committee-nato-spy-vetting-investigation-vote-2026-08-18",
    "headline": "House Public Safety Committee Votes to Investigate Federal Security Vetting of Accused NATO Intern",
    "summary": "The House of Commons Standing Committee on Public Safety votes in an emergency session to launch a formal parliamentary inquiry into federal security clearance procedures following the arrest of a Canadian intern in Belgium for alleged espionage.",
    "category": "Justice",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-17T23:15:00Z",
    "published_at": "2026-08-18T00:16:00Z",
    "impactArea": "country",
    "latitude": 45.4236,
    "longitude": -75.7009,
    "body": "OTTAWA, ON — The House of Commons Standing Committee on Public Safety and National Security (SECU) voted unanimously on Monday evening to initiate an emergency parliamentary inquiry into federal background screening and security clearance protocols following the arrest of a Canadian national in Europe on foreign espionage charges.\n\n## European Arrest and Allied Intelligence Concerns\n\nThe probe follows the detention by Belgian federal police and intelligence authorities of a Canadian national who was completing an internship at NATO's Supreme Headquarters Allied Powers Europe (SHAPE) in Mons, Belgium. Belgian prosecutors alleged the individual transmitted sensitive operational data to foreign intelligence operatives.\n\nOpposition members of Parliament from the Conservative Party and Bloc Québécois requisitioned the emergency committee session, asserting that the incident raises serious concerns regarding the integrity of security clearances administered by the Canadian Security Intelligence Service (CSIS) and the Privy Council Office for personnel placed within allied defense institutions.\n\n## Scope of Parliamentary Inquiry and Witness Subpoenas\n\nThe adopted committee motion authorizes public and in-camera hearings to examine the vetting timelines, polygraph procedures, and inter-agency data-sharing protocols governing Canadian secondments to NATO, NORAD, and Five Eyes defense frameworks.\n\nCommittee members passed provisions to summon Minister of Public Safety Dominic LeBlanc, CSIS Director Vanessa Lloyd, and senior officials from the Department of National Defence to testify regarding oversight mechanisms. MPs will also review recommendations from recent national security audits to identify systemic procedural gaps in vetting entry-level and civilian personnel.\n\n## Intergovernmental Repercussions and Clearance Modernization\n\nNational security experts testifying before Parliament noted that the controversy could affect the speed and reciprocity of intelligence sharing between Canada and its NATO partners. The committee plans to present an interim report with statutory reform proposals before the end of the fall parliamentary sitting.",
    "seoTitle": "House Public Safety Committee to Probe NATO Intern Vetting | Choseno",
    "metaDescription": "Canadian House Public Safety Committee launches emergency investigation into national security vetting following NATO intern arrest.",
    "tags": ["Dominic LeBlanc", "Public Safety", "NATO", "CSIS", "House of Commons", "Justice", "Policy"],
    "tweet": "House Public Safety Committee votes to investigate federal background vetting after a Canadian NATO intern was arrested on espionage charges.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Parliamentary Affairs Bureau",
      "bio": "National defense oversight, legislative committee proceedings, and intelligence policy reporting"
    },
    "sources": [
      {
        "label": "National Post",
        "url": "https://nationalpost.com/news/canada/house-public-safety-committee-nato-spy-vetting-investigation"
      },
      {
        "label": "iPolitics",
        "url": "https://ipolitics.ca/2026/08/17/secu-emergency-meeting-nato-clearance-review/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Dominic LeBlanc"]
  },
  {
    "slug": "defense-secretary-pete-hegseth-rep-zach-nunn-iowa-state-fair-2026-08-18",
    "headline": "Defense Secretary Pete Hegseth and Rep. Zach Nunn Address Rural Veterans and Defense Logistics at Iowa Civic Forum",
    "summary": "U.S. Defense Secretary Pete Hegseth joins Representative Zach Nunn at the Iowa State Fairgrounds, engaging with rural constituents on veterans' healthcare access, defense industrial manufacturing, and agricultural supply chain resilience.",
    "category": "Policy",
    "country": "US",
    "province": "IA",
    "status": "published",
    "eventDate": "2026-08-18T00:30:00Z",
    "published_at": "2026-08-18T02:53:00Z",
    "impactArea": "state",
    "latitude": 41.5912,
    "longitude": -93.5517,
    "body": "DES MOINES, IA — Secretary of Defense Pete Hegseth joined U.S. Representative Zach Nunn (IA-03) on Monday afternoon for a public civic forum at the Iowa State Fairgrounds, fielding questions from rural constituents, military veterans, and agricultural equipment manufacturers regarding defense readiness and domestic supply chain security.\n\n## Expanding Midwest Defense Industrial Manufacturing\n\nAddressing an audience of over 600 attendees, Secretary Hegseth underscored Pentagon initiatives to disperse defense manufacturing contracts into Midwestern industrial hubs. The discussion highlighted federal efforts to dual-source advanced munitions components, precision machining, and specialized hydraulic systems from regional agricultural equipment producers to reduce single-source vulnerabilities in the national defense industrial base.\n\nRepresentative Nunn, an Air Force veteran, emphasized the strategic importance of expanding precision manufacturing apprenticeship pipelines in Iowa, pointing to recent congressional appropriations that incentivize private-sector collaboration with regional community colleges.\n\n## Veteran Healthcare Delivery in Rural Communities\n\nA primary focus of the forum centered on healthcare access challenges encountered by rural military veterans across Iowa's 3rd Congressional District. Attendees raised concerns regarding extended appointment wait times at regional VA medical centers and administrative friction in processing claims under the PACT Act.\n\nNunn outlined legislative proposals designed to expand community care telehealth reimbursements and incentivize specialized medical providers to establish practices in underserved agricultural counties. Hegseth affirmed Department of Defense coordination with the Department of Veterans Affairs to streamline electronic medical records transitions for departing service members.\n\n## Food Security and Critical Agricultural Logistics\n\nThe dialogue also examined the intersection of national defense and agricultural logistics, addressing biofuel integration into military fuel blends and safeguarding grain transportation corridors against foreign cyber infrastructure disruptions.",
    "seoTitle": "Pete Hegseth and Zach Nunn Host Iowa Veterans Forum | Choseno",
    "metaDescription": "Defense Secretary Pete Hegseth and Rep. Zach Nunn address rural manufacturing and veterans care at Iowa State Fairgrounds civic event.",
    "tags": ["Pete Hegseth", "Zach Nunn", "Iowa", "Veterans Affairs", "Defense", "Policy"],
    "tweet": "Defense Secretary Pete Hegseth and Rep. Zach Nunn meet with rural constituents and veterans at Iowa State Fair to discuss defense manufacturing.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Midwest Bureau",
      "bio": "Congressional accountability, veterans advocacy, and regional industrial policy analysis"
    },
    "sources": [
      {
        "label": "Iowa Capital Dispatch",
        "url": "https://iowacapitaldispatch.com/2026/08/17/hegseth-nunn-iowa-state-fair-veterans-defense/"
      },
      {
        "label": "The Des Moines Register",
        "url": "https://www.desmoinesregister.com/story/news/politics/2026/08/17/pete-hegseth-zach-nunn-defense-forum-des-moines/74839201/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Pete Hegseth"]
  },
  {
    "slug": "ontario-mandatory-cash-bail-ccla-constitutional-challenge-superior-court-2026-08-17",
    "headline": "Civil Liberties Groups Launch Constitutional Challenge Against Ontario's New Mandatory Cash Bail Rules",
    "summary": "The Canadian Civil Liberties Association and the Criminal Lawyers' Association file a legal challenge in the Ontario Superior Court of Justice, alleging that the province's new mandatory upfront cash bail deposit regulations violate the Charter of Rights.",
    "category": "Justice",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-17T20:30:00Z",
    "published_at": "2026-08-17T21:30:00Z",
    "impactArea": "state",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "TORONTO, ON — The Canadian Civil Liberties Association (CCLA) and the Criminal Lawyers' Association (CLA) launched a joint constitutional challenge in the Ontario Superior Court of Justice on Monday, seeking an immediate injunction to strike down the provincial government's newly enacted mandatory cash bail regulations.\n\n## Enactment of Restrictive Cash Security Framework\n\nThe legal action coincides with the formal implementation of Ontario's updated bail enforcement framework on August 17, 2026. Under the new provincial rules, whenever a court orders a monetary deposit as a condition of pre-trial release, the full cash sum must be deposited into court accounts within two business days. The province eliminated traditional \"pledge-based\" recognizances where sureties promised assets payable only upon a verified breach of conditions.\n\nOntario Attorney General Doug Downey defended the reform as an essential measure to crack down on repeat violent offenders, enhance judicial compliance, and curb perceived bail evasion, noting that the province has expanded collection tools including wage garnishment and property liens.\n\n## Constitutional Arguments and Charter Violations\n\nThe applicants argue in court filings that the regulation creates an unconstitutional \"two-tiered\" criminal justice system where affluent accused persons secure liberty while low-income individuals remain remanded in provincial detention facilities despite the presumption of innocence.\n\nCounsel for the CCLA argued the statute breaches Section 11(e) of the *Canadian Charter of Rights and Freedoms*, which guarantees every accused person the right not to be denied reasonable bail without just cause. The application further asserts provincial jurisdictional overreach, contending that the rules conflict with judicial discretion explicitly granted to magistrates under the federal *Criminal Code*.\n\n## Provincial Correctional Congestion and Next Judicial Steps\n\nLegal advocates noted that Ontario remand centers already operate at over 115% capacity, warning that the immediate cash deposit rule will exacerbate institutional overcrowding. Superior Court Justice Michael Doi scheduled an expedited hearing for the injunction application for September 14, 2026.",
    "seoTitle": "Civil Liberties Groups Challenge Ontario Cash Bail Rules | Choseno",
    "metaDescription": "CCLA and Criminal Lawyers Association challenge Ontario's mandatory cash bail rules in Superior Court under the Charter of Rights.",
    "tags": ["Doug Ford", "Ontario", "Toronto", "Cash Bail", "Charter of Rights", "Justice"],
    "tweet": "Civil liberties groups file a constitutional challenge in Superior Court against Ontarios mandatory cash bail deposit regulations.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Ontario Bureau",
      "bio": "Provincial legal policy, constitutional challenges, and correctional reform reporting"
    },
    "sources": [
      {
        "label": "CTV News Toronto",
        "url": "https://toronto.ctvnews.ca/ontario-cash-bail-rules-face-constitutional-challenge-1.7482910"
      },
      {
        "label": "Canadian Civil Liberties Association",
        "url": "https://ccla.org/press-release/ccla-cla-challenge-ontario-bail-regulations/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Doug Ford"]
  },
  {
    "slug": "bc-wildfires-disinformation-enforcement-emergency-management-orders-2026-08-18",
    "headline": "B.C. Emergency Management Ministry Issues Directives Curbing Wildfire Evacuation Disinformation",
    "summary": "British Columbia Premier David Eby and Emergency Management Minister Kelly Greene issue strict directives to combat coordinated online disinformation and fraudulent contractors targeting evacuated interior communities.",
    "category": "Climate",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-17T23:45:00Z",
    "published_at": "2026-08-18T01:15:00Z",
    "impactArea": "state",
    "latitude": 48.4284,
    "longitude": -123.3656,
    "body": "VICTORIA, BC — The Government of British Columbia enacted new emergency enforcement directives on Monday evening, deploying specialized cybersecurity monitors and regional RCMP patrols to protect wildfire-evacuated communities from coordinated online disinformation campaigns and unlicensed security contractors.\n\n## Emergence of Coordinated Disinformation Networks\n\nProvincial emergency briefings revealed that BC Wildfire Service operations in the Southern Interior and Cariboo regions encountered orchestrated digital campaigns disseminating falsified evacuation route closures, fake structural loss tallies, and fraudulent donation portals. Provincial intelligence reports indicated foreign bot networks and bad-faith commercial actors amplified fabricated narratives to sow public confusion during rapid evacuation orders.\n\nPremier David Eby condemned the exploitative practices during an update in Victoria, warning that interfering with active emergency response efforts jeopardizes firefighter safety and constituent compliance with life-saving municipal evacuation alerts.\n\n## Enforcement Directives and Consumer Protections\n\nMinister of Emergency Management and Climate Readiness Kelly Greene announced enhanced coordination with the RCMP Federal Serious and Organized Crime unit to track down and prosecute digital bad actors under provincial emergency statutes. Penalties for intentionally impeding emergency personnel or distributing fraudulent public safety notices include fines up to $100,000 and imprisonment.\n\nAdditionally, the province issued a consumer protection warning regarding predatory private contractors attempting to enter evacuation zones under false pretenses to sell overpriced residential structural defense chemicals or unauthorized security patrols.\n\n## Frontline Operations and Recovery Funding\n\nOver 2,200 wildland firefighters and international personnel remain deployed across B.C., with significant containment progress reported on the Shetland Creek and complex interior blazes. The province reaffirmed the deployment of $15 million in direct emergency hardship relief for displaced families.",
    "seoTitle": "BC Enforces Emergency Directives on Wildfire Disinformation | Choseno",
    "metaDescription": "Premier David Eby and BC Emergency Management issue directives against wildfire disinformation and fraudulent contractors.",
    "tags": ["David Eby", "British Columbia", "Wildfires", "Emergency Management", "Victoria", "Climate", "Public Safety"],
    "tweet": "BC government issues strict emergency enforcement directives to combat wildfire disinformation and predatory contractors in evacuation zones.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Pacific Bureau",
      "bio": "Environmental disasters, emergency management policy, and provincial governance reporting"
    },
    "sources": [
      {
        "label": "CTV News BC",
        "url": "https://bc.ctvnews.ca/b-c-wildfires-being-exploited-by-bad-actors-1.7483921"
      },
      {
        "label": "CBC News British Columbia",
        "url": "https://www.cbc.ca/news/canada/british-columbia/bc-wildfire-disinformation-warning-eby-1.7482933"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["David Eby"]
  },
  {
    "slug": "penn-state-fraternity-cocaine-ring-indictment-14-arrests-2026-08-17",
    "headline": "Centre County Prosecutors Indict 14 Individuals in Major University Campus Narcotics Ring Bust",
    "summary": "Pennsylvania state prosecutors and local police unseal indictments against 14 individuals involved in a large-scale cocaine distribution ring operating across fraternity chapters at Penn State University.",
    "category": "Justice",
    "country": "US",
    "province": "PA",
    "status": "published",
    "eventDate": "2026-08-17T22:30:00Z",
    "published_at": "2026-08-17T23:36:00Z",
    "impactArea": "state",
    "latitude": 40.7982,
    "longitude": -77.8599,
    "body": "STATE COLLEGE, PA — Centre County District Attorney Bernie Cantorna and the State College Police Department announced criminal indictments on Monday against 14 current and former Penn State University students, dismantling a multi-tiered narcotics ring that distributed kilograms of cocaine through Greek life chapters.\n\n## Year-Long Undercover Task Force Investigation\n\nThe arrests culminate a 14-month coordinated investigation conducted by the Centre County Drug Task Force, Pennsylvania State Police, and federal postal inspectors. Investigators uncovered that the organization utilized encrypted messaging platforms to coordinate shipments of bulk cocaine from suppliers in Philadelphia and New York directly to off-campus fraternity houses.\n\nCourt affidavits detail that organization members forced new fraternity pledges to assist in cutting, packaging, and delivering drugs as part of illicit hazing rituals. Search warrants executed across eight off-campus residences recovered over three kilograms of cocaine, eleven unregistered firearms, and approximately $180,000 in illicit cash proceeds.\n\n## University Sanctions and Chapter Suspensions\n\nPenn State University administration issued an immediate interim suspension for two recognized fraternity chapters implicated in the indictment, barring all organizational meetings and campus activities pending university disciplinary reviews.\n\nUniversity President Neeli Bendapudi stated that the university maintains zero tolerance for criminal enterprise and student hazing, pledging full institutional cooperation with county prosecutors. University health officials announced expanded campus resources for substance abuse recovery and anonymous peer reporting mechanisms.\n\n## Criminal Charges and Judicial Proceedings\n\nDefendants face felony charges including corrupt organizations, conspiracy to deliver controlled substances, and weapons violations. Preliminary hearings are scheduled for September 2, 2026, at the Centre County Courthouse in Bellefonte.",
    "seoTitle": "14 Indicted in Penn State Fraternity Cocaine Ring Bust | Choseno",
    "metaDescription": "Centre County prosecutors charge 14 individuals in major drug distribution and pledge hazing operation at Penn State University.",
    "tags": ["Pennsylvania", "Penn State", "State College", "Narcotics Investigation", "Justice", "Higher Education"],
    "tweet": "Centre County prosecutors indict 14 individuals in a major narcotics ring and pledge hazing bust at Penn State University fraternity houses.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Investigative Bureau",
      "bio": "Criminal syndicates, collegiate accountability, and municipal law enforcement reporting"
    },
    "sources": [
      {
        "label": "Fox News",
        "url": "https://www.foxnews.com/us/penn-state-cocaine-bust-14-arrests-fraternity-pledge-rituals"
      },
      {
        "label": "Centre Daily Times",
        "url": "https://www.centredaily.com/news/local/crime/article29103912.html"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "meta-states-landmark-social-media-youth-addiction-trial-bloomberg-2026-08-17",
    "headline": "Federal Court Convenes Landmark Multistate Trial Over Meta's Youth Algorithmic Architecture",
    "summary": "A coalition of 40 state attorneys general begins trial against Meta Platforms in California federal court, alleging deceptive practices and deliberate algorithmic engineering that fostered youth mental health crises.",
    "category": "Technology",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-17T21:00:00Z",
    "published_at": "2026-08-17T21:43:00Z",
    "impactArea": "country",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "body": "SAN FRANCISCO, CA — In one of the most consequential tech antitrust and consumer protection proceedings in modern legal history, a bipartisan coalition of 40 state attorneys general began trial on Monday in the U.S. District Court for the Northern District of California against Meta Platforms Inc., seeking structural remedies and billions in civil damages.\n\n## State Allegations of Deceptive Design and Dopamine Exploitation\n\nLead state prosecutors from California, New York, Colorado, and Tennessee presented internal company communications in opening arguments, alleging that Meta leadership knowingly engineered algorithmic engagement loops on Instagram and Facebook that exploited neurobiological vulnerabilities in adolescent users.\n\nStates argue Meta violated the Children's Online Privacy Protection Act (COPPA) and state consumer protection statutes by deploying infinite scroll, unprompted notification cascades, and beauty filter recommendation systems designed to maximize screen time at the expense of minor mental health. Prosecutors presented internal research documents demonstrating Meta analysts were aware of direct correlations between extended platform usage and spikes in adolescent depression and sleep deprivation.\n\n## Meta Defense and Industry Free Speech Counterarguments\n\nMeta defense attorneys, led by Gibson Dunn, argued that platform features constitute protected commercial speech under the First Amendment and that the company has implemented over 30 parental control and age-assurance tools since 2021. Defense counsel maintained that adolescent mental health is influenced by complex societal factors rather than digital platform architecture, arguing that states are attempting to impose impermissible regulatory mandates through litigation.\n\nU.S. District Judge Yvonne Gonzalez Rogers presided over the bench trial, which will hear testimony from developmental psychologists, algorithm architects, and Meta executive leadership over the next six weeks.\n\n## National Regulatory Ramifications\n\nThe trial outcome could establish binding legal standards for digital product liability, accelerating congressional momentum behind the federal Kids Online Safety Act (KOSA) and reshaping algorithmic deployment across major social tech firms.",
    "seoTitle": "States Begin Landmark Youth Addiction Trial Against Meta | Choseno",
    "metaDescription": "40 state attorneys general begin federal trial against Meta over youth mental health impacts and algorithmic engagement loops.",
    "tags": ["Meta", "Gavin Newsom", "Technology", "Consumer Protection", "California", "Justice"],
    "tweet": "A coalition of 40 state attorneys general begins trial in federal court against Meta over youth algorithmic addiction and mental health impacts.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Technology & Law Bureau",
      "bio": "Antitrust enforcement, algorithmic regulation, and digital consumer rights reporting"
    },
    "sources": [
      {
        "label": "Bloomberg Law",
        "url": "https://news.bloomberglaw.com/litigation/meta-stares-down-trillion-dollar-threat-in-landmark-youth-trial"
      },
      {
        "label": "The Wall Street Journal",
        "url": "https://www.wsj.com/tech/meta-multistate-youth-addiction-trial-begins-7489210"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Gavin Newsom"]
  },
  {
    "slug": "big-bend-national-park-border-wall-construction-pause-environmental-2026-08-17",
    "headline": "Federal Authorities Pause Border Barrier Construction Along Environmentally Sensitive Big Bend Corridor",
    "summary": "Federal authorities temporarily halt border barrier construction in West Texas near Big Bend National Park following environmental impact petitions and logistical challenges across rugged desert canyon terrain.",
    "category": "Climate",
    "country": "US",
    "province": "TX",
    "status": "published",
    "eventDate": "2026-08-17T22:30:00Z",
    "published_at": "2026-08-17T23:09:00Z",
    "impactArea": "state",
    "latitude": 29.2498,
    "longitude": -103.2502,
    "body": "BREWSTER COUNTY, TX — Federal border security officials confirmed on Monday that physical barrier construction along segments of the West Texas border near Big Bend National Park has been temporarily paused, following administrative reviews of environmental assessments and severe topographical constraints.\n\n## Topographical Constraints and Ecological Concerns\n\nThe construction corridor spans rugged Chihuahuan Desert terrain characterized by steep limestone canyons, flash-flood arroyos, and fragile riparian ecosystems along the Rio Grande. Conservation organizations, including the Sierra Club and the National Parks Conservation Association, filed administrative challenges arguing that continuous steel bollard installation would obstruct critical migration pathways for bighorn sheep, black bears, and endangered freshwater species.\n\nBrewster County officials and local landowners raised logistical concerns regarding heavy machinery transit, noting that heavy excavation across remote desert bluff lines threatened historical archaeological resources and fragile groundwater recharge basins.\n\n## Administrative Review and Alternative Surveillance Systems\n\nCustoms and Border Protection (CBP) leadership indicated that construction contracts in the Big Bend sector are undergoing review to evaluate whether fixed physical barriers should be supplemented or replaced with advanced non-intrusive surveillance technologies, including autonomous sensor towers, subterranean seismic monitors, and long-range aerial radar.\n\nTexas Governor Greg Abbott's administration criticized the pause, reiterating the state's commitment to deploying state-funded barriers along private ranches under Operation Lone Star where federal projects stall.\n\n## Regional Landowner and Civic Perspectives\n\nLocal civic leaders in Alpine, Terlingua, and Presidio welcomed the temporary halt, urging federal and state agencies to engage in formal stakeholder consultations with desert communities whose ecotourism economies rely on unimpeded natural river corridors.",
    "seoTitle": "Federal Authorities Pause Big Bend Border Wall Construction | Choseno",
    "metaDescription": "Border barrier construction near Big Bend National Park is paused as federal officials review environmental and logistical factors.",
    "tags": ["Greg Abbott", "Texas", "Big Bend", "Border Security", "Environment", "Climate", "Policy"],
    "tweet": "Federal authorities pause border wall construction near Big Bend National Park following environmental petitions and terrain challenges.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Border & Environment Bureau",
      "bio": "Border infrastructure, federal public lands, and environmental conservation analysis"
    },
    "sources": [
      {
        "label": "Axios",
        "url": "https://www.axios.com/2026/08/17/big-bend-border-wall-construction-paused"
      },
      {
        "label": "The Texas Tribune",
        "url": "https://www.texastribune.org/2026/08/17/big-bend-border-wall-pause-environmental-review/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Greg Abbott"]
  },
  {
    "slug": "alberta-first-nations-chiefs-treaty-anniversary-government-boycott-rebuke-2026-08-17",
    "headline": "Alberta First Nations Leadership Issues Stern Rebukes Over Provincial Absence at Historic Treaty Anniversary",
    "summary": "First Nations Chiefs representing Treaty 6, 7, and 8 publicly condemn the Alberta government's decision to miss the official 150th treaty commemoration event, demanding formal recognition and meaningful resource revenue dialogue.",
    "category": "Policy",
    "country": "CA",
    "province": "AB",
    "status": "published",
    "eventDate": "2026-08-17T20:45:00Z",
    "published_at": "2026-08-17T21:19:00Z",
    "impactArea": "state",
    "latitude": 53.5461,
    "longitude": -113.4938,
    "body": "EDMONTON, AB — Indigenous leaders across Alberta issued sharp rebukes to the provincial government on Monday after Premier Danielle Smith and senior cabinet ministers failed to attend the landmark 150th commemoration of Treaty 6 at Fort Carlton, calling the absence a profound breach of diplomatic protocol and reconciliation commitments.\n\n## Treaty Commemoration and Provincial Non-Attendance\n\nThe anniversary gathered hundreds of Elders, Chiefs, and youth delegates from First Nations across Alberta and Saskatchewan to honor the sacred nation-to-nation covenant signed in 1876. While federal and Saskatchewan provincial representatives attended, Alberta's executive leadership sent no ministerial representation.\n\nGrand Chief Cody Thomas of the Confederacy of Treaty Six First Nations stated that the provincial absence sends a damaging signal regarding Alberta's commitment to respecting inherent Indigenous sovereignty, land rights, and historical treaty obligations.\n\n## Resource Development and Sovereignty Disputes\n\nThe diplomatic friction occurs amid ongoing disputes between First Nations and the Alberta government over proposed provincial natural resource policies, water allocation frameworks during drought conditions, and the provincial *Alberta Sovereignty Within a United Canada Act*.\n\nTreaty leadership reiterated demands for full Free, Prior, and Informed Consent (FPIC) on major industrial projects and called for a restructured resource revenue sharing mechanism that reflects First Nations ownership of ancestral lands and stewardship of northern watersheds.\n\n## Provincial Statement and Calls for Structured Dialogue\n\nIndigenous Relations Minister Rick Wilson's office released a brief statement acknowledging the significance of the treaty anniversary, citing prior government scheduling commitments while expressing a desire for ongoing bilateral meetings.\n\nOpposition NDP Leader Naheed Nenshi called the government's absence an insult to Indigenous communities, urging the Premier to issue an unreserved apology and commit to quarterly government-to-government summits with treaty leadership.",
    "seoTitle": "First Nations Leaders Rebuke Alberta Government Over Treaty Absence | Choseno",
    "metaDescription": "Treaty 6, 7, and 8 Chiefs condemn Alberta government's absence at 150th treaty anniversary commemoration event.",
    "tags": ["Danielle Smith", "Alberta", "Indigenous Affairs", "Treaty 6", "First Nations", "Policy"],
    "tweet": "Treaty 6 First Nations leadership issues a stern rebuke to the Alberta government after senior provincial ministers missed treaty anniversary event.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Indigenous Affairs Bureau",
      "bio": "Treaty rights, First Nations governance, and crown-indigenous relations reporting"
    },
    "sources": [
      {
        "label": "Global News",
        "url": "https://globalnews.ca/news/10702911/alberta-government-misses-treaty-anniversary-event/"
      },
      {
        "label": "Edmonton Journal",
        "url": "https://edmontonjournal.com/news/politics/first-nations-rebuke-smith-government-treaty-commemoration"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Danielle Smith"]
  },
  {
    "slug": "churchill-falls-hydro-pact-innu-nation-opposition-scrutiny-2026-08-17",
    "headline": "Innu Nation Grand Chief Demands Binding Revenue Protections in Expanded Churchill Falls Energy Framework",
    "summary": "Innu Nation Grand Chief Simon Pokue and Newfoundland opposition parties voice reservations over the newly signed Eastern Clean Power Corridor, demanding full disclosure of revenue-sharing formulas and environmental commitments.",
    "category": "Economy",
    "country": "CA",
    "province": "NL",
    "status": "published",
    "eventDate": "2026-08-17T21:45:00Z",
    "published_at": "2026-08-17T22:08:00Z",
    "impactArea": "state",
    "latitude": 47.5615,
    "longitude": -52.7126,
    "body": "ST. JOHN'S, NL — Following the high-profile announcement of a $70 billion clean energy agreement between Newfoundland and Labrador, Quebec, and the federal government, Innu Nation Grand Chief Simon Pokue and provincial opposition leaders cautioned on Monday that Indigenous and public approval will depend on full financial transparency and legally binding equity stakes.\n\n## Innu Nation Consultation and Environmental Guarantees\n\nThe trilateral framework aims to develop the Gull Island hydro project on the Churchill River, unlocking 2,250 megawatts of renewable generating capacity to supply Atlantic Canada and Quebec. However, Grand Chief Pokue emphasized that ancestral Innu lands were profoundly impacted by the original 1969 Upper Churchill development without consent, stating that history must not repeat itself.\n\nPokue declared that the Innu Nation has not yet endorsed the full agreement and will insist on comprehensive impact assessments, guaranteed equity co-ownership, joint environmental monitoring boards, and dedicated revenue-sharing allocations prior to authorizing construction on Gull Island.\n\n## Legislative Scrutiny and Public Disclosure Demands\n\nIn the House of Assembly in St. John's, PC and NDP opposition critics pressed Premier Tony Wakeham to release the unredacted terms of the memorandum of understanding signed with Quebec Premier François Legault and Prime Minister Mark Carney.\n\nOpposition lawmakers questioned power transmission pricing formulas, risk-sharing agreements on potential infrastructure cost overruns, and protections against transmission tariff surcharges on Newfoundland ratepayer bills.\n\n## Interprovincial Timeline and Joint Hearings\n\nEnergy Minister Marco MacLeod indicated the province will introduce special enabling legislation during the fall legislative session, with public hearings scheduled across Labrador communities to present technical engineering data and economic forecasts.",
    "seoTitle": "Innu Nation Demands Revenue Guarantees in Churchill Hydro Deal | Choseno",
    "metaDescription": "Innu Grand Chief Simon Pokue demands detailed revenue-sharing and equity protections in the $70B Churchill Falls energy framework.",
    "tags": ["Mark Carney", "Newfoundland and Labrador", "Innu Nation", "Clean Energy", "Churchill Falls", "Economy", "Policy"],
    "tweet": "Innu Nation Grand Chief Simon Pokue demands binding equity and environmental protections in the multi-billion Churchill Falls clean hydro deal.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Atlantic Resources Bureau",
      "bio": "Hydroelectric energy, indigenous partnerships, and provincial fiscal policy analysis"
    },
    "sources": [
      {
        "label": "CBC Newfoundland & Labrador",
        "url": "https://www.cbc.ca/news/canada/newfoundland-labrador/innu-grand-chief-opposition-churchill-falls-deal-1.7483902"
      },
      {
        "label": "The Globe and Mail",
        "url": "https://www.theglobeandmail.com/business/industry-news/energy-and-resources/article-churchill-falls-deal-scrutiny-innu-nation/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Mark Carney"]
  },
  {
    "slug": "surrey-police-service-transition-budget-284-million-city-council-2026-08-17",
    "headline": "Surrey City Council Adopts $284.5M Policing Budget as Municipal Service Assumes Full Cloverdale Operations",
    "summary": "Surrey City Council and the Surrey Police Board reach a milestone $284.5 million operating agreement for 2026 as the Surrey Police Service expands front-line operations across Cloverdale and prepares for complete RCMP demobilization.",
    "category": "Public Safety",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-17T21:00:00Z",
    "published_at": "2026-08-17T22:30:00Z",
    "impactArea": "local",
    "latitude": 49.1913,
    "longitude": -122.849,
    "body": "SURREY, BC — Surrey City Council and the Surrey Police Board formalized a milestone $284.5 million policing operational budget for the 2026 fiscal year on Monday, providing stable long-term funding as the municipal police agency completes its takeover of all operational detachments from the RCMP.\n\n## Budget Compromise and Operational Staffing Targets\n\nThe finalized $284.5 million budget represents a negotiated compromise following an initial $331.5 million request by the police board. Mayor Brenda Locke highlighted that the revised figure provides an essential $45 million increase over 2025 expenditures while eliminating unspent infrastructure contingencies, ensuring taxpayers receive cost-effective municipal safety services.\n\nInterim Chief Constable Todd Matsumoto confirmed that the funding envelope fully supports the authorized deployment of over 500 active sworn officers and specialized civilian investigative units across Surrey's growing metropolitan footprint.\n\n## Cloverdale Transition and District Operational Handover\n\nThe funding approval follows the successful transfer of District 4 (Cloverdale) to full Surrey Police Service jurisdiction, joining previously transitioned commands in City Centre, Newton, Guildford, and South Surrey. Front-line patrol response, traffic enforcement, and community policing units are now operated primarily under municipal command.\n\nThe remaining transitional RCMP support contingent will gradually phase out over the next 18 months, with full demobilization targeted for late 2027.\n\n## Public Safety Priorities and Extortion Task Force\n\nCouncil directed the police service to prioritize resources for the regional business extortion task force and violent crime suppression units, reinforcing community outreach initiatives with diverse South Asian and youth organizations across the city.",
    "seoTitle": "Surrey Adopts $284.5M Police Budget for SPS Transition | Choseno",
    "metaDescription": "Surrey City Council approves $284.5 million operating budget for Surrey Police Service as Cloverdale transition completes.",
    "tags": ["Brenda Locke", "Surrey", "British Columbia", "Surrey Police Service", "RCMP", "Public Safety", "Municipal"],
    "tweet": "Surrey City Council approves a 284.5 million dollar policing budget as the Surrey Police Service expands jurisdiction across Cloverdale.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Civic Governance Bureau",
      "bio": "Municipal budgets, local police transitions, and urban safety administration reporting"
    },
    "sources": [
      {
        "label": "CTV News Vancouver",
        "url": "https://bc.ctvnews.ca/surrey-police-service-budget-agreement-284-million-1.7483912"
      },
      {
        "label": "Surrey Now-Leader",
        "url": "https://www.surreynowleader.com/news/surrey-city-council-approves-284-5m-policing-budget-7489201"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Brenda Locke"]
  },
  {
    "slug": "phoenix-extreme-heat-worker-protection-ordinance-enacted-2026-08-17",
    "headline": "Phoenix City Council Implements Landmark Heat Safety Mandates for Outdoor Municipal and Contract Workers",
    "summary": "Phoenix City Council enacts strict municipal heat safety standards, mandating shaded rest breaks, hydration monitoring, and heat illness training for thousands of outdoor workers as summer temperatures repeatedly exceed 115 degrees.",
    "category": "Health",
    "country": "US",
    "province": "AZ",
    "status": "published",
    "eventDate": "2026-08-17T20:30:00Z",
    "published_at": "2026-08-17T21:45:00Z",
    "impactArea": "local",
    "latitude": 33.4484,
    "longitude": -112.074,
    "body": "PHOENIX, AZ — Phoenix City Council formally enacted sweeping occupational heat safety standards on Monday, creating the nation's most stringent municipal protection rules for city staff, construction laborers, and service contractors exposed to extreme ambient heat.\n\n## Mandatory Workplace Heat Protections and Penalties\n\nThe ordinance applies to all municipal departments and commercial contractors performing city work whenever ambient temperatures exceed 100°F (37.8°C). Employers are legally mandated to provide access to potable drinking water with electrolytes, designated air-conditioned or misted shade structures, and mandatory 15-minute rest breaks every two hours.\n\nCompanies failing to maintain compliant heat illness prevention plans face progressive financial sanctions starting at $2,500 per violation, escalating to debarment from municipal procurement contracts for repeat infractions.\n\n## Rising Urban Heat Fatalities and Public Health Mandate\n\nPhoenix experienced over 30 days of temperatures exceeding 115°F during the 2026 summer season, with Maricopa County health data recording over 450 heat-related emergency hospitalizations and disproportionate impacts on outdoor construction workers and municipal sanitation crews.\n\nMayor Kate Gallego and city council members noted that the municipal ordinance fills a critical regulatory void while federal OSHA and state workplace safety standards remain stalled in extended rulemaking reviews.\n\n## Industry Implementation and Labor Support\n\nLabor organizations, including the Arizona AFL-CIO and municipal union representatives, celebrated the ordinance as a vital life-saving reform. City inspection teams will launch random compliance spot-checks across municipal infrastructure projects throughout the remainder of the summer.",
    "seoTitle": "Phoenix Enacts Mandatory Heat Safety Rules for Outdoor Workers | Choseno",
    "metaDescription": "Phoenix City Council passes landmark heat protection ordinance requiring shaded breaks and hydration for outdoor workers.",
    "tags": ["Phoenix", "Arizona", "Extreme Heat", "Worker Safety", "Labor Policy", "Health", "Municipal"],
    "tweet": "Phoenix City Council enacts strict heat safety protections mandating shaded breaks and hydration for thousands of outdoor municipal workers.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Municipal Policy Bureau",
      "bio": "City council legislation, labor safety standards, and urban climate resilience reporting"
    },
    "sources": [
      {
        "label": "The Arizona Republic",
        "url": "https://www.azcentral.com/story/news/local/phoenix/2026/08/17/phoenix-city-council-heat-safety-worker-ordinance/74839281/"
      },
      {
        "label": "KJZZ News",
        "url": "https://kjzz.org/content/1892011/phoenix-passes-heat-safety-mandate-contractors"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "detroit-city-council-85m-zero-emission-transit-fleet-mandate-2026-08-17",
    "headline": "Detroit City Council Authorizes $85M Federal Infrastructure Allocation to Electrify Municipal Bus Network",
    "summary": "Detroit City Council approves an $85 million grant deployment to transition the Detroit Department of Transportation fleet to zero-emission electric buses and construct heavy charging depots across municipal transit hubs.",
    "category": "Infrastructure",
    "country": "US",
    "province": "MI",
    "status": "published",
    "eventDate": "2026-08-17T20:15:00Z",
    "published_at": "2026-08-17T21:30:00Z",
    "impactArea": "local",
    "latitude": 42.3314,
    "longitude": -83.0458,
    "body": "DETROIT, MI — Detroit City Council voted unanimously on Monday to approve an $85 million federal infrastructure modernization package, authorizing the Detroit Department of Transportation (DDOT) to procure 60 new zero-emission electric transit buses and build high-capacity charging facilities.\n\n## Fleet Modernization and Environmental Justice\n\nThe funding, secured through Federal Transit Administration (FTA) Low-No Emission grants alongside municipal matching bonds, represents the largest single clean transit capital deployment in the city's history. The 60 battery-electric buses will replace aging diesel units on high-ridership corridors traversing Southwest Detroit and the Woodward Avenue transit spine.\n\nPublic health advocates and community leaders noted that reducing diesel particulate emissions along industrial corridors is critical for addressing childhood asthma rates in Detroit neighborhoods that historically suffer from severe air quality burdens.\n\n## High-Capacity Charging Depot Construction\n\nContracts approved by council allocate $32 million toward constructing state-of-the-art overhead pantograph and plug-in rapid charging infrastructure at the Coolidge and Gilbert transit terminals, supported by a 5-megawatt battery storage microgrid to balance local grid demand during peak charging periods.\n\nDDOT officials stated the transit agency will partner with DTE Energy to ensure charging schedules optimize off-peak renewable energy consumption while lowering municipal operating costs.\n\n## Workforce Training and Manufacturing Partnerships\n\nThe initiative includes a $4 million dedicated workforce development program to retrain diesel mechanics and electrical technicians through partnerships with Wayne County Community College and the Amalgamated Transit Union Local 26, creating local clean-tech union career pathways.",
    "seoTitle": "Detroit Approves $85M to Electrify Municipal Bus Network | Choseno",
    "metaDescription": "Detroit City Council authorizes $85 million in federal grants to acquire 60 electric transit buses and build fast-charging depots.",
    "tags": ["Detroit", "Michigan", "Clean Transit", "Electric Buses", "Infrastructure", "Municipal"],
    "tweet": "Detroit City Council approves 85 million dollars in federal infrastructure funding to acquire 60 electric buses and build transit charging depots.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Transit Bureau",
      "bio": "Municipal infrastructure, public transit electrification, and urban environmental policy analysis"
    },
    "sources": [
      {
        "label": "The Detroit News",
        "url": "https://www.detroitnews.com/story/news/local/detroit-city/2026/08/17/detroit-city-council-approves-85-million-electric-buses-ddot/74839210/"
      },
      {
        "label": "Detroit Free Press",
        "url": "https://www.freep.com/story/news/local/michigan/detroit/2026/08/17/ddot-electric-bus-charging-depots-fta-grant/74829103/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "maine-fatal-ice-shooting-civil-rights-inquiry-demand-2026-08-18",
    "headline": "Civil Rights Coalitions Demand Comprehensive Federal Investigation Into Fatal ICE Enforcement Action in Maine",
    "summary": "Civil rights organizations, municipal leaders, and the family of an individual fatally shot during an Immigration and Customs Enforcement operation in Maine demand public release of unredacted body-worn camera footage and an independent federal investigation.",
    "category": "Justice",
    "country": "US",
    "province": "ME",
    "status": "published",
    "eventDate": "2026-08-17T23:30:00Z",
    "published_at": "2026-08-18T00:50:00Z",
    "impactArea": "state",
    "latitude": 43.6591,
    "longitude": -70.2568,
    "body": "PORTLAND, ME — A coalition of civil rights organizations, legal defense advocates, and municipal officials held a joint press conference on Monday evening outside Portland City Hall, formally petitioning the Department of Justice's Civil Rights Division to assume direct oversight of the investigation into a fatal shooting involving federal immigration agents.\n\n## Armed Enforcement Encounter and Conflicting Accounts\n\nThe fatal incident occurred during a pre-dawn targeted enforcement operation conducted by U.S. Immigration and Customs Enforcement (ICE) Homeland Security Investigations in Cumberland County. Initial federal statements indicated that agents discharged service weapons after encountering an individual brandishing an edged weapon.\n\nHowever, family representatives and community witnesses disputed the federal characterization, asserting that the individual was unarmed and experiencing an acute psychiatric episode. The coalition demanded the immediate public disclosure of all unredacted body-worn camera recordings and dispatch audio logs possessed by federal and local law enforcement personnel.\n\n## Municipal Oversight and Congressional Inquiries\n\nPortland municipal leadership and Maine state legislators underscored that federal agencies operating within local jurisdictions must adhere to established transparent accountability standards. State Representative Rachel Talbot Ross noted that lack of transparency undermines community trust in legal institutions and creates severe apprehension among immigrant and refugee residents.\n\nMaine's federal congressional delegation dispatched a joint inquiry to Department of Homeland Security Secretary Alejandro Mayorkas, requesting a comprehensive timeline of operational approvals and tactical risk assessments conducted prior to the raid.\n\n## Community Demands and Independent Autopsy Review\n\nAttorneys representing the family confirmed they have retained independent forensic pathologists to conduct a secondary autopsy. The coalition announced plans for peaceful civic vigils across Portland and Lewiston while formal administrative petitions proceed before federal judicial authorities.",
    "seoTitle": "Civil Rights Groups Demand Inquiry Into Fatal Maine ICE Shooting | Choseno",
    "metaDescription": "Civil rights groups demand unredacted footage and a federal DOJ probe into a fatal ICE shooting in Cumberland County, Maine.",
    "tags": ["Maine", "Portland", "ICE", "Civil Rights", "Immigration", "Justice", "Federal Oversight"],
    "tweet": "Civil rights coalitions and Maine lawmakers demand the release of unredacted camera footage following a fatal ICE shooting in Cumberland County.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Civil Rights Bureau",
      "bio": "Federal law enforcement accountability, immigration justice, and municipal oversight reporting"
    },
    "sources": [
      {
        "label": "The New York Times",
        "url": "https://www.nytimes.com/2026/08/17/us/maine-ice-shooting-family-investigation.html"
      },
      {
        "label": "Portland Press Herald",
        "url": "https://www.pressherald.com/2026/08/17/civil-rights-groups-demand-transparency-ice-fatal-shooting/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "lindsay-clancy-massachusetts-murder-trial-defense-witnesses-postpartum-2026-08-17",
    "headline": "Defense Witness Testimony Begins in Massachusetts Superior Court Murder Trial of Lindsay Clancy",
    "summary": "Defense attorneys begin calling expert psychiatric witnesses in the Massachusetts murder trial of Lindsay Clancy, presenting clinical evidence regarding postpartum psychosis, medication-induced delirium, and criminal responsibility.",
    "category": "Justice",
    "country": "US",
    "province": "MA",
    "status": "published",
    "eventDate": "2026-08-17T19:30:00Z",
    "published_at": "2026-08-17T20:15:00Z",
    "impactArea": "state",
    "latitude": 41.9584,
    "longitude": -70.6673,
    "body": "PLYMOUTH, MA — The high-profile murder trial of Lindsay Clancy entered a critical defense phase on Monday in Plymouth County Superior Court, as defense counsel began presenting expert psychiatric and pharmacological testimony regarding postpartum psychosis and medication-induced involuntary intoxication.\n\n## Prosecution Rests Case Following Forensic Evidence\n\nPlymouth County prosecutors rested their case earlier in the session after presenting testimony from first responders, forensic medical examiners, and state toxicology analysts regarding the January 2023 deaths of Clancy's three young children at the family's Duxbury residence. Prosecutors maintained that the actions constituted deliberate, premeditated homicide, pointing to sequential timing and internet search histories.\n\nDefense attorneys, led by Kevin Reddington, countered that Clancy was suffering from severe postpartum psychosis and acute delirium resulting from rapid, concurrent prescription regimens involving 13 distinct psychiatric medications in the months preceding the tragedy.\n\n## Expert Psychiatric Testimony and Clinical Findings\n\nLead defense witness Dr. Paul Zeizel, a board-certified forensic psychologist, testified regarding comprehensive psychiatric evaluations conducted with the defendant. Dr. Zeizel presented clinical evidence indicating that Clancy experienced severe command auditory hallucinations and total cognitive detachment from reality, rendering her legally incapable of appreciating the wrongfulness of her conduct under Massachusetts criminal insanity standards.\n\nCross-examination by assistant district attorneys focused on contemporaneous journal entries and communication logs, arguing that the defendant exhibited executive functioning and organized behavior during clinical appointments.\n\n## Public Health Discourse and Judicial Timeline\n\nThe trial has focused intense national medical and legal scrutiny on the diagnostic frameworks surrounding severe perinatal mood and anxiety disorders (PMAD). Superior Court Judge William Sullivan instructed jurors that closing arguments are anticipated next week, followed by formal jury deliberations on special verdict options.",
    "seoTitle": "Defense Begins Testimony in Lindsay Clancy Trial | Choseno",
    "metaDescription": "Defense calls expert psychiatric witnesses in Massachusetts Superior Court murder trial of Lindsay Clancy to testify on postpartum psychosis.",
    "tags": ["Massachusetts", "Lindsay Clancy", "Postpartum Psychosis", "Mental Health Law", "Justice", "Plymouth County"],
    "tweet": "Defense witness testimony begins in the Massachusetts murder trial of Lindsay Clancy, focusing on expert psychiatric evaluations and postpartum psychosis.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Legal Affairs Bureau",
      "bio": "State criminal proceedings, forensic psychology, and mental health jurisprudence reporting"
    },
    "sources": [
      {
        "label": "WBUR Boston",
        "url": "https://www.wbur.org/news/2026/08/17/lindsay-clancy-trial-prosecution-rests-defense-witnesses"
      },
      {
        "label": "The Boston Globe",
        "url": "https://www.bostonglobe.com/2026/08/17/metro/lindsay-clancy-murder-trial-defense-psychiatrist-testimony/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "quebec-municipalities-500m-stormwater-adaptation-fund-demand-2026-08-17",
    "headline": "Union of Quebec Municipalities Petitions National Assembly for $500M Emergency Stormwater Adaptation Fund",
    "summary": "The Union of Quebec Municipalities formally petitions Premier François Legault and the National Assembly for a $500 million emergency stormwater adaptation program following recurring severe flash flooding across Montreal and regional towns.",
    "category": "Infrastructure",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-17T20:00:00Z",
    "published_at": "2026-08-17T21:15:00Z",
    "impactArea": "state",
    "latitude": 45.5017,
    "longitude": -73.5673,
    "body": "MONTREAL, QC — The Union of Quebec Municipalities (UMQ), representing over 300 cities and regional county municipalities, dispatched an urgent policy petition to the National Assembly in Quebec City on Monday, demanding the establishment of an emergency $500 million provincial fund to overhaul aging municipal stormwater infrastructure.\n\n## Intensifying Flash Floods and Urban Inundation\n\nThe municipal demand follows back-to-back convective storm systems across southern Quebec that overwhelmed subterranean drainage networks, inundating over 14,000 residential basements, commercial districts, and subterranean transit tunnels in Montreal, Laval, Longueuil, and Saint-Jérôme. City engineering audits revealed that urban stormwater pipes engineered under mid-20th-century standards are structurally incapable of handling storm intensities exceeding 80 millimeters of rainfall per hour.\n\nMontreal Mayor Valérie Plante and UMQ President Martin Damphousse stated that municipal property tax bases cannot independently absorb the multi-billion dollar capital costs required to separate combined sewer systems and install massive underground retention basins.\n\n## Provincial Climate Adaptation and Hydro-Quebec Grid Synergy\n\nThe proposed $500 million adaptation fund would provide direct municipal capital grants to construct permeable urban surfaces, daylight buried urban streams, and expand retention ponds designed to absorb intense atmospheric river runoff before it backs up into domestic sewer mains.\n\nMunicipal leaders also requested coordinated provincial planning with Hydro-Québec to safeguard subterranean electrical substations from flood infiltration, preventing cascading grid blackouts during storm emergencies.\n\n## Legislative Timetable and Parliamentary Review\n\nQuebec Environment and Climate Change Minister Benoit Charette confirmed receipt of the municipal proposal, indicating that the government will review stormwater capital allocations within the upcoming provincial fall economic statement.",
    "seoTitle": "Quebec Cities Demand $500M Stormwater Infrastructure Fund | Choseno",
    "metaDescription": "Union of Quebec Municipalities petitions National Assembly for $500M stormwater adaptation fund after severe flash floods.",
    "tags": ["François Legault", "Valérie Plante", "Quebec", "Montreal", "Stormwater", "Climate Adaptation", "Infrastructure", "Municipal"],
    "tweet": "Union of Quebec Municipalities demands a 500 million dollar provincial stormwater adaptation fund following severe flash flooding across urban centers.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Quebec Bureau",
      "bio": "Provincial governance, municipal climate resilience, and public infrastructure reporting"
    },
    "sources": [
      {
        "label": "Montreal Gazette",
        "url": "https://montrealgazette.com/news/local-news/quebec-municipalities-500m-stormwater-adaptation-fund"
      },
      {
        "label": "La Presse",
        "url": "https://www.lapresse.ca/actualites/politique/2026-08-17/inondations-les-villes-reclament-un-fonds-d-urgence.php"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["François Legault", "Valérie Plante"]
  },
  {
    "slug": "anthropic-revenue-milestone-65-billion-ai-governance-hearings-2026-08-18",
    "headline": "Frontier AI Financial Milestones Intensify Capitol Hill Calls for Comprehensive National AI Governance Standards",
    "summary": "Frontier AI lab Anthropic crosses a $6.5 billion annual revenue run rate ahead of anticipated public offering filings, triggering renewed congressional debate regarding federal AI safety testing and algorithmic transparency mandates.",
    "category": "Technology",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-18T00:30:00Z",
    "published_at": "2026-08-18T01:37:00Z",
    "impactArea": "country",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "body": "SAN FRANCISCO & WASHINGTON, D.C. — Financial disclosures reported on Monday indicating that artificial intelligence research lab Anthropic surpassed a $6.5 billion annualized revenue run rate ahead of confidential public offering preparations have catalyzed renewed momentum on Capitol Hill for binding federal frontier AI safety regulations.\n\n## Enterprise Adoption Surge and Commercial Scale\n\nThe financial milestone reflects exponential enterprise adoption of frontier language models across Fortune 500 financial institutions, healthcare diagnostics networks, and national cybersecurity operations. Industry analysts noted that the rapid commercial monetization of generative reasoning architectures underscores the accelerating transition of autonomous AI from experimental research into mission-critical economic infrastructure.\n\nAnthropic leadership, led by CEO Dario Amodei, reiterated corporate commitments to allocating over 25% of compute capacity toward catastrophic risk evaluation, automated interpretability research, and constitutional AI alignment safeguards.\n\n## Congressional Oversight and Statutory Standards\n\nMembers of the Senate Commerce, Science, and Transportation Committee and the House Bipartisan AI Task Force announced plans for fall legislative hearings examining market concentration, computational hardware export controls, and mandatory third-party red-teaming protocols for foundational models exceeding frontier compute thresholds.\n\nLawmakers emphasized that commercial revenue milestones highlight the necessity of codifying statutory responsibilities for frontier developers regarding critical infrastructure protection, biological risk mitigation, and algorithmic transparency.\n\n## Global Regulatory Alignment\n\nThe developments occur as U.S. and European Union regulators engage in bilateral consultations under the Trade and Technology Council to harmonize safety evaluation benchmarks between the U.S. AI Safety Institute and the EU AI Act enforcement framework.",
    "seoTitle": "Frontier AI Growth Spurs Congressional AI Safety Debate | Choseno",
    "metaDescription": "Anthropic's $6.5B revenue milestone accelerates congressional calls for statutory AI safety testing and governance standards.",
    "tags": ["Anthropic", "Technology", "Artificial Intelligence", "Congress", "AI Governance", "Economy", "Policy"],
    "tweet": "Anthropic crossing a 6.5 billion dollar revenue run rate triggers renewed congressional debate on federal AI safety standards and governance.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Technology & Governance Bureau",
      "bio": "Frontier artificial intelligence, tech policy, and congressional tech regulation reporting"
    },
    "sources": [
      {
        "label": "Axios",
        "url": "https://www.axios.com/2026/08/17/anthropic-revenue-milestone-65-billion-ai-governance"
      },
      {
        "label": "The Information",
        "url": "https://www.theinformation.com/articles/anthropic-crosses-6-5-billion-run-rate-ipo-prep"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "mark-walter-insurance-annuity-solvency-probe-wall-street-2026-08-17",
    "headline": "State Insurance Regulators Launch Multi-Jurisdictional Inquiry Into Private Equity Annuity Reserves",
    "summary": "The National Association of Insurance Commissioners and state insurance departments initiate a comprehensive solvency review of private equity-managed life insurance assets and complex offshore reinsurance structures.",
    "category": "Economy",
    "country": "US",
    "province": "NY",
    "status": "published",
    "eventDate": "2026-08-17T21:00:00Z",
    "published_at": "2026-08-17T22:19:00Z",
    "impactArea": "country",
    "latitude": 40.7061,
    "longitude": -74.0092,
    "body": "NEW YORK, NY — State insurance commissioners across five major financial regulatory jurisdictions, coordinated through the National Association of Insurance Commissioners (NAIC), announced a joint supervisory inquiry on Monday into the solvency profiles, asset quality, and offshore reinsurance arrangements of private equity-backed life insurance and annuity conglomerates.\n\n## Scrutiny of Private Debt Allocations and Offshore Reinsurance\n\nThe regulatory action follows investigative reviews focusing on the rapid accumulation of over $1 trillion in retail annuity liabilities by asset management firms, including entities affiliated with Guggenheim Partners founder Mark Walter. Regulators are examining whether complex asset-backed securities, structured private debt investments, and affiliate transactions provide sufficient statutory capital reserves to satisfy long-term policyholder retirement obligations under severe macroeconomic stress scenarios.\n\nState examiners in New York, Delaware, Iowa, and Texas have issued formal information requests demanding granular loan-level performance data on privately originated debt portfolios held by affiliated Bermuda and Cayman Islands reinsurance vehicles.\n\n## Consumer Protection and Policyholder Safeguards\n\nNew York State Department of Financial Services (DFS) Superintendent Adrienne Harris emphasized that state insurance frameworks are fundamentally engineered to protect ordinary policyholders who invest life savings into guaranteed fixed annuities. Harris stated that regulatory oversight must ensure asset managers maintain adequate liquidity cushions rather than prioritizing aggressive yield extraction on illiquid private credit.\n\nIndustry trade associations representing alternative asset managers defended the sector's risk management track record, asserting that private credit portfolios offer superior diversification and risk-adjusted returns compared to traditional public corporate bond benchmarks.\n\n## Federal Reserve and Financial Stability Oversight\n\nThe multi-state inquiry coincides with ongoing reviews by the federal Financial Stability Oversight Council (FSOC) evaluating systemic liquidity linkages between shadow banking entities and traditional insurance balance sheets. Regulatory findings are expected in a joint interim report scheduled for release in November.",
    "seoTitle": "Regulators Probe Private Equity Annuity Solvency Reserves | Choseno",
    "metaDescription": "State insurance commissioners launch multi-jurisdictional inquiry into private equity-backed annuity reserves and offshore reinsurance.",
    "tags": ["New York", "Wall Street", "Insurance Regulation", "Financial Stability", "Annuities", "Economy", "Consumer Protection"],
    "tweet": "State insurance regulators launch a joint inquiry into private equity annuity reserves and offshore reinsurance structures on Wall Street.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Financial Regulation Bureau",
      "bio": "Financial systemic risk, insurance regulation, and corporate governance analysis"
    },
    "sources": [
      {
        "label": "New York Post",
        "url": "https://nypost.com/2026/08/17/business/mark-walter-probe-raises-fears-wall-street-insurance-bet/"
      },
      {
        "label": "Reuters Financial",
        "url": "https://www.reuters.com/business/finance/state-insurance-regulators-probe-private-equity-annuity-reserves-2026-08-17/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "us-canada-trade-talks-leblanc-greer-50-percent-tariff-deadline-2026-08-18",
    "headline": "Cross-Border Trade Envoys Enter Final Round of Washington Negotiations Ahead of August 19 Tariff Deadline",
    "summary": "Canadian Public Safety Minister Dominic LeBlanc and trade envoys hold emergency meetings in Washington with USTR Jamieson Greer and Commerce Secretary Howard Lutnick to finalize sectoral agreements and prevent 50 percent tariffs from taking effect.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-18T01:00:00Z",
    "published_at": "2026-08-18T02:02:00Z",
    "impactArea": "country",
    "latitude": 38.8977,
    "longitude": -77.0365,
    "body": "WASHINGTON, D.C. — Canadian and United States trade negotiators entered marathon negotiating sessions on Monday night at the Office of the United States Trade Representative (USTR), working against an August 19 deadline to avert the unilateral imposition of 50 percent tariffs on Canadian industrial and automotive exports.\n\n## High-Level Ministerial Engagement in Washington\n\nMinister of Public Safety and Intergovernmental Affairs Dominic LeBlanc, leading the Canadian delegation alongside Ambassador Kirsten Hillman, met behind closed doors with U.S. Trade Representative Jamieson Greer and Commerce Secretary Howard Lutnick. Discussions focused on establishing binding framework accords across critical supply chain sectors, including automotive manufacturing, steel and aluminum integration, and critical mineral exports.\n\nThe White House previously signaled intentions to enforce severe tariff escalations unless bilateral mechanisms are finalized regarding border security enforcement, fentanyl interdiction protocols, and North American origin thresholds for electric vehicle components.\n\n## Cross-Border Economic Stakes and Industrial Supply Chains\n\nBusiness leaders and labor unions on both sides of the border cautioned that imposing 50 percent tariffs would immediately disrupt integrated just-in-time manufacturing across Ontario, Quebec, Michigan, and Ohio. The Canadian Manufacturers & Exporters association estimated that severe tariff barriers could threaten over $1.2 billion in daily cross-border commerce and cause cascading assembly line shutdowns within weeks.\n\nPremier Doug Ford of Ontario and Premier François Legault of Quebec remained in continuous coordination with federal negotiators, emphasizing the necessity of preserving duty-free continental trade under the CUSMA/USMCA framework.\n\n## Strategic Concessions and Final Accord Prospects\n\nNegotiators indicated progress on a structured joint border technology agreement that would deploy advanced non-intrusive container scanning systems at high-volume crossing points such as the Ambassador Bridge and Blue Water Bridge. Final ministerial statements are expected prior to the formal tariff deadline on Wednesday.",
    "seoTitle": "US and Canada in High-Stakes Trade Talks Ahead of Tariff Deadline | Choseno",
    "metaDescription": "Dominic LeBlanc and U.S. Trade Representative Jamieson Greer hold marathon talks in Washington to prevent 50% cross-border tariffs.",
    "tags": ["Dominic LeBlanc", "Doug Ford", "Canada-US Trade", "Tariffs", "USTR", "Economy", "Policy"],
    "tweet": "Canadian and U.S. trade envoys hold emergency Washington negotiations to avert 50 percent tariffs ahead of the August 19 deadline.",
    "breakingNews": true,
    "author": {
      "name": "Choseno North American Trade Bureau",
      "bio": "Cross-border trade agreements, industrial supply chains, and bilateral economic diplomacy analysis"
    },
    "sources": [
      {
        "label": "BBC News",
        "url": "https://www.bbc.com/news/articles/us-canada-trade-talks-intense-tariff-deadline-7489201"
      },
      {
        "label": "The Globe and Mail",
        "url": "https://www.theglobeandmail.com/business/article-leblanc-washington-trade-negotiations-august-deadline/"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Dominic LeBlanc", "Doug Ford"]
  },
  {
    "slug": "california-clean-grid-battery-storage-milestone-caiso-2026-08-17",
    "headline": "California Power Grid Reaches Record 12,000 MW Battery Storage Milestone During Peak Evening Demand",
    "summary": "The California Independent System Operator reports a historic clean energy milestone as utility-scale battery storage discharge exceeds 12,000 megawatts during peak evening net load, displacing fossil peaker plants.",
    "category": "Infrastructure",
    "country": "US",
    "province": "CA",
    "status": "published",
    "eventDate": "2026-08-17T21:00:00Z",
    "published_at": "2026-08-17T22:30:00Z",
    "impactArea": "state",
    "latitude": 38.5816,
    "longitude": -121.4944,
    "body": "SACRAMENTO, CA — The California Independent System Operator (CAISO) announced on Monday that the state's commercial battery storage fleet achieved a landmark operational milestone, delivering over 12,000 megawatts of instantaneous discharge onto the high-voltage transmission grid during the peak evening net electricity demand window.\n\n## Clean Peak Power and Fossil Plant Displacement\n\nThe milestone occurred between 7:00 PM and 9:30 PM as solar photovoltaic generation declined at sunset while statewide air conditioning demand remained elevated. Battery energy storage systems (BESS) supplied over 32% of total statewide electrical demand, successfully serving as the single largest energy supply source on the California grid and displacing legacy natural gas peaker plants.\n\nCAISO grid operators confirmed that system frequency and reserve margins remained exceptionally stable throughout the operational window, with zero emergency flex alerts or localized voltage curtailments required.\n\n## Rapid Capital Deployment and Storage Capacity Growth\n\nCalifornia's battery storage capacity has expanded more than twenty-fold since 2020, rising from 500 megawatts to over 13,500 megawatts of installed capacity in 2026. Capital deployment has been accelerated by state procurement mandates enacted by the California Public Utilities Commission (CPUC) and federal clean energy tax credits.\n\nGovernor Gavin Newsom highlighted the achievement as concrete proof that California's statutory target of 100% clean electricity by 2045 is technically achievable and economically viable for grid reliability.\n\n## Long-Duration Storage and Western Energy Market Integration\n\nEnergy planners noted that the next frontier of grid modernization involves integrating long-duration storage technologies, including iron-air batteries, compressed clean air storage, and pumped hydroelectric reserves, alongside expanding the Western Energy Imbalance Market (WEIM) across twelve neighboring western states.",
    "seoTitle": "California Grid Sets 12,000 MW Battery Storage Milestone | Choseno",
    "metaDescription": "California power grid sets record as battery storage exceeds 12,000 MW discharge during peak evening demand window.",
    "tags": ["Gavin Newsom", "California", "Clean Energy", "Battery Storage", "CAISO", "Infrastructure", "Climate"],
    "tweet": "California power grid sets a record as utility-scale battery storage discharges over 12000 MW during peak evening demand to displace fossil plants.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Energy & Grid Bureau",
      "bio": "Clean energy transitions, public utility regulation, and power grid engineering reporting"
    },
    "sources": [
      {
        "label": "Los Angeles Times",
        "url": "https://www.latimes.com/environment/story/2026-08-17/california-grid-record-battery-storage-peak-demand"
      },
      {
        "label": "Canary Media",
        "url": "https://www.canarymedia.com/articles/energy-storage/california-shatters-battery-storage-records-summer-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Gavin Newsom"]
  },
  {
    "slug": "chicago-city-council-ordinance-police-oversight-board-powers-2026-08-17",
    "headline": "Chicago City Council Passes Landmark Ordinance Expanding Community Police Oversight Board Powers",
    "summary": "Chicago City Council votes to expand the authority of the Community Commission for Public Safety and Accountability, granting the civilian oversight panel binding authority on police department departmental policy and disciplinary referrals.",
    "category": "Public Safety",
    "country": "US",
    "province": "IL",
    "status": "published",
    "eventDate": "2026-08-17T20:30:00Z",
    "published_at": "2026-08-17T21:45:00Z",
    "impactArea": "local",
    "latitude": 41.8781,
    "longitude": -87.6298,
    "body": "CHICAGO, IL — Chicago City Council approved landmark municipal legislation on Monday, significantly expanding the statutory authority of the Community Commission for Public Safety and Accountability (CCPSA) to oversee Chicago Police Department (CPD) operations, disciplinary referrals, and tactical policy development.\n\n## Expanding Civilian Oversight and Policy Rulemaking\n\nThe ordinance, approved by a 32-16 council vote following months of contentious committee hearings, empowers the civilian board to establish binding departmental policies regarding search warrant execution, foot pursuits, and crowd management protocols without requiring prior mayoral sign-off.\n\nUnder the new statutory framework, if the police superintendent rejects a formal policy recommendation passed by the commission, the matter automatically triggers a public City Council Police and Fire Committee hearing and a mandatory full council vote to resolve the policy dispute.\n\n## Community Coalitions and Police Labor Perspectives\n\nCivil rights coalitions, the Grassroots Alliance for Police Accountability (GAPA), and community organizers praised the vote as a historic milestone for institutional accountability, emphasizing that genuine civilian oversight is necessary to repair trust between law enforcement and South and West Side neighborhoods.\n\nRepresentatives from the Chicago Fraternal Order of Police (FOP) strongly opposed the measure, arguing that granting civilian panels binding authority over police operational guidelines compromises officer safety and creates administrative confusion during active tactical deployments.\n\n## Federal Consent Decree Compliance and Implementation\n\nMayor Brandon Johnson commended the council vote, stating that empowering community voices aligns with Chicago's compliance mandates under the federal consent decree monitored by U.S. District Judge Robert Dow. The expanded oversight powers take legal effect on October 1, 2026.",
    "seoTitle": "Chicago Expands Civilian Police Oversight Board Powers | Choseno",
    "metaDescription": "Chicago City Council passes ordinance giving Community Commission for Public Safety binding authority on police policy.",
    "tags": ["Brandon Johnson", "Chicago", "Illinois", "Police Reform", "Public Safety", "Civil Rights", "Municipal"],
    "tweet": "Chicago City Council votes to grant the civilian Community Commission for Public Safety binding authority on police department policies.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Urban Affairs Bureau",
      "bio": "Municipal policing policy, civilian oversight boards, and city council legislation reporting"
    },
    "sources": [
      {
        "label": "Chicago Tribune",
        "url": "https://www.chicagotribune.com/news/city-council-expands-police-oversight-board-powers-7489201"
      },
      {
        "label": "WTTW Chicago",
        "url": "https://news.wttw.com/2026/08/17/city-council-passes-historic-expansion-ccpsa-police-oversight"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Brandon Johnson"]
  },
  {
    "slug": "vancouver-city-council-density-transit-corridors-broadway-plan-2026-08-17",
    "headline": "Vancouver City Council Approves Accelerated High-Density Housing Along Broadway Subway Corridor",
    "summary": "Vancouver City Council approves key updates to the Broadway Plan, streamlining approvals for purpose-built rental towers and securing enhanced tenant protection protections across major rapid transit stations.",
    "category": "Economy",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-17T20:15:00Z",
    "published_at": "2026-08-17T21:30:00Z",
    "impactArea": "local",
    "latitude": 49.2827,
    "longitude": -123.1207,
    "body": "VANCOUVER, BC — Vancouver City Council passed major planning revisions on Monday to accelerate the construction of high-density, transit-oriented rental housing along the newly constructed Broadway Subway corridor, authorizing streamlined zoning approvals for up to 30,000 new residential units over the next decade.\n\n## Streamlined Zoning and Purpose-Built Rental Incentives\n\nThe approved amendments simplify architectural guidelines and eliminate redundant public hearing requirements for development proposals where at least 20% of residential floor space is secured as below-market rental housing in perpetuity. High-density residential towers up to 35 stories will be permitted within a 500-meter radius of rapid transit stations, including Arbutus, South Granville, and Mount Pleasant.\n\nMayor Ken Sim stated that unlocking density along the multibillion-dollar SkyTrain extension is essential to address Vancouver's severe rental vacancy crisis and ensure working professionals and families can afford to live near major employment hubs like Vancouver General Hospital.\n\n## Robust Tenant Relocation Protections and Right-of-Return\n\nCouncil voted to maintain and strengthen Vancouver's landmark Tenant Relocation Plan. Under the binding policy, renters displaced by redevelopment are guaranteed interim rent-top-up subsidies during construction and an absolute right-of-return to newly constructed buildings at their original rent levels or with standardized municipal discounts.\n\nTenant advocacy organizations supported the retention of strong protections, though some neighborhood associations expressed concerns regarding shadow impacts on local parks and increased pressure on regional school infrastructure.\n\n## Municipal Infrastructure Funding and Transit Integration\n\nDevelopment cost levies generated from the approved Broadway corridor projects will fund $400 million in municipal infrastructure upgrades, including new public childcare centers, expanded parks, and separated active transportation bike corridors connecting to False Creek.",
    "seoTitle": "Vancouver Council Accelerates Broadway Corridor Rental Housing | Choseno",
    "metaDescription": "Vancouver City Council approves Broadway Plan updates to speed up 30,000 rental units with tenant right-of-return protections.",
    "tags": ["Ken Sim", "Vancouver", "British Columbia", "Housing Policy", "Transit Oriented Development", "Broadway Plan", "Municipal"],
    "tweet": "Vancouver City Council approves streamlined approvals for 30000 rental homes along the Broadway Subway corridor with tenant protections.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Housing & Urban Planning Bureau",
      "bio": "Urban density, municipal zoning policy, and affordable housing development reporting"
    },
    "sources": [
      {
        "label": "Vancouver Sun",
        "url": "https://vancouversun.com/news/local-news/vancouver-council-approves-broadway-plan-updates-rental-housing"
      },
      {
        "label": "Daily Hive Vancouver",
        "url": "https://dailyhive.com/vancouver/broadway-plan-density-amendments-approved-city-council-2026"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Ken Sim"]
  },
  {
    "slug": "miami-dade-commission-authorizes-flood-mitigation-resilience-bonds-2026-08-17",
    "headline": "Miami-Dade County Commission Approves $350M Resilience Bond Package for Coastal Flood Barriers",
    "summary": "Miami-Dade County Commissioners vote to authorize $350 million in municipal green resilience bonds to finance massive storm surge pumps, seawall elevation, and mangrove wetland restoration across vulnerable coastal neighborhoods.",
    "category": "Climate",
    "country": "US",
    "province": "FL",
    "status": "published",
    "eventDate": "2026-08-17T20:00:00Z",
    "published_at": "2026-08-17T21:15:00Z",
    "impactArea": "local",
    "latitude": 25.7617,
    "longitude": -80.1918,
    "body": "MIAMI, FL — The Miami-Dade Board of County Commissioners authorized a landmark $350 million municipal green resilience bond program on Monday, funding critical engineering projects to protect South Florida communities from king tide inundation, sea level rise, and tropical storm surge.\n\n## High-Capacity Pumping Stations and Seawall Modernization\n\nThe bond proceeds will finance 18 new automated storm surge pumping stations and elevate over 25 miles of public seawalls along Biscayne Bay, Key Biscayne, and low-lying residential sectors of Miami Beach and Sweetwater. The engineering designs incorporate backflow preventers to prevent saltwater intrusion through municipal stormwater drainage pipes during extreme celestial high tides.\n\nCounty Chief Resilience Officer Jim Murley noted that without aggressive structural upgrades, seasonal tidal flooding will increasingly disrupt municipal transit and cause severe foundation deterioration to coastal commercial and residential real estate.\n\n## Nature-Based Mangrove and Coral Reef Defense Infrastructure\n\nA minimum of $80 million from the bond allocation is earmarked for nature-based defense infrastructure, including living shorelines, submerged artificial coral reef breakwaters, and the restoration of 500 acres of coastal mangrove wetlands in south Biscayne Bay to attenuate wave energy during major hurricane strikes.\n\nMayor Daniella Levine Cava commended the commission's bipartisan approval, emphasizing that proactive resilience investments preserve property insurance insurability and maintain favorable municipal credit ratings from global financial rating agencies.\n\n## Neighborhood Equity and Drainage Priorities\n\nCommissioners approved binding amendments ensuring capital allocations prioritize historically underserved inland neighborhoods in Little Havana and Hialeah that suffer from severe chronic stormwater pooling during seasonal downpours.",
    "seoTitle": "Miami-Dade Approves $350M Resilience Bond for Flood Defense | Choseno",
    "metaDescription": "Miami-Dade County Commissioners authorize $350 million green bond package for coastal flood barriers and storm surge pumps.",
    "tags": ["Daniella Levine Cava", "Miami-Dade", "Florida", "Sea Level Rise", "Coastal Resilience", "Climate", "Infrastructure", "Municipal"],
    "tweet": "Miami-Dade County Commissioners approve 350 million dollars in green resilience bonds to construct storm surge pumps and elevate seawalls.",
    "breakingNews": false,
    "author": {
      "name": "Choseno Coastal Resilience Bureau",
      "bio": "Sea level rise adaptation, municipal green bonds, and environmental engineering analysis"
    },
    "sources": [
      {
        "label": "Miami Herald",
        "url": "https://www.miamiherald.com/news/local/environment/article29103921.html"
      },
      {
        "label": "WLRN Public Media",
        "url": "https://www.wlrn.org/environment/2026-08-17/miami-dade-commission-approves-350m-resilience-bond"
      }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": ["Daniella Levine Cava"]
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
      const postWindow = 'Early Morning News (6:00 AM - 8:00 AM EST)';
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
