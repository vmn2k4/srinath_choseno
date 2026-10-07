import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Avatar, Badge } from "@/components/primitives";
import PickShareReportButton from "@/components/features/PickShareReportButton";
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
  const seatSlug = buildSeatSlug(seat);
  const raceHref = seatSlug ? `/elections/seat/${seatSlug}` : "/elections";
  const place = seat.map_shapes?.name;

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in pb-20 px-4 space-y-5">
      <Card variant="hero" padding="lg" as="header">
        <Badge tone="primary">Shared picks</Badge>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-text-main leading-tight">
          {author} supports {joinNames(picked.map((c) => c.name))}
        </h1>
        <p className="mt-2 text-text-secondary">
          {seat.role_title}
          {place ? ` · ${place}` : ""}
        </p>
        {share.note && (
          <blockquote className="mt-4 border-l-4 border-primary pl-4 text-lg italic text-text-main">
            “{share.note}”
          </blockquote>
        )}
      </Card>

      <Card padding="md" className="space-y-3">
        <h2 className="text-sm font-bold text-text-main">Candidates {author} supports</h2>
        <ul className="space-y-2">
          {picked.map((c) => (
            <li key={c.id} className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <Avatar src={c.avatarUrl} name={c.name} size="md" />
              <div className="min-w-0">
                <p className="font-bold text-text-main truncate">{c.name}</p>
                {c.partyName && <p className="text-xs text-text-muted truncate">{c.partyName}</p>}
                {c.note && <p className="mt-1 text-sm italic text-text-main">“{c.note}”</p>}
              </div>
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <p className="text-xs text-text-muted">
            Also running: {others.slice(0, 8).map((c) => c.name).join(", ")}
            {others.length > 8 ? ` and ${others.length - 8} more` : ""}
          </p>
        )}
      </Card>

      <Card padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-bold text-text-main">Who&apos;s your pick?</p>
          <p className="text-xs text-text-muted">Compare everyone in the race, then share your own picks.</p>
        </div>
        <Link
          href={raceHref}
          className="inline-flex justify-center px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-text-on-primary font-bold text-sm transition-colors"
        >
          See the full race
        </Link>
      </Card>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-[11px] text-text-muted/80 max-w-md">
          This is one voter&apos;s personal opinion, shared on Choseno. It is not an endorsement by Choseno.
        </p>
        <PickShareReportButton code={code} />
      </div>
    </div>
  );
}
