import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";
import { convertToPackificTime } from "@/lib/utils/timezone";
import { fetchAllPages } from "@/lib/utils/fetchAllPages";

type Client = SupabaseClient<Database>;
type NewsArticleRow = Database["public"]["Tables"]["news_articles"]["Insert"];

// ── Domain constants (the JSON "enums") ─────────────────────────────────────
//
// JSON has no native enum type, so these are the single source of truth for
// every place that needs to validate/render one -- the admin form's <select>
// options, the AI prompt builders (src/lib/utils/newsPrompts.ts), and the
// paste-JSON validator (src/lib/utils/newsValidation.ts). Each mirrors a DB
// CHECK constraint (news_articles.category has no DB constraint today;
// status and impact_area do -- see 20260804000001_news_platform.sql and
// 20260813000000_news_event_geo_impact_area.sql) so a value accepted here
// is guaranteed to be accepted there.

export const NEWS_CATEGORIES = [
  "General", "Engineering", "Privacy", "Product Update", "Policy",
  "Elections", "Local", "National", "International", "Opinion",
] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];

/**
 * How far a story's relevance reaches, for feed/notification targeting.
 * "local" pairs with latitude/longitude (see admin_sync_news_article_
 * boundaries()) to resolve which specific electoral boundaries the story
 * belongs to; the other three are broad reach categories that don't need
 * a point on the map.
 */
export const NEWS_IMPACT_AREAS = ["local", "state", "country", "international"] as const;
export type NewsImpactArea = (typeof NEWS_IMPACT_AREAS)[number];

export const NEWS_IMPACT_AREA_LABELS: Record<NewsImpactArea, string> = {
  local: "Local",
  state: "State / Province-wide",
  country: "Country-wide",
  international: "International",
};

export const NEWS_IMPACT_AREA_DESCRIPTIONS: Record<NewsImpactArea, string> = {
  local: "Relevant to one city/riding/municipality — set latitude & longitude so it auto-tags the right electoral boundaries.",
  state: "Relevant to a whole province or state.",
  country: "Relevant nationwide.",
  international: "Relevant across multiple countries.",
};

// ── Types ─────────────────────────────────────────────────────────────────

export interface NewsArticleContent {
  seoTitle?: string;
  metaDescription?: string;
  summary?: string;
  body?: string; // Markdown
  heroImageAlt?: string;
  heroImageCaption?: string;
  tags?: string[];
  breakingNews?: boolean;
  author?: {
    name?: string;
    bio?: string;
    photoUrl?: string;
  };
  sources?: Array<{ label: string; url: string }>;
  readingTimeMinutes?: number;
  /**
   * Optional hand-written line used as the X/Twitter post text when a reader
   * clicks Share, instead of the auto-generated "{headline} — Rate {reps} on
   * @choseno!" fallback. Plain text only — no emoji, hashtags, or URL: the
   * share flow (NewsArticleDetailClient) strips emoji defensively via
   * stripEmoji() and appends the canonical link + auto-generated hashtags
   * itself, so embedding either here would duplicate them. Falls back to the
   * generated text when unset (see docs/NEWS_JSON_SCHEMA.md).
   */
  tweet?: string;
  /**
   * Optional long-form structured neutral post formatted for X (Twitter) Premium (800-1500 chars).
   * Includes key policy points, balanced perspectives, and a neutral CTA to rate on Choseno.
   */
  tweetarticle?: string;
  /** Human-readable publishing batch timestamp/tag (e.g. "2026-08-18 23:25" or "BATCH-2026-08-18-2325") */
  batch_number?: string;
  /** Calculated or assigned viral potential score (e.g. 9.8) */
  viral_score?: number;
  /** Numerical ranking within the ingestion batch */
  batch_rank?: number;
  /** List of social platforms where this story has been published/shared (e.g. ["X", "Facebook", "LinkedIn"]) */
  shared_platforms?: string[];
}

