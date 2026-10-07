import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type AdminAnalyticsMetrics = {
  totalPosts: number;
  totalComments: number;
  totalUsers: number;
  dnu: number;
  dau: number;
  wau: number;
  mau: number;
  activity: {
    postsToday: number;
    posts7d: number;
    posts30d: number;
    commentsToday: number;
    comments7d: number;
    comments30d: number;
  };
  rolesBreakdown: { citizen: number; politician: number; candidate: number; admin: number };
};

const EMPTY_METRICS: AdminAnalyticsMetrics = {
  totalPosts: 0,
  totalComments: 0,
  totalUsers: 0,
  dnu: 0,
  dau: 0,
  wau: 0,
  mau: 0,
  activity: { postsToday: 0, posts7d: 0, posts30d: 0, commentsToday: 0, comments7d: 0, comments30d: 0 },
  rolesBreakdown: { citizen: 0, politician: 0, candidate: 0, admin: 0 },
};

// Admin Analytics Service — platform engagement metrics: total posts/
// comments/users, DNU, DAU/WAU/MAU, content velocity, role breakdown.
//
// Real bug found and fixed during this port, not a straight copy: the
// original queried `posts`/`comments` for a `user_id` column that doesn't
// exist in this schema (both tables key on `ghost_id`, deliberately
// unlinkable from a real profile — see ARCHITECTURE.md §3). That query
// silently returned no rows rather than erroring, so DAU/WAU/MAU always
// fell through to the `dnu`/profile-count floor below and never actually
// measured activity. Switched to `ghost_id` here — an imperfect proxy for
// "unique person" since a burn rotates it, but it's the only activity
// signal available at all without breaking the anonymity model, and it's
// what the feature was actually trying to measure.
export async function getAdminAnalyticsMetrics(
  supabase: Client
): Promise<{ success: boolean; metrics: AdminAnalyticsMetrics; error?: string }> {
  try {
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Headline numbers cover real users only (confirmed, non-admin, non-test,
    // non-mailsac accounts and what they posted) -- computed server-side in
    // get_admin_real_user_metrics, which also drops the auto-generated news
    // wall posts and the imported politician profiles.
    const { data: real, error: realError } = await supabase.rpc(
      "get_admin_real_user_metrics" as any,
      {
        p_start_of_today: startOfToday,
        p_past_24h: past24h,
        p_past_7d: past7d,
        p_past_30d: past30d,
      } as any
    );
    if (realError) throw realError;
    const r = (real || {}) as Record<string, number>;

    const { data: profilesWithRoles } = await supabase.from("profiles").select("role");
    const rolesMap = { citizen: 0, politician: 0, candidate: 0, admin: 0 };
    (profilesWithRoles || []).forEach((p) => {
      const r = (p.role || "citizen").toLowerCase() as keyof typeof rolesMap;
      if (rolesMap[r] !== undefined) rolesMap[r]++;
      else rolesMap.citizen++;
    });

    return {
      success: true,
      metrics: {
        totalPosts: r.totalPosts || 0,
        totalComments: r.totalComments || 0,
        totalUsers: r.totalUsers || 0,
        dnu: r.dnu || 0,
        dau: r.dau || 0,
        wau: r.wau || 0,
        mau: r.mau || 0,
        activity: {
          postsToday: r.postsToday || 0,
          posts7d: r.posts7d || 0,
          posts30d: r.posts30d || 0,
          commentsToday: r.commentsToday || 0,
          comments7d: r.comments7d || 0,
          comments30d: r.comments30d || 0,
        },
        rolesBreakdown: rolesMap,
      },
    };
  } catch (err) {
    console.error("Failed to fetch admin analytics metrics:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      metrics: EMPTY_METRICS,
    };
  }
}

export type DailyUserSignup = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

export type DailyUserSignupsGroup = {
  signup_date: string;
  user_count: number;
  users: DailyUserSignup[];
};

export async function getAdminDailyUserSignups(
  supabase: Client
): Promise<{ success: boolean; data: DailyUserSignupsGroup[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("get_admin_daily_user_signups" as any);
    if (error) throw error;
    return { success: true, data: (data as unknown as DailyUserSignupsGroup[]) || [] };
  } catch (err) {
    console.error("Failed to fetch admin daily user signups:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      data: [],
    };
  }
}


export type SupportClickMetrics = {
  today: { authenticated: number; anonymous: number };
  d7: { authenticated: number; anonymous: number };
  d30: { authenticated: number; anonymous: number };
  allTime: { authenticated: number; anonymous: number };
};

// "Support" button activity from both politician_supporters (signed-in) and
// anonymous_supporters. Counts current rows, so a supporter who later
// withdraws is no longer counted. Excludes is_test rows like the rest of the
// admin analytics. Both tables are public-read, so no RPC is needed.
export async function getAdminSupportMetrics(
  supabase: Client
): Promise<{ success: boolean; metrics: SupportClickMetrics; error?: string }> {
  const empty = { authenticated: 0, anonymous: 0 };
  const emptyMetrics: SupportClickMetrics = { today: empty, d7: empty, d30: empty, allTime: empty };
  try {
    const now = new Date();
    const since = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
      d7: new Date(now.getTime() - 7 * 86400000).toISOString(),
      d30: new Date(now.getTime() - 30 * 86400000).toISOString(),
      allTime: null as string | null,
    };
    const count = async (table: "politician_supporters" | "anonymous_supporters", from: string | null) => {
      let q = supabase.from(table).select("politician_id", { count: "exact", head: true }).eq("is_test", false);
      if (from) q = q.gte("created_at", from);
      const { count: c, error } = await q;
      if (error) throw error;
      return c || 0;
    };
    const keys = ["today", "d7", "d30", "allTime"] as const;
    const results = await Promise.all(
      keys.map(async (k) => ({
        authenticated: await count("politician_supporters", since[k]),
        anonymous: await count("anonymous_supporters", since[k]),
      }))
    );
    return {
      success: true,
      metrics: { today: results[0], d7: results[1], d30: results[2], allTime: results[3] },
    };
  } catch (err) {
    console.error("Failed to fetch support metrics:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err), metrics: emptyMetrics };
  }
}

export type PickShareWindow = { total: number; signed_in: number; logged_out: number };
export type PickShareStats = {
  windows: { today: PickShareWindow; d7: PickShareWindow; d30: PickShareWindow; allTime: PickShareWindow };
  top_races: { role_title: string; place: string | null; shares: number }[];
};

// "Share my picks" links generated (race_pick_shares), excluding is_test rows.
// Admin-only (enforced in the RPC). See 20261008000004_admin_pick_share_stats.sql.
export async function getAdminPickShareStats(
  supabase: Client
): Promise<{ success: boolean; stats: PickShareStats | null; error?: string }> {
  try {
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString();
    const { data, error } = await supabase.rpc("get_admin_pick_share_stats" as any, { p_today_start: todayStart });
    if (error) throw error;
    return { success: true, stats: data as unknown as PickShareStats };
  } catch (err) {
    return { success: false, stats: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export type SignupSourceRow = { label: string; count: number };
export type SignupSourceReport = {
  window_days: number;
  total_signups: number;
  tracked: number;
  untracked: number;
  by_trigger: SignupSourceRow[];
  by_page_type: SignupSourceRow[];
  by_last_page: SignupSourceRow[];
  by_landing_page: SignupSourceRow[];
  by_referrer: SignupSourceRow[];
  by_method: SignupSourceRow[];
  recent: {
    signup_order: number;
    created_at: string;
    trigger: string;
    landing_page: string | null;
    referrer: string;
    last_page: string | null;
    method: string | null;
    trail: string | null;
  }[];
};

// Admin-only (enforced in the RPC). See 20261007000001_signup_source_report.sql.
export async function getAdminSignupSourceReport(
  supabase: Client,
  days: number
): Promise<{ success: boolean; report: SignupSourceReport | null; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("get_admin_signup_source_report" as any, { p_days: days });
    if (error) throw error;
    return { success: true, report: data as unknown as SignupSourceReport };
  } catch (err) {
    return { success: false, report: null, error: err instanceof Error ? err.message : String(err) };
  }
}
