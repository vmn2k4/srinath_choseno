import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";

type Client = SupabaseClient<Database>;

// "Share my picks" (race_pick_shares). Types for these tables aren't in the
// generated types.ts yet, so table/RPC names are cast -- same approach as
// recordSignupSource in profile.ts. Writes only go through the
// SECURITY DEFINER RPCs in 20261008000000_race_pick_shares.sql, which
// enforce the invariants (picks belong to the seat, note length/links, rate
// limit); the client-side checks in PickShareDialog are just for UX.

export const PICK_SHARE_NOTE_MAX = 140;
export const PICK_SHARE_NAME_MAX = 40;

export async function createRacePickShare(
  supabase: Client,
  args: {
    seatId: string;
    // Ordered picks; each may carry its own "why I support them" note.
    picks: { candidateId: string; note?: string }[];
    authorLabel?: string;
    anonId?: string | null;
  }
) {
  return (supabase as any).rpc("create_race_pick_share", {
    p_seat_id: args.seatId,
    p_candidate_ids: args.picks.map((p) => p.candidateId),
    p_note: null,
    p_pick_notes: args.picks.map((p) => p.note?.trim() || ""),
    p_author_label: args.authorLabel || null,
    p_anon_id: args.anonId || null,
    p_is_test: isDevEnvironment(),
  }) as Promise<{ data: string | null; error: { message: string } | null }>;
}

// Explicit columns: the table's identity/abuse columns (creator_id,
// anon_id, report_count) are not granted to anon/authenticated.
export async function getRacePickShareByCode(supabase: Client, code: string) {
  const { data: share, error } = await (supabase as any)
    .from("race_pick_shares")
    .select("id, code, seat_id, note, author_label, created_at")
    .eq("code", code)
    .is("removed_at", null)
    .maybeSingle();
  if (error || !share) return { data: null, error };

  const { data: picks, error: picksError } = await (supabase as any)
    .from("race_pick_share_picks")
    .select("candidate_id, position, note")
    .eq("share_id", share.id)
    .order("position", { ascending: true });

  return {
    data: {
      id: share.id as string,
      code: share.code as string,
      seatId: share.seat_id as string,
      note: (share.note as string | null) ?? null,
      authorLabel: (share.author_label as string | null) ?? null,
      createdAt: share.created_at as string,
      picks: ((picks || []) as { candidate_id: string; note: string | null }[]).map((p) => ({
        candidateId: p.candidate_id,
        note: p.note || null,
      })),
    },
    error: picksError,
  };
}

export async function reportRacePickShare(supabase: Client, code: string) {
  return (supabase as any).rpc("report_race_pick_share", { p_code: code }) as Promise<{
    error: { message: string } | null;
  }>;
}
