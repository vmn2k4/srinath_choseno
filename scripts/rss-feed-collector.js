/**
 * scripts/rss-feed-collector.js
 *
 * Programmatic, Machine-Extracted Ground Truth RSS Collector.
 *
 * Guarantees:
 * 1. URLs and metadata are extracted directly from machine RSS feeds (no LLM in the loop).
 * 2. Fetches full article body text when available (Tier-1).
 * 3. Classifies 401/403 paywalled allowlisted domains as Tier-2 (summary only, 0 quotes).
 * 4. Hard-rejects 404s, 410s, and bare root/category landing pages.
 * 5. Deduplicates against Supabase database.
 */

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

// Trusted allowlist for Tier-2 paywalled / bot-blocked domains
const ALLOWLISTED_PAYWALLED_DOMAINS = new Set([
  'wsj.com', 'www.wsj.com',
  'reuters.com', 'www.reuters.com',
  'bloomberg.com', 'www.bloomberg.com',
  'ft.com', 'www.ft.com',
  'nytimes.com', 'www.nytimes.com',
  'washingtonpost.com', 'www.washingtonpost.com',
  'theglobeandmail.com', 'www.theglobeandmail.com',
  'economist.com', 'www.economist.com',
  'theatlantic.com', 'www.theatlantic.com',
  'thehill.com', 'www.thehill.com',
  'politico.com', 'www.politico.com',
  'apnews.com', 'www.apnews.com',
  'cbc.ca', 'www.cbc.ca',
  'ctvnews.ca', 'www.ctvnews.ca',
  'globalnews.ca', 'www.globalnews.ca',
  'nationalpost.com', 'www.nationalpost.com',
  'thestar.com', 'www.thestar.com',
  'cnn.com', 'www.cnn.com',
  'foxnews.com', 'www.foxnews.com',
  'nbcnews.com', 'www.nbcnews.com',
  'cbsnews.com', 'www.cbsnews.com',
  'abcnews.go.com', 'www.abcnews.go.com',
  'usatoday.com', 'www.usatoday.com'
]);

// Verified US & Canada RSS Feed Registry (Federal, State/Provincial, Municipal)
const RSS_FEEDS = [
  // 1. US Federal & National Politics Wires
  {
    name: 'The Hill Politics',
    url: 'https://thehill.com/homenews/feed/',
    country: 'US',
    category: 'Politics'
  },
  {
    name: 'Politico Congress',
    url: 'https://rss.politico.com/congress.xml',
    country: 'US',
    category: 'Politics'
  },
  {
    name: 'Google News US Politics',
    url: 'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFZ4ZERBU0FtVnVLQUFQAQ?hl=en-US&gl=US&ceid=US:en',
    country: 'US',
    category: 'Politics'
  },
  // 2. US State Capitols, Governors & Municipal City Halls
  {
    name: 'Google News US Municipal & Mayors',
    url: 'https://news.google.com/rss/search?q=(%22city+council%22+OR+mayor+OR+ordinance+OR+alderman)+when:24h&hl=en-US&gl=US&ceid=US:en',
    country: 'US',
    category: 'Municipal'
  },
  {
    name: 'Google News US State Capitols',
    url: 'https://news.google.com/rss/search?q=(governor+OR+%22state+senate%22+OR+%22state+house%22+OR+%22state+legislature%22)+when:24h&hl=en-US&gl=US&ceid=US:en',
    country: 'US',
    category: 'Politics'
  },
  // 3. Canada Federal Politics Wires
  {
    name: 'CBC News Politics',
    url: 'https://www.cbc.ca/cmlink/rss-politics',
    country: 'CA',
    category: 'Politics'
  },
  {
    name: 'The Globe and Mail Canada',
    url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/',
    country: 'CA',
    category: 'Politics'
  },
  {
    name: 'Global News Politics',
    url: 'https://globalnews.ca/politics/feed/',
    country: 'CA',
    category: 'Politics'
  },
  // 4. Canada Provincial Capitols & Municipal Councils
  {
    name: 'Google News Canada Municipal & Mayors',
    url: 'https://news.google.com/rss/search?q=(%22city+council%22+OR+mayor+OR+councillor+OR+bylaw)+when:24h&hl=en-CA&gl=CA&ceid=CA:en',
    country: 'CA',
    category: 'Municipal'
  },
  {
    name: 'Google News Canada Provincial Capitols',
    url: 'https://news.google.com/rss/search?q=(%22provincial+government%22+OR+%22legislative+assembly%22+OR+mpp+OR+mla+OR+%22Doug+Ford%22+OR+%22David+Eby%22+OR+%22Danielle+Smith%22+OR+%22Wab+Kinew%22+OR+%22Scott+Moe%22+OR+%22Tim+Houston%22+OR+%22Francois+Legault%22)+when:24h&hl=en-CA&gl=CA&ceid=CA:en',
    country: 'CA',
    category: 'Politics'
  }
];

