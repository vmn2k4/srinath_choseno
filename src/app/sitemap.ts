import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublishedNewsArticles, NEWS_CATEGORIES } from "@/lib/services/news";
import { getActiveSeats, getCandidatesBySeatIds, getElectionCandidatesWithParty } from "@/lib/services/elections";
import { fetchAllPages } from "@/lib/utils/fetchAllPages";
import { summarizeParties, toRosterCandidates } from "@/lib/utils/electionParties";
import { hubPath, partyPath } from "@/lib/utils/electionPartySeo";
import { getAllBlogPosts } from "@/lib/services/blogs";
import { buildSeatSlug, buildCandidateSlug, buildBoundarySlug } from "@/lib/utils/slugs";
import { categoryToSlug } from "@/lib/utils/newsTaxonomy";
import { SITE_URL } from "@/lib/constants/site";

const baseUrl = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/elections`, lastModified: new Date(), changeFrequency: "hourly", priority: 1.0 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.5 },
    // Temporarily indexable (see robots.ts note) — anonymous visitors get a
    // default international-scoped post list so there's real content to crawl.
    { url: `${baseUrl}/feed`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.6 },
    { url: `${baseUrl}/find-my-district`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/news`, lastModified: new Date(), changeFrequency: "daily", priority: 0.5 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/editorial-standards`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/corrections-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    // Category hubs are a fixed, known set (NEWS_CATEGORIES) -- always
    // indexable even before any topic (freeform tags, not enumerable) page
    // has earned a link. See /news/category/[slug].
    ...NEWS_CATEGORIES.map((c) => ({
      url: `${baseUrl}/news/category/${categoryToSlug(c)}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.4,
    })),
  ];

  const supabase = await createClient();

  const [{ data: articles }, { data: seats, error: seatsError }] = await Promise.all([
    getPublishedNewsArticles(supabase, { limit: 500 }),
    fetchAllPages((from, to) => getActiveSeats(supabase, { limit: to - from + 1, offset: from })),
  ]);

  // News is secondary to elections/races, and an old article matters less
  // than a fresh one: priority steps down with age.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const newsPriority = (publishedAt?: string | null) => {
    const ageDays = publishedAt ? (Date.now() - new Date(publishedAt).getTime()) / DAY_MS : 0;
    return ageDays <= 3 ? 0.6 : ageDays <= 14 ? 0.4 : 0.2;
  };

  // A failed query here used to be swallowed, silently publishing a sitemap
  // with no seat/candidate pages. Throw instead: Next serves a 500, Google
  // keeps its last good sitemap, and the error lands in the logs.
  if (seatsError) throw new Error(`sitemap: failed to load active seats: ${(seatsError as { message?: string }).message}`);

  const articleRoutes: MetadataRoute.Sitemap = (articles || []).map((a) => ({
    url: `${baseUrl}/news/${a.slug}`,
    lastModified: a.published_at ? new Date(a.published_at) : new Date(),
    changeFrequency: "weekly",
    priority: newsPriority(a.published_at),
    // Same image-sitemap extension as news-sitemap.xml -- hero_image_url when
    // the article has one, otherwise the generated OG card, so Search/Discover
    // (not just Google News) has an image to show for every article.
    images: [a.hero_image_url || `${baseUrl}/news/${a.slug}/opengraph-image`],
  }));

  const blogPosts = await getAllBlogPosts();
  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
    changeFrequency: "weekly",
    priority: 0.4,
    images: [`${baseUrl}/blog/${post.slug}/opengraph-image`],
  }));

  const allSeatRows = (seats || []) as Array<{
    id: string;
    role_title?: string;
    map_shape_id?: number;
    elections?: { id?: string; name?: string } | null;
    map_shapes?: {
      id?: number;
      name?: string;
      boundary_type?: string;
      properties?: unknown;
    } | null;
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
    priority: 0.8,
  }));

  // One "parties in this election" hub per active election, plus one page
  // per party that actually has candidates in it.
  const electionsById = new Map<string, { id: string; name: string }>();
  allSeatRows.forEach((s) => {
    if (s.elections?.id && !electionsById.has(s.elections.id)) {
      electionsById.set(s.elections.id, { id: s.elections.id, name: s.elections.name || "election" });
    }
  });
  const electionPartyRoutes: MetadataRoute.Sitemap = (
    await Promise.all(
      Array.from(electionsById.values()).map(async (e) => {
        const { data: rows, error: rowsError } = await getElectionCandidatesWithParty(supabase, e.id);
        if (rowsError) throw new Error(`sitemap: failed to load candidates for ${e.name}: ${(rowsError as { message?: string }).message}`);
        // Hub is indexable whenever the election has candidates (matches the
        // hub page's own noindex rule), even if none have a party listed.
        if (!rows || rows.length === 0) return [];
        const parties = summarizeParties(toRosterCandidates(rows));
        return [
          { url: `${baseUrl}${hubPath(e)}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
          ...parties.map((p) => ({
            url: `${baseUrl}${partyPath(e, p)}`,
            lastModified: new Date(),
            changeFrequency: "daily" as const,
            priority: 0.85,
          })),
        ];
      })
    )
  ).flat();

  let candidateRoutes: MetadataRoute.Sitemap = [];
  let wallRoutes: MetadataRoute.Sitemap = [];
  let seatRoutes: MetadataRoute.Sitemap = [];

  if (allSeatRows.length > 0) {
    // Chunked: one .in() over every seat id overflows the request URL, and a
    // chunk's result must stay under PostgREST's 1000-row response cap.
    const seatIds = allSeatRows.map((s) => s.id);
    const candidateChunks = await Promise.all(
      Array.from({ length: Math.ceil(seatIds.length / 50) }, (_, i) =>
        getCandidatesBySeatIds(supabase, seatIds.slice(i * 50, i * 50 + 50)).then((r) => {
          if (r.error) throw new Error(`sitemap: failed to load candidates: ${r.error.message}`);
          return r.data || [];
        })
      )
    );
    const candidates = candidateChunks.flat();
    const candidateList = (candidates || []) as Array<{
      id: string;
      seat_id?: string;
      display_name?: string;
      profiles?: {
        full_name?: string;
        current_ghost_id?: string | null;
        politician_profiles?: { wall_slug?: string | null } | null;
      } | null;
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
      priority: 0.95,
    }));

    // One URL per candidate: /candidacy/. The seat-view route
    // (/elections/seat/.../candidate/...) declares it as its canonical, so
    // listing both only splits crawl effort across duplicates.
    // Politician walls only for people on an active ballot (wall_slug is the
    // stored canonical one). The old query pulled 1,000 arbitrary walls out
    // of ~36K profiles -- most of them not in any live race -- plus a
    // per-politician news archive page for each.
    const seenWalls = new Set<string>();
    wallRoutes = [];
    for (const c of candidateList) {
      const slug = c.profiles?.current_ghost_id ? c.profiles?.politician_profiles?.wall_slug : null;
      if (!slug || seenWalls.has(slug)) continue;
      seenWalls.add(slug);
      wallRoutes.push({ url: `${baseUrl}/wall/${slug}`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 });
    }

    candidateRoutes = candidateList.map((c) => ({
      url: `${baseUrl}/candidacy/${buildCandidateSlug(c)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));
  }

  return [
    // Elections lead: seats, candidates and party hubs are the core product,
    // so they come first, then news/walls, with blog last.
    ...staticRoutes,
    ...seatRoutes,
    ...candidateRoutes,
    ...electionPartyRoutes,
    ...boundaryRoutes,
    ...wallRoutes,
    ...articleRoutes,
    ...blogRoutes,
  ];
}
