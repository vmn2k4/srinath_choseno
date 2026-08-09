"use client";

import { useState } from "react";
import { Heart, MessageSquare } from "lucide-react";
import { StarRating } from "@/components/primitives";
import PoliticianRatingModal from "./PoliticianRatingModal";

const ICON_SIZE = { xs: 11, sm: 13 } as const;

// Self-contained "supporters · rating · comments" line shown below a
// politician's name in every compact widget (office-holder lists, candidate
// chips, the boundary directory) — clicking it opens PoliticianRatingModal
// without the parent widget needing to own any modal-open state itself.
// Always renders, even at zero engagement, so a fresh politician reads as
// "0 · New · 0" rather than the stats line disappearing entirely.
export default function PoliticianEngagementStats({
  politicianId,
  politicianName,
  supporterCount,
  avgRating,
  ratingCount,
  commentCount,
  size = "xs",
  className = "",
}: {
  politicianId: string;
  politicianName: string;
  supporterCount: number;
  avgRating: number;
  ratingCount: number;
  commentCount: number;
  size?: "xs" | "sm";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Set only after a submit inside the modal, so the widget can reflect
  // fresh numbers immediately without waiting for the parent's next batch
  // refetch. Deliberately NOT `useState(props)` — that only captures the
  // props at first mount and goes stale forever once the parent's batch
  // fetch resolves after this component already rendered (props update,
  // but a useState initializer never re-reads them). Falling back to the
  // live props here means the display always tracks the parent until an
  // override exists.
  const [override, setOverride] = useState<{
    avgRating: number;
    ratingCount: number;
    commentCount: number;
  } | null>(null);
  const display = override ?? { avgRating, ratingCount, commentCount };
  const iconSize = ICON_SIZE[size];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // These stats sit inside Link/button-wrapped cards in most
          // widgets — stop the click from also triggering the card's own
          // navigation/selection.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-2.5 flex-wrap cursor-pointer hover:opacity-80 transition-opacity text-left ${className}`}
        title="View ratings and reviews"
      >
        <span className="inline-flex items-center gap-1 text-text-muted">
          <Heart size={iconSize} aria-hidden="true" />
          {supporterCount}
        </span>
        <StarRating value={display.avgRating} count={display.ratingCount} size={size} />
        <span className="inline-flex items-center gap-1 text-text-muted">
          <MessageSquare size={iconSize} aria-hidden="true" />
          {display.commentCount}
        </span>
      </button>

      {open && (
        <PoliticianRatingModal
          politicianId={politicianId}
          politicianName={politicianName}
          onClose={() => setOpen(false)}
          onChange={setOverride}
        />
      )}
    </>
  );
}
