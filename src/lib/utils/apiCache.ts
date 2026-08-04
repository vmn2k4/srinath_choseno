// Lightweight in-memory cache with TTL and in-flight request deduplication.
// Ported from the Vite app's src/utils/apiCache.js unchanged.
//
// Client-Component use only. In Next.js, module state is a per-server-process
// singleton shared across every request that server handles -- fine for
// genuinely global data (e.g. the site-wide theme, this cache's only caller
// so far), but never use this for per-user data from a Server Component or
// Route Handler, since one user's cached response could leak into another
// user's response on the same server instance.

type FetchResult<T> = { data: T | null; error: unknown };

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const inFlight = new Map<string, Promise<FetchResult<unknown>>>();

// `fetcher` is typed as PromiseLike, not Promise -- Supabase's query
// builders (e.g. `supabase.from(...).select(...).single()`) are thenables
// that resolve to a `{ data, error }` shape but aren't literally the
// built-in Promise class, so a stricter `Promise<...>` annotation here
// would reject every real call site.
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => PromiseLike<FetchResult<T>>,
  ttlMs = 5 * 60 * 1000
): Promise<FetchResult<T>> {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now < cached.expiresAt) {
    return { data: cached.data as T, error: null };
  }

  if (inFlight.has(key)) {
    return inFlight.get(key) as Promise<FetchResult<T>>;
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      if (!result.error && result.data !== undefined) {
        cache.set(key, { data: result.data, expiresAt: now + ttlMs });
      }
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export function invalidateCache(keyOrPrefix?: string) {
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
