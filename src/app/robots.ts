import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Main crawl rules — allow all public pages
      // NOTE: /feed/ is temporarily crawlable (see FeedPageClient's
      // anonymous-visitor post fetch) so its discussion content can be
      // indexed. Re-add "/feed/" to every disallow list below to revert.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Explicitly allow OpenAI's GPTBot (powers ChatGPT web search)
      {
        userAgent: "GPTBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Explicitly allow Perplexity AI crawler
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Explicitly allow Anthropic's Claude crawler
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Google's extended crawlers for AI features (Gemini, SGE)
      {
        userAgent: "Google-Extended",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Meta's AI crawler
      {
        userAgent: "FacebookBot",
        allow: ["/wall/", "/elections/", "/news/", "/about", "/feed/"],
        disallow: ["/admin/", "/profile/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