export interface NewsArticle {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  category: string;
  country: string | null;
  province: string | null;
  status: NewsStatus;
  published_at: string | null; // "posted" date -- when this went live on Choseno
  event_date: string | null;   // when the real-world news event happened
  latitude: number | null;
  longitude: number | null;
  impact_area: NewsImpactArea | null;
  hero_image_url: string | null;
  content: NewsArticleContent;
  /** Generated column (content->>'viral_score' safely cast to numeric) -- see migration 20260822000001_news_feed_sort_and_engagement.sql. Null if content.viral_score is missing/non-numeric. */
  viral_score?: number | null;
  political_party_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsArticleInsert {
  slug: string;
  headline: string;
  summary?: string | null;
  category?: string;
  country?: string | null;
  province?: string | null;
  status?: NewsStatus;
  published_at?: string | null;
  event_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  impact_area?: NewsImpactArea | null;
  hero_image_url?: string | null;
  content?: NewsArticleContent;
  political_party_id?: number | null;
}

// ── Breaking news ────────────────────────────────────────────────────────
//
// No cron job or stored expiry column -- "breaking" status is computed
// lazily from published_at each time an article is read, the same pattern
// used elsewhere in this codebase (see promote_expired_election_admin_
// applications in 20260729000007_election_administrators.sql). Whoever set
// breakingNews: true never has to remember to unset it.

export const BREAKING_NEWS_ACTIVE_HOURS = 3;

export function isBreakingNewsActive(article: {
  content?: unknown;
  published_at?: string | null;
}): boolean {
  const content = article.content as NewsArticleContent | null | undefined;
  if (!content?.breakingNews) return false;
  if (!article.published_at) return true; // not yet published -- nothing to expire
  const publishedMs = new Date(article.published_at).getTime();
  if (Number.isNaN(publishedMs)) return true;
  return Date.now() < publishedMs + BREAKING_NEWS_ACTIVE_HOURS * 60 * 60 * 1000;
}

// ── Public queries ────────────────────────────────────────────────────────

export async function getPublishedNewsArticles(
  supabase: Client,
  opts: {
    country?: string | null;
    province?: string | null;
    category?: string | null;
    limit?: number;
    offset?: number;
    /** ISO timestamp -- only articles published at/after this instant. Used by the Google News sitemap's 48-hour window. */
    publishedAfter?: string;
    /**
     * ISO timestamp -- only articles whose event_date (falling back to
     * published_at when event_date is null, same coalesce the default sort
     * already uses) is at/after this instant. Powers the /news infinite
     * feed's Last 2 days/week/month filter (NewsInfiniteFeed).
     */
    eventDateAfter?: string;
    /**
     * "recent" (default) is the existing event_date/published_at descending
     * order. "interesting" sorts by the viral_score generated column (see
     * migration 20260822000001_news_feed_sort_and_engagement.sql) instead,
     * newest-first as a tiebreak for equal/missing scores. There's no
     * "engagement" here -- that needs a citizen-post count no per-row
     * column can express; see getPublishedNewsArticlesByEngagement below.
     */
    orderBy?: "recent" | "interesting";
    /** Excludes one slug -- used to pull "related coverage" for an article without it linking to itself. */
    excludeSlug?: string;
    /** When true, requests an exact total count alongside the page of rows (see PostgREST `count`), so callers can build page-number UI without a second query. */
    withCount?: boolean;
    /**
     * Pulls the same full tagged-politician shape getNewsArticleBySlug does
     * (designation, constituency, wall_slug, photo, contact info) instead of
     * just id/full_name -- needed wherever a caller renders
     * NewsArticleLinkedPoliticians (the "rate the people mentioned" strip)
     * without the reader having navigated to the article's own page first,
     * e.g. NewsInfiniteFeed. Off by default since every other caller
     * (grouped shelves, flat grid, hub pages) only ever shows a tag badge
     * and doesn't need the extra joined columns.
     */
    withPoliticianDetails?: boolean;
  } = {}
): Promise<{ data: NewsArticle[] | null; error: PostgrestError | null; count?: number | null }> {
  const politicianJoin = opts.withPoliticianDetails
    ? "news_article_politicians(politician_id, profiles(id, full_name, designation, constituency, current_ghost_id, politician_profiles(wall_slug, political_target_role, photo_url, avatar_url, contact_email, contact_phone)))"
    : "news_article_politicians(politician_id, profiles(id, full_name))";

  let q = supabase
    .from("news_articles")
    .select(
      `id, slug, headline, summary, category, country, province, status, published_at, event_date, latitude, longitude, impact_area, hero_image_url, content, viral_score, created_at, ${politicianJoin}`,
      opts.withCount ? { count: "exact" } : undefined
    )
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());

  q =
    opts.orderBy === "interesting"
      ? q
          .order("viral_score", { ascending: false, nullsFirst: false })
          .order("event_date", { ascending: false, nullsFirst: false })
          .order("published_at", { ascending: false })
      : q
          .order("event_date", { ascending: false, nullsFirst: false })
          .order("published_at", { ascending: false });

  if (opts.country) q = q.eq("country", opts.country);
  if (opts.province) q = q.eq("province", opts.province);
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.publishedAfter) q = q.gte("published_at", opts.publishedAfter);
  if (opts.eventDateAfter) {
    // event_date OR (event_date IS NULL AND published_at) at/after the
    // cutoff -- a plain .gte("event_date", ...) would silently drop every
    // article whose event_date is null even if it was published recently.
    q = q.or(`event_date.gte.${opts.eventDateAfter},and(event_date.is.null,published_at.gte.${opts.eventDateAfter})`);
  }
  if (opts.excludeSlug) q = q.neq("slug", opts.excludeSlug);
  if (opts.limit) q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);

  return q as unknown as Promise<{ data: NewsArticle[] | null; error: PostgrestError | null; count?: number | null }>;
}

