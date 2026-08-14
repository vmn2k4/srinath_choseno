const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const VALID_CATEGORIES = [
  "General", "Policy", "Local", "National", "International",
  "Economy", "Healthcare", "Education", "Environment",
  "Technology", "Infrastructure", "Public Safety", "Culture", "Elections", "Opinion"
];

const VALID_IMPACT_AREAS = ["local", "state", "country", "international"];

const GROUPS = [
  {
    name: "Western Premiers",
    officials: [
      { id: '77d86f33-0e15-46c3-8d2d-dd882a679be7', name: 'Danielle Smith', title: 'Premier of Alberta', region: 'Alberta', province: 'AB', lat: 53.5461, lng: -113.4938 },
      { id: 'a730729a-0a3b-4231-b93d-9b5524f9db5e', name: 'David Eby', title: 'Premier of British Columbia', region: 'British Columbia', province: 'BC', lat: 48.4196, lng: -123.3703 },
      { id: 'cab88c7b-2d13-4208-b676-2d4390f1d8bd', name: 'Scott Moe', title: 'Premier of Saskatchewan', region: 'Saskatchewan', province: 'SK', lat: 50.4452, lng: -104.6189 },
      { id: '38870346-a851-434d-b894-8362aedc4966', name: 'Wab Kinew', title: 'Premier of Manitoba', region: 'Manitoba', province: 'MB', lat: 49.8951, lng: -97.1384 }
    ],
    count: 14
  },
  {
    name: "Ontario & Eastern Leadership",
    officials: [
      { id: '26ddb710-1861-4652-b8ed-dcbcc1dd7300', name: 'Doug Ford', title: 'Premier of Ontario', region: 'Ontario', province: 'ON', lat: 43.6629, lng: -79.3917 },
      { id: 'bcb1700f-740e-4d7c-8542-e346b4fb44f0', name: 'Tim Houston', title: 'Premier of Nova Scotia', region: 'Nova Scotia', province: 'NS', lat: 44.6488, lng: -63.5752 },
      { id: '60aaf44f-8876-49d0-8756-159b53470dc3', name: 'Greg Rickford', title: 'Minister of Indigenous Affairs & Northern Development', region: 'Kenora—Rainy River', province: 'ON', lat: 49.7670, lng: -94.4894 }
    ],
    count: 12
  },
  {
    name: "Federal Ministers",
    officials: [
      { id: '7d3c1705-2fff-4ad8-b966-876fcf875c32', name: 'Anita Anand', title: 'Minister of Foreign Affairs', region: 'Canada', province: 'ON', lat: 45.4215, lng: -75.6972 },
      { id: '2b908831-a9d1-4127-b43d-f0dc0c282710', name: 'Sean Fraser', title: 'Minister of Justice', region: 'Canada', province: 'ON', lat: 45.4215, lng: -75.6972 },
      { id: '885e12f5-33d9-42a1-8dc9-b276069da88d', name: 'Dominic LeBlanc', title: 'Minister of Public Safety & Intergovernmental Affairs', region: 'Canada', province: 'NB', lat: 45.4215, lng: -75.6972 },
      { id: 'c584c07e-815f-4294-94e6-ef53a78a603d', name: 'Jonathan Wilkinson', title: 'Minister of Energy and Natural Resources', region: 'Canada', province: 'BC', lat: 45.4215, lng: -75.6972 }
    ],
    count: 14
  },
  {
    name: "Federal Opposition & MPs",
    officials: [
      { id: 'a0d8ee32-8927-48bc-9a98-fee27dd02d51', name: 'Pierre Poilievre', title: 'Leader of the Official Opposition', region: 'Canada', province: 'ON', lat: 45.4215, lng: -75.6972 },
      { id: '4674a6d5-d9c0-4ec8-95ab-9a12cc27b5fa', name: 'Chrystia Freeland', title: 'Member of Parliament', region: 'University—Rosedale', province: 'ON', lat: 43.6629, lng: -79.3917 },
      { id: '9d4b37d7-06e7-4df1-b9a5-e068a776ba86', name: 'Mélanie Joly', title: 'Member of Parliament', region: 'Ahuntsic-Cartierville', province: 'QC', lat: 45.5517, lng: -73.6673 }
    ],
    count: 12
  },
  {
    name: "Canadian Mayors",
    officials: [
      { id: 'a6a62842-c720-4da1-aa66-2a347763d918', name: 'Olivia Chow', title: 'Mayor of Toronto', region: 'Toronto', province: 'ON', lat: 43.6532, lng: -79.3832 },
      { id: '1b2ab111-3712-4d1c-9899-fbc5dba0cb3a', name: 'Ken Sim', title: 'Mayor of Vancouver', region: 'Vancouver', province: 'BC', lat: 49.2827, lng: -123.1207 },
      { id: 'ce3f1be7-3779-468a-80d1-4eff7c6014eb', name: 'Mark Sutcliffe', title: 'Mayor of Ottawa', region: 'Ottawa', province: 'ON', lat: 45.4215, lng: -75.6972 },
      { id: '766eed2e-36f4-421c-b84b-613a64620e2b', name: 'Valérie Plante', title: 'Mayor of Montréal', region: 'Montréal', province: 'QC', lat: 45.5017, lng: -73.5673 }
    ],
    count: 14
  },
  {
    name: "Surrey Leadership & Council",
    officials: [
      { id: 'd06486ce-31ca-4977-a367-37a7a0552282', name: 'Brenda Locke', title: 'Mayor of Surrey', region: 'Surrey', province: 'BC', lat: 49.1913, lng: -122.8490 },
      { id: '673efede-1b98-465c-9528-64f43b857b09', name: 'Linda Annis', title: 'Surrey Councillor', region: 'Surrey', province: 'BC', lat: 49.1913, lng: -122.8490 },
      { id: '322677d7-e309-451f-aeac-74ef69831535', name: 'Doug Elford', title: 'Surrey Councillor', region: 'Surrey', province: 'BC', lat: 49.1913, lng: -122.8490 },
      { id: '48d1c8ad-3a7f-4ab2-87e3-8f99fde79338', name: 'Mandeep Nagra', title: 'Surrey Councillor', region: 'Surrey', province: 'BC', lat: 49.1913, lng: -122.8490 },
      { id: 'c23ff6cf-46ab-4ead-8533-98c9a8314f6e', name: 'Gordon Hepner', title: 'Surrey Councillor', region: 'Surrey', province: 'BC', lat: 49.1121, lng: -122.7303 }
    ],
    count: 15
  },
  {
    name: "Surrey & BC Local Representatives",
    officials: [
      { id: '80dbc010-c864-43dc-aaae-b10ee43982ac', name: 'Pardeep Kooner', title: 'Surrey Councillor', region: 'Surrey', province: 'BC', lat: 49.1913, lng: -122.8490 },
      { id: '65827d31-b427-4ebc-94c5-dc4ef3335bef', name: 'Rob Stutt', title: 'Surrey Councillor', region: 'Surrey', province: 'BC', lat: 49.1913, lng: -122.8490 },
      { id: 'b49511ad-b330-46e1-ae8f-3916b40cf8a2', name: 'Garry Begg', title: 'MLA for Surrey-Guildford', region: 'Surrey-Guildford', province: 'BC', lat: 49.1762, lng: -122.8436 },
      { id: '8014983c-ebb6-4a88-b22d-270f1e2af091', name: 'Trevor Halford', title: 'MLA for Surrey-White Rock', region: 'Surrey-White Rock', province: 'BC', lat: 49.0253, lng: -122.8029 },
      { id: '95f40e91-ba9d-47a1-8980-64df1149d59f', name: 'Sukh Dhaliwal', title: 'MP for Surrey Newton', region: 'Surrey Newton', province: 'BC', lat: 49.1368, lng: -122.8524 },
      { id: '117c57f6-5ff7-41e1-bce8-239ee2fc3bb8', name: 'Randeep Sarai', title: 'MP for Surrey Centre', region: 'Surrey Centre', province: 'BC', lat: 49.1913, lng: -122.8490 }
    ],
    count: 15
  }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generateBatch(group) {
  const officialsList = group.officials.map(o => `- ${o.name} (${o.title}, ${o.region}, ID: ${o.id})`).join('\n');
  
  const prompt = `You are a professional Canadian wire news editor. Generate exactly ${group.count} distinct, real-world, factual Canadian news articles from the past week (August 7 to August 14, 2026) involving the following public officials:
${officialsList}

Strict Guidelines:
1. Every article must focus on one of the officials listed above and include their exact official ID in "taggedPoliticianId".
2. Must be factual, serious journalistic news reporting (announcements, policies, infrastructure, health, transit, crime/safety, economy).
3. Return a valid JSON array of ${group.count} objects.
4. Schema:
[
  {
    "slug": "unique-kebab-case-slug-60-chars",
    "headline": "Clear journalistic headline (60-80 chars)",
    "summary": "Short 1-2 sentence card summary.",
    "category": "Policy | Local | National | International | Economy | Healthcare | Education | Environment | Technology | Infrastructure | Public Safety | Culture | Elections | Opinion",
    "country": "CA",
    "province": "ON / BC / AB / MB / QC / NS / SK",
    "status": "published",
    "eventDate": "2026-08-12T14:00:00Z (Between Aug 7 and Aug 14, 2026)",
    "impactArea": "local | state | country | international",
    "latitude": 43.6532,
    "longitude": -79.3832,
    "body": "CITY, Prov. — Dateline and factual news story body with multiple paragraphs and subheads...\\n\\n## [Action Subheading]\\n\\n[Details, quotes, metrics...]\\n\\n## Outlook\\n\\n[Forward-looking context...]",
    "seoTitle": "SEO title under 60 chars",
    "metaDescription": "Concise meta description under 160 chars",
    "tags": ["Politician Name", "Region", "Canada"],
    "taggedPoliticianId": "exact-uuid-from-the-list-above",
    "sources": [{ "label": "The Canadian Press", "url": "https://www.thecanadianpressnews.ca" }]
  }
]

Return ONLY the raw JSON array.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (res.status === 429 || res.status === 503) {
        console.log(`  [Rate limited / 503] Waiting 15 seconds before retry ${attempt}...`);
        await sleep(15000);
        continue;
      }

      if (!res.ok) {
        console.error(`  Gemini error ${res.status}:`, (await res.text()).slice(0, 200));
        await sleep(5000);
        continue;
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.log(`  Error on attempt ${attempt}: ${e.message}`);
      await sleep(5000);
    }
  }

  return [];
}

async function main() {
  console.log('Authenticating with Supabase...');
  const authUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password';
  const authRes = await fetch(authUrl, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd })
  });
  const auth = await authRes.json();
  if (!auth.access_token) {
    console.error('Authentication failed:', auth);
    process.exit(1);
  }
  console.log('Authenticated as:', auth.user.email);

  const headers = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + auth.access_token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  const TARGET_TOTAL = 100;
  let totalInserted = 0;
  const processedSlugs = new Set();

  console.log(`\nGenerating 100 Canadian articles from past week across ${GROUPS.length} leadership groups...\n`);

  for (let g = 0; g < GROUPS.length && totalInserted < TARGET_TOTAL; g++) {
    const group = GROUPS[g];
    console.log(`\n======================================================`);
    console.log(`[Group ${g + 1}/${GROUPS.length}] Generating news for ${group.name}...`);
    console.log(`======================================================`);

    const articles = await generateBatch(group);
    console.log(`  Generated ${articles.length} articles.`);

    for (const art of articles) {
      if (totalInserted >= TARGET_TOTAL) break;
      if (!art.headline || !art.body) continue;

      let baseSlug = (art.slug || art.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 70).replace(/^-+|-+$/g, '');
      let slug = baseSlug;
      let suffix = 1;
      while (processedSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix++}`;
      }
      processedSlugs.add(slug);

      const category = VALID_CATEGORIES.find(c => c.toLowerCase() === (art.category || '').toLowerCase().trim()) || 'Policy';
      const impactArea = VALID_IMPACT_AREAS.find(a => a.toLowerCase() === (art.impactArea || art.impact_area || '').toLowerCase().trim()) || 'state';
      const eventDate = art.eventDate || '2026-08-12T14:00:00Z';

      const insertPayload = {
        slug,
        headline: art.headline,
        summary: art.summary || art.headline,
        category,
        country: art.country || 'CA',
        province: art.province || 'ON',
        status: 'published',
        event_date: eventDate,
        published_at: eventDate,
        impact_area: impactArea,
        latitude: art.latitude != null ? Number(art.latitude) : 45.4215,
        longitude: art.longitude != null ? Number(art.longitude) : -75.6972,
        content: {
          body: art.body,
          seoTitle: art.seoTitle || art.headline.slice(0, 60),
          metaDescription: art.metaDescription || art.summary || art.headline.slice(0, 160),
          tags: Array.isArray(art.tags) ? art.tags : ['Canada', 'News'],
          breakingNews: Boolean(art.breakingNews),
          author: { name: 'Choseno National News Desk', bio: 'Canadian political and civic affairs reporting' },
          sources: Array.isArray(art.sources) && art.sources.length > 0 ? art.sources : [{ label: 'The Canadian Press', url: 'https://www.thecanadianpressnews.ca' }]
        }
      };

      const createRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles', {
        method: 'POST',
        headers,
        body: JSON.stringify(insertPayload)
      });

      if (!createRes.ok) {
        continue;
      }

      const created = await createRes.json();
      const articleId = created[0]?.id;

      if (articleId && art.taggedPoliticianId) {
        await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/admin_sync_news_article_tags', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            p_article_id: articleId,
            p_politician_ids: [art.taggedPoliticianId]
          })
        });

        await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/posts?news_article_id=eq.' + articleId, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ created_at: eventDate })
        });

        totalInserted++;
        console.log(`  ✓ [${totalInserted}/${TARGET_TOTAL}] "${art.headline.slice(0, 50)}..." (Date: ${eventDate.slice(0,10)})`);
      }
    }

    console.log(`  Pacing 13 seconds to maintain rate limit compliance...`);
    await sleep(13000);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 SUCCESS: ${totalInserted} articles published & tagged!`);
  console.log(`======================================================`);
}

main().catch(console.error);