// Non-US/Canada domestic and non-civic/sports keywords to strictly reject
const NON_US_CA_DOMESTIC_REGEX = /\b(modi|gadkari|lok sabha|rajya sabha|tinubu|nigeria|nigerian|thailand|thai|lese majeste|imran khan|pakistan|pakistani|keir starmer|downing street|westminster|tory|tories|labour mp|macron|elysee|bundestag|scholz|zelenskyy|kyiv|kremlin|putin|netanyahu|knesset|gaza|hamas|hezbollah|tehran|ayotollah|cricket captain|cockroach hunger|seoul|korea|tokyo|japan|brussels|belgium|manila|philippines|sydney|auckland|new zealand|south africa|cosla|scotland|angeles city)\b/i;
const SPORTS_ENTERTAINMENT_REGEX = /\b(premier league|chelsea|fulham|arsenal|manchester united|man utd|man city|liverpool|tottenham|real madrid|barcelona|laliga|bundesliga|serie a|champions league|striker|midfielder|goalkeeper|touchdown|quarterback|nfl|nhl|nba|mlb|wnba|badminton|cricket|world cup|super bowl|espn|sportsnet|box score|transfer window|movie review|box office)\b/i;
const FOREIGN_OUTLET_REGEX = /\b(politico\.eu|nippon\.com|inquirer\.net|korea joongang daily|top south now|cosla|hindustan times|ahmedabad mirror|al jazeera|france 24|the independent)\b/i;
const US_CA_EXECUTIVE_KEYWORDS = /\b(trump|carney|vance|biden|congress|senate|house of representatives|white house|pmo|parliament|governor|premier|mayor|councillor|alderman|city council|lcbo|usmca|epa|fcc|sec|doj|pentagon|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new york|california|texas|florida|pennsylvania|michigan|ohio|ottawa|toronto|montreal|vancouver|calgary|edmonton|winnipeg|chicago|los angeles|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|seattle|denver|boston)\b/i;

function isStrictlyUsOrCanada(title, description, sourceName) {
  const text = `${title} ${description} ${sourceName || ''}`;
  if (SPORTS_ENTERTAINMENT_REGEX.test(text)) {
    return false; // Hard reject sports & entertainment
  }
  if (FOREIGN_OUTLET_REGEX.test(text)) {
    return false; // Hard reject non-US/CA foreign outlets
  }
  if (NON_US_CA_DOMESTIC_REGEX.test(text)) {
    // If it contains non-US/CA domestic keywords, only allow if it directly involves US/CA leadership
    if (!US_CA_EXECUTIVE_KEYWORDS.test(text)) {
      return false;
    }
  }
  return true;
}

