"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteTheme, updateSiteTheme } from "@/lib/services/settings";

// Single source of truth for which themes exist — each key must match a
// `[data-theme="..."]` block in globals.css. Used by both the DOM-application
// effect below and the Admin theme picker (Phase 7), so adding a theme is
// one edit here plus one CSS block, nowhere else.
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

type ThemeKey = (typeof THEMES)[number]["key"];

type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (key: ThemeKey) => Promise<void>;
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// "civic-original" is the app's :root default in globals.css, so it's
// applied by simply having no data-theme attribute at all -- every other
// key maps to a same-named [data-theme="..."] override block.
function applyTheme(key: string) {
  if (!key || key === "civic-original") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", key);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [theme, setThemeState] = useState<ThemeKey>("civic-original");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSiteTheme(supabase).then(({ data }) => {
      if (!active) return;
      const key = (data?.theme as ThemeKey) || "civic-original";
      setThemeState(key);
      applyTheme(key);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  // Optimistic: applies immediately so the admin sees the switch happen,
  // then persists. If the write fails (e.g. lost admin session), the DOM
  // still reflects the last successfully-read theme on next reload.
  const setTheme = async (key: ThemeKey) => {
    setThemeState(key);
    applyTheme(key);
    await updateSiteTheme(supabase, key);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
