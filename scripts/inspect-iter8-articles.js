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

const batch = JSON.parse(fs.readFileSync('scripts/overflow-news-batch.json', 'utf8'));

async function inspect() {
  console.log(`Inspecting ${batch.length} newly ingested articles...\n`);

  for (let i = 0; i < batch.length; i++) {
    const slug = batch[i].slug;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?slug=eq.${slug}&select=slug,headline,content,category,country,province,created_at`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    const rows = await res.json();
    if (rows && rows.length > 0) {
      const art = rows[0];
      console.log(`[${i + 1}] [${art.country}/${art.province}] [${art.category}] ${art.headline}`);
      console.log(`    URL: https://choseno.com/news/${art.slug}`);
      console.log(`    Tagged: ${art.content?.taggedPoliticians?.join(', ') || 'None (Agency/Legal)'}`);
      console.log(`    Tweet: ${art.content?.tweet}`);
      console.log('');
    } else {
      console.log(`[${i + 1}] NOT FOUND IN DB: ${slug}`);
    }
  }
}

inspect().catch(console.error);
