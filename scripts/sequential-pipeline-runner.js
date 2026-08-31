/**
 * scripts/sequential-pipeline-runner.js
 *
 * Deterministic, script-orchestrated sequential newsroom pipeline.
 * Quality-first alternative to the concurrent batch mode in
 * rss-verified-pipeline.js: processes exactly one candidate at a time,
 * ingesting and pruning it before moving to the next, so progress is never
 * lost to an interruption and there is no batch-level ambiguity about how
 * much got done.
 *
 * Fixed 2026-08-31 (day this file was introduced): the original version of
 * this file reimplemented dedup and jurisdiction filtering from scratch
 * instead of reusing rss-feed-collector.js's tested versions — with real,
 * consequential divergences: a different similarity FORMULA (overlap
 * coefficient, not Jaccard) at a looser threshold (0.35 vs 0.45), and a
 * much smaller jurisdiction pattern set missing this session's specific
 * fixes (viral/human-interest framing, the Governor-Livingston-HS sports
 * false positive, the Sinaloa/foreign-primary-subject heuristic). It also
 * never called the collector itself, so if this script is the only thing a
 * schedule invokes, new-story discovery silently stops the moment the
 * existing queue drains. All three fixed below by importing and reusing
 * the real functions instead of a second, drifting copy of the same logic.
 *
 * Architecture:
 * 1. Runs the SAME discovery step as rss-verified-pipeline.js
 *    (collectVerifiedRssStories + mergeCandidatesIntoQueue) so the queue
 *    is refreshed with new candidates every run, not just drained from a
 *    static snapshot someone else populated.
 * 2. Processes candidates sequentially ONE BY ONE:
 *    - Pops the next candidate from the front of the queue.
 *    - Synthesizes via the same synthesizeCivicStory() used by the batch
 *      pipeline (500-word floor, multi-model search-grounded enrichment).
 *    - Code-level quote/fact verification (verifyArticleQuotesAndFacts).
 *    - Ingests immediately via insert-news-batch.js, which also prunes
 *      this candidate from the queue file on success — no second,
 *      redundant pruning implementation here.
 * 3. Proceeds to the next candidate in an unbroken loop until the queue is
 *    empty or --max-stories is reached.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  collectVerifiedRssStories,
  mergeCandidatesIntoQueue
} = require('./rss-feed-collector');
const { synthesizeCivicStory } = require('./rss-verified-pipeline');
const { verifyArticleQuotesAndFacts } = require('./quote-and-fact-verifier');

const QUEUE_FILE = path.join(__dirname, 'latest-verified-rss-candidates.json');

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Ingest a single synthesized article via insert-news-batch.js. That
 * script's own candidate-coverage reconciliation step handles pruning this
 * item from the queue on success — no separate prune implementation here,
 * so there's one place that logic can drift, not two.
 */
