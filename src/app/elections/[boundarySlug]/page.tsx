import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Landmark, UserCheck, ArrowRight } from "lucide-react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getMapShapeById, getShapeContainers } from "@/lib/services/boundaries";
import {
  getElectionRoleTypes,
  getOfficeHoldersForShape,
  getActiveSeatsByShapeIds,
  getCandidatesBySeatIds,
} from "@/lib/services/elections";
import { buildBoundarySlug, buildSeatSlug, extractShapeIdFromSlug } from "@/lib/utils/slugs";
import { Card, EmptyState } from "@/components/primitives";
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
  const holderByRoleTypeId = new Map(
    ((holders || []) as Array<{ election_role_type_id: string }>).map((h) => [h.election_role_type_id, h])
  );
  const containerNames = ((containers || []) as Array<{ map_shapes?: { name?: string } | null }>)
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

      <div>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">{shape.name}</h1>
        <p className="mt-2 text-text-muted flex items-center gap-1.5">
          <MapPin size={14} /> {shape.boundary_type} · {shape.country}
        </p>
      </div>

      {(!roleTypes || roleTypes.length === 0) ? (
        <EmptyState
          icon={Landmark}
          title="No offices tracked here yet"
          description="This boundary doesn't have any election roles registered yet — check back as coverage expands."
        />
      ) : (
        <div className="space-y-4">
          {roleTypes.map((role) => {
            const holder = holderByRoleTypeId.get(role.id) as
              | { full_name: string; political_parties?: { name?: string } | null }
              | undefined;
            const seat = seatByRoleTitle.get(role.role_title);
            const candidateCount = seat ? candidateCountBySeat.get(seat.id) || 0 : 0;

            return (
              <Card key={role.id} padding="md" className="space-y-3">
                <div>
                  <h2 className="text-xl font-bold text-text-main">{role.role_title}</h2>
                  {role.description && (
                    <p className="mt-1 text-sm text-text-muted leading-relaxed">{role.description}</p>
                  )}
                </div>

                {holder && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border-light/30 text-sm">
                    <UserCheck size={16} className="text-primary shrink-0" aria-hidden="true" />
                    <span>
                      Current: <span className="font-semibold text-text-main">{holder.full_name}</span>
                      {holder.political_parties?.name ? ` (${holder.political_parties.name})` : ""}
                    </span>
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
  );
}