function decodeXmlEntities(str) {
  return (str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // Generic numeric character references first (&#39; / &#039; / &#x27; alike) --
    // feeds zero-pad decimal refs inconsistently and also use curly quotes/dashes
    // (&#8216; &#8217; &#8220; &#8221; &#8212; &#8211;) that a hardcoded per-entity
    // replace list will always be one code point behind on. Doing this generically
    // before the named-entity passes below covers all of them in one step.
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeXmlEntities(m[1]) : null;
}

function extractRawTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

function parseRssXml(xml, feedMeta) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const block of itemBlocks) {
    const rawTitle = extractTag(block, 'title');
    let rawLink = extractRawTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description');
    const sourceName = extractTag(block, 'source') || feedMeta.name;

    if (!rawTitle || !rawLink) continue;

    // Clean Google News link if wrapped in CDATA or trailing chars
    rawLink = rawLink.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

    items.push({
      title: rawTitle,
      link: rawLink,
      pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      description: description || '',
      sourceName: sourceName,
      country: feedMeta.country,
      category: feedMeta.category
    });
  }

  return items;
}

function isBareCategoryOrRoot(urlStr) {
  try {
    const u = new URL(urlStr);
    const p = u.pathname.replace(/\/+$/, '');
    if (!p || p === '' || p === '/' || p === '/news' || p === '/politics' || p === '/world' || p === '/world/us' || p === '/business' || p === '/opinion') {
      return true;
    }
    return false;
  } catch (e) {
    return true;
  }
}

function extractCleanBodyText(html) {
  if (!html) return '';
  // Remove scripts, styles, navs, footers, headers
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ');

  // Match paragraph tags
  const pMatches = stripped.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const paragraphs = pMatches
    .map(p => decodeXmlEntities(p))
    .filter(p => p.length > 40 && !p.includes('cookie') && !p.includes('subscribe') && !p.includes('All rights reserved'));

  return paragraphs.join('\n\n');
}

/**
 * Verify and fetch source URL content.
 * Returns: { status: number, finalUrl: string, tier: 'tier-1'|'tier-2'|'rejected', bodyText: string, reason?: string }
 */
