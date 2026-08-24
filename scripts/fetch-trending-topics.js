/**
 * Hourly Trending Topics & Breaking Political News Fetcher -> CSV.
 *
 * Equipped with:
 *   1. Timestamp Filtering (--past-hour or --max-hours N): Filters news feeds to stories published within the last hour.
 *   2. State / Delta Cache (scripts/trending-history-cache.json): Detects topics that BRAND-NEW emerged or surged in the past hour.
 *   3. Free Real-time Sources:
 *      - Google Trends Real-Time RSS (CA & US search surges)
 *      - Google News Real-Time Politics (CA & US)
 *      - Google News National Breaking (CA & US)
 *      - CBC Politics / National Wire RSS
 *
 * Usage:
 *   node scripts/fetch-trending-topics.js                     # All current live trends & top news
 *   node scripts/fetch-trending-topics.js --past-hour          # ONLY topics that started trending/broke in past 1 hour
 *   node scripts/fetch-trending-topics.js --max-hours 2        # Topics from past 2 hours
 *   node scripts/fetch-trending-topics.js --new-only           # ONLY brand-new topics never seen in earlier runs
 *
 * Output:
 *   scripts/latest-trending-topics.csv
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_GEOS = 'CA,US';
const CACHE_FILE = path.join(__dirname, 'trending-history-cache.json');
const CSV_HEADERS = [
  'source',
  'geo_or_category',
  'trend_status',
  'rank',
  'title',
  'metric',
  'pub_age_minutes',
  'published_at',
  'related_context',
  'url',
  'fetched_at'
];

// Parse CLI Arguments
const args = process.argv.slice(2);
let maxHours = null;
let newOnly = false;
let customOutputPath = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--past-hour' || arg === '-1h') {
    maxHours = 1;
  } else if (arg === '--max-hours' && args[i + 1]) {
    maxHours = parseFloat(args[++i]);
  } else if (arg === '--new-only') {
    newOnly = true;
  } else if (!arg.startsWith('--') && !customOutputPath) {
    customOutputPath = arg;
  }
}

// If --past-hour is set, default newOnly to true unless specified
if (maxHours === 1 && !args.includes('--all')) {
  newOnly = true;
}

// ── Cache Management ──────────────────────────────────────────────────────

function loadHistoryCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (e) {
      console.warn('Failed to parse cache, starting fresh:', e.message);
    }
  }
  return { topics: {}, lastRun: null };
}

function saveHistoryCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to save cache:', e.message);
  }
}

function normalizeKey(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, ' ');
}

// ── XML Parsing ───────────────────────────────────────────────────────────

function decodeXmlEntities(str) {
  return (str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeXmlEntities(m[1]) : null;
}

function extractAllTags(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(decodeXmlEntities(m[1]));
  return out;
}

// ── Google Trends ─────────────────────────────────────────────────────────

function parseGoogleTrendsRss(xml) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, 'title') || '(untitled)',
    approxTraffic: extractTag(block, 'ht:approx_traffic') || '',
    pubDate: extractTag(block, 'pubDate') || '',
    relatedNews: extractAllTags(block, 'ht:news_item_title'),
  }));
}

async function fetchGoogleTrends(geo, fetchedAt) {
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseGoogleTrendsRss(xml).map((item, i) => ({
    source: 'google_trends',
    geoOrCategory: geo,
    rank: i + 1,
    title: item.title,
    metric: item.approxTraffic ? `${item.approxTraffic} searches` : 'Trending Search',
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : fetchedAt,
    relatedContext: item.relatedNews.join('; '),
    url: `https://www.google.com/search?q=${encodeURIComponent(item.title)}`,
    fetchedAt,
  }));
}

// ── Google News & Wire Feeds ──────────────────────────────────────────────

function parseRssItems(xml) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, 'title') || '(untitled)',
    link: extractTag(block, 'link') || '',
    pubDate: extractTag(block, 'pubDate') || '',
    source: extractTag(block, 'source') || '',
  }));
}

async function fetchRssFeed(sourceName, topicUrl, categoryName, fetchedAt, limit = 25) {
  const res = await fetch(topicUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseRssItems(xml).slice(0, limit);
  return items.map((item, i) => ({
    source: sourceName,
    geoOrCategory: categoryName,
    rank: i + 1,
    title: item.title,
    metric: item.source ? `Source: ${item.source}` : 'Ranked Top Story',
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
    relatedContext: item.pubDate ? `Published: ${item.pubDate}` : '',
    url: item.link || topicUrl,
    fetchedAt,
  }));
}

// ── CSV Helpers ───────────────────────────────────────────────────────────

function csvEscape(value) {
  const str = String(value == null ? '' : value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.source,
        r.geoOrCategory,
        r.trendStatus,
        r.rank,
        r.title,
        r.metric,
        r.pubAgeMinutes != null ? `${r.pubAgeMinutes}m` : 'N/A',
        r.publishedAt || '',
        r.relatedContext,
        r.url,
        r.fetchedAt
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}

// ── Main Execution ────────────────────────────────────────────────────────

async function main() {
  const now = new Date();
  const fetchedAt = now.toISOString();
  const historyCache = loadHistoryCache();

  console.log(`\n======================================================`);
  console.log(`  CHOSENO TRENDING & TOP NEWS INGESTION`);
  console.log(`  Time: ${fetchedAt}`);
  if (maxHours != null) console.log(`  Filter Mode: ONLY topics within past ${maxHours} hour(s)`);
  if (newOnly) console.log(`  Delta Mode: ONLY brand-new emerging topics not seen before`);
  console.log(`======================================================\n`);

  const geos = (process.env.TRENDS_GEOS || DEFAULT_GEOS).split(',').map((s) => s.trim()).filter(Boolean);
  const rawItems = [];

  // 1. Fetch Google Trends
  for (const geo of geos) {
    try {
      const rows = await fetchGoogleTrends(geo, fetchedAt);
      console.log(`[Google Trends] (${geo}): Received ${rows.length} live trend queries`);
      rawItems.push(...rows);
    } catch (err) {
      console.warn(`[Google Trends] (${geo}) failed: ${err.message}`);
    }
  }

  // 2. Fetch Google News Top Feeds (Equally split between USA & Canada)
  const newsFeeds = [
    // --- UNITED STATES (National, Federal/DC, & State Regions) ---
    { name: 'US (National Politics)', url: 'https://news.google.com/rss/headlines/section/topic/POLITICS?hl=en-US&gl=US&ceid=US:en' },
    { name: 'US (Top News)', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en' },
    { name: 'US (Washington DC / Federal)', url: 'https://news.google.com/rss/search?q=Washington+DC+OR+Congress+OR+White+House+when:6h&hl=en-US&gl=US&ceid=US:en' },
    { name: 'US (State Legislatures & Governors)', url: 'https://news.google.com/rss/search?q=Governor+OR+%22State+Legislature%22+OR+%22City+Council%22+when:6h&hl=en-US&gl=US&ceid=US:en' },

    // --- CANADA (National, Federal/Ottawa, & Provincial) ---
    { name: 'CA (National Politics)', url: 'https://news.google.com/rss/headlines/section/topic/POLITICS?hl=en-CA&gl=CA&ceid=CA:en' },
    { name: 'CA (Top News)', url: 'https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en' },
    { name: 'CA (Ottawa / Federal Parliament)', url: 'https://news.google.com/rss/search?q=Ottawa+OR+Parliament+OR+%22House+of+Commons%22+when:6h&hl=en-CA&gl=CA&ceid=CA:en' },
    { name: 'CA (Provincial Premiers & Legislatures)', url: 'https://news.google.com/rss/search?q=Premier+OR+%22Provincial+Government%22+OR+%22Legislative+Assembly%22+when:6h&hl=en-CA&gl=CA&ceid=CA:en' }
  ];

  for (const feed of newsFeeds) {
    try {
      const rows = await fetchRssFeed('google_news', feed.url, feed.name, fetchedAt, 20);
      console.log(`[Google News] (${feed.name}): Received ${rows.length} top stories`);
      rawItems.push(...rows);
    } catch (err) {
      console.warn(`[Google News] (${feed.name}) failed: ${err.message}`);
    }
  }

  // 3. Fetch Wire Feeds (US & CA)
  try {
    const cbcRows = await fetchRssFeed('cbc_politics', 'https://www.cbc.ca/cmlink/rss-politics', 'CA (CBC Politics)', fetchedAt, 20);
    console.log(`[CBC Politics]: Received ${cbcRows.length} wire stories`);
    rawItems.push(...cbcRows);
  } catch (err) {
    console.warn(`[CBC Politics] failed: ${err.message}`);
  }

  // ── Delta & Hourly Age Screening ──────────────────────────────────────────

  const filteredRows = [];
  const oneHourMs = 60 * 60 * 1000;
  const maxAgeMs = maxHours ? maxHours * oneHourMs : null;

  for (const item of rawItems) {
    const key = normalizeKey(item.title);
    const existingCacheEntry = historyCache.topics[key];

    // Calculate age in minutes if published date exists
    let pubAgeMinutes = null;
    if (item.publishedAt) {
      const pubTime = new Date(item.publishedAt).getTime();
      if (!isNaN(pubTime)) {
        pubAgeMinutes = Math.max(0, Math.round((now.getTime() - pubTime) / (60 * 1000)));
      }
    }

    // Determine status (NEW, BREAKING, SURGING, ACTIVE)
    let isBrandNew = !existingCacheEntry;
    let status = 'ACTIVE';

    if (isBrandNew) {
      status = 'NEW_PAST_HOUR';
      historyCache.topics[key] = {
        firstSeen: fetchedAt,
        source: item.source,
        title: item.title
      };
    } else {
      const firstSeenTime = new Date(existingCacheEntry.firstSeen).getTime();
      const ageSinceFirstSeenHours = (now.getTime() - firstSeenTime) / oneHourMs;
      if (ageSinceFirstSeenHours <= 1) {
        status = 'NEW_PAST_HOUR';
      } else if (pubAgeMinutes != null && pubAgeMinutes <= 60) {
        status = 'BREAKING_PAST_HOUR';
      } else {
        status = 'SURGING';
      }
    }

    // Apply Filter: If --past-hour / --max-hours is active
    if (maxAgeMs != null) {
      const isWithinPubWindow = pubAgeMinutes != null && pubAgeMinutes <= maxHours * 60;
      const isNewInCache = status === 'NEW_PAST_HOUR';

      if (!isWithinPubWindow && !isNewInCache) {
        continue; // Skip older topic
      }
    }

    // Apply Filter: If --new-only is active
    if (newOnly && status !== 'NEW_PAST_HOUR' && (pubAgeMinutes == null || pubAgeMinutes > 60)) {
      continue;
    }

    item.trendStatus = status;
    item.pubAgeMinutes = pubAgeMinutes;
    filteredRows.push(item);
  }

  // Update Cache Last Run Timestamp and prune entries older than 48 hours
  historyCache.lastRun = fetchedAt;
  const pruneThreshold = now.getTime() - 48 * oneHourMs;
  for (const [k, v] of Object.entries(historyCache.topics)) {
    if (new Date(v.firstSeen).getTime() < pruneThreshold) {
      delete historyCache.topics[k];
    }
  }
  saveHistoryCache(historyCache);

  // ── Write CSV Output ──────────────────────────────────────────────────────

  const outputPath = customOutputPath || path.join(__dirname, 'latest-trending-topics.csv');
  fs.writeFileSync(outputPath, rowsToCsv(filteredRows), 'utf-8');

  console.log(`\n======================================================`);
  console.log(`  OUTPUT SAVED: ${outputPath}`);
  console.log(`  Filtered Results (Past Hour / New): ${filteredRows.length} topics`);
  console.log(`  Total Active Cached Topics: ${Object.keys(historyCache.topics).length}`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
