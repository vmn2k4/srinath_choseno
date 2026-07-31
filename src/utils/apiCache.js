// Lightweight in-memory cache with TTL and in-flight request deduplication.
// Dramatically reduces redundant REST API calls to Supabase, saving bandwidth
// and backend cost while making page navigation instant.

const cache = new Map();
const inFlight = new Map();

/**
 * Executes an async fetcher function with caching and request deduplication.
 * @param {string} key Unique cache key
 * @param {Function} fetcher Async function that returns { data, error }
 * @param {number} ttlMs Time-to-live in milliseconds (default: 5 minutes)
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function fetchWithCache(key, fetcher, ttlMs = 5 * 60 * 1000) {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now < cached.expiresAt) {
    return { data: cached.data, error: null };
  }

  // Deduplicate concurrent requests for the exact same key
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      if (!result.error && result.data !== undefined) {
        cache.set(key, {
          data: result.data,
          expiresAt: now + ttlMs,
        });
      }
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/**
 * Manually invalidates a specific cache key or prefix.
 * @param {string} keyOrPrefix Key or key prefix to invalidate
 */
export function invalidateCache(keyOrPrefix) {
  if (!keyOrPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyOrPrefix)) {
      cache.delete(key);
    }
  }
}
