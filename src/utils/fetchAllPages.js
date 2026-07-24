// Supabase caps any unbounded select/RPC result at 1000 rows by default.
// Pages through with .range() so large result sets (thousands of boundary
// shapes) don't silently get truncated into a partial result.
const PAGE_SIZE = 1000;

export async function fetchAllPages(buildQuery) {
  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    allRows = allRows.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { data: allRows, error: null };
}
