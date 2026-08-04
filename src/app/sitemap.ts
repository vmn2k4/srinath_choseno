import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublishedNewsArticles } from "@/lib/services/news";
import { getActiveSeats, getCandidatesBySeatIds } from "@/lib/services/elections";

const baseUrl = "https://choseno.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/elections`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/news`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/auth`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const supabase = await createClient();

  const [{ data: articles }, { data: seats }] = await Promise.all([
    getPublishedNewsArticles(supabase, { limit: 500 }),
    getActiveSeats(supabase),
  ]);

  const articleRoutes: MetadataRoute.Sitemap = (articles || []).map((a) => ({
    url: `${baseUrl}/news/${a.slug}`,
    lastModified: a.published_at ? new Date(a.published_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const seatRows = (seats || []) as { id: string }[];
  const seatRoutes: MetadataRoute.Sitemap = seatRows.map((s) => ({
    url: `${baseUrl}/elections/seat/${s.id}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.6,
  }));

  let candidateRoutes: MetadataRoute.Sitemap = [];
  if (seatRows.length > 0) {
    const { data: candidates } = await getCandidatesBySeatIds(
      supabase,
      seatRows.map((s) => s.id)
    );
    candidateRoutes = ((candidates || []) as { id: string }[]).map((c) => ({
      url: `${baseUrl}/candidacy/${c.id}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.65,
    }));
  }

  return [...staticRoutes, ...articleRoutes, ...seatRoutes, ...candidateRoutes];
}
