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

async function checkDeputyPM() {
  const query = encodeURIComponent('%Deputy Prime Minister%');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?body=ilike.${query}&select=id,slug,headline,content`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  const rows = await res.json();
  console.log('Matching Deputy Prime Minister articles in database:', rows ? rows.length : 0);
  if (rows && rows.length > 0) {
    for (const r of rows) {
      console.log(`- Deleting [${r.id}] ${r.headline} (slug: ${r.slug})`);
      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${r.id}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=representation'
        }
      });
      console.log('  Delete status:', delRes.status);
    }
  }
}

checkDeputyPM().catch(console.error);
