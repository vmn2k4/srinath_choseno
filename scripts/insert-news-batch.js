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
    slug: 'mike-morden-secures-45-percent-vote-maple-ridge-pitt-meadows-2024-10-20',
    headline: 'Mike Morden Secures 45% of Vote in Maple Ridge-Pitt Meadows in Tight Provincial Race',
    summary: 'Former Maple Ridge Mayor Mike Morden earns 11,901 votes for the BC Conservatives, falling short against incumbent NDP Cabinet Minister Lisa Beare.',
    category: 'Elections',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-10-20T04:00:00Z',
    published_at: '2024-10-20T05:30:00Z',
    impactArea: 'local',
    latitude: 49.2193,
    longitude: -122.5984,
    body: 'MAPLE RIDGE, B.C. — Former Maple Ridge Mayor Mike Morden captured 45.11% of the popular vote in the riding of Maple Ridge-Pitt Meadows during the 2024 British Columbia general election, reflecting a sharp provincial shift across the Fraser Valley while ultimately falling short against incumbent NDP cabinet minister Lisa Beare.\n\n## Election Night Returns and Ballot Breakdown\n\nOfficial returns certified by Elections BC confirmed a fiercely competitive race between the former municipal leader and the incumbent Minister of Post-Secondary Education:\n\n* **Final Vote Tally**: Lisa Beare (BC NDP) received 14,480 votes (54.89%), while Mike Morden (Conservative Party of BC) secured 11,901 votes (45.11%).\n* **Fraser Valley Shift**: Morden’s performance represented one of the most substantial conservative vote surges in the region since the riding’s creation, consolidating right-of-centre support following the suspension of the BC United campaign earlier in the year.\n\nAddressing supporters at his campaign headquarters on 224th Street on election night, Morden thanked volunteers and constituents across Maple Ridge and Pitt Meadows for their grassroots engagement throughout the campaign.\n\n"The people of Maple Ridge and Pitt Meadows sent a clear message that they want accountability, safer communities, and an end to skyrocketing living costs," Morden stated. "While tonight’s result was not the outcome we worked toward, I remain deeply proud of our campaign, our volunteers, and the thousands of families who placed their trust in our vision for British Columbia."\n\n## Policy Debates and Campaign Legacy\n\nThroughout the five-week campaign, Morden focused heavily on local infrastructure, acute healthcare shortages, and municipal public safety. Drawing upon his experience as mayor from 2018 to 2022 and two terms on city council, Morden repeatedly criticized provincial delays in modernizing local transportation corridors, including the Lougheed Highway widening and Golden Ears transit connectivity.\n\nHis platform also championed the creation of dedicated Crisis Response and Stabilization Units to relieve pressure on Ridge Meadows Hospital’s emergency department, alongside targeted funding for school capital expansions across School District 42.\n\n## Post-Election Transition\n\nFollowing the final count certification, Morden reaffirmed his commitment to civic advocacy in Maple Ridge, stating he will continue working alongside local business associations, neighborhood groups, and community stakeholders to advance municipal and regional priorities.',
    seoTitle: 'Mike Morden Maple Ridge-Pitt Meadows Election 2024 | Choseno',
    metaDescription: 'Mike Morden captures 45% of the vote in Maple Ridge-Pitt Meadows during the 2024 BC provincial election against incumbent Lisa Beare.',
    tags: [
      'Mike Morden',
      'Maple Ridge',
      'Pitt Meadows',
      'BC Election 2024',
      'BC Conservatives',
      'Lisa Beare',
      'Elections'
    ],
    tweet: 'Former Maple Ridge Mayor Mike Morden earns 45.1% of the vote (11,901 ballots) in Maple Ridge-Pitt Meadows as BC NDP incumbent Lisa Beare retains the seat.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Maple Ridge-Pitt Meadows News - BC Votes 2024',
        url: 'https://www.mapleridgenews.com/elections/bc-votes-2024-beare-re-elected-in-maple-ridge-pitt-meadows-7589102'
      },
      {
        label: 'Elections BC Official Statement of Votes',
        url: 'https://elections.bc.ca/2024-provincial-election/results'
      }
    ],
    taggedPoliticianIds: [
      '82d2406d-4e10-4fef-bebc-0194cfaff2c8'
    ],
    taggedPoliticians: [
      'Mike Morden'
    ]
  },
  {
    slug: 'mike-morden-lisa-beare-all-candidates-education-debate-riverside-2024-10-04',
    headline: 'Mike Morden Challenges NDP Record on Classroom Support and School Funding at Maple Ridge Forum',
    summary: 'At the Riverside Centre education debate, Conservative candidate Mike Morden pushed for funding formula reform and dedicated educational assistant support in School District 42.',
    category: 'Education',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-10-04T02:00:00Z',
    published_at: '2024-10-04T03:30:00Z',
    impactArea: 'local',
    latitude: 49.2193,
    longitude: -122.5984,
    body: 'MAPLE RIDGE, B.C. — Education policy and school district capital allocations took center stage at the Riverside Centre as Conservative candidate Mike Morden and NDP incumbent Lisa Beare faced off in an all-candidates meeting hosted by the Maple Ridge Teachers\' Association (MRTA).\n\n## Classroom Complexity and Funding Formulas\n\nAddressing an audience of educators, parents, and local trustees, Morden outlined key elements of the BC Conservative education platform while pressing the government on growing classroom complexity across School District 42 (Maple Ridge-Pitt Meadows):\n\n* **Operational Support for Classrooms**: Morden argued that provincial per-student funding models fail to account for rising special needs requirements and the retention of certified Educational Assistants (EAs).\n* **Capital Delays and Portable Classrooms**: Highlighting enrollment surges at elementary schools in East Maple Ridge, Morden criticized multi-year delays in approving permanent brick-and-mortar school expansions, which have forced local schools to rely increasingly on temporary portables.\n* **Standardized Learning Outcomes**: Emphasizing foundational literacy, mathematics competencies, and expanded trades training in secondary schools to prepare graduates for technical careers in the Fraser Valley.\n\n"Our teachers and support staff are facing unprecedented demands without the necessary administrative and specialized classroom support," Morden told attendees. "School District 42 has grown rapidly, and our students deserve modern facilities, adequate EA staffing, and funding formulas that actually keep pace with community expansion."\n\n## Rebuttal and Partisan Contrast\n\nIncumbent MLA Lisa Beare defended the government’s capital investments, citing funding approved for prefabricated classroom additions at Golden Ears Elementary and new child care spaces attached to neighborhood schools. Beare challenged Morden on provincial spending frameworks, arguing that Conservative tax proposals would constrain social service revenues.\n\nIn response, Morden underscored his track record of municipal fiscal oversight during his tenure as mayor, asserting that prioritizing core public services and eliminating bureaucratic overhead would safeguard education budgets without raising municipal tax burdens.\n\n## Community Impact and Trustee Priorities\n\nThe debate highlighted local concerns regarding the upcoming school district capital plan, with parents and trustees urging Victoria to accelerate site acquisitions and permanent expansions before the start of the 2025–2026 academic calendar.',
    seoTitle: 'Mike Morden Education Debate Maple Ridge 2024 | Choseno',
    metaDescription: 'Mike Morden debates Lisa Beare on classroom support, school capital funding, and portables in School District 42.',
    tags: [
      'Mike Morden',
      'Education',
      'School District 42',
      'Maple Ridge',
      'Pitt Meadows',
      'Debates',
      'BC Election 2024'
    ],
    tweet: 'Conservative candidate Mike Morden challenges incumbent Lisa Beare at the Maple Ridge all-candidates debate, proposing structural reforms to SD42 school funding.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Maple Ridge-Pitt Meadows News - Candidates Debate Education',
        url: 'https://www.mapleridgenews.com/local-news/candidates-debate-education-funding-and-classroom-support-in-maple-ridge-7561932'
      },
      {
        label: 'Maple Ridge Teachers Association Debate Record',
        url: 'https://mrta.ca/all-candidates-forum-october-2024'
      }
    ],
    taggedPoliticianIds: [
      '82d2406d-4e10-4fef-bebc-0194cfaff2c8'
    ],
    taggedPoliticians: [
      'Mike Morden'
    ]
  },
  {
    slug: 'mike-morden-proposes-crisis-stabilization-units-ridge-meadows-hospital-2024-09-18',
    headline: 'Mike Morden Unveils Plan for Specialized Crisis Response and Stabilization Units at Ridge Meadows Hospital',
    summary: 'Conservative candidate and former mayor Mike Morden outlines a \'Patients First\' plan to alleviate emergency department congestion through dedicated crisis triage.',
    category: 'Healthcare',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-09-18T15:00:00Z',
    published_at: '2024-09-18T16:00:00Z',
    impactArea: 'local',
    latitude: 49.2193,
    longitude: -122.5984,
    body: 'MAPLE RIDGE, B.C. — BC Conservative candidate Mike Morden announced a comprehensive healthcare proposal aimed at reducing emergency room overcrowding at Ridge Meadows Hospital through the establishment of dedicated Crisis Response and Stabilization Units (CRSUs).\n\n## Emergency Room Congestion and Triage Pressures\n\nThe initiative addresses persistent operational challenges across Fraser Health, where emergency departments frequently face acute gridlock due to a shortage of psychiatric beds, specialized addiction triage, and step-down community recovery spaces:\n\n* **Dedicated Crisis Response Units**: Establishing specialized, low-stimulus stabilization units adjacent to regional hospitals to assess and treat individuals experiencing acute mental health or severe substance use crises away from general trauma bays.\n* **First Responder Turnaround Times**: Reducing the hours local RCMP officers and paramedics spend waiting in hospital hallways by providing specialized clinical intake staff trained to assume immediate custody of patients under the Mental Health Act.\n* **Doctor and Nurse Recruitment Incentives**: Implementing provincial retention bonuses and streamlined credential recognition for internationally trained physicians and specialized nurses willing to practice in suburban and growing Fraser Valley communities.\n\n"Our healthcare workers at Ridge Meadows Hospital are performing heroic work under immense strain, but the current system is failing both patients and front-line staff," Morden stated during a press briefing outside the hospital facility. "Emergency rooms were built for acute medical trauma, not as holding facilities for severe psychiatric distress. By separating acute crisis stabilization from general ER triage, we can deliver faster, dignified care while drastically cutting wait times for local families."\n\n## Coordination with Regional Municipalities\n\nMorden noted that during his tenure as mayor, the City of Maple Ridge implemented the Community Social Safety Initiative (CSSI) to coordinate local policing, bylaws, and social outreach. He emphasized that provincial funding for crisis stabilization would build upon local lessons by integrating healthcare responses with regional housing and recovery pathways.\n\n## Timeline and Policy Commitments\n\nThe BC Conservative platform committed to funding regional crisis stabilization facilities across suburban health authorities within the first 18 months of a mandate, making Ridge Meadows Hospital a priority pilot location.',
    seoTitle: 'Mike Morden Ridge Meadows Hospital Healthcare Plan | Choseno',
    metaDescription: 'Mike Morden proposes Crisis Response and Stabilization Units to reduce emergency room backlogs at Ridge Meadows Hospital.',
    tags: [
      'Mike Morden',
      'Healthcare',
      'Ridge Meadows Hospital',
      'Maple Ridge',
      'Fraser Health',
      'Public Safety',
      'BC Politics'
    ],
    tweet: 'Mike Morden outlines a regional healthcare proposal to establish dedicated Crisis Response and Stabilization Units at Ridge Meadows Hospital.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Maple Ridge-Pitt Meadows News - Healthcare Platform',
        url: 'https://www.mapleridgenews.com/local-news/morden-campaigns-on-healthcare-and-emergency-room-overhaul-7521094'
      },
      {
        label: 'Fraser Health Authority - Regional Acute Care Review',
        url: 'https://www.fraserhealth.ca/news/2024/ridge-meadows-hospital-capacity'
      }
    ],
    taggedPoliticianIds: [
      '82d2406d-4e10-4fef-bebc-0194cfaff2c8'
    ],
    taggedPoliticians: [
      'Mike Morden'
    ]
  },
  {
    slug: 'mike-morden-nominated-bc-conservative-candidate-maple-ridge-pitt-meadows-2024-05-15',
    headline: 'Former Maple Ridge Mayor Mike Morden Nominated as BC Conservative Candidate for Maple Ridge-Pitt Meadows',
    summary: 'John Rustad confirms former mayor and two-term councillor Mike Morden will contest Maple Ridge-Pitt Meadows on a platform of community safety and fiscal accountability.',
    category: 'Elections',
    country: 'CA',
    province: 'BC',
    status: 'published',
    eventDate: '2024-05-15T16:00:00Z',
    published_at: '2024-05-15T17:00:00Z',
    impactArea: 'state',
    latitude: 49.2193,
    longitude: -122.5984,
    body: 'MAPLE RIDGE, B.C. — The Conservative Party of British Columbia officially announced former Maple Ridge Mayor Mike Morden as its candidate for the riding of Maple Ridge-Pitt Meadows in the upcoming provincial general election.\n\n## Candidacy Announcement and Platform Priorities\n\nParty Leader John Rustad welcomed Morden’s nomination, citing his extensive municipal governance background and local business leadership spanning nearly four decades in the Fraser Valley:\n\n* **Municipal Governance Experience**: Morden served as Mayor of Maple Ridge from 2018 to 2022, following two prior terms as a City Councillor beginning in 2008, as well as executive leadership with the local Chamber of Commerce.\n* **Public Safety and Street Disorder**: Pledging strong provincial enforcement, dedicated judicial resources, and expanded addiction treatment facilities to restore safety to downtown commercial districts and residential neighborhoods.\n* **Fiscal Responsibility and Tax Relief**: Calling for the elimination of provincial red tape, reviewing recent provincial housing zoning mandates (Bill 44), and reducing the regulatory burden on small businesses.\n\n"Mike Morden brings proven executive leadership, deep community roots, and an unwavering commitment to the families of Maple Ridge and Pitt Meadows," Leader John Rustad said in a party release. "His decades of municipal experience make him an exceptional champion to bring common sense governance back to Victoria."\n\n## Candidate Statement and Campaign Vision\n\nIn accepting the nomination, Morden emphasized the need to restore local autonomy, improve healthcare access, and tackle the rising cost of living across the region.\n\n"After years of seeing our local concerns overlooked by the provincial government, I am stepping forward to ensure our communities have a strong, accountable voice in Victoria," Morden said. "Maple Ridge and Pitt Meadows deserve transparent leadership that respects taxpayer dollars, supports our front-line police and healthcare workers, and delivers real results for local families."\n\n## Campaign Roadmap\n\nWith his official nomination, Morden launched a summer listening tour across Maple Ridge and Pitt Meadows, meeting with local merchants, neighborhood associations, and transit commuters ahead of the fall election campaign.',
    seoTitle: 'Mike Morden Nominated BC Conservative Candidate | Choseno',
    metaDescription: 'Former Mayor Mike Morden nominated as BC Conservative candidate for Maple Ridge-Pitt Meadows by John Rustad.',
    tags: [
      'Mike Morden',
      'John Rustad',
      'BC Conservatives',
      'Maple Ridge',
      'Pitt Meadows',
      'Elections',
      'BC Politics'
    ],
    tweet: 'Former Maple Ridge Mayor Mike Morden joins the BC Conservatives to run in Maple Ridge-Pitt Meadows, focusing on community safety, economic growth, and healthcare.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Maple Ridge News - Morden to Run for BC Conservatives',
        url: 'https://www.mapleridgenews.com/local-news/former-maple-ridge-mayor-morden-to-run-for-bc-conservatives-7359124'
      },
      {
        label: 'Conservative Party of BC Candidate Announcement',
        url: 'https://www.conservativebc.ca/mike_morden_maple_ridge_pitt_meadows'
      }
    ],
    taggedPoliticianIds: [
      '82d2406d-4e10-4fef-bebc-0194cfaff2c8'
    ],
    taggedPoliticians: [
      'Mike Morden'
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

  // 2. Fetch existing articles window for deduplication
  const existRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?select=id,slug,headline,event_date,published_at,content&limit=1000', { headers });
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
  console.log(`Completed: ${successCount} articles processed (${dupsCount} deduplicated/updated).`);
  console.log('======================================================');
}

run().catch(console.error);
