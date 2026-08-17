import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Newspaper } from "lucide-react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSEOProfileSummary, getSEOProfileSummaryBySlug } from "@/lib/services/politicianWall";
import { getNewsArticlesByPolitician } from "@/lib/services/news";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";
import { SITE_URL } from "@/lib/constants/site";
import NewsArticleCard from "@/components/features/NewsArticleCard";
import NewsPager from "@/components/features/NewsPager";

const BASE_URL = SITE_URL;
const PAGE_SIZE = 24;

interface WallNewsPageProps {
  params: Promise<{ ghostId: string }>;
  searchParams: Promise<{ page?: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveOwner(ghostId: string) {
  const supabase = await createServerClient();
  const { owner } = isUuid(ghostId)
    ? await getSEOProfileSummary(supabase, ghostId)
    : await getSEOProfileSummaryBySlug(supabase, ghostId);
  return owner;
}

export async function generateMetadata({ params }: WallNewsPageProps): Promise<Metadata> {
  const { ghostId } = await params;
  const owner = await resolveOwner(ghostId);
  if (!owner) return { title: "Coverage Archive | Choseno" };

  const name = owner.full_name || "This politician";
  const wallSlug = (owner.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug || buildPoliticianWallSlug(name);
  const title = `All News Coverage of ${name} | Choseno`;
  const description = `Every verified Choseno news story mentioning ${name} — a full, indexed archive of coverage.`;
  const canonicalUrl = `${BASE_URL}/wall/${wallSlug}/news`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: "Choseno", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function WallNewsArchivePage({ params, searchParams }: WallNewsPageProps) {
  const { ghostId } = await params;
  const owner = await resolveOwner(ghostId);
  if (!owner?.id) notFound();

  const name = owner.full_name || "This politician";
  const wallSlug = (owner.politician_profiles as { wall_slug?: string | null } | null)?.wall_slug || buildPoliticianWallSlug(name);

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createServerClient();
  const { data: articles, count } = await getNewsArticlesByPolitician(supabase, owner.id, {
    limit: PAGE_SIZE,
    offset,
    withCount: true,
  });

  const items = articles ?? [];
  const total = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canonicalPath = `/wall/${wallSlug}/news`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `All News Coverage of ${name}`,
    description: `Every verified Choseno news story mentioning ${name}.`,
    url: `${BASE_URL}${canonicalPath}`,
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
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <Link
        href={`/wall/${wallSlug}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main transition-colors"
      >
        <ArrowLeft size={14} /> Back to {name}&rsquo;s wall
      </Link>

      <div className="flex items-center gap-2.5">
        <Newspaper size={20} className="text-primary" />
        <h1 className="text-xl sm:text-2xl font-extrabold text-text-main">All Coverage of {name}</h1>
      </div>
      <p className="text-sm text-text-muted -mt-3">
        {total} {total === 1 ? "story" : "stories"} mentioning {name}
      </p>

      {items.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">No published coverage of {name} yet.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((article) => (
              <NewsArticleCard key={article.id} article={article} />
            ))}
          </div>
          <NewsPager
            page={page}
            totalPages={totalPages}
            buildHref={(p) => `${canonicalPath}${p > 1 ? `?page=${p}` : ""}`}
          />
        </>
      )}
    </div>
  );
}
