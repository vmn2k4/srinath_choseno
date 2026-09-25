/**
 * scripts/synthesize-selected-ids.js
 *
 * Enriches and synthesizes specific existing articles by ID or slug in Supabase.
 * Accepts IDs via command line arguments, a file, or comma/newline-separated lists.
 * 
 * Usage:
 *   node scripts/synthesize-selected-ids.js <id1> <id2> ...
 *   node scripts/synthesize-selected-ids.js --ids-file path/to/ids.txt
 *   node scripts/synthesize-selected-ids.js --ids "id1,id2,id3"
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
const GEMINI_API_KEY = env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

const { verifyArticleQuotesAndFacts } = require('./quote-and-fact-verifier');
const { calculateViralityScore, resolvePoliticianIds, normalizeTags, recoverPoliticiansFromTags } = require('./insert-news-batch');

async function getAuthToken() {
  if (env.admin_un && env.admin_pwd) {
    try {
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
        return authData.access_token;
      }
    } catch (e) {
      console.warn('Auth token lookup failed, using anon key:', e.message);
    }
  }
  return SUPABASE_ANON_KEY;
}

const modelsToTry = [
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash'
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function synthesizeArticleWithSearch(article) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required in .env.local for automatic synthesis.');
  }

  const existingBody = (typeof article.content === 'object' ? article.content?.body : article.content) || article.summary || '';
  const sources = article.content?.sources || article.sources || [];
  const primarySource = sources[0] || {};

  const prompt = `You are an elite, non-partisan investigative civic journalist for Choseno.
Transform this verified civic news story into an exhaustive, high-depth analytical report of AT LEAST 500 WORDS (target 520-650 words):
Headline: ${article.headline}
Topic/Summary: ${article.summary || existingBody.slice(0, 400)}
Source: ${primarySource.name || primarySource.label || 'Wire Desk'} (${primarySource.url || ''})
Date: ${article.published_at || article.event_date || new Date().toISOString()}

CRITICAL RULES:
1. STRICT WORD COUNT: The body MUST be between 500 and 750 words. Write 4 to 5 substantial, dense narrative paragraphs (minimum 100-120 words per paragraph). Cover statutory context, executive actions, economic/taxpayer stakes, and community debates.
2. STRICT INDIRECT REPORTED SPEECH: Absolutely ZERO direct quotes or quotation marks (", “”). Paraphrase all spoken statements, official releases, and hearings into clear indirect reported speech.
3. GROUNDED IN TRUTH: Every single fact and number must be grounded in verified real-world reporting. Do not invent detail.
4. NO MARKDOWN HEADERS, NO BULLETS: Pure continuous narrative prose separated by \\n\\n only.

OUTPUT VALID JSON ONLY with this schema:
{
  "headline": "Refined non-formulaic headline",
  "summary": "2-sentence objective summary",
  "body": "Full 520+ word narrative in indirect reported speech...",
  "tags": ["Tag1", "Tag2"],
  "taggedPoliticians": ["Full Name of Official"]
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const model of modelsToTry) {
      // Pass 1: Fast direct JSON generation (no 429 quota traps)
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
          }),
          signal: AbortSignal.timeout(35000)
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          const jsonMatch = text && text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const minWords = attempt === 0 ? 450 : 380;
            if (parsed && parsed.body && parsed.body.trim().split(/\s+/).filter(Boolean).length >= minWords) {
              return parsed;
            }
          }
        } else if (res.status === 429 || res.status === 503) {
          await delay(2000);
        }
      } catch (e) {
        // Continue to fallback
      }

      // Pass 2: Search-grounded pass if direct generation was short
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }]
          }),
          signal: AbortSignal.timeout(45000)
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          const jsonMatch = text && text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const minWords = attempt === 0 ? 450 : 380;
            if (parsed && parsed.body && parsed.body.trim().split(/\s+/).filter(Boolean).length >= minWords) {
              return parsed;
            }
          }
        } else if (res.status === 429 || res.status === 503) {
          await delay(2000);
        }
      } catch (e) {
        // Continue
      }
    }
    if (attempt < 2) {
      await delay(5000);
    }
  }

  throw new Error('Failed to generate 500+ word synthesis across available models.');
}

async function processSelectedIds(ids) {
  if (!ids || ids.length === 0) {
    console.log('No IDs provided to synthesize.');
    return;
  }

  const token = await getAuthToken();
  console.log(`======================================================`);
  console.log(`SYNTHESIZING ${ids.length} SELECTED STORY ID(S)`);
  console.log(`======================================================\n`);

  let successCount = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i].trim();
    if (!id) continue;

    console.log(`[${i + 1}/${ids.length}] Fetching article: ${id}...`);
    const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${id}&select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!fetchRes.ok) {
      console.error(`  -> Failed to fetch article ${id}:`, await fetchRes.text());
      continue;
    }

    const [article] = await fetchRes.json();
    if (!article) {
      console.warn(`  -> Article not found for ID: ${id}`);
      continue;
    }

    const currentWords = (article.content?.body || '').split(/\s+/).filter(Boolean).length;
    console.log(`  -> Current headline: "${article.headline}" (${currentWords} words)`);

    try {
      console.log(`  -> Ground-truth web searching and synthesizing 500+ words...`);
      const synthesized = await synthesizeArticleWithSearch(article);
      
      // Clean quotes & sanitize
      const verification = verifyArticleQuotesAndFacts(synthesized, {
        title: article.headline,
        sourceName: article.content?.sources?.[0]?.name || 'Wire Desk',
        sourceUrl: article.content?.sources?.[0]?.url || ''
      });
      const cleanBody = verification.sanitizedBody;
      const cleanWordCount = cleanBody.split(/\s+/).filter(Boolean).length;

      // Some synthesis passes drop a tagged-politician object into `tags`
      // instead of `taggedPoliticians` -- recover the name so resolution
      // (and therefore news_article_politicians / the OG image card /
      // wall-sync) still links the politician instead of losing them.
      const rawTags = synthesized.tags || article.content?.tags;
      const synthesizedTaggedPoliticians =
        synthesized.taggedPoliticians && synthesized.taggedPoliticians.length > 0
          ? synthesized.taggedPoliticians
          : recoverPoliticiansFromTags(rawTags);

      // Automatically resolve politicians
      const resolution = await resolvePoliticianIds({
        headline: synthesized.headline || article.headline,
        summary: synthesized.summary || article.summary,
        body: cleanBody,
        tags: normalizeTags(rawTags),
        taggedPoliticians: synthesizedTaggedPoliticians,
        country: article.country,
        province: article.province
      }, { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` });

      const resolvedNames = resolution.profiles.map(p => p.full_name);

      // Update article payload
      const updatedContent = {
        ...(article.content || {}),
        body: cleanBody,
        seoTitle: synthesized.headline || article.headline,
        metaDescription: synthesized.summary || article.summary,
        tags: normalizeTags(rawTags),
        taggedPoliticians: resolvedNames.length > 0
          ? resolvedNames
          : (synthesizedTaggedPoliticians.length > 0
              ? synthesizedTaggedPoliticians
              : (resolution.primaryPoliticianName ? [resolution.primaryPoliticianName] : [])),
        primaryPoliticianName: resolution.primaryPoliticianName || synthesizedTaggedPoliticians[0] || null
      };

      // Recalculate virality score with synthesized depth
      const newScore = calculateViralityScore({
        ...article,
        headline: synthesized.headline || article.headline,
        summary: synthesized.summary || article.summary,
        content: updatedContent
      }, resolution.ids);
      updatedContent.viral_score = newScore;

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          headline: synthesized.headline || article.headline,
          summary: synthesized.summary || article.summary,
          content: updatedContent
        })
      });

      if (!patchRes.ok) {
        console.error(`  -> Failed to update article in database:`, await patchRes.text());
        continue;
      }

      // Sync politician walls
      try {

        if (resolution.ids && resolution.ids.length > 0) {
          const syncRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_tags`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              p_article_id: id,
              p_politician_ids: resolution.ids
            })
          });
          if (syncRes.ok) {
            console.log(`  -> Synced politician walls for: ${resolution.profiles.map(p => p.full_name).join(', ')}`);
          } else {
            console.warn(`  -> Warning: failed to sync politician walls:`, await syncRes.text());
          }
        }

        // Regenerate OG card so it reflects the tagged politician and photo
        const ogRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-news-og-image?slug=${encodeURIComponent(article.slug)}&format=json`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`
          }
        });
        if (ogRes.ok) {
          console.log(`  -> Regenerated share-card image with politician profile.`);
        }
      } catch (polErr) {
        console.warn(`  -> Warning during politician/OG sync:`, polErr.message);
      }

      console.log(`  -> SUCCESS! Synthesized ${cleanWordCount} words. Viral Score updated to ${newScore}.\n`);
      successCount++;
    } catch (err) {
      console.error(`  -> Synthesis failed for "${article.headline}":`, err.message, '\n');
    }
    await delay(1500);
  }

  console.log(`======================================================`);
  console.log(`BATCH COMPLETE: ${successCount}/${ids.length} stories successfully synthesized and updated.`);
  console.log(`======================================================`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let idsToProcess = [];

  const fileArgIdx = args.indexOf('--ids-file');
  const idsArgIdx = args.indexOf('--ids');

  if (fileArgIdx !== -1 && args[fileArgIdx + 1]) {
    const filePath = path.resolve(args[fileArgIdx + 1]);
    if (fs.existsSync(filePath)) {
      idsToProcess = fs.readFileSync(filePath, 'utf8').split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
    } else {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
  } else if (idsArgIdx !== -1 && args[idsArgIdx + 1]) {
    idsToProcess = args[idsArgIdx + 1].split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
  } else {
    idsToProcess = args.filter(a => !a.startsWith('--')).map(s => s.trim()).filter(Boolean);
  }

  processSelectedIds(idsToProcess).catch(console.error);
}

module.exports = {
  processSelectedIds,
  synthesizeArticleWithSearch
};
