"use client";

import { useEffect, useRef } from "react";
import { trackNewsArticleOpened } from "@/lib/analytics/events";

// Fires once per article mount. Read time and scroll depth aren't tracked
// here on purpose -- GA4 Enhanced Measurement already reports "scroll"
// (90% depth) and per-page engagement time automatically, so a hand-rolled
// duplicate would just double up on data GA already gives you for free.
export default function NewsArticleViewTracker({
  slug,
  category,
}: {
  slug: string;
  category?: string | null;
}) {
  const trackedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (trackedSlugRef.current === slug) return;
    trackedSlugRef.current = slug;
    trackNewsArticleOpened({ slug, category });
  }, [slug, category]);

  return null;
}
