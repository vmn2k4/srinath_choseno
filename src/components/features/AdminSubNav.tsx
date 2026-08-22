"use client";

import React from "react";
import Link from "next/link";

const TABS = [
  { key: "boundaries", label: "Geospatial Boundaries", href: "/admin" },
  { key: "analytics", label: "Platform Analytics", href: "/admin/analytics" },
  { key: "traffic", label: "Google Analytics", href: "/admin/traffic" },
  { key: "region-explorer", label: "Region & Funnel Explorer", href: "/admin/region-explorer" },
  { key: "search-console", label: "Search Console", href: "/admin/search-console" },
  { key: "elections", label: "Elections & Seats", href: "/admin/elections" },
  { key: "election-admins", label: "Seat Administrators", href: "/admin/election-admins" },
  { key: "office-holders", label: "Office Holders", href: "/admin/office-holders" },
  { key: "key-leaders", label: "Key Leaders", href: "/admin/key-leaders" },
  { key: "claim_requests", label: "Claim Requests", href: "/admin/claim_requests" },
  { key: "campaign", label: "Campaign", href: "/admin/campaign" },
  { key: "visualizer", label: "Boundary Inspector", href: "/admin/visualize" },
  { key: "theme", label: "Site Theme", href: "/admin/theme" },
  { key: "news", label: "News", href: "/admin/news" },
  { key: "news-distribution", label: "News Distribution", href: "/admin/news-distribution" },
  { key: "news-import", label: "Bulk News Import", href: "/admin/news-import" },
  { key: "moderation", label: "Moderation", href: "/admin/moderation" },
];

export default function AdminSubNav({
  active,
  className = "",
}: {
  active: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {TABS.map((tab) =>
        tab.key === active ? (
          <span
            key={tab.key}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-primary bg-primary/10 border border-primary/30"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.key}
            href={tab.href}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            {tab.label}
          </Link>
        )
      )}
    </div>
  );
}
