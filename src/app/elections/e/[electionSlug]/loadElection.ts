import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/publicServer";
import {
  getElectionById,
  getElectionCandidatesWithParty,
  getElectionSeatsByElectionId,
} from "@/lib/services/elections";
import { extractIdFromSlug } from "@/lib/utils/slugs";
import { toRosterCandidates, type RosterSeat } from "@/lib/utils/electionParties";

// generateMetadata and the page body both need the same election + roster.
// Deduped via React cache() so it's one set of DB round trips per request.
// Cookie-free client: these pages are public + ISR-cached (a draft election
// is invisible to it by RLS, which resolves to a 404 -- the right outcome).
export const loadElection = cache(async (electionSlug: string) => {
  const electionId = extractIdFromSlug(electionSlug);
  if (electionId.length !== 36) return null;
  const supabase = await createPublicClient();
  const { data: election, error: electionError } = await getElectionById(supabase, electionId);
  // Throw on a DB error instead of returning null/empty: ISR would cache that
  // as a 404 or "0 candidates" page for a day. A throw is never cached (and
  // keeps the last good page on revalidation).
  if (electionError) throw electionError;
  if (!election) return null;
  const [{ data: rows, error: rowsError }, { data: seats, error: seatsError }] = await Promise.all([
    getElectionCandidatesWithParty(supabase, election.id),
    getElectionSeatsByElectionId(supabase, election.id),
  ]);
  if (rowsError || seatsError) throw rowsError || seatsError;
  return {
    election,
    roster: toRosterCandidates(rows || []),
    seats: (seats || []) as unknown as RosterSeat[],
  };
});

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  nominations_open: "Nominations open",
  nominations_closed: "Nominations closed",
  active: "Voting open",
  completed: "Completed",
};
