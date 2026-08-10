import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Main crawl rules — allow all public pages
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/feed/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Explicitly allow OpenAI's GPTBot (powers ChatGPT web search)
      {
        userAgent: "GPTBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district"],
        disallow: ["/admin/", "/feed/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Explicitly allow Perplexity AI crawler
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district"],
        disallow: ["/admin/", "/feed/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Explicitly allow Anthropic's Claude crawler
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district"],
        disallow: ["/admin/", "/feed/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Google's extended crawlers for AI features (Gemini, SGE)
      {
        userAgent: "Google-Extended",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district"],
        disallow: ["/admin/", "/feed/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
      },
      // Meta's AI crawler
      {
        userAgent: "FacebookBot",
        allow: ["/wall/", "/elections/", "/news/", "/about"],
        disallow: ["/admin/", "/feed/", "/profile/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
