import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { buildSeatSlug } from "@/lib/utils/slugs";

export type DistrictSeat = {
  id: string;
  role_title: string;
  candidateCount: number;
  map_shapes?: { name?: string; properties?: unknown } | null;
  elections?: { name?: string; election_date?: string } | null;
};

export function formatElectionDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

// "in 10 days" / "Tomorrow" / "Today" -- only for upcoming dates close enough
// to create urgency; null otherwise.
export function electionCountdown(dateString?: string): string | null {
  if (!dateString) return null;
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00`);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days < 0 || days > 60) return null;
  if (days === 0) return "Voting today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

// The race cards under "2026 Candidates in Your Area" -- shared by
// /find-my-district and the auto-locate DistrictRacesBanner.
export default function DistrictSeatCards({
  seats,
  onSeatClick,
  singleColumn = false,
  variant = "default",
}: {
  seats: DistrictSeat[];
  onSeatClick?: (seat: DistrictSeat) => void;
  // One card per row, for narrow side columns.
  singleColumn?: boolean;
  // "banner": compact cards with a "See candidates" cue and a countdown, and
  // the first card highlighted (callers sort the most relevant race first).
  variant?: "default" | "banner";
}) {
  if (variant === "banner") {
    return (
      <div className={`grid grid-cols-1 gap-2 ${singleColumn ? "" : "sm:grid-cols-2"}`.trim()}>
        {seats.map((seat, i) => {
          const countdown = electionCountdown(seat.elections?.election_date);
          const first = i === 0;
          return (
            <Link
              key={seat.id}
              onClick={() => onSeatClick?.(seat)}
              href={`/elections/seat/${buildSeatSlug({
                id: seat.id,
                role_title: seat.role_title,
                map_shapes: seat.map_shapes || { name: "", properties: {} },
              })}`}
              className={`group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 shadow-sm transition-all hover:shadow-md ${
                first
                  ? "border-primary bg-primary text-white"
                  : "border-primary/20 bg-white/80 hover:border-primary hover:bg-primary hover:text-white"
              }`}
            >
              <div className="min-w-0">
                <div className={`truncate text-sm font-bold ${first ? "text-white" : "text-text-main group-hover:text-white"}`}>
                  {seat.role_title}
                  {seat.map_shapes?.name && (
                    <span className={`font-normal ${first ? "text-white/80" : "text-text-muted group-hover:text-white/80"}`}> · {seat.map_shapes.name}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`flex items-center gap-1 font-bold ${first ? "text-white" : "text-text-main group-hover:text-white"}`}>
                    <Calendar size={12} aria-hidden="true" />
                    {formatElectionDate(seat.elections?.election_date)}
                  </span>
                  {countdown && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                        first ? "bg-white text-primary" : "bg-primary/15 text-primary group-hover:bg-white group-hover:text-primary"
                      }`}
                    >
                      {countdown}
                    </span>
                  )}
                </div>
              </div>
              <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${first ? "text-white" : "text-primary group-hover:text-white"}`}>
                {seat.candidateCount > 0 ? `See ${seat.candidateCount} candidates` : "See race"}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    );
  }
  return (
    <div className={`grid grid-cols-1 gap-3 ${singleColumn ? "" : "sm:grid-cols-2"}`.trim()}>
      {seats.map((seat) => (
        <Link
          key={seat.id}
          onClick={() => onSeatClick?.(seat)}
          href={`/elections/seat/${buildSeatSlug({
            id: seat.id,
            role_title: seat.role_title,
            map_shapes: seat.map_shapes || { name: "", properties: {} },
          })}`}
          className="group flex items-start justify-between gap-3 p-4 rounded-lg bg-white/80 hover:bg-primary hover:text-white border border-primary/20 hover:border-primary transition-all shadow-sm hover:shadow-md"
        >
          <div className="flex-1 min-w-0">
            <div className="font-bold text-text-main group-hover:text-white">{seat.role_title}</div>
            <div className="text-xs text-text-muted group-hover:text-white/70 mt-1 space-y-0.5">
              {seat.map_shapes?.name && <div>{seat.map_shapes.name}</div>}
              {seat.elections?.election_date && <div>{formatElectionDate(seat.elections.election_date)}</div>}
            </div>
          </div>
          <span className="font-bold text-primary group-hover:text-white flex items-center gap-2 text-sm whitespace-nowrap shrink-0">
            {seat.candidateCount}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      ))}
    </div>
  );
}
