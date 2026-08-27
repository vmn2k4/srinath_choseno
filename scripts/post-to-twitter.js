const fs = require('fs');
const path = require('path');
const { Scraper } = require('agent-twitter-client');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const COOKIES_PATH = path.join(__dirname, 'twitter-cookies.json');

/**
 * Initializes and logs in to the Twitter / X Scraper client.
 * Supports direct auth_token & ct0 cookies, cached cookies, or credentials.
 */
async function getAuthenticatedTwitterClient() {
  const scraper = new Scraper();

  // 1. Direct cookie variables from .env.local (Fastest & Most Reliable)
  const authToken = process.env.TWITTER_AUTH_TOKEN || env.TWITTER_AUTH_TOKEN;
  const ct0 = process.env.TWITTER_CT0 || env.TWITTER_CT0;

  if (authToken && ct0) {
    const cookieStrings = [
      `auth_token=${authToken}; Domain=.x.com; Path=/; Secure; HttpOnly`,
      `ct0=${ct0}; Domain=.x.com; Path=/; Secure`
    ];
    await scraper.setCookies(cookieStrings);
    const isLoggedIn = await scraper.isLoggedIn();
    if (isLoggedIn) {
      console.log('[Twitter] Authenticated successfully via .env.local auth cookies!');
      return scraper;
    }
  }

  // 2. Try loading existing cookies from cache file
  if (fs.existsSync(COOKIES_PATH)) {
    try {
      const cookieData = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      let cookieStrings = [];
      if (Array.isArray(cookieData)) {
        cookieStrings = cookieData;
      } else if (typeof cookieData === 'object') {
        // Support { auth_token: "...", ct0: "..." } format
        if (cookieData.auth_token && cookieData.ct0) {
          cookieStrings = [
            `auth_token=${cookieData.auth_token}; Domain=.x.com; Path=/; Secure; HttpOnly`,
            `ct0=${cookieData.ct0}; Domain=.x.com; Path=/; Secure`
          ];
        }
      }

      if (cookieStrings.length > 0) {
        await scraper.setCookies(cookieStrings);
        const isLoggedIn = await scraper.isLoggedIn();
        if (isLoggedIn) {
          console.log('[Twitter] Successfully restored session from twitter-cookies.json.');
          return scraper;
        }
      }
    } catch (e) {
      console.warn('[Twitter] Failed to restore cached cookies:', e.message);
    }
  }

  // 3. Fallback: credential login
  const username = process.env.TWITTER_USERNAME || env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD || env.TWITTER_PASSWORD;
  const email = process.env.TWITTER_EMAIL || env.TWITTER_EMAIL;
  const twoFactorSecret = process.env.TWITTER_2FA_SECRET || env.TWITTER_2FA_SECRET;

  if (username && password) {
    console.log(`[Twitter] Attempting login as @${username}...`);
    await scraper.login(username, password, email, twoFactorSecret);
    const isLoggedIn = await scraper.isLoggedIn();
    if (isLoggedIn) {
      console.log('✅ [Twitter] Login successful!');
      const cookies = await scraper.getCookies();
      const cookieStrings = cookies.map(c => typeof c === 'string' ? c : `${c.key}=${c.value}; Domain=${c.domain}; Path=${c.path}`);
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookieStrings, null, 2));
      return scraper;
    }
  }

  throw new Error('Twitter authentication missing. Please add TWITTER_AUTH_TOKEN and TWITTER_CT0 to .env.local or scripts/twitter-cookies.json');
}

/**
 * Formats a clean, high-engagement tweet for a Choseno news article.
 */
function formatArticleTweet(article) {
  let tweetText = article.content?.tweet || article.summary || article.headline;

  const articleUrl = `https://choseno.com/news/${article.slug}`;

  let politicianTag = '';
  if (article.politicians && article.politicians.length > 0) {
    const p = article.politicians[0];
    const wallSlug = p.slug || p.primaryWallSlug || p.wall_slug;
    if (wallSlug) {
      politicianTag = `\n\nWall: https://www.choseno.com/wall/${wallSlug}`;
    }
  }

  const maxTextLen = 270 - articleUrl.length - politicianTag.length;
  if (tweetText.length > maxTextLen) {
    tweetText = tweetText.slice(0, maxTextLen - 3) + '...';
  }

  return `${tweetText}\n\n${articleUrl}${politicianTag}`.trim();
}

/**
 * Posts an article or custom text to Twitter.
 */
async function postTweet(textOrArticle) {
  const scraper = await getAuthenticatedTwitterClient();

  let tweetContent = '';
  if (typeof textOrArticle === 'string') {
    tweetContent = textOrArticle;
  } else if (textOrArticle && typeof textOrArticle === 'object') {
    tweetContent = formatArticleTweet(textOrArticle);
  } else {
    throw new Error('Invalid tweet payload provided.');
  }

  console.log('\n[Twitter] Sending Tweet:');
  console.log('--------------------------------------------------');
  console.log(tweetContent);
  console.log('--------------------------------------------------');

  const res = await scraper.sendTweet(tweetContent);
  console.log('✅ [Twitter] Tweet successfully posted!\n');
  return res;
}

module.exports = {
  getAuthenticatedTwitterClient,
  formatArticleTweet,
  postTweet
};

if (require.main === module) {
  const testText = process.argv[2] || 'Choseno civic news feed live test on Twitter/X.';
  postTweet(testText).catch(err => {
    console.error('❌ [Twitter Error]:', err.message);
    process.exit(1);
  });
}