/**
 * Same published-articles feed as getPublishedNewsArticles, but ordered by
 * how much real citizen discussion each article has (comment count on the
 * article itself, not on its tagged politicians) instead of recency or
 * viral_score -- the /news feed's "Engagement" sort. No per-row column can
 * express that (a COUNT(*) over posts isn't a function of the article row
 * alone, so it can't be a generated column like viral_score), so this is a
 * two-step fetch instead of one query with an .order():
 *   1. get_news_article_engagement_rank() RPC computes the count, applies
 *      this same filter set, and returns just the winning ids + total count
 *      for the requested page, already in engagement order.
 *   2. A normal .in('id', ids) pulls the full rows (with the politician
 *      join) -- PostgREST can't reliably auto-detect that relationship
 *      through a view the way it does through the real table, so the
 *      RPC only ever returns ids, never joined article data itself.
 * Step 2's result is then reordered in JS to match the RPC's order, since
 * `.in()` makes no ordering guarantee of its own.
 */
export async function getPublishedNewsArticlesByEngagement(
  supabase: Client,
  opts: {
    country?: string | null;
    category?: string | null;
    eventDateAfter?: string;
    limit?: number;
    offset?: number;
    withPoliticianDetails?: boolean;
  } = {}
): Promise<{ data: NewsArticle[] | null; error: PostgrestError | null; count?: number | null }> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const { data: ranked, error: rankError } = await (supabase.rpc as any)("get_news_article_engagement_rank", {
    p_limit: limit,
    p_offset: offset,
    p_event_date_after: opts.eventDateAfter ?? null,
    p_country: opts.country ?? null,
    p_category: opts.category ?? null,
  });
  if (rankError) return { data: null, error: rankError };

  const rows = (ranked ?? []) as Array<{ id: string; engagement_count: number; total_count: number }>;
  if (rows.length === 0) return { data: [], error: null, count: 0 };

  const politicianJoin = opts.withPoliticianDetails
    ? "news_article_politicians(politician_id, profiles(id, full_name, designation, constituency, current_ghost_id, politician_profiles(wall_slug, political_target_role, photo_url, avatar_url, contact_email, contact_phone)))"
    : "news_article_politicians(politician_id, profiles(id, full_name))";

  const { data: articles, error } = await supabase
    .from("news_articles")
    .select(
      `id, slug, headline, summary, category, country, province, status, published_at, event_date, latitude, longitude, impact_area, hero_image_url, content, viral_score, created_at, ${politicianJoin}`
    )
    .in(
      "id",
      rows.map((r) => r.id)
    );
  if (error) return { data: null, error };

  const byId = new Map(((articles ?? []) as unknown as NewsArticle[]).map((a) => [a.id, a]));
  const ordered = rows.map((r) => byId.get(r.id)).filter((a): a is NewsArticle => Boolean(a));

  return { data: ordered, error: null, count: rows[0]?.total_count ?? ordered.length };
}

