/**
 * scripts/sequential-pipeline-runner.js
 *
 * Deterministic, Antigravity-Native sequential newsroom pipeline coordinator.
 *
 * ARCHITECTURE (100% Antigravity-Native / Zero External API Key Usage):
 * 1. Machine script owns 100% of feed collection, URL gatekeeping, and deduplication:
 *    - `node scripts/sequential-pipeline-runner.js --collect`
 *    - Harvests 116 verified US and Canadian feeds via `rss-feed-collector.js`.
 *    - Enforces strict Jaccard token overlap (>= 0.45) against Supabase.
 *    - Updates persistent master queue in `scripts/latest-verified-rss-candidates.json`.
 *
 * 2. Antigravity Agent executes 100% of journalistic research and synthesis:
 *    - `node scripts/sequential-pipeline-runner.js --pop`
 *    - Pops the next candidate into `scripts/current-candidate.json`.
 *    - Antigravity conducts live ground-truth web search and synthesizes a high-depth
 *      500-750 word non-partisan civic news report adhering to the Choseno schema.
 *    - Antigravity writes the output to `scripts/current-article.json`.
 *
 * 3. Machine script owns 100% of database ingestion, relational syncing, and queue pruning:
 *    - `node scripts/sequential-pipeline-runner.js --ingest`
 *    - Verifies quote and fact fidelity via `quote-and-fact-verifier.js`.
 *    - Ingests into Supabase via `insert-news-batch.js`.
 *    - Syncs politician activity walls, electoral GIS polygons, and OG share cards.
 *    - Automatically prunes the published candidate from `latest-verified-rss-candidates.json`.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  collectVerifiedRssStories,
  mergeCandidatesIntoQueue
} = require('./rss-feed-collector');
const { verifyArticleQuotesAndFacts } = require('./quote-and-fact-verifier');

const QUEUE_FILE = path.join(__dirname, 'latest-verified-rss-candidates.json');
const CURRENT_CANDIDATE_FILE = path.join(__dirname, 'current-candidate.json');
const CURRENT_ARTICLE_FILE = path.join(__dirname, 'current-article.json');

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

/**
 * Harvest and merge verified candidates into the persistent queue.
 */
async function collectFreshCandidates(maxHours = 24) {
  console.log('======================================================');
  console.log('CHOSENO NEWSROOM PIPELINE: FEED HARVESTING & DEDUPLICATION');
  console.log('======================================================\n');
  const fresh = await collectVerifiedRssStories({ maxHours });
  const queue = mergeCandidatesIntoQueue(fresh, QUEUE_FILE);
  console.log(`\n[Collector] Harvest complete. ${queue.length} total candidates in queue (${fresh.length} fresh discovered).`);
  return queue;
}

/**
 * Pop the next candidate from the master queue and write to scripts/current-candidate.json.
 */
function popNextCandidate() {
  const queue = loadQueue();
  if (queue.length === 0) {
    console.log(JSON.stringify({ status: 'empty', remaining: 0 }));
    if (fs.existsSync(CURRENT_CANDIDATE_FILE)) fs.unlinkSync(CURRENT_CANDIDATE_FILE);
    return null;
  }

  const candidate = queue[0];
  fs.writeFileSync(CURRENT_CANDIDATE_FILE, JSON.stringify(candidate, null, 2));
  console.log(JSON.stringify({
    status: 'ready',
    remaining: queue.length,
    candidate: {
      title: candidate.title,
      sourceName: candidate.sourceName,
      sourceUrl: candidate.sourceUrl,
      country: candidate.country,
      province: candidate.province || candidate.region,
      tier: candidate.tier,
      pubDate: candidate.pubDate
    }
  }, null, 2));
  return candidate;
}

/**
 * Ingest the synthesized article in scripts/current-article.json into Supabase and prune from queue.
 */
