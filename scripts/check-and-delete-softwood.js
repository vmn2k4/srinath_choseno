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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?headline=ilike.*softwood*&select=id,slug,headline,content`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  const rows = await res.json();
  console.log('Matching softwood articles in database:', rows.length);
  for (const r of rows) {
    console.log(`- [${r.id}] ${r.headline} (slug: ${r.slug})`);
    // Delete if found
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

check().catch(console.error);