export async function getNewsArticleBySlug(
  supabase: Client,
  slug: string
): Promise<{ data: NewsArticle | null; error: PostgrestError | null }> {
  return supabase
    .from("news_articles")
    .select(
      "*, news_article_politicians(politician_id, profiles(id, full_name, designation, constituency, current_ghost_id, politician_profiles(wall_slug, political_target_role, photo_url, avatar_url, contact_email, contact_phone)))"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .single();
}

// ── Admin queries ─────────────────────────────────────────────────────────

export async function listAllNewsArticlesForAdmin(
  supabase: Client
): Promise<{ data: Partial<NewsArticle>[] | null; error: PostgrestError | null }> {
  return supabase
    .from("news_articles")
    .select("id, slug, headline, category, country, province, status, published_at, event_date, latitude, longitude, impact_area, content, created_at, updated_at")
    .order("created_at", { ascending: false }) as unknown as Promise<{
    data: Partial<NewsArticle>[] | null;
    error: PostgrestError | null;
  }>;
}

export async function getNewsArticleByIdForAdmin(
  supabase: Client,
  id: string
): Promise<{ data: NewsArticle | null; error: PostgrestError | null }> {
  return supabase
    .from("news_articles")
    .select("*")
    .eq("id", id)
    .single();
}

export async function createNewsArticle(
  supabase: Client,
  article: NewsArticleInsert
): Promise<{ data: NewsArticle | null; error: PostgrestError | null }> {
  return supabase
    .from("news_articles")
    .insert(article as unknown as NewsArticleRow)
    .select()
    .single();
}

/**
 * Insert several articles from one AI-generated batch JSON paste. Runs
 * sequentially (not Promise.all) so a slug collision on article 3 doesn't
 * abort articles 4+, and so `failed` can report which ones actually broke.
 */
export async function createNewsArticlesBatch(
  supabase: Client,
  articles: NewsArticleInsert[]
): Promise<{
  created: NewsArticle[];
  failed: Array<{ headline: string; error: string }>;
}> {
  const created: NewsArticle[] = [];
  const failed: Array<{ headline: string; error: string }> = [];

  for (const article of articles) {
    const { data, error } = await createNewsArticle(supabase, article);
    if (error || !data) {
      failed.push({ headline: article.headline || "(untitled)", error: error?.message ?? "Unknown error" });
    } else {
      created.push(data);
    }
  }

  return { created, failed };
}

export async function updateNewsArticle(
  supabase: Client,
  id: string,
  patch: Partial<NewsArticleInsert>
): Promise<{ data: NewsArticle | null; error: PostgrestError | null }> {
  return supabase
    .from("news_articles")
    .update(patch as unknown as Partial<NewsArticleRow>)
    .eq("id", id)
    .select()
    .single();
}

export async function deleteNewsArticle(
  supabase: Client,
  id: string
): Promise<{ data: null; error: PostgrestError | null }> {
  return supabase.from("news_articles").delete().eq("id", id);
}

// ── Hero image upload ─────────────────────────────────────────────────────

export async function uploadNewsHeroImage(supabase: Client, file: File, slug: string) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `heroes/${slug}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("news-images")
    .upload(filePath, file, { upsert: true });
  if (uploadError) return { publicUrl: null, error: uploadError };
  const {
    data: { publicUrl },
  } = supabase.storage.from("news-images").getPublicUrl(filePath);
  return { publicUrl, error: null };
}

// generateNewsArticleOgImage lives in ./newsOgImage.ts, not here, even
// though it's the same "services call Supabase" pattern as everything else
// in this file. As of 2026-08-19 it's just a fetch() proxy to the
// generate-news-og-image Supabase Edge Function (no next/og import any
// more -- that rendering moved off Vercel entirely, see the Edge Function's
// own comment for why). Kept in its own file regardless: this file
// (services/news.ts) is imported by client components (AdminNewsPageClient,
// NewsArticleDetailClient per the layered architecture), and keeping the
// split means nobody has to re-verify that boundary if newsOgImage.ts ever
// grows a server-only import again.
//
// uploadNewsOgImage below is the upload half of the *browser* render path
// (renderNewsArticleOgCardToPngBlob in ogCardBrowser.ts, which uses Satori
// directly in the admin's own browser -- no Vercel Function involved at
// all), called from AdminNewsPageClient's generateOgImages() right at
// publish time -- same og-cards/{slug}.png path the Edge Function uses, so
// both paths produce interchangeable output and whichever runs first wins.

export async function uploadNewsOgImage(supabase: Client, image: Blob, slug: string) {
  const filePath = `og-cards/${slug}.png`;
  const { error: uploadError } = await supabase.storage
    .from("news-images")
    .upload(filePath, image, { contentType: "image/png", upsert: true });
  if (uploadError) return { publicUrl: null, error: uploadError };
  const {
    data: { publicUrl },
  } = supabase.storage.from("news-images").getPublicUrl(filePath);
  return { publicUrl, error: null };
}

// ── News article comments (via create_post RPC) ───────────────────────────

export async function getNewsArticleComments(
  supabase: Client,
  articleId: string,
  opts: { limit?: number; offset?: number } = {}
) {
  // System ghost ID used by admin_sync_news_article_tags to mirror stories onto politician walls
  const SYSTEM_NEWS_GHOST_ID = "00000000-0000-0000-0000-000000000001";
  const limit = opts.limit ?? 50;

  let query = supabase
    .from("posts")
    .select("*, comments(*)")
    .eq("news_article_id", articleId)
    .neq("ghost_id", SYSTEM_NEWS_GHOST_ID)
    .is("wall_ghost_id", null)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  if (!isDevEnvironment()) query = query.eq("is_test", false).eq("comments.is_test", false);
  return query;
}

export async function createNewsArticleComment(
  supabase: Client,
  articleId: string,
  content: string,
  imageUrl?: string | null,
  videoUrl?: string | null
) {
  // Uses create_post() RPC — handles post_boundaries automatically so the
  // comment appears in the commenter's regional /feed AND under the article.
  return supabase.rpc("create_post", {
    p_content: content,
    p_image_url: imageUrl ?? undefined,
    p_video_url: videoUrl ?? undefined,
    p_news_article_id: articleId,
    p_is_test: isDevEnvironment(),
  });
}

// ── Politician tagging (article → wall posts) ──────────────────────────────
//
// Tagging an article to a politician surfaces it on that politician's wall
// as a normal PostCard (see admin_sync_news_article_tags() in
// 20260809000002_news_politician_party_tagging.sql for how the mirrored
// posts row gets created/removed). This service only reads/writes the tag
// list and triggers a resync — the RPC owns all the posts-table logic.

export interface TaggedPolitician {
  politician_id: string;
  full_name: string | null;
}

export async function getNewsArticlePoliticianTags(
  supabase: Client,
  articleId: string
): Promise<{ data: TaggedPolitician[] | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("news_article_politicians")
    .select("politician_id, profiles(full_name)")
    .eq("news_article_id", articleId);
  if (error) return { data: null, error };
  const rows = (data as unknown as Array<{ politician_id: string; profiles: { full_name: string | null } | null }>) || [];
  return { data: rows.map((r) => ({ politician_id: r.politician_id, full_name: r.profiles?.full_name ?? null })), error: null };
}

/**
 * Replaces the article's tagged-politician set and resyncs the mirrored
 * wall posts to match (create/remove per the article's current status).
 * Pass `politicianIds` omitted/undefined to leave the tag set untouched
 * and just resync against a status change (e.g. after publish/unpublish).
 */
export async function syncNewsArticlePoliticianTags(
  supabase: Client,
  articleId: string,
  politicianIds?: string[]
) {
  return (supabase.rpc as any)("admin_sync_news_article_tags", {
    p_article_id: articleId,
    p_politician_ids: politicianIds,
  });
}

/**
 * All published articles tagged to a given politician (news_article_
 * politicians), newest first -- powers a "News mentioning me" list on a
 * politician's wall/profile, and lets the AI-generation flow pull a
 * politician's prior coverage as context. Same shape/filters as
 * getPublishedNewsArticles so callers can render both with one component.
 */
export async function getNewsArticlesByPolitician(
  supabase: Client,
  politicianId: string,
  opts: { limit?: number; offset?: number; withCount?: boolean } = {}
): Promise<{ data: NewsArticle[] | null; error: PostgrestError | null; count?: number | null }> {
  let q = supabase
    .from("news_articles")
    .select(
      "id, slug, headline, summary, category, country, province, status, published_at, event_date, latitude, longitude, impact_area, hero_image_url, content, created_at, news_article_politicians!inner(politician_id)",
      opts.withCount ? { count: "exact" } : undefined
    )
    .eq("news_article_politicians.politician_id", politicianId)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (opts.limit) q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 10) - 1);

  return q as unknown as Promise<{ data: NewsArticle[] | null; error: PostgrestError | null; count?: number | null }>;
}

/**
 * Same as getNewsArticlesByPolitician but for several politicians at once --
 * powers the /news feed's "All My Representatives" filter (news/page.tsx),
 * which previously fetched up to 500 published articles and filtered
 * client-side. `.in(...)` on the joined table matches any of the ids.
 */
export async function getNewsArticlesByPoliticians(
  supabase: Client,
  politicianIds: string[],
  opts: { limit?: number; offset?: number; withCount?: boolean } = {}
): Promise<{ data: NewsArticle[] | null; error: PostgrestError | null; count?: number | null }> {
  if (!politicianIds.length) return { data: [], error: null, count: 0 };

  let q = supabase
    .from("news_articles")
    .select(
      "id, slug, headline, summary, category, country, province, status, published_at, event_date, latitude, longitude, impact_area, hero_image_url, content, created_at, news_article_politicians!inner(politician_id, profiles(id, full_name))",
      // Was unconditionally { count: "exact" } — an exact COUNT(*) on every
      // call regardless of whether the caller even reads it, unlike its
      // sibling getNewsArticlesByPolitician which already gates this behind
      // opts.withCount. Matched here so callers only pay for the count when
      // they actually need page-number UI.
      opts.withCount ? { count: "exact" } : undefined
    )
    .in("news_article_politicians.politician_id", politicianIds)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (opts.limit) q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 10) - 1);

  return q as unknown as Promise<{ data: NewsArticle[] | null; error: PostgrestError | null; count?: number | null }>;
}

/**
 * Distinct countries with at least one published article, for the /news
 * feed's country filter tabs. Selects one column only (not full article
 * rows) so it stays cheap even as the article count grows.
 */
export async function getPublishedNewsCountries(supabase: Client): Promise<string[]> {
  const { data } = await supabase
    .from("news_articles")
    .select("country")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .not("country", "is", null);

  const set = new Set<string>();
  (data ?? []).forEach((row: { country: string | null }) => {
    if (row.country) set.add(row.country.toUpperCase());
  });
  return Array.from(set).sort();
}

// ── Boundary tagging (article geolocation → electoral boundaries) ──────────
//
// A "local" article's latitude/longitude resolves to actual map_shapes rows
// via admin_sync_news_article_boundaries() (ST_Contains, same pattern as
// sync_user_boundary_memberships) -- spatial correctness belongs in
// Postgres, not client JS. Call syncNewsArticleBoundaries after any save
// that sets/changes/clears latitude+longitude.

export interface TaggedBoundary {
  map_shape_id: number;
  name: string | null;
  boundary_type: string | null;
}

export async function getNewsArticleBoundaries(
  supabase: Client,
  articleId: string
): Promise<{ data: TaggedBoundary[] | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("news_article_boundaries")
    .select("map_shape_id, map_shapes(name, boundary_type)")
    .eq("news_article_id", articleId);
  if (error) return { data: null, error };
  const rows = (data as unknown as Array<{ map_shape_id: number; map_shapes: { name: string | null; boundary_type: string | null } | null }>) || [];
  return {
    data: rows.map((r) => ({ map_shape_id: r.map_shape_id, name: r.map_shapes?.name ?? null, boundary_type: r.map_shapes?.boundary_type ?? null })),
    error: null,
  };
}

export async function syncNewsArticleBoundaries(supabase: Client, articleId: string) {
  return (supabase.rpc as any)("admin_sync_news_article_boundaries", { p_article_id: articleId });
}

// ── Bulk-import dedup registry (news_import_source_urls) ───────────────────
//
// See 20260814000000_news_import_source_dedup.sql for why this table
// exists: re-running the automated Grok bulk-import for a politician must
// not regenerate an article about a real-world story it already covered.
// Two call sites use these: (1) before generating, to build the AI's
// exclusion list; (2) after generating, to re-check + record what actually
// got inserted. Never trust the prompt alone for (1) -- always re-verify
// with (2)'s check before insert.

export interface ImportedSourceUrls {
  /** politician_id -> Set of source URLs already imported for them */
  byPolitician: Map<string, Set<string>>;
}

/**
 * Batch lookup across many politicians at once (one query, not N) --
 * NewsImportAdminClient looks this up once for the whole selected scope
 * before starting the sequential per-politician generation loop.
 */
export async function getImportedSourceUrlsForPoliticians(
  supabase: Client,
  politicianIds: string[]
): Promise<{ data: ImportedSourceUrls | null; error: PostgrestError | null }> {
  if (!politicianIds.length) return { data: { byPolitician: new Map() }, error: null };

  // (supabase as any) -- news_import_source_urls is new (see
  // 20260814000000_news_import_source_dedup.sql), not yet present in the
  // generated Database types until `supabase gen types` runs post-deploy.
  // Same cast pattern as boundaries.ts's country_boundary_types/entity_types.
  const { data, error } = await (supabase as any)
    .from("news_import_source_urls")
    .select("politician_id, source_url")
    .in("politician_id", politicianIds);

  if (error) return { data: null, error };

  const byPolitician = new Map<string, Set<string>>();
  (data || []).forEach((row: { politician_id: string; source_url: string }) => {
    if (!byPolitician.has(row.politician_id)) byPolitician.set(row.politician_id, new Set());
    byPolitician.get(row.politician_id)!.add(row.source_url);
  });

  return { data: { byPolitician }, error: null };
}

export interface ExistingArticleTags {
  /** politician_id -> source URLs already cited in ANY of their tagged articles, any status */
  sourceUrlsByPolitician: Map<string, Set<string>>;
  /** politician_id -> headlines of their tagged articles, any status -- extra dedup signal for stories with no exact URL match */
  headlinesByPolitician: Map<string, string[]>;
}

/**
 * Same idea as getImportedSourceUrlsForPoliticians, but reads real coverage
 * already in news_articles instead of the bulk-import's own registry --
 * catches the case that table can't: an article about this politician
 * created through the ordinary manual /admin/news flow (paste-JSON or
 * hand-typed), which never touches news_import_source_urls at all. Both
 * lookups run before every bulk-generation request and their exclude sets
 * are unioned (see api/admin/news-import/generate) so a re-run can't
 * duplicate a story regardless of which flow originally created it.
 *
 * Deliberately unfiltered by status (unlike getNewsArticlesByPolitician,
 * which is published-only for public display) -- a draft or scheduled
 * article about a story is still a story already covered, not a gap to fill.
 */
export async function getExistingArticleTagsForPoliticians(
  supabase: Client,
  politicianIds: string[]
): Promise<{ data: ExistingArticleTags | null; error: PostgrestError | null }> {
  if (!politicianIds.length) {
    return { data: { sourceUrlsByPolitician: new Map(), headlinesByPolitician: new Map() }, error: null };
  }

  const { data, error } = await supabase
    .from("news_article_politicians")
    .select("politician_id, news_articles(headline, content)")
    .in("politician_id", politicianIds);

  if (error) return { data: null, error };

  const sourceUrlsByPolitician = new Map<string, Set<string>>();
  const headlinesByPolitician = new Map<string, string[]>();

  (data as unknown as Array<{ politician_id: string; news_articles: { headline: string; content: NewsArticleContent } | null }>).forEach(
    (row) => {
      if (!row.news_articles) return;
      if (!sourceUrlsByPolitician.has(row.politician_id)) sourceUrlsByPolitician.set(row.politician_id, new Set());
      if (!headlinesByPolitician.has(row.politician_id)) headlinesByPolitician.set(row.politician_id, []);

      const sources = row.news_articles.content?.sources ?? [];
      sources.forEach((s) => {
        if (s?.url) sourceUrlsByPolitician.get(row.politician_id)!.add(s.url.trim());
      });
      if (row.news_articles.headline) headlinesByPolitician.get(row.politician_id)!.push(row.news_articles.headline);
    }
  );

  return { data: { sourceUrlsByPolitician, headlinesByPolitician }, error: null };
}

/**
 * Records the source URLs an inserted article actually cited, so a future
 * bulk-import run for this politician excludes them. `ON CONFLICT DO
 * NOTHING` via upsert(ignoreDuplicates) -- PK is (politician_id,
 * source_url), so re-recording the same story is a harmless no-op rather
 * than an error.
 */
export async function recordImportedSourceUrls(
  supabase: Client,
  politicianId: string,
  articleId: string,
  sourceUrls: string[]
) {
  const rows = sourceUrls
    .filter((url) => typeof url === "string" && url.trim())
    .map((url) => ({ politician_id: politicianId, source_url: url.trim(), news_article_id: articleId }));
  if (!rows.length) return { error: null };

  return (supabase as any)
    .from("news_import_source_urls")
    .upsert(rows, { onConflict: "politician_id,source_url", ignoreDuplicates: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Estimate reading time from markdown body (200 wpm) */
export function estimateReadingMinutes(body?: string): number {
  if (!body) return 1;
  const wordCount = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / 200));
}

/** Extract plain-text excerpt from markdown body */
export function extractBodySummary(body?: string, maxChars = 200): string {
  if (!body) return "";
  const plain = body.replace(/[#*`\[\]]/g, "").trim();
  return plain.length > maxChars ? plain.slice(0, maxChars) + "…" : plain;
}

