const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !API_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const headers = {
  apikey: API_KEY,
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal'
};

async function fixArticleWallLinks() {
  console.log('Fetching articles to check for non-existent politician walls in tweetarticle...');
  
  // 1. Fetch recent articles
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,content,news_article_politicians(politician_id)&order=created_at.desc&limit=100`, {
    headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` }
  });

  if (!res.ok) {
    console.error('Error fetching articles:', await res.text());
    return;
  }

  const articles = await res.json();
  let fixedCount = 0;

  for (const art of articles) {
    const content = art.content || {};
    const tweetarticle = content.tweetarticle;
    if (!tweetarticle) continue;

    const taggedPoliticians = art.news_article_politicians || [];
    
    // If no politicians are linked to this article, ensure no /wall/ URL exists in tweetarticle
    if (taggedPoliticians.length === 0 && tweetarticle.includes('/wall/')) {
      console.log(`Fixing article without politician tags: "${art.headline}" (${art.slug})`);
      
      const cleanedTweetArticle = tweetarticle
        .replace(/.*https?:\/\/[^\s]*\/wall\/[^\s\n]*.*/gi, '')
        .replace(/View [^\n]+ on Choseno:\s*/gi, '')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

      const updatedContent = {
        ...content,
        tweetarticle: cleanedTweetArticle
      };

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ content: updatedContent })
      });

      if (!updateRes.ok) {
        console.error(`Failed to update ${art.slug}:`, await updateRes.text());
      } else {
        console.log(`  -> Cleaned tweetarticle in DB for: ${art.slug}`);
        fixedCount++;
      }
    }
  }

  console.log(`\nScan complete! Cleaned ${fixedCount} articles with invalid wall links.`);
}

fixArticleWallLinks();
