/** PostgREST caps every response at this many rows (Supabase's default `max_rows`). */
const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: unknown };

/**
 * Reads every row a query matches, one capped page at a time. Without this a
 * city-wide select silently stops at the first 1,000 rows, and the map and
 * leaderboards would assess only part of the evidence. The query must be
 * rebuilt per page and ordered on a unique column so pages never overlap.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
