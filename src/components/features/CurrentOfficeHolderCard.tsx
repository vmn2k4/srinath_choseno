"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Phone, Globe, MapPin, Calendar, Badge as BadgeIcon } from "lucide-react";
import { Card, Avatar, Button } from "@/components/primitives";
import PoliticianEngagementStats from "./PoliticianEngagementStats";
import { createClient } from "@/lib/supabase/client";
import { getOfficeHoldersByShapeAndRole } from "@/lib/services/elections";
import { getPoliticianEngagementSummaries } from "@/lib/services/ratings";

interface CurrentOfficeHolderCardProps {
  mapShapeId: number | string;
  roleTitle?: string;
  className?: string;
}

interface OfficeHolder {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  holding_since: string | null;
  term_start: string | null;
  term_end: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source_url: string | null;
  linked_profile_id: string | null;
  election_role_types?: {
    role_title: string;
    role_key: string;
  } | null;
  political_parties?: {
    name: string;
    color_hex: string | null;
  } | null;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    current_ghost_id: string;
  } | null;
}

export default function CurrentOfficeHolderCard({
  mapShapeId,
  roleTitle,
  className = "",
}: CurrentOfficeHolderCardProps) {
  const supabase = createClient();
  const [holder, setHolder] = useState<OfficeHolder | null>(null);
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<
    { supporterCount: number; avgRating: number; ratingCount: number; commentCount: number } | null
  >(null);

  useEffect(() => {
    const fetchOfficeHolder = async () => {
      setLoading(true);
      const { data, error } = await getOfficeHoldersByShapeAndRole(supabase, mapShapeId, roleTitle);
      if (!error && data && Array.isArray(data) && data.length > 0) {
        const record = (data[0] as unknown) as OfficeHolder;
        setHolder(record);
        if (record.profiles?.id) {
          const { data: summaries } = await getPoliticianEngagementSummaries(supabase, [record.profiles.id]);
          const summary = (summaries || [])[0] as
            | { supporter_count: number; avg_rating: number; rating_count: number; comment_count: number }
            | undefined;
          setEngagement(
            summary
              ? {
                  supporterCount: summary.supporter_count,
                  avgRating: summary.avg_rating,
                  ratingCount: summary.rating_count,
                  commentCount: summary.comment_count,
                }
              : null
          );
        }
      }
      setLoading(false);
    };

    fetchOfficeHolder();
  }, [supabase, mapShapeId, roleTitle]);

  if (loading) {
    return (
      <Card padding="md" className={`animate-pulse ${className}`}>
        <div className="space-y-4">
          <div className="h-4 bg-surface-hover rounded w-1/2"></div>
          <div className="flex gap-3">
            <div className="w-16 h-16 bg-surface-hover rounded-full shrink-0"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-surface-hover rounded w-2/3"></div>
              <div className="h-3 bg-surface-hover rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!holder) {
    return null;
  }

  const displayName = holder.full_name;
  const partyName = holder.political_parties?.name;
  const partyColor = holder.political_parties?.color_hex;
  const role = roleTitle || holder.election_role_types?.role_title || "Office Holder";
  const avatarUrl = holder.photo_url;
  const isRegisteredUser = !!holder.linked_profile_id;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
    } catch {
      return dateStr;
    }
  };

  const termStart = formatDate(holder.term_start || holder.holding_since);
  const termEnd = formatDate(holder.term_end);

  return (
    <Card
      padding="md"
      className={`space-y-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border-light/30">
        <MapPin size={16} className="text-primary" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Current Representative
        </span>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Name & Role */}
        <div className="flex items-start gap-3">
          <Avatar src={avatarUrl} name={displayName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="font-bold text-text-main text-lg leading-tight break-words">
                {displayName}
              </h3>
              {isRegisteredUser && (
                <span
                  className="text-[10px] font-semibold text-accent bg-accent/15 px-2 py-1 rounded-full whitespace-nowrap"
                  title="Has Choseno account"
                >
                  On Choseno
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-primary mt-1">{role}</p>
            {holder.profiles?.id && (
              <PoliticianEngagementStats
                politicianId={holder.profiles.id}
                politicianName={displayName}
                supporterCount={engagement?.supporterCount ?? 0}
                avgRating={engagement?.avgRating ?? 0}
                ratingCount={engagement?.ratingCount ?? 0}
                commentCount={engagement?.commentCount ?? 0}
                size="sm"
                className="mt-1.5"
              />
            )}

            {/* Party Badge */}
            {partyName && (
              <div className="flex items-center gap-1.5 mt-2">
                {partyColor && (
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: partyColor }}
                  />
                )}
                <span className="text-xs font-semibold text-text-secondary">{partyName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {holder.bio && (
          <p className="text-sm text-text-secondary leading-relaxed">{holder.bio}</p>
        )}

        {/* Term Info */}
        {(termStart || termEnd) && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Calendar size={14} />
            <span>
              {termStart && termEnd
                ? `${termStart} – ${termEnd}`
                : termStart
                  ? `Since ${termStart}`
                  : termEnd
                    ? `Until ${termEnd}`
                    : ""}
            </span>
          </div>
        )}

        {/* Contact Info */}
        {(holder.contact_email || holder.contact_phone || holder.source_url) && (
          <div className="space-y-1.5 pt-2 border-t border-border-light/20">
            {holder.contact_email && (
              <a
                href={`mailto:${holder.contact_email}`}
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent transition-colors"
                title={holder.contact_email}
              >
                <Mail size={14} />
                <span className="truncate">{holder.contact_email}</span>
              </a>
            )}
            {holder.contact_phone && (
              <a
                href={`tel:${holder.contact_phone}`}
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent transition-colors"
                title={holder.contact_phone}
              >
                <Phone size={14} />
                <span>{holder.contact_phone}</span>
              </a>
            )}
            {holder.source_url && (
              <a
                href={holder.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent transition-colors"
                title="Official page"
              >
                <Globe size={14} />
                <span className="truncate">Official Page</span>
              </a>
            )}
          </div>
        )}

        {/* Action Button */}
        {isRegisteredUser && holder.linked_profile_id && (
          <div className="pt-2">
            <Link href={`/politician/${holder.linked_profile_id}`} className="w-full">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                View Profile
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
