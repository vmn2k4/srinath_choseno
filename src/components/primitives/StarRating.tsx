"use client";

import { useState } from "react";
import { Star } from "lucide-react";

const SIZES = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
} as const;

type StarRatingSize = keyof typeof SIZES;

// Dual-mode: read-only display (avg + count, e.g. under a politician's name
// in a list widget) when `onChange` is omitted, or an interactive 1-5 picker
// (the wall page's "rate this politician" control) when it's passed.
export default function StarRating({
  value,
  count,
  size = "sm",
  onChange,
  className = "",
}: {
  value: number;
  count?: number;
  size?: StarRatingSize;
  onChange?: (rating: number) => void;
  className?: string;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const interactive = typeof onChange === "function";
  const displayValue = hoverValue ?? value;
  const px = SIZES[size];

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="inline-flex items-center gap-0.5"
        onMouseLeave={interactive ? () => setHoverValue(null) : undefined}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(displayValue);
          const icon = (
            <Star
              size={px}
              className={filled ? "fill-amber-400 text-amber-400" : "text-border-strong"}
            />
          );
          // Read-only mode renders plain spans, not disabled buttons — a
          // disabled <button> never fires (or bubbles) a click at all, which
          // would break a parent wrapper that wants "click these stars to
          // open reviews" (StarRating is read-only, but its container isn't).
          return interactive ? (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoverValue(star)}
              className="cursor-pointer"
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              {icon}
            </button>
          ) : (
            <span key={star}>{icon}</span>
          );
        })}
      </span>
      {typeof count === "number" && (
        <span className="text-text-muted text-xs font-medium">
          {value > 0 ? value.toFixed(1) : "New"}
          {count > 0 ? ` (${count})` : ""}
        </span>
      )}
    </span>
  );
}
