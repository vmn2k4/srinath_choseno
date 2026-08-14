import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublishedNewsArticles } from "@/lib/services/news";
import { SITE_URL } from "@/lib/constants/site";
import NewsPageClient from "@/components/features/NewsPageClient";

const BASE_URL = SITE_URL;

export const metadata: Metadata = {
  title: "Election News & 2026 Candidate Updates | Choseno",
  description:
    "Latest news on 2026 midterm elections, candidate announcements, local races & democratic accountability. Community-curated civic journalism, free to read.",
  alternates: { canonical: `${BASE_URL}/news` },
  openGraph: {
    title: "Election News & 2026 Candidate Updates | Choseno",
    description:
      "Latest news on 2026 midterm elections, candidate announcements, local races & democratic accountability. Community-curated civic journalism, free to read.",
    url: `${BASE_URL}/news`,
    siteName: "Choseno",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/news/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Election News & 2026 Candidate Updates | Choseno",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Election News & 2026 Candidate Updates | Choseno",
    description:
      "Latest news on 2026 midterm elections, candidate announcements, local races & democratic accountability.",
    images: [`${BASE_URL}/news/opengraph-image`],
  },
};

export default async function NewsPage() {
  const supabase = await createClient();
  const [{ data: articles, error }, { data: authData }] = await Promise.all([
    getPublishedNewsArticles(supabase, { limit: 150 }),
    supabase.auth.getUser(),
  ]);

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

  const items = (articles ?? []) as any[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Civic News & Updates",
    description: "Stay informed with the latest civic news, electoral boundary updates, and democratic technology from Choseno.",
    url: `${BASE_URL}/news`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
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
        error={error}
        userRepresentatives={userRepresentatives}
        isLoggedIn={Boolean(user)}
      />
    </>
  );
}
