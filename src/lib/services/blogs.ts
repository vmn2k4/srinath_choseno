import { ALL_BLOG_POSTS } from "@/lib/data/blogs/posts";
import { BlogPost, BlogCategory, BLOG_CATEGORIES, BlogCategoryMeta } from "@/lib/data/blogs/types";

/**
 * Retrieve all blog posts ordered by publication date descending.
 */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  return [...ALL_BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/**
 * Retrieve a single blog post by its URL slug.
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const post = ALL_BLOG_POSTS.find((p) => p.slug === slug);
  return post || null;
}

/**
 * Retrieve blog posts matching a specific category.
 */
export async function getBlogPostsByCategory(category: BlogCategory): Promise<BlogPost[]> {
  return ALL_BLOG_POSTS.filter((p) => p.category === category).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/**
 * Retrieve featured blog posts for showcase sections.
 */
export async function getFeaturedBlogPosts(limit = 6): Promise<BlogPost[]> {
  const featured = ALL_BLOG_POSTS.filter((p) => p.featured);
  return featured.slice(0, limit);
}

/**
 * Retrieve related blog posts within the same category, excluding the current post.
 */
export async function getRelatedBlogPosts(
  currentSlug: string,
  category: BlogCategory,
  limit = 3
): Promise<BlogPost[]> {
  return ALL_BLOG_POSTS.filter((p) => p.category === category && p.slug !== currentSlug).slice(0, limit);
}

/**
 * Retrieve all available blog categories.
 */
export function getBlogCategories(): BlogCategoryMeta[] {
  return BLOG_CATEGORIES;
}

/**
 * Search blog posts by keyword or title.
 */
export async function searchBlogPosts(query: string): Promise<BlogPost[]> {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return getAllBlogPosts();

  return ALL_BLOG_POSTS.filter(
    (p) =>
      p.title.toLowerCase().includes(normalized) ||
      p.primaryKeyword.toLowerCase().includes(normalized) ||
      p.excerpt.toLowerCase().includes(normalized) ||
      p.secondaryKeywords.some((k) => k.toLowerCase().includes(normalized))
  );
}
