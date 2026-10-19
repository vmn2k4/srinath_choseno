"use client";

import type { CSSProperties, ReactNode } from "react";
import { useViewportZoom } from "@/lib/hooks/useViewportZoom";

// Scales the whole homepage up on big monitors (see useViewportZoom for the
// why). `--home-zoom` lets vh-based heights (the hero's min-height) divide the
// zoom back out so they still fit the screen.
export default function HomeViewportScale({ children }: { children: ReactNode }) {
  const zoom = useViewportZoom();
  return <div style={zoom === 1 ? undefined : ({ zoom, "--home-zoom": zoom } as CSSProperties)}>{children}</div>;
}
