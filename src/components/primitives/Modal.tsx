"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Centralized full-screen modal overlay recipe — previously copy-pasted
// verbatim (fixed inset-0 + scrim + centering) across CandidacyWall,
// PoliticianWall, FeedPage and EditProfileFlow. Panel content/styling stays
// with the caller via `children`; this only owns the overlay + centering.
//
// Rendered through a portal into document.body rather than in place. A
// plain `fixed inset-0` centers against the real viewport ONLY if no
// ancestor has a `transform`/`filter`/`perspective`/`will-change` — any of
// those turn `position: fixed` into effectively `absolute` relative to that
// ancestor instead, which is exactly what a Framer Motion tilt/float
// wrapper (TiltCard, FloatingElement — see HomeMotion.tsx) applies. Without
// the portal, opening this modal from inside one of those pins it to some
// offset spot instead of screen-center. Portaling out to `document.body`
// makes centering correct regardless of where in the tree a caller opens it.
export default function Modal({
  children,
  className = "",
  overlayClassName = "bg-overlay backdrop-blur-sm",
  zIndexClassName = "z-50",
  onOverlayClick,
}: {
  children?: ReactNode;
  className?: string;
  overlayClassName?: string;
  zIndexClassName?: string;
  onOverlayClick?: (e: MouseEvent<HTMLDivElement>) => void;
}) {
  // Portals need a real `document`, so defer to after mount rather than
  // rendering during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClassName} ${overlayClassName} flex items-center justify-center p-4`.trim()}
      onClick={onOverlayClick}
    >
      <div
        className={className}
        onClick={onOverlayClick ? (e) => e.stopPropagation() : undefined}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
