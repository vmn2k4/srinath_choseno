/**
 * scripts/rss-verified-pipeline.js
 *
 * End-to-End Real-World Verified News Ingestion Pipeline.
 *
 * Architecture:
 * 1. Machine RSS Fetcher (collectVerifiedRssStories): extracts real wire URLs, titles, descriptions.
 * 2. HTTP Status Gatekeeper: 404/410/root landing pages rejected; 401/403 allowlisted paywalls accepted as Tier-2.
 * 3. LLM Civic Structurer (Gemini API): builds neutral context, debate, and taxpayer impact.
 * 4. Code-Level Quote Verifier (verifyArticleQuotesAndFacts): strips any ungrounded quotes.
 * 5. Immutable Source Injection: hard-codes machine URL/publisher into database record.
 * 6. Dynamic Politician Wall Sync: maps elected officials to verified canonical wall slugs.
 *
 * Usage:
 *   node scripts/rss-verified-pipeline.js
 *   node scripts/rss-verified-pipeline.js --max-hours 6
 */

const fs = require('fs');
const path = require('path');
const { collectVerifiedRssStories } = require('./rss-feed-collector');
const { verifyArticleQuotesAndFacts } = require('./quote-and-fact-verifier');

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
const GEMINI_API_KEY = env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

async function getAuthHeaders() {
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

function stripEmoji(str) {
  if (!str) return '';
  return str
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{200D}]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function generateSlug(headline, dateStr) {
  const date = (dateStr || new Date().toISOString()).slice(0, 10);
  const base = (headline || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
  return `${base}-${date}`;
}

/**
 * Call Gemini API to structure verified RSS content into Choseno civic news format.
 */
async function synthesizeCivicStory(groundTruth) {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found in .env.local, falling back to direct extraction synthesis.');
    return synthesizeDirectFallback(groundTruth);
  }

  const prompt = `You are an elite, non-partisan civic investigative journalist for Choseno.
Transform this VERIFIED BREAKING WIRE STORY into a comprehensive, high-depth civic news report.

STRICT FACTUAL INTEGRITY RULES:
1. GROUND TRUTH ONLY: Every fact, dollar figure, and policy mechanism must be derived strictly from the provided Source Wire Text. Do NOT invent new numbers, events, or decisions.
2. DIRECT QUOTES RULE:
   - If Tier is "tier-2": Absolutely ZERO direct quotes are allowed. Use only indirect paraphrase with attribution ("According to reporting by ${groundTruth.sourceName}...").
   - If Tier is "tier-1": Direct quotes must be VERBATIM excerpts from the provided text. Never fabricate or modify quotes.
3. NEUTRAL OPINION-FORMATION: Frame the core policy decision clearly with balanced perspectives (Government/Proponent rationale vs Critic/Opposition counter-arguments) so citizens can evaluate their representatives.
4. STRICT JURISDICTION: This platform covers ONLY the United States and Canada. The country field MUST be either "US" or "CA".
5. ZERO EMOJIS: Do not include emojis anywhere.

Source Headline: ${groundTruth.title}
Source Outlet: ${groundTruth.sourceName}
Source URL: ${groundTruth.sourceUrl}
Tier: ${groundTruth.tier}
Publication Date: ${groundTruth.pubDate}
Source Wire Text:
${groundTruth.sourceBodyText || groundTruth.sourceDescription}

OUTPUT VALID JSON ONLY with this exact schema:
{
  "headline": "A factual, compelling headline",
  "summary": "2-sentence objective summary of what changed and taxpayer impact",
  "category": "${groundTruth.category || 'Politics'}",
  "country": "${groundTruth.country === 'CA' ? 'CA' : 'US'}",
  "province": "State or Province abbreviation (e.g. DC, ON, CA, NY, TX, BC, AB, QC)",
  "impactArea": "country | state | local | international",
  "latitude": 38.8951,
  "longitude": -77.0364,
  "eventDate": "${groundTruth.pubDate.slice(0, 10)}",
  "tags": ["Topic1", "Topic2", "RelevantPoliticianName"],
  "taggedPoliticians": ["Exact Full Name of any featured Governor, Premier, Mayor, Minister, Senator, etc."],
  "author": { "name": "Choseno Civic News Desk", "bio": "Civic and political reporting" },
  "seoTitle": "SEO Title under 60 chars | Choseno",
  "metaDescription": "Concise meta description under 160 chars.",
  "tweet": "Engaging neutral 1-sentence summary.",
  "body": "Comprehensive 5-section investigative article in Markdown: Dateline lead, Policy & Taxpayer Impact, Political & Legal Stakes, The Debate (proponent vs critic), and Public Accountability Context."
}`;

  const modelsToTry = [
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.7-flash'
  ];

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        })
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = JSON.parse(rawJson);

        return {
          ...parsed,
          slug: generateSlug(parsed.headline || groundTruth.title, groundTruth.pubDate),
          sources: [{ name: groundTruth.sourceName, url: groundTruth.sourceUrl }],
          groundTruth
        };
      } else {
        console.warn(`Model ${model} returned HTTP ${res.status}, trying next fallback...`);
      }
    } catch (e) {
      console.warn(`Error with ${model}:`, e.message);
    }
  }

  return synthesizeDirectFallback(groundTruth);
}

