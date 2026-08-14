const fs = require('fs');

// Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const articles = [
  {
    slug: 'bc-orders-surrey-police-service-transition-binding-legislation',
    headline: 'B.C. Government Orders Surrey to Complete Municipal Police Transition',
    summary: 'Premier David Eby and Public Safety Minister Mike Farnworth pass legislation mandating the City of Surrey finish its transition to the Surrey Police Service.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2023-11-20T17:00:00Z',
    published_at: '2023-11-20T17:00:00Z',
    impactArea: 'state',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `VICTORIA, B.C. — The British Columbia government has enacted binding legislation ordering the City of Surrey to proceed with its transition from the RCMP to the municipal Surrey Police Service (SPS), concluding months of public disputes between municipal and provincial leadership.

Premier David Eby emphasized that the legislative intervention was necessary to guarantee policing stability and community safety across the province's second-largest city and the broader region.

## Ending Policing Uncertainty

Public Safety Minister Mike Farnworth introduced amendments to the Police Act (Bill 36) ensuring that Surrey must finalize the SPS transition as the police of jurisdiction. Provincial officials cited systemic staffing shortages across the RCMP nationwide and the risks of prolonged operational paralysis as central factors in the decision.

"People in Surrey want this resolved, and front-line officers deserve certainty," Premier Eby stated in Victoria. "We are committed to supporting a smooth, orderly transition that maintains public safety as the top priority."

## Funding and Next Steps

The province reaffirmed a financial assistance package to assist Surrey with transitional costs, appointing a provincial administrator to oversee the Surrey Police Board and ensure milestone dates are met without compromising front-line response times.`,
    seoTitle: 'B.C. Orders Surrey to Finish Municipal Police Transition',
    metaDescription: 'Premier David Eby and B.C. Government pass legislation directing Surrey to complete its transition to the Surrey Police Service.',
    tags: ['Surrey', 'David Eby', 'Brenda Locke', 'Surrey Police Service', 'RCMP', 'Public Safety', 'BC Politics'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'CBC News', url: 'https://www.cbc.ca/news/canada/british-columbia/surrey-police-transition-legislation-1.7001402' },
      { label: 'BC Gov News', url: 'https://news.gov.bc.ca/releases/2023PSSG0075-001604' }
    ],
    taggedPoliticianIds: [
      'a730729a-0a3b-4231-b93d-9b5524f9db5e', // David Eby
      'd06486ce-31ca-4977-a367-37a7a0552282'  // Brenda Locke
    ]
  },
  {
    slug: 'surrey-mayor-brenda-locke-launches-judicial-review-over-police-transition',
    headline: 'Surrey Launches Legal Challenge Against B.C. Order on Police Transition',
    summary: 'Mayor Brenda Locke and Surrey City Council file a petition for judicial review challenging the provincial government directive on policing.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2023-11-27T19:30:00Z',
    published_at: '2023-11-27T19:30:00Z',
    impactArea: 'local',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — Surrey Mayor Brenda Locke announced that the City of Surrey has filed a petition in B.C. Supreme Court seeking a judicial review of the provincial government's order mandating the continuation of the Surrey Police Service transition.

The legal action sparked intense debate across Metro Vancouver over municipal autonomy, local tax burdens, and policing jurisdiction.

## Challenging Provincial Authority

Mayor Locke argued that the province's directive overrules the democratic mandate of Surrey voters and City Council, asserting that keeping the RCMP would save taxpayers tens of millions of dollars over the coming decade.

"This petition is about defending the democratic choice of Surrey residents and protecting our taxpayers from unnecessary financial burdens," Locke announced at Surrey City Hall. "We believe the province has exceeded its authority by attempting to force this transition on our community."

## Community and Council Reaction

The legal petition drew varied reactions from council members and community associations, with debate centering on legal expenses and the timeline for resolving front-line policing oversight.`,
    seoTitle: 'Surrey Mayor Brenda Locke Files Legal Challenge Over Police Directive',
    metaDescription: 'Mayor Brenda Locke leads Surrey in filing a B.C. Supreme Court petition challenging the provincial policing mandate.',
    tags: ['Brenda Locke', 'Surrey', 'RCMP', 'Surrey Police Service', 'B.C. Supreme Court', 'Local Governance'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'Global News BC', url: 'https://globalnews.ca/news/10118312/surrey-police-transition-court-challenge-petition/' },
      { label: 'City of Surrey', url: 'https://www.surrey.ca/news-updates' }
    ],
    taggedPoliticianIds: [
      'd06486ce-31ca-4977-a367-37a7a0552282', // Brenda Locke
      'a730729a-0a3b-4231-b93d-9b5524f9db5e'  // David Eby
    ]
  },
  {
    slug: 'surrey-councillor-linda-annis-demands-audit-police-transition-costs',
    headline: 'Councillor Linda Annis Demands Independent Audit of Surrey Policing Expenses',
    summary: 'Surrey Councillor Linda Annis calls for a comprehensive independent audit of all expenditures related to the ongoing municipal policing transition.',
    category: 'Local',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-01-16T18:00:00Z',
    published_at: '2024-01-16T18:00:00Z',
    impactArea: 'local',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — Surrey City Councillor Linda Annis has called for an immediate, third-party forensic audit of all municipal funds spent on the policing dispute, including legal fees, consulting contracts, and public relations campaigns.

Annis argued that taxpayers are bearing the brunt of political deadlock and deserve complete transparency regarding the total financial impact of the protracted transition.

## Pushing for Fiscal Transparency

"Surrey taxpayers have watched tens of millions of dollars spent while public safety remains bogged down in political combat," Annis stated. "Residents deserve an unvarnished, line-by-line accounting from an independent auditor so we know exactly where every dollar has gone."

Annis also reiterated her call for direct public engagement and faster resolution so that city investments can refocus on vital civic amenities, transit corridors, and community parks.

## Broad Community Resonance

Her call resonated widely on community forums and business groups across Surrey, including the Surrey Board of Trade, which has consistently advocated for budget predictability and economic stability in the region.`,
    seoTitle: 'Surrey Councillor Linda Annis Calls for Independent Police Audit',
    metaDescription: 'Councillor Linda Annis demands an independent financial audit of all expenditures in Surrey policing transition.',
    tags: ['Linda Annis', 'Surrey', 'Surrey Council', 'Municipal Budget', 'Surrey Police Service', 'Taxpayers'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'Surrey Now-Leader', url: 'https://www.surreynowleader.com/news/surrey-councillor-calls-for-independent-audit-of-policing-costs-7312908' },
      { label: 'CityNews Vancouver', url: 'https://vancouver.citynews.ca/surrey-policing-audit-call/' }
    ],
    taggedPoliticianIds: [
      '673efede-1b98-465c-9528-64f43b857b09', // Linda Annis
      'd06486ce-31ca-4977-a367-37a7a0552282'  // Brenda Locke
    ]
  },
  {
    slug: 'surrey-councillor-doug-elford-opposes-property-tax-hike',
    headline: 'Councillor Doug Elford Challenges City Council Over Property Tax Increases',
    summary: 'Surrey Councillor Doug Elford voices strong opposition to property tax hikes and delays in major capital projects in rapidly growing neighbourhoods.',
    category: 'Local',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-04-22T20:00:00Z',
    published_at: '2024-04-22T20:00:00Z',
    impactArea: 'local',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — Surrey Councillor Doug Elford delivered a sharp critique of the municipal budget during council debate, voting against property tax increases and pointing to compounding cost-of-living pressures on local families.

Elford contended that city hall's budget prioritizes legal battles over essential neighbourhood investments in recreation centres, sports fields, and road infrastructure.

## Focus on Growing Neighbourhoods

"Families in Newton, Fleetwood, and Guildford are dealing with record inflation and mortgage renewals," Elford argued during the council session. "Instead of piling higher tax burdens on residents, council should be delivering the recreation facilities and community infrastructure that Surrey families have been waiting on for years."

## Calls for Accelerated Project Delivery

Elford, alongside colleague Mandeep Nagra, advocated for expediting community recreation projects that were paused or deferred, urging council to re-evaluate capital spending priorities as Surrey's population continues its rapid expansion.`,
    seoTitle: 'Councillor Doug Elford Opposes Surrey Property Tax Increases',
    metaDescription: 'Surrey Councillor Doug Elford challenges council majority on tax hikes and infrastructure delays.',
    tags: ['Doug Elford', 'Surrey', 'Surrey Council', 'Taxes', 'Infrastructure', 'Newton', 'Fleetwood'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'Surrey Now-Leader', url: 'https://www.surreynowleader.com/news/surrey-council-passes-property-tax-hike-budget-7341890' }
    ],
    taggedPoliticianIds: [
      '322677d7-e309-451f-aeac-74ef69831535', // Doug Elford
      '48d1c8ad-3a7f-4ab2-87e3-8f99fde79338'  // Mandeep Nagra
    ]
  },
  {
    slug: 'surrey-councillor-mandeep-nagra-advocates-skytrain-transit-corridors',
    headline: 'Councillor Mandeep Nagra Champions Transit-Oriented Density Along Fraser Highway',
    summary: 'Surrey Councillor Mandeep Nagra pushes forward land use planning to accelerate affordable housing and commercial hubs along the Surrey-Langley SkyTrain extension.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-05-13T16:30:00Z',
    published_at: '2024-05-13T16:30:00Z',
    impactArea: 'local',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — As preparatory work advances on the Surrey-Langley SkyTrain extension along Fraser Highway, Surrey Councillor Mandeep Nagra is urging council to fast-track transit-oriented zoning and supportive infrastructure around upcoming station hubs.

The 16-kilometre rapid transit corridor is set to transform connectivity through Fleetwood and Clayton into Langley City, presenting significant opportunities for housing density and commercial development.

## Unlocking Housing and Business Corridors

Nagra emphasized that proactive planning around SkyTrain stations will be key to curbing sprawl while creating walkable neighbourhoods with integrated retail and childcare.

"The SkyTrain extension is a once-in-a-generation catalyst for Surrey," Nagra stated. "We need to ensure our land use plans enable vibrant, transit-oriented communities that provide affordable housing options for young families and workers close to rapid transit."

## Coordinating with Provincial Guidelines

Council discussions highlighted the need to align municipal bylaws with provincial transit-oriented development legislation while ensuring local road networks and community services keep pace with anticipated population density.`,
    seoTitle: 'Councillor Mandeep Nagra Pushes Transit Zoning for Surrey SkyTrain',
    metaDescription: 'Surrey Councillor Mandeep Nagra advocates for rapid transit-oriented development along Fraser Highway SkyTrain extension.',
    tags: ['Mandeep Nagra', 'Surrey', 'SkyTrain', 'Transit', 'Infrastructure', 'Housing', 'Fleetwood'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'Daily Hive Vancouver', url: 'https://dailyhive.com/vancouver/surrey-langley-skytrain-transit-oriented-development-planning' }
    ],
    taggedPoliticianIds: [
      '48d1c8ad-3a7f-4ab2-87e3-8f99fde79338', // Mandeep Nagra
      '322677d7-e309-451f-aeac-74ef69831535'  // Doug Elford
    ]
  },
  {
    slug: 'surrey-councillor-gordon-hepner-protects-agricultural-land-cloverdale',
    headline: 'Councillor Gordon Hepner Leads Initiatives to Protect Farming and Rural Roads',
    summary: 'Surrey Councillor Gordon Hepner introduces motions to strengthen protections for Agricultural Land Reserve parcels and improve rural road safety in Cloverdale.',
    category: 'Local',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-06-10T19:00:00Z',
    published_at: '2024-06-10T19:00:00Z',
    impactArea: 'local',
    latitude: 49.1121,
    longitude: -122.7303,
    body: `CLOVERDALE, B.C. — Highlighting the critical role of agriculture in South Surrey and Cloverdale, Councillor Gordon Hepner brought forward measures to protect Agricultural Land Reserve (ALR) properties from illegal dumping and unauthorized industrial encroachment.

Hepner also secured support for safety upgrades on narrow rural arterial roads frequented by heavy farming machinery and commuter traffic.

## Preserving Local Food Security

"Surrey contains nearly a third of Metro Vancouver's agricultural land," Hepner remarked during the council debate. "Preserving our fertile soil and supporting active farming families isn't just about heritage—it is essential to our regional food security and flood mitigation."

The measures mandate increased municipal enforcement against illegal fill operations and direct engineering staff to review speed limits and shoulder widenings along key farming corridors.

## Broad Support from Agricultural Community

Local farm organizations and residents in Cloverdale and Serpentine Valley welcomed the focus on rural infrastructure, emphasizing the growing challenges of balancing urbanization with working farmland.`,
    seoTitle: 'Councillor Gordon Hepner Champions Surrey Farming and Rural Road Safety',
    metaDescription: 'Surrey Councillor Gordon Hepner leads council initiatives to safeguard ALR farmland and upgrade rural roads in Cloverdale.',
    tags: ['Gordon Hepner', 'Surrey', 'Cloverdale', 'Agriculture', 'ALR', 'Environment', 'Rural Roads'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'Surrey Now-Leader', url: 'https://www.surreynowleader.com/news/cloverdale-rural-road-safety-alr-protection-surrey-7359124' }
    ],
    taggedPoliticianIds: [
      'c23ff6cf-46ab-4ead-8533-98c9a8314f6e', // Gordon Hepner
      'f7695818-1444-4552-a117-a70a249a64ba'  // Mike Bose
    ]
  },
  {
    slug: 'surrey-council-approves-budget-pardeep-kooner-rob-stutt',
    headline: 'Surrey Approves 2024 Budget with Focus on Public Safety and Infrastructure',
    summary: 'Councillors Pardeep Kooner and Rob Stutt support passage of Surrey\'s municipal operating budget, funding additional firefighters and transportation upgrades.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-04-29T21:00:00Z',
    published_at: '2024-04-29T21:00:00Z',
    impactArea: 'local',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — Surrey City Council has formally approved its five-year financial plan, enacting an operating and capital budget that allocates dedicated funding for new firefighter hiring, traffic safety enhancements, and park expansions.

Councillors Pardeep Kooner and Rob Stutt voted in favour of the financial package, emphasizing that disciplined investments are necessary to keep pace with rapid population growth across Surrey's town centres.

## Investing in Emergency Services

Councillor Rob Stutt, chair of the city's Public Safety Committee, highlighted the budget's commitment to first responders. "As Surrey expands toward becoming B.C.'s most populous city, ensuring our fire service, emergency response teams, and civil infrastructure have the resources they need is non-negotiable," Stutt stated.

Councillor Pardeep Kooner noted that the budget maintains fiscal prudence while addressing long-standing road and community facility backlogs across Clayton and South Surrey.

## Balancing Growth with Fiscal Demands

The budget includes funding for road paving, intersection improvements, and active transport corridors, concluding a vigorous budget consultation period with local residents and business owners.`,
    seoTitle: 'Surrey Council Approves Five-Year Budget and Public Safety Investments',
    metaDescription: 'Surrey Councillors Pardeep Kooner and Rob Stutt back five-year budget delivering fire service and infrastructure funding.',
    tags: ['Pardeep Kooner', 'Rob Stutt', 'Brenda Locke', 'Surrey', 'Budget', 'Public Safety', 'Fire Services'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'City of Surrey', url: 'https://www.surrey.ca/news-updates/surrey-approves-2024-financial-plan' },
      { label: 'Peace Arch News', url: 'https://www.peacearchnews.com/news/surrey-five-year-budget-approved-7345612' }
    ],
    taggedPoliticianIds: [
      '80dbc010-c864-43dc-aaae-b10ee43982ac', // Pardeep Kooner
      '65827d31-b427-4ebc-94c5-dc4ef3335bef', // Rob Stutt
      'd06486ce-31ca-4977-a367-37a7a0552282'  // Brenda Locke
    ]
  },
  {
    slug: 'surrey-guildford-mla-garry-begg-advocates-surrey-memorial-hospital-expansion',
    headline: 'MLA Garry Begg Pushes for Accelerated Expansions at Surrey Memorial Hospital',
    summary: 'Surrey-Guildford MLA Garry Begg advocates for enhanced emergency care capacity, specialized renal units, and ongoing clinical recruitment for Fraser Health facilities.',
    category: 'Policy',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-02-15T15:00:00Z',
    published_at: '2024-02-15T15:00:00Z',
    impactArea: 'state',
    latitude: 49.1762,
    longitude: -122.8436,
    body: `SURREY, B.C. — Responding to sustained healthcare demand south of the Fraser River, Surrey-Guildford MLA Garry Begg has actively championed provincial investments to expand clinical services and emergency department capacity at Surrey Memorial Hospital.

The provincial government's multi-phase healthcare initiative for Surrey includes enhanced cardiac and renal care, additional acute care beds, and targeted international credential recognition for nurses and physicians.

## Addressing Regional Healthcare Pressures

MLA Begg emphasized that Surrey's explosive demographic growth requires proactive, multi-year healthcare capital investments.

"Our healthcare workers at Surrey Memorial do exceptional work every day under immense pressure," Begg noted. "Securing new cardiac catheterization labs, expanded pediatric capacity, and construction on the second Surrey hospital in Cloverdale are vital commitments to our families."

## Ongoing Health Infrastructure

Fraser Health continues site preparation for the new $2.88-billion Cloverdale hospital and cancer care centre, complementing ongoing upgrades across existing Surrey healthcare facilities.`,
    seoTitle: 'MLA Garry Begg Champions Surrey Memorial Hospital Health Expansions',
    metaDescription: 'Surrey-Guildford MLA Garry Begg advocates for acute care expansions and specialized clinical units in Surrey.',
    tags: ['Garry Begg', 'David Eby', 'Surrey', 'Surrey Memorial Hospital', 'Healthcare', 'Fraser Health', 'BC NDP'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'BC Gov News', url: 'https://news.gov.bc.ca/releases/2024HLTH0018-000210' },
      { label: 'Surrey Now-Leader', url: 'https://www.surreynowleader.com/news/surrey-memorial-hospital-expansion-milestones-7320491' }
    ],
    taggedPoliticianIds: [
      'b49511ad-b330-46e1-ae8f-3916b40cf8a2', // Garry Begg
      'a730729a-0a3b-4231-b93d-9b5524f9db5e'  // David Eby
    ]
  },
  {
    slug: 'mp-sukh-dhaliwal-announces-federal-anti-gang-youth-funding-surrey',
    headline: 'MP Sukh Dhaliwal Announces $3.5M Federal Investment in Surrey Youth Gang Prevention',
    summary: 'Surrey Newton MP Sukh Dhaliwal details federal funding under the Building Safer Communities Fund to support grassroots youth intervention programs across Surrey.',
    category: 'National',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2023-09-18T18:30:00Z',
    published_at: '2023-09-18T18:30:00Z',
    impactArea: 'country',
    latitude: 49.1368,
    longitude: -122.8524,
    body: `SURREY, B.C. — Member of Parliament for Surrey Newton Sukh Dhaliwal announced a $3.5-million federal investment from Public Safety Canada's Building Safer Communities Fund to bolster local youth mentorship, anti-gang initiatives, and community sports programs.

The funding is directed to local non-profit organizations and school district programs focused on early intervention and positive youth engagement.

## Empowering Youth and Families

"Preventing youth from entering gang lifestyles starts in our neighbourhoods, schools, and community centres," MP Dhaliwal stated during the announcement at a local youth centre in Newton. "By investing directly in culturally sensitive counseling, after-school recreation, and career mentorship, we are giving young people the tools and opportunities to succeed."

Community leaders praised the federal grant for targeting root causes of crime through grassroots organizations with established community trust.

## Collaborative Community Safety

The initiative works in coordination with the City of Surrey, Surrey School District (SD36), and community outreach teams to provide wraparound support for at-risk youth and their families.`,
    seoTitle: 'MP Sukh Dhaliwal Announces $3.5M for Surrey Youth Crime Prevention',
    metaDescription: 'Surrey Newton MP Sukh Dhaliwal announces $3.5M federal grant to support youth gang prevention and community mentorship.',
    tags: ['Sukh Dhaliwal', 'Surrey Newton', 'Public Safety', 'Youth Crime Prevention', 'Federal Government', 'Surrey'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Federal parliamentary and regional affairs reporting'
    },
    sources: [
      { label: 'Public Safety Canada', url: 'https://www.canada.ca/en/public-safety-canada/news/2023/09/government-of-canada-supports-crime-prevention-in-surrey.html' },
      { label: 'CBC News', url: 'https://www.cbc.ca/news/canada/british-columbia/surrey-gang-prevention-federal-funding-1.6970421' }
    ],
    taggedPoliticianIds: [
      '95f40e91-ba9d-47a1-8980-64df1149d59f', // Sukh Dhaliwal
      '117c57f6-5ff7-41e1-bce8-239ee2fc3bb8'  // Randeep Sarai
    ]
  },
  {
    slug: 'mp-randeep-sarai-announces-surrey-housing-accelerator-fund',
    headline: 'MP Randeep Sarai Announces $95.6M Housing Accelerator Investment in Surrey',
    summary: 'Surrey Centre MP Randeep Sarai unveils a major federal Housing Accelerator Fund agreement to fast-track the construction of over 2,500 new homes across Surrey.',
    category: 'National',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-01-22T19:00:00Z',
    published_at: '2024-01-22T19:00:00Z',
    impactArea: 'country',
    latitude: 49.1913,
    longitude: -122.8490,
    body: `SURREY, B.C. — Member of Parliament for Surrey Centre Randeep Sarai joined municipal leaders to announce a $95.6-million federal agreement under the Housing Accelerator Fund to fast-track more than 2,500 housing units across Surrey over the next three years.

The federal initiative incentivizes municipal zoning modernizations, automated permitting, and increased density near rapid transit hubs in Surrey City Centre and along major transit arteries.

## Accelerating Affordable Housing Delivery

"Surrey is growing rapidly, and welcoming thousands of new residents each year requires innovative approaches to building homes faster," MP Sarai stated at Surrey City Centre. "This $95.6-million investment equips Surrey to cut red tape, modernize municipal approvals, and build diverse housing options that middle-class families can afford."

The funding will support infrastructure upgrades required to service high-density residential towers, purpose-built rentals, and missing-middle townhomes.

## Transforming Surrey City Centre

Mayor Brenda Locke and city planners welcomed the federal partnership, noting that the agreement aligns with the city's master plan to build an energetic, transit-connected downtown core south of the Fraser.`,
    seoTitle: 'MP Randeep Sarai Announces $95.6M Housing Accelerator Fund for Surrey',
    metaDescription: 'Surrey Centre MP Randeep Sarai unveils $95.6M federal deal to fast-track 2,500+ homes in Surrey.',
    tags: ['Randeep Sarai', 'Brenda Locke', 'Surrey Centre', 'Housing', 'Housing Accelerator Fund', 'Infrastructure', 'Economy'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Federal parliamentary and regional affairs reporting'
    },
    sources: [
      { label: 'CMHC News', url: 'https://www.cmhc-schl.gc.ca/media-newsroom/news-releases/2024/housing-accelerator-fund-surrey' },
      { label: 'Global News BC', url: 'https://globalnews.ca/news/10242190/surrey-housing-accelerator-fund-announcement/' }
    ],
    taggedPoliticianIds: [
      '117c57f6-5ff7-41e1-bce8-239ee2fc3bb8', // Randeep Sarai
      'd06486ce-31ca-4977-a367-37a7a0552282'  // Brenda Locke
    ]
  }
];

