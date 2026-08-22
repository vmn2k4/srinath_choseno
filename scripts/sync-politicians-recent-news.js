const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getAuthHeaders() {
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    };
  }
  if (env.admin_un && env.admin_pwd) {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd })
    });
    if (authRes.ok) {
      const authData = await authRes.json();
      return { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${authData.access_token}` };
    }
  }
  return { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };
}

// Search profiles by name safely
async function findPoliticianProfile(name, authHeaders) {
  if (!name || name.length < 3) return null;
  // Clean name
  const cleanName = name.replace(/['"]/g, '').trim();
  const query = `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,designation,constituency,role&role=eq.politician&full_name=ilike.*${encodeURIComponent(cleanName)}*&limit=1`;
  try {
    const res = await fetch(query, {
      headers: {
        apikey: authHeaders.apikey,
        Authorization: authHeaders.Authorization
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0) return rows[0];
    }
  } catch (e) {
    console.error('Error finding profile:', e.message);
  }
  return null;
}

// Tag politician to article via admin_sync_news_article_tags RPC or direct news_article_politicians insert
async function syncArticlePoliticians(articleId, politicianIds, authHeaders) {
  if (!politicianIds || politicianIds.length === 0) return;
  
  // 1. Try RPC
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_tags`, {
      method: 'POST',
      headers: {
        apikey: authHeaders.apikey,
        Authorization: authHeaders.Authorization,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_article_id: articleId,
        p_politician_ids: politicianIds
      })
    });
    if (res.ok) {
      console.log(`  -> RPC synced ${politicianIds.length} politician(s) to article ${articleId}`);
      return;
    } else {
      console.warn('RPC failed, trying direct upsert:', await res.text());
    }
  } catch (e) {
    console.warn('RPC error:', e.message);
  }

  // 2. Direct insert into news_article_politicians
  for (const polId of politicianIds) {
    try {
      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/news_article_politicians`, {
        method: 'POST',
        headers: {
          apikey: authHeaders.apikey,
          Authorization: authHeaders.Authorization,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          news_article_id: articleId,
          politician_id: polId
        })
      });
      if (insRes.ok) {
        console.log(`  -> Direct linked politician ${polId} to article ${articleId}`);
      } else {
        console.error(`  -> Failed direct link:`, await insRes.text());
      }
    } catch (e) {
      console.error('Direct link error:', e.message);
    }
  }
}

async function run() {
  const authHeaders = await getAuthHeaders();

  // Fetch recent 40 articles
  const aRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,content&order=published_at.desc&limit=40`, {
    headers: {
      apikey: authHeaders.apikey,
      Authorization: authHeaders.Authorization
    }
  });

  const articles = await aRes.json();
  console.log(`Fetched ${articles.length} articles for politician verification.`);

  const prominentPoliticians = [
    "David Eby",
    "Doug Ford",
    "Mark Carney",
    "Danielle Smith",
    "Wab Kinew",
    "François Legault",
    "Mélanie Joly",
    "Dominic LeBlanc",
    "Donald Trump",
    "JD Vance",
    "Zohran Mamdani",
    "Spencer Cox",
    "Mike Leavitt",
    "Lisa Murkowski",
    "John Roberts"
  ];

  for (const article of articles) {
    const fullText = `${article.headline} ${article.content?.body || ''} ${article.content?.summary || ''} ${(article.content?.tags || []).join(' ')}`;
    const matchedPoliticians = [];

    for (const name of prominentPoliticians) {
      if (fullText.includes(name)) {
        const profile = await findPoliticianProfile(name, authHeaders);
        if (profile) {
          matchedPoliticians.push(profile);
        }
      }
    }

    if (matchedPoliticians.length > 0) {
      console.log(`\nArticle: "${article.headline.slice(0, 60)}..."`);
      console.log(`  Found ${matchedPoliticians.length} politician(s): ${matchedPoliticians.map(p => `${p.full_name} (${p.id})`).join(', ')}`);
      
      const politicianIds = matchedPoliticians.map(p => p.id);
      await syncArticlePoliticians(article.id, politicianIds, authHeaders);
    }
  }
}

run().catch(console.error);
