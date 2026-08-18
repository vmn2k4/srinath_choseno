"use client";

import { TrendingUp, Calendar, MapPin, Heart, Users, Share2, ExternalLink, ChevronRight } from "lucide-react";
import { Card, Avatar, Badge, Button } from "@/components/primitives";
import ShareMenu, { type ShareData } from "./ShareMenu";
import { SITE_URL } from "@/lib/constants/site";
import { buildSeatSlug } from "@/lib/utils/slugs";

// Comprehensive "who's leading" view for a seat's candidate roster.
// No new fields, no new table: the underlying number is the same
// politician_supporters count already surfaced elsewhere on this page via
// PoliticianEngagementStats (heart icon). This panel just re-derives a
// vote-share percentage from that same batched engagementSummaries map
// (candidates -> profiles.id -> supporterCount) instead of re-querying.
interface PoliticianProfile {
  avatar_url?: string | null;
  political_parties?: { name?: string | null } | { name?: string | null }[] | null;
}

interface CandidateRow {
  id: string;
  display_name?: string | null;
  party_name?: string | null;
  profiles?: {
    id?: string;
    full_name?: string | null;
    politician_profiles?: PoliticianProfile | PoliticianProfile[];
  } | null;
}

interface EngagementEntry {
  supporterCount: number;
  avgRating: number;
  ratingCount: number;
  commentCount: number;
}

