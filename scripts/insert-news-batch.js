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
    slug: 'senator-bill-cassidy-criticizes-white-house-childhood-vaccine-directive-2026-08-16',
    headline: 'Senator Bill Cassidy Pushes Back Against Executive Directive on Childhood Vaccine Schedules',
    summary: 'Physician and U.S. Senator Bill Cassidy breaks with White House rhetoric on childhood vaccines, defending established clinical immunology and state public health authority.',
    category: 'Healthcare',
    country: 'US',
    province: 'LA',
    status: 'published',
    eventDate: '2026-08-16T18:00:00Z',
    published_at: '2026-08-16T19:45:00Z',
    impactArea: 'country',
    latitude: 30.4583,
    longitude: -91.1403,
    body: 'BATON ROUGE, La. — U.S. Senator Bill Cassidy (R-LA), a practicing gastroenterologist and member of the Senate Health, Education, Labor, and Pensions (HELP) Committee, issued a sharp critique of recent executive proposals aimed at altering federally recommended childhood vaccine protocols.\n\n## Medical Evidence and Public Health Governance\n\nThe dispute follows the signing of Executive Order 14420, which proposed unbundling the standard measles, mumps, and rubella (MMR) immunization and reducing the number of pediatric shots recommended by federal agencies:\n\n* **Peer-Reviewed Immunology**: Senator Cassidy emphasized that comprehensive global clinical trials over three decades demonstrate the combined MMR vaccine\'s safety and efficacy in preventing deadly childhood outbreaks.\n* **State vs. Federal Authority**: Reaffirming that under the U.S. Constitution, mandatory school immunization schedules remain strictly under the jurisdiction of state legislatures and public health boards, not federal executive orders.\n\n"As a doctor who has treated patients for over thirty years, public health policy must be anchored in rigorous, peer-reviewed medical science, not political rhetoric," Senator Cassidy stated during a state medical society forum. "Undermining public confidence in proven vaccines risks the resurgence of preventable infectious diseases among our children."\n\n## Congressional and Civic Reaction\n\nCassidy\'s remarks triggered widespread debate across the Capitol and medical associations, with the American Academy of Pediatrics (AAP) and the American Medical Association (AMA) releasing joint statements endorsing his position. In contrast, conservative populist commentators defended the executive order as a necessary check on federal health bureaucracy.\n\n## Legislative Oversight and Next Steps\n\nThe Senate HELP Committee plans to hold informational hearings in September to review the regulatory implementation of federal advisory committee recommendations at the CDC and FDA.',
    seoTitle: 'Sen. Bill Cassidy Defends Childhood Vaccines | Choseno',
    metaDescription: 'Senator Bill Cassidy pushes back against White House childhood vaccine directives, citing clinical medical evidence.',
    tags: [
      'Bill Cassidy',
      'Healthcare',
      'Vaccines',
      'Senate GOP',
      'Public Health',
      'Louisiana'
    ],
    tweet: 'Senator Bill Cassidy breaks with White House vaccine rhetoric, defending clinical medical evidence and state public health authority over pediatric immunization schedules.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'U.S. Senate Office of Senator Bill Cassidy - Official Press',
        url: 'https://www.cassidy.senate.gov/newsroom/press-releases/cassidy-statement-on-childhood-immunization-guidelines'
      },
      {
        label: 'American Academy of Pediatrics Policy Briefing',
        url: 'https://www.aap.org/en/news-room/news-releases/aap-statement-on-federal-vaccine-schedules'
      }
    ],
    taggedPoliticianIds: [
      '233458cd-528c-43ab-8ce7-d366838d301a'
    ],
    taggedPoliticians: [
      'Bill Cassidy'
    ]
  },
  {
    slug: 'canada-parliamentary-petition-diplomatic-sovereignty-us-trade-showdown-2026-08-16',
    headline: 'Grassroots Parliamentary Petition Demands Diplomatic Red Lines Amid U.S. Trade Confrontation',
    summary: 'A fast-growing civic petition submitted to the House of Commons calls for strict diplomatic protocols after controversial remarks by U.S. Ambassador Pete Hoekstra during active tariff negotiations.',
    category: 'Policy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-16T17:00:00Z',
    published_at: '2026-08-16T19:45:00Z',
    impactArea: 'international',
    latitude: 45.4215,
    longitude: -75.6972,
    body: 'OTTAWA, Ont. — A national parliamentary e-petition has gathered tens of thousands of signatures across Canada, calling on the federal government to formally affirm Canadian economic sovereignty and address perceived diplomatic overreach by U.S. Ambassador Pete Hoekstra during ongoing tariff negotiations.\n\n## Civic Momentum & Diplomatic Protocol Terms\n\nThe petition, sponsored by civil society groups and presented to Members of Parliament, focuses on recent public statements by the U.S. Ambassador regarding Canadian supply management and provincial liquor monopolies:\n\n* **Vienna Convention Protections**: Demanding that foreign envoys adhere strictly to diplomatic conventions prohibiting interference in domestic legislative and provincial regulatory affairs.\n* **Cross-Party Sovereignty Declaration**: Urging all federal parties in the House of Commons to adopt a unified resolution protecting Canadian agricultural supply management from unilateral trade ultimatums.\n\n"Canadians expect fair and firm negotiations with our closest trading partner, but we will not accept external pressure undermining our democratically enacted provincial laws and farm families," said civic organizers in Ottawa.\n\n## Political and Trade Context\n\nThe petition emerges as Minister Dominic LeBlanc conducts round-the-clock talks in Washington to prevent 50% tariffs on $28 billion of Canadian goods from taking effect on August 19. While business lobbies have urged flexibility to avert economic damage, labor unions and agricultural associations have mobilized grassroots campaigns to resist unilateral concessions.\n\n## Next Steps in the House of Commons\n\nUpon certification by the Clerk of Petitions, the federal government is constitutionally required to provide a formal written response in the House of Commons within 45 calendar days.',
    seoTitle: 'Canada Diplomatic Sovereignty Petition 2026 | Choseno',
    metaDescription: 'National parliamentary petition demands diplomatic red lines and defense of Canadian sovereignty amid US tariff threats.',
    tags: [
      'Canada-US Trade',
      'Parliament',
      'Petitions',
      'Dominic LeBlanc',
      'Sovereignty',
      'Ottawa'
    ],
    tweet: 'A surge in grassroots parliamentary signatures calls on Ottawa to enforce diplomatic red lines and protect Canadian sovereignty amid high-stakes U.S. tariff threats.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'House of Commons of Canada - Electronic Petitions Portal',
        url: 'https://petitions.ourcommons.ca/en/Petition/Details?Petition=e-5892'
      },
      {
        label: 'Global Affairs Canada Protocol Office',
        url: 'https://www.international.gc.ca/protocol-protocole/guidelines-lignes_directrices.aspx'
      }
    ],
    taggedPoliticianIds: [],
    taggedPoliticians: [
      'Pete Hoekstra'
    ]
  }
];

