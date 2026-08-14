import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
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
const HEAD_ROLE_TITLES = new Set(["Mayor", "Governor", "Premier", "Prime Minister", "President", "Chief Minister", "Board Chair"]);

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

function toNode(row: OfficeHolderRow & { profiles?: { politician_profiles?: { photo_url?: string | null; avatar_url?: string | null; contact_email?: string | null; contact_phone?: string | null; source_url?: string | null } | null } | null }): BranchHolderNode {
  const pp = row.profiles?.politician_profiles;
  return {
    id: row.id,
    full_name: row.full_name,
    role_title: row.election_role_types?.role_title || "Elected Official",
    role_description: row.election_role_types?.description || null,
    party_name: row.political_parties?.name || null,
    photo_url: row.photo_url || pp?.photo_url || pp?.avatar_url || null,
    ghost_id: row.profiles?.current_ghost_id || null,
    boundary_name: row.map_shapes?.name || null,
    contact_email: row.contact_email || pp?.contact_email || null,
    contact_phone: row.contact_phone || pp?.contact_phone || null,
    source_url: row.source_url || pp?.source_url || null,
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

  return {
    key: branchKeyFor(shape),
    label: shape.boundary_type,
    districtName: shape.name || null,
    top,
    bottom,
  };
}

// generateMetadata and the page component below both resolve the same
// shape from boundarySlug. Deduped via React cache() so it's one DB round
// trip per request instead of two.
const loadShape = cache(async (boundarySlug: string) => {
  const shapeId = extractShapeIdFromSlug(boundarySlug);
  const supabase = await createServerClient();
  const { data: shape } = await getMapShapeById(supabase, shapeId);
  return { supabase, shape };
});

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

  // These three don't depend on each other -- the seats/candidates lookup,
  // the primary branch's office holders, and the auth check (which itself
  // is a network round trip to validate the session) -- so run them
  // concurrently instead of one after another.
  const [{ containers, seatRows, candidateCountBySeat }, primaryBranch, {
    data: { user },
  }] = await Promise.all([
    (async () => {
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
      return { containers, seatRows, candidateCountBySeat };
    })(),
    // Primary branch: whichever hierarchy the boundary being viewed itself
    // belongs to (a Federal riding page always shows Prime Minister → MP, a
    // Municipal page always shows Mayor → Councillors, etc).
    resolveBranch(supabase, shape as ShapeRow),
    supabase.auth.getUser(),
  ]);

  const branches: RepresentationBranch[] = [primaryBranch];

  // Plus, for a signed-in citizen, their OTHER branches too (their own
  // Provincial riding, Municipal ward, etc.) -- so "All" genuinely shows
  // their whole civic picture: PM→MP, Premier→MLA, and Mayor→Councillors
  // together, not just whichever single boundary the URL happens to name.
  if (user) {
    const { data: memberships } = await getUserBoundaryMemberships(supabase, user.id);
    const memberShapes = (memberships || [])
      .map((m: any) => m.map_shapes as ShapeRow | null)
      .filter(
        (s): s is ShapeRow =>
          s != null && s.country === shape.country && !s.boundary_type.toLowerCase().includes("polling")
      );

    // Dedup synchronously first (two member shapes could share a branch
    // key), then resolve every distinct branch concurrently instead of
    // one seat/office-holder lookup at a time.
    const seenKeys = new Set(branches.map((b) => b.key));
    const shapesToResolve: ShapeRow[] = [];
    for (const memberShape of memberShapes) {
      const key = branchKeyFor(memberShape);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      shapesToResolve.push(memberShape);
    }
    const resolvedBranches = await Promise.all(
      shapesToResolve.map((memberShape) => resolveBranch(supabase, memberShape))
    );
    branches.push(...resolvedBranches);
  }

  // Roles & Responsibilities reference -- only show roles that are actually
  // relevant to the current directory (branches) and active election seats.
  // This avoids showing Quebec (MNA), Newfoundland (MHA), Ontario (MPP) etc.
  // on a BC boundary page.
  const activeRoleTitles: string[] = [];
  const roleDescriptions = new Map<string, string | null>();

  // Collect roles in branch hierarchy order: top first, then bottom holders
  for (const b of branches) {
    if (b.top?.role_title && !activeRoleTitles.includes(b.top.role_title)) {
      activeRoleTitles.push(b.top.role_title);
      roleDescriptions.set(b.top.role_title, b.top.role_description || null);
    }
    for (const n of b.bottom) {
      if (n.role_title && !activeRoleTitles.includes(n.role_title)) {
        activeRoleTitles.push(n.role_title);
        roleDescriptions.set(n.role_title, n.role_description || null);
      }
    }
  }
  for (const s of seatRows) {
    if (s.role_title && !activeRoleTitles.includes(s.role_title)) {
      activeRoleTitles.push(s.role_title);
    }
  }

  // If any active roles need a description from election_role_types DB (e.g. seats without a holder)
  if (activeRoleTitles.some((title) => !roleDescriptions.get(title))) {
    const { data: dbRoleTypes } = await supabase
      .from("election_role_types")
      .select("id, role_title, description")
      .eq("country", shape.country)
      .in("role_title", activeRoleTitles);

    (dbRoleTypes || []).forEach((r: any) => {
      if (r.role_title && r.description && !roleDescriptions.get(r.role_title)) {
        roleDescriptions.set(r.role_title, r.description);
      }
    });
  }

  const roleTypes = activeRoleTitles
    .map((title, idx) => ({
      id: `role-${idx}-${title}`,
      role_title: title,
      description: roleDescriptions.get(title) || null,
    }))
    .filter((r) => r.role_title && r.role_title !== "Elected Official");

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

      {/* Header Banner — below sm the representative count folds into the
          subtitle line instead of its own standalone stat block, and the
          boundary name shrinks a step, so the actual Chain of
          Representation list starts higher on the mobile fold. sm+ is
          unchanged. */}
      <div className="bg-surface/50 border border-border-light/50 rounded-2xl p-4 sm:p-8 space-y-3 sm:space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge tone="primary" size="sm">
                {shape.boundary_type}
              </Badge>
              <Badge tone="neutral" size="sm">
                {shape.country}
              </Badge>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-text-main truncate">
              {shape.name}
            </h1>
            <p className="mt-1 text-sm text-text-muted flex items-center gap-1.5 flex-wrap">
              <MapPin size={15} className="text-primary shrink-0" />
              Electoral Directory &amp; Office Holders
              <span className="sm:hidden font-semibold text-text-main">
                · {totalRepresentatives} active rep{totalRepresentatives === 1 ? "" : "s"}
              </span>
            </p>
          </div>

          <div className="hidden sm:block text-right shrink-0">
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
