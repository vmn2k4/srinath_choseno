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
    slug: 'hakeem-jeffries-democrats-supreme-court-dramatic-reform-2026-08-17',
    headline: 'House Democratic Leader Hakeem Jeffries Pledges \'Dramatic Reform\' of the U.S. Supreme Court',
    summary: 'House Minority Leader Hakeem Jeffries outlines a legislative priority to enact structural Supreme Court reforms, including enforceable ethics codes and term limits, if Democrats regain the House majority.',
    category: 'Policy',
    country: 'US',
    province: 'NY',
    status: 'published',
    eventDate: '2026-08-17T13:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'country',
    latitude: 38.8899,
    longitude: -77.0090,
    body: `WASHINGTON, D.C. — House Democratic Leader Hakeem Jeffries (D-NY) escalated his party's commitment to judicial reform, declaring that a Democratic-led House of Representatives will pursue "dramatic reform" of the Supreme Court of the United States to restore public trust and establish binding ethical oversight over the nation's highest bench.

## Proposed Judicial Restructuring and Legislative Framework

Speaking in nationwide television appearances and addresses before the National Association of Black Journalists (NABJ), Jeffries criticized the court's 6–3 conservative majority for eroding foundational voting rights protections and weakening federal regulatory authority:

* **Enforceable Code of Ethics**: Jeffries pledged that the House Judiciary Committee, under ranking member Rep. Jamie Raskin (D-MD), will draft legislation establishing an independent judicial ethics watchdog with statutory investigative subpoena powers and mandatory disclosure requirements for gifts and private travel.
* **Structural Reform Options**: Jeffries confirmed that House leadership is reviewing a broad suite of constitutional options, including 18-year staggered term limits for Supreme Court justices and jurisdictional boundary adjustments, while keeping all legislative options on the table.
* **Critique of Recent Jurisprudence**: Highlighting recent high court rulings such as *Louisiana v. Callais*, Jeffries argued that judicial rollbacks of Section 2 of the Voting Rights Act have disenfranchised minority communities and undermined the court's institutional legitimacy.

"The Supreme Court is in the midst of an unprecedented crisis of confidence because a radical majority has repeatedly acted like an unelected political super-legislature," Leader Jeffries stated. "The American people deserve an independent judiciary bound by the same ethical standards that apply to every other public servant. When Democrats take back the House, judicial accountability will be at the very top of our legislative agenda."

## Partisan Reaction and Capitol Hill Debate

Republican leaders pushed back sharply against Jeffries' statements, describing Democratic proposals as an unconstitutional attempt to delegitimize the judicial branch and undermine the constitutional separation of powers. Senate Republican leadership warned that any attempt to alter the court's composition or statutory authority would face a rigorous filibuster in the upper chamber.

Legal scholars note that while statutory ethics codes enjoy broad public support in national surveys, imposing mandatory term limits on sitting Article III judges presents complex constitutional questions that could prompt immediate judicial review.

## Next Steps for House Judiciary Caucus

Leader Jeffries instructed the Democratic Judiciary Working Group to conduct a series of public field hearings in September, gathering testimony from legal historians, civil rights attorneys, and former federal judges to finalize statutory text ahead of the 119th Congress.`,
    seoTitle: 'Hakeem Jeffries Pledges Dramatic Supreme Court Reform | Choseno',
    metaDescription: 'House Minority Leader Hakeem Jeffries pledges dramatic Supreme Court reforms, including enforceable ethics codes and term limits.',
    tags: [
      'Hakeem Jeffries',
      'Supreme Court',
      'Judicial Reform',
      'Jamie Raskin',
      'House Democrats',
      'Ethics in Government',
      'U.S. Politics'
    ],
    tweet: 'House Democratic Leader Hakeem Jeffries pledges dramatic Supreme Court reform, promising enforceable ethics codes and term limits if Democrats win the House.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'The Washington Post - Jeffries Calls for Dramatic Supreme Court Reform',
        url: 'https://www.washingtonpost.com/politics/2026/08/17/hakeem-jeffries-supreme-court-reform/'
      },
      {
        label: 'Democracy Docket - Congressional Push for Judicial Oversight',
        url: 'https://www.democracydocket.com/news-alerts/jeffries-pledges-supreme-court-ethics-reform-2026/'
      }
    ],
    taggedPoliticianIds: [
      '0bfc7974-d5a5-4740-bc6f-213d09b5cd90'
    ],
    taggedPoliticians: [
      'Hakeem Jeffries',
      'Jamie Raskin'
    ]
  },
  {
    slug: 'karoline-leavitt-white-house-press-secretary-departure-family-2026-08-17',
    headline: 'White House Press Secretary Karoline Leavitt Announces Departure Amid National Family and Career Discourse',
    summary: 'White House Press Secretary Karoline Leavitt confirms she will step down at the end of August to focus on her young family, triggering a national discussion on the intense demands of federal executive service.',
    category: 'Policy',
    country: 'US',
    province: 'DC',
    status: 'published',
    eventDate: '2026-08-17T12:30:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'country',
    latitude: 38.8977,
    longitude: -77.0365,
    body: `WASHINGTON, D.C. — White House Press Secretary Karoline Leavitt officially announced that she will depart her position as the administration's primary spokesperson at the end of August 2026, stepping away from the high-profile podium to focus on her young child and family life after serving as the youngest Press Secretary in modern presidential history.

## Executive Transition and Press Operations

Leavitt, who assumed the position in early 2025 following the presidential election, confirmed the transition during an executive briefing in the James S. Brady Press Briefing Room:

* **Record-Setting Tenure**: Appointed at age 27, Leavitt led daily televised press briefings, oversaw the West Wing communications apparatus, and directed messaging across multiple domestic and foreign policy crises.
* **Family Focus and Departure Rationale**: In a formal statement released by the White House, Leavitt expressed gratitude to President Donald Trump and senior administration staff, noting that the round-the-clock operational tempo of the briefing room necessitated stepping back to prioritize her family and infant son.
* **Interim Leadership Structure**: Principal Deputy Press Secretary Steven Cheung and senior communications advisors will assume day-to-day podium responsibilities while the administration reviews candidates for a permanent successor ahead of the autumn midterm campaign cycle.

"Serving as White House Press Secretary has been the absolute honor of a lifetime," Leavitt said. "Communicating the President's vision for the American people every day is a privilege, but my most important job will always be as a mother to my son. I look forward to supporting the administration in an advisory capacity while being present for my family's foundational early years."

## Social Discourse on Working Families in Government

Leavitt's departure sparked an extensive, viral conversation across digital platforms and Capitol Hill regarding the demanding conditions of senior political service and the broader systemic pressures facing working mothers in executive government roles. Commentary across political lines highlighted the grueling 18-hour workdays required of senior White House personnel.

The announcement coincided with broader discussions on family policy and career longevity in federal politics, with lawmakers noting the growing bipartisan recognition of the need for modernized family leave and operational flexibility in legislative and executive agencies.

## Next Steps for the White House Press Office

The White House Chief of Staff's office confirmed that a formal announcement regarding the next Press Secretary will be made prior to the President's upcoming diplomatic travel in September.`,
    seoTitle: 'Karoline Leavitt Steps Down as White House Press Secretary | Choseno',
    metaDescription: 'White House Press Secretary Karoline Leavitt announces departure at the end of August to focus on family, sparking national discussion.',
    tags: [
      'Karoline Leavitt',
      'White House',
      'Donald Trump',
      'Press Secretary',
      'West Wing',
      'Executive Branch',
      'U.S. Politics'
    ],
    tweet: 'White House Press Secretary Karoline Leavitt announces she will step down at the end of August to focus on her family after serving as the youngest spokesperson in modern history.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'The Washington Post - Leavitt to Step Down as White House Press Secretary',
        url: 'https://www.washingtonpost.com/politics/2026/08/17/karoline-leavitt-white-house-departure/'
      },
      {
        label: 'The Guardian - Press Secretary Leavitt Departure Sparks Family Policy Debate',
        url: 'https://www.theguardian.com/us-news/2026/aug/17/karoline-leavitt-white-house-press-secretary-resignation'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Karoline Leavitt',
      'Donald Trump'
    ]
  },
  {
    slug: 'nancy-pelosi-congressional-retirement-staff-leadership-transition-2026-08-17',
    headline: 'Former Speaker Nancy Pelosi Prepares Congressional Exit as Staff Network Anchors Capitol Hill Leadership Transition',
    summary: 'A Politico investigation reveals how former Speaker Nancy Pelosi\'s extensive legislative network continues to shape House Democratic policy and parliamentary strategy as she concludes nearly four decades in Congress.',
    category: 'Policy',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-17T11:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'country',
    latitude: 38.8899,
    longitude: -77.0090,
    body: `WASHINGTON, D.C. — As Representative Nancy Pelosi (D-CA) prepares to conclude her historic 39-year congressional career at the end of the current legislative term, an investigative analysis published by *Politico* highlights how the former Speaker's deeply entrenched network of former senior aides, floor strategists, and policy directors continues to direct legislative mechanics across the House Democratic Caucus.

## Institutional Legacy and Congressional Transition

Pelosi, the first woman to serve as Speaker of the House and one of the most effective legislative tacticians in American history, announced in November 2025 that she would not seek re-election in 2026:

* **Enduring Staff Influence**: Over 40 former senior Pelosi aides currently serve in top leadership posts on Capitol Hill, including chief-of-staff roles for prominent committee ranking members, the Democratic Congressional Campaign Committee (DCCC), and leadership staff for Minority Leader Hakeem Jeffries.
* **Mastery of House Procedure**: The analysis outlines how Pelosi's signature governing doctrine—disciplined caucus unity, precision vote counting, and strategic coalition-building—remains the operational blueprint for modern House Democrats as they navigate narrow congressional margins.
* **San Francisco Representation Transition**: In California's 11th Congressional District, local leaders and state lawmakers are engaged in a competitive primary contest to succeed Pelosi in representing San Francisco, marking the first open-seat race in the district in nearly four decades.

"Speaker Pelosi did not just pass transformative legislation—she built an enduring institutional pipeline of legislative talent that defines how the House operates to this day," senior congressional scholars noted in the report. "Even as she prepares her formal retirement, her strategic fingerprints are visible on every major floor vote and caucus initiative."

## Historical Achievements and Parliamentary Precedent

Throughout two stints as Speaker (2007–2011 and 2019–2023), Pelosi steered landmark legislation through the House, including the Affordable Care Act, the Dodd-Frank Wall Street Reform Act, the American Rescue Plan, and the Bipartisan Infrastructure Law. Her tenure set enduring benchmarks for legislative productivity under razor-thin partisan majorities.

Members of the Congressional Progressive Caucus and moderate New Democrat Coalition alike credited Pelosi with maintaining caucus cohesion during high-stakes budget standoffs and debt ceiling negotiations.

## Final Legislative Session and Retrospective

Speaker Emerita Pelosi is scheduled to participate in a series of archival interviews with the Library of Congress and the House Historical Office ahead of her formal retirement ceremony scheduled in the Capitol Statuary Hall in December.`,
    seoTitle: 'Nancy Pelosi Prepares Congressional Exit as Staff Shapes House | Choseno',
    metaDescription: 'Politico analysis reveals how Nancy Pelosi\'s staff network maintains deep legislative influence as the former Speaker prepares to exit Congress.',
    tags: [
      'Nancy Pelosi',
      'Hakeem Jeffries',
      'U.S. House of Representatives',
      'Congressional Leadership',
      'Capitol Hill',
      'California Politics',
      'Legislative Process'
    ],
    tweet: 'Former Speaker Nancy Pelosi prepares to conclude her historic 39-year congressional career as her veteran staff network continues to steer Capitol Hill strategy.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Politico - Nancy Pelosi Congressional Legacy and Staff Network',
        url: 'https://www.politico.com/news/2026/08/17/nancy-pelosi-staff-network-capitol-hill-influence-00174312'
      },
      {
        label: 'U.S. House Historical Office - Speaker Emerita Nancy Pelosi Records',
        url: 'https://history.house.gov/People/Listing/P/PELOSI,-Nancy-(P000197)/'
      }
    ],
    taggedPoliticianIds: [
      '7a67fb0d-7c62-488a-b3f3-23269759af54'
    ],
    taggedPoliticians: [
      'Nancy Pelosi',
      'Hakeem Jeffries'
    ]
  },
  {
    slug: 'toronto-zanzibar-tavern-historic-yonge-street-three-alarm-fire-2026-08-17',
    headline: 'Historic Zanzibar Tavern Gutted in Major Three-Alarm Downtown Toronto Fire on Yonge Street',
    summary: 'Toronto Fire Services battle a major blaze causing partial roof collapse at the 75-year-old landmark Zanzibar Tavern on Yonge Street, triggering temporary downtown road closures.',
    category: 'Local',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-17T10:30:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'local',
    latitude: 43.6577,
    longitude: -79.3802,
    body: `TORONTO, ON — Toronto Fire Services responded to a destructive three-alarm fire that tore through the historic Zanzibar Tavern building at 359 Yonge Street in the heart of downtown Toronto, resulting in severe structural damage, a partial roof collapse, and extensive traffic diversions along one of the city's primary commercial arteries.

## Emergency Response and Fire Ground Operations

Emergency crews were dispatched to Yonge and Elm streets shortly after 6:00 a.m. following 911 calls reporting heavy black smoke and flames billowing from the upper levels of the three-storey commercial structure:

* **Three-Alarm Mobilization**: More than 60 firefighters and 18 emergency vehicles arrived on scene. Due to intense heat and the compromised integrity of interior floor joists, incident commanders transitioned from offensive interior attack to defensive exterior aerial ladder operations.
* **No Casualties Reported**: Fire officials confirmed that no patrons or staff were inside the venue when the blaze erupted, and no injuries were reported among responding emergency personnel or nearby pedestrians.
* **Corridor Closures**: The Toronto Police Service closed Yonge Street between Dundas Street and Gerrard Street to facilitate water supply lines and heavy aerial equipment, while adjacent facilities including the Toronto Metropolitan University (TMU) Student Learning Centre were monitored for smoke infiltration.

"Our crews did an exceptional job containing a high-heat commercial fire in a very dense downtown corridor and preventing extension to neighboring heritage buildings," Toronto Fire Services Deputy Chief Larry Cocco stated during an on-site briefing. "The building has suffered severe roof and upper-floor structural damage, and our investigators are working closely with the Office of the Fire Marshal."

## Historical Significance and Owner Commitment

The Zanzibar Tavern has stood as a fixture of downtown Toronto's nightlife and streetscape since 1949, originally opening as a live jazz and blues club before transitioning into an adult entertainment venue under the Cooper family in 1960.

Second-generation owner Allen Cooper expressed profound devastation over the damage but confirmed his determination to restore the iconic location, stating that the venue will be rebuilt and modernized.

## Investigation and Roadway Reopening

The Office of the Fire Marshal and Toronto Police Service have launched a joint investigation to determine the origin and cause of the blaze, with preliminary reports indicating no immediate evidence of criminal suspicious activity. Structural engineers are conducting stability assessments of the exterior facade before Yonge Street transit lanes are reopened to regular traffic.`,
    seoTitle: 'Zanzibar Tavern Yonge Street Three-Alarm Fire Toronto | Choseno',
    metaDescription: 'Historic Zanzibar Tavern on Yonge Street suffers severe structural damage in major three-alarm downtown Toronto fire; no injuries reported.',
    tags: [
      'Olivia Chow',
      'Toronto Fire',
      'Yonge Street',
      'Zanzibar Tavern',
      'Toronto News',
      'Local News',
      'Public Safety'
    ],
    tweet: 'A major three-alarm fire causes partial roof collapse at Toronto\x27s historic 75-year-old Zanzibar Tavern on Yonge Street, prompting downtown road closures.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'CBC News Toronto - Zanzibar Tavern Three-Alarm Fire',
        url: 'https://www.cbc.ca/news/canada/toronto/zanzibar-tavern-yonge-street-fire-toronto-1.7296312'
      },
      {
        label: 'CP24 - Heavy Damage as Fire Crews Tackle Blaze at Zanzibar Tavern',
        url: 'https://www.cp24.com/news/toronto-fire-crews-battle-three-alarm-blaze-at-zanzibar-tavern-on-yonge-street-1.6998412'
      }
    ],
    taggedPoliticianIds: [
      'a6a62842-c720-4da1-aa66-2a347763d918'
    ],
    taggedPoliticians: [
      'Olivia Chow'
    ]
  },
  {
    slug: 'andy-burnham-targeted-white-house-chief-of-staff-cyber-impersonation-2026-08-17',
    headline: 'U.K. Prime Minister Andy Burnham Targeted in Cyber Impersonation of White House Chief of Staff Susie Wiles',
    summary: 'British and American intelligence authorities investigate after U.K. Prime Minister Andy Burnham was targeted by an unauthorized actor impersonating White House Chief of Staff Susie Wiles.',
    category: 'Technology',
    country: 'US',
    province: 'DC',
    status: 'published',
    eventDate: '2026-08-17T11:30:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'international',
    latitude: 38.8977,
    longitude: -77.0365,
    body: `WASHINGTON, D.C. & LONDON, U.K. — International cybersecurity and national intelligence agencies launched a joint inquiry following reports that British Prime Minister Andy Burnham was directly targeted in a sophisticated spear-phishing and social engineering attempt by an unauthorized actor posing as White House Chief of Staff Susie Wiles.

## Incident Details and Security Protocol Response

According to verified national security reporting by CBS News, Prime Minister Burnham briefly exchanged text messages of "no operational significance" with an unknown sender using a spoofed identity before recognizing inconsistencies and terminating contact:

* **Spear-Phishing Vector**: The fraudulent outreach utilized spoofed contact headers mimicking senior White House staff, attempting to establish informal messaging channels regarding upcoming bilateral diplomatic itineraries.
* **Immediate Protocol Escalation**: Burnham recognized suspicious conversational cues, broke off the messaging session, and immediately referred the digital telemetry and phone numbers to the U.K. National Cyber Security Centre (NCSC) and Downing Street security teams.
* **White House Clarification**: White House cybersecurity officials confirmed that Chief of Staff Susie Wiles' official and personal communication hardware were not compromised or hacked, indicating the attempt relied on external caller-ID spoofing and publicly harvested contact profiles.

"We take all attempts to target senior government officials with the utmost seriousness," a Downing Street spokesperson said, while declining to comment on specific operational security matters. "Robust cybersecurity protocols and multi-factor verification mechanisms successfully identified and neutralized the approach."

## Broader Threat Landscape and Diplomatic Vulnerabilities

The incident follows earlier federal law enforcement warnings from 2025 regarding coordinated attempts by foreign intelligence services and cybercriminal networks to target high-level political figures by harvesting executive contact books and utilizing AI-enhanced messaging personas.

Cybersecurity analysts from the Atlantic Council emphasized that state-aligned actors frequently use credential-harvesting impersonation to map informal communication channels between allied heads of state and senior executive advisors.

## Next Steps in Joint Investigation

The FBI's Cyber Division and the U.K. National Crime Agency (NCA) are conducting digital forensic tracing of the telecommunications relay servers utilized in the spoofing attempt to identify the originating jurisdiction and prevent future social engineering campaigns against allied leadership.`,
    seoTitle: 'U.K. Prime Minister Targeted in Susie Wiles Impersonation | Choseno',
    metaDescription: 'British Prime Minister Andy Burnham targeted in cyber impersonation of White House Chief of Staff Susie Wiles; joint investigation launched.',
    tags: [
      'Susie Wiles',
      'White House',
      'Cybersecurity',
      'Andy Burnham',
      'International Diplomacy',
      'National Security',
      'Technology'
    ],
    tweet: 'U.K. Prime Minister Andy Burnham was targeted in a cyber impersonation of White House Chief of Staff Susie Wiles before terminating the suspicious exchange.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'CBS News - U.K. Prime Minister Targeted in Susie Wiles Impersonation',
        url: 'https://www.cbsnews.com/news/uk-prime-minister-andy-burnham-impersonation-susie-wiles/'
      },
      {
        label: 'The Guardian - Downing Street Refers Digital Breach Attempt to Security Teams',
        url: 'https://www.theguardian.com/politics/2026/aug/17/uk-prime-minister-susie-wiles-messaging-impersonation'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Susie Wiles',
      'Donald Trump'
    ]
  },
  {
    slug: 'gavin-newsom-california-ai-cyber-defense-teen-tech-council-2026-08-17',
    headline: 'Governor Gavin Newsom Launches California AI Cyber Defense Initiative and State Teen Tech Council',
    summary: 'Governor Gavin Newsom activates a first-in-the-nation AI cyber defense program within Cal-CSIC and launches the California Teen Tech Council to protect critical public infrastructure and youth digital wellness.',
    category: 'Technology',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-17T11:00:00Z',
    published_at: '2026-08-17T14:30:00Z',
    impactArea: 'state',
    latitude: 38.5816,
    longitude: -121.4944,
    body: `SACRAMENTO, CA — California Governor Gavin Newsom and First Partner Jennifer Siebel Newsom announced a dual executive initiative advancing state leadership in artificial intelligence governance, establishing a first-in-the-nation AI Cyber Defense Program within the California Cybersecurity Integration Center (Cal-CSIC) while launching the official California Teen Tech Council to shape youth digital wellness policy.

## AI Cyber Defense Program and Critical Infrastructure Protection

The cybersecurity initiative operationalizes advanced generative AI tools and autonomous threat detection across state agencies to safeguard electrical grids, municipal water treatment facilities, and emergency response networks:

* **Cal-CSIC AI Defense Core**: Deploys proprietary automated threat-hunting algorithms within Cal-CSIC to identify vulnerabilities in state digital networks before foreign state-backed hackers can exploit them.
* **Agency AI Cybersecurity Officers**: Directs every major California state department and agency to appoint a designated AI Cybersecurity Officer responsible for auditing public automated systems, ensuring compliance with state privacy standards, and reporting algorithmic anomalies.
* **Cal-Secure 2.0 Roadmap**: Upgrades California's executive cybersecurity architecture to defend state government operations against deepfakes, automated phishing campaigns, and AI-generated zero-day exploits.

"California is the cradle of artificial intelligence, and we have a responsibility to lead the world not only in AI innovation, but in AI defense and digital safety," Governor Newsom stated in Sacramento. "By deploying AI against emerging cyber threats and giving young Californians a direct seat at the policy table, we are ensuring technology serves the public interest, safeguards our infrastructure, and protects our next generation."

## Teen Tech Council and Digital Wellness

In partnership with First Partner Jennifer Siebel Newsom and the non-profit advocacy organization #HalfTheStory, the administration launched the California Teen Tech Council, composed of 24 diverse youth leaders from across the state. The council will provide direct recommendations to executive agencies and the legislature on algorithmic design, social media mental health safeguards, and classroom AI literacy standards.

State health and education officials emphasized that engaging young users directly provides essential ground-level insight into how social algorithms impact adolescent sleep, mental health, and classroom engagement.

## Public AI Workforce Dashboard

The Governor's Office confirmed that the California Employment Development Department (EDD) is on track to launch its public AI Workforce Disruption Dashboard on August 19, 2026, providing real-time labor market analytics on how artificial intelligence adoption is affecting employment across California industry sectors.`,
    seoTitle: 'Gavin Newsom Launches California AI Cyber Defense & Teen Council | Choseno',
    metaDescription: 'Governor Gavin Newsom launches first-in-the-nation AI Cyber Defense Program in Cal-CSIC and California Teen Tech Council for digital wellness.',
    tags: [
      'Gavin Newsom',
      'California',
      'Artificial Intelligence',
      'Cybersecurity',
      'Cal-CSIC',
      'Digital Safety',
      'Tech Policy'
    ],
    tweet: 'Governor Gavin Newsom launches a first-in-the-nation AI Cyber Defense Program in California to protect critical infrastructure alongside a new Teen Tech Council.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Office of Governor Gavin Newsom - AI Cyber Defense & Teen Council',
        url: 'https://www.gov.ca.gov/2026/08/11/governor-newsom-launches-ai-cyber-defense-and-teen-tech-council/'
      },
      {
        label: 'Industrial Cyber - California Cal-CSIC AI Defense Integration',
        url: 'https://industrialcyber.co/state-initiatives/california-establishes-ai-cyber-defense-program-under-cal-csic/'
      }
    ],
    taggedPoliticianIds: [
      '400a040b-ee2a-448e-b2e2-1faeea46b718'
    ],
    taggedPoliticians: [
      'Gavin Newsom'
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
  const slugMatch = existingList.find(e => e.slug === incoming.slug);
  if (slugMatch) return { isDup: true, id: slugMatch.id, match: slugMatch, reason: 'Exact slug matched' };

  const incomingUrls = (incoming.sources || []).map(s => s.url).filter(Boolean);
  for (const existing of existingList) {
    const existingUrls = (existing.content?.sources || []).map(s => s.url).filter(Boolean);
    const hasShared = incomingUrls.some(u => existingUrls.includes(u));
    if (hasShared) {
      return { isDup: true, id: existing.id, match: existing, reason: 'Source URL matched' };
    }
  }

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
    console.log('No articles found in the articles array.');
    return;
  }

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
