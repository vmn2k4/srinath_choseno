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
    slug: 'supreme-court-rejects-trump-appeal-e-jean-carroll-defamation-2026-08-17',
    headline: 'U.S. Supreme Court Denies Donald Trump Appeal in $5.6 Million E. Jean Carroll Defamation Verdict',
    summary: 'The Supreme Court turns away a rehearing request from Donald Trump, cementing the $5 million jury judgment plus interest in the landmark civil defamation and sexual abuse lawsuit.',
    category: 'Policy',
    country: 'US',
    province: 'DC',
    status: 'published',
    eventDate: '2026-08-17T14:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'country',
    latitude: 38.8906,
    longitude: -77.0044,
    body: `WASHINGTON, D.C. — The Supreme Court of the United States issued an order list rejecting a petition for rehearing from Donald Trump, officially exhausting his legal challenges to a federal civil jury verdict awarding writer E. Jean Carroll $5 million in compensatory and punitive damages for sexual abuse and defamation.

## Final Judicial Action and Financial Disbursement

The high court's denial of certiorari in the case, known procedurally as *Carroll II*, terminates multi-year appellate litigation originating in the U.S. District Court for the Southern District of New York:

* **Finality of Judgment**: The Supreme Court's order leaves intact the May 2023 jury verdict finding Trump liable under the New York Adult Survivors Act for battery and common-law defamation following public statements made in October 2022.
* **Disbursement of Escrow Funds**: While the petition for rehearing remained pending, federal court authorities confirmed that over $5.6 million—comprising the original $5.0 million jury award plus statutory post-judgment interest accrued at federal rates—was transferred to Carroll from a court-administered escrow account in July 2026.
* **Separate Defamation Appeal**: The ruling does not resolve Trump's separate pending federal appeal against an $83.3 million defamation verdict delivered by a different federal jury in January 2024, which is currently undergoing appellate review in the Second Circuit Court of Appeals.

"The Supreme Court's decision today brings finality to this matter and reaffirms that no individual, regardless of office, stands above the rule of law or the verdicts rendered by American juries," Carroll's legal team stated in a response filed with the federal clerk.

## Legal Precedent and Presidential Liability

The procedural conclusion of *Carroll II* establishes a significant benchmark regarding civil liability for statements made while holding or seeking public office. Trump's defense attorneys had argued that presidential immunity shielded his public denials and that federal judges erred in admitting prior depositions. Both the Second Circuit and the Supreme Court rejected these arguments without noted dissents on the rehearing order.

Legal analysts highlighted that the finality of the payout eliminates any further stay requests on the $5.6 million award, leaving the judgment fully satisfied on federal court dockets.

## Next Steps in Related Proceedings

Oral arguments in the Second Circuit regarding the separate $83.3 million judgment are scheduled for late autumn, where appellate judges will evaluate jury instructions and constitutional proportionality standards regarding punitive damages.`,
    seoTitle: 'Supreme Court Denies Trump Appeal in E. Jean Carroll Verdict | Choseno',
    metaDescription: 'U.S. Supreme Court rejects Donald Trump appeal in the $5.6M E. Jean Carroll defamation verdict, finalizing the civil judgment.',
    tags: [
      'Supreme Court',
      'Donald Trump',
      'E. Jean Carroll',
      'Federal Courts',
      'Defamation',
      'Judiciary',
      'U.S. Politics'
    ],
    tweet: 'The U.S. Supreme Court denies Donald Trump\x27s rehearing appeal in the $5.6M E. Jean Carroll defamation verdict, officially cementing the federal jury judgment.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Supreme Court of the United States - Order List',
        url: 'https://www.supremecourt.gov/orders/courtorders/081726zor_all.pdf'
      },
      {
        label: 'Reuters - Supreme Court Rebuffs Trump Appeal in Carroll Case',
        url: 'https://www.reuters.com/legal/us-supreme-court-again-rebuffs-trump-5-million-e-jean-carroll-case-2026-08-17/'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Donald Trump'
    ]
  },
  {
    slug: 'canada-us-trade-negotiations-impasse-auto-dairy-alcohol-tariffs-2026-08-17',
    headline: 'Canada and U.S. Face Critical Sector Impasse on Autos, Dairy, and Alcohol Ahead of August 19 Tariff Deadline',
    summary: 'With 50% tariffs on $28 billion in Canadian goods set to take effect on Wednesday, bilateral negotiations in Washington remain deadlocked over provincial liquor rules, supply management, and vehicle quotas.',
    category: 'Economy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-17T13:30:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'country',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, ON & WASHINGTON, D.C. — Bilateral emergency trade negotiations between Canada and the United States entered an intensely critical phase as negotiators confronted deep structural disagreements across three primary economic sectors with less than 48 hours remaining before a punitive 50 per cent tariff mandate takes effect on August 19, 2026.

## Sector-by-Sector Breakdown and Tariff Exposure

Canadian Trade Minister Dominic LeBlanc and Chief Negotiator Janice Charette concluded high-level meetings with U.S. Trade Representative Jamieson Greer, detailing persistent sticking points across sensitive bilateral supply chains:

* **Automotive Manufacturing**: U.S. negotiators proposed reducing existing 25 per cent auto tariffs down to 12.5 per cent in exchange for Canada lifting domestic vehicle quotas. Canadian officials rejected the offer, maintaining that partial tariffs would still devastate integrated assembly plants across Ontario and the Midwestern U.S.
* **Supply-Managed Agriculture**: Washington continues to demand increased market access for American dairy, poultry, and egg producers. Prime Minister Mark Carney reaffirmed federal commitments to protect Canada's supply-management framework, warning that compromising domestic food security is non-negotiable.
* **Provincial Alcohol Regulations**: U.S. officials singled out provincial liquor distribution boards—specifically in Ontario, Quebec, and British Columbia—for restricting shelf space for American wine, spirits, and craft beer. Ottawa is coordinating with provincial premiers to explore regulatory reciprocity to avert sweeping retaliatory tariffs.
* **Steel, Aluminum, and Forestry**: A failure to reach an accord by midnight Wednesday would trigger automatic 50 per cent duties across $28 billion in annual Canadian commodity exports, threatening over 120,000 manufacturing and mill jobs nationwide.

"We are at the table around the clock to protect Canadian jobs and ensure predictable North American commerce," Trade Minister Dominic LeBlanc stated during a media availability in Washington. "A tariff wall hurts workers and consumers on both sides of our shared border. We will defend our core economic sectors while working in good faith toward an equitable agreement."

## Economic Modeling and Provincial Preparation

Economic analyses published by the Canadian Chamber of Commerce and Scotiabank Economics project that an immediate 50 per cent tariff levy would reduce Canadian GDP growth by 1.8 percentage points over 12 months, with Ontario, Quebec, and New Brunswick facing the steepest industrial contraction.

Provincial premiers convened an emergency Council of the Federation teleconference to synchronize cross-border advocacy, with Ontario Premier Doug Ford signaling willingness to adjust provincial retail regulations if Washington removes tariff threats against steel and automotive sectors.

## Countdown to August 19 Midnight Deadline

Negotiators are scheduled to resume formal drafting sessions at the Office of the United States Trade Representative. Should talks fail to yield an agreement or a negotiated deadline extension, federal cabinet ministers confirmed that Canada has prepared a reciprocal list of targeted retaliatory tariffs against American exports.`,
    seoTitle: 'Canada-U.S. Trade Impasse on Auto Dairy Alcohol Tariffs | Choseno',
    metaDescription: 'Canada and U.S. trade talks reach impasse over autos, dairy, and alcohol rules as August 19 50% tariff deadline looms.',
    tags: [
      'Dominic LeBlanc',
      'Mark Carney',
      'Trade Negotiations',
      'Canada-US Tariffs',
      'Automotive',
      'Dairy',
      'Supply Management',
      'Economy'
    ],
    tweet: 'Canada and the U.S. face an acute trade impasse over autos, dairy, and provincial liquor rules as the August 19 deadline for 50% tariffs nears.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Global Affairs Canada - Team Canada Trade Update',
        url: 'https://www.international.gc.ca/trade-agreements-accords-commerciaux/topics-domaines/team-canada-trade-briefings-2026.aspx'
      },
      {
        label: 'CBC News - Canada-U.S. Trade Impasse Sector Breakdown',
        url: 'https://www.cbc.ca/news/politics/canada-us-trade-talks-sector-breakdown-august-17-2026-1.7296812'
      }
    ],
    taggedPoliticianIds: [
      '885e12f5-33d9-42a1-8dc9-b276069da88d',
      '4bd5cf73-1d03-4fb2-ae1b-2303c2c99737'
    ],
    taggedPoliticians: [
      'Dominic LeBlanc',
      'Mark Carney',
      'Jamieson Greer'
    ]
  },
  {
    slug: 'mark-kelly-demands-pentagon-relief-uss-abraham-lincoln-crew-2026-08-17',
    headline: 'Senator Mark Kelly Challenges Pentagon Leadership Over USS Abraham Lincoln Deployment and Confirms Relief Ship',
    summary: 'Navy veteran and U.S. Senator Mark Kelly pushes the Pentagon on extreme 250+ day sea deployment conditions aboard the USS Abraham Lincoln as the USS Washington is dispatched to relieve the strike group.',
    category: 'National',
    country: 'US',
    province: 'AZ',
    status: 'published',
    eventDate: '2026-08-17T13:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'country',
    latitude: 38.8899,
    longitude: -77.0090,
    body: `WASHINGTON, D.C. — U.S. Senator Mark Kelly (D-AZ), a retired U.S. Navy captain and naval aviator, issued a pointed public critique of the Department of Defense's operational management of naval carrier strike groups, detailing severe crew strain aboard the *USS Abraham Lincoln* (CVN-72) and confirming that the *USS Washington* has been mobilized to relieve the vessel after nearly nine continuous months deployed in the Middle East.

## Operational Fleet Stress and Quality of Life Concerns

In an extensive interview on National Public Radio (NPR), Senator Kelly, who serves on the Senate Armed Services Subcommittee on Readiness and Management Support, addressed mounting reports regarding living conditions aboard the aircraft carrier:

* **Extreme Underway Duration**: The *USS Abraham Lincoln* has operated for over 250 consecutive days without a port call, maintaining round-the-clock air patrols across the Red Sea and Persian Gulf.
* **Reported Shipboard Deficiencies**: Crew reports conveyed to congressional offices describe severe psychological exhaustion, critical shortages of fresh food and hygiene supplies, and widespread plumbing failures across enlisted quarters.
* **Pentagon Pushback and Accountability**: Kelly sharply rebuked statements from administration officials dismissing crew welfare reports, emphasizing that sustained carrier deployments without scheduled maintenance windows degrade long-term fleet readiness and accelerate early separations among experienced sailors.
* **Relief Deployment Authorized**: Kelly confirmed that the *USS Washington* strike group has been dispatched to the CENTCOM area of operations to execute a formal turnover and allow the Lincoln to begin its transit back to its homeport.

"When you keep a carrier strike group at sea for 250 days without a single port visit, you are pushing human beings and multimillion-dollar machinery to the breaking point," Senator Kelly stated. "True military readiness requires honest leadership and rigorous logistical discipline. You cannot dismiss genuine quality-of-life concerns as unimportant when thousands of young sailors are executing dangerous combat operations around the clock."

## Congressional Oversight and Defense Policy

Senator Kelly and Senator Richard Blumenthal (D-CT) formally requested that the Pentagon Inspector General initiate a comprehensive review into operational extension protocols and mental healthcare staffing aboard deployed surface vessels.

Naval architecture experts note that prolonged deployments without shipyard maintenance accelerate hull corrosion and propulsion component wear, creating downstream delays for subsequent scheduled carrier strike group deployments.

## Transition Timeline and Next Steps

The Department of the Navy announced that the relief transition between the *USS Washington* and the *USS Abraham Lincoln* will take place over the coming weeks, ensuring uninterrupted regional maritime security while initiating decompression protocols for the returning crew.`,
    seoTitle: 'Senator Mark Kelly USS Abraham Lincoln Deployment Oversight | Choseno',
    metaDescription: 'Senator Mark Kelly presses Pentagon over 250-day USS Abraham Lincoln deployment conditions as relief carrier USS Washington is dispatched.',
    tags: [
      'Mark Kelly',
      'U.S. Navy',
      'USS Abraham Lincoln',
      'USS Washington',
      'Pentagon',
      'Senate Armed Services',
      'Military Readiness'
    ],
    tweet: 'Senator Mark Kelly challenges Pentagon leadership on extreme 250-day deployment conditions aboard the USS Abraham Lincoln as relief ship USS Washington heads to Middle East.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'U.S. Senate - Office of Senator Mark Kelly',
        url: 'https://www.kelly.senate.gov/newsroom/press-releases/kelly-addresses-uss-abraham-lincoln-readiness-and-deployment-limits/'
      },
      {
        label: 'NPR - Sen. Mark Kelly on Conditions Aboard USS Lincoln',
        url: 'https://www.npr.org/2026/08/17/sen-mark-kelly-discusses-conditions-aboard-uss-lincoln'
      }
    ],
    taggedPoliticianIds: [
      '533a4b93-fa85-40c6-bb7e-2c3d20dd418a'
    ],
    taggedPoliticians: [
      'Mark Kelly',
      'Pete Hegseth'
    ]
  },
  {
    slug: 'jared-kushner-netanyahu-jerusalem-meeting-gaza-ceasefire-roadmap-2026-08-17',
    headline: 'Jared Kushner Holds Three-Hour Jerusalem Summit with Netanyahu to Advance U.S. 15-Point Gaza Framework',
    summary: 'Trump envoy Jared Kushner and former British Prime Minister Tony Blair meet Israeli Prime Minister Benjamin Netanyahu in Jerusalem to navigate critical deadlocks over troop withdrawal and disarmament.',
    category: 'International',
    country: 'US',
    province: 'DC',
    status: 'published',
    eventDate: '2026-08-17T12:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'international',
    latitude: 38.8977,
    longitude: -77.0365,
    body: `JERUSALEM & WASHINGTON, D.C. — Special Mideast Envoy Jared Kushner, acting on behalf of the Trump administration, held an extended three-hour bilateral summit in Jerusalem with Israeli Prime Minister Benjamin Netanyahu, seeking to unblock stalled negotiations on a 15-point U.S.-backed framework for a comprehensive Gaza ceasefire and post-conflict governance structure.

## Diplomatic Framework and Key Negotiating Points

The high-level talks in Jerusalem followed a rare, two-hour direct engagement between Kushner and senior Hamas representatives in Cairo, Egypt, coordinated through Egyptian and Qatari intelligence intermediaries:

* **15-Point Roadmap Sequence**: The U.S. proposal outlines a phased ceasefire, beginning with an immediate cessation of hostilities and reciprocal hostage-prisoner releases, followed by an international stabilization force and phased Israeli Defense Forces (IDF) troop withdrawals.
* **Core Disagreements on Sequence**: Prime Minister Netanyahu maintained that Israel will not execute complete troop withdrawals from the Philadelphi Corridor and central security perimeters until all armed militant organizations in Gaza complete verifiable disarmament.
* **High-Level Envoy Delegation**: Kushner was accompanied in the talks by Nickolay Mladenov, executive director of the administration's Board of Peace, and former British Prime Minister Tony Blair, who is assisting in designing civil administrative structures for post-war municipal recovery.
* **Regional Political Dynamics**: The diplomatic push occurs against the backdrop of domestic political pressures in Israel ahead of national elections scheduled for October 2026, with coalition partners demanding strict security conditions before approving any permanent truce.

"We are working diligently with all regional partners to establish durable peace, ensure the return of all hostages, and create an enduring framework for regional economic reconstruction," Kushner stated following the diplomatic session. "Achieving stability requires pragmatic compromise and verifiable security guarantees."

## Humanitarian Impact and International Reaction

International aid agencies and United Nations humanitarian coordinators reiterated urgent appeals for an immediate ceasefire to facilitate the delivery of critical food rations, clean water, and medical supplies across displaced civilian camps in central and southern Gaza.

Diplomatic officials in Cairo confirmed that Egyptian mediators are preparing updated bridging proposals addressing the timeline for security border handovers and civil policing recruitment.

## Upcoming Regional Engagements

The envoy delegation is scheduled to travel to Amman and Doha for follow-up consultations with Jordan and Qatar to finalize donor funding commitments for transitional municipal reconstruction before presenting the revised framework to the United Nations Security Council.`,
    seoTitle: 'Jared Kushner Meets Netanyahu in Jerusalem on Gaza Roadmap | Choseno',
    metaDescription: 'Jared Kushner holds three-hour meeting with Benjamin Netanyahu in Jerusalem to negotiate 15-point Gaza ceasefire and governance roadmap.',
    tags: [
      'Jared Kushner',
      'Benjamin Netanyahu',
      'Tony Blair',
      'Gaza Ceasefire',
      'Middle East Diplomacy',
      'Foreign Policy',
      'International'
    ],
    tweet: 'Jared Kushner holds a three-hour Jerusalem summit with Benjamin Netanyahu, pressing for movement on a 15-point U.S.-backed Gaza ceasefire framework.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Associated Press - Kushner Netanyahu Jerusalem Gaza Talks',
        url: 'https://apnews.com/article/kushner-netanyahu-gaza-ceasefire-negotiations-jerusalem-2026'
      },
      {
        label: 'The Hindu - Kushner Meeting with Netanyahu Stretches Past 3 Hours',
        url: 'https://www.thehindu.com/news/international/kushners-meeting-with-netanyahu-on-gaza-stretches-past-3-hours/article68535129.ece'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Donald Trump',
      'Jared Kushner',
      'Benjamin Netanyahu',
      'Tony Blair'
    ]
  },
  {
    slug: 'state-attorneys-general-meta-youth-safety-trial-oakland-federal-court-2026-08-17',
    headline: 'Multistate Coalition of Attorneys General Commences Historic Youth Safety and Addiction Trial Against Meta',
    summary: 'A bipartisan coalition of state attorneys general begins jury selection in Oakland federal court, alleging Meta engineered addictive features on Instagram and Facebook that caused severe youth mental health harm.',
    category: 'Policy',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-17T14:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'country',
    latitude: 37.8044,
    longitude: -122.2712,
    body: `OAKLAND, CA — A landmark federal civil trial began in the U.S. District Court for the Northern District of California as a bipartisan coalition of state attorneys general from California, Colorado, New Jersey, Kentucky, and over 30 other states commenced proceedings against Meta Platforms, alleging the tech giant knowingly deployed addictive algorithms and misleading safety assurances that harmed the mental health of millions of youth.

## Legal Allegations and Court Proceedings

Presided over by U.S. District Judge Yvonne Gonzalez Rogers in Oakland, the historic legal confrontation represents the most significant state-led consumer protection lawsuit against a social media conglomerate:

* **Design of Addictive Features**: State prosecutors allege Meta intentionally engineered features including infinite scroll, algorithmic recommendation loops, push notifications, and appearance-altering filters specifically calibrated to maximize engagement among adolescents despite internal research detailing associated risks of depression, anxiety, and body dysmorphia.
* **Violations of Federal and State Laws**: The lawsuit charges Meta with systemic violations of state consumer protection statutes prohibiting unfair and deceptive business practices, as well as statutory breaches of the federal Children's Online Privacy Protection Act (COPPA) regarding the unauthorized collection of data from users under 13.
* **Remedies and Structural Injunctions**: State attorneys general are seeking billions in statutory civil penalties and binding nationwide injunctions requiring Meta to disable addictive algorithmic loops for minors, enforce strict default privacy settings, and provide transparent third-party auditing of its recommendation engines.

"For years, Meta prioritized user engagement metrics and corporate ad revenue over the safety, health, and well-being of our children," California Attorney General Rob Bonta stated outside the Oakland courthouse. "Our bipartisan coalition is in federal court to hold Big Tech fully accountable and force structural changes that protect our young people from predatory algorithmic design."

## Defense Response and Industry Implications

Meta's legal defense filed extensive trial motions denying the allegations, asserting that the company has developed over 30 specialized parental supervision tools, time-limit reminders, and teen account protections. Meta argued that broader teenage mental health trends are influenced by multifaceted sociological factors rather than platform design.

Legal and technology scholars note that a verdict holding Meta liable under state consumer protection statutes could establish sweeping legal precedents, forcing social media platforms nationwide to re-engineer core feed architectures and recommendation mechanics.

## Trial Timetable

Jury selection commenced on Monday, with opening statements scheduled for Tuesday, August 18, 2026. The trial is projected to last six weeks, featuring testimony from academic psychologists, internal whistleblowers, and senior Meta product executives.`,
    seoTitle: 'State AGs Open Historic Meta Youth Addiction Trial | Choseno',
    metaDescription: 'Bipartisan state attorneys general begin federal trial in Oakland against Meta, alleging deceptive practices and youth mental health harms.',
    tags: [
      'Gavin Newsom',
      'Rob Bonta',
      'Meta',
      'Youth Mental Health',
      'Social Media Addiction',
      'Federal Courts',
      'Consumer Protection',
      'Technology'
    ],
    tweet: 'A bipartisan coalition of state AGs opens a landmark federal trial against Meta in California, alleging the company engineered addictive features that harmed youth mental health.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'California Department of Justice - AG Bonta Press Release',
        url: 'https://oag.ca.gov/news/press-releases/attorney-general-bonta-opens-trial-against-meta-youth-mental-health-harms'
      },
      {
        label: 'CNBC - Meta Faces Landmark Youth Addiction Trial in California',
        url: 'https://www.cnbc.com/2026/08/17/meta-faces-landmark-youth-addiction-trial-in-california-federal-court.html'
      }
    ],
    taggedPoliticianIds: [
      '400a040b-ee2a-448e-b2e2-1faeea46b718'
    ],
    taggedPoliticians: [
      'Gavin Newsom',
      'Rob Bonta',
      'Phil Weiser',
      'Mark Zuckerberg'
    ]
  },
  {
    slug: 'westinghouse-imports-russian-enriched-uranium-doe-waivers-2026-08-17',
    headline: 'Canadian-Owned Westinghouse Electric Receives Russian Uranium Shipments Under Active U.S. Energy Waivers',
    summary: 'A CBC Fifth Estate investigation reveals Canadian-owned Westinghouse and U.S. nuclear operators continue importing Russian enriched uranium under federal waivers despite trade bans and geopolitical sanctions.',
    category: 'Economy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-17T11:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'international',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, ON & PITTSBURGH, PA — A joint investigative report by CBC News' *The Fifth Estate* and international trade watchdogs revealed that Canadian-owned Westinghouse Electric Company and major nuclear operators continue to import low-enriched uranium (LEU) from Russia to fuel commercial nuclear reactors across North America, utilizing statutory waiver provisions in federal sanctions legislation.

## Investigation Findings and Trade Data

The investigation analyzed international maritime manifests, customs filings, and energy regulatory disclosures, outlining ongoing Western reliance on Russian state nuclear monopoly Rosatom:

* **Import Quantities and Valuation**: Data compiled by the Bellona Environmental Transparency Center showed that U.S. nuclear utilities and fuel fabricators imported approximately 400 tonnes of Russian enriched uranium in 2025 alone, valued at nearly $1 billion USD. Major commercial recipients included Westinghouse Electric—co-owned by Canadian private equity giant Brookfield Renewable Partners and Cameco Corporation—which received roughly 27 tonnes of Russian LEU.
* **Statutory Waiver Mechanism**: While the U.S. enacted the *Prohibiting Russian Uranium Imports Act* in August 2024, the legislation authorized the U.S. Department of Energy (DOE) to grant temporary import waivers through January 1, 2028, in instances where no viable domestic enrichment alternative exists or where imports are deemed critical to grid reliability.
* **Canadian Regulatory Disparity**: Unlike the United States, the Government of Canada has not imposed direct sanctions on Rosatom or its commercial export subsidiary, Tenex, allowing Canadian-based energy conglomerates to maintain contractual relationships through American subsidiaries.

"Western nuclear operators remain caught in a severe strategic vulnerability," energy policy analysts noted in the report. "While Western nations have sanctioned Russian oil, gas, and coal, Russia still controls nearly 44 per cent of global uranium enrichment capacity, making an immediate decoupling from Russian nuclear fuel a severe operational challenge for base-load power grids."

## Parliamentary Scrutiny and Industry Decoupling

The investigation sparked immediate reaction on Parliament Hill, with opposition critics and non-proliferation advocates calling for tighter scrutiny on Canadian corporate ownership structures and accelerated capital investments in domestic enrichment capabilities in Ontario and Saskatchewan.

Westinghouse and Cameco representatives stated that they are actively investing hundreds of millions in expanding North American conversion and enrichment infrastructure, including the expansion of the Springfields facility in the UK and conversion facilities in Port Hope, Ontario, to achieve complete supply-chain independence before the 2028 waiver expiration.

## Policy Outlook and Energy Security

The House of Commons Standing Committee on Natural Resources is expected to request testimony from energy executives and Canadian Nuclear Safety Commission officials to evaluate national nuclear supply-chain resilience ahead of planned Small Modular Reactor (SMR) deployments.`,
    seoTitle: 'Westinghouse Russian Uranium Imports Under US Waivers | Choseno',
    metaDescription: 'CBC Fifth Estate investigation reveals Canadian-owned Westinghouse continues importing Russian enriched uranium under U.S. DOE waivers.',
    tags: [
      'Westinghouse',
      'Cameco',
      'Brookfield',
      'Nuclear Energy',
      'Russian Uranium',
      'Energy Security',
      'Mark Carney',
      'Economy'
    ],
    tweet: 'A CBC Fifth Estate investigation reveals Canadian-owned Westinghouse imported tonnes of Russian enriched uranium under U.S. energy waivers despite sanctions.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'CBC News - The Fifth Estate Russian Uranium Investigation',
        url: 'https://www.cbc.ca/news/investigates/russian-enriched-uranium-shipped-to-canadian-owned-westinghouse-1.7296541'
      },
      {
        label: 'U.S. Department of Energy - Russian Uranium Prohibition Implementation',
        url: 'https://www.energy.gov/ne/articles/department-energy-implementation-russian-uranium-import-prohibition'
      }
    ],
    taggedPoliticianIds: [
      '4bd5cf73-1d03-4fb2-ae1b-2303c2c99737'
    ],
    taggedPoliticians: [
      'Mark Carney'
    ]
  },
  {
    slug: 'baltimore-homicides-record-historic-low-gvrs-community-policing-2026-08-17',
    headline: 'Baltimore Achieves Historic Crime Reduction as Mid-Year Homicides Fall to Lowest Levels in City History',
    summary: 'Mayor Brandon Scott and Baltimore Police officials report a 23% reduction in homicides, achieving the lowest mid-year violence numbers in recorded municipal history through targeted community intervention.',
    category: 'Public Safety',
    country: 'US',
    province: 'MD',
    status: 'published',
    eventDate: '2026-08-17T12:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'local',
    latitude: 39.2904,
    longitude: -76.6122,
    body: `BALTIMORE, MD — The City of Baltimore has achieved an unprecedented reduction in violent crime, recording the lowest mid-year homicide total in its modern history as comprehensive community violence intervention programs and data-driven policing strategies transform the city's public safety landscape.

## Crime Statistics and Strategy Mechanics

Data certified by the Baltimore Police Department (BPD) and evaluated in a comprehensive analysis published by *The New York Times* highlights a sustained multi-year decline across all violent crime categories:

* **Historic Mid-Year Tally**: Baltimore recorded 50 homicides during the first six months of 2026—a 23.1 per cent decrease compared to 2025 and the lowest six-month total ever documented since modern statistical tracking began.
* **Non-Fatal Shootings Decline**: Non-fatal shootings dropped by more than 28 per cent year-over-year, continuing a continuous downward trajectory that began in 2023.
* **Group Violence Reduction Strategy (GVRS)**: Academic research by the National Bureau of Economic Research (NBER) attributed the steep reduction to the city's GVRS model, which coordinates direct law enforcement focus on high-risk gang networks while offering intensive life-coaching, employment pathways, and housing support to individuals seeking to exit street violence.
* **Community Violence Intervention (CVI)**: The city's Mayor's Office of Neighborhood Safety and Engagement (MONSE) deployed over $40 million in targeted community violence intervention funding to grassroots peacekeepers and hospital-based violence response teams.

"For decades, Baltimore was defined by tragedies and headlines of violence, but today we are writing a completely new chapter," Mayor Brandon M. Scott said during an address at City Hall. "This progress is not an accident. It is the direct result of treating gun violence as a public health emergency, investing in our neighborhoods, and coordinating between police, street outreach workers, and community leaders."

## Regional and National Implications

Baltimore's homicide decline has significantly outpaced broader national violent crime reductions reported by the Council on Criminal Justice, drawing delegations from municipal police departments across Chicago, Philadelphia, and New Orleans to study the Baltimore GVRS framework.

Local business associations and neighborhood community development corporations in West and East Baltimore reported increased foot traffic and commercial corridor investments as neighborhoods that experienced decades of disinvestment see improved public safety stability.

## Next Steps for Municipal Public Safety

Mayor Scott confirmed that the city will expand GVRS operations into the Western and Southwestern police districts ahead of the autumn months, while partnering with the University of Maryland Medical System to expand trauma-informed mental health resources for youth.`,
    seoTitle: 'Baltimore Homicides Drop to Record Historic Lows 2026 | Choseno',
    metaDescription: 'Baltimore records historic crime reduction as mid-year homicides fall 23% to lowest levels in recorded city history under Mayor Brandon Scott.',
    tags: [
      'Baltimore',
      'Brandon Scott',
      'Public Safety',
      'Crime Reduction',
      'GVRS',
      'Community Policing',
      'Maryland Politics'
    ],
    tweet: 'Baltimore records its lowest mid-year homicide count in modern history, falling 23% as targeted community violence intervention drives historic crime reductions.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'City of Baltimore - Mayor Brandon M. Scott Press Release',
        url: 'https://mayor.baltimorecity.gov/news/press-releases/2026-07-01-baltimore-records-historic-drop-violent-crime-midyear'
      },
      {
        label: 'The New York Times - Murder Drops to Historic Lows in Baltimore',
        url: 'https://www.nytimes.com/2026/08/17/us/baltimore-homicide-rate-decline-gvrs.html'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Brandon Scott'
    ]
  },
  {
    slug: 'susan-holt-new-brunswick-collaborative-care-clinics-expansion-2026-08-17',
    headline: 'Premier Susan Holt Accelerates Expansion of Collaborative Healthcare Clinics Across New Brunswick',
    summary: 'The Government of New Brunswick opens its 16th collaborative healthcare clinic as part of a $30 million primary care overhaul to attach unassigned patients to team-based medical practices.',
    category: 'Healthcare',
    country: 'CA',
    province: 'NB',
    status: 'published',
    eventDate: '2026-08-17T11:30:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'state',
    latitude: 45.9636,
    longitude: -66.6431,
    body: `FREDERICTON, N.B. — Premier Susan Holt and Health Minister officials announced the operational launch of New Brunswick's 16th collaborative primary care clinic, crossing the halfway threshold of the provincial government's statutory commitment to open 30 multidisciplinary "health homes" across the province by 2028.

## Collaborative Care Framework and Resource Allocation

The provincial healthcare expansion, funded through a dedicated $30 million allocation in the 2026–2027 provincial budget, restructures primary care delivery across Horizon Health Network and Vitalité Health Network:

* **Interdisciplinary Team Model**: Each collaborative clinic integrates family physicians, nurse practitioners, registered nurses, clinical pharmacists, social workers, and physiotherapists under a shared clinical governance model, allowing patients to be triaged to the most appropriate healthcare professional.
* **Patient Attachment Progress**: Over 38,000 New Brunswickers previously registered on the NB Health Link patient registry have been formally attached to permanent collaborative care teams since the rollout began, significantly reducing emergency department reliance for routine prescription renewals and chronic disease management.
* **Physician and Nurse Retention Agreements**: The initiative is supported by a four-year, $270-million compensation agreement negotiated with the New Brunswick Medical Society (NBMS) providing overhead subsidies for physicians transitioning to collaborative clinics, alongside a collective agreement with the New Brunswick Nurses Union delivering a 12.5 per cent wage increase over four years.

"Every New Brunswicker deserves timely, dignified access to a dedicated primary healthcare team close to home," Premier Susan Holt said during a clinic opening in Saint Andrews. "By moving away from isolated solo practices toward modern team-based care, we are giving our doctors and nurses the administrative support they need while connecting thousands of families to reliable, lifelong healthcare."

## Digital Health Integration and Waitlist Challenges

The Department of Health is pairing clinic expansions with a province-wide transition to a unified electronic medical record (EMR) system, enabling secure data sharing across hospital networks and community clinics.

While the government has met preliminary recruitment milestones, Premier Holt acknowledged ongoing regional challenges, particularly in rural northern ridings and the Miramichi region, where specialized nursing recruitment and bilingual practitioner shortages require continued incentive funding.

## Parliamentary Timetable and Future Openings

The provincial government confirmed site preparations are underway for seven additional collaborative clinics scheduled to open before March 2027, with priority locations identified in Campbellton, Edmundston, and the Sussex region.`,
    seoTitle: 'Premier Susan Holt New Brunswick Collaborative Health Clinics | Choseno',
    metaDescription: 'Premier Susan Holt opens 16th collaborative care clinic in New Brunswick as part of $30M primary healthcare transformation.',
    tags: [
      'Susan Holt',
      'New Brunswick',
      'Healthcare Reform',
      'Collaborative Care',
      'Horizon Health',
      'Vitalite Health',
      'NB Politics'
    ],
    tweet: 'Premier Susan Holt opens New Brunswick\x27s 16th collaborative care clinic, surpassing the halfway mark in her $30M commitment to establish 30 team-based health practices.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Government of New Brunswick - Executive Council Health Announcements',
        url: 'https://www2.gnb.ca/content/gnb/en/news/news_release.2026.08.0412.html'
      },
      {
        label: 'CBC News New Brunswick - Collaborative Care Clinic Progress',
        url: 'https://www.cbc.ca/news/canada/new-brunswick/collaborative-care-clinics-expansion-holt-government-1.7296231'
      }
    ],
    taggedPoliticianIds: [
      'fdb34e1f-f20f-44c1-8092-003e83d5cc08'
    ],
    taggedPoliticians: [
      'Susan Holt'
    ]
  },
  {
    slug: 'canadian-citizenship-certificate-backlog-120000-descent-applications-2026-08-17',
    headline: 'Demand for Canadian Citizenship Certificates Soars Past 120,000 Backlog as Processing Times Stretch to 25 Months',
    summary: 'Immigration, Refugees and Citizenship Canada faces a massive surge in citizenship certificate applications, driven by descent-based claims from the United States following legislative reforms.',
    category: 'National',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-17T11:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'country',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, ON — An investigative report by CBC News revealed that Immigration, Refugees and Citizenship Canada (IRCC) is confronting an unprecedented administrative backlog of more than 120,000 applications for Canadian citizenship certificates, pushing standard processing times from 12 months up to 25 months.

## Surging Demand and Legislative Catalysts

The dramatic spike in certificate applications follows statutory amendments passed by Parliament reforming the first-generation limit on Canadian citizenship by descent:

* **Application Backlog Volume**: Official IRCC statistical datasets confirmed that active applications for "Proof of Citizenship" certificates surpassed 120,000 files in August 2026, representing a 140 per cent increase compared to historical annual averages.
* **Cross-Border Inflow from the U.S.**: Over 65 per cent of the surge originates from applicants residing in the United States, driven by American citizens claiming Canadian nationality through second-generation descent following recent Ontario Superior Court and federal statutory updates.
* **Processing Delays**: Applicants seeking proof of citizenship to obtain Canadian passports, register for provincial healthcare, or enroll in Canadian universities face average processing wait times stretching between 22 and 25 months.

"The demand for Canadian citizenship proof has skyrocketed following necessary statutory reforms to ensure fairness for families born abroad," IRCC departmental officials stated in response to parliamentary inquiries. "We are automating intake verification and shifting operational resources to reduce wait times while maintaining rigorous identity verification standards."

## Constituent Impact and Passport Processing

The backlog has created significant bottlenecks for dual citizens seeking to relocate to Canada for employment or higher education. Because Passport Canada requires a certified citizenship certificate before issuing a Canadian passport to individuals born abroad, thousands of applicants have been left in administrative limbo.

Immigration attorneys and cross-border trade organizations have urged the federal government to establish an urgent expedited processing channel for specialized workers and students with confirmed academic or employment offers.

## Parliamentary Review and Departmental Modernization

The House of Commons Standing Committee on Citizenship and Immigration announced plans to hold special oversight hearings when Parliament returns in September, examining IRCC staffing allocations and the rollout of digital certificate verification portals to clear the backlogged files by late 2027.`,
    seoTitle: 'Canadian Citizenship Certificate Backlog Hits 120,000 | Choseno',
    metaDescription: 'IRCC citizenship certificate backlog exceeds 120,000 with 25-month wait times amid surging U.S. descent-based applications.',
    tags: [
      'Mark Carney',
      'Marc Miller',
      'IRCC',
      'Citizenship Canada',
      'Immigration',
      'Citizenship by Descent',
      'Federal Government'
    ],
    tweet: 'The backlog for Canadian citizenship certificates has surged past 120,000 with wait times hitting 25 months as descent-based applications flood in from the U.S.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Immigration, Refugees and Citizenship Canada - Processing Times Report',
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/reports-statistics/citizenship-certificates-processing-times-2026.html'
      },
      {
        label: 'CBC News - Demand for Canadian Citizenship Certificates Soaring',
        url: 'https://www.cbc.ca/news/politics/demand-canadian-citizenship-certificates-soaring-ircc-backlog-1.7296431'
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
    slug: 'bc-highway-97-reopens-summerland-wildfire-evacuation-rescinded-2026-08-17',
    headline: 'Highway 97 Fully Reopens Through Okanagan Corridor as Summerland Wildfire Evacuation Orders Rescinded',
    summary: 'The Ministry of Transportation and BC Wildfire Service lift travel restrictions on Highway 97 between Peachland and Summerland as containment lines hold, allowing hundreds of evacuees to return home.',
    category: 'Infrastructure',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-17T12:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'local',
    latitude: 49.6006,
    longitude: -119.6778,
    body: `SUMMERLAND, B.C. — British Columbia transportation and emergency officials fully reopened Highway 97 to unrestricted two-way traffic through the Okanagan corridor, lifting travel restrictions as wildfire suppression crews secured containment lines around the Summerland interface wildfire, enabling the Regional District of Okanagan-Similkameen (RDOS) to rescind evacuation orders for over 450 properties.

## Highway Reopening and Wildfire Suppression Progress

The Ministry of Transportation and Infrastructure, alongside the BC Wildfire Service, certified that geotechnical slope assessments along the cliffside corridor confirmed the roadway is safe from falling debris:

* **Unrestricted Corridor Flow**: Highway 97 between Peachland and Penticton had previously operated under pilot-car escorts and nighttime closures due to burning timber and rockfall hazards above the roadway. All time restraints have been officially lifted.
* **Evacuation Orders Downgraded**: The RDOS downgraded evacuation orders to evacuation alerts for properties along Garnet Valley Road and North Beach Road, permitting residents to return to their homes while remaining on standby.
* **Fire Suppression Assets**: Over 95 wildland firefighters, supported by heavy machinery guards and four intermediate bucketing helicopters, established 100 per cent structural protection perimeters, halting the wildfire's spread at 180 hectares.

"The reopening of Highway 97 is a major milestone for Okanagan commuters, regional tourism, and freight logistics," Minister of Emergency Management and Climate Readiness Bowinn Ma stated. "We thank the extraordinary wildfire crews, local municipal emergency teams, and utility workers who worked tirelessly in steep, hazardous terrain to protect homes and restore critical transport links."

## Agricultural Impact and Community Recovery

Local orchardists and vineyard operators in Summerland and Peachland expressed immense relief as the transportation reopening allows seasonal agricultural workers to resume fruit harvesting and enables freight trucks to deliver perishable produce to packing houses in Kelowna and Vancouver.

Emergency Support Services (ESS) reception centres in Penticton began demobilizing temporary lodging operations while continuing to provide psychological support, air purification supplies, and food vouchers for returning evacuees.

## Public Safety and Smoke Awareness

BC Wildfire Service officials cautioned that while the fire is designated as "being held," internal hot spots and smoky conditions will persist in the hills above the highway for several days. Motorists are advised not to stop on highway shoulders to view fire activity to prevent traffic congestion and maintain safety for patrol vehicles.`,
    seoTitle: 'B.C. Highway 97 Fully Reopens as Summerland Evacuation Lifted | Choseno',
    metaDescription: 'Highway 97 reopens between Peachland and Summerland as BC Wildfire crews contain interface fire, allowing evacuees to return home.',
    tags: [
      'David Eby',
      'Bowinn Ma',
      'Highway 97',
      'Summerland',
      'BC Wildfires',
      'Okanagan',
      'Transportation',
      'Infrastructure'
    ],
    tweet: 'Highway 97 fully reopens through the Okanagan corridor and Summerland evacuation orders are rescinded as BC Wildfire crews secure containment perimeters.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Ministry of Transportation and Infrastructure - Highway 97 Status',
        url: 'https://news.gov.bc.ca/releases/2026MOTI0041-000892'
      },
      {
        label: 'Castanet News - Highway 97 Reopened Summerland Evacuees Return',
        url: 'https://www.castanet.net/news/Penticton/501742/Highway-97-fully-reopened-through-Summerland-time-restraints-lifted'
      }
    ],
    taggedPoliticianIds: [
      'a730729a-0a3b-4231-b93d-9b5524f9db5e'
    ],
    taggedPoliticians: [
      'David Eby',
      'Bowinn Ma'
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
