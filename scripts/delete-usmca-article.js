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
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

const slugToDelete = 'canada-launches-formal-usmca-dispute-over-us-softwood-lumber-and-steel-tariffs-2026-08-25';

async function deleteArticle() {
  console.log(`Checking article: ${slugToDelete}...`);

  // First select to find id
  const sel = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?slug=eq.${slugToDelete}&select=id,slug,headline`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`
    }
  });

  const rows = await sel.json();
  console.log('Selected rows:', rows);

  if (rows && rows.length > 0) {
    const id = rows[0].id;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation'
      }
    });
    console.log('Delete status:', res.status, await res.text());
  }

  // Also remove from batch-ranked-news.csv
  const csvPath = path.resolve(__dirname, '..', 'batch-ranked-news.csv');
  if (fs.existsSync(csvPath)) {
    const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
    const filtered = lines.filter(line => !line.includes(slugToDelete));
    fs.writeFileSync(csvPath, filtered.join('\n'));
    console.log(`Updated batch-ranked-news.csv. Total rows: ${filtered.length}`);
  }
}

deleteArticle().catch(console.error);
