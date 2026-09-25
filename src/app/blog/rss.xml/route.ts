import { getAllBlogPosts } from "@/lib/services/blogs";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getAllBlogPosts();

  const items = posts
    .map((post) => {
      const loc = `${SITE_URL}/blog/${post.slug}`;
      const pubDate = new Date(post.publishedAt).toUTCString();
      const title = escapeXml(post.title);
      const description = escapeXml(post.metaDescription);
      const author = "Choseno Civic Research Bureau";
      const category = escapeXml(post.category);
      const ogImage = `${SITE_URL}/blog/${post.slug}/opengraph-image`;

      return `    <item>
      <title>${title}</title>
      <link>${loc}</link>
      <guid isPermaLink="true">${loc}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${category}</category>
      <author>team@choseno.com (${author})</author>
      <enclosure url="${ogImage}" length="0" type="image/png" />
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)} Civic Knowledge Base &amp; Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Non-partisan, in-depth guides to understanding your elected leaders, local government powers, voting procedures, and candidate evaluation.</description>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=3600, s-maxage=14400, stale-while-revalidate=86400",
    },
  });
}
