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

// site_settings — admin-editable platform rate-limit knobs (comment daily
// cap, politician daily post cap, story-strip ephemerality). Same
// single-row table as the theme above; the RPCs that actually enforce
// comment_daily_limit_per_target/politician_daily_post_limit read the table
// directly in SQL — this is only for the client-side story-strip filter
// and the admin editor UI.
export type PlatformRuleSettings = {
  comment_daily_limit_per_target: number;
  politician_daily_post_limit: number;
  story_strip_hours: number;
};

export async function getPlatformRuleSettings(supabase: Client) {
  return fetchWithCache<PlatformRuleSettings>("site_settings:rules", () =>
    supabase
      .from("site_settings")
      .select("comment_daily_limit_per_target, politician_daily_post_limit, story_strip_hours")
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

// site_settings — admin kill switch + rate-limit cap for letting logged-out
// visitors support a candidate without an account. Same single-row table,
// same pattern as PlatformRuleSettings above.
export type AnonymousSupportSettings = {
  anonymous_support_enabled: boolean;
  anonymous_support_rate_limit_per_hour: number;
};

export async function getAnonymousSupportSettings(supabase: Client) {
  return fetchWithCache<AnonymousSupportSettings>("site_settings:anonymous_support", () =>
    supabase
      .from("site_settings")
      .select("anonymous_support_enabled, anonymous_support_rate_limit_per_hour")
      .eq("id", 1)
      .single()
  );
}

export async function updateAnonymousSupportSettings(supabase: Client, settings: AnonymousSupportSettings) {
  invalidateCache("site_settings:anonymous_support");
  return supabase
    .from("site_settings")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", 1);
}
