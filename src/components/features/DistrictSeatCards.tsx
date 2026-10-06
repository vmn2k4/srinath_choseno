import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

// The race cards under "2026 Candidates in Your Area" -- shared by
// /find-my-district and the auto-locate DistrictRacesBanner.
export default function DistrictSeatCards({ seats, onSeatClick }: { seats: DistrictSeat[]; onSeatClick?: (seat: DistrictSeat) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