function ingestSingleArticle(article) {
  const tempPath = path.join(__dirname, 'temp-sequential-batch.json');
  fs.writeFileSync(tempPath, JSON.stringify([article], null, 2));

  try {
    const output = execSync(`node "${path.join(__dirname, 'insert-news-batch.js')}" "${tempPath}"`, {
      encoding: 'utf8'
    });
    console.log(output);
    return true;
  } catch (e) {
    console.error('[SequentialRunner] Ingestion error:', e.message);
    return false;
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

/**
 * Remove a candidate from the queue on a synthesis failure (empty body,
 * thrown exception) — the ONE case insert-news-batch.js never sees this
 * item, so nothing else will prune it. Matched by sourceUrl, same signal
 * used everywhere else in the queue lifecycle.
 */
function pruneFailedCandidate(targetCandidate) {
  const queue = loadQueue();
  const remaining = queue.filter(item => item.sourceUrl !== targetCandidate.sourceUrl);
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(remaining, null, 2));
}

/**
 * Run continuous sequential synthesis loop.
 * @param {Object} options
 * @param {number} options.maxStories Optional limit for this run (default: process all remaining)
 * @param {number} options.maxHours Lookback for the discovery step (default: auto via collectVerifiedRssStories)
 */
async function runSequentialPipeline(options = {}) {
  console.log('======================================================');
  console.log('CHOSENO SEQUENTIAL SCRIPT-CONTROLLED PIPELINE RUNNER');
  console.log('Mode: Sequential Quality-First Synthesis (1-by-1)');
  console.log('======================================================\n');

  // Same discovery + persistent-queue merge as rss-verified-pipeline.js —
  // without this, the queue only ever shrinks and this script eventually
  // runs dry regardless of how much real news exists.
  const fresh = await collectVerifiedRssStories({ maxHours: options.maxHours });
  let queue = mergeCandidatesIntoQueue(fresh, QUEUE_FILE);
  console.log(`[SequentialRunner] Starting with ${queue.length} verified candidate stories in queue (${fresh.length} newly discovered this run).`);

  if (queue.length === 0) {
    console.log('[SequentialRunner] Queue is empty. No candidates to process.');
    return { processed: 0, remaining: 0 };
  }

  let processedCount = 0;
  const maxToProcess = options.maxStories || queue.length;

  while (queue.length > 0 && processedCount < maxToProcess) {
    const candidate = queue[0];
    const currentIndex = processedCount + 1;

    console.log(`\n------------------------------------------------------`);
    console.log(`[Story ${currentIndex}/${maxToProcess}] Processing Candidate: "${candidate.title}"`);
    console.log(`Source: ${candidate.sourceName} | Jurisdiction: ${candidate.country} / ${candidate.region || 'National'}`);
    console.log(`------------------------------------------------------`);

    try {
      const synthesized = await synthesizeCivicStory(candidate);

      if (!synthesized || !synthesized.body) {
        console.warn(`[SequentialRunner] Synthesis returned empty body for: "${candidate.title}". Pruning and continuing.`);
        pruneFailedCandidate(candidate);
        queue = loadQueue();
        continue;
      }

      const verification = verifyArticleQuotesAndFacts(synthesized, candidate);
      synthesized.body = verification.sanitizedBody;
      synthesized.content = {
        body: verification.sanitizedBody,
        seoTitle: synthesized.seoTitle,
        metaDescription: synthesized.metaDescription,
        tags: synthesized.tags,
        tweet: synthesized.tweet,
        author: synthesized.author,
        sources: [{ name: candidate.sourceName, url: candidate.sourceUrl }]
      };

      const words = synthesized.body.trim().split(/\s+/).filter(Boolean).length;
      console.log(`[SequentialRunner] Synthesized: "${synthesized.headline}" (${words} words)`);

      const success = ingestSingleArticle(synthesized);

      if (success) {
        processedCount++;
        console.log(`[SequentialRunner] Successfully published story ${processedCount}.`);
      } else {
        console.warn(`[SequentialRunner] Ingestion failed for "${candidate.title}". Retaining in queue for retry.`);
        break;
      }

      // insert-news-batch.js prunes on success; just re-read its result.
      queue = loadQueue();
      console.log(`[SequentialRunner] Queue status: ${queue.length} candidate(s) remaining.`);

    } catch (err) {
      console.error(`[SequentialRunner] Error processing "${candidate.title}":`, err.message);
      pruneFailedCandidate(candidate);
      queue = loadQueue();
    }
  }

  console.log('\n======================================================');
  console.log(`SEQUENTIAL RUN COMPLETE: ${processedCount} stories published. ${queue.length} remaining in queue.`);
  console.log('======================================================');

  return {
    processed: processedCount,
    remaining: queue.length
  };
}

if (require.main === module) {
  const maxStoriesArg = process.argv.find((a, i) => process.argv[i - 1] === '--max-stories');
  const maxHoursArg = process.argv.find((a, i) => process.argv[i - 1] === '--max-hours');
  runSequentialPipeline({
    maxStories: maxStoriesArg ? parseInt(maxStoriesArg, 10) : undefined,
    maxHours: maxHoursArg ? Number(maxHoursArg) : undefined
  }).catch(console.error);
}

module.exports = {
  runSequentialPipeline
};
