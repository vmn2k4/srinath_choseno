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

async function check() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=slug,headline,content,created_at&order=created_at.desc&limit=25`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  const data = await res.json();
  console.log(`Fetched ${data.length} latest articles from Supabase.\n`);

  data.forEach((art, idx) => {
    console.log(`=== [${idx + 1}] ${art.headline} ===`);
    console.log(`Created At: ${art.created_at}`);
    console.log(`--- SHORT TWEET ---`);
    console.log(art.content?.tweet || 'N/A');
    console.log(`--- TWEETARTICLE (FIRST 250 CHARS & LAST 250 CHARS) ---`);
    const ta = art.content?.tweetarticle || 'N/A';
    console.log(ta.slice(0, 200) + '...\n[...]\n...' + ta.slice(-200));
    console.log('\n------------------------------------------------------------\n');
  });
}

check().catch(console.error);
