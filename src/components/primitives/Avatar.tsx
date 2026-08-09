"use client";

/* eslint-disable @next/next/no-img-element */

// New primitive — the "image, or an initial-letter circle on a gradient
// fallback" pattern was independently reimplemented in CandidacyWall,
// ElectionSeatPage's candidate switcher, PoliticianWall's header, and
// FeedPage's profile summary. One shared component from here on.
import { useState } from "react";

const SIZES = {
  sm: { box: "w-8 h-8", text: "text-xs" },
  md: { box: "w-10 h-10", text: "text-sm" },
  lg: { box: "w-14 h-14", text: "text-lg" },
  xl: { box: "w-20 h-20", text: "text-2xl" },
} as const;

type AvatarSize = keyof typeof SIZES;

function initial(name?: string | null) {
  return name?.trim()?.[0]?.toUpperCase() || "?";
}

export default function Avatar({
  src,
  name,
  size = "md",
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const { box, text } = SIZES[size] || SIZES.md;
  // A non-empty src can still 404 (stale/broken storage URL). Track load
  // failure so we fall back to the initial-letter circle instead of the
  // browser rendering a broken-image glyph or overflowing alt text.
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        onError={() => setFailed(true)}
        className={`${box} rounded-full object-cover shrink-0 border border-border-light ${className}`.trim()}
      />
    );
  }

  return (
    <div
      className={`${box} ${text} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-text-on-primary shrink-0 ${className}`.trim()}
    >
      {initial(name)}
    </div>
  );
}