/**
 * Format a human-readable, sortable batch number from an ISO timestamp.
 * e.g. "2026-08-18T23:25:00.000Z" -> "2026-08-18 23:25"
 */
export function formatBatchNumberFromDate(isoDate?: string | null): string {
  return convertToPackificTime(isoDate);
}

// ── Distribution & Social Sharing Functions ───────────────────────────────

export interface DistributionArticle extends NewsArticle {
  batchNumber: string;
  viralScore: number;
  batchRank: number;
  sharedPlatforms: string[];
  primaryPoliticianName?: string | null;
  primaryWallSlug?: string | null;
  allPoliticianNames?: string[];
}

export interface ListDistributionArticlesOptions {
  status?: string;
  page?: number;
  pageSize?: number;
  /** One batch tag, several (multi-select), or "all"/omitted for no filter. */
  batchNumber?: string | string[];
  search?: string;
  sortBy?: string;
}

export interface ListDistributionArticlesResult {
  data: DistributionArticle[] | null;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: PostgrestError | null;
}

export interface BatchSummary {
  batch: string;
  count: number;
}

/**
 * Lightweight query to fetch distinct batch names and story counts without pulling heavy relations.
 */
export async function listDistinctBatches(
  supabase: Client
): Promise<{ data: BatchSummary[]; error: PostgrestError | null }> {
  // PostgREST caps an unbounded select at 1000 rows (db-max-rows) -- with no
  // .order() the truncated slice is effectively an arbitrary subset of
  // published articles, not "the oldest" or "the newest", so once the table
  // passes 1000 published rows this silently undercounts whichever batches
  // happen to land past the cut -- confirmed live on 2026-08-24 (total
  // stuck at "1000" while the DB had 1068, with today's newest batches
  // showing 2-3 articles instead of their real 20). Page through with
  // fetchAllPages so every published row is counted.
  const { data, error } = await fetchAllPages<any>((from, to) =>
    supabase
      .from("news_articles")
      .select("content, published_at, created_at")
      .eq("status", "published")
      .range(from, to)
  );

  if (error || !data) {
    return { data: [], error: error as PostgrestError | null };
  }

  const map = new Map<string, number>();
  data.forEach((row: any) => {
    const content = row.content || {};
    const rawBatch = content.batch_number;
    const b =
      rawBatch !== undefined && rawBatch !== null && String(rawBatch).trim() !== ""
        ? String(rawBatch).trim()
        : formatBatchNumberFromDate(row.published_at || row.created_at);
    if (b) {
      map.set(b, (map.get(b) || 0) + 1);
    }
  });

  const batches = Array.from(map.entries())
    .map(([batch, count]) => ({ batch: String(batch), count }))
    .sort((a, b) => String(b.batch).localeCompare(String(a.batch), undefined, { numeric: true, sensitivity: "base" }));

  return { data: batches, error: null };
}

