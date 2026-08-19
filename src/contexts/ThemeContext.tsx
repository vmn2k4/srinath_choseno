"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteTheme, updateSiteTheme } from "@/lib/services/settings";

export const THEMES = [
  { key: "civic-original", label: "Civic original", mode: "dark" },
  { key: "electric-blue", label: "Electric blue", mode: "dark" },
  { key: "vibrant-indigo", label: "Vibrant indigo", mode: "dark" },
  { key: "fresh-green", label: "Fresh green", mode: "dark" },
  { key: "sunset-coral", label: "Sunset coral", mode: "dark" },
  { key: "bold-orange", label: "Bold orange", mode: "dark" },
  { key: "crimson-attention", label: "Crimson attention", mode: "dark" },
  { key: "clean-sky-blue", label: "Clean sky blue", mode: "light" },
  { key: "soft-mint", label: "Soft mint", mode: "light" },
  { key: "warm-coral", label: "Warm coral", mode: "light" },
  { key: "soft-lavender", label: "Soft lavender", mode: "light" },
  { key: "sky-cyan", label: "Sky cyan", mode: "light" },
  { key: "peach-amber", label: "Peach amber", mode: "light" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (key: ThemeKey) => Promise<void>;
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(key: string) {
  if (typeof document === "undefined") return;
  if (!key || key === "civic-original") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", key);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  // DEFAULT THEME MUST MATCH the CURRENT admin-selected theme in site_settings.
  // Hardcoded here so the page renders with the correct theme immediately on
  // mount instead of flashing the wrong theme first, then switching after the
  // DB fetch completes. IMPORTANT: When the admin changes the site theme via
  // Admin > Theme, this constant MUST also be updated to match, otherwise
  // users will see an initial flash of the old theme on every page load.
  const DEFAULT_THEME: ThemeKey = "sky-cyan";
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  // Apply default theme immediately on mount to prevent flash
  useEffect(() => {
    applyTheme(DEFAULT_THEME);
  }, []);

  useEffect(() => {
    // Theme is one admin-controlled, site-wide value (site_settings) — not
    // a per-visitor preference. A localStorage cache was tried here at one
    // point for "zero-latency" restore, but it actively worked against
    // that model: server-rendered HTML always starts at the default theme
    // (no localStorage access on the server), so a returning visitor with a
    // different theme cached would see the default flash, then flip to
    // their stale cached value, then potentially flip again once this fetch
    // resolved — and if the DB fetch ever failed, they'd be stuck on a
    // stale value indefinitely instead of the real site-wide theme. Fetch
    // straight from the DB, no client-side cache.
    let active = true;
    getSiteTheme(supabase)
      .then(({ data }) => {
        if (!active) return;
        if (data?.theme && THEMES.some((t) => t.key === data.theme)) {
          const key = data.theme as ThemeKey;
          setThemeState(key);
          applyTheme(key);
        }
      })
      .catch((err) => {
        console.warn("Theme DB fetch failed, staying on default:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [supabase]);

  const setTheme = async (key: ThemeKey) => {
    setThemeState(key);
    applyTheme(key);
    await updateSiteTheme(supabase, key);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
