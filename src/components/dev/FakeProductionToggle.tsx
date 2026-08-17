"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { isFakeProductionActive, setFakeProductionMode } from "@/lib/utils/environment";

// Dev-only tool — rendered from the root layout only when NODE_ENV !== "production"
// (see src/app/layout.tsx), same gate as DebugUserSwitcher. Lets you preview what a
// real production visitor would see (is_test content/profiles hidden — see
// src/lib/utils/environment.ts) without doing an actual production build. The flag
// lives in localStorage, so it only affects client-fetched data — a full reload is
// needed after toggling for every client component's data-fetch to pick it up.

export default function FakeProductionToggle() {
  // Starts false to match the server-rendered HTML (no access to localStorage
  // there); useEffect corrects it to the real stored value right after mount.
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setActive(isFakeProductionActive());
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !active;
    setFakeProductionMode(next);
    window.location.reload();
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      title={active ? "Previewing production — click to go back to dev" : "Click to preview production (hides test content)"}
      className={`fixed bottom-4 right-4 z-debug flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold shadow-lg transition-colors cursor-pointer ${
        active
          ? "bg-warning text-text-on-primary hover:bg-warning-light animate-pulse"
          : "bg-surface border border-border-light text-text-muted hover:text-text-main hover:bg-surface-hover"
      }`}
    >
      {active ? <Eye size={16} /> : <EyeOff size={16} />}
      {active ? "Previewing Production" : "Preview Production"}
    </button>
  );
}
