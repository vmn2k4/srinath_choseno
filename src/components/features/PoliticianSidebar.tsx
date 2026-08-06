"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ChevronRight, Landmark, ArrowRight, UserCheck } from "lucide-react";
import { Card, Spinner, EmptyState, Avatar, Badge } from "@/components/primitives";
import { getInterestedPoliticians } from "@/lib/services/profile";
import { getOfficeHoldersForShapes, getFeaturedOfficeHolders } from "@/lib/services/elections";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { buildBoundarySlug } from "@/lib/utils/slugs";
import { createClient } from "@/lib/supabase/client";

interface MembershipShape {
  id: number;
  name: string;
  boundary_type: string;
  country: string;
}

interface InterestedPolitician {
  id: number;
  political_target_role: string | null;
  target_boundary_name: string | null;
  target_boundary_type: string | null;
  avatar_url: string | null;
  profiles: {
    current_ghost_id: string | null;
    full_name: string | null;
    country: string | null;
  } | null;
}

interface OfficeHolderItem {
  id: string;
  map_shape_id: number;
  full_name: string;
  source_url: string | null;
  photo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  linked_profile_id: string | null;
  map_shapes?: { id: number; name: string; boundary_type: string; country: string } | null;
  election_role_types?: { role_title: string; role_key: string } | null;
  political_parties?: { name: string } | null;
  profiles?: { id: string; full_name: string; current_ghost_id: string } | null;
}

