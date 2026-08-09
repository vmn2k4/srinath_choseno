import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Landmark, UserCheck, ArrowRight, ExternalLink, Mail, Phone, Building, Sparkles } from "lucide-react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getMapShapeById, getShapeContainers } from "@/lib/services/boundaries";
import {
  getElectionRoleTypes,
  getOfficeHoldersForShape,
  getActiveSeatsByShapeIds,
  getCandidatesBySeatIds,
} from "@/lib/services/elections";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import PoliticianEngagementStats from "@/components/features/PoliticianEngagementStats";
import { buildBoundarySlug, buildSeatSlug, extractShapeIdFromSlug, slugifyText } from "@/lib/utils/slugs";
import { Card, EmptyState, Avatar, Badge } from "@/components/primitives";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

interface PageProps {
  params: Promise<{ boundarySlug: string }>;
}

async function loadShape(boundarySlug: string) {
  const shapeId = extractShapeIdFromSlug(boundarySlug);
  const supabase = await createServerClient();
  const { data: shape } = await getMapShapeById(supabase, shapeId);
  return { supabase, shape };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { boundarySlug } = await params;
  const { shape } = await loadShape(boundarySlug);

  if (!shape) {
    return { title: "Boundary Not Found | Choseno" };
  }

  const title = `Office Holders & Elections in ${shape.name} | Choseno`;
  const description = `Current elected officeholders, representatives, and upcoming election candidates for ${shape.name} (${shape.boundary_type}, ${shape.country}) on Choseno.`;
  const canonicalUrl = `${BASE_URL}/elections/${buildBoundarySlug(shape)}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: "Choseno", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BoundaryDirectoryPage({ params }: PageProps) {
  const { boundarySlug } = await params;
  const { supabase, shape } = await loadShape(boundarySlug);

  if (!shape) notFound();

  const [{ data: roleTypes }, { data: holders }, { data: containers }, { data: seats }] = await Promise.all([
    getElectionRoleTypes(supabase, shape.country, shape.boundary_type),
    getOfficeHoldersForShape(supabase, shape.id),
    getShapeContainers(supabase, shape.id),
    getActiveSeatsByShapeIds(supabase, [shape.id]),
  ]);

  const seatRows = (seats || []) as Array<{
    id: string;
    role_title: string;
    map_shapes?: { name?: string; boundary_type?: string } | null;
  }>;
  const seatIds = seatRows.map((s) => s.id);
  const { data: candidateRows } = seatIds.length
    ? await getCandidatesBySeatIds(supabase, seatIds)
    : { data: [] as { seat_id: string }[] };

  const candidateCountBySeat = new Map<string, number>();
  (candidateRows || []).forEach((c) => {
    candidateCountBySeat.set(c.seat_id, (candidateCountBySeat.get(c.seat_id) || 0) + 1);
  });

  const seatByRoleTitle = new Map(seatRows.map((s) => [s.role_title, s]));
  const officeHolderList = (holders as unknown) as Array<{
    id: string;
    election_role_type_id: string;
    full_name: string;
    bio?: string | null;
    photo_url?: string | null;
    source_url?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    election_role_types?: { role_title?: string; role_key?: string } | null;
    political_parties?: { name?: string } | null;
    profiles?: { id?: string; full_name?: string; current_ghost_id?: string | null } | null;
  }>;

  const holderByRoleTypeId = new Map(officeHolderList.map((h) => [h.election_role_type_id, h]));
  const holderProfileIds = officeHolderList.map((h) => h.profiles?.id).filter((id): id is string => Boolean(id));
  const { data: engagementRows } = await getPoliticianEngagementSummaries(supabase, holderProfileIds);
  const engagementByPoliticianId = new Map(
    (
      (engagementRows || []) as {
        politician_id: string;
        supporter_count: number;
        avg_rating: number;
        rating_count: number;
        comment_count: number;
      }[]
    ).map((r) => [
      r.politician_id,
      {
        supporterCount: r.supporter_count,
        avgRating: r.avg_rating,
        ratingCount: r.rating_count,
        commentCount: r.comment_count,
      },
    ])
  );
  const containerList = (containers || []) as Array<{ map_shapes?: { id?: number; name?: string; boundary_type?: string } | null }>;
  const containerNames = containerList
    .map((c) => c.map_shapes?.name)
    .filter((n): n is string => Boolean(n));

  const canonicalUrl = `${BASE_URL}/elections/${buildBoundarySlug(shape)}`;
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "Elections", url: `${BASE_URL}/elections` },
    { name: shape.country, url: `${BASE_URL}/elections` },
    ...containerNames.map((name) => ({ name, url: `${BASE_URL}/elections` })),
    { name: shape.name, url: canonicalUrl },
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      item: b.url,
    })),
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Navigation Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
        {breadcrumbItems.map((b, i) => (
          <span key={`${b.name}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === breadcrumbItems.length - 1 ? (
              <span className="font-semibold text-text-main">{b.name}</span>
            ) : (
              <Link href={b.url.replace(BASE_URL, "") || "/"} className="hover:text-text-main transition-colors">
                {b.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Header Banner */}
      <div className="bg-surface/50 border border-border-light/50 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge tone="primary" size="sm">
                {shape.boundary_type}
              </Badge>
              <Badge tone="neutral" size="sm">
                {shape.country}
              </Badge>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-text-main">
              {shape.name}
            </h1>
            <p className="mt-1 text-sm text-text-muted flex items-center gap-1.5">
              <MapPin size={15} className="text-primary shrink-0" />
              Electoral Directory &amp; Office Holders
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right sm:block">
              <div className="text-2xl font-black text-primary">{officeHolderList.length}</div>
              <div className="text-xs text-text-muted font-medium">Active Representative{officeHolderList.length === 1 ? "" : "s"}</div>
            </div>
          </div>
        </div>

        {/* Parent Boundaries */}
        {containerList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border-light/30">
            <span className="text-xs text-text-muted font-medium flex items-center gap-1">
              <Building size={13} /> Located in:
            </span>
            {containerList.map((c, i) => {
              const pShape = c.map_shapes;
              if (!pShape?.id || !pShape?.name) return null;
              return (
                <Link
                  key={`${pShape.id}-${i}`}
                  href={`/elections/${buildBoundarySlug(pShape)}`}
                  className="text-xs font-semibold text-primary hover:text-primary-dark bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {pShape.name} ({pShape.boundary_type})
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Representatives Directory List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <Landmark size={22} className="text-primary" />
            Elected Representatives &amp; Incumbents
          </h2>
        </div>

        {officeHolderList.length === 0 ? (
          <Card padding="lg" className="text-center py-10">
            <EmptyState
              icon={Landmark}
              title="No office holders recorded yet"
              description={`Active representative records for ${shape.name} will appear here as district profiles are populated.`}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {officeHolderList.map((holder) => {
              const roleTitle = holder.election_role_types?.role_title || "Elected Official";
              const partyName = holder.political_parties?.name;
              const ghostId = holder.profiles?.current_ghost_id;
              const seat = seatByRoleTitle.get(roleTitle);
              const candidateCount = seat ? candidateCountBySeat.get(seat.id) || 0 : 0;
              const engagement = holder.profiles?.id ? engagementByPoliticianId.get(holder.profiles.id) : undefined;

              return (
                <Card key={holder.id} padding="lg" className="space-y-4 border-l-4 border-l-primary hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar src={holder.photo_url} name={holder.full_name} size="lg" className="ring-2 ring-primary/20" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-extrabold text-text-main">{holder.full_name}</h3>
                          <Badge tone="primary" size="sm" className="font-bold">
                            {roleTitle}
                          </Badge>
                          {partyName && (
                            <Badge tone="neutral" size="sm">
                              {partyName}
                            </Badge>
                          )}
                        </div>

                        {holder.profiles?.id && (
                          <PoliticianEngagementStats
                            politicianId={holder.profiles.id}
                            politicianName={holder.full_name}
                            supporterCount={engagement?.supporterCount ?? 0}
                            avgRating={engagement?.avgRating ?? 0}
                            ratingCount={engagement?.ratingCount ?? 0}
                            commentCount={engagement?.commentCount ?? 0}
                            size="sm"
                          />
                        )}

                        {holder.bio && (
                          <p className="text-sm text-text-muted leading-relaxed pt-0.5">{holder.bio}</p>
                        )}

                        {/* Contact Info Pills */}
                        <div className="flex items-center gap-4 pt-2 text-xs text-text-muted flex-wrap">
                          {holder.contact_email && (
                            <a
                              href={`mailto:${holder.contact_email}`}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-hover/60 hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <Mail size={13} />
                              {holder.contact_email}
                            </a>
                          )}
                          {holder.contact_phone && (
                            <a
                              href={`tel:${holder.contact_phone}`}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-hover/60 hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <Phone size={13} />
                              {holder.contact_phone}
                            </a>
                          )}
                          {holder.source_url && (
                            <a
                              href={holder.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-hover/60 hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <ExternalLink size={13} />
                              Official Website
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button to Politician Wall */}
                    {ghostId && (
                      <Link
                        href={`/wall/${ghostId}/${slugifyText(holder.full_name)}-${slugifyText(roleTitle)}`}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
                      >
                        <UserCheck size={16} />
                        Politician Wall
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>

                  {/* Active Election Seat Status */}
                  {seat && (
                    <div className="pt-3 border-t border-border-light/30 flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-text-muted flex items-center gap-1.5 font-medium">
                        <Sparkles size={14} className="text-primary" />
                        Next Election Nominations Open
                      </span>
                      <Link
                        href={`/elections/seat/${buildSeatSlug({ id: seat.id, role_title: seat.role_title, map_shapes: { name: shape.name } })}`}
                        className="font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        View {candidateCount} Candidate{candidateCount === 1 ? "" : "s"}
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Tracked Offices Summary */}
      {roleTypes && roleTypes.length > 0 && (
        <div className="pt-6 space-y-3">
          <h3 className="text-base font-bold text-text-main">Tracked Roles &amp; Responsibilities</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roleTypes.map((role) => (
              <Card key={role.id} padding="sm" className="space-y-1">
                <div className="font-bold text-sm text-text-main">{role.role_title}</div>
                {role.description && (
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{role.description}</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
