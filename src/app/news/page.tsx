import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getPublishedNewsArticles,
  getNewsArticlesByPoliticians,
  getPublishedNewsCountries,
  NEWS_CATEGORIES,
} from "@/lib/services/news";
import { SITE_URL } from "@/lib/constants/site";
import NewsPageClient from "@/components/features/NewsPageClient";

const BASE_URL = SITE_URL;
const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Live Civic & Political News: Real-Time Updates on Mayors, Premiers & 2026 Elections | Choseno",
  description:
    "Breaking civic news, policy announcements, mayoral decisions & verified candidate updates across Canada & the United States. Share verified news on representative walls and stay informed before voting.",
  keywords: [
    "breaking civic news",
    "political news today",
    "mayor announcements",
    "city council decisions",
    "2026 election updates",
    "provincial premier news",
    "local government policy",
    "politician accountability",
    "US politics news",
    "Canada politics news",
  ],
  alternates: { canonical: `${BASE_URL}/news` },
  openGraph: {
    title: "Live Civic News & Mayoral Decisions. Real-Time Political Accountability | Choseno",
    description:
      "Share verified news on your representative's wall, track policy announcements, and stay informed before voting.",
    url: `${BASE_URL}/news`,
    siteName: "Choseno",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/og-news.jpg`,
        width: 1200,
        height: 630,
        alt: "Live Civic News & Mayoral Decisions. Real-Time Political Accountability | Choseno",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Live Civic News & Mayoral Decisions. Real-Time Political Accountability | Choseno",
    description:
      "Share verified news on your representative's wall, track policy announcements, and stay informed before voting.",
    images: [`${BASE_URL}/og-news.jpg`],
  },
};

interface NewsPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    country?: string;
    rep?: string;
  }>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: authData }] = await Promise.all([supabase.auth.getUser()]);

  const user = authData?.user;
  const userRepresentatives: Array<{ id: string; name: string; role?: string | null; district?: string | null }> = [];

  if (user) {
    const { data: memberships } = await supabase
      .from("user_boundary_memberships")
      .select("map_shape_id")
      .eq("profile_id", user.id);

    const shapeIds = (memberships ?? []).map((m) => m.map_shape_id);

    if (shapeIds.length > 0) {
      const { data: holders } = await supabase
        .from("office_holders")
        .select("id, full_name, linked_profile_id, election_role_types(role_title), map_shapes(name)")
        .in("map_shape_id", shapeIds)
        .not("linked_profile_id", "is", null);

      if (holders) {
        const seen = new Set<string>();
        for (const h of holders) {
          if (h.linked_profile_id && h.full_name && !seen.has(h.linked_profile_id)) {
            seen.add(h.linked_profile_id);
            userRepresentatives.push({
              id: h.linked_profile_id,
              name: h.full_name,
              role: (h.election_role_types as any)?.role_title ?? null,
              district: (h.map_shapes as any)?.name ?? null,
            });
          }
        }
      }
    }
  }

  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  // Not restricted to NEWS_CATEGORIES -- that's only the fixed admin-form
  // enum (see its own comment in lib/services/news.ts: "news_articles.
  // category has no DB constraint today"). Real published articles carry
  // a much richer set of free-text categories ("Public Safety", "Culture",
  // "Energy", ...). `.eq()` is parameterized, so accepting any string here
  // is safe; an unmatched value just yields zero rows.
  const category = sp.category || null;
  const country = sp.country && sp.country !== "All" ? sp.country : null;
  const rep = sp.rep || null;
  const offset = (page - 1) * PAGE_SIZE;

  // rep=all_reps or rep=<politicianId> routes through the same joined query
  // (see getNewsArticlesByPoliticians) instead of the plain published-feed
  // query -- it's a different filter axis (who's tagged, not category/
  // country), so it takes over the fetch entirely rather than composing.
  const repIds = rep === "all_reps" ? userRepresentatives.map((r) => r.id) : rep ? [rep] : null;

  // Country and category pills both stay on NewsInfiniteFeed's own
  // client-side scroll (see NewsPageClient) -- clicking one is a real
  // navigation to /news?country=... or ?category=..., and this component
  // picks the new filter back up from the props passed below, same
  // Facebook-timeline feed either way. Only the "My Representatives" filter
  // (a different axis -- who's tagged, not where/what) and paging past 1
  // (which the feed itself replaces with infinite scroll, but a bookmarked
  // ?page=N URL should still resolve to something) fall back to the flat,
  // really-paginated grid below.
  const useInfiniteFeed = !repIds && page === 1;

  const [{ data: articles, error, count }, countries] = await Promise.all([
    repIds
      ? getNewsArticlesByPoliticians(supabase, repIds, { limit: PAGE_SIZE, offset, withCount: true })
      : getPublishedNewsArticles(supabase, { category, country, limit: PAGE_SIZE, offset, withCount: true }),
    getPublishedNewsCountries(supabase),
  ]);

  // This same first-page fetch backs the JSON-LD ItemList even in the
  // default view, where it isn't rendered as a visible grid (NewsInfiniteFeed
  // owns that surface, fetching client-side) -- keeps the schema populated
  // with real, current articles instead of an empty list.
  const items = (articles ?? []) as any[];
  const total = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Only the actually-rendered/schema'd items go into the schema --
  // previously this dumped every published article (hundreds) into one
  // ItemList regardless of what was actually on-screen, ballooning crawl
  // payload for no SEO gain (Google reads the page's own HTML for the
  // actual page contents anyway).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Civic News & Updates",
    description: "Stay informed with the latest civic news, electoral boundary updates, and democratic technology from Choseno.",
    url: `${BASE_URL}/news${page > 1 ? `?page=${page}` : ""}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: offset + index + 1,
        name: item.headline,
        url: `${BASE_URL}/news/${item.slug}`,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <NewsPageClient
        items={items}
        showInfiniteFeed={useInfiniteFeed}
        error={error}
        userRepresentatives={userRepresentatives}
        isLoggedIn={Boolean(user)}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        category={category}
        country={country}
        rep={rep}
        categories={NEWS_CATEGORIES as unknown as string[]}
        countries={countries}
      />
    </>
  );
}
