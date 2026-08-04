import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/feed/", "/profile/", "/onboarding/", "/claim/", "/apply/"],
    },
    sitemap: "https://choseno.com/sitemap.xml",
  };
}
