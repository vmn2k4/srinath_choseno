import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Landmark, UserCheck, ArrowRight, ExternalLink, Mail, Phone, Building } from "lucide-react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getMapShapeById, getShapeContainers } from "@/lib/services/boundaries";
import {
  getElectionRoleTypes,
  getOfficeHoldersForShape,
  getActiveSeatsByShapeIds,
  getCandidatesBySeatIds,
} from "@/lib/services/elections";
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

  const title = `Who's Running for Office in ${shape.name}? | Choseno`;
  const description = `Elections, candidates, and current officeholders for ${shape.name} (${shape.boundary_type}, ${shape.country}) on Choseno.`;
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
  const officeHolderList = (holders || []) as Array<{
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
    <div className="w-full max-w-3xl mx-auto px-4 py-12 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />

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

      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">{shape.name}</h1>
            <p className="mt-2 text-text-muted flex items-center gap-1.5 text-sm sm:text-base">
              <MapPin size={16} className="text-primary" /> {shape.boundary_type} · {shape.country}
            </p>
          </div>
          <Badge variant="primary" size="md" className="shrink-0">
            {officeHolderList.length} Active Representative{officeHolderList.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {/* Parent Boundaries */}
        {containerList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-text-muted font-medium flex items-center gap-1">
              <Building size={13} /> Part of:
            </span>
            {containerList.map((c, i) => {
              const pShape = c.map_shapes;
              if (!pShape?.id || !pShape?.name) return null;
              return (
                <Link
                  key={`${pShape.id}-${i}`}
                  href={`/elections/${buildBoundarySlug(pShape)}`}
                  className="text-xs font-semibold text-primary/90 hover:text-primary bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-md transition-colors"
                >
                  {pShape.name} ({pShape.boundary_type})
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Current Active Representatives Section */}
      {officeHolderList.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <Landmark size={20} className="text-primary" />
            Current Office Holders &amp; Representatives
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {officeHolderList.map((holder) => {
              const roleTitle = holder.election_role_types?.role_title || "Incumbent";
              const partyName = holder.political_parties?.name;
              const ghostId = holder.profiles?.current_ghost_id;

              return (
                <Card key={holder.id} padding="md" className="space-y-4 border-l-4 border-l-primary">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <Avatar src={holder.photo_url} name={holder.full_name} size="md" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-text-main">{holder.full_name}</h3>
                          <Badge variant="secondary" size="sm">
                            {roleTitle}
                          </Badge>
                          {partyName && (
                            <Badge variant="outline" size="sm">
                              {partyName}
                            </Badge>
                          )}
                        </div>
                        {holder.bio && (
                          <p className="mt-1 text-sm text-text-muted leading-relaxed line-clamp-2">{holder.bio}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-text-muted flex-wrap">
                          {holder.contact_email && (
                            <a href={`mailto:${holder.contact_email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                              <Mail size={13} /> {holder.contact_email}
                            </a>
                          )}
                          {holder.contact_phone && (
                            <a href={`tel:${holder.contact_phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                              <Phone size={13} /> {holder.contact_phone}
                            </a>
                          )}
                          {holder.source_url && (
                            <a href={holder.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                              <ExternalLink size={13} /> Official Website
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {ghostId && (
                      <Link
                        href={`/wall/${ghostId}/${slugifyText(holder.full_name)}-${slugifyText(roleTitle)}`}
                        className="px-3.5 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
                      >
                        <UserCheck size={14} />
                        Politician Wall
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tracked Election Roles Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
          <UserCheck size={20} className="text-primary" />
          Tracked Offices &amp; Elections
        </h2>

        {(!roleTypes || roleTypes.length === 0) ? (
          <Card padding="lg" className="text-center py-8">
            <EmptyState
              icon={Landmark}
              title="No specific election roles listed yet"
              description={`Office holder records for ${shape.name} are loaded above. Additional election seats will appear as nominations open.`}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {roleTypes.map((role) => {
              const holder = holderByRoleTypeId.get(role.id);
              const seat = seatByRoleTitle.get(role.role_title);
              const candidateCount = seat ? candidateCountBySeat.get(seat.id) || 0 : 0;

              return (
                <Card key={role.id} padding="md" className="space-y-3">
                  <div>
                    <h3 className="text-lg font-bold text-text-main">{role.role_title}</h3>
                    {role.description && (
                      <p className="mt-1 text-sm text-text-muted leading-relaxed">{role.description}</p>
                    )}
                  </div>

                  {holder && (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border-light/30 text-sm">
                      <div className="flex items-center gap-2.5">
                        <UserCheck size={16} className="text-primary shrink-0" aria-hidden="true" />
                        <span>
                          Current: <span className="font-semibold text-text-main">{holder.full_name}</span>
                          {holder.political_parties?.name ? ` (${holder.political_parties.name})` : ""}
                        </span>
                      </div>
                      {holder.profiles?.current_ghost_id && (
                        <Link
                          href={`/wall/${holder.profiles.current_ghost_id}/${slugifyText(holder.full_name)}-${slugifyText(role.role_title)}`}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
                        >
                          View Wall <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  )}

                  {seat ? (
                    <Link
                      href={`/elections/seat/${buildSeatSlug({ id: seat.id, role_title: seat.role_title, map_shapes: { name: shape.name } })}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Nominations open — {candidateCount} candidate{candidateCount === 1 ? "" : "s"}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  ) : (
                    <p className="text-sm text-text-muted">No active election right now.</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
