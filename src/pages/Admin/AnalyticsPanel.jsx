import React, { useState, useEffect } from 'react';
import { getAdminAnalyticsMetrics } from '../../services/analytics';
import { Card, Button, Spinner, Badge } from '../../components/ui';
import {
  Users, MessageSquare, FileText, UserPlus, Activity,
  Calendar, TrendingUp, RefreshCw, BarChart2, Shield, UserCheck, Flame
} from 'lucide-react';

export default function AnalyticsPanel() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await getAdminAnalyticsMetrics();
    if (res.success) {
      setMetrics(res.metrics);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm font-semibold text-text-muted">Loading Analytics &amp; Engagement Metrics...</p>
      </div>
    );
  }

  const m = metrics || {
    totalPosts: 0,
    totalComments: 0,
    totalUsers: 0,
    dnu: 0,
    dau: 0,
    wau: 0,
    mau: 0,
    activity: { postsToday: 0, posts7d: 0, posts30d: 0, commentsToday: 0, comments7d: 0, comments30d: 0 },
    rolesBreakdown: { citizen: 0, politician: 0, candidate: 0, admin: 0 }
  };

  // Engagement Stickiness Ratio (DAU / MAU)
  const stickiness = m.mau > 0 ? Math.round((m.dau / m.mau) * 100) : 0;
  const avgEngagementPerUser = m.totalUsers > 0 ? ((m.totalPosts + m.totalComments) / m.totalUsers).toFixed(1) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Refresh Bar */}
      <div className="flex items-center justify-end flex-wrap gap-3 pb-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchMetrics(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
        </Button>
      </div>

      {/* SECTION 1: TOP KEY OVERVIEW METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Story Posts */}
        <Card variant="row" padding="md" className="border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Story Posts</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FileText size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-text-main">{m.totalPosts.toLocaleString()}</p>
          <p className="text-[11px] text-text-muted mt-1">
            <strong className="text-primary font-semibold">+{m.activity.postsToday}</strong> posted today
          </p>
        </Card>

        {/* Total Comments */}
        <Card variant="row" padding="md" className="border-l-4 border-l-accent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Comments</span>
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <MessageSquare size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-text-main">{m.totalComments.toLocaleString()}</p>
          <p className="text-[11px] text-text-muted mt-1">
            <strong className="text-accent font-semibold">+{m.activity.commentsToday}</strong> replies today
          </p>
        </Card>

        {/* Total People Joined */}
        <Card variant="row" padding="md" className="border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">People Joined</span>
            <div className="w-8 h-8 rounded-xl bg-success/10 flex items-center justify-center text-success">
              <Users size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-text-main">{m.totalUsers.toLocaleString()}</p>
          <p className="text-[11px] text-text-muted mt-1">Total registered accounts</p>
        </Card>

        {/* DNU (Daily New Users) */}
        <Card variant="row" padding="md" className="border-l-4 border-l-warning">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">DNU (New Today)</span>
            <div className="w-8 h-8 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
              <UserPlus size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-text-main">{m.dnu.toLocaleString()}</p>
          <p className="text-[11px] text-text-muted mt-1">Daily New Users registered today</p>
        </Card>
      </div>

      {/* SECTION 2: ACTIVE USER METRICS (DAU, WAU, MAU, STICKINESS) */}
      <Card variant="composer" padding="md" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border-light/40 pb-3">
          <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
            <Activity className="text-primary shrink-0" size={18} /> User Activity Scale (DAU / WAU / MAU)
          </h3>
          <Badge tone="primary" size="xs">
            Stickiness: {stickiness}% (DAU / MAU)
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* DAU */}
          <div className="p-4 bg-surface/50 border border-border-light/60 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-xs text-text-muted font-semibold">
              <span>DAU (Daily Active Users)</span>
              <Flame size={15} className="text-warning" />
            </div>
            <p className="text-3xl font-black text-text-main">{m.dau.toLocaleString()}</p>
            <p className="text-[11px] text-text-muted">Unique active users in past 24 hrs</p>
          </div>

          {/* WAU */}
          <div className="p-4 bg-surface/50 border border-border-light/60 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-xs text-text-muted font-semibold">
              <span>WAU (Weekly Active Users)</span>
              <Calendar size={15} className="text-primary" />
            </div>
            <p className="text-3xl font-black text-text-main">{m.wau.toLocaleString()}</p>
            <p className="text-[11px] text-text-muted">Unique active users in past 7 days</p>
          </div>

          {/* MAU */}
          <div className="p-4 bg-surface/50 border border-border-light/60 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-xs text-text-muted font-semibold">
              <span>MAU (Monthly Active Users)</span>
              <TrendingUp size={15} className="text-success" />
            </div>
            <p className="text-3xl font-black text-text-main">{m.mau.toLocaleString()}</p>
            <p className="text-[11px] text-text-muted">Unique active users in past 30 days</p>
          </div>
        </div>
      </Card>

      {/* SECTION 3: POSTS & COMMENTS TIME BREAKDOWN & USER ROLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Creation Breakdown */}
        <Card variant="composer" padding="md" className="space-y-4">
          <h3 className="text-sm font-bold text-text-main flex items-center gap-2 border-b border-border-light/40 pb-3">
            <FileText className="text-accent" size={18} /> Content Creation Velocity
          </h3>

          <div className="space-y-3 divide-y divide-border-light/30 text-xs">
            <div className="flex items-center justify-between pt-2">
              <span className="text-text-muted font-medium">Story Posts (Today / 7d / 30d)</span>
              <span className="font-bold text-text-main font-mono">
                {m.activity.postsToday} / {m.activity.posts7d} / {m.activity.posts30d}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-text-muted font-medium">Comments (Today / 7d / 30d)</span>
              <span className="font-bold text-text-main font-mono">
                {m.activity.commentsToday} / {m.activity.comments7d} / {m.activity.comments30d}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-text-muted font-medium">Avg Posts + Comments per User</span>
              <span className="font-bold text-primary font-mono">{avgEngagementPerUser} items / user</span>
            </div>
          </div>
        </Card>

        {/* User Roles Breakdown */}
        <Card variant="composer" padding="md" className="space-y-4">
          <h3 className="text-sm font-bold text-text-main flex items-center gap-2 border-b border-border-light/40 pb-3">
            <UserCheck className="text-success" size={18} /> Registered User Roles
          </h3>

          <div className="space-y-3 text-xs">
            {/* Citizens */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-text-main">Citizens</span>
                <span className="text-text-muted font-mono">{m.rolesBreakdown.citizen || 0}</span>
              </div>
              <div className="w-full bg-surface-hover h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${m.totalUsers > 0 ? ((m.rolesBreakdown.citizen || 0) / m.totalUsers) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Candidates / Politicians */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-text-main">Candidates &amp; Representatives</span>
                <span className="text-text-muted font-mono">{(m.rolesBreakdown.candidate || 0) + (m.rolesBreakdown.politician || 0)}</span>
              </div>
              <div className="w-full bg-surface-hover h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-warning h-full rounded-full transition-all"
                  style={{ width: `${m.totalUsers > 0 ? (((m.rolesBreakdown.candidate || 0) + (m.rolesBreakdown.politician || 0)) / m.totalUsers) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Admins */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-text-main">Administrators</span>
                <span className="text-text-muted font-mono">{m.rolesBreakdown.admin || 0}</span>
              </div>
              <div className="w-full bg-surface-hover h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-accent h-full rounded-full transition-all"
                  style={{ width: `${m.totalUsers > 0 ? ((m.rolesBreakdown.admin || 0) / m.totalUsers) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
