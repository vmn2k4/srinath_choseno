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
  onRateClick,
  disableRating = false,
}: {
  politicianId: string;
  politicianName: string;
  supporterCount: number;
  avgRating: number;
  ratingCount: number;
  commentCount: number;
  size?: "xs" | "sm";
  className?: string;
  // Opt-in: when provided, clicking the stats calls this instead of opening
  // the built-in PoliticianRatingModal popup — lets a caller swap in an
  // inline, on-page rating panel (see PoliticianInlineRating) without
  // touching every other place this widget is already used.
  onRateClick?: () => void;
  // Opt-out: when this widget sits inside something whose own click should
  // win (e.g. a candidate-switcher tab whose job is to switch tabs, not
  // pop a rating dialog), render the stats as plain non-interactive text
  // instead of a stopPropagation()-ing button, so the click passes through
  // to the parent instead of being swallowed here.
  disableRating?: boolean;
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

  const content = (
    <>
      <span className="inline-flex items-center gap-1 text-text-muted">
        <Heart size={iconSize} aria-hidden="true" />
        {supporterCount}
      </span>
      <StarRating value={display.avgRating} count={display.ratingCount} size={size} />
      <span className="inline-flex items-center gap-1 text-text-muted">
        <MessageSquare size={iconSize} aria-hidden="true" />
        {display.commentCount}
      </span>
    </>
  );

  if (disableRating) {
    return <span className={`inline-flex items-center gap-2.5 flex-wrap ${className}`}>{content}</span>;
  }

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
          if (onRateClick) {
            onRateClick();
          } else {
            setOpen(true);
          }
        }}
        className={`inline-flex items-center gap-2.5 flex-wrap cursor-pointer hover:opacity-80 transition-opacity text-left ${className}`}
        title="View ratings and reviews"
      >
        {content}
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
