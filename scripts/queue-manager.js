/**
 * scripts/queue-manager.js
 *
 * Manages the candidate queue for parallel subagent synthesis:
 * 1. Prunes already-published database articles from latest-verified-rss-candidates.json.
 * 2. Splits the remaining backlog into N equal chunk files for parallel subagent workers.
 * 3. Merges worker outputs (scripts/worker-output-*.json) into scripts/bulk-news-batch.json.
 * 4. Invokes insert-news-batch.js and prunes completed items from the master queue.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
const QUEUE_FILE = path.join(__dirname, 'latest-verified-rss-candidates.json');

function getWords(str) {
  return new Set((str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2));
}

function overlapSimilarity(s1, s2) {
  const w1 = getWords(s1);
  const w2 = getWords(s2);
  if (w1.size === 0 || w2.size === 0) return 0;
  let inter = 0;
  for (const w of w1) if (w2.has(w)) inter++;
  return inter / Math.min(w1.size, w2.size);
}

async function getPublishedRecords() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/news_articles?select=headline,slug,summary,published_at&order=published_at.desc&limit=1000`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.warn('[QueueManager] Failed to fetch published records:', e.message);
    return [];
  }
}

/**
 * Prunes already published articles and splits the remaining queue into chunk files.
 * @param {number} numWorkers Number of subagent workers (e.g. 4)
 * @param {number} chunkSize Max items per worker (e.g. 5)
 */
async function splitQueueForWorkers(numWorkers = 4, chunkSize = 5) {
  if (!fs.existsSync(QUEUE_FILE)) {
    console.log('[QueueManager] No queue file found.');
    return { totalRemaining: 0, chunkFiles: [] };
  }

  const rawQueue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const publishedRecords = await getPublishedRecords();

  // Deduplicate against database
  const freshQueue = [];
  for (const item of rawQueue) {
    let inDb = false;
    for (const pub of publishedRecords) {
      if (overlapSimilarity(item.title, pub.headline) >= 0.35 || overlapSimilarity(item.title, pub.slug) >= 0.35) {
        inDb = true;
        break;
      }
    }
    if (!inDb) freshQueue.push(item);
  }

  // Update master queue with only fresh items
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(freshQueue, null, 2));
  console.log(`[QueueManager] Master queue has ${freshQueue.length} truly fresh, un-ingested candidates.`);

  if (freshQueue.length === 0) {
    return { totalRemaining: 0, chunkFiles: [] };
  }

  const chunkFiles = [];
  const maxTotalForThisWave = numWorkers * chunkSize;
  const itemsToAssign = freshQueue.slice(0, maxTotalForThisWave);

  for (let w = 0; w < numWorkers; w++) {
    const start = w * chunkSize;
    const end = start + chunkSize;
    const workerItems = itemsToAssign.slice(start, end);
    if (workerItems.length === 0) break;

    const chunkPath = path.join(__dirname, `worker-chunk-${w + 1}.json`);
    const outputPath = path.join(__dirname, `worker-output-${w + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(workerItems, null, 2));
    // Clear any previous output
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    chunkFiles.push({
      workerId: w + 1,
      chunkPath,
      outputPath,
      itemCount: workerItems.length,
      items: workerItems.map(i => i.title)
    });
  }

  return {
    totalRemaining: freshQueue.length,
    assignedThisWave: itemsToAssign.length,
    chunkFiles
  };
}

/**
 * Merges all worker output files into bulk-news-batch.json and executes ingestion.
 */
function mergeAndIngestWorkerOutputs() {
  const mergedArticles = [];
  const files = fs.readdirSync(__dirname);
  const outputFiles = files.filter(f => f.startsWith('worker-output-') && f.endsWith('.json'));

  for (const f of outputFiles) {
    const p = path.join(__dirname, f);
    try {
      const content = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(content)) {
        mergedArticles.push(...content);
      } else if (content && typeof content === 'object') {
        mergedArticles.push(content);
      }
    } catch (e) {
      console.warn(`[QueueManager] Error reading ${f}:`, e.message);
    }
  }

  console.log(`[QueueManager] Merged ${mergedArticles.length} synthesized articles from ${outputFiles.length} worker outputs.`);

  if (mergedArticles.length === 0) {
    console.log('[QueueManager] No synthesized articles to ingest.');
    return { insertedCount: 0 };
  }

  const bulkBatchPath = path.join(__dirname, 'bulk-news-batch.json');
  fs.writeFileSync(bulkBatchPath, JSON.stringify(mergedArticles, null, 2));

  // Run ingestion
  console.log(`[QueueManager] Invoking insert-news-batch.js for ${mergedArticles.length} articles...`);
  try {
    const output = execSync(`node "${path.join(__dirname, 'insert-news-batch.js')}" "${bulkBatchPath}"`, { encoding: 'utf8' });
    console.log(output);
  } catch (e) {
    console.error('[QueueManager] Ingestion error:', e.message);
  }

  // Clean up worker files
  for (const f of files) {
    if ((f.startsWith('worker-chunk-') || f.startsWith('worker-output-')) && f.endsWith('.json')) {
      try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {}
    }
  }

  // Re-read master queue
  let remainingInQueue = 0;
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      const q = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      remainingInQueue = q.length;
    } catch (e) {}
  }

  return {
    insertedCount: mergedArticles.length,
    remainingInQueue
  };
}

if (require.main === module) {
  const action = process.argv[2] || 'split';
  if (action === 'split') {
    const workers = parseInt(process.argv[3] || '4', 10);
    const size = parseInt(process.argv[4] || '5', 10);
    splitQueueForWorkers(workers, size).then(res => {
      console.log(JSON.stringify(res, null, 2));
    });
  } else if (action === 'merge') {
    const res = mergeAndIngestWorkerOutputs();
    console.log(JSON.stringify(res, null, 2));
  }
}

module.exports = {
  splitQueueForWorkers,
  mergeAndIngestWorkerOutputs
};
