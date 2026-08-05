"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { Card, Spinner, EmptyState, Avatar } from "@/components/primitives";
import { getInterestedPoliticians } from "@/lib/services/profile";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { createClient } from "@/lib/supabase/client";

interface MembershipShape {
  id: number;
  boundary_type: string;
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

// Restored from the pre-migration Vite app (src/components/PoliticianSidebar.jsx)
// — dropped during the Next.js port. Renders the candidates/representatives
// list for the Feed page's boundary context; hidden on the International tab
// since it has no meaningful boundary scope.
export default function PoliticianSidebar({
  profile,
  activeTab,
  memberships = [],
}: {
  profile: { country?: string | null } | null;
  activeTab: string;
  memberships?: MembershipShape[];
}) {
  const supabase = createClient();
  const [politicians, setPoliticians] = useState<InterestedPolitician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let isMounted = true;

    async function fetchPoliticians() {
      setLoading(true);
      const boundaryIds = memberships.map((m) => m.id);
      const { data, error } = await getInterestedPoliticians(supabase, boundaryIds);

      if (!error && data && isMounted) {
        const rows = data as unknown as InterestedPolitician[];
        const filtered = rows.filter((pol) => {
          if (pol.target_boundary_type === "Country") {
            return pol.profiles?.country === profile?.country;
          }
          return true;
        });

        const sorted = filtered.sort((a, b) => {
          if (a.target_boundary_type === "Federal" && b.target_boundary_type !== "Federal") return -1;
          if (b.target_boundary_type === "Federal" && a.target_boundary_type !== "Federal") return 1;
          return 0;
        });

        setPoliticians(sorted);
      }
      if (isMounted) setLoading(false);
    }

    fetchPoliticians();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeTab, memberships, supabase]);

  if (activeTab?.toLowerCase() === "international") return null;

  return (
    <Card variant="composer" padding="sm" className="sticky top-24">
      <h3 className="text-text-main font-bold mb-4 flex items-center gap-2 text-sm sm:text-base">
        <Users size={18} className="text-primary" />
        Candidates &amp; Representatives
      </h3>

      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : politicians.length === 0 ? (
        <EmptyState
          description={
            activeTab && !["master", "country"].includes(activeTab.toLowerCase())
              ? `No candidates or representatives found for this ${activeTab.toLowerCase()} area yet.`
              : "No candidates or representatives found for your area yet."
          }
        />
      ) : (
        <div className="space-y-3">
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
                className="group cursor-pointer bg-surface-hover/50 hover:bg-surface-hover rounded-lg p-3 border border-border-light/50 hover:border-primary/30 transition-all flex items-center gap-3"
              >
                <Avatar src={pol.avatar_url} name={name} size="sm" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-text-secondary text-sm font-medium truncate">{name}</h4>
                  <p className="text-text-muted text-xs truncate">{pol.political_target_role}</p>
                </div>
                <ChevronRight size={16} className="text-text-darker group-hover:text-primary-light transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