/**
 * Lists articles with politician details formatted for the Admin News Distribution table with pagination.
 */
export async function listNewsArticlesForDistribution(
  supabase: Client,
  options: ListDistributionArticlesOptions = {}
): Promise<ListDistributionArticlesResult> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("news_articles")
    .select(`
      id,
      slug,
      headline,
      summary,
      category,
      country,
      province,
      status,
      published_at,
      event_date,
      latitude,
      longitude,
      impact_area,
      hero_image_url,
      content,
      political_party_id,
      created_by,
      created_at,
      updated_at,
      news_article_politicians (
        politician_id,
        profiles (
          id,
          full_name,
          current_ghost_id,
          politician_profiles (
            wall_slug
          )
        )
      )
    `, { count: "exact" });

  if (options.status) {
    query = query.eq("status", options.status);
  } else {
    query = query.eq("status", "published");
  }

  // Filter by batch_number inside content JSONB if provided -- one batch
  // (string) or several (multi-select array). "all"/empty means no filter.
  if (options.batchNumber && options.batchNumber !== "all") {
    const batches = Array.isArray(options.batchNumber) ? options.batchNumber : [options.batchNumber];
    if (batches.length === 1) {
      query = query.eq("content->>batch_number", batches[0]);
    } else if (batches.length > 1) {
      query = query.in("content->>batch_number", batches);
    }
  }

  // Filter by search query if provided
  if (options.search && options.search.trim()) {
    const term = options.search.trim();
    query = query.ilike("headline", `%${term}%`);
  }

  // Order query
  if (options.sortBy === "date_asc") {
    query = query.order("published_at", { ascending: true, nullsFirst: false });
  } else if (options.sortBy === "headline_asc") {
    query = query.order("headline", { ascending: true });
  } else {
    // Default newest publication first
    query = query.order("published_at", { ascending: false, nullsFirst: false });
  }

  // Pagination range
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error || !data) {
    return {
      data: null,
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
      error,
    };
  }

  const totalCount = count || data.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const formatted: DistributionArticle[] = (data as any[]).map((row, index) => {
    const content = (row.content || {}) as NewsArticleContent;
    const politicians = (row.news_article_politicians || [])
      .map((p: any) => p.profiles)
      .filter(Boolean);

    const primaryProf = politicians[0];
    const primaryWallSlug = primaryProf?.politician_profiles?.wall_slug || primaryProf?.current_ghost_id || null;
    const primaryPoliticianName = primaryProf?.full_name || null;
    const allPoliticianNames = politicians.map((p: any) => p.full_name).filter(Boolean);

    // Fallback batch number based on publication timestamp
    const rawBatch = content.batch_number;
    const batchNumber =
      rawBatch !== undefined && rawBatch !== null && String(rawBatch).trim() !== ""
        ? String(rawBatch).trim()
        : formatBatchNumberFromDate(row.published_at || row.created_at);
    // Fallback viral score
    const viralScore = typeof content.viral_score === "number" ? content.viral_score : (content.breakingNews ? 9.5 : 8.0);
    const batchRank = typeof content.batch_rank === "number" ? content.batch_rank : from + index + 1;
    const sharedPlatforms = Array.isArray(content.shared_platforms) ? content.shared_platforms : [];

    return {
      ...row,
      batchNumber,
      viralScore,
      batchRank,
      sharedPlatforms,
      primaryPoliticianName,
      primaryWallSlug,
      allPoliticianNames,
    };
  });

  // If sorting by viral score, sort the retrieved page
  if (options.sortBy === "viral_desc") {
    formatted.sort((a, b) => (b.viralScore || 0) - (a.viralScore || 0));
  } else if (options.sortBy === "viral_asc") {
    formatted.sort((a, b) => (a.viralScore || 0) - (b.viralScore || 0));
  }

  return {
    data: formatted,
    totalCount,
    page,
    pageSize,
    totalPages,
    error: null,
  };
}

