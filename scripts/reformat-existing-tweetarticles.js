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
const SITE_URL = env.NEXT_PUBLIC_SITE_URL || 'https://www.choseno.com';

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

function stripEmoji(str) {
  if (!str) return '';
  return str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '').replace(/  +/g, ' ').trim();
}

async function reformatAllTweetArticles() {
  console.log('Fetching recent articles to reformat tweet and tweetarticle (no emojis + Google Reviews hook)...');
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,summary,province,country,category,content,news_article_politicians(politician_id, profiles(id, full_name, politician_profiles(wall_slug)))&order=created_at.desc&limit=100`, {
    headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` }
  });

  if (!res.ok) {
    console.error('Error fetching articles:', await res.text());
    return;
  }

  const articles = await res.json();
  let updatedCount = 0;

  for (const art of articles) {
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

    let politicianReviewSection = '';
    if (primaryPolitician && wallSlug) {
      const wallUrl = `${SITE_URL}/wall/${wallSlug}`;
      politicianReviewSection = `CHOSENO — GOOGLE REVIEWS FOR POLITICIANS:\nChoseno is like Google Reviews for politicians. Hold your elected officials accountable — review ${primaryPolitician.full_name}'s decisions, track their voting record, and share your rating on their public wall:\n${wallUrl}`;
    } else {
      politicianReviewSection = `CHOSENO — GOOGLE REVIEWS FOR DEMOCRACY & POLICY:\nChoseno is like Google Reviews for democracy. Review public decisions, track government accountability, and share your rating on Choseno:\n${shareUrl}`;
    }

    const rawTweetArticle = `${art.headline}\n\nTHE DECISION & TAXPAYER STAKES:\n- Jurisdiction: ${jurisdiction}\n${primaryPolitician ? `- Official Involved: ${primaryPolitician.full_name}\n` : ''}- Overview: ${summaryText}\n\nTHE DEBATE:\n- Civic Context: Review full policy mechanics, legislative vote tallies, and community debate.\n- Transparency: Track multi-year budget line-items and statutory milestones.\n\n${politicianReviewSection}\n\nRead the full report on Choseno:\n${shareUrl}\n\n${tags} #Choseno`;

    const cleanedTweetArticle = stripEmoji(rawTweetArticle);
    const cleanedTweet = stripEmoji(content.tweet || `${art.headline} — Track democracy and rate officials on Choseno.`);

    const updatedContent = {
      ...content,
      tweet: cleanedTweet,
      tweetarticle: cleanedTweetArticle
    };

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ content: updatedContent })
    });

    if (updateRes.ok) {
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully reformatted ${updatedCount} articles to the captivating emoji-free Google Reviews standard!`);
}

reformatAllTweetArticles();
