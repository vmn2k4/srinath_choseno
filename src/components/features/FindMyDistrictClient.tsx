"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MapPin, ArrowRight, Layers, Network } from "lucide-react";
import InteractiveLocationPicker from "./InteractiveLocationPicker";
import BoundaryDirectoryClient from "./BoundaryDirectoryClient";
import { findBoundariesByPoint, getShapeContainers, getNationalShapeForCountry } from "@/lib/services/boundaries";
import { getOfficeHoldersForShape } from "@/lib/services/elections";
import { buildBoundarySlug } from "@/lib/utils/slugs";
import { Card, Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import { trackFindDistrictCompleted } from "@/lib/analytics/events";
import type { BranchHolderNode, RepresentationBranch } from "./RepresentationBranchTree";

interface MatchedBoundary {
  id: number;
  name: string;
  country: string;
  boundary_type: string;
}

interface OfficeHolderRow {
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
}

type ShapeRow = { id: number; name: string; country: string; boundary_type: string; properties?: unknown };

const HEAD_ROLE_TITLES = new Set(["Mayor", "Governor", "Premier", "Prime Minister", "President", "Chief Minister"]);

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
    contact_email: row.contact_email || null,
    contact_phone: row.contact_phone || null,
    source_url: row.source_url || null,
  };
}

function branchKeyFor(shape: ShapeRow): string {
  return shape.boundary_type.toLowerCase().replace(/\s+/g, "-");
}

async function resolveBranch(
  supabase: ReturnType<typeof createClient>,
  shape: ShapeRow
): Promise<RepresentationBranch | null> {
  try {
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
  } catch (err) {
    console.error("Error resolving branch:", err);
    return null;
  }
}

export default function FindMyDistrictClient() {
  const supabase = createClient();
  const [boundaries, setBoundaries] = useState<MatchedBoundary[] | null>(null);
  const [branches, setBranches] = useState<RepresentationBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | undefined>(undefined);
  const [selectedLng, setSelectedLng] = useState<number | undefined>(undefined);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setLoading(true);
    setError("");
    setBranches([]);
    const { data, error: rpcError } = await findBoundariesByPoint(supabase, lat, lng);
    setLoading(false);
    if (rpcError) {
      setError("Couldn't look up boundaries for that location. Please try again.");
      return;
    }
    const matched = (data as MatchedBoundary[] | null) || [];
    trackFindDistrictCompleted({ found: matched.length > 0, boundaryCount: matched.length });
    setBoundaries(matched);

    // Fetch branches for all boundaries (excluding polling districts)
    if (matched.length > 0) {
      setBranchesLoading(true);
      // Filter out polling districts as they're not electoral boundaries
      const boundariesToResolve = matched.filter(
        (b) => !b.boundary_type.toLowerCase().includes("polling")
      );
      const resolvedBranches = await Promise.all(
        boundariesToResolve.map((b) =>
          resolveBranch(supabase, {
            id: b.id,
            name: b.name,
            country: b.country,
            boundary_type: b.boundary_type,
          } as ShapeRow)
        )
      );
      setBranches(resolvedBranches.filter((b): b is RepresentationBranch => b !== null));
      setBranchesLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-page-bg">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 py-4">
        <div className="text-center space-y-2 mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Find your electoral district and representatives
          </h1>
          <p className="text-text-muted text-sm max-w-2xl mx-auto">
            Search your address to discover your federal, provincial, and municipal electoral boundaries,
            your elected representatives, and 2026 election candidates in your area. Free,
            non-partisan, and no login required.
          </p>
        </div>
      </header>

      {/* Main Layout - Two Column (Map + Boundaries) */}
      <section className="w-full max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
          {/* Left Column - Map */}
          <div className="space-y-4">
            <InteractiveLocationPicker
              currentLat={selectedLat}
              currentLng={selectedLng}
              onLocationSelect={handleLocationSelect}
              loading={loading}
              error={error}
            />
          </div>

          {/* Right Column - Electoral Boundaries */}
          <div className="space-y-4">
            {/* Loading State */}
            {loading && (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            )}

            {/* Boundaries List */}
            {!loading && boundaries && (
              <section className="space-y-3" aria-label="Electoral boundaries at your location">
                {boundaries.length === 0 ? (
                  <Card padding="md" className="text-center text-sm text-text-muted">
                    No mapped boundaries found for that location yet. Coverage expands as new
                    regions are added.
                  </Card>
                ) : (
                  <>
                    <h2 className="text-base font-bold text-text-main">Your Electoral Boundaries</h2>
                    <div className="space-y-3">
                      {boundaries.map((b) => (
                        <Link
                          key={b.id}
                          href={`/elections/${buildBoundarySlug(b)}`}
                          className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border-light/40 bg-surface-elevated/70 hover:border-primary/40 hover:bg-surface-hover/40 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-surface/80 border border-border-light/40 flex items-center justify-center shrink-0">
                              <Layers size={16} className="text-primary" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-text-main truncate">{b.name}</p>
                              <p className="text-xs text-text-muted flex items-center gap-1">
                                <MapPin size={10} /> {b.boundary_type} · {b.country}
                              </p>
                            </div>
                          </div>
                          <ArrowRight
                            size={16}
                            className="text-text-muted shrink-0 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        </div>

        {/* Full Width - Chain of Representation (Below Map & Boundaries) */}
        {!loading && boundaries && boundaries.length > 0 && (
          <section className="space-y-4 border-t border-border-light/40 pt-8" aria-label="Representatives by government level">
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Network size={20} className="text-primary" aria-hidden="true" />
              Chain of Representation
            </h2>

            {branchesLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : branches.length > 0 ? (
              <BoundaryDirectoryClient
                branches={branches}
                defaultBranchKey="all"
              />
            ) : (
              <Card padding="md" className="text-center text-sm text-text-muted">
                No office holders data available for the selected boundaries yet.
              </Card>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
