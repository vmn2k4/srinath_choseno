const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const articles = [
  {
    slug: 'ontario-court-appeal-upholds-ford-government-road-authority',
    headline: 'Ontario Court of Appeal Upholds Provincial Authority in Road Infrastructure Dispute',
    summary: 'The Court of Appeal for Ontario rules in favour of the Ford government regarding provincial jurisdiction over municipal arterial road corridors.',
    category: 'Policy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-14T14:00:00Z',
    published_at: '2026-08-14T14:00:00Z',
    impactArea: 'state',
    latitude: 43.6532,
    longitude: -79.3832,
    body: `TORONTO, Ont. — The Court of Appeal for Ontario has delivered a landmark ruling confirming that the provincial government holds the constitutional authority to regulate and manage major municipal road infrastructure corridors across the Greater Toronto Area.

The decision overturns a 2025 lower court ruling and reaffirms provincial jurisdiction over critical transit and traffic management planning.

## Clarifying Municipal and Provincial Powers

Premier Doug Ford and Transportation officials welcomed the appellate court's clarification, emphasizing that major arterial routes must balance regional transit capacity, economic goods movement, and emergency vehicle response times.

"Our priority has always been to keep gridlock moving across the province's economic engine," Premier Ford stated at Queen's Park. "This ruling gives our government the legal certainty needed to ensure major commercial arteries remain efficient and accessible for workers and transit users alike."

## Transit and Municipal Response

Municipal leaders and urban planning advocates noted that the decision sets a significant legal precedent for provincial oversight of city street designs and infrastructure modifications moving forward.`,
    seoTitle: 'Ontario Court of Appeal Upholds Ford Government Road Authority',
    metaDescription: 'Court of Appeal for Ontario confirms provincial authority in major municipal road infrastructure dispute.',
    tags: ['Doug Ford', 'Ontario', 'Infrastructure', 'Queen\'s Park', 'Court of Appeal', 'Toronto'],
    breakingNews: false,
    author: {
      name: 'Choseno National News Desk',
      bio: 'Provincial and federal political affairs reporting'
    },
    sources: [
      { label: 'Canadian Press', url: 'https://www.thecanadianpressnews.ca/ontario-court-appeal-ruling-transportation/' },
      { label: 'Toronto Star', url: 'https://www.thestar.com/news/queens-park/ontario-court-appeal-ford-infrastructure-ruling/' }
    ],
    taggedPoliticianIds: [
      '26ddb710-1861-4652-b8ed-dcbcc1dd7300' // Doug Ford
    ]
  },
  {
    slug: 'doug-ford-unveils-ontario-data-centre-energy-framework',
    headline: 'Premier Doug Ford Unveils Provincial Playbook for Data Centre Energy Demands',
    summary: 'Ontario introduces a comprehensive regulatory framework to manage grid capacity, electricity pricing, and data protection for high-tech computing hubs.',
    category: 'Technology',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-13T16:30:00Z',
    published_at: '2026-08-13T16:30:00Z',
    impactArea: 'state',
    latitude: 43.6629,
    longitude: -79.3917,
    body: `TORONTO, Ont. — Premier Doug Ford announced Ontario's new "Data Centre Playbook," establishing a standardized provincial framework designed to regulate power consumption, grid reliability, and data residency protections for artificial intelligence computing facilities.

The policy initiative comes as technology companies expand large-scale data facilities across Southwestern Ontario and the GTA.

## Safeguarding Grid Reliability

Under the new guidelines, major data centre operators must coordinate power demands directly with the Independent Electricity System Operator (IESO) and invest in dedicated on-site power generation and efficiency standards during peak grid hours.

"Ontario is open for high-tech innovation and artificial intelligence investment, but we are making sure our electrical grid remains stable and affordable for regular households and small businesses," Ford stated during an announcement in Toronto. "This framework ensures commercial data centres pay their fair share of infrastructure expansion."

## Economic and Tech Outlook

Industry groups commended the government for establishing clear rules on power access while setting stringent expectations for regional energy reliability and long-term clean power procurement.`,
    seoTitle: 'Doug Ford Unveils Ontario Data Centre Energy Playbook',
    metaDescription: 'Premier Doug Ford announces Ontario framework to regulate data centre energy use and grid capacity.',
    tags: ['Doug Ford', 'Ontario', 'Technology', 'Energy', 'Artificial Intelligence', 'IESO'],
    breakingNews: false,
    author: {
      name: 'Choseno National News Desk',
      bio: 'Provincial and federal political affairs reporting'
    },
    sources: [
      { label: 'Ontario Newsroom', url: 'https://news.ontario.ca/en/release/1004921/ontario-introduces-data-centre-energy-framework' },
      { label: 'Globe and Mail', url: 'https://www.theglobeandmail.com/business/technology/ontario-data-centre-power-regulations/' }
    ],
    taggedPoliticianIds: [
      '26ddb710-1861-4652-b8ed-dcbcc1dd7300' // Doug Ford
    ]
  },
  {
    slug: 'premier-david-eby-announces-bc-cabinet-shuffle-finance-health',
    headline: 'Premier David Eby Realigns B.C. Cabinet Portfolios Across Finance and Health',
    summary: 'Premier David Eby announces senior cabinet appointments to oversee provincial finances and healthcare delivery during Finance Minister Brenda Bailey\'s medical leave.',
    category: 'Politics',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2026-08-14T18:00:00Z',
    published_at: '2026-08-14T18:00:00Z',
    impactArea: 'state',
    latitude: 48.4196,
    longitude: -123.3703,
    body: `VICTORIA, B.C. — Premier David Eby announced key ministerial realignments within the British Columbia cabinet, ensuring steady governance across the province's economic and healthcare portfolios.

The appointments follow the announcement that Finance Minister Brenda Bailey will undergo a temporary six-week medical treatment for cancer.

## Ministerial Transitions

Under the realignment, Josie Osborne assumes the duties of Minister of Finance, while Ravi Kahlon takes leadership of the Ministry of Health. Energy and Climate Solutions Minister Adrian Dix will oversee Jobs and Economic Growth portfolios on an interim basis until Minister Bailey's scheduled return in October.

"Our first thoughts are with Brenda and her family as she begins treatment with the full support of our entire caucus," Premier Eby stated at the Legislature in Victoria. "Our cabinet team is stepping up to ensure British Columbians continue to receive dependable leadership in healthcare delivery, public services, and fiscal management."

## Maintaining Government Priorities

The restructured ministerial team will continue advancing major provincial initiatives, including capital investments in regional hospitals, community housing, and economic resilience programs.`,
    seoTitle: 'Premier David Eby Announces B.C. Cabinet Realignments',
    metaDescription: 'David Eby appoints Josie Osborne to Finance and Ravi Kahlon to Health during Brenda Bailey medical leave.',
    tags: ['David Eby', 'British Columbia', 'BC NDP', 'Cabinet', 'Healthcare', 'Finance', 'Victoria'],
    breakingNews: false,
    author: {
      name: 'Choseno National News Desk',
      bio: 'Provincial and federal political affairs reporting'
    },
    sources: [
      { label: 'BC Gov News', url: 'https://news.gov.bc.ca/releases/2026PREM0045-001201' },
      { label: 'CBC News BC', url: 'https://www.cbc.ca/news/canada/british-columbia/david-eby-cabinet-shuffle-august-2026-1.7291402' }
    ],
    taggedPoliticianIds: [
      'a730729a-0a3b-4231-b93d-9b5524f9db5e' // David Eby
    ]
  },
  {
    slug: 'danielle-smith-advances-alberta-ai-data-refinery-strategy',
    headline: 'Premier Danielle Smith Positions Alberta as AI Data Hub Powered by Natural Gas',
    summary: 'Alberta Premier Danielle Smith outlines the province\'s strategy to attract global artificial intelligence computing facilities by leveraging natural gas power.',
    category: 'Economy',
    country: 'CA',
    province: 'AB',
    status: 'published',
    eventDate: '2026-08-10T19:00:00Z',
    published_at: '2026-08-10T19:00:00Z',
    impactArea: 'state',
    latitude: 53.5461,
    longitude: -113.4938,
    body: `EDMONTON, Alta. — Premier Danielle Smith has detailed Alberta's strategy to market the province as a premier North American destination for energy-intensive artificial intelligence data centres, referring to the computing facilities as the next generation of "digital refineries."

Speaking at an economic forum in Edmonton, Smith emphasized that Alberta's abundant natural gas supply and deregulated electricity market provide competitive advantages for tech firms seeking baseload power.

## Meeting High-Power Computing Demands

"Global computing and AI demand immense volumes of reliable, round-the-clock baseload power," Premier Smith said. "Alberta is uniquely positioned to deliver the energy required to fuel high-tech data hubs, creating high-paying tech jobs while utilizing our natural resource strengths responsibly."

The province is currently reviewing regulatory pathways to allow data centre operators to co-locate with private natural gas generation facilities to prevent strain on municipal power grids.

## Stakeholder Consultations

Industry groups and local municipalities across the Calgary-Edmonton corridor have engaged with provincial officials regarding water usage, cooling technology, and infrastructure tax revenue generated by incoming tech campus developments.`,
    seoTitle: 'Danielle Smith Promotes Alberta as AI Data Centre Hub',
    metaDescription: 'Premier Danielle Smith outlines Alberta strategy to power AI data centres using natural gas baseload energy.',
    tags: ['Danielle Smith', 'Alberta', 'Economy', 'Energy', 'Artificial Intelligence', 'Natural Gas', 'Edmonton'],
    breakingNews: false,
    author: {
      name: 'Choseno National News Desk',
      bio: 'Provincial and federal political affairs reporting'
    },
    sources: [
      { label: 'Calgary Herald', url: 'https://calgaryherald.com/business/energy/danielle-smith-alberta-ai-data-centres-energy' },
      { label: 'Government of Alberta', url: 'https://www.alberta.ca/news' }
    ],
    taggedPoliticianIds: [
      '77d86f33-0e15-46c3-8d2d-dd882a679be7' // Danielle Smith
    ]
  },
  {
    slug: 'pierre-poilievre-calls-firm-canadian-stance-cross-border-trade',
    headline: 'Pierre Poilievre Urges Firm Canadian Stance in Cross-Border Trade and Tariff Talks',
    summary: 'Conservative Leader Pierre Poilievre calls on the federal government to defend Canadian agriculture, manufacturing, and supply management in U.S. trade discussions.',
    category: 'National',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-08T17:30:00Z',
    published_at: '2026-08-08T17:30:00Z',
    impactArea: 'country',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, Ont. — Official Opposition Leader Pierre Poilievre has called on federal trade negotiators to adopt an uncompromising approach to cross-border trade discussions with the United States, warning against any concessions on Canadian supply management or manufacturing tariffs.

In formal correspondence and public remarks on Parliament Hill, Poilievre emphasized the necessity of standing up for domestic workers and agricultural producers.

## Defending Key Economic Sectors

"Canada must negotiate from a position of economic strength and national self-reliance," Poilievre stated in Ottawa. "We cannot afford to compromise on our dairy, poultry, or auto workers. The government must show backbone and ensure Canadian businesses and families are not penalized by protectionist foreign tariffs."

Poilievre also reiterated his caucus's calls for cutting internal trade barriers between provinces to strengthen the national economy and create domestic market resilience.

## Parliamentary Trade Debate

The remarks follow intergovernmental meetings where federal and provincial leaders discussed strategies to safeguard cross-border commerce and critical minerals partnerships across North America.`,
    seoTitle: 'Pierre Poilievre Urges Strong Stance in U.S. Trade Negotiations',
    metaDescription: 'Conservative Leader Pierre Poilievre calls on government to protect Canadian farmers and auto workers in trade talks.',
    tags: ['Pierre Poilievre', 'Conservatives', 'Trade', 'Parliament Hill', 'Economy', 'Ottawa'],
    breakingNews: false,
    author: {
      name: 'Choseno National News Desk',
      bio: 'Provincial and federal political affairs reporting'
    },
    sources: [
      { label: 'The Canadian Press', url: 'https://www.thecanadianpressnews.ca/poilievre-trade-negotiations-us-tariffs/' },
      { label: 'National Post', url: 'https://nationalpost.com/news/politics/poilievre-canada-us-trade-strategy' }
    ],
    taggedPoliticianIds: [
      'a0d8ee32-8927-48bc-9a98-fee27dd02d51' // Pierre Poilievre
    ]
  },
  {
    slug: 'premier-wab-kinew-releases-winnipeg-rail-relocation-findings',
    headline: 'Premier Wab Kinew Releases Study on Long-Term Winnipeg Rail Relocation',
    summary: 'Manitoba Premier Wab Kinew unveils feasibility findings regarding the relocation of major railway corridors to unlock urban development in Winnipeg.',
    category: 'Infrastructure',
    country: 'CA',
    province: 'MB',
    status: 'published',
    eventDate: '2026-08-12T16:00:00Z',
    published_at: '2026-08-12T16:00:00Z',
    impactArea: 'state',
    latitude: 49.8951,
    longitude: -97.1384,
    body: `WINNIPEG, Man. — Manitoba Premier Wab Kinew has released the findings of a comprehensive provincial study examining the feasibility and economic impact of relocating key freight rail lines that currently bisect the City of Winnipeg.

The study assesses potential routing options, engineering costs, and the redevelopment potential of central industrial lands.

## Unlocking Urban Land for Housing

Premier Kinew noted that while rail relocation represents a complex, multi-decade undertaking requiring joint private-sector collaboration, the study provides valuable data for long-range city planning.

"Rail lines have defined Winnipeg's geography for over a century, but as our city grows, we must look ahead at how to reconnect communities and free up land for housing and active transit," Kinew said at the Manitoba Legislative Building. "This report gives us the facts to make informed, responsible infrastructure investments with our municipal and federal partners."

## Supporting Regional Logistics

The report emphasizes that any future corridor realignments must preserve Winnipeg's role as a major national transportation and logistics gateway connecting east-west supply chains across Canada.`,
    seoTitle: 'Wab Kinew Releases Study on Winnipeg Rail Relocation',
    metaDescription: 'Manitoba Premier Wab Kinew shares feasibility results for relocating Winnipeg railway corridors.',
    tags: ['Wab Kinew', 'Manitoba', 'Winnipeg', 'Infrastructure', 'Transit', 'Economy'],
    breakingNews: false,
    author: {
      name: 'Choseno National News Desk',
      bio: 'Provincial and federal political affairs reporting'
    },
    sources: [
      { label: 'Winnipeg Free Press', url: 'https://www.winnipegfreepress.com/breaking-news/kinew-winnipeg-rail-study-release' },
      { label: 'Government of Manitoba', url: 'https://news.gov.mb.ca/news/' }
    ],
    taggedPoliticianIds: [
      '38870346-a851-434d-b894-8362aedc4966' // Wab Kinew
    ]
  },
  {
    slug: 'anita-anand-announces-maritime-security-sanctions',
    headline: 'Minister Anita Anand Announces Targeted International Maritime Security Sanctions',
    summary: 'Foreign Affairs Minister Anita Anand details new sanctions targeting entities involved in maritime disruptions and regional security challenges.',
    category: 'International',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-14T15:30:00Z',
    published_at: '2026-08-14T15:30:00Z',
    impactArea: 'international',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, Ont. — Minister of Foreign Affairs Anita Anand announced that Canada has imposed targeted economic sanctions against individuals and security entities responsible for actions threatening international commercial shipping routes and freedom of navigation.

The measures were coordinated in partnership with international allies to uphold maritime security and global supply chain stability.

## Defending Rules-Based Navigation

Speaking in Ottawa, Minister Anand reaffirmed Canada's commitment to multilateral cooperation and the protection of international commercial transit corridors.

"Unimpeded freedom of navigation is vital for global commerce and peace," Anand stated. "Canada will continue to hold individuals and entities accountable when their actions jeopardize safe passage in international waters. We remain steadfast in defending international maritime law alongside our allies."

## Strategic Diplomatic Engagement

The announcement comes as Minister Anand prepares to participate in upcoming United Nations sessions, where Canadian delegations will champion open trade corridors and regional stability dialogues.`,
    seoTitle: 'Anita Anand Announces Maritime Security Sanctions',
    metaDescription: 'Foreign Affairs Minister Anita Anand enacts sanctions targeting international shipping disruptions.',
    tags: ['Anita Anand', 'Foreign Affairs', 'Sanctions', 'Ottawa', 'International Relations', 'Trade'],
    breakingNews: false,
    author: {
      name: 'Choseno National News Desk',
      bio: 'Provincial and federal political affairs reporting'
    },
    sources: [
      { label: 'Global Affairs Canada', url: 'https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/' },
      { label: 'CBC News', url: 'https://www.cbc.ca/news/politics/anand-announces-maritime-sanctions-august-2026-1.7291501' }
    ],
    taggedPoliticianIds: [
      '7d3c1705-2fff-4ad8-b966-876fcf875c32' // Anita Anand
    ]
  },
  {
    slug: 'justice-minister-sean-fraser-announces-victims-crime-funding',
    headline: 'Justice Minister Sean Fraser Rolls Out Funding for Victims of Crime Initiatives',
    summary: 'Minister of Justice Sean Fraser announces multi-million dollar federal grants to support community trauma counselling, court accompaniment, and legal resources.',
    category: 'Public Safety',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-07-30T17:00:00Z',
    published_at: '2026-07-30T17:00:00Z',
    impactArea: 'country',
    latitude: 45.4215,
    longitude: -75.6972,
    body: `OTTAWA, Ont. — Minister of Justice and Attorney General of Canada Sean Fraser has detailed a nationwide funding allocation to enhance dedicated support services and legal advocacy for victims of crime across Canadian provinces and territories.

The funding supports grassroots community organizations providing specialized trauma counseling, emergency shelter coordination, and legal navigation.

## Strengthening Victim Support Systems

Minister Fraser highlighted the government's commitment to ensuring the criminal justice system provides compassion, dignity, and practical resources for victims and survivors.

"Supporting victims through the criminal justice process requires reliable, compassionate community services," Minister Fraser announced. "By investing in frontline organizations, we are ensuring survivors have access to the counseling, court accompaniment, and protection services they need to heal and rebuild."

## Enhancing Legal Reforms

The initiative complements recently introduced justice reform measures, including enhanced judicial training and updated victim notification protocols during court proceedings.`,
    seoTitle: 'Sean Fraser Announces National Victims of Crime Support Funding',
    metaDescription: 'Justice Minister Sean Fraser delivers federal funding for community victim services and trauma support across Canada.',
    tags: ['Sean Fraser', 'Justice Canada', 'Public Safety', 'Ottawa', 'Crime Victims Support'],
    breakingNews: false,
    author: {
      name: 'Choseno National News Desk',
      bio: 'Provincial and federal political affairs reporting'
    },
    sources: [
      { label: 'Department of Justice Canada', url: 'https://www.canada.ca/en/department-justice/news/2026/07/government-of-canada-supports-victims-of-crime.html' },
      { label: 'CTV News', url: 'https://www.ctvnews.ca/politics/fraser-announces-victim-support-funding-1.6983021' }
    ],
    taggedPoliticianIds: [
      '2b908831-a9d1-4127-b43d-f0dc0c282710' // Sean Fraser
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

  let successCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    console.log(`\n[${i + 1}/${articles.length}] Processing "${art.headline}"...`);

    const insertPayload = {
      slug: art.slug,
      headline: art.headline,
      summary: art.summary,
      category: art.category,
      country: art.country || 'CA',
      province: art.province || null,
      status: art.status || 'published',
      event_date: art.eventDate,
      published_at: art.published_at,
      impact_area: art.impactArea,
      latitude: art.latitude != null ? Number(art.latitude) : null,
      longitude: art.longitude != null ? Number(art.longitude) : null,
      content: {
        body: art.body,
        seoTitle: art.seoTitle,
        metaDescription: art.metaDescription,
        tags: art.tags || [],
        breakingNews: Boolean(art.breakingNews),
        author: art.author,
        sources: art.sources || []
      }
    };

    const checkUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?slug=eq.' + encodeURIComponent(art.slug) + '&select=id,slug';
    const checkRes = await fetch(checkUrl, { headers });
    const existing = await checkRes.json();

    let articleId;
    if (existing && existing.length > 0) {
      articleId = existing[0].id;
      console.log(`  Article exists (id: ${articleId}), updating...`);
      const updateUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?id=eq.' + articleId;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(insertPayload)
      });
      if (!updateRes.ok) {
        console.error('  Update error:', await updateRes.text());
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
        console.error('  Insert error:', await createRes.text());
        continue;
      }
      const created = await createRes.json();
      articleId = created[0]?.id;
      console.log(`  Created article with id: ${articleId}`);
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
        console.error('  Tag sync error:', await tagRes.text());
      } else {
        console.log(`  Synced ${art.taggedPoliticianIds.length} politician tags to wall!`);
      }

      const postDate = insertPayload.event_date || insertPayload.published_at;
      if (postDate) {
        await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/posts?news_article_id=eq.' + articleId, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ created_at: postDate })
        });
      }
    }

    successCount++;
  }

  console.log('\n======================================================');
  console.log(`Completed: ${successCount}/${articles.length} Canadian news articles published and tagged.`);
  console.log('======================================================');
}

run().catch(console.error);
