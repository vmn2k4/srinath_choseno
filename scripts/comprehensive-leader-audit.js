const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function normalize(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Known common aliases / nicknames
const ALIASES = {
  'jb pritzker': 'j.b. pritzker',
  'j.b. pritzker': 'jb pritzker',
  'greg abbott': 'gregory abbott',
  'gregory abbott': 'greg abbott',
  'doug ford': 'douglas ford',
  'douglas ford': 'doug ford',
  'tim houston': 'timothy houston',
  'timothy houston': 'tim houston',
  'danielle smith': 'marlaina danielle smith',
  'scott moe': 'scott moe',
  'wab kinew': 'wabanakwut kinew',
  'david eby': 'david robert patrick eby',
  'mike dewine': 'richard michael dewine',
  'richard michael dewine': 'mike dewine',
  'josh shapiro': 'joshua david shapiro',
  'joshua david shapiro': 'josh shapiro',
  'gretchen whitmer': 'gretchen esther whitmer',
  'gretchen esther whitmer': 'gretchen whitmer',
  'ron desantis': 'ronald dion desantis',
  'ronald dion desantis': 'ron desantis',
  'pete buttigieg': 'peter paul montgomery buttigieg',
  'kamala harris': 'kamala devi harris',
  'donald trump': 'donald j trump',
  'donald j trump': 'donald j. trump',
  'donald j. trump': 'donald trump',
  'joe biden': 'joseph r biden',
  'joseph r biden': 'joseph r. biden',
  'joseph r. biden': 'joe biden',
  'mark carney': 'mark joseph carney',
  'pierre poilievre': 'pierre marcel poilievre',
  'justin trudeau': 'justin pierre james trudeau',
  'chrystia freeland': 'chrystia freeland',
  'francois legault': 'francois legault',
  'françois legault': 'francois legault'
};

async function main() {
  console.log('===============================================================');
  console.log('CHOSENO COMPREHENSIVE 100% LEADER AUDIT & WALL SYNC PIPELINE');
  console.log('===============================================================\n');

  // 1. Get Auth Token
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
  const authData = await authRes.json();
  const token = authData.access_token;
  if (!token) {
    console.error('Failed to authenticate with Supabase admin');
    process.exit(1);
  }
  const authHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Fetch ALL Profiles (paginated with limit & offset)
  console.log('1. Loading ALL profiles from Supabase database...');
  let allProfiles = [];
  let pOffset = 0;
  const pPageSize = 1000;
  while (true) {
    const pRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,designation,constituency,country,role&order=id.asc&limit=${pPageSize}&offset=${pOffset}`,
      { headers: authHeaders }
    );
    if (!pRes.ok) {
      console.error('Failed to fetch profiles range:', await pRes.text());
      break;
    }
    const pageData = await pRes.json();
    allProfiles = allProfiles.concat(pageData || []);
    if (!pageData || pageData.length < pPageSize) break;
    pOffset += pPageSize;
  }
  console.log(`Loaded ${allProfiles.length} total profiles from Supabase.`);

  // Build lookup index of profiles
  const profileLookup = [];
  for (const prof of allProfiles) {
    if (!prof.full_name) continue;
    const normName = normalize(prof.full_name);
    if (normName.length < 3) continue;

    profileLookup.push({
      id: prof.id,
      name: prof.full_name,
      normName: normName,
      role: prof.role,
      designation: prof.designation,
      constituency: prof.constituency
    });
  }

  // 3. Fetch ALL existing news_article_politicians mappings
  console.log('\n2. Loading all current article-politician mappings...');
  let existingMappings = [];
  let mOffset = 0;
  while (true) {
    const mRes = await fetch(
      `${SUPABASE_URL}/rest/v1/news_article_politicians?select=article_id,politician_id&order=article_id.asc&limit=${pPageSize}&offset=${mOffset}`,
      { headers: authHeaders }
    );
    if (!mRes.ok) break;
    const mData = await mRes.json();
    existingMappings = existingMappings.concat(mData || []);
    if (!mData || mData.length < pPageSize) break;
    mOffset += pPageSize;
  }
  console.log(`Loaded ${existingMappings.length} current article-politician tag rows.`);

  const articleToPoliticians = new Map();
  for (const row of existingMappings) {
    if (!articleToPoliticians.has(row.article_id)) {
      articleToPoliticians.set(row.article_id, new Set());
    }
    articleToPoliticians.get(row.article_id).add(row.politician_id);
  }

  // 4. Fetch ALL published news articles (paginated)
  console.log('\n3. Loading ALL news articles from Supabase...');
  let allArticles = [];
  let aOffset = 0;
  while (true) {
    const aRes = await fetch(
      `${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,summary,content,category,country,province,status,published_at,event_date,hero_image_url&order=published_at.desc&limit=${pPageSize}&offset=${aOffset}`,
      { headers: authHeaders }
    );
    if (!aRes.ok) {
      console.error('Failed to fetch articles range:', await aRes.text());
      break;
    }
    const aData = await aRes.json();
    allArticles = allArticles.concat(aData || []);
    if (!aData || aData.length < pPageSize) break;
    aOffset += pPageSize;
  }
  console.log(`Loaded ${allArticles.length} total news articles from Supabase.`);

  // 5. Audit Every Article
  console.log('\n4. Auditing each article for leader mentions & mapping...\n');

  let updatedArticlesCount = 0;
  let alreadyTaggedCount = 0;
  let untaggedArticlesWithoutLeaders = [];
  let untaggedArticlesWithUnmatchedLeaders = [];

  for (let i = 0; i < allArticles.length; i++) {
    const art = allArticles[i];
    const headline = art.headline || '';
    const summary = art.summary || '';
    const body = art.content?.body || '';
    const tags = Array.isArray(art.content?.tags) ? art.content.tags.join(' ') : '';
    const taggedPoliticians = Array.isArray(art.content?.taggedPoliticians) ? art.content.taggedPoliticians.join(' ') : '';

    const fullArticleText = `${headline}\n${summary}\n${tags}\n${taggedPoliticians}\n${body}`;
    const normFullText = normalize(fullArticleText);

    const existingPolIds = articleToPoliticians.get(art.id) || new Set();
    const matchedPoliticianIds = new Set(existingPolIds);
    const matchedNames = [];

    // Match against profile lookup
    for (const prof of profileLookup) {
      // 1. Direct name regex word boundary match
      const escapedNorm = prof.normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedNorm}\\b`, 'i');

      if (regex.test(normFullText)) {
        matchedPoliticianIds.add(prof.id);
        matchedNames.push(prof.name);
        continue;
      }

      // 2. Check aliases
      if (ALIASES[prof.normName]) {
        const alias = ALIASES[prof.normName];
        const aliasEscaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const aliasRegex = new RegExp(`\\b${aliasEscaped}\\b`, 'i');
        if (aliasRegex.test(normFullText)) {
          matchedPoliticianIds.add(prof.id);
          matchedNames.push(prof.name);
          continue;
        }
      }
    }

    // Check if new politicians were matched that weren't tagged before
    const newMatches = Array.from(matchedPoliticianIds).filter(id => !existingPolIds.has(id));
    const allMatches = Array.from(matchedPoliticianIds);

    if (newMatches.length > 0 || (allMatches.length > 0 && existingPolIds.size === 0)) {
      // Sync tags via RPC
      const syncRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_sync_news_article_tags`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          p_article_id: art.id,
          p_politician_ids: allMatches
        })
      });

      if (syncRes.ok) {
        // Reset hero_image_url to null so dynamic card regenerates with politician photo/name
        if (art.hero_image_url) {
          await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({ hero_image_url: null })
          });
        }

        console.log(`[SYNCED #${updatedArticlesCount + 1}] (${art.slug}) -> Tagged: ${matchedNames.join(', ')}`);
        updatedArticlesCount++;
      } else {
        console.warn(`[FAILED SYNC] (${art.slug}):`, await syncRes.text());
      }
    } else if (allMatches.length > 0) {
      alreadyTaggedCount++;
    } else {
      // Truly untagged article -- inspect if text has prominent titles
      const hasLeaderTitle = /(governor|premier|mayor|minister|secretary|senator|congressman|congresswoman|president|chancellor|commissioner|attorney general)/i.test(headline);
      if (hasLeaderTitle) {
        untaggedArticlesWithUnmatchedLeaders.push({
          slug: art.slug,
          headline: art.headline,
          date: art.published_at
        });
      } else {
        untaggedArticlesWithoutLeaders.push({
          slug: art.slug,
          headline: art.headline,
          date: art.published_at
        });
      }
    }
  }

  console.log('\n===============================================================');
  console.log('AUDIT SUMMARY RESULTS:');
  console.log('===============================================================');
  console.log(`Total Articles Audited: ${allArticles.length}`);
  console.log(`Newly Synced & Tagged Articles: ${updatedArticlesCount}`);
  console.log(`Previously Tagged Articles: ${alreadyTaggedCount}`);
  console.log(`Articles with NO leader mentioned (Agency/General/Economic): ${untaggedArticlesWithoutLeaders.length}`);
  console.log(`Articles with unmatched leader titles (e.g. federal department agency secretaries not in profiles table): ${untaggedArticlesWithUnmatchedLeaders.length}`);

  if (untaggedArticlesWithUnmatchedLeaders.length > 0) {
    console.log('\n--- Untagged Articles with Leader Titles to Review ---');
    untaggedArticlesWithUnmatchedLeaders.slice(0, 30).forEach((a, i) => {
      console.log(`${i + 1}. [${a.slug}] ${a.headline}`);
    });
  }

  // Save report to file
  const reportPath = path.resolve(__dirname, 'leader-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    auditedAt: new Date().toISOString(),
    totalArticles: allArticles.length,
    newlySynced: updatedArticlesCount,
    previouslyTagged: alreadyTaggedCount,
    untaggedNoLeader: untaggedArticlesWithoutLeaders,
    untaggedUnmatched: untaggedArticlesWithUnmatchedLeaders
  }, null, 2));

  console.log(`\nDetailed report saved to: ${reportPath}`);
}

main().catch(console.error);