function ingestCurrentArticle() {
  if (!fs.existsSync(CURRENT_ARTICLE_FILE)) {
    console.error('[Ingest] Error: scripts/current-article.json does not exist.');
    return false;
  }

  let article;
  try {
    article = JSON.parse(fs.readFileSync(CURRENT_ARTICLE_FILE, 'utf8'));
  } catch (e) {
    console.error('[Ingest] Error parsing scripts/current-article.json:', e.message);
    return false;
  }

  // Load current candidate for quote/fact verification
  let currentCandidate = null;
  if (fs.existsSync(CURRENT_CANDIDATE_FILE)) {
    try {
      currentCandidate = JSON.parse(fs.readFileSync(CURRENT_CANDIDATE_FILE, 'utf8'));
    } catch (e) {}
  }

  if (currentCandidate) {
    const verification = verifyArticleQuotesAndFacts(article, currentCandidate);
    article.body = verification.sanitizedBody;
    if (article.content) {
      article.content.body = verification.sanitizedBody;
    }
  }

  const tempBatchPath = path.join(__dirname, 'temp-sequential-batch.json');
  fs.writeFileSync(tempBatchPath, JSON.stringify([article], null, 2));

  let success = false;
  try {
    const output = execSync(`node "${path.join(__dirname, 'insert-news-batch.js')}" "${tempBatchPath}"`, {
      encoding: 'utf8'
    });
    console.log(output);
    success = true;
  } catch (e) {
    console.error('[Ingest] Database ingestion error:', e.message);
  } finally {
    if (fs.existsSync(tempBatchPath)) fs.unlinkSync(tempBatchPath);
  }

  if (success) {
    // Prune candidate from queue
    if (currentCandidate) {
      const queue = loadQueue();
      const updatedQueue = queue.filter(item => {
        if (item.sourceUrl && currentCandidate.sourceUrl && item.sourceUrl === currentCandidate.sourceUrl) return false;
        return true;
      });
      saveQueue(updatedQueue);
      console.log(`[Queue] Pruned "${currentCandidate.title.slice(0, 50)}...". Remaining queue: ${updatedQueue.length}.`);
    }

    if (fs.existsSync(CURRENT_CANDIDATE_FILE)) fs.unlinkSync(CURRENT_CANDIDATE_FILE);
    if (fs.existsSync(CURRENT_ARTICLE_FILE)) fs.unlinkSync(CURRENT_ARTICLE_FILE);
  }

  return success;
}

/**
 * Skip and prune the current candidate if it cannot be synthesized.
 */
function skipCurrentCandidate() {
  if (!fs.existsSync(CURRENT_CANDIDATE_FILE)) {
    console.warn('[Skip] No current candidate file to skip.');
    return;
  }

  try {
    const currentCandidate = JSON.parse(fs.readFileSync(CURRENT_CANDIDATE_FILE, 'utf8'));
    const queue = loadQueue();
    const updatedQueue = queue.filter(item => item.sourceUrl !== currentCandidate.sourceUrl);
    saveQueue(updatedQueue);
    console.log(`[Queue] Skipped and pruned "${currentCandidate.title.slice(0, 50)}...". Remaining queue: ${updatedQueue.length}.`);
  } catch (e) {
    console.error('[Skip] Error skipping candidate:', e.message);
  } finally {
    if (fs.existsSync(CURRENT_CANDIDATE_FILE)) fs.unlinkSync(CURRENT_CANDIDATE_FILE);
    if (fs.existsSync(CURRENT_ARTICLE_FILE)) fs.unlinkSync(CURRENT_ARTICLE_FILE);
  }
}

/**
 * Print queue status and top items.
 */
function printQueueStatus() {
  const queue = loadQueue();
  console.log(JSON.stringify({
    remaining: queue.length,
    topCandidates: queue.slice(0, 5).map((c, i) => ({
      index: i + 1,
      title: c.title,
      source: c.sourceName,
      country: c.country,
      region: c.region || c.province
    }))
  }, null, 2));
}

if (require.main === module) {
  const action = process.argv[2];
  if (action === '--collect') {
    const maxHoursArg = process.argv.find((a, i) => process.argv[i - 1] === '--max-hours');
    const maxHours = maxHoursArg ? Number(maxHoursArg) : 24;
    collectFreshCandidates(maxHours).catch(console.error);
  } else if (action === '--pop') {
    popNextCandidate();
  } else if (action === '--ingest') {
    ingestCurrentArticle();
  } else if (action === '--skip') {
    skipCurrentCandidate();
  } else if (action === '--status') {
    printQueueStatus();
  } else {
    console.log(`Choseno Sequential Pipeline Coordinator (Antigravity-Native)
Usage:
  node scripts/sequential-pipeline-runner.js --collect [--max-hours N]   # Harvest fresh feeds into queue
  node scripts/sequential-pipeline-runner.js --pop                      # Pop next candidate into current-candidate.json
  node scripts/sequential-pipeline-runner.js --ingest                   # Ingest current-article.json into Supabase & prune
  node scripts/sequential-pipeline-runner.js --skip                     # Skip and prune current candidate
  node scripts/sequential-pipeline-runner.js --status                   # Show queue count and top items
`);
  }
}

module.exports = {
  collectFreshCandidates,
  popNextCandidate,
  ingestCurrentArticle,
  skipCurrentCandidate,
  printQueueStatus,
  loadQueue
};
