import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
type NewsArticleRow = Database["public"]["Tables"]["news_articles"]["Insert"];

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
  status: "draft" | "scheduled" | "published" | "archived";
  published_at: string | null;
  hero_image_url: string | null;
  content: NewsArticleContent;
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
  status?: "draft" | "scheduled" | "published" | "archived";
  published_at?: string | null;
  hero_image_url?: string | null;
  content?: NewsArticleContent;
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
      "id, slug, headline, summary, category, country, province, status, published_at, hero_image_url, content, created_at"
    )
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
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
    .select("*")
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
    .select("id, slug, headline, category, country, province, status, published_at, created_at, updated_at")
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
  return supabase
    .from("posts")
    .select("*, comments(*)")
    .eq("news_article_id", articleId)
    .order("created_at", { ascending: false });
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
  });
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
