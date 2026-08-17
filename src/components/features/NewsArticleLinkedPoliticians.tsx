"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, ArrowRight, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import PoliticianEngagementStats from "@/components/features/PoliticianEngagementStats";
import PoliticianInlineRating from "@/components/features/PoliticianInlineRating";

interface LinkedPolitician {
  id: string;
  full_name: string;
  designation?: string | null;
  constituency?: string | null;
  current_ghost_id?: string | null;
  politician_profiles?: {
    photo_url?: string | null;
    avatar_url?: string | null;
    wall_slug?: string | null;
    political_target_role?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  } | null;
}

interface EngagementMap {
  [politicianId: string]: {
    supporterCount: number;
    avgRating: number;
    ratingCount: number;
    commentCount: number;
  };
}

interface NewsArticleLinkedPoliticiansProps {
  politicians: LinkedPolitician[];
  articleTitle: string;
}

// Rate-and-discuss strip shown below every news article for each office
// holder tagged on it. Clicking the stats expands PoliticianInlineRating in
// place (upsert_politician_rating RPC -> politician_ratings) instead of a
// modal or navigation, so a rating cast here is the exact same row the wall
// page, candidate chips, and office-holder cards read back — just without
// leaving the article. "View Wall" still links out to the politician's
// public wall for the full discussion.
export default function NewsArticleLinkedPoliticians({
  politicians,
  articleTitle,
}: NewsArticleLinkedPoliticiansProps) {
  const supabase = createClient();
  const [engagement, setEngagement] = useState<EngagementMap>({});
  const [loading, setLoading] = useState(true);
  // Which politician's inline "leave a review" panel is open — at most one
  // at a time, expands in place under that row instead of a popup/nav.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEngagementFor = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data: summaries } = await getPoliticianEngagementSummaries(supabase, ids);
    const summaryById = new Map((summaries || []).map((s: any) => [s.politician_id, s]));
    setEngagement((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        const summary = summaryById.get(id) as
          | { supporter_count: number; avg_rating: number; rating_count: number; comment_count: number }
          | undefined;
        next[id] = {
          supporterCount: summary?.supporter_count || 0,
          avgRating: summary?.avg_rating || 0,
          ratingCount: summary?.rating_count || 0,
          commentCount: summary?.comment_count || 0,
        };
      });
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const ids = politicians.map((p) => p.id).filter(Boolean);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      await loadEngagementFor(ids);
      if (isMounted) setLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [politicians.map((p) => p.id).join(",")]);

  if (!politicians || politicians.length === 0) {
    return null;
  }

  const getAvatarUrl = (politician: LinkedPolitician): string | null => {
    return politician.politician_profiles?.photo_url || politician.politician_profiles?.avatar_url || null;
  };

  const getInitial = (name: string): string => {
    return name.trim().charAt(0).toUpperCase();
  };

  return (
    <div id="rate-politicians" className="w-full space-y-2.5 scroll-mt-24">
      {/* Header — title + value message together so the "why" rides along
          with the "what" instead of eating its own paragraph. Tagline hides
          below `sm` where every character of width is precious. */}
      <h3 className="text-sm font-bold text-slate-900">
        Rate the people mentioned in this article
        <span className="font-normal text-slate-500 hidden sm:inline"> — helps other voters decide</span>
      </h3>

      {/* One compact row per politician: avatar, name + live stats, CTA —
          all on a single line instead of a stacked multi-section card. */}
      <div className="space-y-2">
        {politicians.map((politician) => {
          const avatarUrl = getAvatarUrl(politician);
          const wallSlug = politician.politician_profiles?.wall_slug;
          const wallUrl = wallSlug
            ? `/wall/${wallSlug}`
            : politician.current_ghost_id
              ? `/wall/${politician.current_ghost_id}`
              : null;
          const stats = engagement[politician.id];

          const isExpanded = expandedId === politician.id;

          return (
            <div
              key={politician.id}
              className="border border-slate-200 rounded-xl bg-white hover:border-orange-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3 p-3">
                {/* Avatar */}
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={politician.full_name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-orange-300 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center font-bold border-2 border-orange-300 shrink-0">
                    {getInitial(politician.full_name)}
                  </div>
                )}

                {/* Name + live supporters · rating · comments — clicking the
                    stats expands the inline rating panel below this row
                    instead of a popup, so the page never navigates away. */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{politician.full_name}</p>
                  {/* Role/district — designation & constituency were already
                      fetched for every tagged politician but never actually
                      shown here, so a reader (or crawler) had no way to know
                      WHICH office/district this row refers to. */}
                  {(politician.designation || politician.constituency) && (
                    <p className="text-xs text-slate-500 truncate">
                      {politician.designation}
                      {politician.designation && politician.constituency ? " — " : ""}
                      {politician.constituency}
                    </p>
                  )}
                  {(politician.politician_profiles?.contact_email || politician.politician_profiles?.contact_phone) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {politician.politician_profiles?.contact_email && (
                        <a
                          href={`mailto:${politician.politician_profiles.contact_email}`}
                          className="inline-flex items-center gap-1 text-[11px] text-orange-700 hover:underline"
                        >
                          <Mail size={11} className="shrink-0" />
                          <span className="truncate max-w-[140px]">{politician.politician_profiles.contact_email}</span>
                        </a>
                      )}
                      {politician.politician_profiles?.contact_phone && (
                        <a
                          href={`tel:${politician.politician_profiles.contact_phone}`}
                          className="inline-flex items-center gap-1 text-[11px] text-orange-700 hover:underline"
                        >
                          <Phone size={11} className="shrink-0" />
                          {politician.politician_profiles.contact_phone}
                        </a>
                      )}
                    </div>
                  )}
                  {loading || !stats ? (
                    <div className="h-4 w-32 bg-slate-100 rounded animate-pulse mt-1" />
                  ) : (
                    <PoliticianEngagementStats
                      politicianId={politician.id}
                      politicianName={politician.full_name}
                      supporterCount={stats.supporterCount}
                      avgRating={stats.avgRating}
                      ratingCount={stats.ratingCount}
                      commentCount={stats.commentCount}
                      size="xs"
                      onRateClick={() => setExpandedId(isExpanded ? null : politician.id)}
                    />
                  )}
                </div>

                {/* Wall Link — for reading the full wall / discussion.
                    Rating itself now happens inline via the stats above. */}
                {wallUrl && (
                  <Link
                    href={wallUrl}
                    title="View Wall"
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    <MessageSquare size={13} className="shrink-0" />
                    <span className="hidden sm:inline">View Wall</span>
                    <ArrowRight size={13} className="shrink-0" />
                  </Link>
                )}
              </div>

              {isExpanded && (
                <div className="px-3 pb-3">
                  <PoliticianInlineRating
                    politicianId={politician.id}
                    politicianName={politician.full_name}
                    onSubmitted={() => loadEngagementFor([politician.id])}
                    onCancel={() => setExpandedId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
