"use client";

import { TrendingUp, Calendar, MapPin, Heart, Users } from "lucide-react";
import { Card, Avatar, Badge, Button } from "@/components/primitives";

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

  return (
    <Card padding="md" className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-text-main font-bold flex items-center gap-2 text-base">
            <TrendingUp size={18} className="text-primary" />
            Community Support
          </h3>
          <p className="text-xs text-text-muted mt-1 max-w-md">
            {leader
              ? `${leader.name} is currently leading with ${topPct}% community support.`
              : isTie
              ? `${topRows.map((r) => r.name).join(" and ")} are tied at ${topPct}% community support each.`
              : `No community support recorded yet for ${roleTitle} in ${boundaryName} — be the first to support a candidate.`}
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

      <div className="space-y-3">
        {rows.map(({ candidate, name, avatarUrl, partyName, supporterCount }) => {
          const pct = totalSupport > 0 ? Math.round((supporterCount / totalSupport) * 1000) / 10 : 0;
          const isTopRow = totalSupport > 0 && supporterCount === topSupportCount;
          const isLeader = leader?.candidate.id === candidate.id;
          const politicianId = candidate.profiles?.id;
          const isSupporting = Boolean(politicianId && mySupportedPoliticianIds?.has(politicianId));
          return (
            // A <div role="button">, not a <button> — it wraps the Heart CTA
            // below, which is itself a <button>; nesting <button> inside
            // <button> gets silently auto-closed by the HTML parser (same
            // fix already applied to the candidate roster in
            // ElectionSeatPageClient).
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
              className="w-full text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-1.5">
                <Avatar src={avatarUrl} name={name} size="sm" />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-text-main truncate flex items-center gap-1.5">
                      {name}
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
                    </span>
                    {partyName && (
                      <span className="block text-[11px] font-medium text-text-muted truncate">{partyName}</span>
                    )}
                  </span>
                  <span className="text-sm font-bold text-text-main shrink-0 tabular-nums">{pct}%</span>
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-surface-active overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isTopRow ? "bg-primary" : "bg-primary/40"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="text-[11px] text-text-muted flex items-center gap-1">
                  <Heart size={11} /> {supporterCount} supporter{supporterCount === 1 ? "" : "s"} on Choseno
                </p>
                <Button
                  type="button"
                  variant={isSupporting ? "primary" : "outline"}
                  size="sm"
                  className="gap-1.5 shrink-0 !py-1 !px-2.5 text-xs"
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
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-muted/80 border-t border-border-light/30 pt-3">
        Community Support reflects Choseno user activity (favorites/support clicks), not a scientific poll,
        certified result, or prediction of the official {formattedDate ? `${formattedDate} ` : ""}election outcome.
      </p>
    </Card>
  );
}
