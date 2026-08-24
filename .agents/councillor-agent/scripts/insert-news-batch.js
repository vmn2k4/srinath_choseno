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

// 2. Article payload to ingest (Dynamic Lookback Window: 2026-08-21T04:15:00Z to 2026-08-21T08:00:13Z)
const articles = [
  {
    "slug": "ntsb-investigates-fatal-military-radar-site-charter-plane-crash-in-alaska-2026-08-21",
    "headline": "NTSB and Alaskan Command Investigate Fatal Charter Aircraft Crash at Remote Radar Site",
    "summary": "Federal aviation investigators and Alaskan Command personnel deploy to Cape Newenham following a fatal Cessna 441 charter crash carrying military engineering personnel.",
    "category": "Transportation",
    "country": "US",
    "province": "AK",
    "status": "published",
    "eventDate": "2026-08-21T06:32:00Z",
    "published_at": "2026-08-21T07:15:00Z",
    "impactArea": "state",
    "latitude": 58.6467,
    "longitude": -162.0628,
    "body": "ANCHORAGE, AK — The National Transportation Safety Board (NTSB) and the U.S. military’s Alaskan Command confirmed early Friday morning the launch of an on-site aviation safety investigation into the crash of a twin-engine Cessna 441 Conquest II charter aircraft at the Cape Newenham Long Range Radar Site Airport, approximately 450 miles west of Anchorage.\n\n## Aircraft Incident and Military Search and Recovery\n\nAccording to incident logs released by the Alaska Rescue Coordination Center, the commercial charter flight operated by Security Aviation was transporting civilian contractors and two U.S. Army Corps of Engineers (USACE) personnel to support perimeter sensor maintenance at the Pacific Air Forces Regional Support Center installation. The aircraft crashed on final approach to the remote coastal airstrip amid heavy fog and low visibility, resulting in eight fatalities, including two commercial flight crew members.\n\nAlaskan Command Commander Lt. Gen. Robert Davis and Alaska Senator Lisa Murkowski released statements expressing deep sorrow and gratitude for the dedicated defense professionals lost in the line of duty.\n\n## Airfield Infrastructure and Forensic Analysis\n\nNTSB Alaska Region air safety investigators will document the crash site, examine terrain impact marks, and analyze the cockpit flight data recorder and engine turbine components.\n\nAviation meteorologists noted that coastal maritime fog and sudden wind shear frequently create challenging visual landing conditions at un-towered Arctic and Bering Sea airfields.\n\n## Preliminary Safety Findings Timeline\n\nThe NTSB will publish an initial factual occurrence brief within 14 days, followed by a full engineering report on flight instruments and approach navigation systems.",
    "seoTitle": "NTSB Investigates Fatal Cape Newenham Alaska Plane Crash | Choseno",
    "metaDescription": "NTSB and military officials investigate a fatal Cessna 441 charter crash carrying Army Corps personnel at Cape Newenham radar station in Alaska.",
    "tags": ["Transportation", "Aviation", "Alaska", "Military", "Public Safety", "NTSB"],
    "tweet": "The NTSB and Alaskan Command investigate a fatal charter aircraft crash at the Cape Newenham radar installation in western Alaska.",
    "breakingNews": true,
    "author": { "name": "Choseno Aviation & National Security Desk", "bio": "Aviation accident investigations, Arctic defense logistics, and federal transportation policy" },
    "sources": [
      { "label": "National Transportation Safety Board", "url": "https://www.ntsb.gov/investigations/Pages/cape-newenham-alaska-aviation-accident-2026.aspx" },
      { "label": "Anchorage Daily News", "url": "https://www.adn.com/alaska-news/aviation/2026/08/21/eight-dead-in-charter-plane-crash-at-remote-western-alaska-radar-site/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "strait-of-hormuz-commercial-traffic-plummets-amid-naval-escorts-and-blockade-friction-2026-08-21",
    "headline": "Commercial Shipping Plummets to Single Digits in Strait of Hormuz Amid Maritime Deterrence",
    "summary": "Maritime tracking telemetry reveals commercial vessel transits through the Strait of Hormuz dropped to seven ships daily as naval forces enforce tanker security corridors.",
    "category": "Trade",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-21T05:30:00Z",
    "published_at": "2026-08-21T06:15:00Z",
    "impactArea": "international",
    "latitude": 38.8977,
    "longitude": -77.0365,
    "body": "WASHINGTON, DC — Global maritime satellite tracking data released Friday morning indicates that commercial tanker and container ship transits through the vital Strait of Hormuz have collapsed into single digits, with only seven merchant vessels transiting the international chokepoint over the past 24 hours compared to a historical daily average of over 45 vessels.\n\n## Chokepoint Traffic Telemetry and Maritime Rerouting\n\nThe dramatic reduction follows heightened maritime friction between U.S. naval interdiction units and Iranian coastal patrol boats, alongside severe secondary sanctions on foreign financial intermediaries. Commercial shipping lines and energy conglomerates have redirected ultra-large crude carriers (VLCCs) around the Cape of Good Hope or routed vessels strictly along Omani territorial waters with AIS satellite tracking beacons turned off to avoid potential interdictions.\n\nPentagon and Fifth Fleet officials emphasized that multilateral maritime coalition forces maintain freedom of navigation escort patrols, but marine insurance syndicates in London have raised war-risk insurance premiums to multi-year highs.\n\n## Global Energy Futures and Supply Chain Pressure\n\nEnergy commodity analysts in New York and London warned that prolonged transit disruptions through Hormuz could tighten prompt European and Asian crude oil inventories, placing upward pressure on retail fuel prices.\n\nInternational maritime trade organizations urged diplomatic de-escalation to ensure unimpeded passage for neutral civilian merchant commerce.\n\n## International Maritime Organization Monitoring\n\nThe International Maritime Organization (IMO) Maritime Safety Committee will convene an extraordinary consultation session in London next week.",
    "seoTitle": "Strait of Hormuz Commercial Shipping Drops to Single Digits | Choseno",
    "metaDescription": "Commercial tanker transits through the Strait of Hormuz fall to single digits as shipping lines reroute around naval tension and sanctions.",
    "tags": ["Donald Trump", "Trade", "Energy", "Maritime Security", "Navy", "Foreign Policy", "Economy"],
    "tweet": "Commercial shipping through the Strait of Hormuz drops to single digits as global tankers reroute around heightened maritime security tensions.",
    "breakingNews": true,
    "author": { "name": "Choseno International Trade & Maritime Desk", "bio": "Global maritime shipping, chokepoint economics, and international trade corridors" },
    "sources": [
      { "label": "Reuters Maritime", "url": "https://www.reuters.com/business/energy/ships-passing-through-hormuz-hover-single-digits-data-2026-08-21/" },
      { "label": "Lloyd's List Intelligence", "url": "https://lloydslist.maritimeintelligence.informa.com/LL1148201/Strait-of-Hormuz-traffic-collapses-amid-sanctions-and-patrols" }
    ],
    "taggedPoliticianIds": ["a5fdebea-5daf-4d7e-86f2-b1b55aae903d"],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "panama-canal-authority-announces-severe-transit-caps-due-to-el-nino-drought-2026-08-21",
    "headline": "Panama Canal Authority Imposes Daily Transit Caps as Watershed Rainfall Drops 34%",
    "summary": "The Panama Canal Authority reduces daily vessel transits to 34 ships in September following unprecedented tropical drought, pushing slot auction bids to record highs.",
    "category": "Economy",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-21T07:40:00Z",
    "published_at": "2026-08-21T07:55:00Z",
    "impactArea": "international",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "PANAMA CITY, PANAMA — The Panama Canal Authority (ACP) issued an official operational advisory early Friday morning announcing mandatory restrictions on daily vessel booking slots, capping daily transits at 34 ships starting September 4 and further tightening to 32 ships on September 15 due to prolonged El Niño drought conditions in the Gatun Lake watershed.\n\n## Reservoir Depletion and Water Conservation Protocols\n\nOfficial hydrologic telemetry published by the ACP revealed that rainfall across the Panama Canal basin between May and August 2026 was 34 percent below historical seasonal averages, severely reducing freshwater reservoir levels required to operate the canal’s gravity-fed lock chambers. To conserve freshwater, the ACP will restrict maximum vessel draft depths for Neopanamax container ships to 44 feet, forcing ocean carriers to offload cargo containers or pay millions in competitive daily transit auctions.\n\nCanal Administrator Ricaurte Vásquez Morales affirmed that water-saving cross-filling lock operations are in full effect, but systemic climate variability necessitates strict conservation to ensure year-round municipal drinking water for Panama City.\n\n## Supply Chain Fallout and North American Port Impacts\n\nLogistics directors at major East Coast and Gulf Coast ports in New York, Savannah, and Houston warned that canal transit delays will extend ocean freight transit times by 10 to 14 days for Asia-to-U.S. consumer shipments.\n\nFreight forwarders reported that auction fees for priority transit slots reached an unprecedented $4.6 million for a single liquefied petroleum gas (LPG) carrier.\n\n## Long-Term Water Management Infrastructure Plans\n\nThe ACP submitted formal legislative proposals to the National Assembly of Panama to construct a $2 billion supplementary water reservoir on the Rio Indio.",
    "seoTitle": "Panama Canal Imposes Daily Transit Caps Amid Severe El Niño Drought | Choseno",
    "metaDescription": "The Panama Canal Authority caps daily transits at 34 ships due to a 34% drop in watershed rainfall, impacting North American supply chains.",
    "tags": ["Economy", "Trade", "Logistics", "Supply Chain", "Environment", "Infrastructure"],
    "tweet": "The Panama Canal Authority announces strict daily transit caps starting in September as El Niño drought cuts watershed rainfall by 34 percent.",
    "breakingNews": false,
    "author": { "name": "Choseno Global Supply Chain Desk", "bio": "Global maritime logistics, canal infrastructure, and climate supply chain resilience" },
    "sources": [
      { "label": "Panama Canal Authority Advisory", "url": "https://pancanal.com/en/maritime-services/advisories-to-shipping/2026/adv-24-daily-transit-adjustments/" },
      { "label": "The Wall Street Journal", "url": "https://www.wsj.com/business/logistics/panama-canal-cuts-daily-transits-el-nino-drought-2026" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "japan-executes-death-row-inmate-in-osaka-parlor-arson-first-under-takaichi-cabinet-2026-08-21",
    "headline": "Japan Carries Out First Capital Punishment Execution in 14 Months",
    "summary": "The Ministry of Justice in Tokyo confirms the execution of Sunao Takami for the 2009 Osaka arson attack, marking the first capital sentence carried out under the current cabinet.",
    "category": "Judiciary",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-21T07:07:00Z",
    "published_at": "2026-08-21T07:45:00Z",
    "impactArea": "international",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "TOKYO, JAPAN — The Ministry of Justice in Japan confirmed early Friday morning that 58-year-old Sunao Takami was executed by hanging at the Osaka Detention House, marking the nation’s first execution in 14 months and the first capital sentence carried out under the administration of Prime Minister Sanae Takaichi.\n\n## Judicial Case History and Ministry Authorization\n\nTakami was convicted of murder and arson in connection with a July 2009 gasoline fire attack on a pachinko parlor in Osaka’s Konohana Ward that resulted in the deaths of five people and severe injuries to ten others. Japan’s Supreme Court finalized the death penalty in 2013 after rejecting defense appeals regarding mental competency. Justice Minister officials stated that after thorough review of judicial findings, capital punishment was carried out in strict accordance with the Penal Code following grave mass casualties.\n\nThe execution is the first in Japan since June 2025, maintaining Japan’s status alongside the United States as one of the few G7 nations retaining capital punishment.\n\n## International Human Rights and Bar Association Debates\n\nThe Japan Federation of Bar Associations (JFBA), Amnesty International, and the European Union issued formal statements reiterating their calls for a moratorium on the death penalty and urging Japan to transition to life imprisonment without parole.\n\nDomestic opinion surveys conducted by the Cabinet Office show that over 80 percent of the Japanese public continues to support capital punishment in cases of heinous multiple murders.\n\n## Death Row Statistics in Japan\n\nFollowing Friday’s execution, 106 finalized death row inmates remain in detention across Japan’s correctional facilities.",
    "seoTitle": "Japan Carries Out First Capital Execution in 14 Months | Choseno",
    "metaDescription": "Japan's Ministry of Justice confirms the execution of an Osaka arson convict, the first capital sentence carried out in 14 months.",
    "tags": ["Judiciary", "Human Rights", "Japan", "International Law", "Criminal Justice"],
    "tweet": "Japan carries out its first capital execution in 14 months following the execution of an inmate convicted in a fatal 2009 Osaka arson attack.",
    "breakingNews": false,
    "author": { "name": "Choseno International Legal & Human Rights Desk", "bio": "Comparative criminal jurisprudence, capital punishment policy, and international human rights law" },
    "sources": [
      { "label": "The Japan Times", "url": "https://www.japantimes.co.jp/news/2026/08/21/national/crime-legal/japan-execution-osaka-arson-takami/" },
      { "label": "Kyodo News", "url": "https://english.kyodonews.net/news/2026/08/japan-executes-death-row-inmate-first-in-14-months.html" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "south-korea-and-us-conclude-shortened-ulchi-freedom-shield-exercises-early-2026-08-21",
    "headline": "U.S. and South Korea Conclude Truncated Joint Military Drills Amid Alliance Tensions",
    "summary": "Combined military forces conclude the Ulchi Freedom Shield exercises six days ahead of schedule following White House orders scaling back field maneuvers in the Korean Peninsula.",
    "category": "Defense",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-21T06:00:00Z",
    "published_at": "2026-08-21T06:45:00Z",
    "impactArea": "international",
    "latitude": 38.8951,
    "longitude": -77.0364,
    "body": "SEOUL, SOUTH KOREA — Combined Forces Command (CFC) confirmed early Friday morning the conclusion of the annual *Ulchi Freedom Shield* joint military exercises, bringing field drills to an early close six days ahead of their original August 27 schedule following White House directives to scale back bilateral maneuvers.\n\n## Scaled-Back Exercises and Alliance Friction\n\nThe early cessation follows public statements by President Donald Trump criticizing Seoul’s reluctance to commit naval assets to Middle Eastern maritime escort operations, while expressing a desire to reduce military tension with North Korea. Under the revised schedule, combined live-fire counteroffensive exercises and combined amphibious landing drills were canceled, leaving only computer-simulated command post exercises operational during the final 72 hours.\n\nSouth Korean defense officials in Seoul reaffirmed that the 72-year bilateral security alliance remains solid, but military strategists in Seoul and Washington expressed concern that reducing joint exercises could degrade combined tactical readiness against regional ballistic missile threats.\n\n## Regional Reactions and Diplomatic Signals\n\nPyongyang responded to the drills by staging short-range ballistic missile tests into the Sea of Japan, with state media dismissing the drill curtailment as a political maneuver.\n\nU.S. Indo-Pacific Command commanders affirmed that rotational American defense commitments to South Korea and Japan remain active under statutory mutual defense treaties.\n\n## Bilateral Defense Ministerial Summit\n\nDefense ministers from Washington and Seoul are scheduled to meet in Hawaii in October 2026 for the annual Security Consultative Meeting (SCM).",
    "seoTitle": "U.S. and South Korea Conclude Truncated Military Exercises | Choseno",
    "metaDescription": "U.S. and South Korean forces conclude shortened Ulchi Freedom Shield exercises early following White House directives on alliance defense spending.",
    "tags": ["Donald Trump", "Defense", "South Korea", "Indo-Pacific", "Military", "Foreign Policy"],
    "tweet": "The U.S. and South Korea conclude joint military exercises six days early following White House directives scaling back Korean Peninsula maneuvers.",
    "breakingNews": false,
    "author": { "name": "Choseno Indo-Pacific Defense Desk", "bio": "Indo-Pacific security architecture, U.S.-Korea alliance relations, and East Asian defense strategy" },
    "sources": [
      { "label": "Yonhap News Agency", "url": "https://en.yna.co.kr/view/AEN20260821001200315" },
      { "label": "Al Jazeera English", "url": "https://www.aljazeera.com/news/2026/8/21/south-korea-us-end-military-drills-early-amid-iran-tensions" }
    ],
    "taggedPoliticianIds": ["a5fdebea-5daf-4d7e-86f2-b1b55aae903d"],
    "taggedPoliticians": ["Donald Trump"]
  },
  {
    "slug": "esdc-updates-temporary-foreign-worker-workforce-caps-for-multi-site-employers-2026-08-21",
    "headline": "Federal Government Modifies Temporary Foreign Worker Caps for Multi-Location Businesses",
    "summary": "Employment and Social Development Canada introduces per-location workforce caps for small multi-site outlets, offering hiring flexibility for regional healthcare and food producers.",
    "category": "Labor",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-21T05:00:00Z",
    "published_at": "2026-08-21T05:45:00Z",
    "impactArea": "country",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "OTTAWA, ON — Employment and Social Development Canada (ESDC) released updated operational guidelines Friday morning modifying how statutory workforce caps under the Temporary Foreign Worker Program (TFWP) apply to employers operating multiple small physical locations.\n\n## Per-Location Cap Rules and Sectoral Exceptions\n\nUnder the modernized regulatory policy, multi-site businesses with fewer than ten total staff at an individual branch or franchise can now apply for low-wage Labour Market Impact Assessments (LMIAs) based on specific location headcounts rather than aggregate nationwide corporate size. The rule allows qualifying small outlets to hire one low-wage foreign worker per site, with a maximum of two authorized for high-priority sectors experiencing chronic regional shortages, including long-term care homes, regional residential construction, and agricultural food packaging.\n\nESDC officials emphasized that employers must continue to demonstrate verifiable domestic recruitment efforts through Job Bank advertisements before receiving LMIA approval.\n\n## Business and Labor Perspectives\n\nThe Canadian Federation of Independent Business (CFIB) welcomed the adjustment, noting that regional franchise operators in rural communities often struggle to recruit local staff despite offering competitive wages.\n\nLabor unions and worker advocacy groups urged the federal government to ensure robust on-site labor inspection audits to prevent wage suppression and safeguard temporary workers from exploitation.\n\n## Effective Implementation Date\n\nThe updated multi-site LMIA assessment framework is effective immediately across all provincial Service Canada processing centers.",
    "seoTitle": "ESDC Modifies Temporary Foreign Worker Caps for Multi-Site Employers | Choseno",
    "metaDescription": "Employment and Social Development Canada updates TFWP rules, allowing per-location low-wage hiring caps for small multi-branch businesses.",
    "tags": ["Mark Carney", "Labor", "Economy", "Immigration", "TFWP", "Small Business"],
    "tweet": "Employment and Social Development Canada modifies Temporary Foreign Worker Program caps to allow per-location calculations for multi-site businesses.",
    "breakingNews": false,
    "author": { "name": "Choseno Federal Labor & Economic Policy Desk", "bio": "Canadian labor market regulation, immigration policy, and workforce development" },
    "sources": [
      { "label": "Employment and Social Development Canada", "url": "https://www.canada.ca/en/employment-social-development/news/2026/08/tfwp-multi-site-employer-guidelines.html" },
      { "label": "CIC News", "url": "https://www.cicnews.com/2026/08/canada-updates-tfwp-workforce-caps-for-multi-site-employers-0849201.html" }
    ],
    "taggedPoliticianIds": ["4bd5cf73-1d03-4fb2-ae1b-2303c2c99737"],
    "taggedPoliticians": ["Mark Carney"]
  },
  {
    "slug": "city-of-victoria-officially-launches-lime-e-bike-micromobility-fleet-2026-08-21",
    "headline": "City of Victoria and Lime Launch 400-Vehicle Public Electric Bike Share Program",
    "summary": "Victoria municipal officials and Lime officially deploy a fleet of 400 modern e-bikes across designated downtown and neighborhood hubs to promote zero-emission transit.",
    "category": "Transportation",
    "country": "CA",
    "province": "BC",
    "status": "published",
    "eventDate": "2026-08-21T05:30:00Z",
    "published_at": "2026-08-21T06:15:00Z",
    "impactArea": "local",
    "latitude": 48.4284,
    "longitude": -123.3656,
    "body": "VICTORIA, BC — The City of Victoria and micromobility operator Lime officially rolled out a municipal electric bike share program Friday morning, deploying a fleet of 400 custom-engineered e-bikes across 65 designated parking hubs in downtown Victoria, Vic West, and James Bay.\n\n## Micromobility Infrastructure and Municipal Partnership\n\nThe zero-emission transit fleet features Gen4 e-bikes equipped with automatic two-speed transmissions, lower centers of gravity, built-in turn signals, and geofenced speed controls that limit speeds to 15 km/h along pedestrian-heavy corridors like Government Street. Under the municipal operating agreement, Lime is responsible for daily fleet battery rebalancing, maintenance, and parking compliance, utilizing GPS mandatory parking zones to prevent sidewalk clutter.\n\nVictoria Mayor Marianne Alto celebrated the launch at a community event in Vic West, stating that accessible electric bike transit provides residents and tourists with an affordable, climate-friendly alternative to personal motor vehicles.\n\n## Equity Pricing and Cycling Network Integration\n\nThe program includes discounted *Lime Access* passes offering 70 percent fare reductions for low-income residents and post-secondary students at the University of Victoria.\n\nCycling advocacy groups praised the launch, noting that Victoria’s extensive protected bike lane network makes the city ideally suited for shared micromobility.\n\n## Winter Operations Review\n\nThe pilot program will operate year-round, with Victoria City Council reviewing fleet utilization data and safety performance in spring 2027.",
    "seoTitle": "City of Victoria Launches Lime Shared E-Bike Fleet | Choseno",
    "metaDescription": "The City of Victoria and Lime deploy 400 new electric bikes across 65 designated parking hubs to expand zero-emission urban transit.",
    "tags": ["David Eby", "British Columbia", "Transportation", "Climate", "Municipal", "Victoria", "Clean Tech"],
    "tweet": "The City of Victoria and Lime launch a 400-vehicle public electric bike share program across 65 designated hubs to boost green urban transit.",
    "breakingNews": false,
    "author": { "name": "Choseno British Columbia Civic Desk", "bio": "B.C. municipal governance, urban transportation infrastructure, and climate initiatives" },
    "sources": [
      { "label": "City of Victoria News", "url": "https://www.victoria.ca/city-hall/news/city-victoria-lime-e-bike-share-launch-2026" },
      { "label": "Times Colonist", "url": "https://www.timescolonist.com/local-news/lime-e-bikes-launch-in-victoria-friday-941208" }
    ],
    "taggedPoliticianIds": ["a730729a-0a3b-4231-b93d-9b5524f9db5e"],
    "taggedPoliticians": ["David Eby"]
  },
  {
    "slug": "house-subcommittee-on-energy-examines-ai-data-center-transmission-costs-2026-08-21",
    "headline": "House Energy Leaders Propose Federal Guardrails on AI Data Center Grid Power Allocation",
    "summary": "Bipartisan House lawmakers unveil legislative principles requiring hyperscale data centers to fund dedicated behind-the-meter generation to protect consumer utility rates.",
    "category": "Technology",
    "country": "US",
    "province": "DC",
    "status": "published",
    "eventDate": "2026-08-21T05:00:00Z",
    "published_at": "2026-08-21T05:45:00Z",
    "impactArea": "country",
    "latitude": 38.8899,
    "longitude": -77.0090,
    "body": "WASHINGTON, DC — Members of the House Committee on Energy and Commerce released a bipartisan policy framework Friday morning aimed at safeguarding residential electricity consumers from transmission rate spikes driven by the massive power demands of hyperscale artificial intelligence computing centers.\n\n## Grid Reliability and Cost-Allocation Principles\n\nThe legislative proposal establishes the *AI Grid Protection Standard*, requiring commercial developers of data centers exceeding 100 megawatts to directly finance the regional high-voltage transmission interconnects and contract dedicated clean baseload power—such as advanced nuclear, geothermal, or battery storage—rather than drawing from existing regulated utility reserves. Lawmakers highlighted that while American leadership in artificial intelligence is a paramount economic and strategic priority, residential households must not bear the cost of industrial power grid expansions.\n\nHouse Energy Subcommittee leaders affirmed that proactive federal regulatory certainty will accelerate private capital investment while protecting low-income rate payers from monthly utility bill inflation.\n\n## Technology and Utility Industry Stakeholders\n\nTechnology infrastructure trade groups expressed support for streamlined interconnection permitting, while urging the Federal Energy Regulatory Commission (FERC) to avoid rigid one-size-fits-all mandates.\n\nState public utility commissioners applauded the framework, noting that rapid data center expansion has strained regional electric grids across Virginia, Ohio, and Texas.\n\n## Committee Hearing Timetable\n\nThe House Energy and Commerce Committee will hold a formal legislative markup on the bill in late September 2026.",
    "seoTitle": "House Energy Leaders Propose Guardrails for AI Data Center Power | Choseno",
    "metaDescription": "House Energy lawmakers unveil a bipartisan bill requiring AI data center campuses to fund dedicated power generation and protect residential electric rates.",
    "tags": ["Technology", "Energy", "AI", "Congress", "House of Representatives", "Economy"],
    "tweet": "House Energy leaders unveil a bipartisan proposal requiring hyperscale AI data centers to fund dedicated power generation to shield consumer utility bills.",
    "breakingNews": false,
    "author": { "name": "Choseno Energy & Technology Regulation Desk", "bio": "Federal energy regulation, congressional tech policy, and power grid modernization" },
    "sources": [
      { "label": "U.S. House Committee on Energy and Commerce", "url": "https://energycommerce.house.gov/posts/bipartisan-framework-ai-data-center-grid-reliability-2026" },
      { "label": "The Hill", "url": "https://thehill.com/policy/technology/482910-house-democrat-rein-in-data-centers-ai-tech-race/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "cathay-pacific-launches-direct-central-asia-flights-to-almaty-2026-08-21",
    "headline": "Cathay Pacific Inaugurates Direct Air Route Connecting Hong Kong and Kazakhstan",
    "summary": "Cathay Pacific launches regular scheduled passenger and cargo service between Hong Kong and Almaty, expanding commercial trade corridors across Central Asia.",
    "category": "Economy",
    "country": "CA",
    "province": "ON",
    "status": "published",
    "eventDate": "2026-08-21T05:10:00Z",
    "published_at": "2026-08-21T06:00:00Z",
    "impactArea": "international",
    "latitude": 45.4215,
    "longitude": -75.6972,
    "body": "ALMATY, KAZAKHSTAN — Cathay Pacific Airways inaugurated direct passenger and dedicated cargo air service Friday connecting Hong Kong International Airport (HKG) with Almaty International Airport (ALA), marking the carrier's first direct commercial route into Central Asia.\n\n## Central Asian Trade Corridors and Aviation Cargo\n\nOperating three times weekly using Airbus A350-900 aircraft, the direct link cuts round-trip transit times between East Asia and Kazakhstan by more than five hours, providing high-capacity belly-hold cargo space for high-value electronics, pharmaceuticals, and agricultural commodities. Aviation analysts noted that the new route reflects growing international trade diversification along the Trans-Caspian International Transport Route (Middle Corridor), linking Asian manufacturing centers to Central Asian and European markets.\n\nKazakh civil aviation authorities and trade officials welcomed the inaugural flight, emphasizing that direct air connectivity accelerates foreign direct investment in energy, fintech, and mineral processing.\n\n## Tourism and Commercial Passenger Exchange\n\nThe airline confirmed strong forward bookings for both business travelers and international tourism, supported by mutual 30-day visa-free travel agreements between Kazakhstan and Hong Kong.\n\nLogistics operators praised the route, highlighting that reliable air cargo corridors provide essential redundancy for global supply chains.\n\n## Expanded Central Asia Flight Schedules\n\nCathay Pacific announced plans to evaluate cargo frequencies to Tashkent, Uzbekistan, by mid-2027.",
    "seoTitle": "Cathay Pacific Launches Direct Hong Kong to Almaty Route | Choseno",
    "metaDescription": "Cathay Pacific opens direct passenger and cargo flights between Hong Kong and Almaty, expanding Central Asian commercial trade connectivity.",
    "tags": ["Economy", "Transportation", "Aviation", "Trade", "Central Asia", "Logistics"],
    "tweet": "Cathay Pacific launches direct passenger and cargo flights between Hong Kong and Almaty, boosting commercial trade corridors with Central Asia.",
    "breakingNews": false,
    "author": { "name": "Choseno International Aviation & Trade Desk", "bio": "Global airline operations, international trade corridors, and commercial logistics" },
    "sources": [
      { "label": "Aviation Week", "url": "https://aviationweek.com/air-transport/airports-routes/cathay-pacific-inaugurates-almaty-kazakhstan-service-2026" },
      { "label": "Astana Times", "url": "https://astanatimes.com/2026/08/cathay-pacific-launches-direct-flights-almaty-hong-kong/" }
    ],
    "taggedPoliticianIds": [],
    "taggedPoliticians": []
  },
  {
    "slug": "quebec-superior-court-sets-2028-trial-dates-for-provencher-civil-lawsuit-against-sq-2026-08-21",
    "headline": "Quebec Superior Court Schedules 2028 Trial for $2M Civil Lawsuit Against Sûreté du Québec",
    "summary": "A Quebec Superior Court judge sets trial dates for autumn 2028 in the $2 million malicious prosecution and damages lawsuit filed by Jonathan Bettez against provincial police.",
    "category": "Judiciary",
    "country": "CA",
    "province": "QC",
    "status": "published",
    "eventDate": "2026-08-21T04:50:00Z",
    "published_at": "2026-08-21T05:30:00Z",
    "impactArea": "state",
    "latitude": 46.3432,
    "longitude": -72.5477,
    "body": "TROIS-RIVIÈRES, QC — The Quebec Superior Court issued a formal case management scheduling order Friday morning, setting a four-week trial date beginning in October 2028 for the multi-million-dollar civil lawsuit filed by Jonathan Bettez against the Sûreté du Québec (SQ) and the Attorney General of Quebec.\n\n## Civil Litigation and Malicious Prosecution Claims\n\nThe $2.1 million civil action stems from the high-profile investigation into the 2007 disappearance and death of nine-year-old Cédrika Provencher in Trois-Rivières. Bettez, who was publicly identified as a primary person of interest during police operations, alleges that provincial police investigators committed gross civil fault, malicious prosecution, and abusive interrogation techniques, resulting in severe psychological distress and permanent reputational harm. The plaintiff argues that investigative leaks violated his fundamental rights under the Quebec Charter of Human Rights and Freedoms.\n\nAttorneys for the Sûreté du Québec and the provincial Attorney General maintain that all investigative actions, search warrants, and surveillance operations were executed lawfully and in good faith in pursuit of justice for a homicide victim.\n\n## Pre-Trial Discovery and Evidentiary Filings\n\nSuperior Court Justice Marc-André Blanchard ordered both parties to complete the exchange of expert psychiatric reports and forensic police log disclosures by December 2027.\n\nLegal scholars in Quebec noted that the civil trial will establish significant jurisprudence regarding the legal liabilities of police forces during complex, uncharged homicide investigations.\n\n## Trial Opening Date\n\nFormal witness testimony and oral arguments will commence at the Trois-Rivières Courthouse on October 16, 2028.",
    "seoTitle": "Quebec Court Sets 2028 Trial for Bettez Lawsuit Against Sûreté du Québec | Choseno",
    "metaDescription": "Quebec Superior Court schedules trial dates for autumn 2028 in Jonathan Bettez's $2.1M civil lawsuit against the Sûreté du Québec.",
    "tags": ["François Legault", "Quebec", "Judiciary", "Police", "Courts", "Civil Rights"],
    "tweet": "The Quebec Superior Court sets autumn 2028 trial dates for the 2.1 million dollar civil lawsuit against the Sûreté du Québec in the Provencher case.",
    "breakingNews": false,
    "author": { "name": "Choseno Quebec Legal & Justice Desk", "bio": "Quebec civil law, police accountability litigation, and Superior Court jurisprudence" },
    "sources": [
      { "label": "Radio-Canada Nouvelles", "url": "https://ici.radio-canada.ca/nouvelle/2098210/jonathan-bettez-sq-poursuite-proces-2028" },
      { "label": "Le Nouvelliste", "url": "https://www.lenouvelliste.ca/justice-et-faits-divers/2026/08/21/affaire-cedrika-provencher-proces-bettez-sq-2028-2026" }
    ],
    "taggedPoliticianIds": ["19f76830-8288-487c-8ce7-0d6f64b0bb4a"],
    "taggedPoliticians": ["François Legault"]
  }
];

// 3. Batch Ingestion Engine
async function run() {
  console.log(`Starting ingestion of ${articles.length} news articles...`);
  const authHeaders = await getAuthHeaders();

  // Batch tag for this run -- must be computed fresh each time the script
  // runs, NOT hardcoded. A prior version of this script hardcoded a literal
  // date/time here; every subsequent run (regardless of when it actually
  // executed) kept stamping that same stale tag on brand-new articles,
  // silently merging them into a days-old batch in the Admin > News
  // Distribution dropdown (see supabase/migrations/20260824000000_auto_
  // correct_stale_news_batch_number.sql, which also guards against this at
  // the DB level, but fixing it here is the actual root cause).
  const batchTimestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

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
        batch_number: batchTimestamp,
        viral_score: 9.6,
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
      const postWindow = 'Early Morning Drive (6:00 AM - 9:00 AM EST)';
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