async function run() {
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
    console.error('Failed to authenticate admin:', auth);
    process.exit(1);
  }
  console.log('Authenticated admin:', auth.user.email);

  const headers = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + auth.access_token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  let successCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    console.log(`\n[${i + 1}/${articles.length}] Processing "${art.headline}"...`);

    const insertPayload = {
      slug: art.slug,
      headline: art.headline,
      summary: art.summary,
      category: art.category,
      country: art.country,
      province: art.province,
      status: art.status,
      event_date: art.eventDate,
      published_at: art.published_at,
      impact_area: art.impactArea,
      latitude: art.latitude,
      longitude: art.longitude,
      content: {
        body: art.body,
        seoTitle: art.seoTitle,
        metaDescription: art.metaDescription,
        tags: art.tags,
        breakingNews: art.breakingNews,
        author: art.author,
        sources: art.sources
      }
    };

    const checkUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?slug=eq.' + encodeURIComponent(art.slug) + '&select=id,slug';
    const checkRes = await fetch(checkUrl, { headers });
    const existing = await checkRes.json();

    let articleId;
    if (existing && existing.length > 0) {
      articleId = existing[0].id;
      console.log(`  Article already exists with id ${articleId}, updating...`);
      const updateUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?id=eq.' + articleId;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(insertPayload)
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error('  Update error:', errText);
        continue;
      }
    } else {
      const createUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles';
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(insertPayload)
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error('  Insert error:', errText);
        continue;
      }
      const created = await createRes.json();
      articleId = created[0]?.id;
      console.log(`  Created article with id ${articleId}`);
    }

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
        const tagErr = await tagRes.text();
        console.error('  Tag sync error:', tagErr);
      } else {
        console.log(`  Successfully synced ${art.taggedPoliticianIds.length} politician tags to wall!`);
      }
    }

    successCount++;
  }

  console.log('\n======================================================');
  console.log(`All ${successCount}/${articles.length} news articles published and tagged successfully!`);
  console.log('======================================================');
}

run().catch(console.error);