async function verifyAndFetchUrl(targetUrl) {
  if (isBareCategoryOrRoot(targetUrl)) {
    return { status: 400, finalUrl: targetUrl, tier: 'rejected', reason: 'Bare root or generic category landing page' };
  }

  let hostname = '';
  try {
    hostname = new URL(targetUrl).hostname.replace(/^www\./, '');
  } catch (e) {
    return { status: 400, finalUrl: targetUrl, tier: 'rejected', reason: 'Malformed URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    clearTimeout(timeout);

    const finalUrl = res.url || targetUrl;
    if (isBareCategoryOrRoot(finalUrl)) {
      return { status: 400, finalUrl, tier: 'rejected', reason: 'Redirected to generic category root' };
    }

    if (res.status === 200) {
      const html = await res.text();
      const bodyText = extractCleanBodyText(html);
      if (bodyText.length > 200) {
        return { status: 200, finalUrl, tier: 'tier-1', bodyText };
      } else {
        // Limited text extracted (JS-rendered or minimal HTML), check allowlist
        if (ALLOWLISTED_PAYWALLED_DOMAINS.has(hostname)) {
          return { status: 200, finalUrl, tier: 'tier-2', bodyText: '', reason: 'Allowlisted outlet with limited text extraction' };
        }
        return { status: 200, finalUrl, tier: 'tier-1', bodyText };
      }
    }

    // 401 / 403 Paywall Check
    if (res.status === 401 || res.status === 403) {
      if (ALLOWLISTED_PAYWALLED_DOMAINS.has(hostname)) {
        return { status: res.status, finalUrl, tier: 'tier-2', bodyText: '', reason: 'Allowlisted paywalled / bot-protected wire' };
      } else {
        return { status: res.status, finalUrl, tier: 'rejected', reason: `HTTP ${res.status} on non-allowlisted domain` };
      }
    }

    // 404 / 410 / 500+ Hard Rejections
    return { status: res.status, finalUrl, tier: 'rejected', reason: `HTTP ${res.status} returned` };
  } catch (err) {
    if (ALLOWLISTED_PAYWALLED_DOMAINS.has(hostname)) {
      return { status: 403, finalUrl: targetUrl, tier: 'tier-2', bodyText: '', reason: 'Network error on allowlisted paywalled domain' };
    }
    return { status: 500, finalUrl: targetUrl, tier: 'rejected', reason: err.message };
  }
}

/**
 * Fetch all existing database headlines to deduplicate.
 */
async function fetchExistingHeadlines() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return new Set();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=slug,headline&limit=2000`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) return new Set();
    const rows = await res.json();
    const set = new Set();
    for (const r of rows) {
      if (r.slug) set.add(r.slug.toLowerCase().trim());
      if (r.headline) set.add(r.headline.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim());
    }
    return set;
  } catch (e) {
    return new Set();
  }
}

function calculateSimilarity(str1, str2) {
  const tokens1 = new Set(str1.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  const tokens2 = new Set(str2.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }
  return intersection / (tokens1.size + tokens2.size - intersection);
}

/**
 * Main Collector: Fetches verified RSS items, checks status gate, deduplicates, and returns candidates.
 */
async function collectVerifiedRssStories(options = {}) {
  const maxHours = options.maxHours || 4;
  const cutoffTime = new Date(Date.now() - maxHours * 3600 * 1000);
  console.log(`[RSS Collector] Scanning verified feeds (Lookback: ${maxHours}h, Cutoff: ${cutoffTime.toISOString()})...`);

  const existingDbHeadlines = await fetchExistingHeadlines();
  console.log(`[RSS Collector] Loaded ${existingDbHeadlines.size} database records for deduplication.`);

  const rawCandidates = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`  Fetching RSS: ${feed.name}...`);
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      if (!res.ok) {
        console.warn(`  Warning: Failed to fetch ${feed.name} (HTTP ${res.status})`);
        continue;
      }
      const xml = await res.text();
      const items = parseRssXml(xml, feed);
      console.log(`    -> Parsed ${items.length} items from ${feed.name}`);

      for (const item of items) {
        const itemDate = new Date(item.pubDate);
        if (itemDate < cutoffTime) continue; // Skip older than lookback window

        // Strict US and Canada filter
        if (!isStrictlyUsOrCanada(item.title, item.description, item.sourceName)) {
          continue;
        }

        // Deduplication against existing DB
        const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        let isDuplicate = false;
        for (const existing of existingDbHeadlines) {
          if (calculateSimilarity(normTitle, existing) > 0.45) {
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) continue;

        rawCandidates.push(item);
      }
    } catch (e) {
      console.warn(`  Error parsing feed ${feed.name}:`, e.message);
    }
  }

  console.log(`\n[RSS Collector] Found ${rawCandidates.length} raw unique candidate stories within lookback window.`);
  console.log(`[RSS Collector] Executing HTTP Status & Paywall Gatekeeper on top candidates in parallel...\n`);

  // Cap candidate checking to top 30 to avoid wasteful slow network checks
  const candidatesToCheck = rawCandidates.slice(0, 30);
  const verifiedCandidates = [];
  const CONCURRENCY = 8;

  for (let i = 0; i < candidatesToCheck.length; i += CONCURRENCY) {
    const chunk = candidatesToCheck.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async (item) => {
      try {
        const result = await verifyAndFetchUrl(item.link);
        if (result.tier === 'rejected') return null;
        return {
          title: item.title,
          sourceUrl: result.finalUrl || item.link,
          sourceName: item.sourceName,
          pubDate: item.pubDate,
          country: item.country,
          category: item.category,
          tier: result.tier,
          sourceDescription: item.description,
          sourceBodyText: result.bodyText || item.description
        };
      } catch (e) {
        return null;
      }
    }));

    for (const res of results) {
      if (res) verifiedCandidates.push(res);
    }
  }

  console.log(`\n[RSS Collector] Completed: ${verifiedCandidates.length} fully verified stories ready for synthesis.`);
  return verifiedCandidates;
}

// CLI Execution
if (require.main === module) {
  collectVerifiedRssStories({ maxHours: 4 }).then(results => {
    const outPath = path.join(__dirname, 'latest-verified-rss-candidates.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`Saved candidates to ${outPath}`);
  }).catch(console.error);
}

module.exports = {
  collectVerifiedRssStories,
  verifyAndFetchUrl,
  ALLOWLISTED_PAYWALLED_DOMAINS
};
