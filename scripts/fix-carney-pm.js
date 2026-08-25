const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

async function fix() {
  console.log('Searching for articles mentioning Trudeau to update to Prime Minister Mark Carney...');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,summary,body,content&body=ilike.*Justin Trudeau*`, {
    headers
  });

  if (!res.ok) {
    console.error('Fetch error:', res.status, await res.text());
    return;
  }

  const articles = await res.json();
  console.log(`Found ${articles.length} articles to update.\n`);

  for (const art of articles) {
    console.log(`Updating: [${art.id}] ${art.headline}`);
    const newSummary = (art.summary || '')
      .replace(/Prime Minister Justin Trudeau/g, 'Prime Minister Mark Carney')
      .replace(/Justin Trudeau/g, 'Mark Carney');

    const newBody = (art.body || '')
      .replace(/Prime Minister Justin Trudeau/g, 'Prime Minister Mark Carney')
      .replace(/Justin Trudeau/g, 'Mark Carney');

    const content = art.content || {};
    if (content.summary) {
      content.summary = content.summary
        .replace(/Prime Minister Justin Trudeau/g, 'Prime Minister Mark Carney')
        .replace(/Justin Trudeau/g, 'Mark Carney');
    }
    if (content.tweet) {
      content.tweet = content.tweet
        .replace(/Justin Trudeau/g, 'Prime Minister Mark Carney')
        .replace(/Trudeau/g, 'Carney');
    }
    if (content.tweetarticle) {
      content.tweetarticle = content.tweetarticle
        .replace(/Prime Minister Justin Trudeau/g, 'Prime Minister Mark Carney')
        .replace(/Justin Trudeau/g, 'Mark Carney')
        .replace(/\/wall\/justin-trudeau/g, '/wall/mark-carney')
        .replace(/#JustinTrudeau/g, '#MarkCarney');
    }
    if (content.taggedPoliticians) {
      content.taggedPoliticians = content.taggedPoliticians.map(p => p === 'Justin Trudeau' ? 'Mark Carney' : p);
    }
    if (content.tags) {
      content.tags = content.tags.map(t => t === 'Justin Trudeau' ? 'Mark Carney' : t);
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
      method: 'PATCH',
      headers: {
        ...headers,
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        summary: newSummary,
        body: newBody,
        content: content
      })
    });

    console.log(`Patch status: ${patchRes.status}`);
  }

  // Also sync politician walls in database
  const syncRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_tags`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  console.log(`Synchronized tags status: ${syncRes.status}`);
}

fix().catch(console.error);
