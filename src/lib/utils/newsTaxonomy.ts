/**
 * Pure helpers for the /news/category and /news/topic hub routes.
 *
 * Categories are a fixed enum (NEWS_CATEGORIES in lib/services/news.ts) so
 * slug <-> label is a reversible lookup. Tags are freeform strings an admin
 * types into content.tags, so there's no registry to resolve against -- a
 * tag's URL slug is derived the same way every time (slugifyText), and
 * matching an incoming slug back to real tag strings is done by re-slugging
 * each article's tags and comparing, not by storing/parsing the slug itself.
 */
import { NEWS_CATEGORIES, type NewsArticle } from "@/lib/services/news";
import { slugifyText } from "@/lib/utils/slugs";

/** "Product Update" -> "product-update" */
export function categoryToSlug(category: string): string {
  return slugifyText(category);
}

/** "product-update" -> "Product Update" (the real enum value), or null if no match. */
export function resolveCategoryFromSlug(slug: string): string | null {
  const match = NEWS_CATEGORIES.find((c) => categoryToSlug(c) === slug);
  return match ?? null;
}

/** "Gun Control" -> "gun-control" */
export function tagToSlug(tag: string): string {
  return slugifyText(tag);
}

export interface TagMatch {
  /** The real, original-cased tag string as authored on at least one article. */
  label: string;
  articles: NewsArticle[];
}

/**
 * Scans an already-fetched article list (see getPublishedNewsArticles) for
 * every article carrying a tag whose slug matches. Also recovers the
 * original display label (first occurrence wins) since the URL only carries
 * the slug. Preserves the incoming array's order (callers pass already
 * recency-sorted lists).
 */
export function findArticlesByTagSlug(
  articles: NewsArticle[],
  tagSlug: string
): TagMatch | null {
  let label: string | null = null;
  const matches: NewsArticle[] = [];

  for (const article of articles) {
    const tags = article.content?.tags ?? [];
    const hit = tags.find((t) => tagToSlug(t) === tagSlug);
    if (hit) {
      if (!label) label = hit;
      matches.push(article);
    }
  }

  return label ? { label, articles: matches } : null;
}

/** Every distinct tag across an article list, most-frequent first, for building tag hub links (e.g. under an article or on a topics index). */
export function collectTagFrequency(articles: NewsArticle[]): Array<{ tag: string; slug: string; count: number }> {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const article of articles) {
    for (const tag of article.content?.tags ?? []) {
      const slug = tagToSlug(tag);
      const existing = counts.get(slug);
      if (existing) existing.count += 1;
      else counts.set(slug, { tag, count: 1 });
    }
  }
  return Array.from(counts.entries())
    .map(([slug, { tag, count }]) => ({ tag, slug, count }))
    .sort((a, b) => b.count - a.count);
}
