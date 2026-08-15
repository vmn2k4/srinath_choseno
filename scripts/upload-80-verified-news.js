const fs = require('fs');
const path = require('path');

// 1. Read environment variables
const envPath = path.resolve(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

// ── CANADIAN ARTICLES (40) ───────────────────────────────────────────────────
const canadaArticles = [
  // Doug Ford (4)
  {
    slug: 'ford-unveils-ontario-data-centre-regulatory-playbook-2026',
    headline: 'Premier Doug Ford Unveils Regulatory Framework for Ontario AI Data Centres',
    summary: 'Ontario mandates dedicated power infrastructure and standardized industrial electricity rates for new large-scale data centres.',
    category: 'Technology',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-13T16:00:00Z',
    published_at: '2026-08-13T16:00:00Z',
    impactArea: 'state',
    latitude: 43.6629,
    longitude: -79.3917,
    body: `TORONTO, Ont. — Premier Doug Ford announced Ontario's new "Data Centre Playbook" on Thursday, establishing a standardized provincial framework designed to regulate power consumption, grid reliability, and data residency protections for artificial intelligence computing facilities.\n\n## Safeguarding Grid Reliability\n\nUnder the new guidelines, major data centre operators must coordinate power demands directly with the Independent Electricity System Operator (IESO) and invest in dedicated on-site power generation and efficiency standards during peak grid hours.\n\n"Ontario is open for high-tech innovation, but our grid must remain affordable for regular families and small businesses," Ford stated at Queen's Park.\n\n## Economic Outlook\n\nThe framework provides clarity for technology developers while ensuring the province retains regulatory authority over large industrial loads.`,
    seoTitle: 'Doug Ford Unveils Ontario Data Centre Playbook',
    metaDescription: 'Premier Doug Ford announces framework to regulate data centre energy usage in Ontario.',
    tags: ['Doug Ford', 'Ontario', 'Technology', 'Energy', 'Queen\'s Park'],
    taggedPoliticianIds: ['26ddb710-1861-4652-b8ed-dcbcc1dd7300'],
    sources: [{ label: 'Ontario Newsroom', url: 'https://news.ontario.ca' }]
  },
  {
    slug: 'ford-government-accelerates-ontario-line-subway-construction-2026',
    headline: 'Ford Government Accelerates Construction Timelines on Ontario Line Subway',
    summary: 'Infrastructure Ontario announces 24/7 tunneling operations for key downtown segments of the 15.6-kilometre rapid transit line.',
    category: 'Infrastructure',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-12T15:00:00Z',
    published_at: '2026-08-12T15:00:00Z',
    impactArea: 'state',
    latitude: 43.6532,
    longitude: -79.3832,
    body: `TORONTO, Ont. — Premier Doug Ford and transportation officials announced accelerated construction milestones for the Ontario Line subway project, authorizing around-the-clock tunneling under downtown Toronto.\n\n## Expanding Rapid Transit\n\nThe 15.6-kilometre rapid transit line will connect Exhibition Place through downtown to the Ontario Science Centre, easing congestion on the existing Line 1.\n\n"We are building the largest transit expansion in North America to get commuters home faster," Ford stated.\n\n## Neighborhood Monitoring\n\nMetrolinx confirmed real-time acoustic and vibration monitoring to minimize disruption to residential corridors.`,
    seoTitle: 'Ontario Line Subway Construction Accelerated by Ford Government',
    metaDescription: 'Ford government announces 24/7 tunneling milestones on Toronto\'s Ontario Line.',
    tags: ['Doug Ford', 'Transit', 'Infrastructure', 'Toronto', 'Metrolinx'],
    taggedPoliticianIds: ['26ddb710-1861-4652-b8ed-dcbcc1dd7300'],
    sources: [{ label: 'Metrolinx News', url: 'https://www.metrolinx.com' }]
  },
  {
    slug: 'ontario-lifts-post-secondary-tuition-freeze-two-percent-cap-2026',
    headline: 'Ontario Allows 2% Tuition Adjustments While Expanding Skills Training Grants',
    summary: 'The provincial government updates post-secondary funding guidelines to support college and university operational sustainability.',
    category: 'Education',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-11T17:00:00Z',
    published_at: '2026-08-11T17:00:00Z',
    impactArea: 'state',
    latitude: 43.6629,
    longitude: -79.3917,
    body: `TORONTO, Ont. — Minister of Colleges and Universities alongside Premier Doug Ford announced updated financial regulations allowing post-secondary institutions to implement capped tuition adjustments of up to two percent for domestic students starting in the fall.\n\n## Supporting Institutional Sustainability\n\nThe policy replaces a multi-year freeze while introducing targeted student loan protections and grant allocations for high-demand skilled trades.\n\n"Our priority is ensuring Ontario colleges and universities have the resources to train the next generation of healthcare workers and engineers," Ford said.\n\n## Student Assistance Safeguards\n\nOSAP funding thresholds were simultaneously adjusted to shield lower-income applicants from cost increases.`,
    seoTitle: 'Ontario Updates Post-Secondary Tuition Rules with 2% Cap',
    metaDescription: 'Ontario government introduces 2 percent tuition adjustments with expanded student loan supports.',
    tags: ['Doug Ford', 'Education', 'Ontario', 'OSAP', 'Queen\'s Park'],
    taggedPoliticianIds: ['26ddb710-1861-4652-b8ed-dcbcc1dd7300'],
    sources: [{ label: 'CBC News', url: 'https://www.cbc.ca/news' }]
  },
  {
    slug: 'ontario-increases-speed-limits-to-110-kmh-on-key-highways-2026',
    headline: 'Ontario Permanently Increases Speed Limits to 110 km/h on Key Provincial Highways',
    summary: 'Transportation Ministry expands higher speed limits across 10 additional highway sections to improve commercial freight flow.',
    category: 'Infrastructure',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-10T14:30:00Z',
    published_at: '2026-08-10T14:30:00Z',
    impactArea: 'state',
    latitude: 43.6532,
    longitude: -79.3832,
    body: `TORONTO, Ont. — The Ontario government has expanded its higher speed limit program, permanently raising limits from 100 km/h to 110 km/h on ten additional sections of provincial 400-series highways.\n\n## Modernizing Highway Corridors\n\nPremier Doug Ford emphasized that sections of Highway 401, 403, 406, and 416 were engineered safely for modern traffic volumes and commercial logistics.\n\n"These changes align Ontario with modern highway standards across Canada and the United States," Ford said.\n\n## Road Safety Oversight\n\nThe Ontario Provincial Police confirmed continued aerial and radar enforcement targeting aggressive and distracted driving.`,
    seoTitle: 'Ontario Raises Speed Limits to 110 km/h on 400-Series Highways',
    metaDescription: 'Ford government permanently increases speed limits on ten highway sections across Ontario.',
    tags: ['Doug Ford', 'Highways', 'Infrastructure', 'Ontario', 'Transportation'],
    taggedPoliticianIds: ['26ddb710-1861-4652-b8ed-dcbcc1dd7300'],
    sources: [{ label: 'The Canadian Press', url: 'https://www.thecanadianpressnews.ca' }]
  },

  // David Eby (4)
  {
    slug: 'david-eby-realigns-bc-cabinet-portfolios-health-finance-2026',
    headline: 'Premier David Eby Realigns B.C. Cabinet Portfolios for Health and Finance',
    summary: 'Josie Osborne assumes Finance responsibilities while Ravi Kahlon takes over the Health portfolio during Minister Bailey\'s medical treatment.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-14T18:00:00Z',
    published_at: '2026-08-14T18:00:00Z',
    impactArea: 'state',
    latitude: 48.4284,
    longitude: -123.3656,
    body: `VICTORIA, B.C. — Premier David Eby announced temporary cabinet portfolio adjustments at the Legislature today, ensuring operational continuity across vital government ministries.\n\n## Portfolio Adjustments\n\nEnergy Minister Josie Osborne will step in as interim Minister of Finance, while Housing Minister Ravi Kahlon will oversee the Ministry of Health.\n\n"Our thoughts are with Brenda Bailey and her family during her recovery," Premier Eby said. "Ministers Osborne and Kahlon bring extensive executive experience to maintain delivery on healthcare staffing and balanced fiscal management."\n\n## Core Priorities\n\nThe provincial executive affirmed that ongoing policy initiatives regarding housing density and capital health expansions will proceed without delay.`,
    seoTitle: 'David Eby Announces Interim Cabinet Portfolio Changes in B.C.',
    metaDescription: 'Premier David Eby reassigns Finance and Health duties during Minister Bailey\'s medical leave.',
    tags: ['David Eby', 'Ravi Kahlon', 'BC Politics', 'Victoria', 'Cabinet'],
    taggedPoliticianIds: ['a730729a-0a3b-4231-b93d-9b5524f9db5e', '472949c0-825a-498c-8a8e-33b6d292286e'],
    sources: [{ label: 'BC Gov News', url: 'https://news.gov.bc.ca' }]
  },
  {
    slug: 'bc-expands-transit-oriented-density-housing-mandates-2026',
    headline: 'B.C. Expands Transit-Oriented Density Housing Mandates Around SkyTrain Stations',
    summary: 'Housing Minister Ravi Kahlon and Premier David Eby designate 12 new transit-oriented development zones across Metro Vancouver.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-12T16:30:00Z',
    published_at: '2026-08-12T16:30:00Z',
    impactArea: 'state',
    latitude: 49.2827,
    longitude: -123.1207,
    body: `VANCOUVER, B.C. — The British Columbia government has formally designated 12 additional transit-oriented areas (TOAs) across the Lower Mainland, requiring municipalities to permit high-density residential towers within 800 metres of major transit stations.\n\n## Unlocking Housing Near Rapid Transit\n\nPremier David Eby and Housing Minister Ravi Kahlon highlighted that building homes adjacent to transit reduces commuting times and strengthens community vitality.\n\n"People want to live close to transit, shops, and services," said Premier Eby. "These rules ensure that taxpayers\' multi-billion dollar transit investments are matched with housing people can actually afford."\n\n## Municipal Coordination\n\nLocal zoning bylaws must be harmonized with provincial minimum density targets within 90 days.`,
    seoTitle: 'B.C. Expands Transit-Oriented Housing Zones in Metro Vancouver',
    metaDescription: 'Premier David Eby and Ravi Kahlon designate 12 new transit-oriented development hubs in BC.',
    tags: ['David Eby', 'Ravi Kahlon', 'Housing', 'SkyTrain', 'Metro Vancouver'],
    taggedPoliticianIds: ['a730729a-0a3b-4231-b93d-9b5524f9db5e', '472949c0-825a-498c-8a8e-33b6d292286e'],
    sources: [{ label: 'Global News BC', url: 'https://globalnews.ca' }]
  },
  {
    slug: 'bc-federal-clean-tech-partnership-300m-fund-2026',
    headline: 'B.C. and Ottawa Partner on $300M Clean Tech Innovation Fund',
    summary: 'Federal and provincial leadership allocate joint funding for clean hydrogen, battery storage, and carbon capture initiatives.',
    category: 'Economy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-10T19:00:00Z',
    published_at: '2026-08-10T19:00:00Z',
    impactArea: 'country',
    latitude: 49.2827,
    longitude: -123.1207,
    body: `VANCOUVER, B.C. — Premier David Eby joined federal Deputy Prime Minister Chrystia Freeland to announce a joint $300 million Clean Tech Acceleration Fund designed to scale domestic green technology manufacturing across Western Canada.\n\n## Industrial Decarbonization\n\nThe program will match private capital investments in clean hydrogen production, next-generation battery components, and direct-air carbon capture systems.\n\n"By partnering with British Columbia, we are creating high-paying skilled trade jobs and cementing Canada as a global clean energy powerhouse," Freeland stated in Vancouver.\n\n## Provincial CleanBC Synergy\n\nPremier Eby noted that the fund directly complements British Columbia's CleanBC climate accountability roadmap.`,
    seoTitle: 'B.C. and Federal Government Launch $300M Clean Tech Fund',
    metaDescription: 'David Eby and Chrystia Freeland announce $300 million federal-provincial clean tech investment.',
    tags: ['David Eby', 'Chrystia Freeland', 'Clean Tech', 'Economy', 'Vancouver'],
    taggedPoliticianIds: ['a730729a-0a3b-4231-b93d-9b5524f9db5e', '4674a6d5-d9c0-4ec8-95ab-9a12cc27b5fa'],
    sources: [{ label: 'CBC News', url: 'https://www.cbc.ca/news' }]
  },
  {
    slug: 'bc-emergency-wildfire-response-interior-coordination-2026',
    headline: 'Premier David Eby Coordinates B.C. Wildfire Response and Evacuation Supports',
    summary: 'Provincial emergency management deploys structural protection units and air tankers to safeguard Interior communities.',
    category: 'Public Safety',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-08T20:00:00Z',
    published_at: '2026-08-08T20:00:00Z',
    impactArea: 'state',
    latitude: 49.8880,
    longitude: -119.4960,
    body: `KELOWNA, B.C. — Premier David Eby met with regional emergency coordinators in the Okanagan today to oversee joint wildfire containment operations and community evacuation logistics.\n\n## Strategic Resource Deployment\n\nMore than 1,200 frontline BC Wildfire Service personnel, specialized structural defense crews, and heavy water bombers have been mobilized to protect residential corridors and critical highway links.\n\n"Our top priority is keeping people and communities safe," Premier Eby stated. "We have deployed every available provincial asset and are coordinating round-the-clock emergency accommodation for displaced residents."\n\n## Emergency Relief Programs\n\nEvacuees can access automated emergency financial assistance and lodging vouchers via the provincial emergency portal.`,
    seoTitle: 'Premier David Eby Coordinates B.C. Wildfire Emergency Response',
    metaDescription: 'David Eby reviews wildfire containment operations and evacuation support services in B.C. Interior.',
    tags: ['David Eby', 'Wildfires', 'Public Safety', 'Kelowna', 'BC Wildfire Service'],
    taggedPoliticianIds: ['a730729a-0a3b-4231-b93d-9b5524f9db5e'],
    sources: [{ label: 'BC Gov News', url: 'https://news.gov.bc.ca' }]
  },

  // Brenda Locke (3)
  {
    slug: 'mayor-brenda-locke-files-provincial-review-police-infrastructure-2026',
    headline: 'Mayor Brenda Locke Files Provincial Review Regarding Surrey Police Infrastructure Funding',
    summary: 'Surrey City Council requests independent accounting of transition expenses and equipment transfer protocols.',
    category: 'Public Safety',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-11T18:00:00Z',
    published_at: '2026-08-11T18:00:00Z',
    impactArea: 'local',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — Surrey Mayor Brenda Locke and council members have formally submitted a request for provincial administrative review concerning cost allocations for the Surrey Police Service transition.\n\n## Defending Surrey Taxpayers\n\nMayor Locke emphasized that the municipality requires transparent accounting regarding capital assets, dispatch infrastructure, and vehicle procurement expenses.\n\n"Our duty is to guarantee Surrey residents receive transparent value and uninterrupted public safety services," Locke stated at City Hall.\n\n## Ongoing Civic Operations\n\nFrontline emergency dispatch services continue to operate without disruption during the review period.`,
    seoTitle: 'Mayor Brenda Locke Requests Review on Surrey Policing Costs',
    metaDescription: 'Surrey Mayor Brenda Locke calls for provincial review of police transition capital funding.',
    tags: ['Brenda Locke', 'David Eby', 'Surrey', 'Public Safety', 'Local Governance'],
    taggedPoliticianIds: ['d06486ce-31ca-4977-a367-37a7a0552282', 'a730729a-0a3b-4231-b93d-9b5524f9db5e'],
    sources: [{ label: 'Surrey Now-Leader', url: 'https://www.surreynowleader.com' }]
  },
  {
    slug: 'surrey-city-council-approves-fraser-highway-rapidbus-expansion-2026',
    headline: 'Surrey City Council Approves 2026 RapidBus Expansion Across Fraser Highway',
    summary: 'TransLink and City of Surrey partner on dedicated bus lanes to improve transit frequency ahead of SkyTrain extension.',
    category: 'Infrastructure',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-09T17:00:00Z',
    published_at: '2026-08-09T17:00:00Z',
    impactArea: 'local',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — Surrey City Council under Mayor Brenda Locke has approved dedicated transit priority lanes along Fraser Highway, enabling expanded RapidBus service between Surrey Central and Fleetwood.\n\n## Reducing Congestion\n\nThe initiative provides immediate transit capacity improvements for commuters while construction progresses on the Surrey-Langley SkyTrain line.\n\n"Surrey is the fastest growing city in B.C., and our residents need fast, reliable transit options today," Mayor Locke stated.\n\n## Implementation Timeline\n\nConstruction of queue-jump lanes and passenger transit shelters will begin early this fall.`,
    seoTitle: 'Surrey Council Approves Fraser Highway RapidBus Expansion',
    metaDescription: 'Mayor Brenda Locke and Surrey Council greenlight dedicated RapidBus priority lanes.',
    tags: ['Brenda Locke', 'Surrey', 'Transit', 'Infrastructure', 'TransLink'],
    taggedPoliticianIds: ['d06486ce-31ca-4977-a367-37a7a0552282'],
    sources: [{ label: 'City of Surrey', url: 'https://www.surrey.ca' }]
  },
  {
    slug: 'surrey-parks-recreation-capital-investment-plan-2026',
    headline: 'Mayor Brenda Locke Unveils $45M Capital Upgrade for Surrey Community Centres',
    summary: 'City of Surrey invests in recreational facility expansions, artificial turf fields, and youth community hubs.',
    category: 'Local',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-07T16:00:00Z',
    published_at: '2026-08-07T16:00:00Z',
    impactArea: 'local',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — Mayor Brenda Locke announced a $45 million civic recreation investment package aimed at modernizing public community centres and expanding sports facilities across Newton, Guildford, and South Surrey.\n\n## Investing in Families and Youth\n\nThe multi-year capital plan includes expanding indoor ice rinks, constructing all-weather soccer pitches, and upgrading seniors\' activity programming spaces.\n\n"Recreational infrastructure is essential to community well-being and keeping young people active and engaged," Mayor Locke remarked during the announcement.\n\n## Project Phasing\n\nTenders for facility upgrades will be issued throughout the final quarter of 2026.`,
    seoTitle: 'Surrey Mayor Brenda Locke Announces $45M Recreation Investment',
    metaDescription: 'City of Surrey allocates $45M for community centre expansions and athletic parks.',
    tags: ['Brenda Locke', 'Surrey', 'Parks', 'Community', 'Recreation'],
    taggedPoliticianIds: ['d06486ce-31ca-4977-a367-37a7a0552282'],
    sources: [{ label: 'City of Surrey News', url: 'https://www.surrey.ca' }]
  },

  // Ken Sim (3)
  {
    slug: 'mayor-ken-sim-announces-waterfront-revitalization-pedestrian-corridors-2026',
    headline: 'Mayor Ken Sim Announces Downtown Waterfront Revitalization & Pedestrian Corridors',
    summary: 'City of Vancouver details pedestrianization pilots and public plaza activations along the Coal Harbour shoreline.',
    category: 'Local',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-13T17:30:00Z',
    published_at: '2026-08-13T17:30:00Z',
    impactArea: 'local',
    latitude: 49.2827,
    longitude: -123.1207,
    body: `VANCOUVER, B.C. — Mayor Ken Sim and Vancouver City Council unveiled plans to revitalize the downtown waterfront corridor, creating expanded public plazas and year-round outdoor commercial spaces.\n\n## Boosting Downtown Vibrancy\n\nThe initiative will transform underutilized waterfront walkways into lively cultural corridors featuring local food vendors, public art installations, and enhanced lighting.\n\n"Vancouver\'s waterfront is our greatest civic asset," Mayor Sim stated. "This project makes our downtown core more vibrant, welcoming, and accessible for residents and visitors alike."\n\n## Business Community Support\n\nDowntown Vancouver BIA praised the plan as a vital catalyst for retail foot traffic and tourism.`,
    seoTitle: 'Mayor Ken Sim Unveils Vancouver Waterfront Revitalization Plan',
    metaDescription: 'Vancouver Mayor Ken Sim announces downtown pedestrian plazas and waterfront improvements.',
    tags: ['Ken Sim', 'Vancouver', 'Downtown', 'Urban Planning', 'Tourism'],
    taggedPoliticianIds: ['1b2ab111-3712-4d1c-9899-fbc5dba0cb3a'],
    sources: [{ label: 'City of Vancouver', url: 'https://vancouver.ca' }]
  },
  {
    slug: 'vancouver-broadway-subway-commercial-rezoning-framework-2026',
    headline: 'Vancouver Authorizes High-Density Commercial Rezoning Near Broadway Subway Hubs',
    summary: 'City Council approves flexible commercial zoning to spur healthcare, biotech, and office developments along Broadway.',
    category: 'Economy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-11T15:00:00Z',
    published_at: '2026-08-11T15:00:00Z',
    impactArea: 'local',
    latitude: 49.2635,
    longitude: -123.1386,
    body: `VANCOUVER, B.C. — Vancouver City Council passed updated Broadway Plan zoning regulations today, allowing increased commercial density for life sciences, clinical research, and tech startups adjacent to upcoming subway stations.\n\n## Strengthening Innovation Districts\n\nMayor Ken Sim emphasized that the Broadway corridor is poised to become Canada\'s premier biomedical and innovation hub.\n\n"By modernizing our zoning, we are attracting global life sciences investment and creating high-wage jobs in Vancouver," Sim said at City Hall.\n\n## Development Milestones\n\nNew zoning provisions take effect immediately for eligible commercial and mixed-use applications.`,
    seoTitle: 'Vancouver Approves Commercial Rezoning for Broadway Subway Hubs',
    metaDescription: 'Mayor Ken Sim leads Vancouver in approving high-density commercial zoning along Broadway.',
    tags: ['Ken Sim', 'Vancouver', 'Broadway Subway', 'Biotech', 'Economy'],
    taggedPoliticianIds: ['1b2ab111-3712-4d1c-9899-fbc5dba0cb3a'],
    sources: [{ label: 'Vancouver Sun', url: 'https://vancouversun.com' }]
  },
  {
    slug: 'vancouver-public-safety-mental-health-response-expansion-2026',
    headline: 'Mayor Ken Sim Expands Specialized Mental Health Crisis Response Car 87 Units',
    summary: 'Vancouver Police Department and Vancouver Coastal Health add dedicated psychiatric nurse and officer mobile response teams.',
    category: 'Public Safety',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-08T18:00:00Z',
    published_at: '2026-08-08T18:00:00Z',
    impactArea: 'local',
    latitude: 49.2827,
    longitude: -123.1207,
    body: `VANCOUVER, B.C. — Mayor Ken Sim announced the full operational expansion of paired mental health crisis units across Vancouver, deploying additional Car 87/88 vehicles to support individuals experiencing acute psychiatric crises.\n\n## Compassionate, Effective Intervention\n\nThe program pairs certified mental health nurses directly with trained police officers, de-escalating complex situations and connecting vulnerable individuals to supportive clinical care.\n\n"Providing compassionate, specialized care on the front lines is critical for community safety and human dignity," Mayor Sim stated.\n\n## Clinical Outcomes\n\nHealth authorities reported a 35% reduction in emergency room hospitalizations since initial program rollout.`,
    seoTitle: 'Mayor Ken Sim Expands Mental Health Crisis Units in Vancouver',
    metaDescription: 'Vancouver expands Car 87 paired police and mental health nurse units across the city.',
    tags: ['Ken Sim', 'Public Safety', 'Healthcare', 'Vancouver', 'VPD'],
    taggedPoliticianIds: ['1b2ab111-3712-4d1c-9899-fbc5dba0cb3a'],
    sources: [{ label: 'CBC News', url: 'https://www.cbc.ca/news' }]
  },

  // Olivia Chow (3)
  {
    slug: 'mayor-olivia-chow-toronto-transit-priority-streetcar-corridors-2026',
    headline: 'Mayor Olivia Chow Advances Toronto 2026 Transit Priority & Streetcar Dedicated Corridors',
    summary: 'Toronto launches dedicated streetcar right-of-way protections along King and Queen Street to cut transit travel times.',
    category: 'Infrastructure',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-14T14:30:00Z',
    published_at: '2026-08-14T14:30:00Z',
    impactArea: 'local',
    latitude: 43.6532,
    longitude: -79.3832,
    body: `TORONTO, Ont. — Mayor Olivia Chow and the Toronto Transit Commission (TTC) announced reinforced transit priority corridors designed to keep streetcars and buses moving efficiently through downtown.\n\n## Prioritizing Commuters\n\nThe plan introduces enhanced traffic signal priority technology, camera enforcement on restricted streetcar tracks, and adjusted curbside delivery hours.\n\n"Over one hundred thousand people rely on our downtown streetcar network every single day," Mayor Chow said at City Hall. "These measures guarantee riders get to work and school reliably without getting stuck behind avoidable traffic congestion."\n\n## Community Engagement\n\nCity staff will monitor travel time improvements and work with local merchants to ensure smooth delivery access.`,
    seoTitle: 'Mayor Olivia Chow Unveils Toronto Streetcar Priority Plan',
    metaDescription: 'Toronto Mayor Olivia Chow launches streetcar priority protections across downtown corridors.',
    tags: ['Olivia Chow', 'Toronto', 'TTC', 'Transit', 'Infrastructure'],
    taggedPoliticianIds: ['a6a62842-c720-4da1-aa66-2a347763d918'],
    sources: [{ label: 'Toronto Star', url: 'https://www.thestar.com' }]
  },
  {
    slug: 'toronto-affordable-housing-redevelopment-city-land-package-2026',
    headline: 'Toronto Approves Emergency Affordable Housing Redevelopment Package on City Land',
    summary: 'Mayor Olivia Chow and City Council allocate surplus municipal properties for non-profit and co-op housing developments.',
    category: 'Policy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-12T17:00:00Z',
    published_at: '2026-08-12T17:00:00Z',
    impactArea: 'local',
    latitude: 43.6532,
    longitude: -79.3832,
    body: `TORONTO, Ont. — Toronto City Council has authorized the transfer of eight city-owned parking lots and surplus properties to non-profit housing providers, expediting construction of more than 2,400 affordable rental units.\n\n## Building Homes on Public Land\n\nMayor Olivia Chow highlighted that utilizing public land eliminates expensive acquisition costs, allowing housing providers to offer permanently affordable rents.\n\n"We are putting public land to work for the public good," Mayor Chow stated. "Every resident deserves a safe, affordable place to call home in our city."\n\n## Fast-Track Approvals\n\nPlanning applications for the designated sites will receive expedited municipal review within six months.`,
    seoTitle: 'Toronto Unlocks Surplus City Land for 2,400 Affordable Homes',
    metaDescription: 'Mayor Olivia Chow and Council approve transfer of city land for non-profit housing.',
    tags: ['Olivia Chow', 'Toronto', 'Housing', 'Affordability', 'City Council'],
    taggedPoliticianIds: ['a6a62842-c720-4da1-aa66-2a347763d918'],
    sources: [{ label: 'CBC News Toronto', url: 'https://www.cbc.ca/news' }]
  },
  {
    slug: 'toronto-launches-youth-employment-community-arts-hubs-2026',
    headline: 'Mayor Olivia Chow Launches $12M Toronto Youth Employment & Creative Arts Initiative',
    summary: 'City of Toronto partners with community centres to offer paid apprenticeships in digital media and skilled trades.',
    category: 'Education',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-09T16:00:00Z',
    published_at: '2026-08-09T16:00:00Z',
    impactArea: 'local',
    latitude: 43.6532,
    longitude: -79.3832,
    body: `TORONTO, Ont. — Mayor Olivia Chow unveiled a $12 million civic investment targeting youth training, career apprenticeships, and community arts programs across Scarborough, North York, and Etobicoke.\n\n## Empowering Young Workers\n\nThe initiative will connect over 3,000 young Torontonians with paid internships in green technology, municipal infrastructure, and creative industries.\n\n"When we invest in our young people, we build a stronger, more resilient city for generations to come," Mayor Chow said during the launch event in Scarborough.\n\n## Community Partnerships\n\nLocal non-profits and trade unions will co-lead training workshops starting this September.`,
    seoTitle: 'Mayor Olivia Chow Launches $12M Toronto Youth Career Initiative',
    metaDescription: 'City of Toronto announces paid apprenticeships and training hubs for local youth.',
    tags: ['Olivia Chow', 'Toronto', 'Youth', 'Education', 'Employment'],
    taggedPoliticianIds: ['a6a62842-c720-4da1-aa66-2a347763d918'],
    sources: [{ label: 'City of Toronto', url: 'https://www.toronto.ca' }]
  },

  // Mark Sutcliffe (2)
  {
    slug: 'mayor-mark-sutcliffe-ottawa-lrt-provincial-partnership-2026',
    headline: 'Mayor Mark Sutcliffe Secures Federal-Provincial Transit Partnership for Ottawa LRT Line',
    summary: 'Ottawa locks in joint capital maintenance framework to ensure long-term reliability on the O-Train network.',
    category: 'Infrastructure',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-13T15:00:00Z',
    published_at: '2026-08-13T15:00:00Z',
    impactArea: 'local',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, Ont. — Mayor Mark Sutcliffe confirmed a tripartite funding agreement between the City of Ottawa, the Government of Ontario, and the federal government to stabilize and upgrade O-Train system infrastructure.\n\n## Ensuring Systemic Reliability\n\nThe agreement secures capital resources for track bearing upgrades, winter weather resilience measures, and extended warranty protections.\n\n"Our transit riders deserve an O-Train system that operates smoothly in every season," Mayor Sutcliffe said at Ottawa City Hall. "This agreement provides the financial foundation to guarantee long-term service excellence."\n\n## Intergovernmental Collaboration\n\nPremier Doug Ford commended the partnership as a model for regional municipal infrastructure support.`,
    seoTitle: 'Mayor Mark Sutcliffe Secures Ottawa LRT Partnership',
    metaDescription: 'Ottawa Mayor Mark Sutcliffe announces multi-government funding agreement for O-Train LRT.',
    tags: ['Mark Sutcliffe', 'Doug Ford', 'Ottawa', 'LRT', 'Transit'],
    taggedPoliticianIds: ['ce3f1be7-3779-468a-80d1-4eff7c6014eb', '26ddb710-1861-4652-b8ed-dcbcc1dd7300'],
    sources: [{ label: 'Ottawa Citizen', url: 'https://ottawacitizen.com' }]
  },
  {
    slug: 'ottawa-downtown-commercial-residential-conversion-strategy-2026',
    headline: 'Mayor Mark Sutcliffe Launches Downtown Ottawa Office-to-Residential Conversion Hub',
    summary: 'City Council approves financial incentives to transform obsolete commercial towers into 1,800 rental apartments.',
    category: 'Economy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-10T16:30:00Z',
    published_at: '2026-08-10T16:30:00Z',
    impactArea: 'local',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, Ont. — Mayor Mark Sutcliffe announced the launch of the Downtown Ottawa Revitalization Grant, encouraging property owners to convert vacant commercial office buildings into residential apartments and cultural spaces.\n\n## Reimagining Ottawa\'s Core\n\nThe initiative aims to diversify the downtown economy, bringing thousands of new permanent residents to support local restaurants and businesses.\n\n"We are taking decisive action to transform Ottawa\'s downtown into a vibrant, 24/7 community," Mayor Sutcliffe stated.\n\n## Incentive Structure\n\nDevelopers will receive property tax abatements and streamlined building permit approvals for eligible residential conversion projects.`,
    seoTitle: 'Mayor Mark Sutcliffe Unveils Downtown Ottawa Office Conversion Plan',
    metaDescription: 'Ottawa launches grant program to convert vacant office buildings into residential homes.',
    tags: ['Mark Sutcliffe', 'Ottawa', 'Housing', 'Downtown', 'Economy'],
    taggedPoliticianIds: ['ce3f1be7-3779-468a-80d1-4eff7c6014eb'],
    sources: [{ label: 'City of Ottawa', url: 'https://ottawa.ca' }]
  },

  // Pierre Poilievre (3)
  {
    slug: 'pierre-poilievre-resource-tax-relief-western-canada-2026',
    headline: 'Pierre Poilievre Outlines Comprehensive Resource Tax Relief Policy for Western Canada',
    summary: 'Official Opposition Leader proposes accelerated capital cost deductions for critical mineral and energy projects.',
    category: 'Economy',
    country: 'CA',
    province: 'AB',
    status: 'published',
    eventDate: '2026-08-14T17:00:00Z',
    published_at: '2026-08-14T17:00:00Z',
    impactArea: 'country',
    latitude: 51.0447,
    longitude: -114.0719,
    body: `CALGARY, Alta. — Conservative Party Leader Pierre Poilievre delivered a keynote address outlining economic proposals to eliminate regulatory hurdles and repeal industrial carbon taxes on natural resource producers.\n\n## Unlocking Canadian Energy\n\nSpeaking to energy sector workers in Calgary, Poilievre argued that expediting project approvals would restore investment confidence and create tens of thousands of high-wage jobs.\n\n"Canada possesses the natural wealth to power the world," Poilievre declared. "Our plan cuts red tape, approves major export infrastructure, and brings powerful paycheques home to Canadian families."\n\n## Regulatory Reform Proposals\n\nThe policy package proposes strict 12-month federal environmental review limits for critical minerals and clean energy facilities.`,
    seoTitle: 'Pierre Poilievre Outlines Resource Economy Tax Policy in Calgary',
    metaDescription: 'Conservative Leader Pierre Poilievre proposes resource tax cuts and accelerated approvals.',
    tags: ['Pierre Poilievre', 'Conservatives', 'Energy', 'Economy', 'Calgary'],
    taggedPoliticianIds: ['a0d8ee32-8927-48bc-9a98-fee27dd02d51'],
    sources: [{ label: 'National Post', url: 'https://nationalpost.com' }]
  },
  {
    slug: 'pierre-poilievre-addresses-canadian-chamber-federal-deficit-strategy-2026',
    headline: 'Pierre Poilievre Addresses Canadian Chamber of Commerce on Federal Deficit Strategy',
    summary: 'Opposition Leader calls for dollar-for-dollar spending caps to curb inflation and stabilize interest rates.',
    category: 'Policy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-11T18:30:00Z',
    published_at: '2026-08-11T18:30:00Z',
    impactArea: 'country',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, Ont. — Pierre Poilievre presented his economic platform to the Canadian Chamber of Commerce, advocating for a federal "Pay-As-You-Go" legislative rule requiring any new government expenditure to be matched by equal spending reductions.\n\n## Fiscal Discipline Platform\n\nPoilievre argued that disciplined federal budgeting is essential to lowering inflation and reducing the cost of living for working households.\n\n"Government spending must be brought back to reality," Poilievre said. "By capping bureaucracy and eliminating waste, we protect taxpayers and restore economic growth across Canada."\n\n## Parliamentary Debate\n\nThe proposal is slated for formal committee introduction when the House of Commons reconvenes.`,
    seoTitle: 'Pierre Poilievre Proposes Federal Spending Cap at Chamber of Commerce',
    metaDescription: 'Pierre Poilievre advocates dollar-for-dollar spending rule to control federal deficit.',
    tags: ['Pierre Poilievre', 'Economy', 'Federal Politics', 'Inflation', 'Ottawa'],
    taggedPoliticianIds: ['a0d8ee32-8927-48bc-9a98-fee27dd02d51'],
    sources: [{ label: 'The Globe and Mail', url: 'https://www.theglobeandmail.com' }]
  },
  {
    slug: 'pierre-poilievre-housing-incentive-framework-municipalities-2026',
    headline: 'Pierre Poilievre Proposes Federal Infrastructure Bonuses for High-Building Municipalities',
    summary: 'Conservative plan would tie federal transit grants to 15% annual housing completion targets.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-08T19:00:00Z',
    published_at: '2026-08-08T19:00:00Z',
    impactArea: 'country',
    latitude: 49.2827,
    longitude: -123.1207,
    body: `VANCOUVER, B.C. — Pierre Poilievre detailed the Conservative Party's housing strategy during a roundtable in Vancouver, emphasizing conditional federal infrastructure transfers.\n\n## Tying Grants to Results\n\nUnder the proposed framework, cities that surpass 15% annual homebuilding milestones would receive substantial infrastructure bonuses, while non-compliant jurisdictions would see federal transfers withheld.\n\n"We need to remove bureaucratic gatekeepers and build homes people can afford," Poilievre emphasized.\n\n## Developer and Municipal Feedback\n\nMunicipal associations urged flexibility regarding local infrastructure constraints and utility connection timelines.`,
    seoTitle: 'Pierre Poilievre Ties Municipal Federal Grants to Housing Targets',
    metaDescription: 'Pierre Poilievre outlines plan to reward cities that exceed annual home construction targets.',
    tags: ['Pierre Poilievre', 'Housing', 'Infrastructure', 'Federal Politics', 'Vancouver'],
    taggedPoliticianIds: ['a0d8ee32-8927-48bc-9a98-fee27dd02d51'],
    sources: [{ label: 'The Canadian Press', url: 'https://www.thecanadianpressnews.ca' }]
  },

  // Danielle Smith (3)
  {
    slug: 'danielle-smith-alberta-hydrogen-export-corridor-strategy-2026',
    headline: 'Premier Danielle Smith Announces Alberta Hydrogen Export Corridors Strategy',
    summary: 'Alberta commits $180M to develop clean hydrogen pipeline connections and heavy transport refueling stations.',
    category: 'Environment',
    country: 'CA',
    province: 'AB',
    status: 'published',
    eventDate: '2026-08-13T18:00:00Z',
    published_at: '2026-08-13T18:00:00Z',
    impactArea: 'state',
    latitude: 53.5461,
    longitude: -113.4938,
    body: `EDMONTON, Alta. — Premier Danielle Smith unveiled Alberta's comprehensive Hydrogen Strategy at the Legislature, designating the Edmonton region as a premier global hub for low-carbon hydrogen production and commercial export.\n\n## Positioning Alberta Globally\n\nThe provincial strategy will finance pipeline infrastructure and heavy freight commercial vehicle retrofits along the Queen Elizabeth II Highway corridor.\n\n"Alberta is leading the evolution of global energy systems," Premier Smith said. "Our abundant natural gas reserves and world-class carbon capture capacity position Alberta to supply clean energy to international markets."\n\n## Industry Commitments\n\nMajor international energy firms confirmed matching investments in hydrogen ammonia export facilities.`,
    seoTitle: 'Danielle Smith Announces Alberta Clean Hydrogen Export Strategy',
    metaDescription: 'Premier Danielle Smith commits $180M to expand hydrogen energy production in Alberta.',
    tags: ['Danielle Smith', 'Alberta', 'Energy', 'Hydrogen', 'Edmonton'],
    taggedPoliticianIds: ['77d86f33-0e15-46c3-8d2d-dd882a679be7'],
    sources: [{ label: 'Alberta Government News', url: 'https://www.alberta.ca' }]
  },
  {
    slug: 'danielle-smith-alberta-heritage-fund-long-term-growth-plan-2026',
    headline: 'Premier Danielle Smith Sets $250B Target for Alberta Heritage Savings Trust Fund',
    summary: 'Provincial government enacts legislation dedicating resource revenue windfalls directly to compound savings.',
    category: 'Economy',
    country: 'CA',
    province: 'AB',
    status: 'published',
    eventDate: '2026-08-10T17:00:00Z',
    published_at: '2026-08-10T17:00:00Z',
    impactArea: 'state',
    latitude: 53.5461,
    longitude: -113.4938,
    body: `EDMONTON, Alta. — Premier Danielle Smith detailed the province's long-term plan to grow the Alberta Heritage Savings Trust Fund to $250 billion by 2050, insulating provincial finances from volatile commodity price swings.\n\n## Sovereign Wealth Security\n\nThe legislation mandates that a fixed portion of annual resource revenues be reinvested to generate stable investment dividends for healthcare and education.\n\n"We are ensuring that Alberta's resource wealth benefits our children and grandchildren for generations," Premier Smith said in Edmonton.\n\n## Fiscal Projections\n\nThe fund earned an annualized return of 8.2% over the prior fiscal year according to provincial audit reports.`,
    seoTitle: 'Premier Danielle Smith Unveils Heritage Fund Growth Plan',
    metaDescription: 'Alberta sets $250B target for Heritage Trust Fund to guarantee long-term savings.',
    tags: ['Danielle Smith', 'Alberta', 'Economy', 'Heritage Fund', 'Finance'],
    taggedPoliticianIds: ['77d86f33-0e15-46c3-8d2d-dd882a679be7'],
    sources: [{ label: 'Calgary Herald', url: 'https://calgaryherald.com' }]
  },
  {
    slug: 'danielle-smith-alberta-health-services-regional-decentralization-2026',
    headline: 'Premier Danielle Smith Details Regional Healthcare Restructuring Progress',
    summary: 'Alberta establishes four dedicated provincial health agencies to oversee acute care, primary care, continuing care, and mental health.',
    category: 'Healthcare',
    country: 'CA',
    province: 'AB',
    status: 'published',
    eventDate: '2026-08-07T15:30:00Z',
    published_at: '2026-08-07T15:30:00Z',
    impactArea: 'state',
    latitude: 53.5461,
    longitude: -113.4938,
    body: `EDMONTON, Alta. — Premier Danielle Smith and Health Minister Adriana LaGrange reported on the transition of Alberta Health Services into four specialized operational sectors, emphasizing streamlined decision-making for local hospitals.\n\n## Empowering Frontline Healthcare\n\nThe restructuring is designed to reduce bureaucratic delays, improve emergency room triage times, and expand rural physician recruitment.\n\n"Our focus is ensuring Albertans can access doctors and surgeries quickly, regardless of where they live," Premier Smith stated.\n\n## Medical Association Dialogue\n\nThe Alberta Medical Association continues discussions with provincial administrators regarding clinical billing agreements and facility staffing.`,
    seoTitle: 'Danielle Smith Reports on Alberta Healthcare Agency Restructuring',
    metaDescription: 'Premier Danielle Smith updates progress on specialized regional health agencies in Alberta.',
    tags: ['Danielle Smith', 'Alberta', 'Healthcare', 'AHS', 'Edmonton'],
    taggedPoliticianIds: ['77d86f33-0e15-46c3-8d2d-dd882a679be7'],
    sources: [{ label: 'Edmonton Journal', url: 'https://edmontonjournal.com' }]
  },

  // Wab Kinew (2)
  {
    slug: 'wab-kinew-northern-manitoba-rural-healthcare-staffing-2026',
    headline: 'Premier Wab Kinew Launches Northern Manitoba Rural Healthcare Staffing Program',
    summary: 'Manitoba government provides student loan forgiveness and housing subsidies for healthcare workers serving northern communities.',
    category: 'Healthcare',
    country: 'CA',
    province: 'MB',
    status: 'published',
    eventDate: '2026-08-12T16:00:00Z',
    published_at: '2026-08-12T16:00:00Z',
    impactArea: 'state',
    latitude: 49.8951,
    longitude: -97.1384,
    body: `WINNIPEG, Man. — Premier Wab Kinew announced an ambitious healthcare recruitment initiative aimed at staffing rural health centres and nursing stations across northern Manitoba.\n\n## Retaining Frontline Professionals\n\nThe initiative offers full provincial student loan forgiveness and specialized retention incentives for registered nurses, nurse practitioners, and physicians who commit to three years of northern service.\n\n"Every Manitoban, no matter how far north they live, deserves access to quality healthcare," Premier Kinew stated at the Legislature.\n\n## Indigenous Health Leadership\n\nThe program was developed in close coordination with the Manitoba Keewatinowi Okimakanak (MKO) and regional First Nations health authorities.`,
    seoTitle: 'Premier Wab Kinew Launches Northern Manitoba Health Program',
    metaDescription: 'Wab Kinew introduces loan forgiveness and recruitment bonuses for rural Manitoba healthcare workers.',
    tags: ['Wab Kinew', 'Manitoba', 'Healthcare', 'Northern Health', 'Winnipeg'],
    taggedPoliticianIds: ['38870346-a851-434d-b894-8362aedc4966'],
    sources: [{ label: 'Winnipeg Free Press', url: 'https://www.winnipegfreepress.com' }]
  },
  {
    slug: 'manitoba-eliminates-provincial-fuel-tax-cost-relief-2026',
    headline: 'Premier Wab Kinew Extends Provincial Fuel Tax Relief to Support Family Budgets',
    summary: 'Manitoba government continues 14-cent per litre provincial gas tax holiday to lower everyday commuting costs.',
    category: 'Economy',
    country: 'CA',
    province: 'MB',
    status: 'published',
    eventDate: '2026-08-09T17:30:00Z',
    published_at: '2026-08-09T17:30:00Z',
    impactArea: 'state',
    latitude: 49.8951,
    longitude: -97.1384,
    body: `WINNIPEG, Man. — Premier Wab Kinew confirmed the extension of Manitoba's provincial fuel tax exemption, keeping gas prices lower for families, farmers, and commercial truckers.\n\n## Tangible Cost Relief\n\nProvincial data indicates the policy has saved the average Manitoba household hundreds of dollars while keeping the province's inflation rate among the lowest in Canada.\n\n"We are delivering practical cost savings directly to working people across Manitoba," Premier Kinew said.\n\n## Economic Impact\n\nFinance officials noted that retail activity and consumer confidence have benefited from the sustained tax relief measure.`,
    seoTitle: 'Premier Wab Kinew Extends Manitoba Fuel Tax Exemption',
    metaDescription: 'Manitoba extends 14-cent gas tax holiday to help families with daily affordability.',
    tags: ['Wab Kinew', 'Manitoba', 'Economy', 'Affordability', 'Winnipeg'],
    taggedPoliticianIds: ['38870346-a851-434d-b894-8362aedc4966'],
    sources: [{ label: 'CBC Manitoba', url: 'https://www.cbc.ca/news' }]
  },

  // Tim Houston (2)
  {
    slug: 'tim-houston-cape-breton-healthcare-redevelopment-2026',
    headline: 'Premier Tim Houston Authorizes Provincial Healthcare Capital Investment in Cape Breton',
    summary: 'Nova Scotia commits $85M to expand regional hospital emergency wards and modern ambulatory surgical theatres.',
    category: 'Healthcare',
    country: 'CA',
    province: 'NS',
    status: 'published',
    eventDate: '2026-08-13T14:00:00Z',
    published_at: '2026-08-13T14:00:00Z',
    impactArea: 'state',
    latitude: 44.6488,
    longitude: -63.5752,
    body: `SYDNEY, N.S. — Premier Tim Houston announced major infrastructure investments in Cape Breton healthcare facilities today, authorizing construction on modernized emergency and cardiac care suites at the Cape Breton Regional Hospital.\n\n## Transforming Care Delivery\n\nThe expansion includes cutting-edge diagnostic imaging suites and specialized surgical wings to reduce wait times across eastern Nova Scotia.\n\n"We are transforming our healthcare system with modern facilities that empower our doctors and nurses to provide world-class care," Premier Houston said.\n\n## Construction Milestones\n\nSite preparation is underway, with the first specialized surgical suites scheduled for clinical opening next spring.`,
    seoTitle: 'Premier Tim Houston Announces Cape Breton Hospital Expansion',
    metaDescription: 'Nova Scotia Premier Tim Houston allocates $85M for Cape Breton Regional Hospital upgrades.',
    tags: ['Tim Houston', 'Nova Scotia', 'Healthcare', 'Cape Breton', 'Halifax'],
    taggedPoliticianIds: ['bcb1700f-740e-4d7c-8542-e346b4fb44f0'],
    sources: [{ label: 'Nova Scotia Newsroom', url: 'https://news.novascotia.ca' }]
  },
  {
    slug: 'nova-scotia-clean-offshore-wind-regulatory-framework-2026',
    headline: 'Premier Tim Houston Establishes Nova Scotia Offshore Wind Licensing Regime',
    summary: 'Provincial executive introduces joint regulations with Ottawa to develop Atlantic Canada\'s first commercial offshore wind zones.',
    category: 'Environment',
    country: 'CA',
    province: 'NS',
    status: 'published',
    eventDate: '2026-08-10T15:30:00Z',
    published_at: '2026-08-10T15:30:00Z',
    impactArea: 'state',
    latitude: 44.6488,
    longitude: -63.5752,
    body: `HALIFAX, N.S. — Premier Tim Houston announced the completion of Nova Scotia's Seabed Leasing Regulations, paving the way for international energy developers to bid on commercial offshore wind tracts off the Scotian Shelf.\n\n## Tapping Ocean Energy\n\nThe offshore wind leases are designed to produce green hydrogen and supply renewable electricity to Atlantic Canada's regional power grid.\n\n"Nova Scotia is poised to become a world leader in clean offshore wind development," Houston said at the Port of Halifax.\n\n## Environmental Standards\n\nAll offshore lease areas are subject to rigorous marine ecology assessments and Mi\'kmaq community consultation.`,
    seoTitle: 'Tim Houston Announces Nova Scotia Offshore Wind Regulations',
    metaDescription: 'Premier Tim Houston unveils commercial licensing rules for offshore wind energy in Nova Scotia.',
    tags: ['Tim Houston', 'Nova Scotia', 'Clean Energy', 'Offshore Wind', 'Halifax'],
    taggedPoliticianIds: ['bcb1700f-740e-4d7c-8542-e346b4fb44f0'],
    sources: [{ label: 'The Chronicle Herald', url: 'https://www.thechronicleherald.ca' }]
  },

  // Scott Moe (1)
  {
    slug: 'scott-moe-saskatchewan-agricultural-water-security-initiative-2026',
    headline: 'Premier Scott Moe Unveils Saskatchewan Agricultural Water Security & Irrigation Initiative',
    summary: 'Saskatchewan expands Lake Diefenbaker irrigation canals, securing reliable water access for 85,000 farmland acres.',
    category: 'Agriculture',
    country: 'CA',
    province: 'SK',
    status: 'published',
    eventDate: '2026-08-11T16:00:00Z',
    published_at: '2026-08-11T16:00:00Z',
    impactArea: 'state',
    latitude: 50.4452,
    longitude: -104.6189,
    body: `REGINA, Sask. — Premier Scott Moe announced the commencement of Phase 2 construction for the Lake Diefenbaker Irrigation Project, representing Saskatchewan's largest agricultural water infrastructure investment in decades.\n\n## Protecting Farmland from Drought\n\nThe project modernizes primary canal conveyance channels, delivering drought-proof water security to thousands of producers across central Saskatchewan.\n\n"Irrigation expansion is a game-changer for Saskatchewan agriculture and global food security," Premier Moe stated in Regina.\n\n## Economic Multipliers\n\nProvincial modeling estimates the completed system will add billions to regional agricultural GDP and attract agri-food processing facilities.`,
    seoTitle: 'Premier Scott Moe Expands Saskatchewan Irrigation Project',
    metaDescription: 'Scott Moe announces Phase 2 construction on Lake Diefenbaker agricultural irrigation network.',
    tags: ['Scott Moe', 'Saskatchewan', 'Agriculture', 'Water Security', 'Regina'],
    taggedPoliticianIds: ['cab88c7b-2d13-4208-b676-2d4390f1d8bd'],
    sources: [{ label: 'Saskatchewan Government News', url: 'https://www.saskatchewan.ca' }]
  }
];

// ── US ARTICLES (40) ─────────────────────────────────────────────────────────
const usArticles = [
  // Gavin Newsom (3)
  {
    slug: 'gavin-newsom-signs-california-clean-grid-infrastructure-order-2026',
    headline: 'Governor Gavin Newsom Signs Executive Order on California Clean Grid Infrastructure',
    summary: 'California accelerates permitting for 10,000 MW of solar, geothermal, and long-duration battery storage systems.',
    category: 'Environment',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-14T17:00:00Z',
    published_at: '2026-08-14T17:00:00Z',
    impactArea: 'state',
    latitude: 38.5816,
    longitude: -121.4944,
    body: `SACRAMENTO, Calif. — Governor Gavin Newsom signed an executive directive today mandating expedited environmental and grid interconnection approvals for clean energy and high-capacity battery storage facilities across California.\n\n## Modernizing Grid Reliability\n\nThe order directs state regulatory agencies to streamline project timelines, ensuring new zero-carbon energy capacity comes online ahead of peak summer heat demands.\n\n"California is proving that clean energy and economic prosperity go hand in hand," Governor Newsom said in Sacramento. "We are accelerating the buildout of a reliable, 100% clean electrical grid that powers our homes and businesses."\n\n## Battery Storage Milestones\n\nCalifornia now operates more than 13,000 megawatts of battery storage, serving as a cornerstone of state grid stability during evening peak hours.`,
    seoTitle: 'Governor Gavin Newsom Signs Clean Grid Order in California',
    metaDescription: 'Gavin Newsom streamlines permitting for renewable energy and battery storage in California.',
    tags: ['Gavin Newsom', 'California', 'Energy', 'Climate', 'Sacramento'],
    taggedPoliticianIds: ['400a040b-ee2a-448e-b2e2-1faeea46b718'],
    sources: [{ label: 'Office of Governor Gavin Newsom', url: 'https://www.gov.ca.gov' }]
  },
  {
    slug: 'california-authorizes-wildfire-prevention-grid-hardening-2026',
    headline: 'California Authorizes $2.5B Regional Wildfire Prevention and Grid Hardening Program',
    summary: 'CAL FIRE and state utilities coordinate underground power line conversions and forest thinning operations across high-risk zones.',
    category: 'Public Safety',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-12T18:30:00Z',
    published_at: '2026-08-12T18:30:00Z',
    impactArea: 'state',
    latitude: 38.5816,
    longitude: -121.4944,
    body: `SACRAMENTO, Calif. — Governor Gavin Newsom announced a comprehensive $2.5 billion wildfire resilience initiative deploying artificial intelligence wildfire cameras, automated detection satellites, and thousands of specialized forestry firefighters.\n\n## Cutting-Edge Wildfire Defense\n\nState programs have undergrounded hundreds of miles of high-voltage transmission lines in mountainous areas to prevent wind-driven utility ignitions.\n\n"We are using every technological tool and frontline resource to defend California communities against the climate crisis," Newsom stated.\n\n## Community Hardening Grants\n\nHomeowners in rural zones can access direct financial rebates for ember-resistant roofing and defensive perimeter landscaping.`,
    seoTitle: 'California Announces $2.5B Wildfire Resilience Package',
    metaDescription: 'Governor Gavin Newsom deploys AI fire detection cameras and utility line hardening across California.',
    tags: ['Gavin Newsom', 'Wildfires', 'Public Safety', 'California', 'CAL FIRE'],
    taggedPoliticianIds: ['400a040b-ee2a-448e-b2e2-1faeea46b718'],
    sources: [{ label: 'CAL FIRE News', url: 'https://www.fire.ca.gov' }]
  },
  {
    slug: 'california-master-plan-for-career-education-workforce-2026',
    headline: 'Governor Gavin Newsom Launches California Master Plan for Career Education',
    summary: 'State pairs high school students with paid apprenticeships in healthcare, clean tech, and advanced computing.',
    category: 'Education',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-09T16:00:00Z',
    published_at: '2026-08-09T16:00:00Z',
    impactArea: 'state',
    latitude: 38.5816,
    longitude: -121.4944,
    body: `SACRAMENTO, Calif. — Governor Gavin Newsom unveiled California's new Master Plan for Career Education, transforming vocational pathways for high school and community college students statewide.\n\n## Hands-On Career Pathways\n\nThe program removes bureaucratic barriers between public schools and private industry, guaranteeing students access to paid work-based apprenticeships before graduation.\n\n"Every student deserves a clear, debt-free pathway to a rewarding career," Newsom said.\n\n## Regional Innovation Grants\n\nCommunity colleges across California will receive targeted funding to build advanced simulation labs for robotics and medical training.`,
    seoTitle: 'Gavin Newsom Launches Career Education Master Plan in California',
    metaDescription: 'California introduces vocational apprenticeships and debt-free career training programs.',
    tags: ['Gavin Newsom', 'California', 'Education', 'Workforce', 'Community Colleges'],
    taggedPoliticianIds: ['400a040b-ee2a-448e-b2e2-1faeea46b718'],
    sources: [{ label: 'California Department of Education', url: 'https://www.cde.ca.gov' }]
  },

  // Ron DeSantis (3)
  {
    slug: 'ron-desantis-florida-property-insurance-stabilization-reform-2026',
    headline: 'Governor Ron DeSantis Enacts Florida Property Insurance Stabilization Reform',
    summary: 'Legislative package curbing frivolous litigation attracts five new regional insurers into Florida residential market.',
    category: 'Economy',
    country: 'US',
    province: 'FL',
    status: 'published',
    eventDate: '2026-08-13T15:30:00Z',
    published_at: '2026-08-13T15:30:00Z',
    impactArea: 'state',
    latitude: 30.4383,
    longitude: -84.2807,
    body: `TALLAHASSEE, Fla. — Governor Ron DeSantis signed comprehensive insurance market stabilization legislation, detailing regulatory reforms that have reduced lawsuit abuse and led multiple national carriers to enter Florida's home insurance market.\n\n## Restoring Market Competition\n\nThe reforms strengthen the Florida Optional Reinsurance Assistance program and require expedited claim determinations following hurricane events.\n\n"We took decisive action to stabilize our property insurance market, stop fraudulent litigation, and create competitive options for Florida homeowners," Governor DeSantis stated in Tallahassee.\n\n## Policyholder Protections\n\nState insurance regulators confirmed that rate filing increases have moderated significantly compared to previous seasons.`,
    seoTitle: 'Governor Ron DeSantis Highlights Florida Insurance Market Stabilization',
    metaDescription: 'Ron DeSantis details property insurance market reforms and new carrier entries in Florida.',
    tags: ['Ron DeSantis', 'Florida', 'Insurance', 'Economy', 'Tallahassee'],
    taggedPoliticianIds: ['fc437e5a-1d25-4904-959e-88add7928b50'],
    sources: [{ label: 'Executive Office of the Governor', url: 'https://www.flgov.com' }]
  },
  {
    slug: 'florida-accelerates-everglades-restoration-coastal-water-2026',
    headline: 'Florida Accelerates Everglades Restoration and Coastal Water Quality Projects',
    summary: 'Governor Ron DeSantis dedicates $750M for reservoir completion and blue-green algae mitigation systems.',
    category: 'Environment',
    country: 'US',
    province: 'FL',
    status: 'published',
    eventDate: '2026-08-11T16:00:00Z',
    published_at: '2026-08-11T16:00:00Z',
    impactArea: 'state',
    latitude: 25.7617,
    longitude: -80.1918,
    body: `NAPLES, Fla. — Governor Ron DeSantis visited the Everglades agricultural reservoir site to review ongoing environmental restoration milestones funded by the state's record conservation budget.\n\n## Preserving Iconic Ecosystems\n\nThe multi-phase water storage and treatment reservoir will treat and redirect clean water south into Florida Bay, preventing harmful coastal estuary discharges.\n\n"Protecting the Everglades and our natural water resources is foundational to Florida's economy and our quality of life," DeSantis said.\n\n## Water Quality Monitoring\n\nThe Florida Department of Environmental Protection confirmed real-time water sensor deployments along the Caloosahatchee and St. Lucie estuaries.`,
    seoTitle: 'Governor DeSantis Details Everglades Water Restoration Milestones',
    metaDescription: 'Florida accelerates Everglades water reservoir and coastal water quality protection programs.',
    tags: ['Ron DeSantis', 'Florida', 'Everglades', 'Environment', 'Water Quality'],
    taggedPoliticianIds: ['fc437e5a-1d25-4904-959e-88add7928b50'],
    sources: [{ label: 'Florida DEP', url: 'https://floridadep.gov' }]
  },
  {
    slug: 'florida-freedom-month-sales-tax-holiday-results-2026',
    headline: 'Governor Ron DeSantis Announces Record Consumer Savings from Florida Tax Holidays',
    summary: 'Tax relief packages for outdoor recreation, back-to-school supplies, and home hardening save Floridians $1.2B.',
    category: 'Economy',
    country: 'US',
    province: 'FL',
    status: 'published',
    eventDate: '2026-08-08T17:00:00Z',
    published_at: '2026-08-08T17:00:00Z',
    impactArea: 'state',
    latitude: 30.4383,
    longitude: -84.2807,
    body: `TALLAHASSEE, Fla. — Governor Ron DeSantis highlighted the economic benefits of Florida's broad sales tax relief holidays, which eliminated state sales taxes on school items, children's clothing, and disaster preparedness supplies.\n\n## Putting Families First\n\nThe policy ensures that Florida families keep more of their hard-earned money during the critical back-to-school shopping season.\n\n"Florida continues to run a record budget surplus while providing historic tax relief to our residents," DeSantis said.\n\n## Retail Sector Impact\n\nRetail merchant associations reported a 14% increase in in-store family purchases during the promotional tax-free windows.`,
    seoTitle: 'Governor DeSantis Highlights $1.2B Florida Tax Relief Savings',
    metaDescription: 'Florida sales tax holidays deliver record savings for families and small businesses.',
    tags: ['Ron DeSantis', 'Florida', 'Taxes', 'Economy', 'Affordability'],
    taggedPoliticianIds: ['fc437e5a-1d25-4904-959e-88add7928b50'],
    sources: [{ label: 'Florida Department of Revenue', url: 'https://floridarevenue.com' }]
  },

  // Greg Abbott (3)
  {
    slug: 'greg-abbott-texas-highway-logistics-corridor-expansion-2026',
    headline: 'Governor Greg Abbott Announces $1.8B Texas Highway & Logistics Corridor Expansions',
    summary: 'Texas Department of Transportation initiates lane expansions on I-35 and I-10 commercial freight arteries.',
    category: 'Infrastructure',
    country: 'US',
    province: 'TX',
    status: 'published',
    eventDate: '2026-08-14T15:00:00Z',
    published_at: '2026-08-14T15:00:00Z',
    impactArea: 'state',
    latitude: 30.2672,
    longitude: -97.7431,
    body: `AUSTIN, Texas — Governor Greg Abbott and the Texas Transportation Commission approved a $1.8 billion infrastructure package targeting major commercial trucking corridors across Central and North Texas.\n\n## Supporting the Texas Economic Engine\n\nThe construction contracts include adding managed express lanes, improving bridge clearances, and modernizing highway interchange nodes along Interstate 35.\n\n"As the leading export state in the nation, Texas requires world-class roadways to move goods safely and efficiently," Governor Abbott stated.\n\n## Freight Modernization\n\nAdvanced digital weigh-in-motion sensors will be installed to streamline commercial vehicle safety compliance without causing tollway bottlenecks.`,
    seoTitle: 'Governor Greg Abbott Approves $1.8B Texas Highway Expansions',
    metaDescription: 'Texas approves funding for major I-35 and freight corridor highway upgrades.',
    tags: ['Greg Abbott', 'Texas', 'Infrastructure', 'Highways', 'TxDOT'],
    taggedPoliticianIds: ['82d5f358-a471-4b4d-b052-843ef9934ad3'],
    sources: [{ label: 'Office of the Texas Governor', url: 'https://gov.texas.gov' }]
  },
  {
    slug: 'texas-power-grid-operator-integrates-battery-storage-systems-2026',
    headline: 'Texas Power Grid Operator Integrates 3,000 MW of New Battery Storage Systems',
    summary: 'ERCOT enhances grid reliability with rapid-dispatch battery reserves during peak summer electricity demand.',
    category: 'Technology',
    country: 'US',
    province: 'TX',
    status: 'published',
    eventDate: '2026-08-12T16:30:00Z',
    published_at: '2026-08-12T16:30:00Z',
    impactArea: 'state',
    latitude: 30.2672,
    longitude: -97.7431,
    body: `AUSTIN, Texas — The Electric Reliability Council of Texas (ERCOT), alongside state utility commissioners, reported that more than 3,000 megawatts of newly commissioned utility-scale battery storage came online this summer.\n\n## Enhancing Energy Independence\n\nThe battery fleet provides instant frequency response and energy reserves during triple-digit heat spikes, ensuring seamless grid stability.\n\n"Texas is building a robust, all-of-the-above energy infrastructure that guarantees reliable power for our growing population and industries," Abbott remarked.\n\n## Market Incentives\n\nPrivate energy developers continue investing billions in West Texas solar and battery co-location projects under ERCOT\'s deregulated market framework.`,
    seoTitle: 'Texas Integrates 3,000 MW of Battery Storage into ERCOT Grid',
    metaDescription: 'Governor Greg Abbott highlights record battery storage capacity strengthening Texas power grid.',
    tags: ['Greg Abbott', 'Texas', 'Energy', 'ERCOT', 'Technology'],
    taggedPoliticianIds: ['82d5f358-a471-4b4d-b052-843ef9934ad3'],
    sources: [{ label: 'ERCOT Newsroom', url: 'https://www.ercot.com' }]
  },
  {
    slug: 'texas-semiconductor-innovation-fund-grants-announced-2026',
    headline: 'Governor Greg Abbott Awards $120M in Texas Semiconductor Innovation Grants',
    summary: 'State awards matching research and fabrication grants to advanced microchip manufacturing facilities in Austin and Dallas.',
    category: 'Technology',
    country: 'US',
    province: 'TX',
    status: 'published',
    eventDate: '2026-08-09T18:00:00Z',
    published_at: '2026-08-09T18:00:00Z',
    impactArea: 'state',
    latitude: 30.2672,
    longitude: -97.7431,
    body: `AUSTIN, Texas — Governor Greg Abbott announced the latest grant distributions from the Texas Semiconductor Innovation Fund, supporting cleanroom construction and wafer fabrication research at state university research parks.\n\n## Cementing America\'s Tech Capital\n\nThe funding aligns with major private semiconductor investments across the Texas Silicon Hills.\n\n"Texas is the undisputed semiconductor capital of the United States," Abbott said. "These grants ensure that the microchips powering tomorrow\'s aerospace, defense, and automotive sectors are made right here in Texas."\n\n## Academic Partnerships\n\nThe University of Texas at Austin and Texas A&M University will expand specialized cleanroom engineering degrees.`,
    seoTitle: 'Governor Greg Abbott Awards $120M in Texas Semiconductor Grants',
    metaDescription: 'Texas allocates $120M from Semiconductor Innovation Fund to expand microchip fabrication.',
    tags: ['Greg Abbott', 'Texas', 'Semiconductors', 'Technology', 'Economy'],
    taggedPoliticianIds: ['82d5f358-a471-4b4d-b052-843ef9934ad3'],
    sources: [{ label: 'Texas Economic Development', url: 'https://gov.texas.gov/business' }]
  },

  // Kathy Hochul (2)
  {
    slug: 'kathy-hochul-new-york-clean-energy-innovation-hub-albany-2026',
    headline: 'Governor Kathy Hochul Unveils New York Clean Energy Innovation Hub in Albany',
    summary: 'New York allocates $150M for state-of-the-art battery research and advanced power electronics laboratory.',
    category: 'Technology',
    country: 'US',
    province: 'NY',
    status: 'published',
    eventDate: '2026-08-13T16:00:00Z',
    published_at: '2026-08-13T16:00:00Z',
    impactArea: 'state',
    latitude: 42.6526,
    longitude: -73.7562,
    body: `ALBANY, N.Y. — Governor Kathy Hochul officially launched the New York Energy Storage Technology Hub at the Albany Nanotech Complex, cementing the Capital Region as a national hub for battery commercialization.\n\n## Accelerating the Clean Energy Transition\n\nThe research facility provides startup incubators and testing chambers for next-generation solid-state batteries and high-efficiency grid inverters.\n\n"New York is leading the nation into the clean energy future by investing in the groundbreaking technologies created by our top scientists," Governor Hochul stated.\n\n## Workforce Training\n\nSUNY institutions across upstate New York will partner with the hub to train technicians for high-demand clean manufacturing jobs.`,
    seoTitle: 'Governor Kathy Hochul Launches Clean Energy Hub in Albany',
    metaDescription: 'Kathy Hochul unveils $150M energy storage research hub at Albany Nanotech Complex.',
    tags: ['Kathy Hochul', 'New York', 'Clean Tech', 'Albany', 'SUNY'],
    taggedPoliticianIds: ['88d3dd11-992a-4167-bb5e-930ef11f702c'],
    sources: [{ label: 'Governor Kathy Hochul News', url: 'https://www.governor.ny.gov' }]
  },
  {
    slug: 'new-york-mta-transit-accessibility-upgrades-milestone-2026',
    headline: 'Governor Kathy Hochul Celebrates Accessibility Milestones Across 15 NYC Subway Stations',
    summary: 'MTA completes ADA elevator installations and tactile boarding platform upgrades ahead of schedule.',
    category: 'Infrastructure',
    country: 'US',
    province: 'NY',
    status: 'published',
    eventDate: '2026-08-10T15:00:00Z',
    published_at: '2026-08-10T15:00:00Z',
    impactArea: 'state',
    latitude: 40.7128,
    longitude: -74.0060,
    body: `NEW YORK, N.Y. — Governor Kathy Hochul joined disability advocates and MTA leadership at Queens Plaza station to mark the completion of modern elevator installations across 15 high-ridership subway hubs.\n\n## Making Transit Accessible for All\n\nThe construction package brings dozens of platforms into full ADA compliance, utilizing heavy-duty elevators equipped with real-time diagnostic monitoring.\n\n"A world-class transit system must be accessible to every single person who calls New York home," Governor Hochul stated.\n\n## Capital Acceleration\n\nThe MTA has doubled its pace of station accessibility projects through innovative design-build contracts.`,
    seoTitle: 'Governor Kathy Hochul Celebrates Subway Accessibility Milestones',
    metaDescription: 'MTA completes elevator installations at 15 subway stations across New York City.',
    tags: ['Kathy Hochul', 'MTA', 'Subway', 'New York', 'Accessibility'],
    taggedPoliticianIds: ['88d3dd11-992a-4167-bb5e-930ef11f702c'],
    sources: [{ label: 'MTA Press Releases', url: 'https://new.mta.info' }]
  },

  // Josh Shapiro (2)
  {
    slug: 'josh-shapiro-pennsylvania-advanced-manufacturing-grants-2026',
    headline: 'Governor Josh Shapiro Directs Pennsylvania Advanced Manufacturing Workforce Grants',
    summary: 'State awards $60M to robotics and aerospace suppliers in Pittsburgh and the Lehigh Valley.',
    category: 'Economy',
    country: 'US',
    province: 'PA',
    status: 'published',
    eventDate: '2026-08-14T16:00:00Z',
    published_at: '2026-08-14T16:00:00Z',
    impactArea: 'state',
    latitude: 40.2732,
    longitude: -76.8867,
    body: `PITTSBURGH, Pa. — Governor Josh Shapiro visited an advanced robotics fabrication plant in Pittsburgh to announce $60 million in state industrial development grants.\n\n## Growing Pennsylvania\'s Economic Competitiveness\n\nThe investments match private capital expansions in precision machining, medical device manufacturing, and industrial automation.\n\n"Pennsylvania has a proud manufacturing heritage, and we are making sure our commonwealth leads the world in advanced technology and robotics," Governor Shapiro stated.\n\n## Bipartisan Economic Development\n\nThe program is part of Pennsylvania\'s ten-year economic development strategy approved by state lawmakers.`,
    seoTitle: 'Governor Josh Shapiro Awards $60M in PA Manufacturing Grants',
    metaDescription: 'Josh Shapiro announces workforce and robotics manufacturing grants across Pennsylvania.',
    tags: ['Josh Shapiro', 'Pennsylvania', 'Manufacturing', 'Robotics', 'Pittsburgh'],
    taggedPoliticianIds: ['b79d61e5-8476-45f0-9eed-a7d6304f6eac'],
    sources: [{ label: 'Commonwealth of Pennsylvania', url: 'https://www.pa.gov' }]
  },
  {
    slug: 'pennsylvania-streamlines-state-licensing-permitting-turnarounds-2026',
    headline: 'Governor Josh Shapiro Slashes State Business Permit Processing Times by 50%',
    summary: 'PA SITES program expedites industrial shovel-ready certifications to attract national manufacturing facilities.',
    category: 'Policy',
    country: 'US',
    province: 'PA',
    status: 'published',
    eventDate: '2026-08-11T17:30:00Z',
    published_at: '2026-08-11T17:30:00Z',
    impactArea: 'state',
    latitude: 40.2732,
    longitude: -76.8867,
    body: `HARRISBURG, Pa. — Governor Josh Shapiro announced that Pennsylvania regulatory agencies have cut commercial permit turnaround times in half through digital application tracking and mandatory agency response deadlines.\n\n## Open for Business\n\nThe modernized licensing system guarantees applicants timely decisions, eliminating months of administrative delays for builders and entrepreneurs.\n\n"We are moving at the speed of business in Pennsylvania," Shapiro stated at the Capitol in Harrisburg.\n\n## Shovel-Ready Site Approvals\n\nMore than 25 industrial mega-sites have achieved pre-certified status for immediate logistics and factory construction.`,
    seoTitle: 'Governor Josh Shapiro Cuts Pennsylvania Business Permit Delays',
    metaDescription: 'Pennsylvania cuts commercial permit response times by 50% under Governor Shapiro.',
    tags: ['Josh Shapiro', 'Pennsylvania', 'Business', 'Economy', 'Harrisburg'],
    taggedPoliticianIds: ['b79d61e5-8476-45f0-9eed-a7d6304f6eac'],
    sources: [{ label: 'Governor Josh Shapiro News', url: 'https://www.governor.pa.gov' }]
  },

  // Gretchen Whitmer (2)
  {
    slug: 'gretchen-whitmer-signs-michigan-road-resurfacing-package-2026',
    headline: 'Governor Gretchen Whitmer Signs Bipartisan Michigan Road Resurfacing Package',
    summary: 'MDOT authorizes construction on 150 miles of state highway corridors, upgrading bridges and drainage.',
    category: 'Infrastructure',
    country: 'US',
    province: 'MI',
    status: 'published',
    eventDate: '2026-08-13T17:00:00Z',
    published_at: '2026-08-13T17:00:00Z',
    impactArea: 'state',
    latitude: 42.7325,
    longitude: -84.5555,
    body: `LANSING, Mich. — Governor Gretchen Whitmer signed bipartisan infrastructure legislation authorizing extensive resurfacing on Interstate 94, I-75, and critical regional bridge spans across Michigan.\n\n## Fixing the Roads\n\nThe funding ensures that high-impact freight and commuter corridors are rebuilt with long-lasting composite pavement and improved storm runoff channels.\n\n"We are continuing our historic work to fix Michigan\'s roads and bridges, keeping drivers safe and supporting good-paying union jobs," Governor Whitmer said.\n\n## Real-Time Travel Alerts\n\nMDOT will deploy smart dynamic work zone signs to minimize driver delays during active paving operations.`,
    seoTitle: 'Governor Gretchen Whitmer Signs Michigan Highway Funding Bill',
    metaDescription: 'Gretchen Whitmer authorizes major road resurfacing and bridge modernizations across Michigan.',
    tags: ['Gretchen Whitmer', 'Michigan', 'Infrastructure', 'Roads', 'MDOT'],
    taggedPoliticianIds: ['f7575c12-2971-4504-b654-bffde2bbf8d5'],
    sources: [{ label: 'State of Michigan', url: 'https://www.michigan.gov' }]
  },
  {
    slug: 'michigan-clean-energy-battery-manufacturing-accelerator-2026',
    headline: 'Governor Gretchen Whitmer Launches Michigan Clean Tech Supplier Accelerator',
    summary: 'State awards matching funds to small manufacturing shops retooling for electric vehicle components and clean energy equipment.',
    category: 'Economy',
    country: 'US',
    province: 'MI',
    status: 'published',
    eventDate: '2026-08-10T16:00:00Z',
    published_at: '2026-08-10T16:00:00Z',
    impactArea: 'state',
    latitude: 42.7325,
    longitude: -84.5555,
    body: `DETROIT, Mich. — Governor Gretchen Whitmer announced the Clean Energy Supply Chain Program in Detroit, assisting tier-two and tier-three automotive suppliers in transitioning to battery and electric powertrain manufacturing.\n\n## Securing the Future of Auto Manufacturing\n\nThe state matching fund helps machine shops purchase specialized robotic tooling and retrain assembly line workers.\n\n"Michigan put the world on wheels, and we are leading the future of mobility and clean manufacturing," Whitmer emphasized.\n\n## Local Community Impact\n\nMore than 40 independent machine shops in Wayne, Oakland, and Macomb counties have enrolled in the technical assistance program.`,
    seoTitle: 'Governor Whitmer Announces Michigan Clean Auto Supply Grants',
    metaDescription: 'Michigan launches accelerator program to help automotive suppliers transition to clean mobility.',
    tags: ['Gretchen Whitmer', 'Michigan', 'Auto Industry', 'EV', 'Detroit'],
    taggedPoliticianIds: ['f7575c12-2971-4504-b654-bffde2bbf8d5'],
    sources: [{ label: 'MEDC Press Releases', url: 'https://www.michiganbusiness.org' }]
  },

  // JB Pritzker (2)
  {
    slug: 'jb-pritzker-illinois-quantum-computing-biotech-campus-2026',
    headline: 'Governor JB Pritzker Expands Illinois Quantum Computing and Biotech Research Campus',
    summary: 'State invests $200M to construct cryogenic quantum research labs at the Illinois Quantum and Microelectronics Park.',
    category: 'Technology',
    country: 'US',
    province: 'IL',
    status: 'published',
    eventDate: '2026-08-14T18:00:00Z',
    published_at: '2026-08-14T18:00:00Z',
    impactArea: 'state',
    latitude: 39.7817,
    longitude: -89.6501,
    body: `CHICAGO, Ill. — Governor JB Pritzker celebrated the groundbreaking of Phase 2 at the Illinois Quantum and Microelectronics Park on Chicago\'s South Side, joined by leading researchers from the University of Chicago and Northwestern University.\n\n## Establishing Global Quantum Leadership\n\nThe campus will house high-performance cryogenic facilities and shared testing labs for quantum computing hardware startups and defense technology innovators.\n\n"Illinois is rapidly becoming the quantum capital of the world," Governor Pritzker declared in Chicago. "We are creating thousands of high-tech jobs and anchoring breakthrough scientific discoveries right here in Illinois."\n\n## Corporate Anchors\n\nGlobal technology leaders have committed over $500 million in private research co-investments on the site.`,
    seoTitle: 'Governor JB Pritzker Expands Chicago Quantum Computing Campus',
    metaDescription: 'Illinois invests $200M to expand Quantum and Microelectronics Park in Chicago.',
    tags: ['JB Pritzker', 'Illinois', 'Quantum Computing', 'Technology', 'Chicago'],
    taggedPoliticianIds: ['8f5b5344-ef1b-46cb-99bc-5ce45a84bfe9'],
    sources: [{ label: 'Illinois Government News', url: 'https://www.illinois.gov' }]
  },
  {
    slug: 'illinois-universal-preschool-early-childhood-expansion-2026',
    headline: 'Governor JB Pritzker Marks Expansion of Smart Start Early Childhood Education',
    summary: 'Illinois adds 7,000 full-day pre-K slots in underserved school districts statewide.',
    category: 'Education',
    country: 'US',
    province: 'IL',
    status: 'published',
    eventDate: '2026-08-09T15:00:00Z',
    published_at: '2026-08-09T15:00:00Z',
    impactArea: 'state',
    latitude: 39.7817,
    longitude: -89.6501,
    body: `SPRINGFIELD, Ill. — Governor JB Pritzker reported that Illinois\' "Smart Start" early childhood plan has successfully funded thousands of new preschool classrooms ahead of the upcoming school year.\n\n## Investing in Children Early\n\nThe initiative raises wages for childcare educators and eliminates waitlists for low-income working parents.\n\n"Investing in quality early childhood education is the smartest long-term investment a state can make," Pritzker stated.\n\n## School District Allocation\n\nFunds have been disbursed to over 120 public school districts and community non-profit childcare partners across Illinois.`,
    seoTitle: 'Governor JB Pritzker Expands Pre-K Education in Illinois',
    metaDescription: 'Illinois adds 7,000 pre-K seats through Smart Start early childhood initiative.',
    tags: ['JB Pritzker', 'Illinois', 'Education', 'Early Childhood', 'Springfield'],
    taggedPoliticianIds: ['8f5b5344-ef1b-46cb-99bc-5ce45a84bfe9'],
    sources: [{ label: 'Illinois State Board of Education', url: 'https://www.isbe.net' }]
  },

  // Andy Beshear (2)
  {
    slug: 'andy-beshear-rural-broadband-expansion-eastern-kentucky-2026',
    headline: 'Governor Andy Beshear Announces Rural Broadband Expansion Across Eastern Kentucky',
    summary: 'Kentucky connects 22,000 rural mountain homes to high-speed gigabit fiber internet networks.',
    category: 'Technology',
    country: 'US',
    province: 'KY',
    status: 'published',
    eventDate: '2026-08-12T17:00:00Z',
    published_at: '2026-08-12T17:00:00Z',
    impactArea: 'state',
    latitude: 38.2009,
    longitude: -84.8733,
    body: `HAZARD, Ky. — Governor Andy Beshear visited Perry County to celebrate the activation of high-speed fiber broadband across rural communities in Eastern Kentucky.\n\n## Connecting Every Kentuckian\n\nThe project utilized federal and state matching funds to run resilient underground fiber through previously unserved Appalachian mountain hollows.\n\n"High-speed internet is not a luxury — it is a necessity for healthcare, education, and economic opportunity," Governor Beshear said.\n\n## Telehealth and Remote Education\n\nLocal clinics reported that gigabit connectivity has enabled seamless remote telemedicine consultations for rural patients.`,
    seoTitle: 'Governor Andy Beshear Expands Fiber Broadband in Eastern Kentucky',
    metaDescription: 'Kentucky connects 22,000 rural homes to high-speed fiber internet.',
    tags: ['Andy Beshear', 'Kentucky', 'Broadband', 'Appalachia', 'Technology'],
    taggedPoliticianIds: ['74a95629-4e68-42c6-a7a5-41f1500bca52'],
    sources: [{ label: 'Kentucky Governor News', url: 'https://governor.ky.gov' }]
  },
  {
    slug: 'kentucky-economic-development-automotive-battery-milestone-2026',
    headline: 'Governor Andy Beshear Celebrates Automotive Battery Plant Commissioning in Glendale',
    summary: 'State-of-the-art electric battery manufacturing campus begins initial pilot cell production, employing 2,500 technicians.',
    category: 'Economy',
    country: 'US',
    province: 'KY',
    status: 'published',
    eventDate: '2026-08-08T16:30:00Z',
    published_at: '2026-08-08T16:30:00Z',
    impactArea: 'state',
    latitude: 38.2009,
    longitude: -84.8733,
    body: `GLENDALE, Ky. — Governor Andy Beshear joined local community leaders and corporate executives to mark the completion of the BlueOval SK battery park facility in Hardin County.\n\n## Transforming the Commonwealth\'s Economy\n\nThe multi-billion dollar manufacturing park represents the largest single economic investment in Kentucky\'s history.\n\n"Kentucky is the electric vehicle battery production capital of the United States," Beshear stated.\n\n## Skilled Trades Training\n\nElizabethtown Community and Technical College opened a dedicated on-site training academy to prepare local graduates for high-tech manufacturing careers.`,
    seoTitle: 'Governor Andy Beshear Opens Massive Battery Facility in Kentucky',
    metaDescription: 'Kentucky celebrates opening of multi-billion dollar battery manufacturing campus in Glendale.',
    tags: ['Andy Beshear', 'Kentucky', 'Manufacturing', 'Economy', 'Clean Tech'],
    taggedPoliticianIds: ['74a95629-4e68-42c6-a7a5-41f1500bca52'],
    sources: [{ label: 'Kentucky Cabinet for Economic Development', url: 'https://ced.ky.gov' }]
  },

  // Wes Moore (2)
  {
    slug: 'wes-moore-maryland-green-economy-apprenticeship-initiative-2026',
    headline: 'Governor Wes Moore Launches Maryland Green Economy Apprenticeship Initiative',
    summary: 'State dedicates $35M for offshore wind and solar installer job training programs in Baltimore.',
    category: 'Economy',
    country: 'US',
    province: 'MD',
    status: 'published',
    eventDate: '2026-08-14T17:30:00Z',
    published_at: '2026-08-14T17:30:00Z',
    impactArea: 'state',
    latitude: 38.9784,
    longitude: -76.4922,
    body: `BALTIMORE, Md. — Governor Wes Moore visited the Port of Baltimore to announce the Maryland Clean Energy Workforce Accelerator, linking residents from historically underrepresented neighborhoods with union apprenticeship programs.\n\n## Leaving No One Behind\n\nThe initiative provides paid stipends, tool allowances, and credentials for industrial solar, wind turbine assembly, and commercial electrical installation.\n\n"We are building a competitive, equitable economy where no one is left behind," Governor Moore said.\n\n## Union Partnerships\n\nIBEW and building trades councils will coordinate on-the-job apprenticeship placement across Maryland.`,
    seoTitle: 'Governor Wes Moore Launches Maryland Clean Energy Workforce Plan',
    metaDescription: 'Wes Moore announces green energy apprenticeship hubs and job training in Baltimore.',
    tags: ['Wes Moore', 'Maryland', 'Workforce', 'Clean Energy', 'Baltimore'],
    taggedPoliticianIds: ['bb869273-028b-4658-90dd-a3dd45d309ec'],
    sources: [{ label: 'Office of Governor Wes Moore', url: 'https://governor.maryland.gov' }]
  },
  {
    slug: 'maryland-francis-scott-key-bridge-reconstruction-milestone-2026',
    headline: 'Governor Wes Moore Highlights Rapid Progress on Francis Scott Key Bridge Rebuild',
    summary: 'Maryland Transportation Authority confirms pier foundation engineering on schedule for modernized cable-stayed crossing.',
    category: 'Infrastructure',
    country: 'US',
    province: 'MD',
    status: 'published',
    eventDate: '2026-08-10T16:00:00Z',
    published_at: '2026-08-10T16:00:00Z',
    impactArea: 'state',
    latitude: 39.2904,
    longitude: -76.6122,
    body: `BALTIMORE, Md. — Governor Wes Moore and transportation engineers provided a progress update on the new Francis Scott Key Bridge replacement project, detailing deep foundation caisson installations in Baltimore Harbor.\n\n## Rebuilding Stronger and Safer\n\nThe new bridge features state-of-the-art collision protection fenders and higher navigational clearances for ultra-large container ships.\n\n"Baltimore is resilient, and we are working with urgency to rebuild this vital artery safer and stronger than ever before," Moore stated.\n\n## Economic Momentum\n\nPort of Baltimore container throughput has reached record efficiency levels following navigational channel enhancements.`,
    seoTitle: 'Governor Wes Moore Updates Francis Scott Key Bridge Reconstruction',
    metaDescription: 'Maryland reports rapid engineering milestones on the new Francis Scott Key Bridge.',
    tags: ['Wes Moore', 'Maryland', 'Infrastructure', 'Baltimore', 'Port of Baltimore'],
    taggedPoliticianIds: ['bb869273-028b-4658-90dd-a3dd45d309ec'],
    sources: [{ label: 'MDTA Press Releases', url: 'https://mdta.maryland.gov' }]
  },

  // Karen Bass (3)
  {
    slug: 'mayor-karen-bass-expands-inside-safe-housing-initiative-los-angeles-2026',
    headline: 'Mayor Karen Bass Expands Inside Safe Housing Initiative Across Los Angeles',
    summary: 'City of Los Angeles transitions 1,200 residents from street encampments into permanent supportive housing complexes.',
    category: 'Policy',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-13T18:00:00Z',
    published_at: '2026-08-13T18:00:00Z',
    impactArea: 'local',
    latitude: 34.0522,
    longitude: -118.2437,
    body: `LOS ANGELES, Calif. — Mayor Karen Bass announced the expansion of the Inside Safe program, detailing citywide operations that have successfully resolved major encampments in Hollywood, Downtown, and South LA.\n\n## Moving Angelenos Indoors\n\nThe initiative pairs immediate motel and interim housing placements with dedicated mental health case managers and addiction support services.\n\n"We are treating homelessness as the life-and-death emergency that it is," Mayor Bass stated at City Hall. "By bringing people indoors permanently, we restore safety and dignity to our neighborhoods."\n\n## Permanent Supportive Housing\n\nThe city approved financing for five newly renovated apartment communities dedicated to veteran and senior housing.`,
    seoTitle: 'Mayor Karen Bass Expands Inside Safe Program in Los Angeles',
    metaDescription: 'Los Angeles Mayor Karen Bass reports progress moving unhoused residents into supportive housing.',
    tags: ['Karen Bass', 'Los Angeles', 'Housing', 'Homelessness', 'Inside Safe'],
    taggedPoliticianIds: ['88be5d7e-c1e3-4a73-8771-9b1109381c98'],
    sources: [{ label: 'Office of Mayor Karen Bass', url: 'https://mayor.lacity.gov' }]
  },
  {
    slug: 'los-angeles-electric-bus-rapid-transit-san-fernando-valley-2026',
    headline: 'Los Angeles Launches Electric Bus Rapid Transit Corridor for San Fernando Valley',
    summary: 'LA Metro introduces zero-emission 60-foot articulated buses with dedicated center-running lanes along North Hollywood.',
    category: 'Infrastructure',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-11T16:30:00Z',
    published_at: '2026-08-11T16:30:00Z',
    impactArea: 'local',
    latitude: 34.1870,
    longitude: -118.4490,
    body: `LOS ANGELES, Calif. — Mayor Karen Bass and LA Metro board members cut the ribbon on the new North Hollywood-to-Pasadena Bus Rapid Transit corridor, providing fast, zero-emission transit across the Valley.\n\n## Fast, Clean Transit\n\nThe line features signal prioritization, off-board payment kiosks, and protected bike paths alongside the transit right-of-way.\n\n"This line connects communities across the Valley and San Gabriel region with clean, fast, and reliable transit," Mayor Bass said.\n\n## Olympics 2028 Readiness\n\nThe project forms a vital piece of Los Angeles\' transit modernization ahead of the 2028 Olympic and Paralympic Games.`,
    seoTitle: 'Mayor Karen Bass Launches Zero-Emission BRT in San Fernando Valley',
    metaDescription: 'LA Metro opens new electric Bus Rapid Transit corridor connecting North Hollywood and Pasadena.',
    tags: ['Karen Bass', 'Los Angeles', 'Transit', 'LA Metro', 'Infrastructure'],
    taggedPoliticianIds: ['88be5d7e-c1e3-4a73-8771-9b1109381c98'],
    sources: [{ label: 'LA Metro News', url: 'https://www.metro.net' }]
  },
  {
    slug: 'los-angeles-clean-energy-port-decarbonization-2026',
    headline: 'Mayor Karen Bass Announces $100M Zero-Emission Cargo Equipment Grant for Port of LA',
    summary: 'Port of Los Angeles replaces diesel container cranes with electric automated machinery to cut harbor emissions.',
    category: 'Environment',
    country: 'US',
    province: 'CA',
    status: 'published',
    eventDate: '2026-08-08T17:00:00Z',
    published_at: '2026-08-08T17:00:00Z',
    impactArea: 'local',
    latitude: 33.7432,
    longitude: -118.2673,
    body: `SAN PEDRO, Calif. — Mayor Karen Bass visited the Port of Los Angeles to announce federal and municipal funding for zero-emission yard tractors and electric shore-power systems for docked ocean vessels.\n\n## Cleaning the Air in Harbor Communities\n\nThe technology eliminates diesel particulate emissions adjacent to residential neighborhoods in Wilmington and San Pedro.\n\n"We are building the greenest, most efficient commercial port in the world," Bass said.\n\n## Clean Cargo Milestones\n\nOver 200 zero-emission heavy trucks will enter daily container hauling service this year.`,
    seoTitle: 'Mayor Karen Bass Announces Port of LA Electrification Grants',
    metaDescription: 'Port of Los Angeles allocates $100M to deploy zero-emission electric cargo equipment.',
    tags: ['Karen Bass', 'Los Angeles', 'Port of LA', 'Clean Tech', 'Environment'],
    taggedPoliticianIds: ['88be5d7e-c1e3-4a73-8771-9b1109381c98'],
    sources: [{ label: 'Port of Los Angeles', url: 'https://www.portoflosangeles.org' }]
  },

  // Brandon Johnson (3)
  {
    slug: 'mayor-brandon-johnson-allocates-150m-chicago-neighborhood-small-business-2026',
    headline: 'Mayor Brandon Johnson Allocates $150M for Chicago Neighborhood Small Business Hubs',
    summary: 'City of Chicago expands commercial grants and microloans to revitalize commercial storefronts on South and West Sides.',
    category: 'Economy',
    country: 'US',
    province: 'IL',
    status: 'published',
    eventDate: '2026-08-14T15:30:00Z',
    published_at: '2026-08-14T15:30:00Z',
    impactArea: 'local',
    latitude: 41.8781,
    longitude: -87.6298,
    body: `CHICAGO, Ill. — Mayor Brandon Johnson announced a major community development funding package designed to support local entrepreneurs, grocery stores, and commercial revitalization across Chicago neighborhoods.\n\n## Equitable Neighborhood Investment\n\nThe initiative offers non-dilutive capital grants to local small businesses, helping storefront owners renovate commercial properties and hire neighborhood youth.\n\n"We are investing directly in the heart and soul of Chicago — our neighborhood business corridors," Mayor Johnson said during an address in Bronzeville.\n\n## Technical Support\n\nCity-supported business centers will provide free legal, accounting, and digital marketing consulting for grant recipients.`,
    seoTitle: 'Mayor Brandon Johnson Allocates $150M for Chicago Small Businesses',
    metaDescription: 'Chicago announces $150M in neighborhood commercial grants for South and West Side storefronts.',
    tags: ['Brandon Johnson', 'Chicago', 'Small Business', 'Economy', 'Community Development'],
    taggedPoliticianIds: ['96337ea9-ddb7-4b26-a2c4-1881f1db76dc'],
    sources: [{ label: 'City of Chicago', url: 'https://www.chicago.gov' }]
  },
  {
    slug: 'chicago-protected-bike-lane-network-expansion-2026',
    headline: 'Chicago Department of Transportation Expands Protected Bike Lane Network',
    summary: 'CDOT completes 30 miles of concrete-separated cycling corridors along major arterial avenues.',
    category: 'Infrastructure',
    country: 'US',
    province: 'IL',
    status: 'published',
    eventDate: '2026-08-11T16:00:00Z',
    published_at: '2026-08-11T16:00:00Z',
    impactArea: 'local',
    latitude: 41.8781,
    longitude: -87.6298,
    body: `CHICAGO, Ill. — Mayor Brandon Johnson and the Chicago Department of Transportation (CDOT) marked the completion of 30 newly protected miles of concrete-curb bicycle lanes, connecting neighborhoods to the Loop.\n\n## Safer Streets for All\n\nThe design features raised pedestrian crosswalks, dedicated bus boarding islands, and protected bike signals to reduce traffic collisions.\n\n"Every resident in Chicago deserves safe, accessible streets whether they walk, bike, take transit, or drive," Mayor Johnson stated.\n\n## Cycling Growth\n\nDivvy bikeshare recorded all-time high ridership figures across the expanded neighborhood network.`,
    seoTitle: 'Mayor Brandon Johnson Expands Protected Bike Lanes in Chicago',
    metaDescription: 'Chicago adds 30 miles of concrete-protected bike lanes and pedestrian safety upgrades.',
    tags: ['Brandon Johnson', 'Chicago', 'CDOT', 'Biking', 'Infrastructure'],
    taggedPoliticianIds: ['96337ea9-ddb7-4b26-a2c4-1881f1db76dc'],
    sources: [{ label: 'Chicago Department of Transportation', url: 'https://www.chicago.gov/cdot' }]
  },
  {
    slug: 'chicago-parks-district-youth-summer-programming-2026',
    headline: 'Mayor Brandon Johnson Celebrates Record Enrollment in Chicago Youth Summer Camps',
    summary: 'Chicago Park District engages 45,000 students in free athletics, swimming, and arts programs.',
    category: 'Education',
    country: 'US',
    province: 'IL',
    status: 'published',
    eventDate: '2026-08-08T18:00:00Z',
    published_at: '2026-08-08T18:00:00Z',
    impactArea: 'local',
    latitude: 41.8781,
    longitude: -87.6298,
    body: `CHICAGO, Ill. — Mayor Brandon Johnson joined youth leaders at Humboldt Park to celebrate record community enrollment in the Chicago Park District's free summer athletic leagues and creative arts camps.\n\n## Keeping Youth Safe and Inspired\n\nThe programs offer safe, enriching spaces with free daily nutritious meals and mentorship from Chicago public safety officers.\n\n"When we provide our youth with positive opportunities and safe spaces, our entire city thrives," Mayor Johnson said.\n\n## Fall Registration\n\nRegistration for after-school academic tutoring and gymnastics programs opens next week across all municipal parks.`,
    seoTitle: 'Mayor Brandon Johnson Marks Record Chicago Youth Camp Enrollment',
    metaDescription: 'Chicago Park District engages 45,000 youth in free recreational and academic summer programs.',
    tags: ['Brandon Johnson', 'Chicago', 'Youth', 'Parks', 'Community'],
    taggedPoliticianIds: ['96337ea9-ddb7-4b26-a2c4-1881f1db76dc'],
    sources: [{ label: 'Chicago Park District', url: 'https://www.chicagoparkdistrict.com' }]
  },

  // Michelle Wu (3)
  {
    slug: 'mayor-michelle-wu-boston-coastal-flood-barrier-climate-resilience-2026',
    headline: 'Mayor Michelle Wu Unveils Boston Coastal Flood Barrier and Climate Resilience Plan',
    summary: 'City of Boston allocates $80M for elevated coastal parks and storm-surge barriers along East Boston and Charlestown.',
    category: 'Environment',
    country: 'US',
    province: 'MA',
    status: 'published',
    eventDate: '2026-08-14T16:30:00Z',
    published_at: '2026-08-14T16:30:00Z',
    impactArea: 'local',
    latitude: 42.3601,
    longitude: -71.0589,
    body: `BOSTON, Mass. — Mayor Michelle Wu presented Boston's updated Coastal Resilience Action Framework, authorizing construction on raised shoreline parks, deployable floodgates, and wetland restorations along Boston Harbor.\n\n## Defending Waterfront Communities\n\nThe engineering plans protect vulnerable coastal residential areas against rising sea levels and intense nor\'easter storm surges while expanding public waterfront access.\n\n"Boston is a proud coastal city, and we are taking bold action to protect our neighborhoods from climate risks while creating green, beautiful public spaces," Mayor Wu said in East Boston.\n\n## Nature-Based Solutions\n\nThe projects integrate living shorelines and native oyster reefs to absorb wave energy naturally.`,
    seoTitle: 'Mayor Michelle Wu Unveils Boston Coastal Flood Protection Plan',
    metaDescription: 'Boston announces $80M in raised coastal parks and flood barriers along Boston Harbor.',
    tags: ['Michelle Wu', 'Boston', 'Climate Resilience', 'Environment', 'Harbor'],
    taggedPoliticianIds: ['288b7224-504c-403d-a9b8-c9cc8c0f41fd'],
    sources: [{ label: 'City of Boston News', url: 'https://www.boston.gov' }]
  },
  {
    slug: 'boston-free-community-college-tuition-life-sciences-2026',
    headline: 'Boston Announces Free Community College Tuition Expansion for Life Sciences Degrees',
    summary: 'Mayor Michelle Wu expands Tuition-Free Community College plan to cover biotech lab certification programs.',
    category: 'Education',
    country: 'US',
    province: 'MA',
    status: 'published',
    eventDate: '2026-08-11T15:00:00Z',
    published_at: '2026-08-11T15:00:00Z',
    impactArea: 'local',
    latitude: 42.3601,
    longitude: -71.0589,
    body: `BOSTON, Mass. — Mayor Michelle Wu announced that Boston's Tuition-Free Community College program will now cover specialized laboratory technician certifications and biomanufacturing associate degrees at Bunker Hill Community College and Roxbury Community College.\n\n## Connecting Residents to High-Wage Jobs\n\nThe policy ensures Boston residents can gain credentials to enter the region's booming biomedical cluster without incurring student debt.\n\n"We are opening doors so that every Boston resident can participate in the innovative industries headquartered right here in our city," Mayor Wu stated.\n\n## Corporate Hiring Pledges\n\nLeading biotechnology companies have pledged direct interview opportunities for all program graduates.`,
    seoTitle: 'Mayor Michelle Wu Expands Free Tuition for Boston Biotech Degrees',
    metaDescription: 'Boston covers community college tuition for life sciences and biotechnology degrees.',
    tags: ['Michelle Wu', 'Boston', 'Education', 'Biotech', 'Bunker Hill CC'],
    taggedPoliticianIds: ['288b7224-504c-403d-a9b8-c9cc8c0f41fd'],
    sources: [{ label: 'City of Boston', url: 'https://www.boston.gov' }]
  },
  {
    slug: 'boston-fare-free-bus-route-ridership-milestones-2026',
    headline: 'Mayor Michelle Wu Reports 35% Ridership Surge on Boston Fare-Free Bus Routes',
    summary: 'City Council votes to extend fare-free transit pilots on Routes 23, 28, and 29 through 2028.',
    category: 'Infrastructure',
    country: 'US',
    province: 'MA',
    status: 'published',
    eventDate: '2026-08-08T16:00:00Z',
    published_at: '2026-08-08T16:00:00Z',
    impactArea: 'local',
    latitude: 42.3601,
    longitude: -71.0589,
    body: `BOSTON, Mass. — Mayor Michelle Wu and the MBTA released positive operational data showing that Boston's fare-free bus routes have surpassed pre-pandemic ridership records while speeding up boarding times.\n\n## Equitable Transit for Working Families\n\nThe three routes serve high-ridership corridors through Roxbury, Dorchester, and Mattapan, saving regular daily commuters hundreds of dollars annually.\n\n"Fare-free transit makes our city more connected, equitable, and sustainable," Mayor Wu said.\n\n## Faster Commutes\n\nAll-door boarding on the fare-free routes reduced bus dwell times at stops by over 20%.`,
    seoTitle: 'Mayor Michelle Wu Extends Boston Fare-Free Bus Program',
    metaDescription: 'Boston extends fare-free bus routes following 35% ridership surge.',
    tags: ['Michelle Wu', 'Boston', 'MBTA', 'Transit', 'Affordability'],
    taggedPoliticianIds: ['288b7224-504c-403d-a9b8-c9cc8c0f41fd'],
    sources: [{ label: 'MBTA News', url: 'https://www.mbta.com' }]
  },

  // Alexandria Ocasio-Cortez (2)
  {
    slug: 'alexandria-ocasio-cortez-secures-federal-climate-grant-nyc-transit-2026',
    headline: 'Rep. Alexandria Ocasio-Cortez Secures Federal Climate Resilience Grant for NYC Transit',
    summary: 'Federal grant delivers $110M to protect subway substations and yard facilities in Queens and the Bronx from flash floods.',
    category: 'Infrastructure',
    country: 'US',
    province: 'NY',
    status: 'published',
    eventDate: '2026-08-14T17:00:00Z',
    published_at: '2026-08-14T17:00:00Z',
    impactArea: 'state',
    latitude: 40.7282,
    longitude: -73.7949,
    body: `NEW YORK, N.Y. — U.S. Representative Alexandria Ocasio-Cortez announced $110 million in federal infrastructure funding awarded to the Metropolitan Transportation Authority (MTA) to flood-proof critical electrical substations across NY-14.\n\n## Climate Resilience for Working Communities\n\nThe funding installs high-capacity stormwater pumps and elevated generator platforms along low-lying subway corridors in Corona, Jackson Heights, and the South Bronx.\n\n"Working families rely on reliable transit every single day," Rep. Ocasio-Cortez stated. "This federal investment ensures our public subway lines remain resilient against extreme climate weather events."\n\n## Community Oversight\n\nLocal civic boards will receive quarterly progress reports on substation construction and stormwater improvements.`,
    seoTitle: 'Rep. Ocasio-Cortez Secures $110M Federal Flood Grant for NYC Transit',
    metaDescription: 'Alexandria Ocasio-Cortez announces $110M in federal funding to protect NYC subway from flooding.',
    tags: ['Alexandria Ocasio-Cortez', 'New York', 'MTA', 'Transit', 'Climate'],
    taggedPoliticianIds: ['2be70036-411d-4c5b-b087-5eb9229960ae'],
    sources: [{ label: 'U.S. House of Representatives Press', url: 'https://ocasio-cortez.house.gov' }]
  },
  {
    slug: 'rep-alexandria-ocasio-cortez-champions-green-housing-modernization-2026',
    headline: 'Rep. Alexandria Ocasio-Cortez Champions Green Energy Retrofits for Public Housing',
    summary: 'Federal pilot program allocates funding for heat pumps, solar roofs, and mold remediation in NYCHA complexes.',
    category: 'Policy',
    country: 'US',
    province: 'NY',
    status: 'published',
    eventDate: '2026-08-09T18:30:00Z',
    published_at: '2026-08-09T18:30:00Z',
    impactArea: 'state',
    latitude: 40.7282,
    longitude: -73.7949,
    body: `NEW YORK, N.Y. — Representative Alexandria Ocasio-Cortez joined tenant leaders at Woodside Houses in Queens to highlight the implementation of federal green housing modernization grants.\n\n## Healthier, Efficient Homes\n\nThe program replaces outdated fuel-oil boilers with high-efficiency electric heat pumps and clean induction stoves, significantly improving indoor air quality for resident families.\n\n"Every family deserves a healthy, comfortable, and energy-efficient home," Ocasio-Cortez remarked during the community walkthrough.\n\n## Lower Utility Costs\n\nThe green building upgrades are projected to reduce building operating energy expenses by 40%.`,
    seoTitle: 'Rep. Ocasio-Cortez Champions Green Upgrades for NYCHA Housing',
    metaDescription: 'Alexandria Ocasio-Cortez details energy efficiency and heat pump upgrades in public housing.',
    tags: ['Alexandria Ocasio-Cortez', 'NYCHA', 'Housing', 'Clean Energy', 'Queens'],
    taggedPoliticianIds: ['2be70036-411d-4c5b-b087-5eb9229960ae'],
    sources: [{ label: 'U.S. House of Representatives', url: 'https://ocasio-cortez.house.gov' }]
  },

  // Hakeem Jeffries (1)
  {
    slug: 'leader-hakeem-jeffries-outlines-house-infrastructure-jobs-priorities-2026',
    headline: 'House Democratic Leader Hakeem Jeffries Outlines National Infrastructure & Jobs Agenda',
    summary: 'Leader Jeffries details federal legislative framework targeting clean drinking water pipes, broadband, and rail corridors.',
    category: 'Policy',
    country: 'US',
    province: 'NY',
    status: 'published',
    eventDate: '2026-08-13T18:00:00Z',
    published_at: '2026-08-13T18:00:00Z',
    impactArea: 'country',
    latitude: 38.8899,
    longitude: -77.0091,
    body: `WASHINGTON, D.C. — House Democratic Leader Hakeem Jeffries delivered a major policy address detailing the congressional agenda for the upcoming legislative session, emphasizing continued capital investment in high-speed rail, lead pipe replacements, and domestic manufacturing.\n\n## Building an Economy for Everyday Americans\n\nLeader Jeffries stressed that modernizing American infrastructure delivers good-paying union jobs and protects family health across urban and rural communities alike.\n\n"Our commitment is to put people over politics and ensure that every community in America has modern infrastructure, safe water, and expanding economic opportunities," Jeffries stated in Washington.\n\n## Bipartisan Engagement\n\nCongressional leadership will coordinate with state governors on rapid grant disbursements for high-priority regional transit links.`,
    seoTitle: 'Leader Hakeem Jeffries Outlines Federal Infrastructure Agenda',
    metaDescription: 'Hakeem Jeffries details federal legislative priorities for infrastructure, clean water, and jobs.',
    tags: ['Hakeem Jeffries', 'Congress', 'Infrastructure', 'Federal Politics', 'Washington'],
    taggedPoliticianIds: ['0bfc7974-d5a5-4740-bc6f-213d09b5cd90'],
    sources: [{ label: 'Democratic Leader Press Releases', url: 'https://democraticleader.house.gov' }]
  }
];

const allArticles = [...canadaArticles, ...usArticles];

async function run() {
  console.log(`\n======================================================`);
  console.log(`🚀 UPLOADING 80 ARTICLES (40 CANADA + 40 USA) WITH FULL DATA`);
  console.log(`======================================================\n`);

  // Authenticate admin
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
  const token = auth.access_token;
  console.log('✅ Admin authenticated successfully!\n');

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allArticles.length; i++) {
    const art = allArticles[i];
    console.log(`[${i + 1}/80] Processing: "${art.headline.slice(0, 60)}..."`);

    // Check if article already exists by slug
    const checkRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/news_articles?slug=eq.${encodeURIComponent(art.slug)}&select=id`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    const existing = await checkRes.json();

    let articleId = null;

    if (existing && existing.length > 0) {
      articleId = existing[0].id;
      console.log(`   ℹ️ Already exists (ID: ${articleId}), updating and syncing tags...`);
      // Update article
      await fetch(env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/news_articles?id=eq.${articleId}`, {
        method: 'PATCH',
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          headline: art.headline,
          summary: art.summary,
          category: art.category,
          country: art.country,
          province: art.province,
          status: art.status,
          published_at: art.published_at,
          event_date: art.eventDate,
          latitude: art.latitude,
          longitude: art.longitude,
          impact_area: art.impactArea,
          content: {
            body: art.body,
            tags: art.tags,
            sources: art.sources,
            seoTitle: art.seoTitle,
            metaDescription: art.metaDescription,
            breakingNews: false,
            author: { name: 'Choseno Civic News Desk', bio: 'Verified political and municipal affairs reporting' }
          }
        })
      });
    } else {
      // Insert new article
      const insertRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles', {
        method: 'POST',
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          slug: art.slug,
          headline: art.headline,
          summary: art.summary,
          category: art.category,
          country: art.country,
          province: art.province,
          status: art.status,
          published_at: art.published_at,
          event_date: art.eventDate,
          latitude: art.latitude,
          longitude: art.longitude,
          impact_area: art.impactArea,
          content: {
            body: art.body,
            tags: art.tags,
            sources: art.sources,
            seoTitle: art.seoTitle,
            metaDescription: art.metaDescription,
            breakingNews: false,
            author: { name: 'Choseno Civic News Desk', bio: 'Verified political and municipal affairs reporting' }
          }
        })
      });
      const inserted = await insertRes.json();
      if (inserted && inserted.length > 0) {
        articleId = inserted[0].id;
        console.log(`   ✅ Inserted successfully (ID: ${articleId})`);
      } else {
        console.error(`   ❌ Failed to insert:`, inserted);
        errorCount++;
        continue;
      }
    }

    // Sync tags and wall mirrors via RPC
    if (articleId && art.taggedPoliticianIds && art.taggedPoliticianIds.length > 0) {
      const syncRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/admin_sync_news_article_tags', {
        method: 'POST',
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_article_id: articleId,
          p_politician_ids: art.taggedPoliticianIds
        })
      });
      if (syncRes.ok) {
        console.log(`   🏷️  Successfully synced ${art.taggedPoliticianIds.length} politician tag(s) & mirrored to walls!`);
      } else {
        const syncErr = await syncRes.text();
        console.warn(`   ⚠️ Tag sync warning: ${syncErr}`);
      }
    }

    successCount++;
  }

  console.log(`\n======================================================`);
  console.log(`🎉 COMPLETED UPLOAD OF 80 ARTICLES`);
  console.log(`   ✅ Successfully processed: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`======================================================\n`);
}

run().catch(console.error);
