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
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/", "/officeholder-claim/"],
      },
      // Explicitly allow OpenAI's GPTBot (powers ChatGPT web search)
      {
        userAgent: "GPTBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/", "/editorial-standards", "/corrections-policy"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/", "/officeholder-claim/"],
      },
      // Explicitly allow Perplexity AI crawler
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/", "/editorial-standards", "/corrections-policy"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/", "/officeholder-claim/"],
      },
      // Explicitly allow Anthropic's Claude crawler
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/", "/editorial-standards", "/corrections-policy"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/", "/officeholder-claim/"],
      },
      // Google's extended crawlers for AI features (Gemini, SGE)
      {
        userAgent: "Google-Extended",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/", "/editorial-standards", "/corrections-policy"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/", "/officeholder-claim/"],
      },
      // Meta's AI crawler
      {
        userAgent: "FacebookBot",
        allow: ["/wall/", "/elections/", "/news/", "/about", "/feed/", "/editorial-standards", "/corrections-policy"],
        disallow: ["/admin/", "/profile/", "/officeholder-claim/"],
      },
      // OpenAI's answer engine crawler (powers ChatGPT web search & answers)
      {
        userAgent: "OAI-SearchBot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/", "/editorial-standards", "/corrections-policy"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/", "/officeholder-claim/"],
      },
      // Apple News & Spotlight crawler
      {
        userAgent: "Applebot",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/", "/editorial-standards", "/corrections-policy"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/", "/officeholder-claim/"],
      },
      // Apple Intelligence web retrieval
      {
        userAgent: "Applebot-Extended",
        allow: ["/", "/wall/", "/elections/", "/news/", "/about", "/find-my-district", "/feed/", "/editorial-standards", "/corrections-policy"],
        disallow: ["/admin/", "/profile/", "/onboarding/", "/claim/", "/apply/", "/officeholder-claim/"],
      },
    ],
    // news-sitemap.xml is the Google News-specific feed (rolling 48h
    // window, <news:news> tags) -- listed alongside the full archive
    // sitemap so News/Googlebot discovers it without a separate submission.
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
