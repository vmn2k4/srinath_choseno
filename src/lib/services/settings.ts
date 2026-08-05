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

// site_settings — admin-editable platform rate-limit knobs (comment
// cooldown, politician daily post cap, story-strip ephemerality). Same
// single-row table as the theme above; the RPCs that actually enforce
// comment_cooldown_days/politician_daily_post_limit read the table
// directly in SQL — this is only for the client-side story-strip filter
// and the admin editor UI.
export type PlatformRuleSettings = {
  comment_cooldown_days: number;
  politician_daily_post_limit: number;
  story_strip_hours: number;
};

export async function getPlatformRuleSettings(supabase: Client) {
  return fetchWithCache<PlatformRuleSettings>("site_settings:rules", () =>
    supabase
      .from("site_settings")
      .select("comment_cooldown_days, politician_daily_post_limit, story_strip_hours")
      .eq("id", 1)
      .single()
  );
}

export async function updatePlatformRuleSettings(supabase: Client, settings: PlatformRuleSettings) {
  invalidateCache("site_settings:rules");
  return supabase
    .from("site_settings")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", 1);
}
