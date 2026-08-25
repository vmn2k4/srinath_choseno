/**
 * scripts/auto-batch-pipeline.js
 *
 * Automated High-Volume News Generation & Verification Loop.
 * Enforces a strict minimum of at least 20 UNIQUE articles per execution.
 *
 * This script:
 *   1. Connects to Supabase to fetch existing slugs to guarantee deduplication.
 *   2. Inspects and validates the candidate JSON payload in scripts/bulk-news-batch.json.
 *   3. Checks if total valid, unique, non-duplicate articles >= targetMin (default: 20).
 *   4. If < 20, outputs exact deficit and missing tiers (Federal, State/Provincial, Municipal).
 *   5. If >= 20, automatically executes ingestion, syncs politician walls, and updates CSV ranking.
 *
 * Usage:
 *   node scripts/auto-batch-pipeline.js --min 20
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
let minTarget = 20;
const minIdx = args.indexOf('--min');
if (minIdx !== -1 && args[minIdx + 1]) {
  minTarget = parseInt(args[minIdx + 1], 10) || 20;
}

let dedupCount = 0;
const dedupIdx = args.indexOf('--dedup-recent');
if (dedupIdx !== -1) {
  dedupCount = parseInt(args[dedupIdx + 1], 10) || 500;
}

const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found at', envPath);
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function normalizeString(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(str) {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
    'can', 'may', 'might', 'must', 'signs', 'announces', 'awards', 'allocates', 'deploys',
    'unveils', 'directs', 'million', 'billion', 'enacts', 'approves'
  ]);
  return new Set(
    normalizeString(str)
      .split(' ')
      .filter(w => w.length > 2 && !stopWords.has(w))
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

async function cleanDuplicates(limitCount = 500) {
  console.log(`\n======================================================`);
  console.log(`CHOSENO DATABASE DEDUPLICATION (LAST ${limitCount} ARTICLES)`);
  console.log(`======================================================\n`);

  console.log('1. Authenticating with Supabase...');
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
  const authHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log(`2. Querying last ${limitCount} published articles...`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,headline,summary,published_at,created_at&order=published_at.desc&limit=${limitCount}`, {
    headers: authHeaders
  });
  if (!res.ok) {
    console.error('Failed to fetch articles:', await res.text());
    return;
  }
  const articles = await res.json();
  console.log(`Loaded ${articles.length} recent articles for duplicate analysis.`);

  const clusters = [];
  const processedIds = new Set();

  for (let i = 0; i < articles.length; i++) {
    const artA = articles[i];
    if (processedIds.has(artA.id)) continue;

    const cluster = [artA];
    const tokensA = getTokens(artA.headline + ' ' + (artA.summary || ''));
    const normHeadA = normalizeString(artA.headline);

    for (let j = i + 1; j < articles.length; j++) {
      const artB = articles[j];
      if (processedIds.has(artB.id)) continue;

      const normHeadB = normalizeString(artB.headline);
      const tokensB = getTokens(artB.headline + ' ' + (artB.summary || ''));

      let isDuplicate = normHeadA === normHeadB;
      if (!isDuplicate) {
        const sim = jaccardSimilarity(tokensA, tokensB);
        if (sim >= 0.45) isDuplicate = true;
      }
      if (!isDuplicate) {
        const slugA = artA.slug.replace(/-\d{4}-\d{2}-\d{2}.*$/, '');
        const slugB = artB.slug.replace(/-\d{4}-\d{2}-\d{2}.*$/, '');
        if (slugA === slugB && slugA.length > 10) isDuplicate = true;
      }

      if (isDuplicate) {
        cluster.push(artB);
        processedIds.add(artB.id);
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
      processedIds.add(artA.id);
    }
  }

  console.log(`Found ${clusters.length} duplicate clusters.`);
  let deleted = 0;

  for (let c = 0; c < clusters.length; c++) {
    const cluster = clusters[c];
    cluster.sort((a, b) => new Date(a.published_at || a.created_at) - new Date(b.published_at || b.created_at));
    const primary = cluster[0];
    const duplicates = cluster.slice(1);

    console.log(`\nCluster #${c + 1}: "${primary.headline}"`);
    console.log(`  [KEEP PRIMARY] [${primary.id}] (${primary.slug})`);

    for (const dup of duplicates) {
      console.log(`  [DELETE DUP]   [${dup.id}] (${dup.slug})`);
      await fetch(`${SUPABASE_URL}/rest/v1/news_article_politicians?article_id=eq.${dup.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${dup.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (delRes.ok) deleted++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`DEDUPLICATION COMPLETE: Deleted ${deleted} redundant duplicate copies.`);
  console.log(`Unique Articles Remaining: ${articles.length - deleted}`);
  console.log(`======================================================\n`);
}

async function checkAndRun() {
  if (dedupCount > 0) {
    await cleanDuplicates(dedupCount);
    return;
  }

  console.log(`\n======================================================`);
  console.log(`Choseno Automated 20+ Article Quality & Ingestion Loop`);
  console.log(`Target Minimum: ${minTarget} Unique Articles`);
  console.log(`======================================================\n`);

  // 1. Fetch ALL current database articles for comprehensive deduplication
  console.log('1. Querying Supabase for all existing articles and headlines...');
  let existingArticles = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=slug,headline,summary,published_at&order=published_at.desc&limit=${pageSize}&offset=${offset}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) break;
    const page = await res.json();
    existingArticles = existingArticles.concat(page || []);
    if (!page || page.length < pageSize) break;
    offset += pageSize;
  }

  const existingSlugs = new Set(existingArticles.map(r => r.slug));
  const existingHeadlines = existingArticles.map(r => ({
    norm: normalizeString(r.headline),
    tokens: getTokens(r.headline + ' ' + (r.summary || '')),
    slug: r.slug,
    headline: r.headline
  }));
  console.log(`Found ${existingArticles.length} existing articles in database to deduplicate against.`);

  // 2. Load candidate payload
  const batchFile = path.resolve(__dirname, 'bulk-news-batch.json');
  if (!fs.existsSync(batchFile)) {
    fs.writeFileSync(batchFile, '[]', 'utf8');
  }

  let candidates = [];
  try {
    candidates = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
  } catch (err) {
    console.error('Error reading bulk-news-batch.json:', err.message);
    process.exit(1);
  }

  // 3. Filter for unique non-duplicate articles
  const uniqueArticles = [];
  const seenBatchSlugs = new Set();
  const seenBatchHeadlines = [];

  for (const art of candidates) {
    if (!art.slug || !art.headline || !art.body) continue;

    // Check 1: Exact database slug collision
    if (existingSlugs.has(art.slug)) {
      console.log(`[EXISTS IN DB (Exact Slug)] Skipping duplicate: "${art.slug}"`);
      continue;
    }

    // Check 2: Batch duplicate slug
    if (seenBatchSlugs.has(art.slug)) {
      console.log(`[DUPLICATE IN BATCH (Slug)] Skipping duplicate: "${art.slug}"`);
      continue;
    }

    const normHead = normalizeString(art.headline);
    const tokens = getTokens(art.headline + ' ' + (art.summary || ''));

    // Check 3: Semantic headline & token similarity against existing database articles
    let isDbDuplicate = false;
    for (const ex of existingHeadlines) {
      if (ex.norm === normHead) {
        console.log(`[EXISTS IN DB (Exact Headline)] Skipping: "${art.headline}" -> Matches existing "${ex.headline}"`);
        isDbDuplicate = true;
        break;
      }
      const sim = jaccardSimilarity(tokens, ex.tokens);
      if (sim >= 0.45) {
        console.log(`[EXISTS IN DB (Semantic Similarity ${Math.round(sim * 100)}%)] Skipping: "${art.headline}" -> Matches existing "${ex.headline}"`);
        isDbDuplicate = true;
        break;
      }
    }
    if (isDbDuplicate) continue;

    // Check 4: Semantic duplicate within the candidate batch itself
    let isBatchDuplicate = false;
    for (const bh of seenBatchHeadlines) {
      if (bh.norm === normHead) {
        console.log(`[DUPLICATE IN BATCH (Exact Headline)] Skipping: "${art.headline}"`);
        isBatchDuplicate = true;
        break;
      }
      const sim = jaccardSimilarity(tokens, bh.tokens);
      if (sim >= 0.45) {
        console.log(`[DUPLICATE IN BATCH (Semantic Similarity ${Math.round(sim * 100)}%)] Skipping: "${art.headline}"`);
        isBatchDuplicate = true;
        break;
      }
    }
    if (isBatchDuplicate) continue;

    seenBatchSlugs.add(art.slug);
    seenBatchHeadlines.push({ norm: normHead, tokens });
    uniqueArticles.push(art);
  }

  let usCount = 0, caCount = 0;
  let totalWords = 0;
  for (const art of uniqueArticles) {
    if (art.country === 'US') usCount++;
    else if (art.country === 'CA') caCount++;
    const wordCount = (art.body || '').split(/\s+/).filter(Boolean).length;
    totalWords += wordCount;
  }
  const avgWords = Math.round(totalWords / (uniqueArticles.length || 1));

  console.log(`\nCurrent Batch Status: ${uniqueArticles.length} valid unique articles ready.`);
  console.log(`  🇺🇸 United States: ${usCount} (${Math.round((usCount / (uniqueArticles.length || 1)) * 100)}%) - Target: ~70% (14+)`);
  console.log(`  🇨🇦 Canada:        ${caCount} (${Math.round((caCount / (uniqueArticles.length || 1)) * 100)}%) - Target: ~30% (5-6)`);
  console.log(`  📝 Average Length: ${avgWords} words per article (CNN standard: 750–1,400+ words)`);

  if (uniqueArticles.length < minTarget) {
    const deficit = minTarget - uniqueArticles.length;
    console.log(`\n❌ [THRESHOLD NOT MET] Need ${deficit} more unique articles to reach target of ${minTarget}.`);
    console.log(`Agent must perform additional discovery loops across:`);
    console.log(`  - Federal / National Wires (US/CA)`);
    console.log(`  - State / Provincial Capitols`);
    console.log(`  - Municipal / City Councils`);
    console.log(`\nAppend ${deficit} more verified stories into scripts/bulk-news-batch.json and re-run.\n`);
    process.exit(2);
  }

  console.log(`\n✅ [THRESHOLD MET] ${uniqueArticles.length} >= ${minTarget}. Proceeding to auto-ingest into Supabase!`);

  // Write verified unique articles cleanly into insert script
  const insertScript = path.resolve(__dirname, 'insert-news-batch.js');
  let code = fs.readFileSync(insertScript, 'utf8');
  const replacement = `// 2. Article payload to ingest (Auto-verified 20+ batch)\nconst articles = ${JSON.stringify(uniqueArticles, null, 2)};`;
  
  const startIdx = code.indexOf('const articles =');
  const endIdx = code.indexOf('async function run()');
  if (startIdx !== -1 && endIdx !== -1) {
    const newCode = code.substring(0, startIdx) + replacement + '\n\n' + code.substring(endIdx);
    fs.writeFileSync(insertScript, newCode, 'utf8');
  }

  // Execute ingestion
  console.log('\nExecuting batch ingestion into Supabase...');
  try {
    execSync('node scripts/insert-news-batch.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log('\n✅ 20+ Article Ingestion and Politician Wall Synchronization Successful!\n');
    // Clear bulk file after successful ingestion
    fs.writeFileSync(batchFile, '[]', 'utf8');
  } catch (err) {
    console.error('\n❌ Ingestion error:', err.message);
    process.exit(1);
  }
}

checkAndRun();
