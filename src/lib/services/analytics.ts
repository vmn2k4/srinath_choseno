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

    // Admin analytics reflects real platform activity regardless of which
    // build (dev or prod) the admin is viewing it from -- unlike the
    // user-facing feed/wall queries, this always excludes is_test content.
    const [
      { count: totalPosts },
      { count: totalComments },
      { count: totalUsers },
      { count: dnuCount },
    ] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("is_test", false),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("is_test", false),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfToday),
    ]);

    const [{ count: postsToday }, { count: posts7d }, { count: posts30d }] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("is_test", false).gte("created_at", startOfToday),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("is_test", false).gte("created_at", past7d),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("is_test", false).gte("created_at", past30d),
    ]);

    const [{ count: commentsToday }, { count: comments7d }, { count: comments30d }] = await Promise.all([
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("is_test", false).gte("created_at", startOfToday),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("is_test", false).gte("created_at", past7d),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("is_test", false).gte("created_at", past30d),
    ]);

    const uniqueUserSet = async (since: string) => {
      const [posts, comments, profiles] = await Promise.all([
        supabase.from("posts").select("ghost_id").eq("is_test", false).gte("created_at", since),
        supabase.from("comments").select("ghost_id").eq("is_test", false).gte("created_at", since),
        supabase.from("profiles").select("id").gte("updated_at", since),
      ]);
      return new Set([
        ...(posts.data || []).map((p) => p.ghost_id).filter(Boolean),
        ...(comments.data || []).map((c) => c.ghost_id).filter(Boolean),
        ...(profiles.data || []).map((pr) => pr.id).filter(Boolean),
      ]);
    };

    const [dauSet, wauSet, mauSet] = await Promise.all([
      uniqueUserSet(past24h),
      uniqueUserSet(past7d),
      uniqueUserSet(past30d),
    ]);

    const dau = Math.max(dauSet.size, dnuCount || (totalUsers && totalUsers > 0 ? 1 : 0));
    const wau = Math.max(wauSet.size, dau);
    const mau = Math.max(mauSet.size, wau);

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
        totalPosts: totalPosts || 0,
        totalComments: totalComments || 0,
        totalUsers: totalUsers || 0,
        dnu: dnuCount || 0,
        dau: dau || 0,
        wau: wau || 0,
        mau: mau || 0,
        activity: {
          postsToday: postsToday || 0,
          posts7d: posts7d || 0,
          posts30d: posts30d || 0,
          commentsToday: commentsToday || 0,
          comments7d: comments7d || 0,
          comments30d: comments30d || 0,
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

