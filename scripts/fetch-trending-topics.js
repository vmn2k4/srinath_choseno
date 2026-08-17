/**
 * Free trending-topics & top political news fetcher -> CSV. No AI, no Supabase, no auth required.
 *
 * Pulls what's currently trending and top political headlines from reliable, free RSS endpoints:
 *   - Google Trends RSS (per-geo daily trending searches + related news headlines)
 *   - Google News Politics & Top Stories (Canada & US real-time ranked news)
 *   - CBC Politics / National Wire RSS (Canada breaking political affairs)
 * and writes a single combined CSV for ingestion and AI article generation.
 *
 * Usage:
 *   node scripts/fetch-trending-topics.js [outputPath]
 *
 * Config (optional env vars, comma-separated):
 *   TRENDS_GEOS       Google Trends geo codes.      Default: CA,US
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_GEOS = 'CA,US';
const CSV_HEADERS = ['source', 'geo_or_category', 'rank', 'title', 'metric', 'related_context', 'url', 'fetched_at'];

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

// ── 1. Google Trends RSS ──────────────────────────────────────────────────

function parseGoogleTrendsRss(xml) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, 'title') || '(untitled)',
    approxTraffic: extractTag(block, 'ht:approx_traffic') || '',
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
    relatedContext: item.relatedNews.join('; '),
    url: `https://www.google.com/search?q=${encodeURIComponent(item.title)}`,
    fetchedAt,
  }));
}

// ── 2. Google News Politics & Top Stories ─────────────────────────────────

function parseGoogleNewsRss(xml) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, 'title') || '(untitled)',
    link: extractTag(block, 'link') || '',
    pubDate: extractTag(block, 'pubDate') || '',
    source: extractTag(block, 'source') || '',
  }));
}

async function fetchGoogleNews(topicUrl, categoryName, fetchedAt, limit = 20) {
  const res = await fetch(topicUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseGoogleNewsRss(xml).slice(0, limit);
  return items.map((item, i) => ({
    source: 'google_news',
    geoOrCategory: categoryName,
    rank: i + 1,
    title: item.title,
    metric: item.source ? `Source: ${item.source}` : 'Ranked Top Story',
    relatedContext: item.pubDate ? `Published: ${item.pubDate}` : '',
    url: item.link || `https://news.google.com`,
    fetchedAt,
  }));
}

// ── 3. CBC Politics RSS ───────────────────────────────────────────────────

async function fetchCbcPolitics(fetchedAt, limit = 15) {
  const res = await fetch('https://www.cbc.ca/cmlink/rss-politics', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseGoogleNewsRss(xml).slice(0, limit);
  return items.map((item, i) => ({
    source: 'cbc_politics',
    geoOrCategory: 'CA (Politics)',
    rank: i + 1,
    title: item.title,
    metric: 'CBC News Wire',
    relatedContext: item.pubDate ? `Published: ${item.pubDate}` : '',
    url: item.link,
    fetchedAt,
  }));
}

// ── CSV Helper ────────────────────────────────────────────────────────────

function csvEscape(value) {
  const str = String(value == null ? '' : value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [r.source, r.geoOrCategory, r.rank, r.title, r.metric, r.relatedContext, r.url, r.fetchedAt]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}

// ── Main Execution ────────────────────────────────────────────────────────

async function main() {
  const fetchedAt = new Date().toISOString();
  const geos = (process.env.TRENDS_GEOS || DEFAULT_GEOS).split(',').map((s) => s.trim()).filter(Boolean);

  const allRows = [];

  // 1. Fetch Google Trends for specified geos
  for (const geo of geos) {
    try {
      const rows = await fetchGoogleTrends(geo, fetchedAt);
      console.log(`[Google Trends] (${geo}): Fetched ${rows.length} trending search queries`);
      allRows.push(...rows);
    } catch (err) {
      console.warn(`[Google Trends] (${geo}) failed: ${err.message}`);
    }
  }

  // 2. Fetch Google News Top Political Stories (Canada & US)
  const newsFeeds = [
    {
      name: 'CA (Politics)',
      url: 'https://news.google.com/rss/headlines/section/topic/POLITICS?hl=en-CA&gl=CA&ceid=CA:en'
    },
    {
      name: 'US (Politics)',
      url: 'https://news.google.com/rss/headlines/section/topic/POLITICS?hl=en-US&gl=US&ceid=US:en'
    },
    {
      name: 'CA (Top News)',
      url: 'https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en'
    },
    {
      name: 'US (Top News)',
      url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
    }
  ];

  for (const feed of newsFeeds) {
    try {
      const rows = await fetchGoogleNews(feed.url, feed.name, fetchedAt, 15);
      console.log(`[Google News] (${feed.name}): Fetched ${rows.length} top ranked stories`);
      allRows.push(...rows);
    } catch (err) {
      console.warn(`[Google News] (${feed.name}) failed: ${err.message}`);
    }
  }

  // 3. Fetch CBC Politics Wire
  try {
    const cbcRows = await fetchCbcPolitics(fetchedAt, 15);
    console.log(`[CBC Politics]: Fetched ${cbcRows.length} wire stories`);
    allRows.push(...cbcRows);
  } catch (err) {
    console.warn(`[CBC Politics] failed: ${err.message}`);
  }

  const outputPath = process.argv[2] || path.join(__dirname, 'latest-trending-topics.csv');
  fs.writeFileSync(outputPath, rowsToCsv(allRows), 'utf-8');
  console.log(`\n======================================================`);
  console.log(`Successfully generated: ${outputPath}`);
  console.log(`Total live trends & top political stories: ${allRows.length}`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
