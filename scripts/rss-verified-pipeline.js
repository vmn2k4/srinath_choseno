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
1. GROUND TRUTH ONLY: Every fact, dollar figure, and policy mechanism must be derived strictly from the provided Source Wire Text. Do NOT invent new numbers, events, or decisions. If the Source Wire Text is thin (a short press-release blurb, barely more than the headline), write a SHORTER, honest piece instead of stretching it to hit a word count with plausible-sounding but unverifiable elaboration — invented motives, invented descriptive detail, invented procedural specifics. A true 200-word piece beats a padded 600-word one.
2. DIRECT QUOTES RULE:
   - If Tier is "tier-2": Absolutely ZERO direct quotes are allowed. Use only indirect paraphrase with attribution ("According to reporting by ${groundTruth.sourceName}...").
   - If Tier is "tier-1": Direct quotes must be VERBATIM excerpts from the provided text. Never fabricate or modify quotes.
3. NEUTRAL OPINION-FORMATION: When the source material presents a genuine dispute or policy debate, frame it with balanced perspectives (proponent rationale vs critic counter-argument) so citizens can evaluate their representatives. Do NOT manufacture a debate the source doesn't support — an appointment, a funding disbursement, a routine procedural vote often doesn't have one, and inventing opposing views for it would itself be a fabrication.
4. STRICT JURISDICTION: This platform covers ONLY the United States and Canada. The country field MUST be either "US" or "CA".
5. ZERO EMOJIS: Do not include emojis anywhere.
6. WRITE LIKE AN EDITOR, NOT A TEMPLATE: You are an experienced editor deciding how THIS specific story should be told — not applying the same formula to every article. Real newsrooms don't write every piece with the same shape: some stories lead with a striking number, some with a quote, some with the human stakes, some chronologically; some need real back-and-forth between sides, others don't have one to report. Decide what this story actually needs and structure it that way. The one hard rule: it must be a single continuous narrative — plain paragraphs (ordinary breaks for pacing), NEVER markdown headers, NEVER labeled sections like "Policy Impact:" or "The Debate:", NEVER a checklist of beats answered one by one in a fixed order. If you notice yourself writing this story with the identical shape as the last one, choose a different approach. Length: 350-750 words.

HEADLINE CRAFT (same standard as the manual editorial directive — Google penalizes templated headlines as Scaled Content Abuse):
- Do NOT lead with the politician's name in a formulaic slot ("[Name] Advances/Unveils/Champions/Spearheads/Rolls Out/Pushes For [Topic] for [City]"). Those five verbs are banned as the headline's primary verb.
- Lead with the hard dollar figure, the vote/ruling, the fiscal impact, or the concrete consequence instead — e.g. "Bakersfield City Council Restructures Community Patrols in $3.2M Safety Overhaul" beats "Mayor X Unveils Safety Plan".
- Never end a headline with a generic "...for [City]" or "...for [State]" tail — fold the location into the subject or action.
- Never open the body with "[CITY], [ST] — [Official] on [Day] announced..." — open with the number, the vote, or the community consequence first.

TWEET SPEC: 120-220 characters, explains the public/civic stakes plainly. NO hashtags, NO @handles, NO URLs, NO emojis.

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
  "body": "Continuous flowing prose (plain paragraphs separated by \\n\\n only — NO markdown headers, NO labeled sections), structured however this specific story calls for. Up to 350-750 words when the source material supports it — shorter and honest if it doesn't. Never padded."
}`;

  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.7-flash'
  ];

  const wordCount = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;
  const MIN_WORDS = 500;

  // Fixed 2026-08-29: search-grounded enrichment used to only run when
  // every model call technically FAILED (HTTP error/exception). But Gemini
  // almost always returns SOME valid JSON even from a one-line RSS blurb —
  // so a thin source never triggered it, it just silently produced (or
  // padded out) a thin article. The gate now checks the actual OUTPUT word
  // count: any article under 500 words gets a search-grounded enrichment
  // pass before it's accepted, regardless of why it came out short.
  let primaryResult = null;
  const rawSourceText = (groundTruth.sourceBodyText || groundTruth.sourceDescription || '').replace(/\s+/g, ' ').trim();
  const isThinSource = rawSourceText.length < 300;

  if (!isThinSource) {
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
          primaryResult = {
            ...parsed,
            slug: generateSlug(parsed.headline || groundTruth.title, groundTruth.pubDate),
            sources: [{ name: groundTruth.sourceName, url: groundTruth.sourceUrl }],
            groundTruth
          };
          break;
        } else {
          console.warn(`Model ${model} returned HTTP ${res.status}, trying next fallback...`);
        }
      } catch (e) {
        console.warn(`Error with ${model}:`, e.message);
      }
    }
  }

  if (primaryResult && wordCount(primaryResult.body) >= MIN_WORDS) {
    return primaryResult;
  }

  console.log(`[SYNTH] "${groundTruth.title.slice(0, 60)}..." ${primaryResult ? `only ${wordCount(primaryResult.body)} words` : 'produced nothing'} (min ${MIN_WORDS}) — searching the internet to enrich it.`);

  // Below minimum word count (or no result at all): search the live
  // internet for real information on this topic and write the full piece
  // from that, rather than publishing something thin or padding a short
  // source with invented detail.
  try {
    const searchPrompt = `You are an elite, non-partisan civic investigative journalist for Choseno.
