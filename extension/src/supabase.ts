import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// The session lives in chrome.storage.local (not cookies/localStorage) so the
// popup and the background worker share it.
const chromeStorage = {
  async getItem(key: string) {
    const r = await chrome.storage.local.get(key);
    return (r[key] as string | undefined) ?? null;
  },
  async setItem(key: string, value: string) {
    await chrome.storage.local.set({ [key]: value });
  },
  async removeItem(key: string) {
    await chrome.storage.local.remove(key);
  },
};

export const supabase = createClient<Database>(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, {
  auth: {
    storage: chromeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

export const SITE_URL = __SITE_URL__;