/**
 * Updates the shared_platforms array stored inside an article's JSON content.
 */
export async function updateNewsArticleSharedPlatforms(
  supabase: Client,
  articleId: string,
  platforms: string[]
): Promise<{ success: boolean; error: any }> {
  // First fetch current content
  const { data: article, error: fetchError } = await supabase
    .from("news_articles")
    .select("content")
    .eq("id", articleId)
    .single();

  if (fetchError || !article) {
    return { success: false, error: fetchError };
  }

  const currentContent = (article.content || {}) as NewsArticleContent;
  const updatedContent: NewsArticleContent = {
    ...currentContent,
    shared_platforms: Array.from(new Set(platforms.filter(Boolean))),
  };

  const { error: updateError } = await supabase
    .from("news_articles")
    .update({ content: updatedContent as any })
    .eq("id", articleId);

  if (updateError) {
    return { success: false, error: updateError };
  }

  return { success: true, error: null };
}

/**
 * Records a single platform share action on an article.
 */
export async function recordNewsArticleShare(
  supabase: Client,
  articleId: string,
  platform: string
): Promise<{ success: boolean; error: any }> {
  const { data: article, error: fetchError } = await supabase
    .from("news_articles")
    .select("content")
    .eq("id", articleId)
    .single();

  if (fetchError || !article) {
    return { success: false, error: fetchError };
  }

  const currentContent = (article.content || {}) as NewsArticleContent;
  const existingPlatforms = Array.isArray(currentContent.shared_platforms)
    ? currentContent.shared_platforms
    : [];

  if (existingPlatforms.includes(platform)) {
    return { success: true, error: null }; // Already recorded
  }

  const updatedPlatforms = [...existingPlatforms, platform];
  const updatedContent: NewsArticleContent = {
    ...currentContent,
    shared_platforms: updatedPlatforms,
  };

  const { error: updateError } = await supabase
    .from("news_articles")
    .update({ content: updatedContent as any })
    .eq("id", articleId);

  if (updateError) {
    return { success: false, error: updateError };
  }

  return { success: true, error: null };
}

