/**
 * Reusable batch news importer and tagger for Choseno.
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
  /* Example Article:
  {
    slug: 'example-article-slug',
    headline: 'Example News Headline',
    summary: 'Short summary for feed cards.',
    category: 'Policy', // General | Policy | Local | National | International | Economy | Healthcare | Education | Environment | Technology | Infrastructure | Public Safety | Culture | Elections | Opinion
    country: 'CA',
    province: 'BC',
    status: 'published', // 'published' | 'draft' | 'archived'
    eventDate: '2024-02-15T15:00:00Z',
    published_at: '2024-02-15T15:00:00Z',
    impactArea: 'local', // 'local' | 'state' | 'country' | 'international'
    latitude: 49.1913,
    longitude: -122.8490,
    body: 'CITY, Prov. — Opening dateline and content...\n\n## Subhead\n\nMore details...',
    seoTitle: 'SEO Title Under 60 Chars',
    metaDescription: 'Meta Description Under 160 Chars',
    tags: ['Surrey', 'Policy'],
    breakingNews: false,
    author: {
      name: 'Choseno Civic News Desk',
      bio: 'Provincial and municipal political affairs reporting'
    },
    sources: [
      { label: 'Source Name', url: 'https://example.com/news-story' }
    ],
    taggedPoliticianIds: [
      'uuid-of-politician-profile-1',
      'uuid-of-politician-profile-2'
    ]
  }
  */
];

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

  let successCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    console.log(`\n[${i + 1}/${articles.length}] Processing "${art.headline}"...`);

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
        breakingNews: Boolean(art.breakingNews),
        author: art.author,
        sources: art.sources || []
      }
    };

    // Check existing
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

      // Also ensure post created_at in DB matches the article event_date
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
  console.log(`Completed: ${successCount}/${articles.length} articles saved and synced.`);
  console.log('======================================================');
}

run().catch(console.error);
