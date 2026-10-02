// Compares a sitemap against the database so a silent gap (like the old
// 1,000-row cut-off that dropped every seat and candidate page) can't go
// unnoticed. Usage:
//   npx tsx --env-file=.env.local scripts/check-sitemap-coverage.mts [sitemapUrl]
// Default sitemapUrl is the local dev server. Exits 1 on any shortfall.
import { createClient } from "@supabase/supabase-js";

const url = process.argv[2] || "http://localhost:3000/sitemap.xml";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const LIVE = ["nominations_open", "nominations_closed", "active"];

const res = await fetch(url, { headers: { "User-Agent": "Googlebot" } });
if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
const locs = [...(await res.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
const seatUrls = locs.filter((u) => u.includes("/elections/seat/") && !u.includes("/candidate/")).length;
const candidateUrls = locs.filter((u) => u.includes("/candidate/")).length;
const hubUrls = locs.filter((u) => /\/elections\/e\/[^/]+$/.test(u)).length;

// PostgREST caps every response at 1,000 rows, so page through everything.
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}
const seats = await all<{ id: string }>((from, to) =>
  sb.from("election_seats").select("id, elections!inner(status)").in("elections.status", LIVE).order("id").range(from, to)
);
const seatIds = seats.map((s) => s.id);
let candidates = 0;
const seatsWithCandidates = new Set<string>();
for (let i = 0; i < seatIds.length; i += 50) {
  const rows = await all<{ seat_id: string }>((from, to) =>
    sb
      .from("election_candidates")
      .select("id, seat_id, profiles!election_candidates_politician_id_fkey!inner(is_test)")
      .in("seat_id", seatIds.slice(i, i + 50))
      .eq("profiles.is_test", false)
      .order("id")
      .range(from, to)
  );
  candidates += rows.length;
  rows.forEach((c) => seatsWithCandidates.add(c.seat_id));
}
const { data: elections } = await sb.from("elections").select("id").in("status", LIVE);

const rows = [
  ["seat pages", seatUrls, seatsWithCandidates.size],
  ["seat-candidate pages", candidateUrls, candidates],
  ["election hubs (>=)", hubUrls, 1],
] as const;
let bad = false;
for (const [label, inSitemap, expected] of rows) {
  const ok = inSitemap >= expected;
  if (!ok) bad = true;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}: sitemap ${inSitemap} / database ${expected}`);
}
console.log(`live elections: ${elections?.length}, total sitemap URLs: ${locs.length}`);
process.exit(bad ? 1 : 0);
