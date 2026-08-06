"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminSubNav from "./AdminSubNav";
import {
  getAdminAnalyticsMetrics,
  getAdminDailyUserSignups,
  type DailyUserSignupsGroup,
  type DailyUserSignup,
} from "@/lib/services/analytics";
import { Card, Button, Spinner, PageHeader, Badge, Input } from "@/components/primitives";
import {
  Users,
  MessageSquare,
  FileText,
  RefreshCw,
  Activity,
  ChevronDown,
  ChevronRight,
  Search,
  Mail,
  User,
  Copy,
  Check,
  Calendar,
  Filter,
  BarChart3,
  Eye,
  Clock,
  Smartphone,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Ga4Overview } from "@/lib/analytics/ga4Reporting";

export default function AnalyticsAdminClient() {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<any>(null);
  const [dailySignups, setDailySignups] = useState<DailyUserSignupsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Accordion State
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Google Analytics (GA4 Data API) -- fetched independently of the Supabase
  // metrics above so a slow/unconfigured GA4 property never blocks the rest
  // of this page from loading.
  const [ga4Loading, setGa4Loading] = useState(true);
  const [ga4Configured, setGa4Configured] = useState(true);
  const [ga4Error, setGa4Error] = useState<string | null>(null);
  const [ga4Data, setGa4Data] = useState<Ga4Overview | null>(null);

  const fetchGa4 = async () => {
    setGa4Loading(true);
    setGa4Error(null);
    try {
      const res = await fetch("/api/admin/ga4");
      const body = await res.json();
      if (!res.ok) {
        setGa4Error(body?.error || "Failed to load Google Analytics data.");
      } else if (body.configured === false) {
        setGa4Configured(false);
      } else if (body.error) {
        setGa4Configured(true);
        setGa4Error(body.error);
      } else {
        setGa4Configured(true);
        setGa4Data(body.data as Ga4Overview);
      }
    } catch (err) {
      setGa4Error(err instanceof Error ? err.message : "Failed to load Google Analytics data.");
    } finally {
      setGa4Loading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchGa4());
  }, []);

  const fetchMetrics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [resMetrics, resSignups] = await Promise.all([
      getAdminAnalyticsMetrics(supabase),
      getAdminDailyUserSignups(supabase),
    ]);

    if (resMetrics.success) {
      setMetrics(resMetrics.metrics);
    }
    if (resSignups.success && resSignups.data) {
      setDailySignups(resSignups.data);
      // Auto-expand the most recent day if present
      if (resSignups.data.length > 0) {
        setExpandedDays({ [resSignups.data[0].signup_date]: true });
      }
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchMetrics());
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered signups logic
  const filteredDailyGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return dailySignups
      .map((group) => {
        const matchingUsers = (group.users || []).filter((user) => {
          const matchesQuery =
            !query ||
            (user.email && user.email.toLowerCase().includes(query)) ||
            (user.full_name && user.full_name.toLowerCase().includes(query)) ||
            (user.id && user.id.toLowerCase().includes(query));

          const matchesRole =
            roleFilter === "all" ||
            (roleFilter === "citizen" && (user.role === "citizen" || user.role === "normal")) ||
            user.role === roleFilter;

          return matchesQuery && matchesRole;
        });

        return {
          ...group,
          filteredUsers: matchingUsers,
        };
      })
      .filter((group) => group.filteredUsers.length > 0);
  }, [dailySignups, searchQuery, roleFilter]);

  const totalFilteredUsers = useMemo(() => {
    return filteredDailyGroups.reduce((acc, g) => acc + g.filteredUsers.length, 0);
  }, [filteredDailyGroups]);

  const toggleDayExpanded = (dateStr: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    dailySignups.forEach((g) => {
      allExpanded[g.signup_date] = true;
    });
    setExpandedDays(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedDays({});
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  if (loading) return <Spinner fullPage />;

  const m = metrics || {
    totalPosts: 0,
    totalComments: 0,
    totalUsers: 0,
    dnu: 0,
    dau: 0,
    wau: 0,
    mau: 0,
    activity: {
      postsToday: 0,
      posts7d: 0,
      posts30d: 0,
      commentsToday: 0,
      comments7d: 0,
      comments30d: 0,
    },
    rolesBreakdown: { citizen: 0, politician: 0, candidate: 0, admin: 0 },
  };

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader
        title="Platform Analytics"
        subtitle="Constituent retention, user email audit log, and daily engagement metrics."
      />

      <AdminSubNav active="analytics" />

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchMetrics(true)}
          disabled={refreshing}
          className="gap-1.5 text-xs"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh Metrics"}
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" className="border-l-4 border-l-primary space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Total Posts
            </span>
            <FileText size={18} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-text-main">
            {m.totalPosts.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">
            +{m.activity?.postsToday || 0} today
          </p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-accent space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Total Comments
            </span>
            <MessageSquare size={18} className="text-accent" />
          </div>
          <p className="text-2xl font-bold text-text-main">
            {m.totalComments.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">
            +{m.activity?.commentsToday || 0} today
          </p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-success space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Total Accounts
            </span>
            <Users size={18} className="text-success" />
          </div>
          <p className="text-2xl font-bold text-text-main">
            {m.totalUsers.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">
            +{m.dnu || 0} new today
          </p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-warning space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Active Users (DAU)
            </span>
            <Activity size={18} className="text-warning" />
          </div>
          <p className="text-2xl font-bold text-text-main">
            {m.dau.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">
            MAU: {m.mau.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Live Traffic — Google Analytics (GA4 Data API) */}
      <Card padding="lg" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light/20 pb-4">
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <BarChart3 size={20} className="text-primary" />
              Live Traffic (Google Analytics)
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Real visitor traffic from GA4, last 30 days. Separate from the platform activity
              metrics above, which come from Supabase.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchGa4}
            disabled={ga4Loading}
            className="gap-1.5 text-xs shrink-0"
          >
            <RefreshCw size={14} className={ga4Loading ? "animate-spin" : ""} />
            {ga4Loading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        {ga4Loading && !ga4Data ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !ga4Configured ? (
          <div className="text-center py-10 space-y-2 border border-dashed border-border-light/30 rounded-xl">
            <BarChart3 size={32} className="mx-auto text-text-muted opacity-50" />
            <p className="text-sm font-semibold text-text-main">Google Analytics isn&apos;t connected yet</p>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              Set GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_EMAIL, and GA4_SERVICE_ACCOUNT_PRIVATE_KEY
              in your environment to enable this section.
            </p>
          </div>
        ) : ga4Error ? (
          <div className="text-center py-10 space-y-2 border border-dashed border-danger/30 rounded-xl">
            <AlertCircle size={32} className="mx-auto text-danger opacity-70" />
            <p className="text-sm font-semibold text-text-main">Couldn&apos;t load Google Analytics data</p>
            <p className="text-xs text-text-muted max-w-md mx-auto font-mono">{ga4Error}</p>
          </div>
        ) : ga4Data ? (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card padding="md" className="border-l-4 border-l-primary space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Sessions</span>
                  <Activity size={18} className="text-primary" />
                </div>
                <p className="text-2xl font-bold text-text-main">{ga4Data.totals.sessions.toLocaleString()}</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-success space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Users</span>
                  <Users size={18} className="text-success" />
                </div>
                <p className="text-2xl font-bold text-text-main">{ga4Data.totals.activeUsers.toLocaleString()}</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-accent space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Page Views</span>
                  <Eye size={18} className="text-accent" />
                </div>
                <p className="text-2xl font-bold text-text-main">{ga4Data.totals.pageViews.toLocaleString()}</p>
              </Card>
              <Card padding="md" className="border-l-4 border-l-warning space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Avg Engagement</span>
                  <Clock size={18} className="text-warning" />
                </div>
                <p className="text-2xl font-bold text-text-main">
                  {Math.floor(ga4Data.totals.avgEngagementSec / 60)}m {ga4Data.totals.avgEngagementSec % 60}s
                </p>
              </Card>
            </div>

            {/* Daily sessions trend — plain CSS bars, no charting lib in this project */}
            {ga4Data.dailyTrend.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                  Sessions, last 30 days
                </h3>
                <div className="flex items-end gap-0.5 h-24 bg-surface/30 rounded-lg p-2">
                  {ga4Data.dailyTrend.map((day) => {
                    const max = Math.max(...ga4Data.dailyTrend.map((d) => d.sessions), 1);
                    const heightPct = Math.max((day.sessions / max) * 100, 2);
                    return (
                      <div
                        key={day.date}
                        title={`${day.date}: ${day.sessions} sessions`}
                        className="flex-1 bg-primary/60 hover:bg-primary rounded-sm transition-colors"
                        style={{ height: `${heightPct}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Pages */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Top Pages</h3>
                <div className="space-y-1.5">
                  {ga4Data.topPages.length === 0 ? (
                    <p className="text-xs text-text-muted">No page view data yet.</p>
                  ) : (
                    ga4Data.topPages.map((p) => (
                      <div key={p.path} className="flex items-center justify-between text-xs gap-3">
                        <span className="font-mono text-text-main truncate">{p.path}</span>
                        <span className="text-text-muted font-semibold shrink-0">{p.views.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Events — this is where our custom gtag events show up */}
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Top Events</h3>
                <div className="space-y-1.5">
                  {ga4Data.topEvents.length === 0 ? (
                    <p className="text-xs text-text-muted">No event data yet.</p>
                  ) : (
                    ga4Data.topEvents.map((e) => (
                      <div key={e.name} className="flex items-center justify-between text-xs gap-3">
                        <span className="font-mono text-text-main truncate">{e.name}</span>
                        <span className="text-text-muted font-semibold shrink-0">{e.count.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Device breakdown */}
            {ga4Data.devices.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Smartphone size={13} /> Device Breakdown
                </h3>
                <div className="flex flex-wrap gap-2">
                  {ga4Data.devices.map((d) => {
                    const total = ga4Data.devices.reduce((acc, x) => acc + x.sessions, 0) || 1;
                    const pct = Math.round((d.sessions / total) * 100);
                    return (
                      <Badge key={d.category} tone="neutral" size="sm">
                        {d.category}: {pct}%
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Card>

      {/* Daily User Signups & Email Audit Section */}
      <Card padding="lg" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light/20 pb-4">
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Mail size={20} className="text-primary" />
              Daily User Signups & Email Directory
            </h2>
            <p className="text-xs text-text-muted mt-1">
              List of user emails signed up each day. Click any day row to expand and inspect registered emails.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExpandAll} className="text-xs py-1 px-2.5">
              Expand All
            </Button>
            <Button size="sm" variant="outline" onClick={handleCollapseAll} className="text-xs py-1 px-2.5">
              Collapse All
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface/50 p-3 rounded-xl border border-border-light/20">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              type="text"
              placeholder="Filter by email address or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9 w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-text-muted shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs bg-surface border border-border-light/30 text-text-main rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Roles</option>
              <option value="citizen">Citizen / Normal</option>
              <option value="politician">Politician</option>
              <option value="candidate">Candidate</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {searchQuery && (
            <span className="text-xs font-semibold text-primary px-2">
              Showing {totalFilteredUsers} match{totalFilteredUsers === 1 ? "" : "es"}
            </span>
          )}
        </div>

        {/* Daily Accordion List */}
        {filteredDailyGroups.length === 0 ? (
          <div className="text-center py-12 space-y-2 border border-dashed border-border-light/30 rounded-xl">
            <Users size={32} className="mx-auto text-text-muted opacity-50" />
            <p className="text-sm font-semibold text-text-main">No signups found matching your filter</p>
            <p className="text-xs text-text-muted">Try clearing your search query or selecting "All Roles".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDailyGroups.map((group) => {
              const isExpanded = expandedDays[group.signup_date] || searchQuery.length > 0;
              const dateLabel = new Date(`${group.signup_date}T00:00:00Z`).toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              });

              return (
                <div
                  key={group.signup_date}
                  className="border border-border-light/30 rounded-xl overflow-hidden bg-surface/20 transition-all"
                >
                  {/* Header Row */}
                  <button
                    type="button"
                    onClick={() => toggleDayExpanded(group.signup_date)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-surface/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-text-main flex items-center gap-2">
                          <Calendar size={14} className="text-text-muted" />
                          {dateLabel}
                        </span>
                        <span className="text-xs text-text-muted">
                          {group.signup_date}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge tone="primary" size="sm">
                        {group.filteredUsers.length} {group.filteredUsers.length === 1 ? "User" : "Users"}
                      </Badge>
                    </div>
                  </button>

                  {/* Expanded Body Table */}
                  {isExpanded && (
                    <div className="border-t border-border-light/20 bg-surface/40 p-4 animate-fade-in">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-border-light/20 text-text-muted uppercase tracking-wider font-semibold">
                              <th className="pb-2.5 pl-2">Email Address</th>
                              <th className="pb-2.5">Full Name</th>
                              <th className="pb-2.5">Role</th>
                              <th className="pb-2.5 pr-2 text-right">Signup Time (UTC)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-light/10">
                            {group.filteredUsers.map((u: DailyUserSignup) => {
                              const timeStr = new Date(u.created_at).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: true,
                                timeZone: "UTC",
                              });

                              return (
                                <tr key={u.id} className="hover:bg-surface/60 transition-colors group">
                                  <td className="py-2.5 pl-2 font-mono font-medium text-text-main">
                                    <div className="flex items-center gap-2">
                                      <Mail size={13} className="text-primary/70 shrink-0" />
                                      <span>{u.email}</span>
                                      <button
                                        type="button"
                                        title="Copy email"
                                        onClick={() => copyToClipboard(u.email)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-primary rounded"
                                      >
                                        {copiedEmail === u.email ? (
                                          <Check size={12} className="text-success" />
                                        ) : (
                                          <Copy size={12} className="text-text-muted" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2.5 text-text-main font-semibold">
                                    <div className="flex items-center gap-1.5">
                                      <User size={13} className="text-text-muted shrink-0" />
                                      {u.full_name || "User"}
                                    </div>
                                  </td>
                                  <td className="py-2.5">
                                    <Badge
                                      tone={
                                        u.role === "admin"
                                          ? "amber"
                                          : u.role === "politician"
                                          ? "primary"
                                          : "neutral"
                                      }
                                      size="sm"
                                    >
                                      {u.role || "citizen"}
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 pr-2 text-right font-mono text-text-muted">
                                    {timeStr}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
