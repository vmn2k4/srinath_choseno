import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Landmark, ArrowRight, Building, Sparkles, Network } from "lucide-react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getMapShapeById, getShapeContainers, getNationalShapeForCountry } from "@/lib/services/boundaries";
import {
  getElectionRoleTypes,
  getOfficeHoldersForShape,
  getActiveSeatsByShapeIds,
  getCandidatesBySeatIds,
} from "@/lib/services/elections";
import { getUserBoundaryMemberships } from "@/lib/services/profile";
import BoundaryDirectoryClient from "@/components/features/BoundaryDirectoryClient";
import type { BranchHolderNode, RepresentationBranch } from "@/components/features/RepresentationBranchTree";
import { buildBoundarySlug, buildSeatSlug, extractShapeIdFromSlug } from "@/lib/utils/slugs";
import { Card, Badge } from "@/components/primitives";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

interface PageProps {
  params: Promise<{ boundarySlug: string }>;
  searchParams: Promise<{ view?: string }>;
}

type ShapeRow = { id: number; name: string; country: string; boundary_type: string; properties?: unknown };

type OfficeHolderRow = {
  id: string;
  full_name: string;
  bio?: string | null;
  source_url?: string | null;
  photo_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  map_shapes?: { id?: number; name?: string; boundary_type?: string } | null;
  election_role_types?: { role_title?: string; role_key?: string; description?: string | null } | null;
  political_parties?: { name?: string } | null;
  profiles?: { current_ghost_id?: string | null } | null;
};

// The role a person holds when they ARE the head of their branch, rather than
// a local representative reporting up to one -- used to split a shape's own
// office holders into a "top" node (Mayor, or a fetched Premier/Governor/
// Prime Minister/President) vs. "bottom" nodes (Councillors, or the shape's
// own MP/MLA/etc.).
const HEAD_ROLE_TITLES = new Set(["Mayor", "Governor", "Premier", "Prime Minister", "President", "Chief Minister"]);

// Where to find the "top" office for a boundary_type that ISN'T itself a
// head-of-branch shape (a riding/district has no head role of its own, so its
// superior comes from the National shape directly, or from the container
// (Province/State) it geometrically sits inside). Boundary types not listed
// here (Municipal, Province, State, National) resolve their top node from
// their OWN office holders instead (see resolveBranch).
const SUPERIOR_SOURCE: Record<string, { source: "national" } | { source: "container"; containerType: string }> = {
  "Canada:Federal": { source: "national" },
  "USA:Federal": { source: "national" },
  "India:Lok Sabha": { source: "national" },
  "Canada:Provincial": { source: "container", containerType: "Province" },
  "USA:State Senate": { source: "container", containerType: "State" },
  "USA:State House": { source: "container", containerType: "State" },
  "India:Vidhan Sabha": { source: "container", containerType: "State" },
};

function toNode(row: OfficeHolderRow): BranchHolderNode {
  return {
    id: row.id,
    full_name: row.full_name,
    role_title: row.election_role_types?.role_title || "Elected Official",
    role_description: row.election_role_types?.description || null,
    party_name: row.political_parties?.name || null,
    photo_url: row.photo_url || null,
    ghost_id: row.profiles?.current_ghost_id || null,
    boundary_name: row.map_shapes?.name || null,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    source_url: row.source_url,
  };
}

function branchKeyFor(shape: ShapeRow): string {
  return shape.boundary_type.toLowerCase().replace(/\s+/g, "-");
}