// ── DEDUPLICATION HELPER ───────────────────────────────────────────────────
function findDuplicate(incoming, existingList) {
  const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const incomingTokens = new Set(normalize(incoming.headline).split(/\s+/).filter(w => w.length > 3));

  for (const existing of existingList) {
    // 1. Slug match
    if (existing.slug === incoming.slug) {
      return { isDup: true, id: existing.id, match: existing, reason: 'Slug match' };
    }

    // 2. Source URL match
    const existingUrls = (existing.content?.sources || []).map(s => s.url);
    const hasSharedUrl = (incoming.sources || []).some(s => s.url && existingUrls.includes(s.url));
    if (hasSharedUrl) {
      return { isDup: true, id: existing.id, match: existing, reason: 'Source URL match' };
    }

    // 3. High headline token similarity within 3-day event window
    const inDate = new Date(incoming.eventDate || incoming.published_at || Date.now()).getTime();
    const exDate = new Date(existing.event_date || existing.published_at || Date.now()).getTime();
    const daysDiff = Math.abs(inDate - exDate) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 3.5) {
      const existingTokens = new Set(normalize(existing.headline).split(/\s+/).filter(w => w.length > 3));
      const intersection = [...incomingTokens].filter(t => existingTokens.has(t));
      const similarity = intersection.length / Math.max(incomingTokens.size, 1);

      if (similarity >= 0.75) {
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
