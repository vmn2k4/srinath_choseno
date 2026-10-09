import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { getSeatById, getCandidatesBySeatIds } from "@/lib/services/elections";
import { getRacePickShareByCode } from "@/lib/services/pickShares";
import { getVotingPlacesForShape } from "@/lib/services/votingPlaces";
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

// Election day + advance-voting dates for the share card. Kept out of
// loadPickShare so the page itself doesn't pay for this query. Best-effort: a
// failure just means the card omits the dates.
export async function loadVotingInfo(seat: {
  map_shape_id?: number | null;
  elections?: { election_date?: string | null } | null;
}) {
  const electionDate = seat.elections?.election_date ?? null;
  let advanceDates: string[] = [];
  let hasPlaces = false;
  if (seat.map_shape_id && electionDate) {
    try {
      const { data } = await getVotingPlacesForShape(createPublicClient(), seat.map_shape_id, electionDate);
      hasPlaces = (data?.length || 0) > 0;
      advanceDates = [
        ...new Set(
          (data || []).flatMap((p) =>
            p.voting_place_schedules.filter((s) => s.voting_type === "advance").map((s) => s.vote_date)
          )
        ),
      ].sort();
    } catch {
      // omit
    }
  }
  return { electionDate, advanceDates, hasPlaces };
}