export default function PoliticianSidebar({
  profile,
  activeTab,
  selectedPill,
  memberships = [],
}: {
  profile: { country?: string | null } | null;
  activeTab: string;
  selectedPill?: {
    key: string;
    districtName: string;
    divisionType: string;
    filterType: "all" | "shape" | "country" | "international";
    shapeId?: number;
  };
  memberships?: MembershipShape[];
}) {
  const supabase = createClient();
  const [politicians, setPoliticians] = useState<InterestedPolitician[]>([]);
  const [officeHolders, setOfficeHolders] = useState<OfficeHolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHolders, setLoadingHolders] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchPoliticians() {
      if (!profile) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const filterType = selectedPill?.filterType || (activeTab === "all" ? "all" : activeTab === "international" ? "international" : "all");
      const shapeId = selectedPill?.shapeId;

      const { data, error } = await getInterestedPoliticians(supabase, {
        filterType,
        shapeId,
        country: profile?.country,
      });

      if (!error && data && isMounted) {
        setPoliticians(data as unknown as InterestedPolitician[]);
      }
      if (isMounted) setLoading(false);
    }

    async function fetchHolders() {
      setLoadingHolders(true);
      const targetShapeIds = selectedPill?.shapeId
        ? [selectedPill.shapeId]
        : memberships.map((m) => m.id);

      if (targetShapeIds.length > 0) {
        const { data, error } = await getOfficeHoldersForShapes(supabase, targetShapeIds);
        if (!error && data && data.length > 0 && isMounted) {
          setOfficeHolders(data as unknown as OfficeHolderItem[]);
        } else if (isMounted) {
          const { data: featuredData } = await getFeaturedOfficeHolders(supabase, profile?.country);
          if (featuredData && isMounted) {
            setOfficeHolders(featuredData as unknown as OfficeHolderItem[]);
          }
        }
      } else if (isMounted) {
        const { data: featuredData } = await getFeaturedOfficeHolders(supabase, profile?.country);
        if (featuredData && isMounted) {
          setOfficeHolders(featuredData as unknown as OfficeHolderItem[]);
        }
      }
      if (isMounted) setLoadingHolders(false);
    }

    fetchPoliticians();
    fetchHolders();

    return () => {
      isMounted = false;
    };
  }, [profile, activeTab, selectedPill, memberships, supabase]);

  if (activeTab?.toLowerCase() === "international" || selectedPill?.filterType === "international") return null;

  // Active shape for direct boundary office holder page link
  const activeShape = selectedPill?.shapeId
    ? { id: selectedPill.shapeId, name: selectedPill.districtName }
    : memberships.length > 0
    ? { id: memberships[0].id, name: memberships[0].name }
    : null;

  return (
    <div className="space-y-4 sticky top-24">
      {/* Current Office Holders Section */}
      <Card variant="composer" padding="sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-text-main font-bold flex items-center gap-2 text-sm sm:text-base">
            <Landmark size={18} className="text-primary" />
            Current Office Holders
          </h3>
          {activeShape && (
            <Link
              href={`/elections/${buildBoundarySlug(activeShape)}`}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
              title="View full office holder page"
            >
              Directory <ArrowRight size={12} />
            </Link>
          )}
        </div>

        {loadingHolders ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : officeHolders.length === 0 ? (
          <div className="space-y-2">
            <p className="text-text-muted text-xs">No active office holders loaded for this boundary yet.</p>
            {activeShape && (
              <Link
                href={`/elections/${buildBoundarySlug(activeShape)}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                View boundary page <ChevronRight size={12} />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {officeHolders.slice(0, 5).map((holder) => {
              const roleTitle = holder.election_role_types?.role_title || "Incumbent";
              const partyName = holder.political_parties?.name;
              const boundaryName = holder.map_shapes?.name || "";
              const profileGhostId = holder.profiles?.current_ghost_id;

              const content = (
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface-hover/40 border border-border-light/40 hover:border-primary/30 transition-all">
                  <Avatar src={holder.photo_url} name={holder.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-text-main text-xs font-semibold truncate">{holder.full_name}</h4>
                      {holder.linked_profile_id && (
                        <Badge variant="primary" size="sm" className="text-[10px] px-1 py-0 shrink-0">
                          On Choseno
                        </Badge>
                      )}
                    </div>
                    <p className="text-text-muted text-[11px] truncate mt-0.5">
                      <span className="font-medium text-primary">{roleTitle}</span>
                      {partyName ? ` · ${partyName}` : ""}
                    </p>
                    {boundaryName && (
                      <p className="text-text-darker text-[10px] truncate">{boundaryName}</p>
                    )}
                  </div>
                </div>
              );

              if (profileGhostId) {
                const slug = `${holder.full_name}-${roleTitle}`
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)+/g, "");
                return (
                  <Link key={holder.id} href={`/wall/${profileGhostId}/${slug}`} className="block">
                    {content}
                  </Link>
                );
              }

              if (holder.source_url) {
                return (
                  <a key={holder.id} href={holder.source_url} target="_blank" rel="noopener noreferrer" className="block">
                    {content}
                  </a>
                );
              }

              return <div key={holder.id}>{content}</div>;
            })}

            {activeShape && (
              <Link
                href={`/elections/${buildBoundarySlug(activeShape)}`}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20 text-xs font-semibold text-primary flex items-center justify-center gap-1.5 transition-colors text-center"
              >
                <UserCheck size={14} />
                View Full Office Holder Directory
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}
      </Card>

      {/* Candidates & Representatives Section */}
      <Card variant="composer" padding="sm">
        <h3 className="text-text-main font-bold mb-3 flex items-center gap-2 text-sm sm:text-base">
          <Users size={18} className="text-primary" />
          Candidates &amp; Representatives
        </h3>

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : politicians.length === 0 ? (
          <EmptyState description="No candidates or representatives found for your area yet." />
        ) : (
          <div className="space-y-2.5">
            {politicians.map((pol) => {
              const name = pol.profiles?.full_name || getGhostDisplayName(pol.profiles?.current_ghost_id);
              const role = pol.political_target_role || "politician";
              const boundary = pol.target_boundary_name || pol.profiles?.country || "";
              const slug = `${name}-${role}-${boundary}`
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)+/g, "");

              return (
                <Link
                  key={pol.id}
                  href={`/wall/${pol.profiles?.current_ghost_id}/${slug}`}
                  className="group cursor-pointer bg-surface-hover/50 hover:bg-surface-hover rounded-lg p-2.5 border border-border-light/50 hover:border-primary/30 transition-all flex items-center gap-2.5"
                >
                  <Avatar src={pol.avatar_url} name={name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-text-secondary text-xs font-medium truncate">{name}</h4>
                    <p className="text-text-muted text-[11px] truncate">{pol.political_target_role}</p>
                  </div>
                  <ChevronRight size={16} className="text-text-darker group-hover:text-primary-light transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
