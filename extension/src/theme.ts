import { supabase } from "./supabase";
import { getSiteTheme } from "@/lib/services/settings";

// Same source of truth as the website: the admin-selected theme in site_settings.
// The last value is cached so the popup opens already in the right colors.
const DEFAULT_THEME = "sky-cyan";
const KEY = "site-theme";
const valid = (t: unknown): t is string => typeof t === "string" && /^[a-z-]+$/.test(t);
const apply = (t: string) => document.documentElement.setAttribute("data-theme", t);

export async function initTheme() {
  const cached = (await chrome.storage.local.get(KEY))[KEY];
  apply(valid(cached) ? cached : DEFAULT_THEME);
  getSiteTheme(supabase)
    .then(({ data }) => {
      if (data?.theme && valid(data.theme)) {
        apply(data.theme);
        chrome.storage.local.set({ [KEY]: data.theme });
      }
    })
    .catch(() => {});
}