export default function ElectionResultsPanel({
  seat,
  candidates,
  engagementSummaries,
  onSelectCandidate,
  mySupportedPoliticianIds,
  onToggleSupport,
}: {
  seat: any;
  candidates: CandidateRow[];
  engagementSummaries: Map<string, EngagementEntry>;
  onSelectCandidate?: (candidate: CandidateRow) => void;
  mySupportedPoliticianIds?: Set<string>;
  onToggleSupport?: (candidate: CandidateRow) => void;
}) {
  const roleTitle = seat?.role_title || "this seat";
  const boundaryName = seat?.map_shapes?.name || "this district";
  const electionDateRaw = seat?.elections?.election_date;
  const electionDate = electionDateRaw ? new Date(electionDateRaw) : null;
  const formattedDate =
    electionDate && !Number.isNaN(electionDate.getTime())
      ? electionDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : null;
  const daysUntil =
    electionDate && !Number.isNaN(electionDate.getTime())
      ? Math.ceil((electionDate.getTime() - Date.now()) / 86_400_000)
      : null;

  const rows = candidates
    .map((c) => {
      const politicianId = c.profiles?.id;
      const supporterCount = (politicianId && engagementSummaries.get(politicianId)?.supporterCount) || 0;
      const name = c.display_name || c.profiles?.full_name || "Candidate";
      const pol = c.profiles?.politician_profiles;
      const polEntry = Array.isArray(pol) ? pol[0] : pol;
      const avatarUrl = polEntry?.avatar_url;
      const partyEntry = Array.isArray(polEntry?.political_parties)
        ? polEntry.political_parties[0]
        : polEntry?.political_parties;
      const partyName = c.party_name || partyEntry?.name || null;
      return { candidate: c, name, avatarUrl, partyName, supporterCount };
    })
    .sort((a, b) => b.supporterCount - a.supporterCount);

  const totalSupport = rows.reduce((sum, r) => sum + r.supporterCount, 0);
  // rows[0] after the sort above is only "the leader" when nobody else
  // shares its count — a stable sort still picks an arbitrary winner out of
  // a tie, which previously got labeled "leading" even at 1-1. Anyone
  // matching the top count is tied for first; a single leader only exists
  // when exactly one row has it.
  const topSupportCount = rows[0]?.supporterCount ?? 0;
  const topRows = totalSupport > 0 ? rows.filter((r) => r.supporterCount === topSupportCount) : [];
  const isTie = topRows.length > 1;
  const leader = topRows.length === 1 ? topRows[0] : null;
  const topPct = totalSupport > 0 ? Math.round((topSupportCount / totalSupport) * 1000) / 10 : 0;

  // ── Share card copy ──────────────────────────────────────────────────
  // Reuses the same ShareMenu (Copy Link, X, WhatsApp, LinkedIn, Facebook,
  // Telegram, Pinterest, Email) already wired up for news articles
  // (NewsArticleDetailClient.tsx) instead of a second share widget -- see
  // docs/SERVICES.md's "extend, don't duplicate" rule. The standings line
  // is the hook: naming who's leading (or that it's wide open) is what
  // makes a friend want to click through and cast the tiebreaker.
  const seatSlug = buildSeatSlug(seat);
  const shareUrl = seatSlug ? `${SITE_URL}/elections/seat/${seatSlug}` : SITE_URL;
  const otherNames = rows.map((r) => r.name).filter((n) => n !== leader?.name);

  const standingsLine = leader
    ? otherNames.length > 0
      ? `🏆 ${leader.name} is leading with ${topPct}% community support, ahead of ${otherNames.slice(0, 2).join(", ")}${otherNames.length > 2 ? " & others" : ""}.`
      : `🏆 ${leader.name} is leading with ${topPct}% community support.`
    : isTie
    ? `🤝 ${topRows.map((r) => r.name).join(" & ")} are tied for the lead at ${topPct}% each — this one's wide open.`
    : rows.length > 0
    ? `${rows.length} candidates are running and nobody's cast their support yet. Be the first!`
    : `Candidates for this seat haven't been added yet.`;

  const basePostText = `🗳️ Choseno Community Poll: ${roleTitle} — ${boundaryName}\n${standingsLine}\nCast your support & see who's really leading 👉`;

  const cleanTag = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");
  const yearTag =
    electionDate && !Number.isNaN(electionDate.getTime()) ? `Vote${electionDate.getFullYear()}` : "Vote2026";
  const hashtags = Array.from(
    new Set([cleanTag(roleTitle) || "Election", cleanTag(boundaryName), yearTag, "CommunitySupport", "Choseno"].filter(Boolean))
  );
  const formattedHashtagString = hashtags.map((t) => `#${t}`).join(" ");
  const shareText = `${basePostText}\n\n${formattedHashtagString}\n${shareUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(basePostText)}&url=${encodeURIComponent(
    shareUrl
  )}&hashtags=${encodeURIComponent(hashtags.join(","))}`;

  const shareData: ShareData = {
    url: shareUrl,
    basePostText,
    hashtagList: formattedHashtagString,
    shareText,
    hashtags,
    twitterUrl,
  };

  return (
    <Card padding="md" className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-text-main font-bold flex items-center gap-2 text-base">
            <TrendingUp size={18} className="text-primary" />
            Community Support
          </h3>
          {/* Full sentence on desktop; a shorter version on mobile so this
              doesn't eat three lines before the candidate rows even start. */}
          <p className="hidden sm:block text-xs text-text-muted mt-1 max-w-md">
            {leader
              ? `${leader.name} is currently leading with ${topPct}% community support.`
              : isTie
              ? `${topRows.map((r) => r.name).join(" and ")} are tied at ${topPct}% community support each.`
              : `No community support recorded yet for ${roleTitle} in ${boundaryName} — be the first to support a candidate.`}
          </p>
          <p className="sm:hidden text-xs text-text-muted mt-1">
            {leader
              ? `${leader.name} leads with ${topPct}%.`
              : isTie
              ? `${topRows.map((r) => r.name).join(" & ")} tied at ${topPct}%.`
              : `Be the first to support a candidate.`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-text-muted shrink-0">
          {formattedDate && (
            <span className="flex items-center gap-1">
              <Calendar size={13} className="text-accent" />
              Election Day: {formattedDate}
              {daysUntil !== null && daysUntil >= 0 ? ` (${daysUntil} day${daysUntil === 1 ? "" : "s"} left)` : ""}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MapPin size={13} className="text-accent" /> {boundaryName}
          </span>
          <span className="flex items-center gap-1">
            <Users size={13} className="text-accent" /> {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {rows.map(({ candidate, name, avatarUrl, partyName, supporterCount }) => {
          const pct = totalSupport > 0 ? Math.round((supporterCount / totalSupport) * 1000) / 10 : 0;
          const isTopRow = totalSupport > 0 && supporterCount === topSupportCount;
          const isLeader = leader?.candidate.id === candidate.id;
          const politicianId = candidate.profiles?.id;
          const isSupporting = Boolean(politicianId && mySupportedPoliticianIds?.has(politicianId));
          return (
            <div
              key={candidate.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCandidate?.(candidate)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectCandidate?.(candidate);
                }
              }}
              className="group w-full text-left cursor-pointer rounded-xl border border-border-light/25 bg-surface/15 hover:bg-surface/40 active:bg-surface/50 transition-all p-3 sm:p-2.5 hover:border-primary/25 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3"
            >
              {/* Identity block: avatar + name + party. Full width of its
                  own row on mobile so the name never has to compete with
                  the support button/stats for space and gets truncated
                  into unreadable "Rick L..." — it only fights for room
                  with the stats row again once there's a whole desktop
                  row to spread across. */}
              <div className="flex items-center gap-2.5 sm:flex-1 sm:min-w-0">
                <Avatar src={avatarUrl} name={name} size="sm" />
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[15px] sm:text-sm font-bold text-text-main group-hover:underline leading-tight">
                      {name}
                    </span>
                    {isLeader && (
                      <Badge tone="emerald" size="xs" shape="pill">
                        Leading
                      </Badge>
                    )}
                    {isTie && isTopRow && (
                      <Badge tone="amber" size="xs" shape="pill">
                        Tied
                      </Badge>
                    )}
                  </div>
                  {partyName && (
                    <span className="text-xs text-text-muted truncate leading-tight">
                      {partyName}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats/action row: support button, progress bar, percentage,
                  vote count, and a tap-through chevron. Its own full-width
                  row on mobile — plenty of room for a readable "Support"
                  label and a progress bar that isn't squeezed to a sliver. */}
              <div className="flex items-center gap-2 sm:gap-2.5 sm:shrink-0">
                <div className="relative shrink-0">
                  {!isSupporting && (
                    <span
                      className="absolute inset-0 rounded-lg animate-ping pointer-events-none"
                      style={{ backgroundColor: "color-mix(in srgb, var(--color-success) 50%, transparent)" }}
                    />
                  )}
                  <Button
                    type="button"
                    variant={isSupporting ? "primary" : "outline"}
                    size="sm"
                    className={`relative gap-1.5 !py-1.5 !px-3 text-xs font-bold transition-transform hover:scale-105 active:scale-95 ${
                      isSupporting ? "" : "!border-2"
                    }`}
                    style={isSupporting ? {
                      backgroundColor: "#10b981",
                      color: "white",
                      borderColor: "#10b981",
                    } : {
                      borderColor: "#10b981",
                      color: "#10b981",
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSupport?.(candidate);
                    }}
                    title={isSupporting ? `Withdraw your support for ${name}` : `Cast your support for ${name}`}
                  >
                    <Heart size={12} className={isSupporting ? "fill-current" : ""} />
                    {isSupporting ? "Supported" : "Support"}
                  </Button>
                </div>

                <div className="h-2 flex-1 sm:w-20 sm:flex-initial rounded-full bg-surface-active overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isTopRow ? "bg-primary" : "bg-primary/40"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <span className="text-xs sm:text-sm font-bold text-text-main tabular-nums shrink-0 w-9 sm:w-12 text-right">
                  {pct}%
                </span>

                <span className="flex items-center gap-0.5 text-xs text-text-muted shrink-0">
                  <Heart size={10} /> {supporterCount}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCandidate?.(candidate);
                  }}
                  className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-hover transition-colors shrink-0"
                  title={`View ${name}'s full profile`}
                >
                  <span className="hidden sm:inline">View Profile</span>
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Share CTA — the other half of the "support, then spread the word"
          loop this panel is built around. Framed as a nudge to go swing the
          standings, not a plain "share this page" afterthought, since that's
          what actually gets someone to forward it to a friend. */}
      <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Share2 size={20} className="text-primary-light" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-main">Think the standings should look different?</p>
            <p className="hidden sm:block text-xs text-text-muted mt-0.5">
              Share this race with friends and rally more support for your candidate.
            </p>
            <p className="sm:hidden text-xs text-text-muted mt-0.5">
              Share it to rally more support.
            </p>
          </div>
        </div>
        <div className="relative shrink-0 z-40">
          <span className="absolute inset-0 rounded-xl bg-primary/40 animate-ping pointer-events-none" />
          <ShareMenu
            articleId={seat?.id || "election-seat"}
            shareData={shareData}
            label="Share This Race"
            triggerTitle="Share this race"
            shareTitle={`${roleTitle} — ${boundaryName}`}
            menuAlign="above"
            iconSize={16}
            className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-text-on-primary font-extrabold text-sm shadow-[0_6px_18px_color-mix(in_srgb,var(--color-primary)_25%,transparent)] hover:shadow-[0_8px_22px_color-mix(in_srgb,var(--color-primary)_35%,transparent)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
          />
        </div>
      </div>

      <p className="hidden sm:block text-[11px] text-text-muted/80 border-t border-border-light/30 pt-3">
        Community Support reflects Choseno user activity (favorites/support clicks), not a scientific poll,
        certified result, or prediction of the official {formattedDate ? `${formattedDate} ` : ""}election outcome.
      </p>
      <p className="sm:hidden text-[11px] text-text-muted/80 border-t border-border-light/30 pt-3">
        Reflects user activity, not an official poll or prediction.
      </p>
    </Card>
  );
}
