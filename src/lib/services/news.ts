import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";

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
  } = {}
): Promise<{ data: NewsArticle[] | null; error: PostgrestError | null }> {
  let q = supabase
    .from("news_articles")
    .select(
      "id, slug, headline, summary, category, country, province, status, published_at, event_date, latitude, longitude, impact_area, hero_image_url, content, created_at, news_article_politicians(politician_id, profiles(id, full_name))"
    )
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false });

  if (opts.country) q = q.eq("country", opts.country);
  if (opts.province) q = q.eq("province", opts.province);
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.limit) q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);

  return q as unknown as Promise<{ data: NewsArticle[] | null; error: PostgrestError | null }>;
}

export async function getNewsArticleBySlug(
  supabase: Client,
  slug: string
): Promise<{ data: NewsArticle | null; error: PostgrestError | null }> {
  return supabase
    .from("news_articles")
    .select(
      "*, news_article_politicians(politician_id, profiles(id, full_name, designation, constituency, current_ghost_id, politician_profiles(photo_url, avatar_url)))"
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

// ── News article comments (via create_post RPC) ───────────────────────────

export async function getNewsArticleComments(supabase: Client, articleId: string) {
  // System ghost ID used by admin_sync_news_article_tags to mirror stories onto politician walls
  const SYSTEM_NEWS_GHOST_ID = "00000000-0000-0000-0000-000000000001";

  let query = supabase
    .from("posts")
    .select("*, comments(*)")
    .eq("news_article_id", articleId)
    .neq("ghost_id", SYSTEM_NEWS_GHOST_ID)
    .is("wall_ghost_id", null)
    .order("created_at", { ascending: false });
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
  opts: { limit?: number; offset?: number } = {}
): Promise<{ data: NewsArticle[] | null; error: PostgrestError | null }> {
  let q = supabase
    .from("news_articles")
    .select(
      "id, slug, headline, summary, category, country, province, status, published_at, event_date, latitude, longitude, impact_area, hero_image_url, content, created_at, news_article_politicians!inner(politician_id)"
    )
    .eq("news_article_politicians.politician_id", politicianId)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (opts.limit) q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 10) - 1);

  return q as unknown as Promise<{ data: NewsArticle[] | null; error: PostgrestError | null }>;
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
