import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";

type Client = SupabaseClient<Database>;

// ── politician_ratings ──────────────────────────────────────────────────
// 5-star rating + optional written comment, one per constituent per
// politician, cast once and re-castable every 6 months (see
// 20260808000002_politician_rating_six_month_cooldown.sql) — opinions of a
// politician's performance change, so a lock is temporary, not permanent.
// Writes go through the upsert_politician_rating/delete_politician_rating
// RPCs (SECURITY DEFINER, same pattern as create_comment) so the backend
// enforces no-self-rating, the cooldown, target-is-a-politician, and
// ghost-id attribution — never a direct politician_ratings.insert() here.

// Only the timestamp of the caller's own rating, never its value — the UI
// computes the 6-month cooldown from this without handing the rating back,
// so it stays sealed like a ballot even from the person who cast it.
export async function getMyRatingTimestamp(supabase: Client, politicianId: string, raterId: string) {
  return supabase
    .from("politician_ratings")
    .select("updated_at")
    .eq("politician_id", politicianId)
    .eq("rater_id", raterId)
    .maybeSingle();
}

export async function upsertPoliticianRating(
  supabase: Client,
  politicianId: string,
  rating: number,
  comment?: string | null,
  // The news article the rater was reading when they rated, if any (see
  // migration 20260822000002_politician_rating_news_article_source.sql) --
  // shown as a "via <headline>" link wherever this rating is later listed,
  // so a reader of a politician's past reviews can see what prompted each
  // one. Omitted entirely for a rating cast directly from the politician's
  // own profile/wall or any other non-article context, which is exactly
  // what leaves it with no link. The RPC itself re-verifies this article
  // actually tags the politician before trusting it, not just this client.
  newsArticleId?: string | null
) {
  return supabase.rpc("upsert_politician_rating", {
    p_politician_id: politicianId,
    p_rating: rating,
    p_comment: comment ?? undefined,
    p_is_test: isDevEnvironment(),
    p_news_article_id: newsArticleId ?? undefined,
  });
}

export async function deletePoliticianRating(supabase: Client, politicianId: string) {
  return supabase.rpc("delete_politician_rating", { p_politician_id: politicianId });
}

// Batch supporter-count + rating avg/count/comment-count for however many
// politicians a widget needs at once (candidate rosters, office-holder
// lists, sidebars, the wall page itself) — one round trip instead of
// querying politician_supporters and politician_ratings separately per
// card. Always returns one row per requested id, even with zero engagement
// (see get_politician_engagement_summaries), so widgets can render a "0
// supporters, no ratings yet" line instead of hiding stats entirely. Call
// sites with a single id still pass a 1-element array rather than a
// separate near-duplicate function (see docs/SERVICES.md).
export async function getPoliticianEngagementSummaries(supabase: Client, politicianIds: string[]) {
  const ids = [...new Set(politicianIds.filter(Boolean))];
  if (ids.length === 0) return { data: [], error: null };
  return supabase.rpc("get_politician_engagement_summaries", {
    p_politician_ids: ids,
    p_include_test: isDevEnvironment(),
  });
}

// Individual reviews (rating + comment + ghost_id) for the wall page's
// review list, most-recently-(re)cast first — public read RLS, no RPC
// needed. Sorted by updated_at, not created_at, so a refreshed 6-months-on
// opinion resurfaces to the top like an edited Google review would.
export async function getPoliticianRatingsList(supabase: Client, politicianId: string) {
  let query = supabase
    .from("politician_ratings")
    // news_articles(slug, headline) -- the "via <headline>" source link
    // (see migration 20260822000002_politician_rating_news_article_source.sql).
    // Null on both sides (source_news_article_id and the embed) for a
    // rating cast outside any article context.
    .select("id, rating, comment, ghost_id, created_at, updated_at, source_news_article_id, news_articles(slug, headline)")
    .eq("politician_id", politicianId)
    .order("updated_at", { ascending: false });
  if (!isDevEnvironment()) query = query.eq("is_test", false);
  return query;
}
