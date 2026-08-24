const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

async function main() {
  // 1. Auth token
  const authRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: env.admin_un,
      password: env.admin_pwd
    })
  });
  const authData = await authRes.json();
  const token = authData.access_token;

  // 2. Fetch all politician profiles
  const profRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,full_name&role=eq.politician`, {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  const profiles = await profRes.json();
  console.log(`Loaded ${profiles.length} active politician profiles from Supabase.`);

  // 3. Fetch all articles published in the last 48 hours
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  console.log(`Querying articles published since: ${twoDaysAgo}...`);
  
  const artRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,content,published_at&published_at=gte.${encodeURIComponent(twoDaysAgo)}&order=published_at.desc&limit=1000`, {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  const articles = await artRes.json();
  console.log(`Analyzing ${articles.length} articles published in the last 2 days for politician wall mapping...`);

  let syncedCount = 0;
  for (const art of articles) {
    const headline = art.headline || '';
    const body = art.content?.body || '';
    const tags = art.content?.tags || [];
    const textToMatch = `${headline}\n${tags.join(' ')}\n${body}`;

    const matchedPoliticianIds = [];
    const matchedNames = [];

    for (const prof of profiles) {
      if (!prof.full_name || prof.full_name.trim().length < 4) continue;
      const name = prof.full_name.trim();
      
      // Use regex word boundary check to avoid substring false positives
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');

      if (nameRegex.test(textToMatch)) {
        matchedPoliticianIds.push(prof.id);
        matchedNames.push(name);
      }
    }

    if (matchedPoliticianIds.length > 0) {
      const syncUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_tags`;
      const syncRes = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_article_id: art.id,
          p_politician_ids: matchedPoliticianIds
        })
      });
      if (syncRes.ok) {
        // Reset hero_image_url to null so the OpenGraph card regenerates with the official politician badge & photo
        await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
          method: 'PATCH',
          headers: {
            apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ hero_image_url: null })
        });

        console.log(`✅ [SYNCED & REFRESHED CARD] "${art.headline}" -> ${matchedNames.join(', ')}`);
        syncedCount++;
      } else {
        console.warn(`❌ [FAILED] "${art.headline}":`, await syncRes.text());
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`SUCCESS: Synchronized ${syncedCount} articles to official politician profiles from the past 2 days!`);
  console.log(`======================================================\n`);

  console.log(`\nAll done! Successfully backfilled and synchronized ${syncedCount} articles to their official politician walls.`);
}

main().catch(console.error);
