/**
 * Helper to determine the exact lookback window between the most recent
 * published news article in Supabase and the current timestamp.
 *
 * Usage:
 *   node scripts/get-last-publish-window.js
 *   node scripts/get-last-publish-window.js --json
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found at', envPath);
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

async function run() {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,published_at,event_date&order=published_at.desc.nullslast&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch latest article:', await res.text());
    process.exit(1);
  }

  const [latest] = await res.json();
  const now = new Date();
  const lastPublishedAt = latest?.published_at ? new Date(latest.published_at) : new Date(now.getTime() - 24 * 3600 * 1000);
  
  const diffMs = now.getTime() - lastPublishedAt.getTime();
  const diffHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

  const result = {
    lastPublishedAt: lastPublishedAt.toISOString(),
    currentTime: now.toISOString(),
    lookbackHours: diffHours,
    latestArticle: {
      id: latest?.id,
      slug: latest?.slug,
      headline: latest?.headline
    },
    recommendedTrendingCmd: `node scripts/fetch-trending-topics.js --max-hours ${diffHours}`,
    searchQueryTimeFilter: diffHours <= 2 ? `past ${diffHours} hours OR today ${now.toISOString().split('T')[0]}` : `past ${diffHours} hours`
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('=== CHOSENO DYNAMIC LOOKBACK WINDOW ===');
    console.log(`Last Published:    ${result.lastPublishedAt} ("${result.latestArticle.headline?.slice(0, 55)}...")`);
    console.log(`Current Time:      ${result.currentTime}`);
    console.log(`Lookback Duration: ${result.lookbackHours} hour(s)`);
    console.log(`Trending Command:  ${result.recommendedTrendingCmd}`);
    console.log(`Search Query Tag:  [Time Window: ${result.lastPublishedAt} to ${result.currentTime}]`);
    console.log('=======================================');
  }
}

run().catch(console.error);
