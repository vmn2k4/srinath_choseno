import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Badge } from "@/components/primitives";
import PickShareReportButton from "@/components/features/PickShareReportButton";
import DistrictRacesBanner from "@/components/features/DistrictRacesBanner";
import VotingPlacesSection from "@/components/features/VotingPlacesSection";
import PickShareCandidates from "@/components/features/PickShareCandidates";
import { SITE_URL } from "@/lib/constants/site";
import { buildSeatSlug } from "@/lib/utils/slugs";
import { joinNames, pickSharePath } from "@/lib/utils/pickShare";
import { loadPickShare } from "./loadPickShare";

// Short TTL so a reported/hidden share drops out quickly; the heavy lifting
// (roster fetch) is deduped per request by loadPickShare's React cache().
export const revalidate = 3600;

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const data = await loadPickShare(code);
  if (!data) return { title: "Share not found | Choseno", robots: { index: false, follow: false } };

  const { share, seat, picked } = data;
  const author = share.authorLabel || "A Choseno voter";
  const who = joinNames(picked.map((c) => c.name));
  const race = [seat.role_title, seat.map_shapes?.name].filter(Boolean).join(", ");
  const title = `${author} supports ${who}${race ? ` — ${race}` : ""}`;
  const firstNote = share.note || picked.find((c) => c.note)?.note;
  const description = firstNote
    ? `“${firstNote}” See everyone running and make your own picks on Choseno.`
    : `See everyone running${race ? ` for ${race}` : ""} and make your own picks on Choseno.`;
  const url = `${SITE_URL}${pickSharePath(code)}`;

  // User-generated page: shareable, but never indexed. The og:image comes
  // from the colocated opengraph-image.tsx automatically.
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: true },
    openGraph: { title, description, url, type: "website", siteName: "Choseno" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PickSharePage({ params }: Props) {
  const { code } = await params;
  const data = await loadPickShare(code);
  if (!data) notFound();

  const { share, seat, picked, others } = data;
  const author = share.authorLabel || "A Choseno voter";
  const place = seat.map_shapes?.name;
  const seatSlug = buildSeatSlug(seat);
  const raceHref = `/elections/seat/${seatSlug}`;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8">
      {/* Header and ballot lookup side by side on desktop so the ballot bar is
          visible without scrolling past the candidate list. */}
      <div className="mb-5 space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
      <Card variant="hero" padding="lg" as="header">
        <Badge tone="primary">Shared picks</Badge>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-text-main leading-tight">
          {author} supports {joinNames(picked.map((c) => c.name))}
        </h1>
        {/* The race is the point of the page, so it gets a prominent badge. */}
        <Badge tone="primary" shape="pill" size="sm" className="mt-3 !text-sm !px-3.5 !py-1.5">
          {seat.role_title}
          {place ? ` · ${place}` : ""}
        </Badge>
        <div className="mt-3">
          <Link href={raceHref} className="text-sm font-semibold text-primary hover:underline">
            View the full race &rarr;
          </Link>
        </div>
        {share.note && (
          <blockquote className="mt-4 border-l-4 border-primary pl-4 text-lg italic text-text-main">
            “{share.note}”
          </blockquote>
        )}
      </Card>
        <div>
        <DistrictRacesBanner
          orientation="horizontal"
          title="Who's on your ballot?"
          description="Find your district to see every race you can vote in and the candidates running in it."
        />
        </div>
      </div>
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 lg:items-start">
      <div className="min-w-0 space-y-5">
      <PickShareCandidates
        seat={{ id: seat.id, role_title: seat.role_title, map_shapes: { name: seat.map_shapes?.name } }}
        authorName={author}
        seatSlug={seatSlug}
        picked={picked}
        others={others}
      />

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-[11px] text-text-muted/80 max-w-md">
          This is one voter&apos;s personal opinion, shared on Choseno. It is not an endorsement by Choseno.
        </p>
        <PickShareReportButton code={code} />
      </div>
      </div>

      <div className="mt-8 lg:mt-0 space-y-6">
        {/* Same voting-places panel as the race page; renders nothing when the
            municipality has no published locations. */}
        <VotingPlacesSection
          mapShapeId={seat.map_shape_id}
          electionDate={seat.elections?.election_date}
          jurisdictionName={place || "your area"}
        />
      </div>
      </div>
    </div>
  );
}
