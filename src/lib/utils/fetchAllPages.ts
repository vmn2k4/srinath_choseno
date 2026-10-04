// Supabase caps any unbounded select/RPC result at 1000 rows by default.
// Pages through with .range() so large result sets (thousands of boundary
// shapes) don't silently get truncated into a partial result.
const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: unknown };

// pageSize: smaller pages for heavy joins that would exceed the anon role's
// 3s statement_timeout at 1000 rows.
export async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = PAGE_SIZE
): Promise<PageResult<T>> {
  let allRows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) return { data: null, error };
    allRows = allRows.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { data: allRows, error: null };
}
