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
    slug: 'dominic-leblanc-washington-urgent-canada-us-tariff-talks-2026-08-16',
    headline: 'Trade Minister Dominic LeBlanc Leads High-Stakes Washington Talks to Avert Looming U.S. Tariffs',
    summary: 'Minister Dominic LeBlanc and Chief Negotiator Janice Charette hold weekend sessions in Washington to resolve cross-border dairy, alcohol, and trade friction ahead of an August 19 tariff deadline.',
    category: 'Economy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-16T17:30:00Z',
    published_at: '2026-08-16T18:45:00Z',
    impactArea: 'international',
    latitude: 45.4215,
    longitude: -75.6972,
    body: 'OTTAWA, Ont. — Federal Minister of Public Safety, Democratic Institutions and Intergovernmental Affairs Dominic LeBlanc and Chief Trade Negotiator Janice Charette have concluded weekend ministerial sessions in Washington, D.C., working to resolve bilateral trade disputes before impending U.S. tariff actions take effect on August 19.\n\n## The $28 Billion Trade Dispute & Sectoral Mechanics\n\nThe emergency negotiations center on potential 50% U.S. tariff duties that could impact up to $28 billion in annual Canadian export volume. U.S. Trade Representative Jamieson Greer and American negotiators have raised key areas of contention:\n\n* **Supply-Managed Agricultural Quotas**: Tariff rate quota administration on poultry and dairy imports into the Canadian market.\n* **Provincial Alcohol Retail Rules**: Direct access for American spirit distillers and wine producers across provincial liquor boards.\n* **Automotive Origin Requirements**: Supply chain rules governing North American critical minerals and electric vehicle battery components.\n\n\"Canada and the United States share the most integrated and mutually beneficial economic partnership in the world,\" Minister LeBlanc said following discussions at the Canadian Embassy in Washington. \"We remain firmly focused on defending Canadian workers, businesses, and supply chains while seeking a fair, comprehensive agreement.\"\n\n## Economic Stakes for Constituents and Exporters\n\nCross-border supply chain groups estimate that sudden tariff barriers would cause severe disruptions for manufacturing facilities across Southern Ontario and agricultural exporters throughout the Prairies and Quebec. In the United States, agricultural leaders in Midwestern states have also raised concerns regarding reciprocal retaliatory duties on corn, pork, and soybean exports to Canadian consumers.\n\n## Next Steps and Accountability Timelines\n\nNegotiators will continue technical roundtables in Washington through August 18. Minister LeBlanc is scheduled to brief the Cabinet Committee on Canada-U.S. Relations on Monday morning, with parliamentary opposition parties requesting an emergency briefing before the House of Commons Standing Committee on International Trade.',
    seoTitle: 'Dominic LeBlanc Leads Canada-US Trade Talks 2026 | Choseno',
    metaDescription: 'Trade Minister Dominic LeBlanc holds emergency Washington talks to resolve $28B tariff dispute before August 19 deadline.',
    tags: [
      'Dominic LeBlanc',
      'Canada-US Trade',
      'Tariffs',
      'Economy',
      'Ottawa',
      'Federal Politics'
    ],
    tweet: 'Trade Minister Dominic LeBlanc leads high-stakes weekend talks in Washington to avert potential 50% U.S. tariffs on $28B in Canadian exports ahead of the August 19 deadline.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Global Affairs Canada Official Statement',
        url: 'https://www.international.gc.ca/gac-amc/news-nouvelles/2026-08-16-canada-us-trade-negotiations.aspx'
      },
      {
        label: 'Office of the United States Trade Representative',
        url: 'https://ustr.gov/about-us/policy-offices/press-office/press-releases/2026/august/bilateral-canada-trade-dialogue'
      }
    ],
    taggedPoliticianIds: [
      '885e12f5-33d9-42a1-8dc9-b276069da88d'
    ],
    taggedPoliticians: [
      'Dominic LeBlanc'
    ]
  },
  {
    slug: 'pierre-poilievre-calls-for-fuel-excise-tax-relief-extension-2026-08-16',
    headline: 'Conservative Leader Pierre Poilievre Urges Extension of Federal Fuel Excise Tax Suspension',
    summary: 'Opposition Leader Pierre Poilievre presses the federal government to extend relief on federal fuel taxes ahead of the fall budget, citing persistent cost-of-living pressures for working families.',
    category: 'Economy',
    country: 'CA',
    province: 'ON',
    status: 'published',
    eventDate: '2026-08-16T16:45:00Z',
    published_at: '2026-08-16T18:45:00Z',
    impactArea: 'country',
    latitude: 45.4215,
    longitude: -75.6972,
    body: 'OTTAWA, Ont. — Official Opposition Leader Pierre Poilievre has called on the federal government to extend the temporary suspension of federal excise taxes on gasoline and diesel, warning that impending tax reinstatements would increase consumer freight and grocery distribution costs across Canada.\n\n## The Fiscal Debate and Consumer Numbers\n\nThe federal fuel excise tax applies a flat charge of 10 cents per litre on gasoline and 4 cents per litre on diesel fuel. According to Conservative economic policy analysts:\n\n* **Household Savings**: The average commuting household saves an estimated $28 to $42 per month during active fuel excise relief periods.\n* **Supply Chain Impacts**: Commercial transport operators estimate that extending the fuel tax pause lowers long-haul freight shipping rates by approximately 3.8% across interprovincial transit corridors.\n\n\"Canadian families are already stretched to their limits by high mortgage interest rates and grocery inflation,\" Poilievre stated at a press conference in Ottawa. \"Reimposing federal fuel taxes at this moment will only drive up shipping costs on every essential item that arrives on store shelves.\"\n\n## Government Response and Budgetary Context\n\nDepartment of Finance officials have emphasized that temporary tax measures must be balanced against ongoing infrastructure and green transit investments funded through dedicated fuel excise revenue transfers to municipalities. Deputy Prime Minister Chrystia Freeland previously noted that targeted fiscal support will remain the priority as the federal government prepares its upcoming fall economic statement.\n\n## Next Steps in Parliament\n\nThe Conservative caucus confirmed it will introduce an opposition day motion demanding a comprehensive review of federal energy taxation when the House of Commons resumes sitting in September.',
    seoTitle: 'Pierre Poilievre Pushes Fuel Tax Relief Extension | Choseno',
    metaDescription: 'Conservative Leader Pierre Poilievre calls on the federal government to extend the fuel excise tax suspension to ease cost of living.',
    tags: [
      'Pierre Poilievre',
      'Conservatives',
      'Fuel Tax',
      'Economy',
      'Ottawa',
      'Cost of Living'
    ],
    tweet: 'Conservative Leader Pierre Poilievre calls on the federal government to extend the fuel excise tax pause to protect family budgets and prevent shipping cost hikes.',
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial, federal and municipal political affairs reporting'
    },
    sources: [
      {
        label: 'Conservative Party of Canada Media Room',
        url: 'https://www.conservative.ca/poilievre-calls-for-fuel-tax-relief-extension-2026'
      },
      {
        label: 'Parliament of Canada - House of Commons Notices',
        url: 'https://www.ourcommons.ca/documentviewer/en/44-1/house/sitting-210/order-notice/page-4'
      }
    ],
    taggedPoliticianIds: [
      'a0d8ee32-8927-48bc-9a98-fee27dd02d51'
    ],
    taggedPoliticians: [
      'Pierre Poilievre'
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
