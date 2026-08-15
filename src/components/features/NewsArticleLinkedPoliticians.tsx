"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";
import PoliticianEngagementStats from "@/components/features/PoliticianEngagementStats";

interface LinkedPolitician {
  id: string;
  full_name: string;
  designation?: string | null;
  constituency?: string | null;
  current_ghost_id?: string | null;
  politician_profiles?: {
    photo_url?: string | null;
    avatar_url?: string | null;
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
// holder tagged on it. Reuses the same rating stack as the rest of the app
// (PoliticianEngagementStats -> PoliticianRatingModal -> upsert_politician_
// rating RPC -> politician_ratings) rather than a bespoke star widget, so a
// rating cast here is the exact same row the wall page, candidate chips, and
// office-holder cards read back. Also links out to the politician's public
// wall, turning a news read into a natural next-click toward more articles
// and community sentiment about that person.
export default function NewsArticleLinkedPoliticians({
  politicians,
  articleTitle,
}: NewsArticleLinkedPoliticiansProps) {
  const supabase = createClient();
  const [engagement, setEngagement] = useState<EngagementMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const ids = politicians.map((p) => p.id).filter(Boolean);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      const { data: summaries } = await getPoliticianEngagementSummaries(supabase, ids);

      if (!isMounted) return;

      const summaryById = new Map((summaries || []).map((s: any) => [s.politician_id, s]));
      const map: EngagementMap = {};
      ids.forEach((id) => {
        const summary = summaryById.get(id) as
          | { supporter_count: number; avg_rating: number; rating_count: number; comment_count: number }
          | undefined;
        map[id] = {
          supporterCount: summary?.supporter_count || 0,
          avgRating: summary?.avg_rating || 0,
          ratingCount: summary?.rating_count || 0,
          commentCount: summary?.comment_count || 0,
        };
      });
      setEngagement(map);
      setLoading(false);
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
    <div className="mt-12 pt-8 border-t border-slate-200">
      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          What do you think of the office holders mentioned in this article?
        </h3>
        <p className="text-slate-600">
          Rate their performance or read what others think about them on their public walls.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {politicians.map((politician) => {
          const avatarUrl = getAvatarUrl(politician);
          const wallUrl = politician.current_ghost_id ? `/wall/${politician.current_ghost_id}` : null;
          const stats = engagement[politician.id];

          return (
            <div
              key={politician.id}
              className="border border-slate-200 rounded-lg overflow-hidden hover:border-orange-300 hover:shadow-md transition-all duration-200"
            >
              {/* Card Header with Politician Info */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-orange-50">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={politician.full_name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-orange-300"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center font-bold text-lg border-2 border-orange-300">
                        {getInitial(politician.full_name)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 text-sm truncate">
                      {politician.full_name}
                    </h4>
                    {politician.designation && (
                      <p className="text-xs text-slate-600 truncate">
                        {politician.designation}
                        {politician.constituency && ` • ${politician.constituency}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Body - Actions */}
              <div className="p-4 space-y-3">
                {/* Live supporters · rating · comments — clicking opens the
                    same PoliticianRatingModal (star + optional comment) used
                    everywhere else in the app */}
                <div className="p-3 bg-blue-50 rounded-lg">
                  {loading || !stats ? (
                    <div className="h-5 w-40 bg-blue-100 rounded animate-pulse" />
                  ) : (
                    <PoliticianEngagementStats
                      politicianId={politician.id}
                      politicianName={politician.full_name}
                      supporterCount={stats.supporterCount}
                      avgRating={stats.avgRating}
                      ratingCount={stats.ratingCount}
                      commentCount={stats.commentCount}
                      size="sm"
                    />
                  )}
                </div>

                {/* Wall Link */}
                {wallUrl && (
                  <Link href={wallUrl}>
                    <button className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-lg transition-all group">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-900">
                          Read their wall
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-orange-600 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </Link>
                )}
              </div>

              {/* Footer - Context */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                <p className="text-xs text-slate-600">
                  💬 See what constituents think about {politician.full_name.split(" ")[0]} based on this and other news
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Call to Action */}
      <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-slate-900 mb-2">Want to discuss this article?</h4>
        <p className="text-sm text-slate-700 mb-4">
          Join the conversation on any politician's wall. Share your thoughts, ask questions, and see what others in your electoral district think about their performance.
        </p>
        <Link href="/news">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Explore more civic news
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
