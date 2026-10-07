import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { getSeatById, getCandidatesBySeatIds } from "@/lib/services/elections";
import { getRacePickShareByCode } from "@/lib/services/pickShares";
import { toPickRoster, splitRoster } from "@/lib/utils/pickShare";

// generateMetadata, the page body and the OG image all need the same share +
// race roster; React cache() dedupes it to one set of round trips per request.
// Cookie-free client so the page and image stay statically cacheable.
export const loadPickShare = cache(async (code: string) => {
  if (!/^[a-z0-9]{6,12}$/.test(code)) return null;
  const supabase = createPublicClient();
  const { data: share, error } = await getRacePickShareByCode(supabase, code);
  // Throw on a DB error so ISR never caches a transient failure as a 404.
  if (error) throw error;
  if (!share) return null;

  const [{ data: seat }, { data: rows }] = await Promise.all([
    getSeatById(supabase, share.seatId),
    getCandidatesBySeatIds(supabase, [share.seatId]),
  ]);
  if (!seat) return null;

  const roster = toPickRoster((rows as any[]) || []);
  const { picked, others } = splitRoster(roster, share.picks);
  // Every pick may have been withdrawn since sharing (candidate deleted).
  if (picked.length === 0) return null;
  return { share, seat: seat as any, picked, others };
});
