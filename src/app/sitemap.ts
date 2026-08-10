import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublishedNewsArticles } from "@/lib/services/news";
import { getActiveSeats, getCandidatesBySeatIds } from "@/lib/services/elections";
import { buildSeatSlug, buildCandidateSlug, buildBoundarySlug } from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";

const baseUrl = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/elections`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/find-my-district`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/news`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/auth`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const supabase = await createClient();

  const [{ data: articles }, { data: seats }, { data: wallProfiles }] = await Promise.all([
    getPublishedNewsArticles(supabase, { limit: 500 }),
    getActiveSeats(supabase),
    supabase
      .from("profiles")
      .select("current_ghost_id, updated_at")
      .not("current_ghost_id", "is", null),
  ]);

  const articleRoutes: MetadataRoute.Sitemap = (articles || []).map((a) => ({
    url: `${baseUrl}/news/${a.slug}`,
    lastModified: a.published_at ? new Date(a.published_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const wallRoutes: MetadataRoute.Sitemap = (wallProfiles || [])
    .filter((p) => p.current_ghost_id)
    .map((p) => ({
      url: `${baseUrl}/wall/${p.current_ghost_id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "daily",
      priority: 0.85,
    }));

  const allSeatRows = (seats || []) as Array<{
    id: string;
    role_title?: string;
    map_shape_id?: number;
    map_shapes?: { id?: number; name?: string; boundary_type?: string } | null;
  }>;

  const shapesById = new Map<number, { id: number; name: string }>();
  allSeatRows.forEach((s) => {
    const shape = s.map_shapes;
    if (shape?.id && shape.name && !shapesById.has(shape.id)) {
      shapesById.set(shape.id, { id: shape.id, name: shape.name });
    }
  });
  const boundaryRoutes: MetadataRoute.Sitemap = Array.from(shapesById.values()).map((shape) => ({
    url: `${baseUrl}/elections/${buildBoundarySlug(shape)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.65,
  }));

  let candidateRoutes: MetadataRoute.Sitemap = [];
  let seatRoutes: MetadataRoute.Sitemap = [];

  if (allSeatRows.length > 0) {
    const { data: candidates } = await getCandidatesBySeatIds(
      supabase,
      allSeatRows.map((s) => s.id)
    );
    const candidateList = (candidates || []) as Array<{
      id: string;
      seat_id?: string;
      display_name?: string;
      profiles?: { full_name?: string } | null;
    }>;

    const candidateCountBySeat = new Map<string, number>();
    candidateList.forEach((c) => {
      if (!c.seat_id) return;
      candidateCountBySeat.set(c.seat_id, (candidateCountBySeat.get(c.seat_id) || 0) + 1);
    });

    const seatsWithCandidates = allSeatRows.filter((s) => (candidateCountBySeat.get(s.id) || 0) > 0);
    seatRoutes = seatsWithCandidates.map((s) => ({
      url: `${baseUrl}/elections/seat/${buildSeatSlug(s)}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const seatMap = new Map(allSeatRows.map((s) => [s.id, s]));

    candidateRoutes = candidateList.flatMap((c) => {
      const candSlug = buildCandidateSlug(c);
      const parentSeat = c.seat_id ? seatMap.get(c.seat_id) : null;
      const seatSlug = parentSeat ? buildSeatSlug(parentSeat) : null;

      const routes: MetadataRoute.Sitemap = [
        {
          url: `${baseUrl}/candidacy/${candSlug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.65,
        },
      ];

      if (seatSlug) {
        routes.push({
          url: `${baseUrl}/elections/seat/${seatSlug}/candidate/${candSlug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }

      return routes;
    });
  }

  return [
    ...staticRoutes,
    ...wallRoutes,
    ...articleRoutes,
    ...boundaryRoutes,
    ...seatRoutes,
    ...candidateRoutes,
  ];
}