Search the live internet and transform this verified breaking wire topic into a comprehensive, high-depth civic news report of AT LEAST ${MIN_WORDS} words (target 500-750):
Topic: ${groundTruth.title}
Source: ${groundTruth.sourceName} (${groundTruth.sourceUrl})
Date: ${groundTruth.pubDate}
${primaryResult ? `\nWhat we already have (too short at ${wordCount(primaryResult.body)} words — use it as a starting point, then search for more to substantiate and extend it):\n${primaryResult.body}\n` : ''}

REQUIREMENTS:
1. Write continuous flowing narrative prose (like an editor's judgment call, not a fixed template) analyzing the policy mechanism, taxpayer impact, civic context, and public debate — whatever this specific story actually has to offer. NO markdown headers, NO bulleted sections, NO labeled sections.
2. Every fact must be grounded in verified search results — do not invent numbers, quotes, or events beyond what search actually surfaces. If the story genuinely doesn't support ${MIN_WORDS} words even after searching, say less rather than pad with invented detail.
3. Same headline-craft rules as always: no formulaic "[Name] Announces/Unveils" openers, lead with the concrete consequence.

OUTPUT VALID JSON ONLY with this schema:
{
  "headline": "A factual, compelling headline",
  "summary": "2-sentence objective summary of what changed and taxpayer impact",
  "category": "${groundTruth.category || 'Politics'}",
  "country": "${groundTruth.country === 'CA' ? 'CA' : 'US'}",
  "province": "${groundTruth.country === 'CA' ? 'ON' : 'DC'}",
  "impactArea": "country",
  "latitude": 38.8951,
  "longitude": -77.0364,
  "eventDate": "${groundTruth.pubDate.slice(0, 10)}",
  "tags": ["Topic1", "Topic2"],
  "taggedPoliticians": ["Exact Full Name of featured elected officials"],
  "author": { "name": "Choseno Civic News Desk", "bio": "Civic and political reporting" },
  "seoTitle": "SEO Title under 60 chars | Choseno",
  "metaDescription": "Concise meta description under 160 chars.",
  "tweet": "Engaging neutral 1-sentence summary.",
  "body": "Continuous multi-paragraph prose..."
}`;

    // Fixed 2026-08-29: this was hardcoded to gemini-2.5-flash only. Free-
    // tier Gemini quotas are per-model (observed: 20 requests/day on
    // gemini-2.5-flash) — since that's also the FIRST model the primary
    // loop above tries for every article, its quota exhausts early in a
    // busy day, and a single hardcoded model here meant the entire
    // enrichment feature went dark for the rest of the day once it did.
    // Try each candidate model in turn so one model's exhausted quota
    // doesn't take down the whole fallback.
    let searchResult = null;
    for (const model of modelsToTry) {
      try {
        const searchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: searchPrompt }] }],
            tools: [{ googleSearch: {} }]
          })
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const text = searchData.candidates?.[0]?.content?.parts?.[0]?.text;
          const jsonMatch = text && text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            searchResult = JSON.parse(jsonMatch[0]);
            break;
          }
        } else {
          console.warn(`[SYNTH] ${model} returned HTTP ${searchRes.status} for search-grounded enrichment (429 = quota exhausted for this model today), trying next model...`);
        }
      } catch (e) {
        console.warn(`[SYNTH] Error with ${model} for search-grounded enrichment:`, e.message);
      }
    }

    // Accept the enriched version if it's genuinely fuller than what we had
    // (or if we had nothing) — even if it still falls short of 500, "the
    // most substantive honest version we could produce" beats rejecting it
    // outright.
    if (searchResult && searchResult.body && (!primaryResult || wordCount(searchResult.body) > wordCount(primaryResult.body))) {
      return {
        ...searchResult,
        slug: generateSlug(searchResult.headline || groundTruth.title, groundTruth.pubDate),
        sources: [{ name: groundTruth.sourceName, url: groundTruth.sourceUrl }],
        groundTruth
      };
    }
  } catch (searchErr) {
    console.warn('[PIPELINE] Search-grounded synthesis fallback error:', searchErr.message);
  }

  // Enrichment didn't beat what we already had (or errored): use the
  // primary result if we got one, even if short — it's still real,
  // grounded content. Only the bare headline+link template is the true
  // last resort, when nothing else produced anything at all.
  return primaryResult || synthesizeDirectFallback(groundTruth);
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
 * Runs fetch-trending-topics.js for the same lookback window and returns the
 * set of trending keyword tokens, so candidates matching what's actually
 * surging on Google Trends / Google News get priority instead of being cut
 * off by the synthesis `limit`. This is the "twitter/general trending"
 * signal masternewsagent used to consult manually — folded into the one
 * pipeline so both cron and on-demand runs get it automatically.
 */
function loadTrendingKeywords(maxHours) {
  const { execSync } = require('child_process');
  try {
    execSync(`node scripts/fetch-trending-topics.js --max-hours ${maxHours}`, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'ignore', 'ignore']
    });
  } catch (e) {
    console.warn('[PIPELINE] Trending topics fetch failed, continuing without trending boost:', e.message);
    return new Set();
  }

  const csvPath = path.join(__dirname, 'latest-trending-topics.csv');
  if (!fs.existsSync(csvPath)) return new Set();

  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
  const keywords = new Set();
  // title is column index 4; split respecting quoted commas
  for (const line of lines.slice(1)) {
    const cells = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
    const title = (cells[4] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
    for (const token of title.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/)) {
      if (token.length > 3) keywords.add(token);
    }
  }
  return keywords;
}

function isTrending(title, trendingKeywords) {
  if (trendingKeywords.size === 0) return false;
  const tokens = title.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  return tokens.some(t => trendingKeywords.has(t));
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

  // 2. Pull the same lookback window's trending topics and bump any
  // candidate that matches to the front, so a genuinely trending story
  // never gets truncated out by `limit` just because of feed order.
  const trendingKeywords = options.skipTrending ? new Set() : loadTrendingKeywords(options.maxHours || 4);
  const ordered = trendingKeywords.size
    ? [...candidates].sort((a, b) => Number(isTrending(b.title, trendingKeywords)) - Number(isTrending(a.title, trendingKeywords)))
    : candidates;
  const trendingMatchCount = ordered.filter(c => isTrending(c.title, trendingKeywords)).length;
  if (trendingMatchCount > 0) {
    console.log(`[PIPELINE] ${trendingMatchCount} candidate(s) match current trending topics — prioritized.`);
  }

  const toProcess = ordered;

  // If collectOnly is enabled (Antigravity-native synthesis mode), save candidates and stop
  if (options.collectOnly) {
    const candidatesPath = path.join(__dirname, 'latest-verified-rss-candidates.json');
    fs.writeFileSync(candidatesPath, JSON.stringify(toProcess, null, 2));
    console.log(`\n[PIPELINE] Saved ${toProcess.length} verified RSS candidate stories into ${candidatesPath} for Antigravity synthesis.`);
    return toProcess;
  }

  console.log(`\n[PIPELINE] Synthesizing all ${toProcess.length} verified candidate stories (100% un-capped)...`);
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
  (async () => {
    const explicitMaxHours = process.argv.find((a, i) => process.argv[i - 1] === '--max-hours');
    const collectOnly = !process.argv.includes('--use-api-key');
    const useApiKey = process.argv.includes('--use-api-key');

    let maxHours;
    let sinceTimestamp;
    if (explicitMaxHours) {
      maxHours = Number(explicitMaxHours);
    } else {
      try {
        const { getLastPublishWindow } = require('./get-last-publish-window');
        const window = await getLastPublishWindow();
        maxHours = window.lookbackHours;
        sinceTimestamp = window.lastPublishedAt;
        console.log(`[PIPELINE] No --max-hours given; auto-computed lookback = ${maxHours}h (last published ${window.lastPublishedAt}).`);
      } catch (e) {
        console.warn('[PIPELINE] Auto-window lookup failed, defaulting to 4h:', e.message);
        maxHours = 4;
      }
    }

    runVerifiedNewsPipeline({
      maxHours,
      sinceTimestamp,
      collectOnly,
      useApiKey
    }).catch(console.error);
  })();
}

module.exports = {
  runVerifiedNewsPipeline,
  synthesizeCivicStory
};
