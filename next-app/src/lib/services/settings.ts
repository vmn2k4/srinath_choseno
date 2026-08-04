import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchWithCache, invalidateCache } from "@/lib/utils/apiCache";

type Client = SupabaseClient<Database>;

// site_settings — single-row table holding the active site-wide color theme.
export async function getSiteTheme(supabase: Client) {
  return fetchWithCache<{ theme: string }>("site_settings:theme", () =>
    supabase.from("site_settings").select("theme").eq("id", 1).single()
  );
}

export async function updateSiteTheme(supabase: Client, theme: string) {
  invalidateCache("site_settings:theme");
  return supabase
    .from("site_settings")
    .update({ theme, updated_at: new Date().toISOString() })
    .eq("id", 1);
}
