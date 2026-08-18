"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, ChevronRight, Landmark, ArrowRight, UserCheck } from "lucide-react";
import { Card, Spinner, EmptyState, Avatar, Badge } from "@/components/primitives";
import PoliticianEngagementStats from "./PoliticianEngagementStats";
import { getInterestedPoliticians } from "@/lib/services/profile";
import { getOfficeHoldersForShapes, getFeaturedOfficeHolders } from "@/lib/services/elections";
import { getContainersForShapeIds, getNationalShapeForCountry } from "@/lib/services/boundaries";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { buildBoundarySlug, buildPoliticianWallSlug } from "@/lib/utils/slugs";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/contexts/LanguageContext";

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
    id: string;
    current_ghost_id: string | null;
    full_name: string | null;
    country: string | null;
  } | null;
}

const TOP_TIER_ROLES = new Set(["Prime Minister", "President", "Premier", "Governor"]);

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
  const { t } = useTranslation();
  const supabase = createClient();
  const [politicians, setPoliticians] = useState<InterestedPolitician[]>([]);
  const [officeHolders, setOfficeHolders] = useState<OfficeHolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHolders, setLoadingHolders] = useState(true);
  const [engagementSummaries, setEngagementSummaries] = useState<
    Map<string, { supporterCount: number; avgRating: number; ratingCount: number; commentCount: number }>
  >(new Map());

  const membershipCountries = useMemo(
    () => Array.from(new Set(memberships.map((m) => m.country).filter(Boolean))),
    [memberships]
  );

  const selectedShapeCountry = selectedPill?.shapeId
    ? memberships.find((m) => m.id === selectedPill.shapeId)?.country || null
    : null;

  // Use the live boundary memberships as the source of truth. `profiles.country`
  // can lag behind after a user moves countries, but memberships are what the
  // feed/sidebar is actually rendering against.
  const effectiveCountry =
    selectedShapeCountry || (membershipCountries.length === 1 ? membershipCountries[0] : profile?.country || null);

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

      const userShapeIds = memberships.map((m) => m.id);

      const { data, error } = await getInterestedPoliticians(supabase, {
        filterType,
        shapeId,
        shapeIds: userShapeIds,
        country: effectiveCountry,
      });

      if (!error && data && isMounted) {
        setPoliticians(data as unknown as InterestedPolitician[]);
      }
      if (isMounted) setLoading(false);
    }

    async function fetchHolders() {
      setLoadingHolders(true);
      const isAllDistricts = !selectedPill?.shapeId && (selectedPill?.filterType || activeTab) === "all";
      let targetShapeIds = selectedPill?.shapeId
        ? [selectedPill.shapeId]
        : memberships.map((m) => m.id);

      // "All Districts" implies the user's country and (for Canada) their
      // Province — pull in the head of state/government for both, even
      // though neither is a real membership: National is always admin_only
      // (resolved by profile.country, not geo), and Province is an
      // admin_only container a riding-level membership sits inside (USA's
      // State is already a normal membership, so its Governor is already
      // covered by the base membership fetch above with no extra work).
      if (isAllDistricts && effectiveCountry) {
        const idsSet = new Set(targetShapeIds);
        const { data: nationalShape } = await getNationalShapeForCountry(supabase, effectiveCountry);
        if (nationalShape?.id) idsSet.add(nationalShape.id);

        if (memberships.length > 0) {
          const { data: containers } = await getContainersForShapeIds(supabase, memberships.map((m) => m.id));
          (containers || []).forEach((c: any) => {
            if (c.container_shape_id) idsSet.add(c.container_shape_id);
          });
        }

        targetShapeIds = Array.from(idsSet);
      }

      if (targetShapeIds.length > 0) {
        const { data, error } = await getOfficeHoldersForShapes(supabase, targetShapeIds);
        if (!error && data && data.length > 0 && isMounted) {
          const countryScopedData = effectiveCountry
            ? data.filter((holder: any) => holder.map_shapes?.country === effectiveCountry)
            : data;
          // "All Districts" can pull in more office holders than the list's
          // display cap (a dense municipality's councillors alone can exceed
          // it) — float the Prime Minister/President/Premier/Governor to the
          // top so they're never the ones truncated out.
          const ranked = isAllDistricts
            ? [...countryScopedData].sort((a: any, b: any) => {
                const rank = (role?: string) => (TOP_TIER_ROLES.has(role || "") ? 0 : 1);
                return rank(a.election_role_types?.role_title) - rank(b.election_role_types?.role_title);
              })
            : countryScopedData;
          setOfficeHolders(ranked as unknown as OfficeHolderItem[]);
        } else if (isMounted) {
          const { data: featuredData } = await getFeaturedOfficeHolders(supabase, effectiveCountry);
          if (featuredData && isMounted) {
            setOfficeHolders(featuredData as unknown as OfficeHolderItem[]);
          } else if (isMounted) {
            setOfficeHolders([]);
          }
        }
      } else if (isMounted) {
        const { data: featuredData } = await getFeaturedOfficeHolders(supabase, effectiveCountry);
        if (featuredData && isMounted) {
          setOfficeHolders(featuredData as unknown as OfficeHolderItem[]);
        } else {
          setOfficeHolders([]);
        }
      }
      if (isMounted) setLoadingHolders(false);
    }

    fetchPoliticians();
    fetchHolders();

    return () => {
      isMounted = false;
    };
  }, [profile, activeTab, selectedPill, memberships, effectiveCountry, supabase]);

  // Batch-fetch supporter/rating/comment summaries for every politician
  // shown across both sections, once per render of the underlying lists —
  // one round trip instead of one query per card.
  useEffect(() => {
    let isMounted = true;
    const ids = [
      ...officeHolders.map((h) => h.profiles?.id),
      ...politicians.map((p) => p.profiles?.id),
    ].filter((id): id is string => Boolean(id));

    if (ids.length === 0) return;

    getPoliticianEngagementSummaries(supabase, ids).then(({ data }) => {
      if (!isMounted || !data) return;
      const map = new Map<
        string,
        { supporterCount: number; avgRating: number; ratingCount: number; commentCount: number }
      >();
      for (const row of data as {
        politician_id: string;
        supporter_count: number;
        avg_rating: number;
        rating_count: number;
        comment_count: number;
      }[]) {
        map.set(row.politician_id, {
          supporterCount: row.supporter_count,
          avgRating: row.avg_rating,
          ratingCount: row.rating_count,
          commentCount: row.comment_count,
        });
      }
      setEngagementSummaries(map);
    });

    return () => {
      isMounted = false;
    };
  }, [officeHolders, politicians, supabase]);

  if (activeTab?.toLowerCase() === "international" || selectedPill?.filterType === "international") return null;

  // Active shape for direct boundary office holder page link -- a specific
  // pill (Federal/Provincial/Municipal) links straight to that boundary's
  // own directory, but "All Districts" has no single boundary to name, so it
  // falls back to any one membership just to have a valid URL to land on.
  const isAllDistricts = !selectedPill?.shapeId && (selectedPill?.filterType || activeTab) === "all";
  const activeShape = selectedPill?.shapeId
    ? { id: selectedPill.shapeId, name: selectedPill.districtName }
    : memberships.length > 0
    ? { id: memberships[0].id, name: memberships[0].name }
    : null;
  // ?view=all tells that landing page to default to its own "All" tab
  // (every branch stacked together) instead of whichever single branch the
  // fallback boundary happens to belong to -- otherwise "All Districts" here
  // always bounced to a single branch's directory (e.g. always Federal, if
  // that happened to be memberships[0]) instead of showing everything.
  const directoryHref = activeShape
    ? `/elections/${buildBoundarySlug(activeShape)}${isAllDistricts ? "?view=all" : ""}`
    : null;

  return (
    <div className="space-y-4 sticky top-24">
      {/* Current Office Holders Section */}
      <Card variant="composer" padding="sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-text-main font-bold flex items-center gap-2 text-sm sm:text-base">
            <Landmark size={18} className="text-primary" />
            {t("sidebar.currentOfficeHolders")}
          </h3>
          {directoryHref && (
            <Link
              href={directoryHref}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
              title="View full office holder page"
            >
              {t("sidebar.directory")} <ArrowRight size={12} />
            </Link>
          )}
        </div>

        {loadingHolders ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : officeHolders.length === 0 ? (
          <div className="space-y-2">
            <p className="text-text-muted text-xs">{t("sidebar.noOfficeHolders")}</p>
            {directoryHref && (
              <Link
                href={directoryHref}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                {t("sidebar.viewBoundaryPage")} <ChevronRight size={12} />
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
              const engagement = holder.profiles?.id ? engagementSummaries.get(holder.profiles.id) : undefined;

              const content = (
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface-hover/40 border border-border-light/40 hover:border-primary/30 transition-all">
                  <Avatar src={holder.photo_url} name={holder.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-text-main text-xs font-semibold truncate">{holder.full_name}</h4>
                      {holder.linked_profile_id && (
                        <Badge tone="primary" size="sm" className="text-[10px] px-1 py-0 shrink-0">
                          {t("sidebar.onChoseno")}
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
                        size="xs"
                        className="mt-0.5"
                        disableRating
                      />
                    )}
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
                const slug = buildPoliticianWallSlug(holder.full_name, roleTitle);
                return (
                  <Link key={holder.id} href={`/wall/${slug}`} className="block">
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

            {directoryHref && (
              <Link
                href={directoryHref}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20 text-xs font-semibold text-primary flex items-center justify-center gap-1.5 transition-colors text-center"
              >
                <UserCheck size={14} />
                {t("sidebar.viewFullDirectory")}
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
          {t("sidebar.candidatesAndReps")}
        </h3>

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : politicians.length === 0 ? (
          <EmptyState description={t("sidebar.noCandidates")} />
        ) : (
          <div className="space-y-2.5">
            {politicians.map((pol) => {
              const name = pol.profiles?.full_name || getGhostDisplayName(pol.profiles?.current_ghost_id);
              const role = pol.political_target_role || "politician";
              const boundary = pol.target_boundary_name || pol.profiles?.country || "";
              const slug = buildPoliticianWallSlug(name, role);
              const engagement = pol.profiles?.id ? engagementSummaries.get(pol.profiles.id) : undefined;

              return (
                <Link
                  key={pol.id}
                  href={`/wall/${slug}`}
                  className="group cursor-pointer bg-surface-hover/50 hover:bg-surface-hover rounded-lg p-2.5 border border-border-light/50 hover:border-primary/30 transition-all flex items-center gap-2.5"
                >
                  <Avatar src={pol.avatar_url} name={name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-text-secondary text-xs font-medium truncate">{name}</h4>
                    {pol.profiles?.id && (
                      <PoliticianEngagementStats
                        politicianId={pol.profiles.id}
                        politicianName={name}
                        supporterCount={engagement?.supporterCount ?? 0}
                        avgRating={engagement?.avgRating ?? 0}
                        ratingCount={engagement?.ratingCount ?? 0}
                        commentCount={engagement?.commentCount ?? 0}
                        size="xs"
                        className="mt-0.5"
                        disableRating
                      />
                    )}
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
