import { supabase } from './supabase';

/**
 * Admin Analytics Service
 * Fetches platform engagement metrics:
 * - Total Posts & Comments
 * - Total Registered Users
 * - DNU (Daily New Users)
 * - DAU (Daily Active Users - past 24h)
 * - WAU (Weekly Active Users - past 7 days)
 * - MAU (Monthly Active Users - past 30 days)
 * - Engagement Breakdown & User Roles
 */
export async function getAdminAnalyticsMetrics() {
  try {
    const now = new Date();

    // Timestamps
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Total Posts & Comments & Profiles count
    const [
      { count: totalPosts },
      { count: totalComments },
      { count: totalUsers },
      { count: dnuCount }
    ] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday)
    ]);

    // 2. Active Posts in Past 24h, 7d, 30d
    const [
      { count: postsToday },
      { count: posts7d },
      { count: posts30d }
    ] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday),
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', past7d),
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', past30d)
    ]);

    // 3. Comments in Past 24h, 7d, 30d
    const [
      { count: commentsToday },
      { count: comments7d },
      { count: comments30d }
    ] = await Promise.all([
      supabase.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday),
      supabase.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', past7d),
      supabase.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', past30d)
    ]);

    // 4. Calculate DAU, WAU, MAU unique active user sets
    // DAU (past 24h): unique user IDs from posts, comments, or profile updates
    const [posts24hUsers, comments24hUsers, profiles24h] = await Promise.all([
      supabase.from('posts').select('user_id').gte('created_at', past24h),
      supabase.from('comments').select('user_id').gte('created_at', past24h),
      supabase.from('profiles').select('id').gte('updated_at', past24h)
    ]);

    const dauSet = new Set([
      ...(posts24hUsers.data || []).map(p => p.user_id).filter(Boolean),
      ...(comments24hUsers.data || []).map(c => c.user_id).filter(Boolean),
      ...(profiles24h.data || []).map(pr => pr.id).filter(Boolean)
    ]);

    // WAU (past 7d)
    const [posts7dUsers, comments7dUsers, profiles7d] = await Promise.all([
      supabase.from('posts').select('user_id').gte('created_at', past7d),
      supabase.from('comments').select('user_id').gte('created_at', past7d),
      supabase.from('profiles').select('id').gte('updated_at', past7d)
    ]);

    const wauSet = new Set([
      ...(posts7dUsers.data || []).map(p => p.user_id).filter(Boolean),
      ...(comments7dUsers.data || []).map(c => c.user_id).filter(Boolean),
      ...(profiles7d.data || []).map(pr => pr.id).filter(Boolean)
    ]);

    // MAU (past 30d)
    const [posts30dUsers, comments30dUsers, profiles30d] = await Promise.all([
      supabase.from('posts').select('user_id').gte('created_at', past30d),
      supabase.from('comments').select('user_id').gte('created_at', past30d),
      supabase.from('profiles').select('id').gte('updated_at', past30d)
    ]);

    const mauSet = new Set([
      ...(posts30dUsers.data || []).map(p => p.user_id).filter(Boolean),
      ...(comments30dUsers.data || []).map(c => c.user_id).filter(Boolean),
      ...(profiles30d.data || []).map(pr => pr.id).filter(Boolean)
    ]);

    // Fallback: If no activity logged yet, DAU/WAU/MAU defaults to 1 or profile count
    const dau = Math.max(dauSet.size, dnuCount || (totalUsers > 0 ? 1 : 0));
    const wau = Math.max(wauSet.size, dau);
    const mau = Math.max(mauSet.size, wau);

    // 5. User Roles Breakdown
    const { data: profilesWithRoles } = await supabase.from('profiles').select('role');
    const rolesMap = {
      citizen: 0,
      politician: 0,
      candidate: 0,
      admin: 0
    };
    (profilesWithRoles || []).forEach(p => {
      const r = (p.role || 'citizen').toLowerCase();
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
          comments30d: comments30d || 0
        },
        rolesBreakdown: rolesMap
      }
    };
  } catch (err) {
    console.error('Failed to fetch admin analytics metrics:', err);
    return {
      success: false,
      error: err.message,
      metrics: {
        totalPosts: 0,
        totalComments: 0,
        totalUsers: 0,
        dnu: 0,
        dau: 0,
        wau: 0,
        mau: 0,
        activity: { postsToday: 0, posts7d: 0, posts30d: 0, commentsToday: 0, comments7d: 0, comments30d: 0 },
        rolesBreakdown: { citizen: 0, politician: 0, candidate: 0, admin: 0 }
      }
    };
  }
}
