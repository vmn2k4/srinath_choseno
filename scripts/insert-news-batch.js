/**
 * Reusable batch news importer, tagger, and deduplicator for Choseno.
 * Usage:
 *   1. Add your article objects to the `articles` array below.
 *   2. Run: `node scripts/insert-news-batch.js`
 */

const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found at', envPath);
  process.exit(1);
}

const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

// ── ADD YOUR ARTICLES HERE ──────────────────────────────────────────────────
const articles = [
  {
    slug: 'david-eby-bc-cabinet-shuffle-osborne-kahlon-bailey-2026-08-17',
    headline: 'Premier David Eby Announces B.C. Cabinet Reassignment as Brenda Bailey Begins Medical Leave',
    summary: 'Premier David Eby reassigns key portfolios in the provincial cabinet, appointing Josie Osborne as Minister of Finance and Ravi Kahlon as Minister of Health while Jobs Minister Brenda Bailey undergoes cancer treatment.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-16T18:00:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'state',
    latitude: 48.4284,
    longitude: -123.3656,
    body: `VICTORIA, B.C. — British Columbia Premier David Eby announced an executive cabinet realignment at the Parliament Buildings in Victoria, restructuring key ministerial portfolios following Jobs, Economic Development and Innovation Minister Brenda Bailey's decision to step away on medical leave for cancer treatment.

## Cabinet Portfolio Reallocations and Executive Continuity

Under the newly certified executive order, Premier Eby transferred responsibility for the province's fiscal framework and statutory health administration among senior cabinet veterans:

* **Ministry of Finance**: Josie Osborne, MLA for Mid Island-Pacific Rim and previously Minister of Health, assumes the role of Minister of Finance. Osborne will steer the preparation of B.C.'s 2027 provincial budget, oversee public debt financing, and manage ongoing public sector collective bargaining.
* **Ministry of Health**: Ravi Kahlon, MLA for Delta North and previously Minister of Jobs and Economic Growth, takes over as Minister of Health, assuming executive leadership over regional health authority budgets, emergency room stabilization initiatives, and physician contract implementations.
* **Ministry of Jobs and Economic Growth**: Energy and Climate Solutions Minister Adrian Dix will assume acting ministerial responsibility for the Jobs and Innovation portfolio during Bailey's medical absence, ensuring statutory continuity for clean industry investments and regional economic development tables. Minister Bailey remains a member of cabinet and is scheduled to resume her duties in early October 2026 following clinical treatment.

"Brenda Bailey is a tireless advocate for workers, businesses, and modern economic growth across British Columbia," Premier Eby stated during the executive announcement. "As Brenda focuses on her health and treatment, our cabinet team is ensuring seamless continuity on the issues that matter most to British Columbians—building an economy that works for regular families, strengthening front-line healthcare delivery, and maintaining disciplined fiscal oversight."

## Policy Priorities and Economic Strategy

The cabinet reassignments place experienced ministers at the helm of British Columbia's two most resource-intensive ministries. Minister Osborne brings direct experience in navigating complex municipal infrastructure and regional healthcare files to the Finance portfolio, where she faces balancing infrastructure investments against macroeconomic pressures and shifting North American trade dynamics.

In Health, Minister Kahlon takes leadership of provincial efforts to recruit and retain family physicians, expand urgent primary care centres across suburban and rural ridings, and accelerate capital replacements across major acute care hospitals.

## Next Steps and Parliamentary Schedule

The ministers were sworn into their respective portfolios by Lieutenant Governor Janet Austin at Government House. The revamped executive council will convene in Victoria ahead of the fall legislative sitting to finalize government bills on provincial housing targets, healthcare workforce retention, and clean technology investment tax credits.`,
    seoTitle: 'B.C. Cabinet Reorganization 2026 | Choseno',
    metaDescription: 'Premier David Eby announces B.C. cabinet shuffle appointing Josie Osborne to Finance and Ravi Kahlon to Health as Brenda Bailey begins cancer treatment.',
    tags: [
      'David Eby',
      'Josie Osborne',
      'Ravi Kahlon',
      'Brenda Bailey',
      'Adrian Dix',
      'BC NDP',
      'BC Politics',
      'Healthcare',
      'Finance'
    ],
    tweet: 'Premier David Eby reassigns key B.C. cabinet portfolios, naming Josie Osborne Minister of Finance and Ravi Kahlon Minister of Health as Brenda Bailey steps away for cancer treatment.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'B.C. Office of the Premier - Executive Council Changes',
        url: 'https://news.gov.bc.ca/releases/2026PREM0045-001122'
      },
      {
        label: 'Vancouver Sun - B.C. Cabinet Reorganization',
        url: 'https://vancouversun.com/news/local-news/bc-cabinet-shuffle-david-eby-josie-osborne-ravi-kahlon'
      }
    ],
    taggedPoliticianIds: [
      'a730729a-0a3b-4231-b93d-9b5524f9db5e',
      '025098f0-5553-4df5-b1e6-1e9a5c6773fd',
      '472949c0-825a-498c-8a8e-33b6d292286e',
      'f4ba4f3c-0dfa-4b7b-a6d8-06b3b456a1f2'
    ],
    taggedPoliticians: [
      'David Eby',
      'Josie Osborne',
      'Ravi Kahlon',
      'Brenda Bailey',
      'Adrian Dix'
    ]
  },
  {
    slug: 'ro-khanna-data-center-bill-of-rights-ai-grid-regulation-2026-08-17',
    headline: 'Rep. Ro Khanna Introduces \'Data Center Bill of Rights\' to Protect Local Grids and Power Rates from AI Surge',
    summary: 'U.S. Representative Ro Khanna introduces a federal resolution establishing 2,500-foot buffer zones, mandatory water transparency, and ratepayer cost shields for hyperscale AI data centers.',
    category: 'Technology',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-16T19:00:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'country',
    latitude: 38.8899,
    longitude: -77.0090,
    body: `WASHINGTON, D.C. — Representative Ro Khanna (D-CA) introduced a landmark congressional resolution entitled the "Data Center Bill of Rights," establishing a comprehensive federal framework to safeguard residential communities, municipal water supplies, and electrical grid stability amidst the rapid expansion of generative AI infrastructure.

## Federal Standards and Local Zoning Protections

The resolution addresses the rapid buildout of more than 4,400 commercial data centers operating nationwide, establishing national baseline protections for municipalities facing proposed hyperscale developments:

* **Mandatory Buffer Distances**: Establishes a federal guideline prohibiting data center construction in residential zones and within 2,500 feet of residential homes, public and private schools, licensed childcare facilities, hospitals, and senior care homes.
* **Ratepayer Cost Insulation**: Requires federal and state utility regulators to prevent hyperscale data centers from shifting transmission grid upgrades, substation construction, and high-voltage interconnect fees onto ordinary residential utility ratepayers.
* **Resource and Environmental Transparency**: Mandates comprehensive reporting on projected daily water usage for evaporative cooling systems, as well as strict emission and acoustic standards for backup diesel generators and on-site gas turbines.
* **Local Preemption Protection**: Explicitly affirms the authority of municipal zoning boards, county commissions, and local town councils to review, condition, or reject data center proposals without state-level legislative preemption.

"Artificial intelligence offers immense potential, but the physical reality of powering AI cannot come at the expense of working families' utility bills, drinking water, or neighborhood tranquility," Congressman Khanna stated upon filing the measure. "Communities deserve a seat at the table, clear environmental transparency, and ironclad guarantees that tech conglomerates pay for their own power infrastructure."

## Regional Grid Stress and Community Backlash

The legislative push follows high-profile public hearings across Pennsylvania, Virginia, Ohio, and Georgia, where rural and suburban residents have voiced alarm over skyrocketing local electricity rates and deafening cooling fans adjacent to residential subdivisions. During a recent fact-finding mission to Pennsylvania, Khanna urged local authorities to pause new permitting approvals pending comprehensive grid capacity audits.

Industry analysts estimate that hyperscale AI facilities could consume up to 9% of total U.S. electricity generation by 2030, putting acute pressure on regional transmission organizations such as PJM Interconnection and ERCOT.

## Congressional Path and Stakeholder Reaction

The resolution has gathered initial support from members of the Congressional Progressive Caucus and lawmakers representing districts with high concentrations of data infrastructure. While technology industry trade groups argue that stringent federal zoning mandates could slow domestic AI innovation, environmental organizations and consumer utility advocates have endorsed the resolution as an essential step toward responsible computational growth.`,
    seoTitle: 'Ro Khanna Data Center Bill of Rights | Choseno',
    metaDescription: 'Rep. Ro Khanna introduces the Data Center Bill of Rights setting 2,500-foot buffer zones, ratepayer cost shields, and water transparency for AI infrastructure.',
    tags: [
      'Ro Khanna',
      'AI Infrastructure',
      'Energy Grid',
      'Data Centers',
      'Federal Legislation',
      'Ratepayer Protection',
      'Technology Policy'
    ],
    tweet: 'Rep. Ro Khanna introduces the Data Center Bill of Rights, demanding 2,500-foot buffer zones from homes and federal protections to prevent AI power demands from spiking residential utility bills.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'U.S. House of Representatives - Office of Rep. Ro Khanna',
        url: 'https://khanna.house.gov/media/press-releases/khanna-introduces-data-center-bill-of-rights'
      },
      {
        label: 'MeriTalk - Congressional Data Center Regulatory Framework',
        url: 'https://www.meritalk.com/articles/rep-khanna-proposes-data-center-bill-of-rights/'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Ro Khanna'
    ]
  },
  {
    slug: 'todd-blanche-rescinds-anti-weaponization-fund-doj-independence-2026-08-17',
    headline: 'Attorney General Todd Blanche Formally Rescinds $1.8 Billion \'Anti-Weaponization\' Settlement Fund',
    summary: 'Confirmed following a narrow 50–49 Senate vote, U.S. Attorney General Todd Blanche issues a formal order terminating the controversial $1.8 billion IRS settlement fund while addressing questions on executive authority.',
    category: 'Policy',
    country: 'US',
    province: 'DC',
    status: 'published',
    eventDate: '2026-08-16T21:00:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'country',
    latitude: 38.8925,
    longitude: -77.0256,
    body: `WASHINGTON, D.C. — United States Attorney General Todd Blanche issued a formal administrative order rescinding the controversial $1.8 billion "Anti-Weaponization Fund," delivering on a written commitment that secured his confirmation by the narrowest Senate margin for an Attorney General in modern history.

## Formal Rescission and Legal Architecture

The administrative directive formally revokes the Department of Justice's framework establishing the multi-billion-dollar compensation mechanism, which originated from a settlement structure in an IRS civil lawsuit brought by Donald Trump:

* **Complete Termination of Fund**: The order instructs DOJ and Department of the Treasury disbursements officers that the $1.8 billion allocation is definitively dissolved and that no federal taxpayer funds will be dispersed to individuals alleging historical political targeting.
* **Settlement Compliance Review**: Blanche directed senior career DOJ attorneys to review underlying contractual obligations to ensure that alternative federal mechanisms, including the statutory Judgment Fund, cannot be utilized to revive unauthorized payouts.
* **Confirmation Backdrop**: The formal rescission follows intense negotiations on Capitol Hill, where Republican Senators John Cornyn and Thom Tillis conditioned their confirmation votes on an unequivocal, binding dissolution of the fund prior to Blanche taking the oath of office.

"This order confirms beyond any doubt that the fund is dead," Attorney General Blanche stated in remarks following the signing. "The Department of Justice will focus its institutional energy and resources on constitutional law enforcement, combating violent crime, securing our borders, and restoring public trust in the fair application of the law."

## Senate Scrutiny and Departmental Independence

Blanche was confirmed on August 8, 2026, by a 50–49 vote along strict party lines. During his confirmation hearings and subsequent media interviews, lawmakers pressed Blanche extensively on DOJ independence and his previous role as personal defense counsel to President Trump.

Legal scholars and congressional oversight committees have indicated they will continue monitoring DOJ proceedings, noting that the underlying settlement documentation remains a matter of active inquiry in federal court. Critics have also scrutinized Blanche's statements indicating that the Justice Department will take executive policy perspectives into account when determining federal enforcement priorities.

## Next Steps for Federal Law Enforcement

The Attorney General convened an all-hands leadership briefing with U.S. Attorneys and FBI executive leadership to outline initial priorities for the department's fall docket, emphasizing counter-narcotics task forces, public corruption enforcement, and compliance with congressional oversight mandates.`,
    seoTitle: 'Todd Blanche Rescinds $1.8B Anti-Weaponization Fund | Choseno',
    metaDescription: 'Attorney General Todd Blanche signs order dissolving the $1.8B Anti-Weaponization Fund following narrow 50-49 Senate confirmation vote.',
    tags: [
      'Todd Blanche',
      'Department of Justice',
      'Senate Judiciary',
      'Federal Courts',
      'IRS Settlement',
      'Legal Affairs',
      'U.S. Politics'
    ],
    tweet: 'Attorney General Todd Blanche signs an administrative order formally killing the $1.8B Anti-Weaponization Fund following contentious Senate confirmation hearings.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'U.S. Department of Justice - Office of the Attorney General',
        url: 'https://www.justice.gov/ag/orders/rescission-anti-weaponization-settlement-fund-2026'
      },
      {
        label: 'The Hill - Todd Blanche Confirmation and Rescission Order',
        url: 'https://thehill.com/homenews/administration/todd-blanche-anti-weaponization-fund-rescinded'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Todd Blanche'
    ]
  },
  {
    slug: 'ruben-gallego-uss-abraham-lincoln-carrier-deployment-oversight-2026-08-17',
    headline: 'Senator Ruben Gallego Demands Congressional Investigation into Record 260-Day USS Abraham Lincoln Deployment',
    summary: 'Marine veteran and U.S. Senator Ruben Gallego calls for a formal congressional delegation to inspect conditions aboard the USS Abraham Lincoln after more than 260 consecutive days at sea in the Middle East.',
    category: 'National',
    country: 'US',
    province: 'AZ',
    status: 'published',
    eventDate: '2026-08-16T20:30:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'country',
    latitude: 38.8899,
    longitude: -77.0090,
    body: `WASHINGTON, D.C. — U.S. Senator Ruben Gallego (D-AZ), an Iraq War combat Marine veteran and senior member of the Senate Armed Services Committee, demanded immediate congressional oversight and announced plans to lead a bipartisan delegation to inspect the USS Abraham Lincoln carrier strike group following reports of severe crew strain during an unprecedented 260-consecutive-day deployment.

## Deployment Timeline and Living Conditions

The Nimitz-class aircraft carrier *USS Abraham Lincoln* (CVN-72) and its carrier strike group have operated in the U.S. Central Command area of responsibility since late 2025, providing regional deterrent capabilities and close-air support during ongoing regional hostilities:

* **Extended Sea Time**: Operating without scheduled port visits for over 260 days, the deployment represents one of the longest continuous underway periods for an American supercarrier since the Vietnam War.
* **Reported Operational Pressures**: Congressional inquiries received testimony from sailors' families detailing 16-hour shifts, acute sleep deprivation, deferred maintenance on sanitation systems, and limited access to mental health professionals.
* **Oversight Delegation Request**: Senator Gallego formally petitioned the Pentagon and Senate Armed Services Committee Chairman to authorize an immediate CODEL (Congressional Delegation) flight to the carrier to review logistical resupply chains, medical resources, and crew rotation schedules.

"Our service members and their families are carrying an immense burden, and when deployments are stretched indefinitely without proper logistical planning, that is a failure of senior leadership," Senator Gallego stated in an interview on Capitol Hill. "You cannot run our sailors ragged and treat mission planning like something you just wing as you go. Congress has a constitutional duty to ensure our troops have the support, equipment, and rotation schedules they deserve."

## Pentagon Response and Fleet Readiness

Defense Secretary Pete Hegseth and Acting Navy Secretary Hung Cao responded to congressional inquiries, maintaining that the *USS Abraham Lincoln* remains fully mission-capable and that operational extensions were essential to protect vital maritime choke points and allied airspace. Navy officials emphasized that medical officers and chaplain teams are actively providing support across the strike group.

Military readiness analysts note that extended carrier deployments create severe downstream maintenance backlogs at naval shipyards, delaying drydock overhauls and impacting fleet availability for future Indo-Pacific rotations.

## Legislative Actions and Next Steps

The Senate Armed Services Committee is scheduled to hold a closed-door briefing with naval operations leadership to review strike group deployment limits and examine provisions in the upcoming National Defense Authorization Act (NDAA) that would mandate strict statutory review for any naval deployment exceeding 210 days.`,
    seoTitle: 'Ruben Gallego USS Abraham Lincoln Deployment Oversight | Choseno',
    metaDescription: 'Senator Ruben Gallego calls for congressional investigation into the record 260-day deployment of the USS Abraham Lincoln carrier strike group.',
    tags: [
      'Ruben Gallego',
      'U.S. Navy',
      'USS Abraham Lincoln',
      'Pentagon',
      'Middle East',
      'Armed Services',
      'Defense Oversight'
    ],
    tweet: 'Senator Ruben Gallego calls for immediate congressional oversight into the USS Abraham Lincoln as the aircraft carrier exceeds 260 consecutive days deployed at sea.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'U.S. Senate Armed Services Committee - Senator Ruben Gallego',
        url: 'https://www.gallego.senate.gov/news/press-releases/gallego-calls-for-carrier-strike-group-oversight-uss-abraham-lincoln'
      },
      {
        label: 'Politico - Extended Navy Carrier Deployment Controversy',
        url: 'https://www.politico.com/news/2026/08/16/extended-carrier-deployment-navy-gallego-00174211'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Ruben Gallego',
      'Pete Hegseth'
    ]
  },
  {
    slug: 'josh-green-hawaii-hurricane-lala-emergency-power-restoration-2026-08-17',
    headline: 'Governor Josh Green Declares State of Emergency as Hurricane Lala Knocks Out Power to 200,000 in Hawaii',
    summary: 'Hawaii Governor Josh Green mobilizes the National Guard, activates state emergency funding, and closes government offices as Hurricane Lala inflicts severe power grid and flood damage across Maui and Hawaii County.',
    category: 'Infrastructure',
    country: 'US',
    province: 'HI',
    status: 'published',
    eventDate: '2026-08-16T22:00:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'state',
    latitude: 21.3069,
    longitude: -157.8583,
    body: `HONOLULU, HI — Hawaii Governor Josh Green signed a comprehensive statewide Emergency Proclamation as Hurricane Lala—which tracked just south of the island chain bringing torrential rainfall and sustained tropical-storm-force winds—left more than 200,000 residences and commercial properties without electrical power and triggered destructive flash flooding across Hawaii and Maui counties.

## Disaster Proclamation and State Emergency Mobilization

The executive proclamation mobilizes state disaster relief funds, activates the Hawaii National Guard for high-water search-and-rescue operations, and coordinates emergency grid stabilization with Hawaiian Electric:

* **Statewide Outages and Grid Damage**: Sustained winds of 65 mph with gusts exceeding 80 mph brought down critical high-voltage transmission lines, leaving roughly 200,000 customers dark. Officials warned that while urban Honolulu and West Oahu will see rapid reconnection, isolated rural communities in East Maui and the Puna district of Hawaii Island could face multi-week restoration timelines.
* **Government and School Closures**: Governor Green ordered the closure of all non-essential state and county offices, public school campuses, and state courthouse facilities across Hawaii, Maui, and Oahu to clear transit corridors for emergency response crews.
* **Emergency Funding Allocation**: The proclamation unlocks $10 million from the state emergency reserve to expedite debris removal, restore damaged culverts along the Hana Highway, and support temporary emergency shelters operated by the American Red Cross.

"Our first and only priority is protecting life and securing essential services for our families," Governor Green said from the State Emergency Operations Center in Diamond Head. "We have deployed our National Guard teams, opened emergency evacuation shelters, and instructed all state emergency assets to work around the clock alongside utility line crews to restore electricity and ensure our hospitals and vulnerable residents remain safe."

## Regional Flooding and Infrastructure Impact

Heavy squalls dumped 8 to 14 inches of rain across windward slopes, causing localized mudslides and structural flooding that damaged over 100 homes. Emergency crews conducted water rescues in Kau and South Hilo after swollen streams breached residential perimeters. One storm-related fatality was confirmed following a vehicle collision during torrential conditions on Route 11.

Hawaiian Electric reported staging specialized utility crews and bucket trucks across key switchyards to begin replacing downed utility poles as soon as wind speeds subside below safety thresholds.

## Next Steps and Public Safety Warnings

The Hawaii Emergency Management Agency (HI-EMA) urged residents to stay off flooded roadways, treat all downed power lines as energized, and monitor emergency notifications through local broadcast networks and the official state disaster portal at ready.hawaii.gov.`,
    seoTitle: 'Governor Josh Green Hawaii Hurricane Lala Emergency | Choseno',
    metaDescription: 'Governor Josh Green issues emergency proclamation as Tropical Storm Lala knocks out power to 200,000 customers in Hawaii and causes flash flooding.',
    tags: [
      'Josh Green',
      'Hawaii',
      'Hurricane Lala',
      'Emergency Declaration',
      'Power Grid',
      'Hawaiian Electric',
      'Public Safety'
    ],
    tweet: 'Governor Josh Green signs a statewide emergency proclamation as Tropical Storm Lala cuts electricity to 200,000 residents across Hawaii and triggers extensive flash flooding.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Office of the Governor of Hawaii - Emergency Proclamation Lala',
        url: 'https://governor.hawaii.gov/newsroom/emergency-proclamation-tropical-storm-lala'
      },
      {
        label: 'Honolulu Civil Beat - Hurricane Lala Power Grid Damage',
        url: 'https://www.civilbeat.org/2026/08/hurricane-lala-hits-hawaii-power-outages/'
      }
    ],
    taggedPoliticianIds: [
      'e35046bb-c28e-4155-bced-800ac177f7fa'
    ],
    taggedPoliticians: [
      'Josh Green'
    ]
  },
  {
    slug: 'mike-braun-indiana-flooding-state-disaster-emergency-fema-2026-08-17',
    headline: 'Governor Mike Braun Secures Presidential Disaster Aid as Indiana Battens Down from 1-in-1,000-Year Floods',
    summary: 'Governor Mike Braun mobilizes the Indiana National Guard and coordinates federal emergency assistance following historic rainfall exceeding 11 inches that inundated the White River basin and claimed seven lives.',
    category: 'Environment',
    country: 'US',
    province: 'IN',
    status: 'published',
    eventDate: '2026-08-16T21:30:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'state',
    latitude: 39.7684,
    longitude: -86.1581,
    body: `INDIANAPOLIS, IN — Indiana Governor Mike Braun mobilized the Indiana National Guard and coordinated immediate federal disaster assistance under a newly approved Presidential Emergency Declaration following a week of catastrophic storms that produced over 11 inches of rain, resulting in seven fatalities and historic flooding along the White River and Wabash River basins.

## Disaster Declaration and Federal Support

The multi-agency emergency response marshals state resources alongside federal funding to stabilize heavily inundated counties:

* **Presidential Emergency Declaration**: Following an urgent request from Governor Braun, the White House approved a federal emergency declaration unlocking up to $5 million in direct federal assistance through the Federal Emergency Management Agency (FEMA) to support debris removal, water rescues, and sandbagging operations.
* **National Guard Deployment**: Governor Braun activated specialized National Guard engineering and high-water rescue units across Marion, Morgan, Johnson, and Bartholomew counties to assist local first responders.
* **Historic River Crests**: Hydrological stations along the White River recorded flood stages exceeding 100-year historical highs, inundating low-lying agricultural land, municipal water treatment facilities, and major transportation corridors.

"Our hearts go out to the families who have lost loved ones in these devastating storms," Governor Braun said during a briefing at the State Emergency Operations Center in Indianapolis. "We are marshaling every asset of state government—from our National Guard soldiers to our Department of Transportation crews—to protect Hoosier families, safeguard our critical infrastructure, and begin the complex work of recovery."

## Regional Impact on Communities and Agriculture

The storm system triggered flash floods that submerged hundreds of residential basements and washed out county bridges across central Indiana. Over 250,000 utility customers experienced localized power outages as falling trees downed distribution lines. In Morgan and Johnson counties, agricultural officials reported extensive crop washouts across corn and soybean acreage, with early estimates indicating tens of millions in agricultural losses.

Public health authorities issued boil-water advisories for municipal utilities where floodwaters infiltrated distribution networks, setting up potable water distribution stations in cooperation with local county emergency management agencies.

## Recovery Phase and Safety Protocols

As river levels begin their slow crest, the Indiana Department of Homeland Security (IDHS) advised displaced residents not to return to flooded neighborhoods until building inspectors and utility technicians have certified structural integrity and gas line safety. Governor Braun confirmed that state teams are compiling damage assessments to submit a formal petition for a Major Disaster Declaration to unlock individual household FEMA grants.`,
    seoTitle: 'Governor Mike Braun Indiana Flood Emergency Aid | Choseno',
    metaDescription: 'Governor Mike Braun mobilizes National Guard and secures federal emergency aid following 1-in-1,000-year rainfall and catastrophic flooding in Indiana.',
    tags: [
      'Mike Braun',
      'Indiana',
      'Flooding',
      'Disaster Emergency',
      'FEMA',
      'National Guard',
      'Public Safety'
    ],
    tweet: 'Governor Mike Braun deploys the National Guard and secures emergency federal assistance after historic 11-inch downpours cause catastrophic flooding across central and southern Indiana.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Office of Governor Mike Braun - State Disaster Emergency Declaration',
        url: 'https://events.in.gov/event/governor-braun-issues-disaster-emergency-flooding'
      },
      {
        label: 'WFYI Public Media - Indiana Flood Disaster Response',
        url: 'https://www.wfyi.org/news/articles/indiana-flooding-emergency-declaration-braun-white-river-2026'
      }
    ],
    taggedPoliticianIds: [
      'b6fda729-1ed0-498b-b2e2-46a5132323a9'
    ],
    taggedPoliticians: [
      'Mike Braun'
    ]
  },
  {
    slug: 'mark-carney-calls-chicoutimi-le-fjord-federal-byelections-2026-08-17',
    headline: 'Prime Minister Mark Carney Issues Writs for August 31 Federal By-Election in Chicoutimi—Le Fjord',
    summary: 'Prime Minister Mark Carney sets August 31 for a high-stakes federal by-election in Chicoutimi—Le Fjord following the appointment of former Conservative MP Richard Martel to the Senate of Canada.',
    category: 'Elections',
    country: 'CA',
    province: 'QC',
    status: 'published',
    eventDate: '2026-08-16T17:00:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'country',
    latitude: 48.4284,
    longitude: -71.0664,
    body: `OTTAWA, ON — Prime Minister Mark Carney formally issued the writs of election for three federal by-elections scheduled for Monday, August 31, 2026, setting the stage for a critical regional test of party strength in the Saguenay–Lac-Saint-Jean riding of Chicoutimi—Le Fjord.

## Electoral Context and Senate Appointment

The vacancy in Chicoutimi—Le Fjord was created following the resignation of veteran Conservative Member of Parliament Richard Martel on July 7, 2026, upon his appointment by Prime Minister Carney to the Senate of Canada representing Quebec:

* **Parliamentary Arithmetic**: The August 31 vote represents an important bellwether for the governing Liberal Party under Prime Minister Carney's leadership as it seeks to expand its parliamentary standing following recent floor-crossings and by-election pickups across Ontario and Atlantic Canada.
* **Liberal Nomination**: The Liberal Party confirmed local agricultural and dairy leader Daniel Gobeil as its candidate, campaigning on federal investments in regional aluminum decarbonization, forestry supply-chain protection, and supply-management stability.
* **Opposition Challenge**: The Conservative Party of Canada and the Bloc Québécois have launched intensive regional ground campaigns, framing the by-election as a verdict on federal industrial policy and Canada-U.S. trade negotiations.

"The residents of Chicoutimi—Le Fjord deserve an energetic voice in the House of Commons who will fight for clean regional industry, support our world-class forestry and aluminum workers, and defend Quebec's economic interests," Prime Minister Carney said in a statement released by the Prime Minister's Office.

## Local Economic Staking and Trade Dynamics

The by-election campaign is unfolding against the backdrop of intense bilateral trade negotiations between Canada and the United States ahead of the impending August 19 tariff deadline. Chicoutimi—Le Fjord is home to major low-carbon aluminum smelters operated by Rio Tinto and extensive forestry operations, making trade stability and market access central voter concerns.

Elections Canada confirmed that advanced voting stations will operate across the riding from August 21 to August 24, with return offices fully operational in Chicoutimi and La Baie to facilitate special ballot applications.

## Campaign Timetable and Final Vote

With the official writs issued, candidates face a condensed two-week campaign window leading up to polling day on August 31. The result will determine representation for one of Quebec's most economically pivotal resource ridings as Parliament prepares to resume its fall sitting in Ottawa.`,
    seoTitle: 'Carney Calls Chicoutimi-Le Fjord Federal By-Election 2026 | Choseno',
    metaDescription: 'Prime Minister Mark Carney issues writs for August 31 federal by-election in Chicoutimi—Le Fjord following Richard Martel\'s Senate appointment.',
    tags: [
      'Mark Carney',
      'Richard Martel',
      'Chicoutimi—Le Fjord',
      'By-Elections',
      'Elections Canada',
      'Liberal Party',
      'Conservative Party',
      'Quebec Politics'
    ],
    tweet: 'Prime Minister Mark Carney calls federal by-elections for August 31, 2026, setting up a major parliamentary showdown in the Quebec riding of Chicoutimi—Le Fjord.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Prime Minister of Canada - Official By-Election Announcement',
        url: 'https://pm.gc.ca/en/news/news-releases/2026/08/10/prime-minister-announces-by-elections'
      },
      {
        label: 'Elections Canada - Notice of Election Chicoutimi—Le Fjord',
        url: 'https://www.elections.ca/content.aspx?section=med&dir=pre&document=aug1026&lang=e'
      }
    ],
    taggedPoliticianIds: [
      '4bd5cf73-1d03-4fb2-ae1b-2303c2c99737',
      '2ac47ab7-41a8-461c-ba81-5ea3d52caae7'
    ],
    taggedPoliticians: [
      'Mark Carney',
      'Richard Martel',
      'Daniel Gobeil'
    ]
  },
  {
    slug: 'canada-bill-c34-safe-social-media-act-age-verification-2026-08-17',
    headline: 'Federal Government Advances Digital Safety Standards Under Bill C-34 \'Safe Social Media Act\'',
    summary: 'The federal government and the newly constituted Digital Safety Commission establish technical benchmarks to restrict social media access for youth under 16 while safeguarding user privacy.',
    category: 'Policy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-16T16:00:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'country',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, ON — The Government of Canada advanced technical regulatory guidelines for the implementation of Bill C-34, the *Safe Social Media Act*, moving forward with nationwide requirements to restrict commercial social media platforms from maintaining active user accounts for children under the age of 16.

## Statutory Framework and Digital Safety Commission

The legislative architecture, originally introduced in Parliament in June 2026, establishes strict corporate compliance standards for global technology platforms operating within Canadian jurisdiction:

* **Under-16 Account Restrictions**: Prohibits social media platforms from creating or maintaining user profiles for minors under 16 years of age, addressing growing clinical evidence regarding youth mental health, algorithmic addiction, and cyberbullying.
* **Enforcement Authority**: Empowers the newly created Digital Safety Commission of Canada to audit platform compliance, issue corrective orders, and levy administrative monetary penalties reaching up to 5% of global annual turnover for systemic non-compliance.
* **Age Assurance Technical Consultations**: Initiates formal regulatory consultations between the Department of Canadian Heritage, the Office of the Privacy Commissioner of Canada, and digital platforms to define certified age-estimation technologies that do not require mandatory government-issued ID collection or biometric data hoarding.

"Every parent in this country knows the profound toll that unregulated algorithmic feeds are taking on our children's mental well-being and development," Minister of Canadian Heritage Marc Miller said during a policy briefing in Ottawa. "Bill C-34 establishes clear digital guardrails. We are holding tech platforms accountable to protect our youth while upholding the highest standards of user privacy and data security."

## Privacy Commissioner Guidance and Public Debate

The regulatory framework incorporates binding recommendations from Privacy Commissioner Philippe Dufresne, ensuring that platforms utilize zero-knowledge age verification protocols or device-level tokenization to prevent the centralized tracking of browsing habits.

Recent national polling by the Angus Reid Institute indicated that over 74% of Canadian parents support statutory age limits for social media, mirroring recent legislative frameworks adopted in Australia and several European jurisdictions. However, digital civil liberties organizations have emphasized the need for vigilant oversight to ensure that age assurance mechanisms do not inadvertently restrict adult digital anonymity.

## Implementation Timetable and Parliamentary Review

The standing committee on Canadian Heritage will resume clause-by-clause consideration of Bill C-34 when Parliament returns from the summer recess, with full statutory compliance required for major platforms within 12 months of royal assent.`,
    seoTitle: 'Canada Bill C-34 Safe Social Media Act Age Verification | Choseno',
    metaDescription: 'Ottawa advances regulatory standards under Bill C-34 Safe Social Media Act restricting under-16 accounts and enforcing privacy-first age verification.',
    tags: [
      'Bill C-34',
      'Safe Social Media Act',
      'Online Safety',
      'Digital Safety Commission',
      'Privacy Commissioner',
      'Mark Carney',
      'Marc Miller',
      'Tech Policy'
    ],
    tweet: 'Ottawa advances privacy guidelines under Bill C-34, requiring digital platforms to implement strict age verification standards to block social media accounts for minors under 16.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Department of Canadian Heritage - Safe Social Media Act Overview',
        url: 'https://www.canada.ca/en/canadian-heritage/services/online-safety/safe-social-media-act.html'
      },
      {
        label: 'CTV News - Age Verification Enforcement Under Bill C-34',
        url: 'https://www.ctvnews.ca/politics/ottawa-wants-to-block-kids-from-social-media-how-would-age-verification-work-1.6998234'
      }
    ],
    taggedPoliticianIds: [
      '4bd5cf73-1d03-4fb2-ae1b-2303c2c99737'
    ],
    taggedPoliticians: [
      'Mark Carney',
      'Marc Miller'
    ]
  },
  {
    slug: 'betty-mccollum-minnesota-defense-industrial-base-appropriations-2026-08-17',
    headline: 'Rep. Betty McCollum Pushes $849 Billion Defense Spending Priorities to Expand Minnesota Tech Sector',
    summary: 'House Appropriations Defense Subcommittee Ranking Member Betty McCollum leverages key committee leadership to channel advanced defense manufacturing, hypersonic testing, and AI contracts into Minnesota.',
    category: 'Economy',
    country: 'US',
    province: 'MN',
    status: 'published',
    eventDate: '2026-08-16T15:00:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'state',
    latitude: 44.9537,
    longitude: -93.0900,
    body: `SAINT PAUL, MN — U.S. Representative Betty McCollum (D-MN), the ranking member on the influential House Appropriations Subcommittee on Defense, highlighted Minnesota's rapidly expanding role in the national defense industrial base as Congress prepares to debate the $849 billion Fiscal Year 2027 defense appropriations bill.

## Defense Appropriations Leadership and Regional Contracting

Congresswoman McCollum's senior leadership on the defense subcommittee has positioned Minnesota aerospace, software, and precision manufacturing firms at the center of critical Pentagon modernization programs:

* **Advanced Hypersonics and Drone Capabilities**: Directing federal research and procurement dollars to Twin Cities engineering hubs developing next-generation thermal shielding materials, microelectronics, and autonomous counter-UAS (unmanned aerial systems) platforms.
* **Supply Chain Resiliency**: Channeling Defense Production Act investments into Upper Midwest foundries and circuit manufacturers to reduce dependence on overseas critical mineral processing.
* **Regional Job Creation**: Supporting an estimated 18,000 highly skilled aerospace and defense engineering jobs across Ramsey, Hennepin, and Washington counties.

"Minnesota's workers and technology innovators are delivering the cutting-edge capabilities our service members need to keep our nation secure," Representative McCollum said during a visit to an advanced manufacturing facility in Saint Paul. "By investing in domestic manufacturing, precision electronics, and high-tech apprenticeships right here at home, we are strengthening our national security while creating high-wage union jobs that support families across our state."

## Bipartisan Defense Strategy and Scrutiny

As Congress navigates broader budget caps, McCollum has advocated for disciplined fiscal oversight within the Pentagon, demanding stringent audits of major defense prime contractors and championing investments in soldier health, childcare facilities on military bases, and PFAS cleanup around defense installations.

The defense industry has taken note of Minnesota's growing clout, with major technology and aerospace firms expanding their engineering footprints in the Twin Cities to collaborate with the University of Minnesota and regional research laboratories.

## Legislative Outlook for Defense Authorization

The Defense Appropriations Subcommittee will hold final markups on the military spending package when the House convenes in September, with McCollum working to ensure provisions funding clean defense microgrids and domestic battery manufacturing remain intact in the final conference report.`,
    seoTitle: 'Betty McCollum Minnesota Defense Industry Appropriations | Choseno',
    metaDescription: 'Rep. Betty McCollum leverages House Defense Appropriations leadership to channel aerospace and tech contracts into Minnesota\'s defense industrial base.',
    tags: [
      'Betty McCollum',
      'Defense Appropriations',
      'Pentagon',
      'Minnesota Economy',
      'Manufacturing',
      'U.S. Congress',
      'National Security'
    ],
    tweet: 'Ranking Member Betty McCollum leverages her House Defense Appropriations role to secure major aerospace, hypersonics, and autonomous systems defense investments in Minnesota.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'U.S. House Committee on Appropriations - Defense Subcommittee',
        url: 'https://mccollum.house.gov/media/press-releases/mccollum-highlights-minnesota-defense-industrial-base'
      },
      {
        label: 'Minnesota Star Tribune - McCollum Defense Pipeline Analysis',
        url: 'https://www.startribune.com/betty-mccollum-minnesota-defense-industry-pentagon/600389201/'
      }
    ],
    taggedPoliticianIds: [
      '07d6bc12-5109-4a94-911f-0d5aeb942eb9'
    ],
    taggedPoliticians: [
      'Betty McCollum'
    ]
  },
  {
    slug: 'bowinn-ma-bc-interior-n95-masks-wildfire-smoke-emergency-2026-08-17',
    headline: 'Emergency Management Minister Bowinn Ma Deploys Free N95 Respirator Distribution Across B.C. Interior',
    summary: 'Minister of Emergency Management and Climate Readiness Bowinn Ma authorizes the free distribution of hospital-grade N95 masks through regional health hubs across the B.C. Interior as wildfire smoke triggers special air quality advisories.',
    category: 'Public Safety',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-16T17:30:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'local',
    latitude: 49.8880,
    longitude: -119.4960,
    body: `KELOWNA, B.C. — British Columbia Minister of Emergency Management and Climate Readiness Bowinn Ma announced the immediate deployment of over 500,000 free, hospital-grade N95 particulate respirators across the B.C. Interior, providing essential respiratory protection for vulnerable residents as persistent wildfire smoke pushes regional Air Quality Health Index (AQHI) ratings to severe levels.

## Provincial Distribution Network and Air Quality Advisories

The emergency public health initiative coordinates supplies from the provincial emergency stockpile directly to community distribution points across the Southern Interior, Okanagan, and Kootenay regions:

* **Distribution Points**: N95 masks are being distributed free of charge through public libraries, community health centres, friendship centres, and municipal civic buildings in Kelowna, Kamloops, Vernon, Penticton, Castlegar, and Cranbrook.
* **Air Quality Health Warnings**: Ministry of Environment air monitors recorded PM2.5 concentrations exceeding 150 micrograms per cubic metre across valley bottoms, posing acute health hazards for seniors, pregnant individuals, children, and residents with chronic asthma or cardiovascular conditions.
* **Clean Air Shelters**: The province is co-funding municipal clean-air cooling shelters equipped with HEPA filtration in civic arenas and community recreation complexes to offer immediate relief during peak smoke inversions.

"Wildfire smoke is an unavoidable reality of climate change, but breathing hazardous particulate matter should never be something our vulnerable neighbors have to endure alone," Minister Bowinn Ma stated during an emergency briefing in Kelowna. "By making high-filtration N95 respirators freely available in every community hub, we are reducing hospital emergency visits and ensuring British Columbians have the tools they need to stay safe."

## Healthcare Coordination and Fire Season Outlook

Interior Health and the BC Centre for Disease Control (BCCDC) praised the rapid distribution, noting that standard surgical and cloth masks offer negligible protection against fine PM2.5 wildfire particulates. Emergency departments across the Interior Health Authority have staged supplementary bronchodilator medications and oxygen reserves to manage surges in respiratory distress admissions.

The BC Wildfire Service reported battling 145 active fires across the Kamloops and Southeast fire centres, with stable suppression lines holding around priority interface communities despite dry lightning and gusting valley winds.

## Public Guidance and Monitoring

Residents across the Interior are encouraged to monitor local smoke forecasts via the BC Air Quality monitoring portal and utilize indoor air filtration where possible. Free mask pickup locations will remain operational throughout the duration of active special air quality advisories.`,
    seoTitle: 'Bowinn Ma B.C. Wildfire Smoke N95 Mask Distribution | Choseno',
    metaDescription: 'Minister Bowinn Ma announces 500,000 free N95 respirators distributed across B.C. Interior hubs to combat hazardous wildfire smoke.',
    tags: [
      'Bowinn Ma',
      'BC Wildfires',
      'Emergency Management BC',
      'Air Quality',
      'Interior Health',
      'Public Health',
      'Kelowna'
    ],
    tweet: 'Minister Bowinn Ma launches free N95 respirator distribution across B.C. Interior communities to protect vulnerable residents from hazardous wildfire smoke levels.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Ministry of Emergency Management and Climate Readiness',
        url: 'https://news.gov.bc.ca/releases/2026EMCR0032-000845'
      },
      {
        label: 'Global News BC - Interior Wildfire Smoke Mask Distribution',
        url: 'https://globalnews.ca/news/10698124/bc-interior-wildfire-smoke-n95-masks-air-quality/'
      }
    ],
    taggedPoliticianIds: [
      '179aff7b-8854-499d-a17f-b2aa302722d9'
    ],
    taggedPoliticians: [
      'Bowinn Ma'
    ]
  },
  {
    slug: 'eric-schmidt-california-wealth-tax-opposition-coalition-2026-08-17',
    headline: 'Tech Titans Clash as Eric Schmidt Backs PAC Campaign Opposing California\'s Proposed 5% Wealth Tax',
    summary: 'Former Google CEO Eric Schmidt and prominent Silicon Valley executives join "Building a Better California" to oppose a November ballot initiative proposing a one-time 5% wealth tax on billionaires.',
    category: 'Economy',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-16T18:00:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'state',
    latitude: 38.5816,
    longitude: -121.4944,
    body: `SACRAMENTO, CA — A major political clash between Silicon Valley titans and progressive labor coalitions intensified in California as former Google CEO Eric Schmidt joined a growing list of ultra-wealthy executives contributing substantial capital to "Building a Better California," a political advocacy committee organized to defeat a November statewide ballot measure proposing a 5% wealth tax on billionaires.

## Ballot Initiative Architecture and Tax Provisions

The proposed constitutional amendment, certified for the statewide general election ballot this November, establishes an unprecedented state-level levy on extreme personal net worth:

* **5% Net Worth Tax**: Imposes a one-time 5% tax on the worldwide taxable assets and net worth of California residents exceeding $1 billion, targeting concentrated equity holdings in publicly traded and private venture-backed corporations.
* **Projected State Revenue**: Proponents estimate the wealth tax would generate over $45 billion in dedicated state revenue earmarked for universal preschool funding, affordable housing construction, and climate-resilient water infrastructure.
* **PAC Opposition War Chest**: The opposition committee, "Building a Better California," has raised tens of millions of dollars from high-profile technology founders and executives, including substantial contributions from Google co-founder Sergey Brin and former CEO Eric Schmidt, to fund a massive statewide television and digital ad campaign.

"Punitive tax structures that target capital allocation will accelerate the departure of top entrepreneurs, researchers, and venture capital from California to tax-neutral states like Texas and Florida," business coalition spokespersons stated in campaign filings. "This measure threatens California's standing as the global capital of innovation and venture investment."

## Political Divide in Sacramento and Silicon Valley

The ballot campaign has exposed sharp divisions within the California Democratic Party. While progressive legislators and labor unions—including the California Teachers Association and SEIU—are actively mobilizing grassroots canvassers to champion the tax as a vital tool for economic fairness, Governor Gavin Newsom and moderate state lawmakers have consistently expressed skepticism regarding state wealth taxes, warning of volatile revenue cycles and tax-base flight.

Economic analysts note that because California's top 1% of income earners already contribute nearly 50% of personal income tax revenues, any migration of ultra-wealthy residents could create substantial structural deficits for general fund operations.

## Campaign Escalation Ahead of November Vote

With both sides preparing multi-million-dollar outreach blitzes, the wealth tax initiative is projected to become the most expensive and closely watched ballot initiative in California's 2026 election cycle.`,
    seoTitle: 'Eric Schmidt California 5% Wealth Tax Battle | Choseno',
    metaDescription: 'Former Google CEO Eric Schmidt joins billionaire coalition opposing California\'s November ballot measure for a 5% wealth tax.',
    tags: [
      'Gavin Newsom',
      'Eric Schmidt',
      'California Ballot Measure',
      'Billionaire Wealth Tax',
      'Silicon Valley',
      'Tax Policy',
      'Economy'
    ],
    tweet: 'Former Google CEO Eric Schmidt contributes to a multi-million-dollar coalition battling a California November ballot initiative that would levy a 5% wealth tax on billionaires.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'New York Post - Tech Billionaire Wealth Tax Coalition Dispute',
        url: 'https://nypost.com/2026/08/16/business/billionaire-civil-war-brews-between-ex-google-bosses-over-california-wealth-tax/'
      },
      {
        label: 'Los Angeles Times - California Billionaire Tax Initiative Battle',
        url: 'https://www.latimes.com/politics/california-billionaire-wealth-tax-ballot-measure-opposition-2026'
      }
    ],
    taggedPoliticianIds: [
      '400a040b-ee2a-448e-b2e2-1faeea46b718'
    ],
    taggedPoliticians: [
      'Gavin Newsom',
      'Eric Schmidt',
      'Sergey Brin'
    ]
  },
  {
    slug: 'pierre-poilievre-fuel-excise-tax-relief-extension-demand-2026-08-17',
    headline: 'Pierre Poilievre Urges Federal Government to Extend Fuel Excise Tax Suspension Through Summer 2027',
    summary: 'Conservative Leader Pierre Poilievre demands Prime Minister Mark Carney prolong the federal excise tax pause beyond the fall budget to prevent compounding shipping and food distribution costs.',
    category: 'Economy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-16T14:30:00Z',
    published_at: '2026-08-17T05:30:00Z',
    impactArea: 'country',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, ON — Official Opposition Leader Pierre Poilievre launched a nationwide economic campaign pressing Prime Minister Mark Carney to extend the federal fuel excise tax suspension through Canada Day 2027, warning that allowing the relief measure to expire this autumn would reignite freight inflation and increase everyday grocery costs for Canadian households.

## Federal Fuel Excise Tax Debate and Supply Chain Costs

The federal government temporarily suspended the 10-cent-per-litre federal excise tax on gasoline and 4-cent-per-litre tax on diesel earlier this year as part of an affordability relief package:

* **Affordability and Retail Impact**: The Conservative platform argues that extending the tax pause saves average Canadian commuting families between $15 and $25 per fill-up while shielding long-haul trucking companies from compounding diesel overhead.
* **Food Distribution Chains**: Freight and logistics associations have echoed calls for rate certainty, noting that diesel surcharges directly inflate wholesale transportation costs for fresh produce, dairy, and consumer goods moving between provincial borders.
* **Fiscal Cost and Parliamentary Pressure**: The Department of Finance estimates that prolonging the excise tax suspension for an additional nine months would reduce federal revenues by approximately $2.8 billion, a shortfall the government argues could constrain infrastructure spending.

"At a time when families are struggling with rent, high mortgage renewals, and steep grocery bills, the absolute last thing Ottawa should do is jack up the cost of gas and diesel," Poilievre stated during an address to small business owners in Ottawa. "Extending the fuel tax relief isn't just about saving money at the pump—it is about keeping food transport affordable and ensuring our domestic supply chains stay competitive."

## Government Response and Clean Economy Strategy

Prime Minister Mark Carney and Finance Minister officials defended the government's broader fiscal strategy, stating that targeted energy rebates and green transition incentives provide more sustainable long-term affordability without undermining federal deficit reduction targets. The government emphasized that upcoming fall fiscal updates will review all temporary measures based on macroeconomic inflation data.

Provincial premiers across Western Canada and Ontario have expressed support for continued fuel tax relief, with several provinces having enacted matching provincial fuel tax holidays to ease regional transit and freight expenses.

## Parliamentary Timetable

Poilievre confirmed the Official Opposition will introduce an express motion when Parliament reconvenes in September to force a recorded House of Commons vote on extending the fuel excise tax suspension through July 1, 2027.`,
    seoTitle: 'Poilievre Demands Extension of Fuel Excise Tax Relief 2027 | Choseno',
    metaDescription: 'Conservative Leader Pierre Poilievre calls on Prime Minister Mark Carney to extend federal fuel excise tax relief through Canada Day 2027.',
    tags: [
      'Pierre Poilievre',
      'Mark Carney',
      'Fuel Tax',
      'Excise Tax',
      'Inflation',
      'Cost of Living',
      'House of Commons',
      'Canadian Politics'
    ],
    tweet: 'Conservative Leader Pierre Poilievre urges Prime Minister Mark Carney to extend the federal fuel excise tax suspension through Canada Day 2027 to protect household budgets.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Conservative Party of Canada - Press Release on Fuel Tax Suspension',
        url: 'https://www.conservative.ca/poilievre-calls-for-fuel-excise-tax-relief-extension-through-summer-2027/'
      },
      {
        label: 'Global News - Federal Fuel Excise Tax Debate',
        url: 'https://globalnews.ca/news/10699234/poilievre-carney-fuel-excise-tax-suspension-canada-day/'
      }
    ],
    taggedPoliticianIds: [
      'a0d8ee32-8927-48bc-9a98-fee27dd02d51',
      '4bd5cf73-1d03-4fb2-ae1b-2303c2c99737'
    ],
    taggedPoliticians: [
      'Pierre Poilievre',
      'Mark Carney'
    ]
  }
];

function normalizeText(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

function getTokens(str) {
  return new Set(normalizeText(str).split(/\s+/).filter(w => w.length > 3));
}

function findDuplicate(incoming, existingList) {
  // 1. Check exact slug
  const slugMatch = existingList.find(e => e.slug === incoming.slug);
  if (slugMatch) return { isDup: true, id: slugMatch.id, match: slugMatch, reason: 'Exact slug matched' };

  // 2. Check source URL exact match
  const incomingUrls = (incoming.sources || []).map(s => s.url).filter(Boolean);
  for (const existing of existingList) {
    const existingUrls = (existing.content?.sources || []).map(s => s.url).filter(Boolean);
    const hasShared = incomingUrls.some(u => existingUrls.includes(u));
    if (hasShared) {
      return { isDup: true, id: existing.id, match: existing, reason: 'Source URL matched' };
    }
  }

  // 3. Check headline similarity within +/- 3 day window
  const incomingDate = new Date(incoming.eventDate || incoming.event_date || incoming.published_at).getTime();
  const incomingTokens = getTokens(incoming.headline);

  for (const existing of existingList) {
    const existingDate = new Date(existing.event_date || existing.published_at || 0).getTime();
    const diffDays = Math.abs(incomingDate - existingDate) / (1000 * 60 * 60 * 24);

    if (diffDays <= 3) {
      const existingTokens = getTokens(existing.headline);
      const intersection = [...incomingTokens].filter(t => existingTokens.has(t));
      const similarity = intersection.length / Math.max(incomingTokens.size, 1);

      if (similarity >= 0.7) {
        return { isDup: true, id: existing.id, match: existing, reason: `Headline similarity ${Math.round(similarity * 100)}%` };
      }
    }
  }

  return { isDup: false };
}

async function run() {
  if (articles.length === 0) {
    console.log('No articles found in the articles array. Edit scripts/insert-news-batch.js to add articles.');
    return;
  }

  // 1. Authenticate admin
  const authUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password';
  const authRes = await fetch(authUrl, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd })
  });
  const auth = await authRes.json();
  if (!auth.access_token) {
    console.error('Authentication failed:', auth);
    process.exit(1);
  }
  console.log('Authenticated admin:', auth.user.email);

  const headers = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + auth.access_token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  // 2. Fetch existing articles window for deduplication.
  const existRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?select=id,slug,headline,event_date,published_at,content&order=published_at.desc.nullslast&limit=1000', { headers });
  const existingList = (await existRes.json()) || [];
  console.log(`Loaded ${existingList.length} existing articles for deduplication screening.`);

  let successCount = 0;
  let dupsCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    console.log(`\n[${i + 1}/${articles.length}] Processing "${art.headline}"...`);

    const dupCheck = findDuplicate(art, existingList);

    const insertPayload = {
      slug: art.slug,
      headline: art.headline,
      summary: art.summary,
      category: art.category,
      country: art.country || null,
      province: art.province || null,
      status: art.status || 'published',
      event_date: art.eventDate || art.event_date || new Date().toISOString(),
      published_at: art.published_at || art.eventDate || new Date().toISOString(),
      impact_area: art.impactArea || art.impact_area || null,
      latitude: art.latitude != null ? Number(art.latitude) : null,
      longitude: art.longitude != null ? Number(art.longitude) : null,
      content: {
        body: art.body,
        seoTitle: art.seoTitle,
        metaDescription: art.metaDescription,
        tags: art.tags || [],
        tweet: art.tweet || undefined,
        breakingNews: Boolean(art.breakingNews),
        author: art.author,
        sources: art.sources || []
      }
    };

    let articleId;
    if (dupCheck.isDup) {
      articleId = dupCheck.id;
      dupsCount++;
      console.log(`  [Deduplication Match: ${dupCheck.reason}] Updating existing article (id: ${articleId})...`);
      const updateUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?id=eq.' + articleId;
      await fetch(updateUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(insertPayload)
      });
    } else {
      const createUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles';
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(insertPayload)
      });
      if (!createRes.ok) {
        console.error('  Insert error:', await createRes.text());
        continue;
      }
      const created = await createRes.json();
      articleId = created[0]?.id;
      if (created[0]) existingList.push(created[0]);
      console.log(`  Created new article with id: ${articleId}`);
    }

    // Sync tags and create/update mirrored wall post
    if (articleId && art.taggedPoliticianIds && art.taggedPoliticianIds.length > 0) {
      const tagUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/admin_sync_news_article_tags';
      const tagRes = await fetch(tagUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_article_id: articleId,
          p_politician_ids: art.taggedPoliticianIds
        })
      });
      if (!tagRes.ok) {
        console.error('  Tag sync error:', await tagRes.text());
      } else {
        console.log(`  Synced ${art.taggedPoliticianIds.length} politician tags to wall!`);
      }
    }

    // Sync electoral boundary tags from lat/lng
    if (articleId && insertPayload.latitude != null && insertPayload.longitude != null) {
      const boundaryUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/admin_sync_news_article_boundaries';
      const boundaryRes = await fetch(boundaryUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_article_id: articleId })
      });
      if (!boundaryRes.ok) {
        console.error('  Boundary sync error:', await boundaryRes.text());
      } else {
        const boundaries = await boundaryRes.json();
        console.log(`  Synced ${Array.isArray(boundaries) ? boundaries.length : 0} electoral boundary tag(s) from lat/lng.`);
      }
    }

    successCount++;
  }

  console.log('\n======================================================');
  console.log(`Completed: ${successCount} articles processed (${dupsCount} deduplicated/updated).`);
  console.log('======================================================');
}

run().catch(console.error);
