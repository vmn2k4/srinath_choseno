import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";

type Client = SupabaseClient<Database>;

// ── news_article_polls ──────────────────────────────────────────────────
// Reader-facing "which option do you support?" widget an admin attaches to
// a news article -- a story can carry more than one (e.g. "which party?"
// and "which promise?" on the same election piece). See migration
// 20260927000000_news_article_polls.sql. Modeled on ratings.ts:
// definition tables (polls/options) are public-read + admin-write directly
// through RLS (no RPC needed -- there's no per-person integrity rule to
// protect for authoring), but every VOTE goes through the
// cast_news_article_poll_vote RPC so one-vote-per-person can't be bypassed
// by a direct client insert, and tallies come from the
// get_news_article_poll_results RPC so nobody needs raw SELECT on the votes
// table to see the count.

export interface NewsArticlePollOption {
  id: string;
  label: string;
  sort_order: number;
}

export interface NewsArticlePoll {
  id: string;
  news_article_id: string;
  question: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  news_article_poll_options: NewsArticlePollOption[];
}

/** All polls (with their options) attached to one article, in author-defined order. */
export async function getNewsArticlePolls(
  supabase: Client,
  articleId: string
): Promise<{ data: NewsArticlePoll[] | null; error: PostgrestError | null }> {
  return (supabase as any)
    .from("news_article_polls")
    .select("id, news_article_id, question, sort_order, created_at, updated_at, news_article_poll_options(id, label, sort_order)")
    .eq("news_article_id", articleId)
    .order("sort_order", { ascending: true })
    .order("sort_order", { ascending: true, referencedTable: "news_article_poll_options" });
}

/**
 * Per-option vote counts for however many polls a page needs at once (one
 * article can carry several). Runs through get_news_article_poll_results,
 * which is SECURITY DEFINER -- it bypasses the votes table's own-row-only
 * read policy on purpose, but only ever returns counts, never a voter_id.
 */
export async function getNewsArticlePollResults(
  supabase: Client,
  pollIds: string[]
): Promise<{ data: Array<{ poll_id: string; option_id: string; vote_count: number }> | null; error: PostgrestError | null }> {
  if (pollIds.length === 0) return { data: [], error: null };
  return (supabase.rpc as any)("get_news_article_poll_results", {
    p_poll_ids: pollIds,
    p_include_test: isDevEnvironment(),
  });
}

/**
 * The signed-in reader's own vote on however many polls are on the page, if
 * any -- drives "you picked X" instead of showing the ballot form again.
 * Public read RLS on news_article_poll_votes only ever returns the caller's
 * own row (voter_id = auth.uid()), so this is a plain select, no RPC.
 * Returns [] for a signed-out visitor (auth.uid() is null, so the policy
 * matches nothing) rather than erroring.
 */
export async function getMyNewsArticlePollVotes(
  supabase: Client,
  pollIds: string[]
): Promise<{ data: Array<{ poll_id: string; option_id: string }> | null; error: PostgrestError | null }> {
  if (pollIds.length === 0) return { data: [], error: null };
  return (supabase as any)
    .from("news_article_poll_votes")
    .select("poll_id, option_id")
    .in("poll_id", pollIds);
}

/** Casts (or changes) the signed-in reader's vote on one poll. */
export async function castNewsArticlePollVote(supabase: Client, optionId: string) {
  return (supabase.rpc as any)("cast_news_article_poll_vote", {
    p_option_id: optionId,
    p_is_test: isDevEnvironment(),
  });
}

// ── Anonymous voting ─────────────────────────────────────────────────────
// A signed-out reader votes too -- no account required, same trade the
// site already makes for candidate support (see anonSupporter.ts /
// 20260910000000_anonymous_politician_support.sql). Dedup is a random
// anon_id minted client-side (src/lib/utils/anonPollVoter.ts), backstopped
// by an IP rate limit in cast_anonymous_news_article_poll_vote -- see
// 20260927000001_anonymous_news_article_poll_votes.sql.

/**
 * A returning anonymous voter's own pick on however many polls are on the
 * page, if any. Plain select, not an RPC: news_article_anon_poll_votes is
 * public-read (its rows carry no PII beyond a random anon_id), so this
 * works the same for every caller regardless of sign-in state.
 */
export async function getMyAnonymousNewsArticlePollVotes(
  supabase: Client,
  pollIds: string[],
  anonId: string
): Promise<{ data: Array<{ poll_id: string; option_id: string }> | null; error: PostgrestError | null }> {
  if (pollIds.length === 0) return { data: [], error: null };
  return (supabase as any)
    .from("news_article_anon_poll_votes")
    .select("poll_id, option_id")
    .eq("anon_id", anonId)
    .in("poll_id", pollIds);
}

/** Casts (or changes) a signed-out reader's vote on one poll. */
export async function castAnonymousNewsArticlePollVote(supabase: Client, optionId: string, anonId: string) {
  return (supabase.rpc as any)("cast_anonymous_news_article_poll_vote", {
    p_option_id: optionId,
    p_anon_id: anonId,
    p_is_test: isDevEnvironment(),
  });
}

// ── Admin authoring ──────────────────────────────────────────────────────
// Direct table writes, gated by the "Admins can manage news article polls
// / poll options" RLS policies -- same pattern as createNewsArticle in
// news.ts, no RPC needed since there's nothing here an admin shouldn't be
// trusted to set directly.

/** Creates a poll with its options in one call (options inserted in the order given). */
export async function createNewsArticlePoll(
  supabase: Client,
  articleId: string,
  question: string,
  optionLabels: string[],
  sortOrder = 0
): Promise<{ data: NewsArticlePoll | null; error: PostgrestError | null }> {
  const { data: poll, error: pollError } = await (supabase as any)
    .from("news_article_polls")
    .insert({ news_article_id: articleId, question, sort_order: sortOrder })
    .select()
    .single();
  if (pollError || !poll) return { data: null, error: pollError };

  const optionRows = optionLabels
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, i) => ({ poll_id: poll.id, label, sort_order: i }));

  const { data: options, error: optionsError } = await (supabase as any)
    .from("news_article_poll_options")
    .insert(optionRows)
    .select();
  if (optionsError) return { data: null, error: optionsError };

  return { data: { ...poll, news_article_poll_options: options ?? [] }, error: null };
}

export async function updateNewsArticlePollQuestion(supabase: Client, pollId: string, question: string) {
  return (supabase as any).from("news_article_polls").update({ question }).eq("id", pollId).select().single();
}

/** Deletes a poll (options + votes cascade at the DB level). */
export async function deleteNewsArticlePoll(supabase: Client, pollId: string) {
  return (supabase as any).from("news_article_polls").delete().eq("id", pollId);
}

export async function addNewsArticlePollOption(supabase: Client, pollId: string, label: string, sortOrder: number) {
  return (supabase as any)
    .from("news_article_poll_options")
    .insert({ poll_id: pollId, label, sort_order: sortOrder })
    .select()
    .single();
}

export async function deleteNewsArticlePollOption(supabase: Client, optionId: string) {
  return (supabase as any).from("news_article_poll_options").delete().eq("id", optionId);
}