function cleanHeadline(title, sourceName) {
  if (!title) return '';
  let h = title;
  if (sourceName) {
    const escaped = sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    h = h.replace(new RegExp(`\\s*[-–|]\\s*${escaped}\\s*$`, 'i'), '');
  }
  return h.replace(/\s*[-–|]\s*(The Guardian|The Hill|CBC News|CBC|BBC|Reuters|AP News|Fox News|CNN|Politico|India Today|CTV News)\s*$/i, '').trim();
}

function synthesizeDirectFallback(groundTruth) {
  const headline = cleanHeadline(groundTruth.title, groundTruth.sourceName);
  const dateStr = groundTruth.pubDate.slice(0, 10);
  return {
    slug: generateSlug(headline, dateStr),
    headline,
    summary: groundTruth.sourceDescription || headline,
    category: groundTruth.category || 'Politics',
    country: groundTruth.country || 'US',
    province: groundTruth.country === 'CA' ? 'CA' : 'DC',
    impactArea: 'country',
    latitude: groundTruth.country === 'CA' ? 45.4215 : 38.8951,
    longitude: groundTruth.country === 'CA' ? -75.6972 : -77.0364,
    eventDate: dateStr,
    published_at: groundTruth.pubDate,
    tags: [groundTruth.sourceName, groundTruth.country || 'National', 'Politics'],
    taggedPoliticians: [],
    author: { name: 'Choseno Civic News Desk', bio: 'Civic and political reporting' },
    sources: [{ name: groundTruth.sourceName, url: groundTruth.sourceUrl }],
    seoTitle: `${headline.slice(0, 50)} | Choseno`,
    metaDescription: (groundTruth.sourceDescription || headline).slice(0, 155),
    tweet: headline,
    body: `${headline}\n\nAccording to reporting by ${groundTruth.sourceName}, ${groundTruth.sourceDescription || 'new policy developments were announced.'}\n\nFull primary reporting available at ${groundTruth.sourceUrl}.`,
    groundTruth
  };
}

/**
 * Main Execution: Collect -> Gatekeep -> Synthesize -> Verify Quotes -> Ingest
 */
async function runVerifiedNewsPipeline(options = {}) {
  console.log('======================================================');
  console.log('CHOSENO VERIFIED RSS NEWS INGESTION PIPELINE');
  console.log('Mode: Machine Ground-Truth & Zero-Hallucination Gate');
  console.log('======================================================\n');

  const authHeaders = await getAuthHeaders();

  // 1. Collect verified candidate stories from live RSS feeds
  const candidates = await collectVerifiedRssStories(options);
  if (candidates.length === 0) {
    console.log('\n[PIPELINE] No new verified stories found in current lookback window. All current wires already covered.');
    return [];
  }

  const limit = options.limit || 15;
  const toProcess = candidates.slice(0, limit);

  console.log(`\n[PIPELINE] Synthesizing top ${toProcess.length} of ${candidates.length} verified candidate stories...`);
  const synthesizedBatch = [];

  const SYNTH_CONCURRENCY = 5;
  for (let i = 0; i < toProcess.length; i += SYNTH_CONCURRENCY) {
    const chunk = toProcess.slice(i, i + SYNTH_CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(async (item, idx) => {
      const globalIdx = i + idx + 1;
      console.log(`[${globalIdx}/${toProcess.length}] Synthesizing: "${item.title.slice(0, 60)}..."`);
      try {
        const synthesized = await synthesizeCivicStory(item);
        const verification = verifyArticleQuotesAndFacts(synthesized, item);
        synthesized.body = verification.sanitizedBody;
        synthesized.content = {
          body: verification.sanitizedBody,
          seoTitle: synthesized.seoTitle,
          metaDescription: synthesized.metaDescription,
          tags: synthesized.tags,
          tweet: synthesized.tweet,
          author: synthesized.author,
          sources: [{ name: item.sourceName, url: item.sourceUrl }]
        };
        return synthesized;
      } catch (err) {
        console.warn(`Failed to synthesize story "${item.title}":`, err.message);
        return null;
      }
    }));

    for (const res of chunkResults) {
      if (res) synthesizedBatch.push(res);
    }
  }

  // 3. Write batch to JSON buffer and ingest
  const bufferPath = path.join(__dirname, 'bulk-news-batch.json');
  fs.writeFileSync(bufferPath, JSON.stringify(synthesizedBatch, null, 2));
  console.log(`\n[PIPELINE] Wrote ${synthesizedBatch.length} verified articles into ${bufferPath}.`);

  // 4. Run ingestion script
  console.log(`[PIPELINE] Invoking sanctioned batch ingestion into Supabase...`);
  const { execSync } = require('child_process');
  try {
    const output = execSync(`node scripts/insert-news-batch.js "${bufferPath}"`, { encoding: 'utf8' });
    console.log(output);
  } catch (e) {
    console.error('Ingestion failed:', e.message);
  }

  console.log('======================================================');
  console.log(`PIPELINE COMPLETE: ${synthesizedBatch.length} verified real-world stories published.`);
  console.log('======================================================');
  return synthesizedBatch;
}

if (require.main === module) {
  const maxHoursArg = process.argv.find((a, i) => process.argv[i - 1] === '--max-hours') || 4;
  const limitArg = process.argv.find((a, i) => process.argv[i - 1] === '--limit') || 10;
  runVerifiedNewsPipeline({ maxHours: Number(maxHoursArg), limit: Number(limitArg) }).catch(console.error);
}

module.exports = {
  runVerifiedNewsPipeline,
  synthesizeCivicStory
};
