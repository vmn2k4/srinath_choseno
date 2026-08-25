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
const SITE_URL = env.NEXT_PUBLIC_SITE_URL || 'https://www.choseno.com';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

function stripEmoji(str) {
  if (!str) return '';
  return str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '').replace(/  +/g, ' ').trim();
}

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
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: env.admin_un,
        password: env.admin_pwd
      })
    });
    if (authRes.ok) {
      const authData = await authRes.json();
      return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authData.access_token}`
      };
    }
  }

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };
}

async function main() {
  console.log('Authenticating with Supabase admin credentials...');
  const authHeaders = await getAuthHeaders();

  console.log('Fetching the 50 most recent articles to reformat tweet and tweetarticle...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,summary,province,country,category,content,news_article_politicians(politician_id, profiles(id, full_name, politician_profiles(wall_slug)))&order=created_at.desc&limit=50`, {
    headers: {
      apikey: authHeaders.apikey,
      Authorization: authHeaders.Authorization
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch articles:', await res.text());
    process.exit(1);
  }

  const articles = await res.json();
  console.log(`Found ${articles.length} articles. Updating now...`);

  let updatedCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    const content = art.content || {};
    const taggedPoliticians = (art.news_article_politicians || [])
      .map(p => p.profiles)
      .filter(Boolean);

    const primaryPolitician = taggedPoliticians[0];
    const wallSlug = primaryPolitician?.politician_profiles?.wall_slug || (primaryPolitician ? primaryPolitician.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : null);
    const jurisdiction = [art.province, art.country].filter(Boolean).join(', ') || 'National';
    const summaryText = art.summary || '';
    const shareUrl = `${SITE_URL}/news/${art.slug}`;
    const tags = (content.tags || []).map(t => '#' + t.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean).join(' ');

    const topReviewPrompt = primaryPolitician && wallSlug
      ? `Review ${primaryPolitician.full_name} on Choseno:\n${SITE_URL}/wall/${wallSlug}\n\n`
      : '';

    const bottomCtaSection = primaryPolitician && wallSlug
      ? `NOW YOU HAVE THE SAY — CHOSENO:\nChoseno is like Google Reviews for politicians. Don't just watch decisions happen from the sidelines — now you have the say. Review ${primaryPolitician.full_name}'s record, speak your mind, and let your fellow constituents know where you stand on their official public wall:\n${SITE_URL}/wall/${wallSlug}`
      : `CHOSENO — GOOGLE REVIEWS FOR DEMOCRACY & POLICY:\nChoseno is like Google Reviews for democracy. Review public decisions, track government accountability, and share your rating on Choseno:\n${shareUrl}`;

    const newTweetArticle = `${art.headline}\n\n${topReviewPrompt}WHAT CHANGED & TAXPAYER IMPACT:\n- Overview: ${summaryText}\n- Policy Details: Full legislative analysis, budget line-items, and vote counts available on Choseno.\n\nTHE DEBATE:\n- Civic Context: Review community perspectives, stakeholder reactions, and policy trade-offs.\n- Transparency: Track implementation milestones and accountability records.\n\n${bottomCtaSection}\n\nRead the full investigative report on Choseno:\n${shareUrl}\n\n${tags} #Choseno`;

    const cleanedTweetArticle = stripEmoji(newTweetArticle);
    const cleanedTweet = stripEmoji(content.tweet || `${art.headline} — Track democracy and rate officials on Choseno.`);

    const newContent = {
      ...content,
      tweet: cleanedTweet,
      tweetarticle: cleanedTweetArticle
    };

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
      method: 'PATCH',
      headers: {
        apikey: authHeaders.apikey,
        Authorization: authHeaders.Authorization,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ content: newContent })
    });

    if (updateRes.ok) {
      console.log(`[${i+1}/${articles.length}] Updated: ${art.slug}`);
      updatedCount++;
    } else {
      console.error(`Failed to update ${art.slug}:`, await updateRes.text());
    }
  }

  console.log(`\n🎉 Successfully reformatted and saved ${updatedCount} articles to the database!`);
}

main();
