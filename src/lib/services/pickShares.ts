import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";
import { addSupport, addAnonymousSupport } from "@/lib/services/politicianWall";
import { upsertPoliticianRating } from "@/lib/services/ratings";

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

// Cheap liveness check (one tiny query) so the OG route never serves a stored
// image for a share that has since been reported/removed.
export async function isRacePickShareLive(supabase: Client, code: string) {
  const { data } = await (supabase as any)
    .from("race_pick_shares")
    .select("id")
    .eq("code", code)
    .is("removed_at", null)
    .maybeSingle();
  return Boolean(data);
}

export type PickShareEngagementResult = {
  // politician profile ids the sharer now supports / reviewed because of this share
  supportedProfileIds: string[];
  ratedProfileIds: string[];
  // reviews the rating RPC refused (already reviewed within 6 months, self-rating, ...)
  reviewsSkipped: number;
};

// Connects a share to the rest of Choseno's engagement data. Best-effort and
// idempotent -- the share itself is already created, so nothing here may
// throw or block it:
//  - support: same writes as the Support button (signed-in, or anonymous when
//    the admin kill switch allows). Already supporting counts as success.
//  - review: a 5-star rating whose comment is the sharer's message for that
//    candidate. Signed-in only (ratings are tied to an account), and only for
//    picks that have a message. upsert_politician_rating enforces the
//    6-month cooldown and no-self-rating, so an existing recent rating is
//    never overwritten -- those picks are just counted as skipped.
export async function applyPickShareEngagement(
  supabase: Client,
  args: {
    picks: { profileId?: string | null; note?: string }[];
    userId?: string | null;
    anonId?: string | null;
    support: boolean;
    review: boolean;
  }
): Promise<PickShareEngagementResult> {
  const result: PickShareEngagementResult = { supportedProfileIds: [], ratedProfileIds: [], reviewsSkipped: 0 };

  await Promise.all(
    args.picks.map(async (pick) => {
      const id = pick.profileId;
      if (!id) return;

      if (args.support) {
        try {
          if (args.userId) {
            const { error } = await addSupport(supabase, id, args.userId);
            // 23505 = already supports this politician
            if (!error || (error as { code?: string }).code === "23505") result.supportedProfileIds.push(id);
          } else if (args.anonId) {
            const { error } = await addAnonymousSupport(supabase, id, args.anonId);
            if (!error) result.supportedProfileIds.push(id);
          }
        } catch {
          // ignore: support is a bonus, the share already exists
        }
      }

      const note = pick.note?.trim();
      if (args.review && args.userId && note) {
        try {
          const { error } = await upsertPoliticianRating(supabase, id, 5, note);
          if (error) result.reviewsSkipped += 1;
          else result.ratedProfileIds.push(id);
        } catch {
          result.reviewsSkipped += 1;
        }
      }
    })
  );

  return result;
}
