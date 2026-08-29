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

async function main() {
  const itemsPath = path.join(__dirname, 'short-articles-to-enrich.json');
  if (!fs.existsSync(itemsPath)) {
    console.error('short-articles-to-enrich.json not found');
    return;
  }
  const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
  console.log(`Total short items to enrich: ${items.length}`);

  const authRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd })
  });
  const authData = await authRes.json();
  const token = authData.access_token;
  if (!token) {
    console.error('Failed to get admin token');
    return;
  }

  let enrichedCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`[${i+1}/${items.length}] Enriching: "${item.headline.slice(0, 60)}..."`);

    const prompt = `You are an elite, non-partisan civic investigative journalist for Choseno.
Search the live internet and transform this verified breaking wire topic into a comprehensive, high-depth civic news report of AT LEAST 500 words (target 500-750 words):
Topic: ${item.headline}
Summary: ${item.summary}
Category: ${item.category || 'Politics'}
Country: ${item.country || 'US'}

REQUIREMENTS:
1. Write 3-5 continuous flowing paragraphs analyzing the policy mechanism, taxpayer impact, civic context, and public debate.
2. NO markdown headers, NO bulleted sections, NO labeled sections. Plain continuous prose only.
3. Every fact must be grounded in verified reporting — do not invent quotes, names, or numbers.

OUTPUT VALID JSON ONLY with this exact schema:
{
  "headline": "Clean factual headline",
  "summary": "2-sentence objective summary of what changed and taxpayer impact",
  "seoTitle": "SEO Title under 60 chars | Choseno",
  "metaDescription": "Concise meta description under 160 chars.",
  "tweet": "Engaging neutral 1-sentence summary.",
  "body": "Continuous multi-paragraph prose (at least 500 words)..."
}`;

    try {
      const searchRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + env.GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }]
        })
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const text = searchData.candidates?.[0]?.content?.parts?.[0]?.text;
        const jsonMatch = text && text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const wordCount = (parsed.body || '').trim().split(/\s+/).filter(Boolean).length;
          if (wordCount >= 250) {
            const updatePayload = {
              headline: parsed.headline || item.headline,
              summary: parsed.summary || item.summary,
              content: {
                body: parsed.body,
                seoTitle: parsed.seoTitle || item.headline,
                metaDescription: parsed.metaDescription || item.summary,
                tags: [item.category || 'Politics', item.country || 'US', 'Civic News'],
                tweet: parsed.tweet || item.headline,
                author: { name: 'Choseno Civic News Desk', bio: 'Civic and political reporting' },
                sources: item.sources
              }
            };

            const patchRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/news_articles?id=eq.${item.id}`, {
              method: 'PATCH',
              headers: {
                apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updatePayload)
            });

            if (patchRes.ok) {
              console.log(`  -> Enriched successfully (${wordCount} words)`);
              enrichedCount++;
            } else {
              console.warn(`  -> Patch failed with status ${patchRes.status}`);
            }
          } else {
            console.warn(`  -> Generated body too short (${wordCount} words), skipping update`);
          }
        }
      } else {
        console.warn(`  -> Search API returned ${searchRes.status}`);
      }
    } catch (e) {
      console.warn(`  -> Error enriching item: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`\n[COMPLETE] Successfully enriched ${enrichedCount} of ${items.length} short articles.`);
}

main().catch(console.error);
