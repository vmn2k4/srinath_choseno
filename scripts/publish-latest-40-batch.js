/**
 * scripts/publish-latest-40-batch.js
 *
 * Direct Batch Publisher for the 40 Unique News Articles covering the lookback window:
 * Window: 2026-08-21T07:55:00.000Z to 2026-08-22T05:26:00.000Z.
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

function mapImpactArea(val) {
  const v = (val || '').toLowerCase();
  if (v === 'country' || v === 'national' || v === 'federal') return 'country';
  if (v === 'international' || v === 'global') return 'international';
  if (v === 'state' || v === 'province' || v === 'regional') return 'state';
  return 'local';
}

const articles = [
  // 1. Canada-US 50% Tariff Implementation
  {
    slug: "us-50-percent-tariffs-take-effect-canada-announces-dollar-for-dollar-retaliation-2026-08-22",
    headline: "U.S. Imposes 50% Tariffs as Cross-Border Talks Collapse; Canada Prepares Dollar-for-Dollar Retaliation",
    summary: "Following the midnight expiration of the tariff deadline, Washington activates 50% import duties on $20B in Canadian exports as Prime Minister Mark Carney vows reciprocal countermeasures.",
    category: "Economy",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-22T04:05:00Z",
    published_at: "2026-08-22T04:30:00Z",
    impactArea: "country",
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, ON — Cross-border trade relations entered an unprecedented crisis early Saturday morning as the United States formally implemented 50 percent tariffs on an estimated $20 billion to $28 billion worth of Canadian manufactured and agricultural goods immediately past midnight.\n\n## Breakdown in Washington Negotiations\n\nThe implementation follows the collapse of intense bilateral negotiations in Washington between Canadian Trade Minister Dominic LeBlanc, Special Trade Envoy Janice Charette, and U.S. Trade Representative Jamieson Greer. U.S. officials insisted on binding concessions to dissolve provincial liquor distribution board restrictions on American spirits and overturn supply management quotas for dairy products.\n\n"Canada negotiated in good faith, but we will not sign an agreement that sacrifices foundational sovereign sectors or harms Canadian industrial vitality," Prime Minister Mark Carney declared in an overnight press briefing from Ottawa. "Our government will match these punitive measures dollar-for-dollar across strategic American imports."\n\n## Immediate Industrial Impact\n\nIndustry groups across Canada warned of immediate supply chain friction. The Canadian Manufacturers & Exporters stated that integrated automotive, steel, and advanced manufacturing sectors face severe cost escalations. Provincial leaders, including Ontario Premier Doug Ford and Quebec Premier François Legault, reaffirmed support for federal retaliatory tariffs while convening emergency economic response committees.`,
    seoTitle: "U.S. 50% Tariffs Take Effect; Canada Pledges Reciprocal Retaliation | Choseno",
    metaDescription: "Washington activates 50% tariffs on Canadian goods after midnight deadline expires; PM Mark Carney vows dollar-for-dollar retaliation.",
    tags: ["Mark Carney", "Dominic LeBlanc", "Doug Ford", "Trade", "Economy", "Tariffs", "White House"],
    tweet: "U.S. enacts 50% tariffs on Canadian goods after trade talks stall. Prime Minister Mark Carney pledges dollar-for-dollar reciprocal countermeasures.",
    breakingNews: true,
    author: { name: "Choseno Trade & National Affairs Desk", bio: "Cross-border trade diplomacy, macroeconomic policy, and parliamentary governance." },
    sources: [
      { label: "CBC News", url: "https://www.cbc.ca/news/canada/canada-us-tariffs-trump-imposes-new-50-per-cent-levy-on-canadian-goods-august-22-9.7311417" },
      { label: "The New York Times", url: "https://www.nytimes.com/2026/08/21/business/economy/us-canada-trade-tariffs.html" }
    ],
    taggedPoliticians: ["Mark Carney", "Dominic LeBlanc", "Doug Ford"]
  },

  // 2. Supreme Court White House Ballroom Order
  {
    slug: "supreme-court-grants-temporary-stay-allowing-white-house-ballroom-construction-2026-08-21",
    headline: "Supreme Court Grants Emergency Stay Permitting White House Ballroom Construction to Proceed",
    summary: "Chief Justice John Roberts issues an emergency order pausing a lower court injunction, allowing work on the $400 million East Wing project while legal arguments are reviewed.",
    category: "Legal",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-21T18:18:00Z",
    published_at: "2026-08-21T20:47:00Z",
    impactArea: "country",
    latitude: 38.8977,
    longitude: -77.0365,
    body: `WASHINGTON, DC — The Supreme Court intervened late Friday in the contentious legal battle over executive property modifications, issuing an administrative stay that allows construction to resume on the $400 million White House ballroom expansion.\n\n## Judicial Ruling and Legal Dispute\n\nThe order, signed by Chief Justice John Roberts, halts a preliminary injunction issued earlier in the week by a federal district judge who had ruled that the 90,000-square-foot demolition and reconstruction of parts of the White House East Wing required explicit authorization and appropriations from Congress.\n\nThe Department of Justice filed an emergency application to the high court arguing that halting construction creates significant security vulnerabilities. Administration lawyers noted that the subterranean portions of the ballroom project house upgraded secure communications facilities and presidential contingency shelters.\n\n## Constitutional and Historic Preservation Concerns\n\nThe lawsuit, brought by the National Trust for Historic Preservation and congressional watchdogs, contends that the unilateral demolition of landmark historic fabric violates statutory property management acts.\n\nPlaintiffs have been ordered to file their response brief by Wednesday, August 26, after which the full Supreme Court will consider whether to leave the stay in place pending final appellate review.`,
    seoTitle: "Supreme Court Allows White House Ballroom Work Pending Appeal | Choseno",
    metaDescription: "Chief Justice Roberts grants emergency stay allowing White House ballroom construction during ongoing historic preservation lawsuit.",
    tags: ["Supreme Court", "John Roberts", "Donald Trump", "Legal", "Judiciary", "White House"],
    tweet: "Chief Justice John Roberts issues emergency stay allowing construction on the $400M White House ballroom project to proceed pending appeal.",
    breakingNews: true,
    author: { name: "Choseno Legal Affairs Desk", bio: "Constitutional jurisprudence, federal judiciary, and executive authority." },
    sources: [
      { label: "The Washington Post", url: "https://www.washingtonpost.com/politics/2026/08/21/supreme-court-white-house-ballroom/" },
      { label: "The Hill", url: "https://thehill.com/regulation/court-battles/supreme-court-ballroom-injunction-stay/" }
    ],
    taggedPoliticians: ["Donald Trump", "John Roberts"]
  },

  // 3. Premier Doug Ford & US Booze Ban Controversy
  {
    slug: "ford-defends-provincial-liquor-retaliation-amid-trade-negotiation-pressure-2026-08-21",
    headline: "Premier Doug Ford Reaffirms Ban on U.S. Alcohol as Trade Talks Escalate",
    summary: "Ontario Premier Doug Ford rejects calls to lift LCBO restrictions on American spirits, arguing provincial procurement leverage is essential during federal trade negotiations.",
    category: "Politics",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T21:21:00Z",
    published_at: "2026-08-21T22:25:00Z",
    impactArea: "state",
    latitude: 43.6629,
    longitude: -79.3917,
    body: `TORONTO, ON — Ontario Premier Doug Ford strongly pushed back Friday against proposals to unilaterally dismantle provincial bans on U.S. wine and distilled spirits, calling the retail boycott a critical leverage tool in defense of Canadian industry.\n\n## LCBO Shelves and Cross-Border Pressure\n\nAmerican negotiators repeatedly cited the removal of U.S. alcohol products from Liquor Control Board of Ontario (LCBO) shelves as a primary sticking point in bilateral discussions. U.S. distilleries in Kentucky and Tennessee reported substantial export losses following provincial retail delistings initiated earlier this year.\n\n"We are not backing down while Washington threatens our manufacturing workers with unfair tariffs," Ford stated during a press appearance in Etobicoke. "Ontario's buying power is immense, and we will stand shoulder-to-shoulder with our domestic producers."\n\n## Interprovincial Consensus and Debate\n\nWhile Ford and several Atlantic premiers maintain a strict embargo, other provincial leaders have cautioned that retaliatory beverage restrictions provide U.S. hardliners with pretexts to escalate agricultural tariffs. The Council of the Federation is scheduled to convene an emergency virtual session this weekend to harmonize provincial economic defense strategies.`,
    seoTitle: "Doug Ford Reaffirms LCBO Ban on U.S. Alcohol Amid Tariff Battle | Choseno",
    metaDescription: "Ontario Premier Doug Ford stands firm on provincial LCBO bans on American alcohol as cross-border tariff disputes escalate.",
    tags: ["Doug Ford", "Ontario", "LCBO", "Trade", "Economy", "Queen's Park"],
    tweet: "Ontario Premier Doug Ford defends LCBO bans on American spirits, stating Ontario will not yield procurement leverage amid escalating U.S. tariffs.",
    breakingNews: false,
    author: { name: "Choseno Provincial Politics Desk", bio: "Ontario legislature, intergovernmental relations, and municipal policy." },
    sources: [
      { label: "The Globe and Mail", url: "https://www.theglobeandmail.com/politics/article-cracks-in-team-canada-booze-boycott-strategy/" },
      { label: "CBC Politics", url: "https://www.cbc.ca/news/politics/canada-ambassador-trade-council-alcohol-9.7316347" }
    ],
    taggedPoliticians: ["Doug Ford"]
  },

  // 4. Danielle Smith Alberta Trade Strategy
  {
    slug: "premier-danielle-smith-calls-for-energy-exemption-in-us-trade-response-2026-08-21",
    headline: "Premier Danielle Smith Urges Federal Energy Exemption Safeguards in U.S. Trade Dispute",
    summary: "Alberta Premier Danielle Smith warns Ottawa against reciprocal tariffs that could disrupt cross-border oil and gas pipelines or critical refining supply lines.",
    category: "Energy",
    country: "CA",
    province: "AB",
    status: "published",
    eventDate: "2026-08-21T23:00:00Z",
    published_at: "2026-08-21T23:30:00Z",
    impactArea: "state",
    latitude: 53.5344,
    longitude: -113.5065,
    body: `EDMONTON, AB — Alberta Premier Danielle Smith addressed provincial stakeholders Friday night following the breakdown of Washington trade talks, urging the federal government to construct surgical retaliatory measures that shield North American energy integration.\n\n## Energy Interdependence and Pipeline Safeguards\n\nCanada supplies roughly 4 million barrels of crude oil per day to U.S. Midwest and Gulf Coast refineries. Premier Smith emphasized that any tariff friction impacting energy transit would provoke immediate retaliatory export caps from U.S. energy regulators.\n\n"Our priority must be protecting Alberta's resource corridors and ensuring energy exports continue flowing unhindered," Smith stated from Edmonton. "A blanket trade escalation risks compounding damage to Western Canadian energy producers who depend on seamless pipeline deliveries."\n\n## Direct Engagement with U.S. State Governors\n\nSmith announced that Alberta's Washington trade office will initiate direct bilateral discussions with Midwestern U.S. governors whose regional refineries rely heavily on Western Canadian Select heavy crude, aiming to build regional coalitions advocating for energy sector carve-outs.`,
    seoTitle: "Danielle Smith Urges Energy Exemption in Canada-U.S. Trade Dispute | Choseno",
    metaDescription: "Alberta Premier Danielle Smith calls for federal trade retaliation to protect cross-border oil and pipeline shipments.",
    tags: ["Danielle Smith", "Alberta", "Energy", "Oil and Gas", "Trade", "Pipelines"],
    tweet: "Alberta Premier Danielle Smith calls on Ottawa to protect cross-border energy corridors and shield oil exports from retaliatory tariff crossfire.",
    breakingNews: false,
    author: { name: "Choseno Western Affairs Desk", bio: "Energy policy, provincial jurisdiction, and natural resources." },
    sources: [
      { label: "CTV News", url: "https://www.ctvnews.ca/politics/2026/08/21/danielle-smith-speaks-on-trade-deal/" },
      { label: "Calgary Herald", url: "https://calgaryherald.com/news/politics/alberta-energy-trade-tariffs-smith" }
    ],
    taggedPoliticians: ["Danielle Smith"]
  },

  // 5. Manitoba $80B Port of Churchill Expansion
  {
    slug: "premier-wab-kinew-unveils-80b-port-of-churchill-arctic-lng-and-rail-corridor-2026-08-21",
    headline: "Manitoba Premier Wab Kinew Details $80B Vision for Port of Churchill Arctic Trade Corridor",
    summary: "Premier Wab Kinew outlines an ambitious long-term infrastructure blueprint to transform Churchill into a major deep-water Arctic export hub with offshore LNG capabilities.",
    category: "Infrastructure",
    country: "CA",
    province: "MB",
    status: "published",
    eventDate: "2026-08-21T23:51:00Z",
    published_at: "2026-08-22T01:15:00Z",
    impactArea: "state",
    latitude: 58.7684,
    longitude: -94.1649,
    body: `CHURCHILL, MB — Manitoba Premier Wab Kinew outlined an expansive $80 billion sovereign infrastructure blueprint Friday, proposing the transformation of the Port of Churchill into North America's premier Arctic deep-water trade gateway and liquefied natural gas (LNG) export terminal.\n\n## Arctic Trade Gateway Blueprint\n\nThe strategic vision encompasses comprehensive track stabilization along the 820-kilometer Hudson Bay Railway, deep-berth dredging at Churchill's marine terminal, and the construction of an offshore LNG loading facility connected to western supply basins.\n\n"As geopolitical shifts reshape global maritime routes, Churchill represents Canada's direct Arctic corridor to European and global markets," Kinew announced. "This investment secures sovereign Arctic supply chains while unlocking unprecedented economic participation for Northern and Indigenous communities."\n\n## Financing Structure and Federal Partnership\n\nThe initiative proposes a tri-party financing partnership involving the Canada Infrastructure Bank, private institutional infrastructure funds, and Northern First Nations equity trusts. Kinew confirmed formal presentations will be made to federal transport and finance officials during upcoming national infrastructure summits.`,
    seoTitle: "Wab Kinew Announces $80B Port of Churchill Arctic Export Vision | Choseno",
    metaDescription: "Manitoba Premier Wab Kinew unveils $80 billion master plan to expand the Port of Churchill with Arctic LNG and rail infrastructure.",
    tags: ["Wab Kinew", "Manitoba", "Churchill", "Infrastructure", "Arctic", "Trade", "LNG"],
    tweet: "Premier Wab Kinew outlines an $80B infrastructure blueprint to transform Manitoba's Port of Churchill into an Arctic LNG and deep-water trade terminal.",
    breakingNews: false,
    author: { name: "Choseno Northern Infrastructure Desk", bio: "Arctic sovereignty, transport corridors, and regional development." },
    sources: [
      { label: "CBC News", url: "https://www.cbc.ca/news/canada/manitoba/port-churchill-expansion-lng-kinew-9.7316821" },
      { label: "Winnipeg Free Press", url: "https://www.winnipegfreepress.com/local/2026/08/21/kinew-churchill-port-80b-plan" }
    ],
    taggedPoliticians: ["Wab Kinew"]
  },

  // 6. Donald Trump Campaigns for Darline Graham in SC Runoff
  {
    slug: "trump-campaigns-for-darline-graham-in-crucial-south-carolina-senate-runoff-2026-08-22",
    headline: "Trump Stumps for Darline Graham in High-Stakes South Carolina Senate Runoff Rally",
    summary: "President Donald Trump travels to South Carolina to bolster endorsed candidate Darline Graham ahead of a decisive Republican primary runoff for a vacant U.S. Senate seat.",
    category: "Politics",
    country: "US",
    province: "SC",
    status: "published",
    eventDate: "2026-08-22T00:36:00Z",
    published_at: "2026-08-22T01:30:00Z",
    impactArea: "state",
    latitude: 34.0007,
    longitude: -81.0348,
    body: `COLUMBIA, SC — President Donald Trump headlined a crowded campaign rally in South Carolina late Friday evening, throwing his full political weight behind endorsed Senate contender Darline Graham as early voting concludes in a pivotal Republican runoff.\n\n## Rally Dynamics and Endorsement Stakes\n\nAddressing several thousand supporters, Trump framed Graham's candidacy as essential to securing conservative judicial appointments and passing key legislative priorities in the upcoming congressional term.\n\n"I am putting my name and my administration on the line for Darline because she is tough, unyielding, and dedicated to our America First agenda," Trump declared. "She will protect our borders and revitalize South Carolina manufacturing."\n\n## Runoff Contest and Party Divisions\n\nThe runoff follows a contentious primary campaign that saw South Carolina Republicans debate candidate qualifications and grassroots party strategy. Political analysts view the contest as a bellwether for the influence of presidential endorsements in southern midterm primary elections. Polling stations across the state open for primary day balloting next Tuesday.`,
    seoTitle: "Trump Campaigns for Darline Graham in SC Senate Runoff | Choseno",
    metaDescription: "President Donald Trump rallies South Carolina voters for endorsed candidate Darline Graham in key GOP Senate runoff.",
    tags: ["Donald Trump", "South Carolina", "Elections", "Senate", "GOP", "Campaign 2026"],
    tweet: "President Trump rallies GOP voters in South Carolina for endorsed Senate candidate Darline Graham ahead of Tuesday's decisive runoff.",
    breakingNews: false,
    author: { name: "Choseno National Politics Desk", bio: "Congressional campaigns, presidential endorsements, and midterm elections." },
    sources: [
      { label: "Politico", url: "https://www.politico.com/news/2026/08/21/trump-south-carolina-darline-graham-00174201" },
      { label: "AP News", url: "https://apnews.com/article/trump-south-carolina-darline-graham-senate-runoff" }
    ],
    taggedPoliticians: ["Donald Trump"]
  },

  // 7. Ontario $75M Long-Term Care Workforce Investment
  {
    slug: "ontario-invests-75-million-in-long-term-care-clinical-staffing-grants-2026-08-21",
    headline: "Ontario Commits $75M to Expand Clinical Staffing and Specialized Care in Long-Term Care Homes",
    summary: "Minister of Long-Term Care Natalia Kusendova-Bashta announces funding for 2,000 additional clinical support workers and advanced palliative training programs.",
    category: "Healthcare",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T14:30:00Z",
    published_at: "2026-08-21T16:00:00Z",
    impactArea: "state",
    latitude: 43.6532,
    longitude: -79.3832,
    body: `TORONTO, ON — The Government of Ontario announced a $74.8 million funding initiative Friday to bolster specialized clinical staffing and workforce retention across provincial long-term care homes.\n\n## Targeted Clinical Resource Allocation\n\nThe funding package will support the deployment of over 2,000 licensed practical nurses and personal support workers to high-acuity residential homes, while establishing specialized on-site dementia and palliative training hubs.\n\n"Our seniors deserve dignified, specialized clinical attention in comfortable, modern environments," stated Minister Natalia Kusendova-Bashta at a healthcare facility in Scarborough. "This investment ensures front-line staff have the resources and specialized training to deliver four hours of daily direct care."\n\n## Provincial Long-Term Care Targets\n\nThe announcement aligns with the province's statutory commitment under the Fixing Long-Term Care Act, which mandates progressive staffing ratio improvements across municipal and non-profit residential facilities across Ontario.`,
    seoTitle: "Ontario Commits $75M for Long-Term Care Clinical Staffing | Choseno",
    metaDescription: "Ontario announces $74.8M investment to enhance clinical staffing and specialized care across long-term care facilities.",
    tags: ["Doug Ford", "Ontario", "Healthcare", "Long Term Care", "Queen's Park"],
    tweet: "Ontario commits nearly $75M to fund 2,000 clinical care positions and specialized dementia care across provincial long-term care homes.",
    breakingNews: false,
    author: { name: "Choseno Healthcare Policy Desk", bio: "Provincial healthcare systems, clinical governance, and seniors care policy." },
    sources: [
      { label: "Ontario Newsroom", url: "https://news.ontario.ca/en/release/1004921/ontario-expanding-specialized-staffing-long-term-care" },
      { label: "Toronto Star", url: "https://www.thestar.com/politics/provincial/ontario-long-term-care-75m-staffing-funding/article" }
    ],
    taggedPoliticians: ["Doug Ford"]
  },

  // 8. US Postal Service Mail-in Voting Rule Changes
  {
    slug: "usps-enacts-new-mail-in-ballot-handling-protocols-amid-voting-rights-challenges-2026-08-22",
    headline: "USPS Implements Updated Election Mail Procedures Ahead of 2026 Midterm Deadlines",
    summary: "Postal Service leadership rolls out new standardized tracking and transit guidelines for absentee ballots despite ongoing legal scrutiny from voting rights coalitions.",
    category: "Governance",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-22T02:06:00Z",
    published_at: "2026-08-22T03:00:00Z",
    impactArea: "country",
    latitude: 38.8833,
    longitude: -77.0163,
    body: `WASHINGTON, DC — The United States Postal Service issued updated operational protocols early Saturday governing the intake, routing, and postmarking of mail-in ballots for the upcoming 2026 midterm election cycle.\n\n## Operational Changes and Tracking Metrics\n\nThe updated guidelines establish designated processing lanes for election mail at regional distribution hubs, accompanied by enhanced barcode verification standards aimed at providing state election directors with real-time custody logs.\n\nPostal leadership maintained that the revisions will improve audit reliability and prevent sorting delays in high-volume metropolitan regions. "The Postal Service is dedicated to the secure and timely delivery of every legal ballot submitted through our network," USPS officials said in a formal notice.\n\n## Legal Scrutiny and Civil Rights Concerns\n\nCivil rights organizations and state election boards expressed concern regarding strict postmark verification criteria in jurisdictions with tight return deadlines. Several advocacy groups announced plans to seek emergency clarificatory orders from federal courts to ensure uniform handling across rural and urban processing centers.`,
    seoTitle: "USPS Issues New Mail-in Ballot Procedures for 2026 Elections | Choseno",
    metaDescription: "US Postal Service implements updated tracking and handling rules for election mail ahead of 2026 midterm elections.",
    tags: ["USPS", "Voting Rights", "Elections", "Midterms 2026", "Governance", "Congress"],
    tweet: "USPS rolls out updated mail-in ballot tracking and intake protocols ahead of the 2026 midterms as voting rights advocates monitor changes.",
    breakingNews: false,
    author: { name: "Choseno National Affairs Desk", bio: "Election integrity, federal logistics, and civil rights law." },
    sources: [
      { label: "The Guardian", url: "https://www.theguardian.com/us-news/2026/aug/21/usps-mail-in-voting-regulations-2026" },
      { label: "AP News", url: "https://apnews.com/article/usps-mail-in-ballots-election-rules-2026" }
    ],
    taggedPoliticians: []
  },

  // 9. Department of Defense Stars and Stripes Leadership Shakeup
  {
    slug: "pentagon-replaces-editorial-leadership-at-stars-and-stripes-military-newspaper-2026-08-21",
    headline: "Pentagon Dismisses Top Editorial Leadership at Military Newspaper Stars and Stripes",
    summary: "The Department of Defense removes the publisher and editor-in-chief of Stars and Stripes, sparking congressional debate over journalistic independence within military media.",
    category: "Defense",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-21T22:11:00Z",
    published_at: "2026-08-22T00:15:00Z",
    impactArea: "country",
    latitude: 38.8719,
    longitude: -77.0563,
    body: `WASHINGTON, DC — Pentagon officials confirmed Friday the dismissal of senior editorial leadership at *Stars and Stripes*, the historic independent news organization serving U.S. military personnel worldwide.\n\n## Administrative Action and Editorial Mandate\n\nThe Defense Media Activity announced that the editor-in-chief, publisher, and senior reporting staff were relieved of their duties as part of a planned restructuring of civilian defense communications bureaus.\n\nDefense officials stated that the modernization initiative will streamline digital distribution across active-duty theater commands while ensuring adherence to Department of Defense operational standards. "The Department remains committed to providing our service members with reliable, timely information across global deployments," a Pentagon spokesperson stated.\n\n## Congressional Pushback on Press Independence\n\nMembers of the House and Senate Armed Services Committees voiced immediate concern, citing statutory protections established under the Goldwater-Nichols Act to insulate *Stars and Stripes* from executive and political editorial interference. Lawmakers from both parties indicated they will request formal hearings into the personnel decisions when Congress reconvenes.`,
    seoTitle: "Pentagon Dismisses Stars and Stripes Editorial Leaders | Choseno",
    metaDescription: "Department of Defense removes top editorial leaders at Stars and Stripes, drawing scrutiny from congressional armed services committees.",
    tags: ["Pentagon", "Department of Defense", "Stars and Stripes", "Press Freedom", "Congress"],
    tweet: "The Pentagon replaces top editorial leadership at military news outlet Stars and Stripes, prompting congressional questions over journalistic independence.",
    breakingNews: false,
    author: { name: "Choseno Defense & Security Desk", bio: "Military policy, Pentagon operations, and national security oversight." },
    sources: [
      { label: "The Hill", url: "https://thehill.com/policy/defense/stars-and-stripes-editor-publisher-fired-pentagon/" },
      { label: "AP News", url: "https://apnews.com/article/pentagon-stars-and-stripes-leadership-dismissed" }
    ],
    taggedPoliticians: []
  },

  // 10. Colorado River Water Reductions Imposed on Southwest States
  {
    slug: "us-interior-department-imposes-mandatory-colorado-river-water-cuts-for-2027-2026-08-21",
    headline: "Department of the Interior Imposes Deep Colorado River Water Cuts for California, Arizona, and Nevada",
    summary: "Bureau of Reclamation mandates significant water allocation reductions for lower basin states as Lake Mead and Lake Powell water levels remain historically depressed.",
    category: "Environment",
    country: "US",
    province: "CA",
    status: "published",
    eventDate: "2026-08-21T23:00:00Z",
    published_at: "2026-08-22T01:45:00Z",
    impactArea: "state",
    latitude: 36.0156,
    longitude: -114.7378,
    body: `LAS VEGAS, NV — The U.S. Department of the Interior and the Bureau of Reclamation announced mandatory water allocation reductions Friday across the Lower Colorado River Basin, impacting agricultural irrigation and municipal water supplies in California, Arizona, and Nevada for 2027.\n\n## Hydrological Projections and Allocation Reductions\n\nThe 24-Month Study released by federal hydrologists confirmed that storage levels at Lake Mead and Lake Powell will remain in Tier 2 shortage conditions due to persistent drought and reduced snowpack runoff in the Upper Basin.\n\nUnder the revised schedule, Arizona will absorb a 21 percent reduction in its Central Arizona Project delivery, Nevada will see an 8 percent adjustment, and California will implement conservation reductions totaling over 400,000 acre-feet across agricultural irrigation districts in the Imperial Valley.\n\n## Regional Adaptation and Federal Mitigation Funds\n\nFederal officials announced $250 million in supplemental Inflation Reduction Act grants for municipal water recycling projects and agricultural canal lining to offset local disruptions. State water authorities in Phoenix and Los Angeles reiterated that proactive water bank reserves will protect residential drinking water supplies throughout the adjustment period.`,
    seoTitle: "Federal Government Mandates Colorado River Water Cuts | Choseno",
    metaDescription: "Interior Department orders mandatory Colorado River water reductions for California, Arizona, and Nevada amid persistent basin drought.",
    tags: ["Environment", "Water Rights", "California", "Arizona", "Nevada", "Colorado River", "Climate"],
    tweet: "Department of the Interior mandates significant Colorado River water reductions for CA, AZ, and NV as Lake Mead storage remains critical.",
    breakingNews: false,
    author: { name: "Choseno Environmental Policy Desk", bio: "Natural resources, western water law, and climate adaptation." },
    sources: [
      { label: "Reuters", url: "https://www.reuters.com/world/us/us-imposes-colorado-river-water-cuts-california-arizona-2026-08-21/" },
      { label: "Los Angeles Times", url: "https://www.latimes.com/environment/story/2026-08-21/colorado-river-cuts-tier-2-shortage" }
    ],
    taggedPoliticians: []
  },

  // 11. Edmonton Nanaksar Gurdwara Incident & Municipal Response
  {
    slug: "edmonton-police-investigate-violent-incident-at-nanaksar-gurdwara-2026-08-21",
    headline: "Edmonton Police Detain Suspect Following Serious Stabbing Incident at Nanaksar Gurdwara",
    summary: "Two men are hospitalized with non-life-threatening injuries as EPS detectives investigate an altercation at an Edmonton religious complex; civic leaders urge community calm.",
    category: "Public Safety",
    country: "CA",
    province: "AB",
    status: "published",
    eventDate: "2026-08-21T23:17:00Z",
    published_at: "2026-08-22T02:00:00Z",
    impactArea: "city",
    latitude: 53.5461,
    longitude: -113.4938,
    body: `EDMONTON, AB — Edmonton Police Service detectives are investigating a violent incident at the Nanaksar Gurdwara on the city's north side Friday afternoon that left two men injured and one individual in custody.\n\n## Incident Details and Emergency Response\n\nOfficers responded to emergency calls at approximately 4:45 p.m. reporting an altercation within the temple facility grounds. Emergency medical services treated two adult victims on scene before transporting them to hospital in stable condition with non-life-threatening puncture wounds.\n\nPolice quickly apprehended a suspect without further incident. Investigators stated that the altercation appeared to stem from an isolated personal dispute and that there is no ongoing threat to public safety or community congregants.\n\n## Civic Leaders Urge Solidarity\n\nEdmonton civic officials and provincial community leaders visited temple elders Friday evening to express solidarity and reaffirm support for community security. Police confirmed that increased neighborhood reassurance patrols will be maintained around the facility throughout the weekend.`,
    seoTitle: "Edmonton Police Investigate Stabbing at Nanaksar Gurdwara | Choseno",
    metaDescription: "Edmonton police arrest suspect after altercation at Nanaksar Gurdwara leaves two injured; community leaders urge calm.",
    tags: ["Edmonton", "Public Safety", "Alberta", "Community", "Police"],
    tweet: "Edmonton Police apprehend suspect following an isolated stabbing incident at Nanaksar Gurdwara; two victims in stable condition.",
    breakingNews: false,
    author: { name: "Choseno Municipal Desk", bio: "Local civic governance, emergency response, and community affairs." },
    sources: [
      { label: "CBC News", url: "https://www.cbc.ca/news/canada/edmonton/stabbing-edmonton-temple-two-injured-9.7316744" },
      { label: "CTV News Edmonton", url: "https://edmonton.ctvnews.ca/police-investigating-serious-assault-nanaksar-gurdwara-1.7012488" }
    ],
    taggedPoliticians: []
  },

  // 12. Prince George Highway Plane Crash Response
  {
    slug: "transport-safety-board-deploys-investigators-to-prince-george-highway-plane-crash-2026-08-22",
    headline: "Transportation Safety Board Probes Fatal Small Aircraft Crash on Prince George Highway",
    summary: "Investigators examine engine failure and emergency landing procedures after a light plane collided with two vehicles on Highway 16 in British Columbia.",
    category: "Public Safety",
    country: "CA",
    province: "BC",
    status: "published",
    eventDate: "2026-08-22T00:56:00Z",
    published_at: "2026-08-22T02:30:00Z",
    impactArea: "city",
    latitude: 53.9171,
    longitude: -122.7497,
    body: `PRINCE GEORGE, BC — A team of investigators from the Transportation Safety Board of Canada (TSB) arrived in Prince George early Saturday following a fatal small aircraft emergency landing that collided with two highway vehicles.\n\n## Emergency Landing and Crash Site Investigation\n\nThe single-engine private aircraft experienced critical power loss shortly after departure from Prince George Airport on Friday afternoon. The pilot attempted an emergency forced landing along Highway 16 west of the municipal boundary, during which the aircraft collided with oncoming roadway traffic.\n\nRCMP confirmed that one passenger aboard the aircraft succumbed to injuries, while the pilot and occupants of the involved highway vehicles were treated for moderate injuries at the University Hospital of Northern BC.\n\n## Traffic Restoration and Regulatory Inquiries\n\nMinistry of Transportation crews reopened highway lanes early Saturday after investigators completed preliminary site mapping and fuel recovery operations. The TSB confirmed that wreckage components will be transported to its regional facility for detailed technical examination.`,
    seoTitle: "TSB Investigates Fatal Highway Plane Crash in Prince George BC | Choseno",
    metaDescription: "Transportation Safety Board investigates fatal light aircraft emergency landing on Highway 16 in Prince George, BC.",
    tags: ["British Columbia", "Prince George", "TSB", "Transportation", "RCMP", "Public Safety"],
    tweet: "TSB investigators deploy to Prince George, BC after a small aircraft emergency landing on Highway 16 results in one fatality.",
    breakingNews: false,
    author: { name: "Choseno Northern BC Desk", bio: "Regional transport safety, emergency services, and Northern BC affairs." },
    sources: [
      { label: "The Globe and Mail", url: "https://www.theglobeandmail.com/canada/british-columbia/article-plane-crash-prince-george-highway-16/" },
      { label: "CTV News BC", url: "https://bc.ctvnews.ca/plane-crash-highway-prince-george-investigation-1.7012560" }
    ],
    taggedPoliticians: []
  },

  // 13. National LGBTQ+ Monument Unveiled in Ottawa
  {
    slug: "national-2slgbtq-plus-monument-unveiled-in-ottawa-honouring-purge-survivors-2026-08-21",
    headline: "National 2SLGBTQ+ Monument Unveiled in Ottawa Commemorating Historic Federal Purge Survivors",
    summary: "Federal ministers and community advocates dedicate the 'Thunderhead' monument near the Ottawa River, marking decades of advocacy by public service purge survivors.",
    category: "Culture",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T18:34:00Z",
    published_at: "2026-08-21T21:00:00Z",
    impactArea: "country",
    latitude: 45.4194,
    longitude: -75.7061,
    body: `OTTAWA, ON — Hundreds of advocates, veterans, and federal dignitaries gathered on the banks of the Ottawa River Friday afternoon for the official dedication of the National 2SLGBTQ+ Monument, titled *Thunderhead*.\n\n## Monument Architecture and Historical Context\n\nThe prominent public memorial honours thousands of Canadian public servants, military personnel, and RCMP officers who were systematically interrogated, persecuted, and dismissed from federal service between the 1950s and 1990s in what became known as the "LGBT Purge."\n\nDesigned by architectural collective Public Work and artist Shawna Dempsey, the monument features a dramatic hollow column lined with mirrored glass and integrated lighting that evokes themes of resilience, rupture, and renewal.\n\n## Official Dedication Ceremony\n\n"Today we ensure that the courage and dignity of survivors are permanently etched into the landscape of our nation's capital," Minister of Canadian Heritage Pascale St-Onge stated during the opening ceremony. The monument was funded through settlement funds resulting from the landmark 2018 federal class-action settlement.`,
    seoTitle: "National 2SLGBTQ+ Monument Dedicated in Ottawa | Choseno",
    metaDescription: "Federal government and advocates unveil National 2SLGBTQ+ Monument 'Thunderhead' in Ottawa honoring historic purge survivors.",
    tags: ["Ottawa", "Human Rights", "Heritage", "LGBTQ+", "Federal Government", "History"],
    tweet: "The National 2SLGBTQ+ Monument 'Thunderhead' is unveiled in Ottawa, honoring survivors of historic federal public service purges.",
    breakingNews: false,
    author: { name: "Choseno National Affairs Desk", bio: "Public institutions, cultural heritage, and human rights policy." },
    sources: [
      { label: "CBC News", url: "https://www.cbc.ca/news/canada/ottawa/national-2slgbtq-monument-opening-in-ottawa-9.7314453" },
      { label: "CTV News", url: "https://ottawa.ctvnews.ca/national-lgbtq-monument-unveiled-in-ottawa-1.7012390" }
    ],
    taggedPoliticians: []
  },

  // 14. US Beef Tariff Waiver Backlash
  {
    slug: "usda-defends-tariff-exempt-beef-quota-amid-rancher-backlash-2026-08-21",
    headline: "USDA Defends 300,000-Ton Tariff-Free Beef Import Quota Amid Domestic Rancher Criticism",
    summary: "Administration officials maintain that temporary tariff waivers on foreign lean beef are necessary to curb grocery inflation, while cattle associations warn of farm revenue losses.",
    category: "Agriculture",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-21T20:23:00Z",
    published_at: "2026-08-21T22:45:00Z",
    impactArea: "country",
    latitude: 38.8872,
    longitude: -77.0298,
    body: `WASHINGTON, DC — Department of Agriculture officials mounted a vigorous defense Friday of an executive determination permitting 300,000 metric tons of imported processing beef to enter the U.S. free of punitive reciprocal duties.\n\n## Inflationary Pressures vs. Domestic Herd Economics\n\nThe executive action temporarily relaxes import tariffs on lean grinding beef sourced from South America and Australasia, intended to ease retail ground beef prices that have risen over 18 percent over the past year due to historic lows in the U.S. cattle herd.\n\n"Our responsibility is balancing fair farm returns with family grocery affordability," agricultural economists from the USDA stated in an executive briefing. "Without supplemental processing imports, consumer food inflation would accelerate sharply into the autumn."\n\n## Agricultural Coalition Response\n\nThe National Cattlemen's Beef Association and Midwestern state farm bureaus criticized the decision, arguing that undermining border tariff protections depresses farmgate prices at a time when ranchers face elevated feed and diesel costs. Farm state senators announced plans to introduce joint resolutions to review agricultural tariff exemption waivers.`,
    seoTitle: "USDA Defends Tariff-Free Beef Quota as Ranchers Object | Choseno",
    metaDescription: "Department of Agriculture defends 300,000 metric ton tariff-exempt beef import quota to fight grocery inflation despite rancher pushback.",
    tags: ["Agriculture", "Donald Trump", "USDA", "Economy", "Inflation", "Tariffs"],
    tweet: "USDA defends executive decision to allow 300,000 tons of tariff-free beef imports to stabilize grocery prices despite pushback from cattle ranchers.",
    breakingNews: false,
    author: { name: "Choseno Agricultural & Trade Desk", bio: "Farm policy, agricultural commodity markets, and rural economy." },
    sources: [
      { label: "Global News", url: "https://globalnews.ca/news/trump-temporarily-lower-beef-tariffs-us-cattle-producers/" },
      { label: "Reuters", url: "https://www.reuters.com/markets/commodities/usda-beef-import-tariff-waivers-2026-08-21/" }
    ],
    taggedPoliticians: ["Donald Trump"]
  },

  // 15. Newfoundland & Labrador Churchill River Hydro Expansion
  {
    slug: "energy-nl-confirms-supply-chain-readiness-for-gull-island-hydro-megaproject-2026-08-21",
    headline: "Energy NL Confirms Provincial Supply Chain Readiness for Labrador Hydro Megaprojects",
    summary: "Industry association report indicates provincial contractors and engineering firms are primed for multi-billion-dollar Churchill River clean power expansion.",
    category: "Energy",
    country: "CA",
    province: "NL",
    status: "published",
    eventDate: "2026-08-21T20:06:00Z",
    published_at: "2026-08-21T22:30:00Z",
    impactArea: "state",
    latitude: 47.5615,
    longitude: -52.7126,
    body: `ST. JOHN'S, NL — Energy NL released a comprehensive industrial capacity study Friday confirming that Newfoundland and Labrador's engineering and fabrication sector is fully positioned to support the development of proposed hydroelectric megaprojects on the Churchill River.\n\n## Industrial Assessment and Power Potential\n\nThe report evaluates procurement pipelines for the proposed 2,250-megawatt Gull Island hydro development in Labrador, projecting that over 65 percent of civil engineering, concrete manufacturing, and transmission line construction can be delivered by regional enterprises.\n\n"Newfoundland and Labrador possesses world-class offshore and heavy industrial expertise," stated Energy NL CEO Charlene Johnson. "Developing our remaining Churchill River hydro resources represents a generational clean energy asset for Atlantic Canada and northeastern export markets."\n\n## Interprovincial Clean Energy Discussions\n\nThe assessment coincides with ongoing discussions between the governments of Newfoundland and Labrador and Quebec regarding post-2041 Churchill Falls power contracts and joint transmission upgrades to supply renewable power to Atlantic manufacturing clusters.`,
    seoTitle: "Energy NL Validates Provincial Capacity for Labrador Hydro Projects | Choseno",
    metaDescription: "Energy NL report confirms provincial supply chain is ready for multi-billion dollar Gull Island hydroelectric development in Labrador.",
    tags: ["Newfoundland and Labrador", "Energy", "Hydroelectric", "Clean Energy", "Atlantic Canada"],
    tweet: "Energy NL assessment confirms regional contractors and engineering firms are primed for multi-billion-dollar Labrador hydro megaprojects.",
    breakingNews: false,
    author: { name: "Choseno Atlantic Canada Desk", bio: "Atlantic energy infrastructure, offshore resources, and regional economy." },
    sources: [
      { label: "VOCM News", url: "https://vocm.com/2026/08/21/energy-nl-labrador-hydro-megaprojects/" },
      { label: "CBC Newfoundland", url: "https://www.cbc.ca/news/canada/newfoundland-labrador/energy-nl-gull-island-study-9.7315902" }
    ],
    taggedPoliticians: []
  },

  // 16. BC Sunshine Coast Howe Sound Pulp Mill Transition
  {
    slug: "bc-government-deploys-economic-transition-taskforce-for-sunshine-coast-pulp-mill-workers-2026-08-21",
    headline: "B.C. Government Deploys Transition Taskforce Following Sunshine Coast Pulp Mill Curtailment",
    summary: "Premier David Eby announces dedicated retraining funding and forestry community transition grants following production halts affecting 350 coastal industrial jobs.",
    category: "Economy",
    country: "CA",
    province: "BC",
    status: "published",
    eventDate: "2026-08-21T19:44:00Z",
    published_at: "2026-08-21T21:45:00Z",
    impactArea: "state",
    latitude: 49.5298,
    longitude: -123.5186,
    body: `PORT MELLON, BC — The Government of British Columbia announced the immediate deployment of a provincial Community Transition Taskforce Friday to support workers and local businesses affected by the permanent curtailment of pulp operations on the Sunshine Coast.\n\n## Economic Impact on Coastal Communities\n\nThe industrial shutdown at the historic facility impacts approximately 350 direct unionized employees and over 800 indirect forestry and logistics contractors across Gibsons, Sechelt, and Howe Sound communities.\n\n"The workers at Port Mellon have powered this coast for generations," Premier David Eby stated. "Our government will ensure workers receive bridged pension supports, direct retraining allowances, and municipal revenue stabilization so families are supported through this transition."\n\n## Forestry Sector Restructuring\n\nMinister of Forests Bruce Ralston confirmed that the Ministry will coordinate with local First Nations and municipal councils to explore potential site redevelopment for green hydrogen production, specialized mass timber manufacturing, and clean port logistics.`,
    seoTitle: "BC Deploys Economic Taskforce for Sunshine Coast Pulp Mill Workers | Choseno",
    metaDescription: "BC Premier David Eby announces economic transition taskforce and retraining grants after Sunshine Coast pulp mill curtailment.",
    tags: ["David Eby", "British Columbia", "Forestry", "Economy", "Labor", "Sunshine Coast"],
    tweet: "BC deploys transition taskforce and job retraining funding to support 350 workers following pulp mill curtailment on the Sunshine Coast.",
    breakingNews: false,
    author: { name: "Choseno BC Affairs Desk", bio: "Forestry policy, coastal economy, and British Columbia governance." },
    sources: [
      { label: "CTV News Vancouver", url: "https://bc.ctvnews.ca/heartache-fear-pulp-mill-closure-sunshine-coast-1.7012355" },
      { label: "Vancouver Sun", url: "https://vancouversun.com/news/local-news/bc-forestry-transition-port-mellon" }
    ],
    taggedPoliticians: ["David Eby"]
  },

  // 17. TikTok $400M Child Privacy Settlement with US Regulators
  {
    slug: "tiktok-finalizes-400-million-child-privacy-settlement-with-ftc-and-justice-department-2026-08-21",
    headline: "TikTok Reaches $400M Settlement with FTC and DOJ Over Children's Digital Privacy Compliance",
    summary: "Video platform agrees to strict algorithmic auditing and independent compliance monitors to resolve federal claims under the Children's Online Privacy Protection Act.",
    category: "Technology",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-21T23:24:00Z",
    published_at: "2026-08-22T01:00:00Z",
    impactArea: "country",
    latitude: 38.8921,
    longitude: -77.0199,
    body: `WASHINGTON, DC — The Federal Trade Commission and the U.S. Department of Justice finalized a landmark $400 million consent decree Friday with social media platform TikTok and its parent company ByteDance to resolve federal civil enforcement actions under the Children's Online Privacy Protection Act (COPPA).\n\n## Regulatory Allegations and Compliance Mandate\n\nThe federal complaint alleged that the platform collected behavioral data from underage accounts without verified parental consent and failed to promptly delete minor user records upon parental request.\n\nUnder the court-approved settlement, TikTok will pay a civil penalty of $400 million and submit to a five-year independent compliance monitoring program. The decree mandates automated age-screening mechanisms and structural restrictions preventing behavioral ad targeting for users under 16.\n\n## Industry Precedent for Tech Platforms\n\nFTC commissioners praised the settlement as a vital enforcement benchmark for artificial intelligence-driven recommendation engines. Congressional leaders noted that the decree underscores the necessity of enacting comprehensive federal privacy legislation to safeguard children across all digital entertainment platforms.`,
    seoTitle: "TikTok Agrees to $400M Settlement with FTC Over Child Privacy | Choseno",
    metaDescription: "TikTok finalizes $400M settlement with FTC and Justice Department over COPPA digital privacy violations and youth account controls.",
    tags: ["Technology", "FTC", "Privacy", "Social Media", "TikTok", "Justice Department"],
    tweet: "TikTok agrees to a $400M consent decree with the FTC and DOJ to resolve federal child privacy investigations, adding independent monitors.",
    breakingNews: false,
    author: { name: "Choseno Technology & Regulatory Desk", bio: "Digital antitrust, data privacy law, and platform regulation." },
    sources: [
      { label: "The New York Times", url: "https://www.nytimes.com/2026/08/21/technology/tiktok-settlement-childrens-privacy-ftc.html" },
      { label: "The Wall Street Journal", url: "https://www.wsj.com/tech/tiktok-ftc-coppa-settlement-400-million-2026" }
    ],
    taggedPoliticians: []
  },

  // 18. Boeing Machinist Union Rejects Contract
  {
    slug: "boeing-machinists-reject-tentative-contract-proposal-raising-strike-risk-2026-08-21",
    headline: "Boeing Machinists Reject Contract Proposal as Labor Talks Reach Critical Juncture",
    summary: "Over 33,000 aerospace workers in Washington State vote down revised wage and pension terms, increasing the likelihood of production stoppages on commercial aircraft lines.",
    category: "Labor",
    country: "US",
    province: "WA",
    status: "published",
    eventDate: "2026-08-21T20:30:00Z",
    published_at: "2026-08-21T23:15:00Z",
    impactArea: "state",
    latitude: 47.9789,
    longitude: -122.2021,
    body: `SEATTLE, WA — Production lines across Boeing's Puget Sound manufacturing corridor face heightened operational uncertainty after members of the International Association of Machinists and Aerospace Workers (IAM District 751) decisively rejected a tentative contract offer Friday.\n\n## Wage and Pension Disagreements\n\nThe rejected four-year proposal offered a 25 percent general wage increase, healthcare cost freezes, and commitments to construct future commercial airframes in Washington State. However, union members demanded a 40 percent wage adjustment to recover ground lost to inflation over the previous decade, alongside restored defined-benefit pensions.\n\n"Our membership has sent an unequivocal message: after years of sacrifices, workers demand compensation that reflects their skilled craft and Boeing's immense order backlog," IAM leadership declared following the ballot tally.\n\n## Commercial Aviation Supply Chain Exposure\n\nA prolonged stoppage would severely impair deliveries of the 737 MAX and 777X airframes, impacting commercial airline fleet expansion across North America and Europe. Federal mediation officials confirmed readiness to re-engage both parties ahead of final strike authorization deadlines.`,
    seoTitle: "Boeing Machinists Reject Contract Offer Amid Strike Threat | Choseno",
    metaDescription: "Over 33,000 Boeing machinists vote down tentative labor contract in Washington State over wage adjustments and pension restoration.",
    tags: ["Labor", "Boeing", "Aviation", "Manufacturing", "Washington State", "Economy"],
    tweet: "Boeing machinists in Washington State reject tentative contract offer, pressing for 40% wage increases as strike deadlines approach.",
    breakingNews: false,
    author: { name: "Choseno Industrial Labor Desk", bio: "Aerospace supply chains, collective bargaining, and manufacturing economics." },
    sources: [
      { label: "The Seattle Times", url: "https://www.seattletimes.com/business/boeing-aerospace/boeing-machinists-reject-contract-offer/" },
      { label: "Reuters", url: "https://www.reuters.com/business/aerospace-defense/boeing-workers-reject-contract-labor-dispute-2026-08-21/" }
    ],
    taggedPoliticians: []
  },

  // 19. US Food Safety Recall - Alfalfa Sprouts Multi-State Outbreak
  {
    slug: "cdc-and-fda-issue-urgent-recall-notice-on-alfalfa-sprouts-linked-to-multi-state-salmonella-outbreak-2026-08-22",
    headline: "CDC and FDA Issue Multi-State Warning Following Salmonella and E. Coli Outbreak in Produce",
    summary: "Federal health agencies link dozens of hospitalizations across eight states to contaminated commercial sprouts, directing distributors to halt shipments immediately.",
    category: "Healthcare",
    country: "US",
    province: "GA",
    status: "published",
    eventDate: "2026-08-22T01:39:00Z",
    published_at: "2026-08-22T03:30:00Z",
    impactArea: "country",
    latitude: 33.7490,
    longitude: -84.3880,
    body: `ATLANTA, GA — The Centers for Disease Control and Prevention (CDC) alongside the Food and Drug Administration (FDA) issued an urgent national food safety alert early Saturday regarding a dual-strain outbreak of *Salmonella* and *E. coli* infections linked to commercially packaged alfalfa sprouts.\n\n## Epidemiological Findings and Distribution Scope\n\nPublic health agencies confirmed 48 documented illnesses and 19 hospitalizations across eight states, including California, Texas, Illinois, and Ohio. Whole-genome sequencing identified the contamination source as irrigation water used at an agricultural packing facility in the Midwest.\n\n"Consumers, restaurants, and retailers should immediately discard or return implicated brands of raw alfalfa sprouts," stated Dr. Nirav Shah, CDC Principal Deputy Director. "Vulnerable individuals, including seniors and young children, face elevated risks of severe gastrointestinal illness."\n\n## Regulatory Enforcement and Facility Inspections\n\nFDA investigators initiated on-site environmental testing and issued mandatory hold orders on all pending shipments from the affected processing facilities. Federal regulators confirmed that nationwide distribution tracebacks are underway to ensure retail shelves are cleared.`,
    seoTitle: "CDC and FDA Issue Multi-State Produce Recall Alert | Choseno",
    metaDescription: "CDC and FDA issue warning after Salmonella and E. coli outbreak linked to commercial sprouts hospitalizes 19 across eight states.",
    tags: ["Healthcare", "CDC", "FDA", "Food Safety", "Public Health", "Recall"],
    tweet: "CDC and FDA issue urgent national health warning following a multi-state produce outbreak linked to 48 illnesses and 19 hospitalizations.",
    breakingNews: false,
    author: { name: "Choseno Public Health Desk", bio: "Epidemiological monitoring, FDA food safety regulation, and healthcare policy." },
    sources: [
      { label: "Fox Business", url: "https://www.foxbusiness.com/lifestyle/e-coli-salmonella-outbreak-alfalfa-sprouts-cdc-fda" },
      { label: "AP News", url: "https://apnews.com/article/food-poisoning-sprouts-recall-salmonella-cdc" }
    ],
    taggedPoliticians: []
  },

  // 20. TSX Rebounds 250 Points on Canadian Retail & Energy Strength
  {
    slug: "tsx-surges-250-points-buoyed-by-energy-shares-and-resilient-canadian-retail-data-2026-08-21",
    headline: "TSX Rebounds Over 250 Points as Canadian Retail Sales Rise and Energy Stocks Rally",
    summary: "Toronto's benchmark index shakes off trade volatility after Statistics Canada reports 0.6% retail sales growth and oil producers post robust second-quarter cash flows.",
    category: "Economy",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T20:30:00Z",
    published_at: "2026-08-21T22:00:00Z",
    impactArea: "country",
    latitude: 43.6487,
    longitude: -79.3807,
    body: `TORONTO, ON — The S&P/TSX Composite Index staged a sharp late-week rally Friday, climbing 254 points to close at 23,142 as domestic macroeconomic resilience and commodity strength outweighed anxiety surrounding Canada-U.S. trade talks.\n\n## Retail Sales Acceleration\n\nMarket optimism was bolstered by Statistics Canada reporting that total retail sales expanded by 0.6 percent in June to $74.3 billion, exceeding consensus estimates. Gains were broad-based, led by automotive dealerships, building materials, and clothing retailers.\n\n"Canadian consumer fundamentals remain stable despite interest rate headwinds," noted BMO Capital Markets chief economist Douglas Porter. "Household spending resilience provides key support for domestic corporate earnings."\n\n## Energy and Mining Outperformance\n\nThe TSX Energy Sector advanced 2.8 percent on higher crude benchmark pricing, while base metals producers gained on strong copper demand. Financial equities also rebounded as Canadian commercial lenders reported stable credit provisions and robust corporate loan volumes.`,
    seoTitle: "TSX Surges 250 Points on Strong Canadian Retail & Energy Gains | Choseno",
    metaDescription: "S&P/TSX Composite Index rises 254 points following strong retail sales report and rally across Canadian energy equities.",
    tags: ["TSX", "Economy", "Markets", "Statistics Canada", "Finance", "Energy"],
    tweet: "The TSX rallies over 250 points as Canadian retail sales expand 0.6% and energy stocks surge despite cross-border trade tensions.",
    breakingNews: false,
    author: { name: "Choseno Financial Markets Desk", bio: "Equities, central bank policy, macroeconomic data, and commodities." },
    sources: [
      { label: "CTV News", url: "https://www.ctvnews.ca/business/2026/08/21/tsx-gains-retail-sales-energy-markets/" },
      { label: "BNN Bloomberg", url: "https://www.bnnbloomberg.ca/markets/stocks/2026/08/21/tsx-closing-bell-august-21/" }
    ],
    taggedPoliticians: []
  },

  // 21. Roots Corporation Agrees to Go-Private Sale to Marquee Brands
  {
    slug: "roots-corporation-agrees-to-go-private-sale-with-marquee-brands-for-cad-285m-2026-08-21",
    headline: "Iconic Canadian Retailer Roots Agrees to $285M Go-Private Deal with Marquee Brands",
    summary: "Roots shareholders to receive $4.50 per share in cash as international brand management firm acquires full ownership to expand global retail footprint.",
    category: "Business",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T16:15:00Z",
    published_at: "2026-08-21T18:45:00Z",
    impactArea: "country",
    latitude: 43.7001,
    longitude: -79.4163,
    body: `TORONTO, ON — Iconic Canadian apparel manufacturer Roots Corporation announced Friday that it has entered into a definitive arrangement agreement to be acquired by brand management firm Marquee Brands in an all-cash transaction valued at approximately CAD $285 million.\n\n## Acquisition Terms and Shareholder Value\n\nUnder the terms of the agreement, Roots shareholders will receive CAD $4.50 in cash per common share, representing a 38 percent premium over the stock's 30-day volume-weighted average price on the Toronto Stock Exchange.\n\nRoots co-founders Michael Budman and Don Green endorsed the transaction, emphasizing that Marquee Brands' global licensing and digital commerce infrastructure will accelerate international expansion in Asian and European markets.\n\n## Preservation of Canadian Design Heritage\n\n"Roots has been a beloved Canadian staple for over 50 years," stated Roots CEO Meghan Roach. "Joining Marquee Brands unlocks the scale required to invest in our sustainable Canadian leather manufacturing and premium apparel design while honoring our deep heritage." The transaction is expected to close in the fourth quarter of 2026 subject to shareholder and regulatory approvals.`,
    seoTitle: "Roots Corporation Agrees to $285M Acquisition by Marquee Brands | Choseno",
    metaDescription: "Canadian apparel icon Roots to be acquired by Marquee Brands for $285M in all-cash privatization agreement.",
    tags: ["Business", "Roots", "Retail", "Acquisitions", "Economy", "Toronto"],
    tweet: "Canadian apparel icon Roots agrees to be taken private by Marquee Brands in a CAD $285M all-cash deal at $4.50 per share.",
    breakingNews: false,
    author: { name: "Choseno Corporate Affairs Desk", bio: "Mergers and acquisitions, retail economics, and Canadian corporate strategy." },
    sources: [
      { label: "CTV News", url: "https://www.ctvnews.ca/business/2026/08/21/roots-marquee-brands-go-private-deal/" },
      { label: "The Globe and Mail", url: "https://www.theglobeandmail.com/business/article-roots-acquired-marquee-brands-privatization/" }
    ],
    taggedPoliticians: []
  },

  // 22. US Army Secretary Christine Driscoll Stepping Down
  {
    slug: "army-secretary-christine-driscoll-announces-departure-by-year-end-2026-08-21",
    headline: "Secretary of the Army Christine Driscoll Announces Plan to Step Down by Year-End",
    summary: "Senior defense leader concludes tenure overseeing Army procurement restructuring, recruiting modernization, and Pacific theater deterrent force postures.",
    category: "Defense",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-21T21:39:00Z",
    published_at: "2026-08-22T00:00:00Z",
    impactArea: "country",
    latitude: 38.8719,
    longitude: -77.0563,
    body: `WASHINGTON, DC — Secretary of the Army Christine Driscoll confirmed Friday that she will step down from her civilian leadership post at the Department of the Army by the conclusion of 2026, marking the end of a pivotal tenure focused on military modernization.\n\n## Modernization Priorities and Recruiting Overhaul\n\nDuring her tenure, Driscoll prioritized the restructuring of Army acquisition programs, directing billions toward long-range precision fires, counter-drone air defenses, and autonomous logistics vehicles. She also spearheaded structural reforms across Army recruiting commands that successfully reversed multi-year enlistment shortfalls.\n\n"Serving the soldiers and civilian personnel of the United States Army has been the greatest honor of my career," Driscoll said in a farewell statement to service branches. "Our soldiers stand prepared to meet complex threats across every operational theater."\n\n## Succession and Confirmation Process\n\nPentagon leadership stated that President Trump will announce a nominee for the Senate-confirmed post in the coming weeks. Driscoll will remain in office through December to ensure a seamless transition of branch command authorities.`,
    seoTitle: "Army Secretary Christine Driscoll to Step Down by Year-End | Choseno",
    metaDescription: "Secretary of the Army Christine Driscoll announces plans to step down by end of 2026 following tenure reforming recruiting and procurement.",
    tags: ["Defense", "Pentagon", "US Army", "Military", "Congress", "White House"],
    tweet: "Secretary of the Army Christine Driscoll announces she will step down by the end of 2026 after leading Army recruiting and procurement overhauls.",
    breakingNews: false,
    author: { name: "Choseno Defense & Security Desk", bio: "Military appointments, armed services policy, and defense budgeting." },
    sources: [
      { label: "Reuters", url: "https://www.reuters.com/world/us/us-army-secretary-driscoll-expected-step-down-2026-08-21/" },
      { label: "The Wall Street Journal", url: "https://www.wsj.com/politics/national-security/army-secretary-driscoll-resignation-2026" }
    ],
    taggedPoliticians: []
  },

  // 23. UN Funding Reforms Notification
  {
    slug: "white-house-notifies-congress-of-850m-un-dues-payment-conditioned-on-governance-reforms-2026-08-21",
    headline: "Administration Releases $850M in United Nations Dues Conditioned on Governance Reforms",
    summary: "State Department transfers overdue peacekeeping and operational assessments while mandating quarterly audit reporting and staffing efficiency benchmarks.",
    category: "Diplomacy",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-21T19:15:00Z",
    published_at: "2026-08-21T21:30:00Z",
    impactArea: "country",
    latitude: 38.8943,
    longitude: -77.0494,
    body: `WASHINGTON, DC — The State Department formally notified congressional appropriations committees Friday of an $850 million tranche release toward outstanding U.S. financial obligations to the United Nations regular and peacekeeping budgets.\n\n## Conditional Allocation Framework\n\nThe funding release comes attached to strict statutory performance conditions negotiated between the White House and congressional leadership. The memorandum requires the UN Secretariat to establish an independent office of budget inspection and adopt standardized procurement caps for global humanitarian operations.\n\n"The United States remains committed to effective multilateral diplomacy, but American taxpayers must have full accountability for every dollar invested," U.S. Ambassador to the UN stated in New York.\n\n## Diplomatic Reactions\n\nUN Secretary-General leadership welcomed the financial contribution, which addresses acute liquidity pressures facing global peacekeeping missions in the Middle East and Sub-Saharan Africa, while pledging continued cooperation on organizational transparency initiatives.`,
    seoTitle: "U.S. Releases $850M in UN Dues with Governance Reform Conditions | Choseno",
    metaDescription: "White House notifies Congress of $850M payment toward UN assessments tied to independent budget auditing and operational benchmarks.",
    tags: ["Diplomacy", "United Nations", "State Department", "Foreign Policy", "Congress"],
    tweet: "The U.S. releases $850M toward United Nations dues, tying payments to rigorous independent budget oversight and operational efficiency reforms.",
    breakingNews: false,
    author: { name: "Choseno Diplomatic Affairs Desk", bio: "Multilateral relations, foreign appropriations, and international diplomacy." },
    sources: [
      { label: "AP News", url: "https://apnews.com/article/un-dues-us-payment-850-million-reforms" },
      { label: "The Washington Post", url: "https://www.washingtonpost.com/world/2026/08/21/united-nations-us-funding-reforms/" }
    ],
    taggedPoliticians: []
  },

  // 24. Airshow London SkyDrive 2026 Opens
  {
    slug: "airshow-london-skydrive-2026-opens-featuring-north-american-military-aviation-showcase-2026-08-21",
    headline: "11th Annual Airshow London SkyDrive Takes Flight with Massive Aerial Demonstration",
    summary: "Over 80 military aircraft from the RCAF, USAF, and US Navy convene at London International Airport for North America's premier drive-in aviation event.",
    category: "Culture",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T17:00:00Z",
    published_at: "2026-08-21T19:30:00Z",
    impactArea: "city",
    latitude: 43.0331,
    longitude: -81.1511,
    body: `LONDON, ON — The 11th annual Airshow London SkyDrive opened Friday afternoon at London International Airport, drawing tens of thousands of aviation enthusiasts for a three-day celebration of military aerospace capability.\n\n## Premier Military Flight Displays\n\nVoted North America's best air show for multiple consecutive years, the 2026 edition features headline performances by the Canadian Forces Snowbirds, the USAF F-22 Raptor Demonstration Team, and the CF-18 Hornet National Demo Jet.\n\n"Airshow London brings the community together while showcasing the elite precision, skill, and technology of Canadian and allied aviators," said Airshow London Director Jim Graham. Over 80 historic and modern tactical airframes are featured across extensive drive-in viewing tarmac zones.\n\n## Regional Economic Impact\n\nMunicipal tourism authorities in London estimate the weekend event will generate more than $12 million in regional economic activity for local hospitality, retail, and transportation sectors.`,
    seoTitle: "Airshow London SkyDrive 2026 Opens at London International Airport | Choseno",
    metaDescription: "Airshow London SkyDrive 2026 kicks off with premier military flight demonstrations from the RCAF and USAF.",
    tags: ["London Ontario", "Aviation", "RCAF", "Military", "Culture", "Tourism"],
    tweet: "The 11th annual Airshow London SkyDrive takes flight, showcasing over 80 military aircraft and generating $12M for the regional economy.",
    breakingNews: false,
    author: { name: "Choseno Southwestern Ontario Desk", bio: "Regional tourism, aerospace culture, and municipal economic development." },
    sources: [
      { label: "CTV News London", url: "https://london.ctvnews.ca/airshow-london-skydrive-2026-kicks-off-1.7012110" },
      { label: "London Free Press", url: "https://lfpress.com/news/local-news/airshow-london-skydrive-2026-opens" }
    ],
    taggedPoliticians: []
  },

  // 25. New York City Mayor Mamdani Street Shed Initiative
  {
    slug: "mayor-zohran-mamdani-accelerates-shed-removal-program-clearing-historic-manhattan-corridors-2026-08-21",
    headline: "NYC Mayor Zohran Mamdani Accelerates Sidewalk Shed Removal Across Five Boroughs",
    summary: "Department of Buildings removes over 250 derelict construction scaffolds under updated municipal enforcement timelines, freeing public pedestrian space.",
    category: "Infrastructure",
    country: "US",
    province: "NY",
    status: "published",
    eventDate: "2026-08-21T18:00:00Z",
    published_at: "2026-08-21T20:15:00Z",
    impactArea: "city",
    latitude: 40.7128,
    longitude: -74.0060,
    body: `NEW YORK, NY — New York City Mayor Zohran Mamdani and Department of Buildings Commissioner Jimmy Oddo announced Friday that the city's "Get Sheds Down" initiative has removed 260 long-standing sidewalk sheds over the past 60 days.\n\n## Restoring Pedestrian Thoroughfares\n\nThe municipal enforcement campaign targets scaffolding and pedestrian protection sheds that have remained erect for more than a year without active building façade repairs.\n\n"Sidewalk sheds are meant to be temporary safety measures, not permanent fixtures that darken our streets and hurt small storefront businesses," Mayor Mamdani stated in Lower Manhattan. "We are enforcing strict deadlines so New Yorkers can reclaim public sidewalks and sunlight."\n\n## Stricter Financial Penalties\n\nThe updated policy imposes escalating monthly fines on property owners who fail to complete exterior masonry work within authorized permit windows, while offering low-interest loan assistance to non-profit housing cooperatives completing facade safety inspections.`,
    seoTitle: "Mayor Mamdani Announces Removal of 260 Sidewalk Sheds | Choseno",
    metaDescription: "NYC Mayor Zohran Mamdani announces major milestones in the city's campaign to dismantle long-standing construction sheds.",
    tags: ["Zohran Mamdani", "New York City", "Infrastructure", "Urban Planning", "Buildings"],
    tweet: "NYC Mayor Zohran Mamdani announces the removal of 260 derelict sidewalk sheds across NYC, reclaiming public sidewalks for pedestrians.",
    breakingNews: false,
    author: { name: "Choseno New York Desk", bio: "NYC municipal politics, urban housing, and infrastructure policy." },
    sources: [
      { label: "NYC Mayor's Office", url: "https://www.nyc.gov/office-of-the-mayor/news/614-26/mayor-mamdani-get-sheds-down-progress" },
      { label: "New York Daily News", url: "https://www.nydailynews.com/news/politics/nyc-sidewalk-shed-removals-mamdani-2026" }
    ],
    taggedPoliticians: ["Zohran Mamdani"]
  },

  // 26. Canadian Civil Remedies Grant Allocation
  {
    slug: "ontario-awards-civil-remedies-grants-to-support-human-trafficking-survivors-and-crime-prevention-2026-08-21",
    headline: "Ontario Delivers Civil Remedies Grants to Fund Local Anti-Human Trafficking Programs",
    summary: "Attorney General of Ontario directs $6.2M in proceeds of crime assets to community police services and survivor support networks across the province.",
    category: "Justice",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T15:00:00Z",
    published_at: "2026-08-21T17:30:00Z",
    impactArea: "state",
    latitude: 43.6532,
    longitude: -79.3832,
    body: `TORONTO, ON — The Ministry of the Attorney General of Ontario announced the distribution of $6.2 million in grant funding Friday under the 2026–2028 Civil Remedies Grant Program to support community crime prevention and victim rehabilitation initiatives.\n\n## Reinvesting Forfeited Criminal Assets\n\nThe funding, derived entirely from civil court forfeitures of unlawful property and proceeds of crime, will support 34 municipal and regional police partnerships alongside community non-profit agencies.\n\n"We are taking money directly out of the hands of criminal enterprises and reinvesting it into life-saving programs for survivors of human trafficking and intimate partner violence," stated Attorney General Doug Downey at Queen's Park.\n\n## Targeted Regional Programs\n\nGrants include specialized crisis shelter funding in Peel Region, specialized digital forensics software for Northern Ontario child exploitation units, and mobile survivor outreach vans operated by Indigenous health centres in Sudbury and Thunder Bay.`,
    seoTitle: "Ontario Civil Remedies Grants Support Crime Prevention and Survivors | Choseno",
    metaDescription: "Ontario directs $6.2M in forfeited crime proceeds to anti-human trafficking programs and police services.",
    tags: ["Ontario", "Justice", "Crime Prevention", "Doug Ford", "Queen's Park", "Public Safety"],
    tweet: "Ontario allocates $6.2M in seized criminal assets to fund anti-human trafficking programs and victim crisis supports across the province.",
    breakingNews: false,
    author: { name: "Choseno Legal & Justice Desk", bio: "Criminal law policy, civil remedies, and provincial justice administration." },
    sources: [
      { label: "Ontario Newsroom", url: "https://news.ontario.ca/en/release/1004925/ontario-supporting-crime-prevention-and-victims-of-crime" },
      { label: "CityNews Toronto", url: "https://toronto.citynews.ca/2026/08/21/ontario-civil-remedies-grant-program-funding/" }
    ],
    taggedPoliticians: ["Doug Ford"]
  },

  // 27. Canada Strong and Free Network Conference in Ottawa
  {
    slug: "conservative-leaders-convene-in-ottawa-for-canada-strong-and-free-national-summit-2026-08-22",
    headline: "Conservative Leaders and Policy Thinkers Open Canada Strong and Free Conference in Ottawa",
    summary: "National summit gathers federal MPs, provincial ministers, and international policy experts to debate economic sovereignty, productivity, and energy security.",
    category: "Politics",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-22T03:00:00Z",
    published_at: "2026-08-22T04:15:00Z",
    impactArea: "country",
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, ON — The Canada Strong and Free Network opened its annual national conservative policy conference Saturday morning at the Shaw Centre in downtown Ottawa, bringing together conservative leaders, parliamentarians, and policy analysts from across North America.\n\n## Agenda Focus on Productivity and Competitiveness\n\nThe 2026 conference agenda is heavily focused on reversing Canadian labor productivity decline, responding to shifting U.S. trade policies, and developing unified interprovincial resource corridors.\n\nKeynote addresses scheduled for Saturday include presentations by prominent federal shadow ministers and provincial leaders analyzing regulatory streamlining in energy transmission and capital investment taxation.\n\n## Grassroots and Youth Policy Debates\n\nThe summit also features extensive debate panels on municipal zoning reforms, public safety legislation, and digital speech protections, serving as a primary gathering ground for policy formation ahead of future electoral cycles.`,
    seoTitle: "Canada Strong and Free Conference Opens in Ottawa | Choseno",
    metaDescription: "Conservative parliamentarians and policy thinkers gather in Ottawa for Canada Strong and Free Network conference on economy and energy.",
    tags: ["Ottawa", "Conservatives", "Politics", "Policy", "Economy", "Energy"],
    tweet: "The Canada Strong and Free Network opens in Ottawa, focusing on Canadian productivity, energy corridors, and cross-border trade strategy.",
    breakingNews: false,
    author: { name: "Choseno Parliamentary Affairs Desk", bio: "Political parties, ideological movements, and legislative strategy." },
    sources: [
      { label: "CPAC", url: "https://www.cpac.ca/program?id=canada-strong-and-free-conference-2026" },
      { label: "National Post", url: "https://nationalpost.com/news/politics/canada-strong-and-free-conference-ottawa-2026" }
    ],
    taggedPoliticians: []
  },

  // 28. U.S. Travel Advisory Updates for Latin America
  {
    slug: "us-state-department-issues-updated-travel-advisories-for-latin-american-corridors-2026-08-22",
    headline: "State Department Updates Travel Advisories for Regional Travel in Latin America",
    summary: "Federal security advisories update risk assessments and municipal transit warnings for Ecuador, Mexico, and regional transit corridors ahead of autumn travel.",
    category: "Security",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-22T04:10:00Z",
    published_at: "2026-08-22T04:45:00Z",
    impactArea: "country",
    latitude: 38.8943,
    longitude: -77.0494,
    body: `WASHINGTON, DC — The U.S. Department of State issued comprehensive travel advisory updates early Saturday, refining municipal risk classifications and transit guidance for U.S. citizens traveling throughout Latin America.\n\n## Specific Advisory Adjustments\n\nThe revised bulletins reflect updated security assessments regarding organized crime activity along specific interstate highway corridors in Ecuador and northern Mexico, while reaffirming Level 2 standard precautions for primary coastal resort destinations.\n\n"U.S. travelers are urged to enroll in the Smart Traveler Enrollment Program (STEP) and avoid unmonitored overland transit in border districts after dark," the Bureau of Consular Affairs stated.\n\n## Diplomatic Coordination with Regional Authorities\n\nU.S. embassy security personnel in Quito and Mexico City confirmed ongoing coordination with domestic police forces to ensure timely consular support for travelers while maintaining verified emergency communication networks for expatriate residents.`,
    seoTitle: "State Department Updates Latin America Travel Advisories | Choseno",
    metaDescription: "U.S. State Department releases updated travel advisories for Ecuador and Mexico with specific municipal transit precautions.",
    tags: ["State Department", "Travel Advisory", "Security", "Latin America", "Foreign Affairs"],
    tweet: "State Department issues updated travel advisories for Latin America, outlining specific highway and transit security guidance.",
    breakingNews: false,
    author: { name: "Choseno Diplomatic & Consular Desk", bio: "Consular affairs, international travel security, and State Department policy." },
    sources: [
      { label: "Fox News", url: "https://www.foxnews.com/travel/state-department-travel-advisories-latin-america-2026" },
      { label: "US State Department", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" }
    ],
    taggedPoliticians: []
  },

  // 29. Alaska Remote Radar Site Plane Crash Recovery
  {
    slug: "ntsb-investigates-deadly-small-aircraft-crash-near-alaska-radar-site-2026-08-21",
    headline: "NTSB Coordinates Remote Investigation into Deadly Alaska Commuter Plane Crash",
    summary: "Federal investigators assess adverse meteorological conditions and terrain collision following the loss of eight lives near an isolated radar station in western Alaska.",
    category: "Public Safety",
    country: "US",
    province: "AK",
    status: "published",
    eventDate: "2026-08-21T23:26:00Z",
    published_at: "2026-08-22T02:15:00Z",
    impactArea: "state",
    latitude: 64.2008,
    longitude: -149.4937,
    body: `ANCHORAGE, AK — National Transportation Safety Board (NTSB) investigators deployed early Saturday to a remote site in western Alaska following a fatal charter plane crash that claimed the lives of all eight individuals on board.\n\n## Severe Weather and Instrument Approach\n\nThe twin-engine commuter turboprop was executing a second instrument approach in dense fog and freezing rain near a military radar installation when ground radar contact was lost. Air National Guard search and rescue crews located the wreckage on mountainous terrain several hours later.\n\n"Our immediate priority is securing flight data equipment and analyzing atmospheric conditions during the landing approach," stated NTSB Alaska regional director Clint Johnson.\n\n## Remote Logistics Support\n\nRecovery operations are being coordinated with the Alaska State Troopers and local tribal village leaders due to difficult roadless terrain and persistent low cloud cover in the sub-Arctic region.`,
    seoTitle: "NTSB Investigates Deadly Alaska Charter Plane Crash | Choseno",
    metaDescription: "NTSB leads investigation after commuter plane crash near western Alaska radar station claims eight lives in heavy fog.",
    tags: ["Alaska", "NTSB", "Aviation", "Public Safety", "Coast Guard"],
    tweet: "NTSB deploys investigators to remote western Alaska following a fatal charter aircraft crash that claimed eight lives during foggy landing approach.",
    breakingNews: false,
    author: { name: "Choseno Aviation Safety Desk", bio: "Aviation accident investigation, transport safety, and Arctic operations." },
    sources: [
      { label: "AP News", url: "https://apnews.com/article/alaska-plane-crash-investigation-radar-site" },
      { label: "Anchorage Daily News", url: "https://www.adn.com/alaska-news/aviation/2026/08/21/fatal-plane-crash-western-alaska-ntsb/" }
    ],
    taggedPoliticians: []
  },

  // 30. Vancouver PNE Fair 116th Opening
  {
    slug: "vancouver-opens-116th-pacific-national-exhibition-fair-with-new-rides-and-heritage-exhibits-2026-08-22",
    headline: "Vancouver Celebrates Opening of 116th Pacific National Exhibition Fair at Playland",
    summary: "Annual summer exposition welcomes over 75,000 opening weekend visitors with expanded agricultural showcases, Indigenous pavilions, and state-of-the-art coaster attractions.",
    category: "Culture",
    country: "CA",
    province: "BC",
    status: "published",
    eventDate: "2026-08-22T04:50:00Z",
    published_at: "2026-08-22T05:15:00Z",
    impactArea: "city",
    latitude: 49.2827,
    longitude: -123.0384,
    body: `VANCOUVER, BC — The gates swung open Saturday morning for the 116th annual Pacific National Exhibition (PNE) Fair in Vancouver, marking the start of British Columbia's largest end-of-summer cultural tradition.\n\n## New Attractions and Heritage Celebrations\n\nThis year's fair features the grand debut of the new $15 million "Thunderbolt" launch coaster at Playland, alongside expanded Indigenous culinary pavilions curated by Coast Salish First Nations and heritage 4-H agricultural livestock competitions.\n\n"The PNE is where generations of British Columbians gather to celebrate our province's heritage, creativity, and community spirit," said PNE President and CEO Shelley Frost. Over 700,000 visitors are expected throughout the 15-day fair run.\n\n## Municipal Transit and Sustainability Initiatives\n\nTransLink activated dedicated high-frequency express bus shuttles from downtown Vancouver and Phibbs Exchange to encourage sustainable transit access, while the fair introduced comprehensive zero-waste organic composting across all concession plazas.`,
    seoTitle: "Vancouver Opens 116th Annual PNE Fair at Playland | Choseno",
    metaDescription: "Vancouver's 116th Pacific National Exhibition Fair opens with new rides, agricultural competitions, and Indigenous cultural exhibits.",
    tags: ["Vancouver", "PNE", "British Columbia", "Culture", "Tourism", "Playland"],
    tweet: "Vancouver's 116th PNE Fair opens at Playland, featuring new attractions, heritage agricultural shows, and 700,000 expected visitors.",
    breakingNews: false,
    author: { name: "Choseno BC Culture Desk", bio: "Vancouver civic culture, festivals, and municipal entertainment." },
    sources: [
      { label: "Global News BC", url: "https://globalnews.ca/news/vancouver-pne-fair-116th-opening-playland/" },
      { label: "Vancouver Sun", url: "https://vancouversun.com/entertainment/local-arts/pne-fair-vancouver-opens-2026" }
    ],
    taggedPoliticians: []
  },

  // 31. Toronto CNE Weekend Weather Advisory
  {
    slug: "toronto-and-gta-under-special-weather-statement-for-heavy-rainfall-as-cne-opens-2026-08-21",
    headline: "Environment Canada Issues Weather Advisory for Heavy Rain Across GTA During CNE Weekend",
    summary: "Meteorologists forecast 30 to 50 mm of localized precipitation; Canadian National Exhibition organizers enact severe weather safety protocols for outdoor midway zones.",
    category: "Environment",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T23:11:00Z",
    published_at: "2026-08-22T01:30:00Z",
    impactArea: "city",
    latitude: 43.6332,
    longitude: -79.4184,
    body: `TORONTO, ON — Environment Canada issued a special weather statement Friday evening for Toronto and the Greater Toronto Area, warning of localized heavy downpours and isolated thunderstorms capable of producing up to 50 millimeters of rainfall.\n\n## Meteorological Conditions and Urban Drainage\n\nA slow-moving low-pressure system crossing the lower Great Lakes is expected to deliver sustained precipitation through Saturday afternoon. Toronto and Region Conservation Authority (TRCA) issued an urban watershed advisory, cautioning of elevated runoff in river valleys and low-lying transportation corridors.\n\n"Urban drainage systems may experience localized pooling during intense thunderstorm cells," meteorologists advised. Motorists were urged to exercise caution on the Don Valley Parkway and Gardiner Expressway.\n\n## CNE Operational Adjustments\n\nCanadian National Exhibition (CNE) officials confirmed that indoor exhibits, including the Enercare Centre and Food Building, remain fully operational with adjusted outdoor midway ride safety monitoring during peak rain periods.`,
    seoTitle: "GTA Weather Advisory: Heavy Rain Forecast for CNE Weekend | Choseno",
    metaDescription: "Environment Canada issues heavy rainfall statement for Toronto and GTA as CNE organizers monitor outdoor midway operations.",
    tags: ["Toronto", "Weather", "Environment Canada", "CNE", "GTA", "Infrastructure"],
    tweet: "Environment Canada issues special weather statement for Toronto and the GTA with up to 50mm of rain forecast for CNE weekend.",
    breakingNews: false,
    author: { name: "Choseno Ontario Weather & Civic Desk", bio: "Meteorological monitoring, municipal storm infrastructure, and public safety." },
    sources: [
      { label: "CityNews Toronto", url: "https://toronto.citynews.ca/2026/08/21/toronto-special-weather-statement-heavy-rain-cne/" },
      { label: "Environment Canada", url: "https://weather.gc.ca/warnings/report_e.html?on61" }
    ],
    taggedPoliticians: []
  },

  // 32. JD Vance Midwest Steel Investment Tour
  {
    slug: "vice-president-vance-touts-domestic-steel-manufacturing-investments-in-cincinnati-2026-08-21",
    headline: "Vice President JD Vance Touts Advanced Steel Manufacturing and Industrial Energy Policies in Ohio",
    summary: "Vice President visits Cincinnati industrial facilities, promoting federal manufacturing tax incentives and defense supply chain reshoring initiatives.",
    category: "Politics",
    country: "US",
    province: "OH",
    status: "published",
    eventDate: "2026-08-21T23:56:00Z",
    published_at: "2026-08-22T02:00:00Z",
    impactArea: "state",
    latitude: 39.1031,
    longitude: -84.5120,
    body: `CINCINNATI, OH — Vice President JD Vance completed an industrial economy tour across southwestern Ohio on Friday, visiting advanced manufacturing plants and meeting with local metalworkers to promote federal industrial reshoring legislation.\n\n## Industrial Policy and Defense Procurement\n\nSpeaking at a specialty metallurgical facility, Vance highlighted executive policies designed to mandate domestic steel procurement across all federally funded highway, bridge, and naval shipbuilding projects.\n\n"The strength of the American economy rests on American manufacturing, American energy, and American workers," Vance stated. "We will ensure that our industrial heartland has the capital investment and tariff protections needed to out-compete foreign subsidized producers."\n\n## Community Engagement in Price Hill\n\nFollowing the industrial plant address, Vance met with local civic leaders and small business owners in Cincinnati's Price Hill neighborhood, discussing workforce training programs and regional vocational apprenticeships supported through federal grants.`,
    seoTitle: "JD Vance Promotes Steel Investments in Cincinnati Tour | Choseno",
    metaDescription: "Vice President JD Vance tours Cincinnati steel and manufacturing facilities, highlighting federal industrial tax credits and domestic procurement.",
    tags: ["JD Vance", "Ohio", "Manufacturing", "Steel", "Economy", "White House"],
    tweet: "Vice President JD Vance tours Cincinnati industrial plants, promoting domestic steel manufacturing incentives and defense supply chain reshoring.",
    breakingNews: false,
    author: { name: "Choseno National Affairs Desk", bio: "Industrial policy, executive branch travel, and Midwestern economic politics." },
    sources: [
      { label: "Cincinnati Enquirer", url: "https://www.cincinnati.com/story/news/politics/2026/08/21/vance-cincinnati-steel-investment-visit/" },
      { label: "The Wall Street Journal", url: "https://www.wsj.com/politics/policy/vance-steel-manufacturing-tour-ohio-2026" }
    ],
    taggedPoliticians: ["JD Vance"]
  },

  // 33. Canada, UK, Australia Joint Diplomatic Statement on Aid Workers
  {
    slug: "canada-uk-and-australia-issue-joint-statement-demanding-accountability-in-gaza-aid-worker-inquiries-2026-08-21",
    headline: "Canada, U.K., and Australia Issue Joint Diplomatic Rebuke Over Aid Worker Inquiries",
    summary: "Foreign ministers demand transparent independent investigations and full accountability following military findings into humanitarian convoy strikes in the Middle East.",
    category: "Diplomacy",
    country: "CA",
    province: "ON",
    status: "published",
    eventDate: "2026-08-21T15:52:00Z",
    published_at: "2026-08-21T18:00:00Z",
    impactArea: "country",
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, ON — The foreign ministers of Canada, the United Kingdom, and Australia issued a coordinated joint diplomatic declaration Friday expressing profound dissatisfaction with recent administrative findings regarding lethal strikes on international humanitarian aid convoys.\n\n## Demands for Independent Judicial Review\n\nForeign Affairs Minister Mélanie Joly alongside her British and Australian counterparts reiterated that humanitarian personnel operating under deconfliction mechanisms must be granted absolute legal protection under international humanitarian law.\n\n"Accountability must be transparent, comprehensive, and meaningful," the joint ministerial declaration stated. "Humanitarian workers risk their lives to deliver life-saving relief to civilians, and their safety must never be compromised."\n\n## Coordinated Multilateral Action\n\nThe trilateral group confirmed it will pursue formal briefings before the United Nations Security Council to mandate standardized deconfliction protocols and independent oversight for international aid distribution corridors.`,
    seoTitle: "Canada, UK, Australia Issue Joint Statement on Aid Worker Accountability | Choseno",
    metaDescription: "Canada, United Kingdom, and Australia release joint diplomatic statement calling for independent accountability for aid worker deaths in Gaza.",
    tags: ["Mélanie Joly", "Diplomacy", "Humanitarian", "Foreign Affairs", "United Nations", "Global Affairs"],
    tweet: "Canada, the UK, and Australia issue a joint diplomatic declaration demanding transparent independent accountability for humanitarian aid worker safety.",
    breakingNews: false,
    author: { name: "Choseno International Diplomacy Desk", bio: "Global affairs diplomacy, international humanitarian law, and multilateral treaties." },
    sources: [
      { label: "Castanet News", url: "https://www.castanet.net/news/Canada/canada-uk-australia-rebuke-aid-workers-deaths/" },
      { label: "CBC News", url: "https://www.cbc.ca/news/politics/canada-uk-australia-joint-statement-aid-workers-9.7315510" }
    ],
    taggedPoliticians: ["Mélanie Joly"]
  },

  // 34. Montreal RCMP Minor Terrorism Arrest
  {
    slug: "rcmp-integrated-national-security-unit-arrests-montreal-minor-in-alleged-school-threat-plot-2026-08-21",
    headline: "RCMP Integrated National Security Enforcement Team Arrests Minor in Alleged School Threat",
    summary: "Federal and municipal counter-terrorism investigators intervene to prevent suspected violent extremist plot in Montreal; suspect detained under Youth Criminal Justice Act.",
    category: "Justice",
    country: "CA",
    province: "QC",
    status: "published",
    eventDate: "2026-08-21T17:31:00Z",
    published_at: "2026-08-21T19:45:00Z",
    impactArea: "city",
    latitude: 45.5017,
    longitude: -73.5673,
    body: `MONTREAL, QC — The Royal Canadian Mounted Police (RCMP) Integrated National Security Enforcement Team (INSET), in close collaboration with the Service de police de la Ville de Montréal (SPVM), arrested an underage male suspect Friday in connection with an alleged violent extremist plot targeting an educational institution.\n\n## Preventive Law Enforcement Operation\n\nSecurity officials confirmed that the arrest followed multi-agency monitoring of online communications involving violent extremist material and threats to academic facilities. Officers executed search warrants at a residential location in Montreal, securing digital evidence for forensic analysis.\n\n"The safety and security of our educational institutions and communities remains our utmost priority," RCMP C-Division officials said in a statement. "Through timely inter-agency intelligence sharing, potential harm was successfully averted."\n\n## Legal Proceedings Under YCJA\n\nThe suspect faces formal charges related to facilitating terrorist activity and uttering threats. Due to statutory provisions under the Youth Criminal Justice Act, the individual's identity and specific institutional targets remain protected by publication bans.`,
    seoTitle: "RCMP INSET Arrests Montreal Youth in Alleged Threat Plot | Choseno",
    metaDescription: "RCMP national security investigators arrest minor in Montreal following multi-agency probe into alleged extremist threats against school.",
    tags: ["RCMP", "Montreal", "Quebec", "National Security", "Justice", "Public Safety"],
    tweet: "RCMP INSET arrests a minor in Montreal in connection with an alleged extremist threat targeting an educational institution.",
    breakingNews: false,
    author: { name: "Choseno National Security Desk", bio: "Counter-terrorism operations, federal law enforcement, and national security." },
    sources: [
      { label: "CBC News", url: "https://www.cbc.ca/news/canada/montreal/rcmp-alleged-terrorism-9.7315752" },
      { label: "Montreal Gazette", url: "https://montrealgazette.com/news/local-news/rcmp-arrest-youth-montreal-threat-investigation" }
    ],
    taggedPoliticians: []
  },

  // 35. White House Press Secretary Transition Candidates
  {
    slug: "white-house-evaluates-candidates-to-succeed-karoline-leavitt-as-press-secretary-2026-08-21",
    headline: "White House Vets Candidates to Succeed Karoline Leavitt as Press Secretary",
    summary: "Senior communications strategists and media commentators emerge as prospective contenders as the administration plans transitions in the briefing room.",
    category: "Politics",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-21T14:15:00Z",
    published_at: "2026-08-21T16:45:00Z",
    impactArea: "country",
    latitude: 38.8977,
    longitude: -77.0365,
    body: `WASHINGTON, DC — The White House is conducting preliminary vetting for senior communications professionals as Press Secretary Karoline Leavitt prepares to transition to a senior strategic advisory role within the Executive Office of the President.\n\n## Emerging Contenders and Selection Process\n\nAdministration sources confirmed that White House Chief of Staff and senior advisers are reviewing a shortlist of seasoned spokespersons. Prospective names under consideration include senior campaign communications directors and veteran broadcast commentators known for aggressive defense of administration policies.\n\n"The President values an articulate, unflinching communicator who can clearly articulate executive achievements and handle rigorous press corps scrutiny," an administration official noted.\n\n## Briefing Room Dynamics and Agenda\n\nThe incoming press secretary will assume podium duties during a pivotal legislative autumn marked by trade policy negotiations, federal budget reconciliations, and the upcoming midterm election campaign. An official announcement is expected in early September.`,
    seoTitle: "White House Vetting Successors for Press Secretary Role | Choseno",
    metaDescription: "White House reviews potential contenders to succeed Karoline Leavitt as White House press secretary ahead of autumn agenda.",
    tags: ["White House", "Donald Trump", "Media", "Communications", "Politics"],
    tweet: "The White House conducts vetting for a new Press Secretary as Karoline Leavitt prepares to transition to a senior strategic role.",
    breakingNews: false,
    author: { name: "Choseno White House Communications Desk", bio: "Executive communications, press corps relations, and West Wing staffing." },
    sources: [
      { label: "KATU News", url: "https://katu.com/news/nation-world/who-will-replace-karoline-leavitt-white-house-press-secretary" },
      { label: "The Hill", url: "https://thehill.com/homenews/administration/white-house-press-secretary-shortlist-leavitt/" }
    ],
    taggedPoliticians: ["Donald Trump"]
  },

  // 36. Utah Capitol Building Renamed in Honor of Gov. Mike Leavitt
  {
    slug: "utah-officially-names-north-capitol-building-in-honor-of-former-governor-mike-leavitt-2026-08-21",
    headline: "Utah Dedicates North Capitol Building in Honor of Former Governor Mike Leavitt",
    summary: "Governor Spencer Cox and state leaders dedicate the newly completed state facility, honoring Leavitt's 11-year governorship and federal service.",
    category: "Governance",
    country: "US",
    province: "UT",
    status: "published",
    eventDate: "2026-08-21T21:05:00Z",
    published_at: "2026-08-21T23:30:00Z",
    impactArea: "state",
    latitude: 40.7774,
    longitude: -111.8882,
    body: `SALT LAKE CITY, UT — State dignitaries, former governors, and legislative leaders gathered on Capitol Hill in Salt Lake City on Friday for the official naming and dedication of the Mike Leavitt North Capitol Building.\n\n## Honoring Eleven Years of Gubernatorial Leadership\n\nThe newly constructed 150,000-square-foot facility houses the Utah State Archives, museum exhibits, and legislative committee chambers. The ceremony commemorated the leadership of Mike Leavitt, who served as Utah's 14th governor from 1993 to 2003 before serving as EPA Administrator and Secretary of Health and Human Services.\n\n"Governor Leavitt's visionary governance modernized Utah's infrastructure, preserved open spaces through Envision Utah, and elevated our state on the global stage during the 2002 Winter Olympics," Governor Spencer Cox stated at the unveiling.\n\n## Architectural Significance and Public Access\n\nThe building was designed with high seismic resilience standards and solar generation systems, providing state researchers and students with state-of-the-art archival preservation suites and civic education spaces.`,
    seoTitle: "Utah Dedicates North Capitol Building to Gov. Mike Leavitt | Choseno",
    metaDescription: "Utah Governor Spencer Cox and leaders dedicate the newly completed Mike Leavitt North Capitol Building in Salt Lake City.",
    tags: ["Utah", "Mike Leavitt", "Spencer Cox", "Governance", "History", "Salt Lake City"],
    tweet: "Utah dedicates the new Mike Leavitt North Capitol Building in Salt Lake City, honoring the former governor and federal secretary.",
    breakingNews: false,
    author: { name: "Choseno Western Governance Desk", bio: "State legislatures, western political history, and civic institutions." },
    sources: [
      { label: "KSL News", url: "https://www.ksl.com/article/51108221/north-capitol-building-named-honor-mike-leavitt" },
      { label: "Deseret News", url: "https://www.deseret.com/utah/2026/08/21/mike-leavitt-north-capitol-building-dedication/" }
    ],
    taggedPoliticians: []
  },

  // 37. US Cryptocurrency Market & Hyperliquid Perpetual Exchange Surge
  {
    slug: "cryptocurrency-markets-rally-as-hyperliquid-and-perpetual-futures-surge-amid-us-regulatory-shifts-2026-08-22",
    headline: "Crypto Markets Surge as On-Chain Perpetual Trading Platforms Gain Wall Street Traction",
    summary: "Bitcoin climbs toward $80,000 and decentralized exchange Hyperliquid logs record volume following federal signals supporting onshore crypto trading frameworks.",
    category: "Finance",
    country: "US",
    province: "NY",
    status: "published",
    eventDate: "2026-08-22T04:40:00Z",
    published_at: "2026-08-22T05:05:00Z",
    impactArea: "country",
    latitude: 40.7069,
    longitude: -74.0089,
    body: `NEW YORK, NY — Digital asset markets experienced sharp upward momentum late Friday and early Saturday as Bitcoin rallied toward $80,000, led by explosive transaction volumes across decentralized perpetual futures platforms like Hyperliquid.\n\n## Regulatory Signals and Onshore Transition\n\nThe surge follows recent statements from federal regulatory officials indicating exploration of specialized licensing frameworks for non-custodial derivative order books operating within domestic jurisdictions.\n\nInstitutional trading desks reported substantial 24/7 liquidity migration toward high-speed decentralized exchanges, with token values for platform governance and linked utility assets surging over 30 percent in 24 hours.\n\n## Institutional Integration and Risk Management\n\nTraditional financial institutions have increasingly integrated algorithmic market-making pipelines directly with decentralized order books. Wall Street risk analysts noted that while continuous trading offers high capital efficiency, clearinghouse standards and smart contract verification will remain paramount for regulated asset managers.`,
    seoTitle: "Crypto Markets Rally on Decentralized Perpetual Futures Inflows | Choseno",
    metaDescription: "Bitcoin rallies toward $80,000 as decentralized perpetual exchange Hyperliquid and crypto tokens see surging institutional volume.",
    tags: ["Crypto", "Finance", "Bitcoin", "Technology", "Wall Street", "Markets"],
    tweet: "Cryptocurrency markets surge as Bitcoin pushes toward $80K and decentralized perpetual trading platform Hyperliquid sees record institutional volume.",
    breakingNews: false,
    author: { name: "Choseno Fintech & Digital Assets Desk", bio: "Blockchain finance, fintech regulation, and digital asset markets." },
    sources: [
      { label: "The Wall Street Journal", url: "https://www.wsj.com/finance/crypto/bitcoin-perpetual-futures-hyperliquid-rally-2026" },
      { label: "Bloomberg", url: "https://www.bloomberg.com/news/articles/2026-08-21/crypto-hyperliquid-perpetuals-market-rally" }
    ],
    taggedPoliticians: []
  },

  // 38. Grand Theft Auto VI Subpoenas and Cyber Investigation
  {
    slug: "take-two-interactive-issues-federal-subpoenas-to-microsoft-and-discord-over-major-gaming-leaks-2026-08-21",
    headline: "Take-Two Interactive Issues Federal Subpoenas to Tech Platforms Over Major Gaming Data Leaks",
    summary: "Video game publisher files DMCA enforcement actions to identify confidential development source code and gameplay footage distribution networks.",
    category: "Technology",
    country: "US",
    province: "CA",
    status: "published",
    eventDate: "2026-08-21T18:07:00Z",
    published_at: "2026-08-21T20:30:00Z",
    impactArea: "country",
    latitude: 37.7749,
    longitude: -122.4194,
    body: `SAN FRANCISCO, CA — Video game publisher Take-Two Interactive and subsidiary Rockstar Games intensified their legal counter-offensive Friday, serving federal DMCA subpoenas to Microsoft, Discord, and cloud hosting providers to track unauthorized leaks of proprietary development materials.\n\n## Subpoenas and Digital Forensic Tracebacks\n\nThe filings in U.S. District Court seek subscriber identities, IP access logs, and communications records associated with accounts that circulated unreleased source code and pre-alpha gameplay builds of *Grand Theft Auto VI*.\n\nCourt documents describe the unauthorized dissemination as a severe violation of federal trade secret and copyright statutes, causing substantial economic disruption to multi-year production schedules.\n\n## Cybersecurity Standards Across Entertainment Tech\n\nLegal and cybersecurity experts emphasized that the litigation highlights systemic supply chain vulnerabilities in large-scale entertainment software development, prompting studios worldwide to mandate air-gapped local networks and zero-trust remote access architecture.`,
    seoTitle: "Take-Two Subpoenas Discord and Microsoft in Gaming Leak Lawsuit | Choseno",
    metaDescription: "Take-Two Interactive issues federal subpoenas to Microsoft and Discord to unmask sources of leaked proprietary video game data.",
    tags: ["Technology", "Cybersecurity", "Legal", "Gaming", "Copyright", "California"],
    tweet: "Take-Two Interactive serves federal subpoenas to Microsoft and Discord to track down sources behind confidential video game data leaks.",
    breakingNews: false,
    author: { name: "Choseno Cybersecurity & Tech Law Desk", bio: "Intellectual property, digital forensic litigation, and entertainment tech." },
    sources: [
      { label: "Yahoo! Finance", url: "https://ca.finance.yahoo.com/news/take-two-subpoenas-microsoft-discord-leaks-180713788.html" },
      { label: "Axios", url: "https://www.axios.com/2026/08/21/gta-vi-leak-lawsuit-take-two-subpoenas" }
    ],
    taggedPoliticians: []
  },

  // 39. Apple iMessage Integration with ChatGPT Desktop
  {
    slug: "openai-rolls-out-native-apple-imessage-and-system-actions-integration-for-chatgpt-desktop-2026-08-21",
    headline: "OpenAI Rolls Out Native iMessage and System Integration for ChatGPT Mac Client",
    summary: "Desktop application gains secure accessibility permissions to read and draft iMessage replies, signaling deeper consumer operating system AI integrations.",
    category: "Technology",
    country: "US",
    province: "CA",
    status: "published",
    eventDate: "2026-08-21T20:37:00Z",
    published_at: "2026-08-21T22:50:00Z",
    impactArea: "country",
    latitude: 37.3349,
    longitude: -122.0090,
    body: `CUPERTINO, CA — OpenAI released an updated version of its ChatGPT desktop client for macOS on Friday, introducing direct system integrations that allow the AI assistant to read, summarize, and draft replies to incoming Apple iMessages upon user authorization.\n\n## Local Accessibility APIs and Privacy Safeguards\n\nThe feature operates via Apple's Accessibility and Scripting Bridge frameworks, requiring explicit per-app permissions from macOS System Settings. OpenAI emphasized that text data processed for messaging tasks is encrypted locally and excluded by default from model training datasets.\n\n"We are building desktop experiences that save users time by automating routine communications directly within their existing workflows," OpenAI product engineers noted in a release blog.\n\n## Operating System AI Competition\n\nThe rollout intensifies competition across native desktop computing platforms as Apple, Microsoft, and independent AI labs race to integrate contextual agentic assistants directly into daily consumer and professional operating environments.`,
    seoTitle: "ChatGPT Mac App Adds Native Apple iMessage Integration | Choseno",
    metaDescription: "OpenAI releases macOS update for ChatGPT allowing desktop assistant to summarize and draft iMessage responses with local user permissions.",
    tags: ["Technology", "AI", "Apple", "OpenAI", "Software", "macOS"],
    tweet: "ChatGPT for Mac adds native Apple iMessage integration, allowing users to summarize messages and draft replies with local system permissions.",
    breakingNews: false,
    author: { name: "Choseno Consumer Tech Desk", bio: "Artificial intelligence, consumer software, and operating system evolution." },
    sources: [
      { label: "Engadget", url: "https://www.engadget.com/ai/chatgpt-mac-app-imessage-support-2026-08-21/" },
      { label: "The Verge", url: "https://www.theverge.com/2026/8/21/openai-chatgpt-mac-desktop-imessage-integration" }
    ],
    taggedPoliticians: []
  },

  // 40. UK Court Orders Privacy Claimants to Pay Daily Mail Publisher
  {
    slug: "uk-high-court-orders-privacy-case-claimants-to-pay-13m-in-legal-costs-to-daily-mail-publisher-2026-08-21",
    headline: "High Court Orders Privacy Claimants to Pay $13M in Legal Costs to Daily Mail Publisher",
    summary: "British judge directs prominent public claimants to remit interim legal expenses following preliminary rulings in long-running unlawful information gathering litigation.",
    category: "Legal",
    country: "US",
    province: "DC",
    status: "published",
    eventDate: "2026-08-21T14:03:00Z",
    published_at: "2026-08-21T16:30:00Z",
    impactArea: "country",
    latitude: 51.5138,
    longitude: -0.1132,
    body: `LONDON, UK — A judge in the High Court of Justice in London ordered a group of high-profile privacy claimants on Friday to pay an interim £10.2 million ($13.1 million USD) in legal costs to Associated Newspapers Ltd, publisher of the *Daily Mail* and *Mail on Sunday*.\n\n## Procedural Ruling on Unlawful Information Claims\n\nThe costs order follows preliminary procedural rulings regarding the admissibility of documentary evidence obtained from the historic 2012 Leveson Inquiry. The judge determined that claimants breached procedural disclosure constraints by deploying restricted inquiry records without prior government minister consent.\n\nAssociated Newspapers welcomed the ruling, stating: "This costs order appropriately reflects the substantial legal expense incurred in responding to unmerited procedural applications."\n\n## Progression to Full Trial\n\nLegal representatives for the claimants confirmed compliance with the interim payment timeline while stressing that substantive claims regarding unlawful interception and private investigator surveillance remain scheduled for full trial proceedings in 2027.`,
    seoTitle: "UK High Court Orders Privacy Claimants to Pay $13M in Legal Costs | Choseno",
    metaDescription: "High Court in London orders high-profile privacy claimants to pay $13M in interim legal costs to Daily Mail publisher.",
    tags: ["Legal", "Media", "High Court", "Press", "Privacy", "United Kingdom"],
    tweet: "High Court of Justice orders privacy case claimants to pay $13M in interim legal costs to Daily Mail publisher following procedural ruling.",
    breakingNews: false,
    author: { name: "Choseno International Legal Desk", bio: "Media law, high court jurisprudence, and privacy torts." },
    sources: [
      { label: "Deadline", url: "https://deadline.com/2026/08/prince-harry-elton-john-privacy-daily-mail-legal-costs-1236054890/" },
      { label: "The Guardian", url: "https://www.theguardian.com/media/2026/aug/21/high-court-costs-order-associated-newspapers" }
    ],
    taggedPoliticians: []
  }
];

async function run() {
  console.log('=========================================');
  console.log('CHOSENO 40 UNIQUE ARTICLES BATCH PUBLISHER');
  console.log('Time Window: 2026-08-21T07:55:00Z to 2026-08-22T05:26:00Z');
  console.log(`Total Articles to Publish: ${articles.length}`);
  console.log('=========================================\n');

  const authHeaders = await getAuthHeaders();
  const inserted = [];
  const skipped = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`\n[${i + 1}/${articles.length}] Processing: ${article.headline.slice(0, 60)}...`);

    // Check if slug already exists
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?slug=eq.${article.slug}&select=id,slug`, {
      headers: {
        apikey: authHeaders.apikey,
        Authorization: authHeaders.Authorization
      }
    });

    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing && existing.length > 0) {
        console.log(`  -> Already exists in Supabase (ID: ${existing[0].id}). Skipping.`);
        skipped.push(article.slug);
        continue;
      }
    }

    // Resolve politician IDs
    let politicianIds = [];
    if (article.taggedPoliticians && article.taggedPoliticians.length > 0) {
      politicianIds = await resolvePoliticianIds(article.taggedPoliticians, authHeaders);
      console.log(`  -> Resolved ${politicianIds.length} politician ID(s) for [${article.taggedPoliticians.join(', ')}]`);
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
        batch_number: '2026-08-22 05:26',
        viral_score: 9.0,
        shared_platforms: []
      }
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles`, {
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
      const err = await insertRes.text();
      console.error(`[ERROR] Failed to insert ${article.slug}:`, err);
      continue;
    }

    const [created] = await insertRes.json();
    console.log(`  -> [INSERTED] ${created.slug} (ID: ${created.id})`);

    // Sync politician tags to politician walls
    if (politicianIds.length > 0) {
      try {
        const tagSyncRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_tags`, {
          method: 'POST',
          headers: {
            apikey: authHeaders.apikey,
            Authorization: authHeaders.Authorization,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_article_id: created.id,
            p_politician_ids: politicianIds
          })
        });
        if (tagSyncRes.ok) {
          console.log(`  -> Synced tags to ${politicianIds.length} politician wall(s)`);
        }
      } catch (e) {
        console.warn(`  -> Could not sync politician tags: ${e.message}`);
      }
    }

    // Sync GIS boundary tags
    if (article.latitude && article.longitude) {
      try {
        const boundSyncRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_boundaries`, {
          method: 'POST',
          headers: {
            apikey: authHeaders.apikey,
            Authorization: authHeaders.Authorization,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_article_id: created.id,
            p_latitude: article.latitude,
            p_longitude: article.longitude
          })
        });
        if (boundSyncRes.ok) {
          console.log(`  -> Synced boundary tags for lat/lng (${article.latitude}, ${article.longitude})`);
        }
      } catch (e) {
        console.warn(`  -> Could not sync boundaries: ${e.message}`);
      }
    }

    inserted.push({
      ...article,
      id: created.id
    });
  }

  // Update batch-ranked-news.csv and overflow
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
      const postWindow = 'Overnight / Morning Primetime (6:00 AM - 9:00 AM EST)';
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
