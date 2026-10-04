// Anon queries have a 3s statement_timeout, and a cold DB connection pays its
// first-plan cost inside that budget, so a query that normally takes ~1s can
// time out once. Retry those; anything else fails fast.
export async function withRetry<T extends { error?: unknown }>(fn: () => PromiseLike<T>, attempts = 5): Promise<T> {
  let res = await fn();
  for (let i = 1; i < attempts; i++) {
    const msg = String((res.error as { message?: string } | null | undefined)?.message ?? "");
    if (!res.error || !/timeout|schema cache/i.test(msg)) break;
    await new Promise((r) => setTimeout(r, 1000 * i));
    res = await fn();
  }
  return res;
}
