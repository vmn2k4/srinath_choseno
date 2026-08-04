"use client";

import React, { useState, useEffect } from "react";
import AdminSubNav from "./AdminSubNav";
import { getAdminAnalyticsMetrics } from "@/lib/services/analytics";
import { Card, Button, Spinner, PageHeader } from "@/components/primitives";
import {
  Users,
  MessageSquare,
  FileText,
  RefreshCw,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AnalyticsAdminClient() {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await getAdminAnalyticsMetrics(supabase);
    if (res.success) {
      setMetrics(res.metrics);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

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
        subtitle="Constituent retention, daily activity, and civic engagement metrics."
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
            <span className="text-xs font-bold text-text-muted uppercase">
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
            <span className="text-xs font-bold text-text-muted uppercase">
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
            <span className="text-xs font-bold text-text-muted uppercase">
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
            <span className="text-xs font-bold text-text-muted uppercase">
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
    </div>
  );
}