async function resolveBranch(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  shape: ShapeRow
): Promise<RepresentationBranch> {
  const { data } = await getOfficeHoldersForShape(supabase, shape.id);
  const rows = (data || []) as unknown as OfficeHolderRow[];

  const headHere = rows.filter((r) => HEAD_ROLE_TITLES.has(r.election_role_types?.role_title || ""));
  const restHere = rows.filter((r) => !HEAD_ROLE_TITLES.has(r.election_role_types?.role_title || ""));

  let top: BranchHolderNode | null = null;
  let bottom: BranchHolderNode[] = [];

  if (headHere.length > 0) {
    top = toNode(headHere[0]);
    bottom = restHere.map(toNode);
  } else {
    bottom = rows.map(toNode);
    const config = SUPERIOR_SOURCE[`${shape.country}:${shape.boundary_type}`];

    if (config?.source === "national") {
      const { data: national } = await getNationalShapeForCountry(supabase, shape.country);
      if (national?.id) {
        const { data: nHolders } = await getOfficeHoldersForShape(supabase, national.id);
        const head = ((nHolders || []) as unknown as OfficeHolderRow[]).find((h) =>
          HEAD_ROLE_TITLES.has(h.election_role_types?.role_title || "")
        );
        if (head) top = toNode(head);
      }
    } else if (config?.source === "container") {
      const { data: containers } = await getShapeContainers(supabase, shape.id);
      const match = (containers || []).find(
        (c: any) => c.map_shapes?.boundary_type === config.containerType
      );
      if (match?.container_shape_id) {
        const { data: cHolders } = await getOfficeHoldersForShape(supabase, match.container_shape_id);
        const head = ((cHolders || []) as unknown as OfficeHolderRow[]).find((h) =>
          HEAD_ROLE_TITLES.has(h.election_role_types?.role_title || "")
        );
        if (head) top = toNode(head);
      }
    }
  }

  return { key: branchKeyFor(shape), label: shape.boundary_type, top, bottom };
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

  const title = `${shape.name} 2026 Elections — Candidates, Reps & Voter Ratings | Choseno`;
  const description = `Who represents you in ${shape.name}? View all 2026 ${shape.boundary_type} candidates, your current elected officials, constituent ratings and real voter feedback on Choseno.`;
  const canonicalUrl = `${BASE_URL}/elections/${buildBoundarySlug(shape)}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: "Choseno", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BoundaryDirectoryPage({ params, searchParams }: PageProps) {
  const { boundarySlug } = await params;
  const { view } = await searchParams;
  const { supabase, shape } = await loadShape(boundarySlug);

  if (!shape) notFound();

  const [{ data: containers }, { data: seats }] = await Promise.all([
    getShapeContainers(supabase, shape.id),
    getActiveSeatsByShapeIds(supabase, [shape.id]),
  ]);

  const seatRows = (seats || []) as Array<{ id: string; role_title: string }>;
  const seatIds = seatRows.map((s) => s.id);
  const { data: candidateRows } = seatIds.length
    ? await getCandidatesBySeatIds(supabase, seatIds)
    : { data: [] as { seat_id: string }[] };
  const candidateCountBySeat = new Map<string, number>();
  (candidateRows || []).forEach((c) => {
    candidateCountBySeat.set(c.seat_id, (candidateCountBySeat.get(c.seat_id) || 0) + 1);
  });

  // Primary branch: whichever hierarchy the boundary being viewed itself
  // belongs to (a Federal riding page always shows Prime Minister → MP, a
  // Municipal page always shows Mayor → Councillors, etc).
  const primaryBranch = await resolveBranch(supabase, shape as ShapeRow);
  const branches: RepresentationBranch[] = [primaryBranch];

  // Plus, for a signed-in citizen, their OTHER branches too (their own
  // Provincial riding, Municipal ward, etc.) -- so "All" genuinely shows
  // their whole civic picture: PM→MP, Premier→MLA, and Mayor→Councillors
  // together, not just whichever single boundary the URL happens to name.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: memberships } = await getUserBoundaryMemberships(supabase, user.id);
    const memberShapes = (memberships || [])
      .map((m: any) => m.map_shapes as ShapeRow | null)
      .filter(
        (s): s is ShapeRow =>
          s != null && s.country === shape.country && !s.boundary_type.toLowerCase().includes("polling")
      );

    const seenKeys = new Set(branches.map((b) => b.key));
    for (const memberShape of memberShapes) {
      const key = branchKeyFor(memberShape);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      branches.push(await resolveBranch(supabase, memberShape));
    }
  }

  // Roles & Responsibilities reference -- union of role types across every
  // (country, boundary_type) actually represented in the rendered branches,
  // including the boundary_type of each branch's fetched superior, so a role
  // is documented even when nobody currently holds it.
  const roleTypeKeys = new Set<string>();
  branches.forEach((b) => roleTypeKeys.add(`${shape.country}:${b.label}`));
  if (shape.country === "Canada") roleTypeKeys.add("Canada:National").add("Canada:Province");
  if (shape.country === "USA") roleTypeKeys.add("USA:National").add("USA:State");
  if (shape.country === "India") roleTypeKeys.add("India:National").add("India:State");

  const roleTypesRaw = await Promise.all(
    Array.from(roleTypeKeys).map((key) => {
      const [country, boundaryType] = key.split(":");
      return getElectionRoleTypes(supabase, country, boundaryType);
    })
  );
  const roleTypes = roleTypesRaw
    .flatMap((r) => r.data || [])
    .filter((r, i, arr) => arr.findIndex((x) => x.role_title === r.role_title) === i);

  const containerList = (containers || []) as Array<{ map_shapes?: { id?: number; name?: string; boundary_type?: string } | null }>;
  const containerNames = containerList.map((c) => c.map_shapes?.name).filter((n): n is string => Boolean(n));

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
    itemListElement: breadcrumbItems.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: b.url })),
  };

  const totalRepresentatives = branches.reduce((sum, b) => sum + (b.top ? 1 : 0) + b.bottom.length, 0);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10 space-y-8">
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

          <div className="text-right">
            <div className="text-2xl font-black text-primary">{totalRepresentatives}</div>
            <div className="text-xs text-text-muted font-medium">
              Active Representative{totalRepresentatives === 1 ? "" : "s"}
            </div>
          </div>
        </div>

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

      {/* Org Chart */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
          <Network size={22} className="text-primary" />
          Chain of Representation
        </h2>
        <BoundaryDirectoryClient
          branches={branches}
          // ?view=all lands on the combined view (linked from the feed
          // sidebar's "All Districts" Directory shortcut) instead of
          // whichever single branch the URL's own boundary belongs to.
          defaultBranchKey={view === "all" && branches.length > 1 ? "all" : primaryBranch.key}
        />
      </div>

      {/* Active Election Nominations */}
      {seatRows.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            Active Election Nominations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {seatRows.map((seat) => (
              <Link
                key={seat.id}
                href={`/elections/seat/${buildSeatSlug({ id: seat.id, role_title: seat.role_title, map_shapes: { name: shape.name, properties: shape.properties } })}`}
                className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-hover/40 hover:bg-primary/10 border border-border-light/40 hover:border-primary/30 transition-all text-sm"
              >
                <span className="font-semibold text-text-main">{seat.role_title}</span>
                <span className="text-primary font-bold flex items-center gap-1 text-xs">
                  {candidateCountBySeat.get(seat.id) || 0} Candidate{(candidateCountBySeat.get(seat.id) || 0) === 1 ? "" : "s"}
                  <ArrowRight size={13} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Roles & Responsibilities Reference */}
      {roleTypes.length > 0 && (
        <div className="pt-6 space-y-3">
          <h3 className="text-base font-bold text-text-main flex items-center gap-2">
            <Landmark size={18} className="text-primary" />
            Roles &amp; Responsibilities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roleTypes.map((role) => (
              <Card key={role.id} padding="sm" className="space-y-1">
                <div className="font-bold text-sm text-text-main">{role.role_title}</div>
                {role.description && (
                  <p className="text-xs text-text-muted leading-relaxed">{role.description}</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
