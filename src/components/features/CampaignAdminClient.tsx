"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AdminSubNav from "./AdminSubNav";
import {
  Megaphone,
  Upload,
  FileJson,
  Send,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  X,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { Card, Button, Input, Textarea, Spinner, PageHeader, Badge, ConfirmDialog, Avatar } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import {
  parseCampaignInput,
  fillCampaignTemplate,
  isValidCampaignEmail,
  type ParsedCampaignRecord,
} from "@/lib/utils/campaignImport";
import {
  sendCampaignInvite,
  listCampaignSends,
  getCampaignStats,
  type CampaignSendRow,
  type CampaignStatsRow,
} from "@/lib/services/campaigns";
import { searchPoliticians } from "@/lib/services/politicians";
import { getOfficeHolderContact } from "@/lib/services/elections";
import { getPoliticianProfile } from "@/lib/services/profile";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";
import {
  CAMPAIGN_TEMPLATE_PRESETS,
  addTrackingPixelToTemplate,
  createTrackedLink,
  type CampaignTemplatePreset,
} from "@/lib/utils/campaignTemplates";

// Same shape search_politicians_and_officeholders returns for the nav-bar
// search (GlobalPoliticianSearch) — reused here so admins can add a
// recipient by typing a name instead of hand-building a CSV row.
type PoliticianSearchResult = {
  result_key: string;
  source: string;
  full_name: string;
  role_title: string | null;
  jurisdiction_name: string | null;
  country: string | null;
  boundary_type: string | null;
  map_shape_id: number | null;
  party_name: string | null;
  photo_url: string | null;
  wall_slug: string | null;
  politician_profile_id: string | null;
  office_holder_id: string | null;
  is_key_leader: boolean;
  key_priority: number | null;
};

const DEFAULT_SUBJECT = "Your Political Wall is Ready on Choseno";

const DEFAULT_BODY = `<p>Hi {{first_name}},</p>

<p>You're invited to claim your official wall on Choseno — a place where voters can see your positions, your record, and connect with you directly.</p>

<p style="text-align:center;margin:24px 0;">
  <a href="{{claim_link}}" style="display:inline-block;background:#667eea;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Claim Your Wall</a>
</p>

<p>Once you sign up, you'll be able to customize your wall, connect with constituents, share your positions, and respond to voter questions.</p>

<p>Questions? Just reply to this email.</p>

<p>Best,<br>The Choseno Team</p>`;

type RowStatus = "idle" | "sending" | "sent" | "failed";

interface CampaignRow extends ParsedCampaignRecord {
  status: RowStatus;
  errorMessage?: string;
}

function statusBadge(status: RowStatus) {
  switch (status) {
    case "sending":
      return <Badge tone="accent" icon={<Loader2 size={11} className="animate-spin" />}>Sending</Badge>;
    case "sent":
      return <Badge tone="emerald" icon={<CheckCircle2 size={11} />}>Sent</Badge>;
    case "failed":
      return <Badge tone="rose" icon={<XCircle size={11} />}>Failed</Badge>;
    default:
      return <Badge tone="neutral" icon={<Clock size={11} />}>Queued</Badge>;
  }
}

function historyBadge(status: CampaignSendRow["status"]) {
  const tones: Record<CampaignSendRow["status"], "emerald" | "rose" | "accent" | "primary" | "neutral"> = {
    sent: "emerald",
    failed: "rose",
    opened: "accent",
    claimed: "primary",
    pending: "neutral",
  };
  return <Badge tone={tones[status] || "neutral"}>{status}</Badge>;
}

interface ScoreBreakdownItem {
  icon: string;
  label: string;
  points: number;
  max: number;
  detail: string;
  active: boolean;
}

function getEngagementBreakdown(send: CampaignSendRow): { total: number; items: ScoreBreakdownItem[]; textSummary: string } {
  const items: ScoreBreakdownItem[] = [];

  // 1. Open (up to 50 pts)
  let openPoints = 0;
  let openDetail = "Not opened yet";
  const hasOpened = Boolean(send.opened_at || (send.opened_count && send.opened_count > 0));
  if (hasOpened) {
    const count = send.opened_count || 1;
    openPoints = 40;
    if (count > 1) {
      const bonus = Math.min((count - 1) * 5, 10);
      openPoints += bonus;
      openDetail = `Opened ${count}x (40 base + ${bonus} repeat bonus)`;
    } else {
      openDetail = `Opened 1 time (+40 pts)`;
    }
  }
  items.push({
    icon: "✉️",
    label: "Email Open",
    points: openPoints,
    max: 50,
    detail: openDetail,
    active: hasOpened,
  });

  // 2. Speed / Time to open (up to 10 pts)
  let speedPoints = 0;
  let speedDetail = "No open recorded";
  if (send.first_open_time_seconds) {
    if (send.first_open_time_seconds < 3600) {
      speedPoints = 10;
      speedDetail = `Fast open in ${formatTimeToOpen(send.first_open_time_seconds)} (<1h)`;
    } else if (send.first_open_time_seconds < 86400) {
      speedPoints = 5;
      speedDetail = `Opened in ${formatTimeToOpen(send.first_open_time_seconds)} (<24h)`;
    } else {
      speedDetail = `Opened after ${formatTimeToOpen(send.first_open_time_seconds)}`;
    }
  }
  items.push({
    icon: "⏱️",
    label: "Open Speed",
    points: speedPoints,
    max: 10,
    detail: speedDetail,
    active: speedPoints > 0,
  });

  // 3. Link clicks (up to 30 pts)
  let clickPoints = 0;
  const clickCount = send.link_clicks || 0;
  if (clickCount > 0) {
    clickPoints = Math.min(clickCount * 10, 30);
  }
  items.push({
    icon: "🔗",
    label: "Link Clicks",
    points: clickPoints,
    max: 30,
    detail: clickCount > 0 ? `${clickCount} click${clickCount === 1 ? "" : "s"} (+10 each)` : "No links clicked yet",
    active: clickCount > 0,
  });

  // 4. Wall visit & duration (up to 30 pts)
  let wallPoints = 0;
  let wallDetail = "Wall not visited yet";
  if (send.wall_visited) {
    wallPoints = 20;
    const dur = send.wall_visit_duration_seconds;
    if (dur && dur >= 30) {
      wallPoints += 10;
      wallDetail = `Visited wall for ${dur}s (20 visit + 10 time bonus)`;
    } else if (dur) {
      wallDetail = `Visited wall for ${dur}s (+20 pts)`;
    } else {
      wallDetail = `Visited candidate wall (+20 pts)`;
    }
  }
  items.push({
    icon: "🏛️",
    label: "Wall Visit",
    points: wallPoints,
    max: 30,
    detail: wallDetail,
    active: Boolean(send.wall_visited),
  });

  const total = Math.min(items.reduce((sum, it) => sum + it.points, 0), 100);

  const textSummary = items
    .map((it) => `${it.icon} ${it.label}: +${it.points}/${it.max} pts (${it.detail})`)
    .join("\n");

  return { total, items, textSummary };
}

function EngagementScoreBadge({ send }: { send: CampaignSendRow }) {
  const { total, items } = getEngagementBreakdown(send);

  return (
    <div className="relative group z-10 hover:z-50 inline-flex items-center cursor-help">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border-light/40 bg-surface/50 hover:bg-surface transition-colors">
        <div className="w-12 h-1.5 bg-border-light/60 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              total >= 70
                ? "bg-emerald-500"
                : total >= 40
                ? "bg-primary"
                : "bg-amber-500"
            }`}
            style={{ width: `${total}%` }}
          />
        </div>
        <span className="text-[11px] font-semibold text-text-main tabular-nums">
          {total}/100
        </span>
      </div>

      {/* Hover Popup Tooltip Card (Interactive & Hoverable) */}
      <div className="absolute right-0 top-full pt-1.5 hidden group-hover:block z-50 w-72 animate-fade-in">
        <div className="p-3 bg-surface border border-border-light/60 rounded-xl shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-border-light/30 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🎯</span>
              <p className="text-xs font-bold text-text-main">Engagement Breakdown</p>
            </div>
            <span className="text-xs font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {total}/100
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            {items.map((it) => (
              <div
                key={it.label}
                className={`flex items-start justify-between gap-2 p-1.5 rounded-lg transition-colors ${
                  it.active ? "bg-surface-hover/70" : "opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[11px] text-text-main flex items-center gap-1">
                    <span>{it.icon}</span> {it.label}
                  </p>
                  <p className="text-[10px] text-text-muted truncate">{it.detail}</p>
                </div>
                <span
                  className={`font-bold text-[11px] shrink-0 tabular-nums ${
                    it.points > 0 ? "text-emerald-500" : "text-text-muted"
                  }`}
                >
                  +{it.points}
                  <span className="text-[9px] font-normal text-text-muted">/{it.max}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 pt-1.5 border-t border-border-light/30 text-[10px] text-text-muted leading-tight">
            Points increase automatically when recipient opens email, clicks links, or visits their wall.
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function calculateReadEngagement(send: CampaignSendRow): {
  durationText: string;
  readCategory: string;
  detail: string;
} {
  const openTime = send.opened_at ? new Date(send.opened_at).getTime() : null;
  const links = (send.links_clicked || []) as Array<{ link: string; count?: number; clicked_at?: string }>;
  const firstClickTime = links[0]?.clicked_at ? new Date(links[0].clicked_at).getTime() : null;

  // Case 1: Active Read time before clicking a link in email
  if (openTime && firstClickTime && firstClickTime > openTime) {
    const diffSec = Math.floor((firstClickTime - openTime) / 1000);
    if (diffSec < 3600) {
      return {
        durationText: formatTimeToOpen(diffSec),
        readCategory: diffSec >= 10 ? "Thoroughly Read" : "Quick Click",
        detail: `Read email for ${formatTimeToOpen(diffSec)} before clicking link`,
      };
    }
  }

  // Case 2: Wall reading duration
  if (send.wall_visited && send.wall_visit_duration_seconds) {
    return {
      durationText: `${send.wall_visit_duration_seconds}s`,
      readCategory: send.wall_visit_duration_seconds >= 30 ? "Deep Read" : "Read Wall",
      detail: `Spent ${send.wall_visit_duration_seconds}s on candidate wall`,
    };
  }

  // Case 3: Re-read span across multiple opens
  if (send.opened_at && send.last_opened_at && send.opened_count && send.opened_count > 1) {
    const lastOpenTime = new Date(send.last_opened_at).getTime();
    const diffSec = Math.floor((lastOpenTime - openTime!) / 1000);
    if (diffSec > 0 && diffSec < 7200) {
      return {
        durationText: formatTimeToOpen(diffSec),
        readCategory: "Re-read Session",
        detail: `Re-opened across ${formatTimeToOpen(diffSec)} span (${send.opened_count}x)`,
      };
    }
  }

  if (send.opened_at) {
    return {
      durationText: "Active",
      readCategory: "Opened & Viewed",
      detail: "Recipient opened and viewed email",
    };
  }

  return {
    durationText: "-",
    readCategory: "Unopened",
    detail: "Not opened yet",
  };
}

function parseDeviceAndBrowser(userAgent?: string): { device: string; client: string; icon: string; isProxy?: boolean } {
  if (!userAgent || userAgent === "unknown") {
    return { device: "Email App", client: "Mail Client", icon: "✉️" };
  }
  const ua = userAgent.toLowerCase();

  // 1. Google Image Proxy (Gmail web/app caches images on Google servers)
  if (ua.includes("googleimageproxy") || ua.includes("ggpht.com")) {
    return {
      device: "Gmail App / Web",
      client: "Google Image Proxy",
      icon: "🔴",
      isProxy: true,
    };
  }

  // 2. Real OS detection
  let device = "Desktop";
  let icon = "💻";
  if (ua.includes("iphone")) {
    device = "iPhone";
    icon = "📱";
  } else if (ua.includes("ipad")) {
    device = "iPad";
    icon = "📱";
  } else if (ua.includes("android")) {
    device = "Android";
    icon = "📱";
  } else if (ua.includes("macintosh") || ua.includes("mac os") || ua.includes("darwin")) {
    device = "Mac";
    icon = "💻";
  } else if (ua.includes("windows nt") || ua.includes("win64") || ua.includes("win32")) {
    device = "Windows PC";
    icon = "💻";
  } else if (ua.includes("linux") || ua.includes("x11")) {
    device = "Linux PC";
    icon = "💻";
  }

  // 3. Email client & Browser detection
  let client = "Browser";
  if (ua.includes("outlook") || ua.includes("microsoft office")) client = "Outlook";
  else if (ua.includes("applewebkit") && ua.includes("mobile") && !ua.includes("chrome")) client = "Apple Mail";
  else if (ua.includes("thunderbird")) client = "Thunderbird";
  else if (ua.includes("chrome") && !ua.includes("edg/")) client = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) client = "Safari";
  else if (ua.includes("edg/")) client = "Edge";
  else if (ua.includes("firefox")) client = "Firefox";

  return { device, client, icon };
}

function formatIpDisplay(ipStr?: string): string {
  if (!ipStr || ipStr === "unknown") return "Direct connection";
  const ips = ipStr.split(",").map((s) => s.trim()).filter(Boolean);
  const firstIp = ips[0] || ipStr;
  if (firstIp.startsWith("66.249.") || firstIp.startsWith("74.125.")) {
    return `Google Proxy: ${firstIp}`;
  }
  if (ips.length > 1) {
    return `IP: ${firstIp} (via proxy)`;
  }
  return `IP: ${firstIp}`;
}

function OpenedStatusBadge({ send }: { send: CampaignSendRow }) {
  const hasOpened = Boolean(send.opened_at || (send.opened_count && send.opened_count > 0));
  if (!hasOpened) {
    return <Badge tone="neutral">Unopened</Badge>;
  }

  const count = send.opened_count || 1;
  const firstOpened = send.opened_at;
  const lastOpened = send.last_opened_at || send.opened_at;
  const lastOpenedRel = formatLastOpened(lastOpened);
  const firstOpenedRel = formatLastOpened(firstOpened);
  const isMultiple = count > 1;
  const readEngagement = calculateReadEngagement(send);

  // Filter open events from send.events
  const openEvents = (send.events || []).filter((e) => e.event_type === "open");

  // Normalize Google Proxy IPs into a single network bucket (66.249.x.x) so Google's multi-server pool isn't mistaken for distinct users
  const normalizedIps = openEvents
    .map((e) => {
      const ip = (e.event_data?.ip || "").split(",")[0]?.trim();
      if (ip.startsWith("66.249.") || ip.startsWith("74.125.")) return "Google-Image-Proxy";
      return ip;
    })
    .filter(Boolean);
  const uniqueIps = Array.from(new Set(normalizedIps));

  const devices = openEvents.map((e) => {
    const { device, client } = parseDeviceAndBrowser(e.event_data?.user_agent);
    return `${device} · ${client}`;
  });
  const uniqueDevices = Array.from(new Set(devices));

  // Determine if it was truly forwarded or re-read by the same person
  const isMultiDeviceOrIp = uniqueIps.length > 1 || uniqueDevices.length > 1;

  return (
    <div className="relative group z-10 hover:z-50 inline-flex items-center cursor-help">
      <Badge tone="emerald" className="cursor-pointer">
        ✓ Opened {count}x {lastOpenedRel ? `(${lastOpenedRel})` : ""}
      </Badge>

      {/* Hover Popup Tooltip Card (Single Clean Scrollbar & Wide Layout) */}
      <div className="absolute right-0 top-full pt-1.5 hidden group-hover:block z-50 w-[340px] animate-fade-in">
        <div className="p-3.5 bg-surface border border-border-light/60 rounded-xl shadow-2xl backdrop-blur-md max-h-[440px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border-light/30 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">✉️</span>
              <p className="text-xs font-bold text-text-main">Open Timestamps & Devices</p>
            </div>
            <span className="text-xs font-extrabold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {count}x {count === 1 ? "Open" : "Opens"}
            </span>
          </div>

          {/* Granular Open-by-Open Log (Single scrollbar, no nested overflow) */}
          {openEvents.length > 0 ? (
            <div className="space-y-2 mb-2.5">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                All Recorded Opens ({openEvents.length})
              </p>
              <div className="space-y-1.5">
                {openEvents.map((ev, idx) => {
                  const uaInfo = parseDeviceAndBrowser(ev.event_data?.user_agent);
                  const ipDisplay = formatIpDisplay(ev.event_data?.ip);
                  const openNum = ev.event_data?.open_number || idx + 1;
                  const timeRel = formatLastOpened(ev.occurred_at || ev.event_data?.timestamp);
                  const timeFormatted = formatDateTime(ev.occurred_at || ev.event_data?.timestamp);

                  return (
                    <div
                      key={ev.id || idx}
                      className="p-2.5 rounded-lg bg-surface-hover/80 border border-border-light/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[11px] text-text-main flex items-center gap-1">
                          <span>{uaInfo.icon}</span> Open #{openNum}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-500">{timeRel}</span>
                      </div>

                      <p className="text-[10px] text-text-muted">{timeFormatted}</p>

                      {/* Device and Proxy/IP details stacked cleanly below */}
                      <div className="pt-1.5 border-t border-border-light/20 space-y-0.5 text-[9.5px]">
                        <div className="flex items-center justify-between text-text-main/80 font-medium">
                          <span>📱 {uaInfo.device}</span>
                          <span className="text-text-muted text-[9px]">{uaInfo.client}</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[9px] text-text-muted">
                          <span>🌐</span>
                          <span className="break-all">{ipDisplay}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Fallback summary for rows before granular logs */
            <div className="space-y-1.5 text-xs mb-2">
              <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-surface-hover/70">
                <span className="text-[11px] font-semibold text-text-muted">First Open:</span>
                <span className="text-[11px] font-medium text-text-main text-right">
                  {formatDateTime(firstOpened)}
                  <span className="block text-[10px] text-text-muted">({firstOpenedRel})</span>
                </span>
              </div>

              {isMultiple && (
                <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-surface-hover/70">
                  <span className="text-[11px] font-semibold text-text-muted">Latest Open:</span>
                  <span className="text-[11px] font-medium text-text-main text-right">
                    {formatDateTime(lastOpened)}
                    <span className="block text-[10px] text-text-muted">({lastOpenedRel})</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quick Metrics */}
          <div className="space-y-1.5 text-xs mb-2 pt-1 border-t border-border-light/30">
            {send.first_open_time_seconds ? (
              <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-surface-hover/50">
                <span className="text-[11px] font-semibold text-text-muted">Time to First Open:</span>
                <span className="text-[11px] font-bold text-emerald-500">
                  {formatTimeToOpen(send.first_open_time_seconds)} after send
                </span>
              </div>
            ) : null}

            {/* Read Time / Duration */}
            <div className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                <span>📖</span> Read Engagement:
              </span>
              <span className="text-[11px] font-medium text-text-main text-right">
                <span className="font-bold text-primary">{readEngagement.readCategory}</span>
                <span className="block text-[10px] text-text-muted">{readEngagement.detail}</span>
              </span>
            </div>
          </div>

          {/* Accurate IP & Device Verification Verdict */}
          {isMultiple && (
            <div
              className={`mt-2 pt-2 border-t border-border-light/30 text-[10px] leading-snug flex items-start gap-1.5 p-2 rounded-lg ${
                isMultiDeviceOrIp
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              }`}
            >
              <span className="text-xs shrink-0">{isMultiDeviceOrIp ? "👥" : "🔄"}</span>
              <div>
                <strong>{isMultiDeviceOrIp ? "Multi-Device / Forwarded" : "Re-read by Same Recipient"}:</strong>{" "}
                {openEvents.length > 0 ? (
                  isMultiDeviceOrIp ? (
                    <span>
                      Opened across {uniqueDevices.length} different clients ({uniqueDevices.join(", ")}).
                    </span>
                  ) : (
                    <span>
                      All {count} opens originated through the same client ({devices[0] || "Gmail Proxy"}).
                    </span>
                  )
                ) : (
                  <span>
                    {count} opens recorded over time.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClickStatusBadge({ send }: { send: CampaignSendRow }) {
  const clicks = send.link_clicks || 0;
  if (clicks === 0) return null;

  const links = (send.links_clicked || []) as Array<{ link: string; count?: number; clicked_at?: string }>;

  return (
    <div className="relative group z-10 hover:z-50 inline-flex items-center cursor-help">
      <Badge tone="accent">
        {clicks} {clicks === 1 ? "click" : "clicks"}
      </Badge>

      {links.length > 0 && (
        <div className="absolute right-0 top-full pt-1.5 hidden group-hover:block z-50 w-72 animate-fade-in">
          <div className="p-3 bg-surface border border-border-light/60 rounded-xl shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-border-light/30 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🔗</span>
                <p className="text-xs font-bold text-text-main">Clicked Links</p>
              </div>
              <span className="text-xs font-extrabold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                {clicks} total
              </span>
            </div>

            <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
              {links.map((l, i) => (
                <div key={i} className="p-1.5 rounded-lg bg-surface-hover/70 text-[11px]">
                  <p className="font-semibold text-text-main truncate">
                    {l.link.replace(/^https?:\/\/(www\.)?/, "")}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-text-muted mt-0.5">
                    <span>{l.count || 1}x clicked</span>
                    <span>{formatDateTime(l.clicked_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateEngagementScore(send: CampaignSendRow): number {
  return getEngagementBreakdown(send).total;
}

function formatTimeToOpen(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatLastOpened(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diffSeconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSeconds < 60) return "just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  } catch {
    return "";
  }
}


export default function CampaignAdminClient() {
  const supabase = createClient();

  const [selectedPreset, setSelectedPreset] = useState<CampaignTemplatePreset>(
    CAMPAIGN_TEMPLATE_PRESETS[0]
  );
  const [campaignName, setCampaignName] = useState(
    CAMPAIGN_TEMPLATE_PRESETS[0].defaultCampaignName
  );
  const [subject, setSubject] = useState(CAMPAIGN_TEMPLATE_PRESETS[0].subject);
  const [body, setBody] = useState(CAMPAIGN_TEMPLATE_PRESETS[0].body);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [previewRow, setPreviewRow] = useState<CampaignRow | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [confirmSendAll, setConfirmSendAll] = useState(false);

  const [history, setHistory] = useState<CampaignSendRow[]>([]);
  const [stats, setStats] = useState<CampaignStatsRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PoliticianSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const [{ data: sends }, { data: statRows }] = await Promise.all([
      listCampaignSends(supabase, { limit: 100 }),
      getCampaignStats(supabase),
    ]);
    setHistory(sends || []);
    setStats(statRows || []);
    setLoadingHistory(false);
  }, [supabase]);

  useEffect(() => {
    async function initialLoad() {
      await loadHistory();
    }
    initialLoad();
  }, [loadHistory]);

  const validCount = useMemo(() => rows.filter((r) => !r.error).length, [rows]);
  const errorCount = rows.length - validCount;

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      const myRequestId = ++searchRequestIdRef.current;
      const { data, error } = await searchPoliticians(supabase, trimmed, { limit: 15 });
      if (myRequestId !== searchRequestIdRef.current) return;
      setSearchResults(error ? [] : ((data as PoliticianSearchResult[] | null) || []));
      setSearchLoading(false);
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, supabase]);

  const addRecipientFromSearch = async (result: PoliticianSearchResult) => {
    setAddingKey(result.result_key);
    try {
      let email = "";
      if (result.office_holder_id) {
        const { data } = await getOfficeHolderContact(supabase, result.office_holder_id);
        email = data?.contact_email || "";
      } else if (result.politician_profile_id) {
        const { data } = await getPoliticianProfile(supabase, result.politician_profile_id);
        email = (data as { contact_email?: string | null } | null)?.contact_email || "";
      }

      const name = result.full_name;
      const role = result.role_title || "";
      const city = result.jurisdiction_name || "";
      const wallSlug = result.wall_slug || buildPoliticianWallSlug(name, role);

      const newRow: CampaignRow = {
        row: rows.length + 1,
        data: { name, email: email || "", role, city, wallSlug },
        error: !email
          ? "No contact email on file — fill in manually"
          : !isValidCampaignEmail(email)
          ? `Invalid email on file: ${email}`
          : null,
        status: "idle",
      };

      setRows((prev) => [newRow, ...prev]);
      setSearchQuery("");
      setSearchResults([]);
      setSearchOpen(false);
    } finally {
      setAddingKey(null);
    }
  };

  const updateRowField = (index: number, field: "email" | "wallSlug", value: string) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const data = { ...r.data, [field]: value };
        const error =
          field === "email"
            ? !data.name.trim()
              ? "Missing name"
              : !data.email.trim()
              ? "Missing email"
              : !isValidCampaignEmail(data.email)
              ? `Invalid email: ${data.email}`
              : null
            : r.error;
        return { ...r, data, error };
      })
    );
  };

  const applyPreset = (preset: CampaignTemplatePreset) => {
    setSelectedPreset(preset);
    setSubject(preset.subject);
    setBody(preset.body);
    if (
      !campaignName ||
      CAMPAIGN_TEMPLATE_PRESETS.some((p) => p.defaultCampaignName === campaignName)
    ) {
      setCampaignName(preset.defaultCampaignName);
    }
  };

  const previewPresetSample = (preset: CampaignTemplatePreset) => {
    const sampleRow: CampaignRow = {
      row: 1,
      data: preset.sampleRecipient,
      error: null,
      status: "idle",
    };
    setPreviewRow(sampleRow);
  };

  const handleLoadSampleData = () => {
    setImportText(selectedPreset.sampleData);
    setImportError("");
    setRows([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    setImportError("");
    setRows([]);
  };

  const handleParse = () => {
    setImportError("");
    try {
      const parsed = parseCampaignInput(importText);
      if (parsed.length === 0) {
        setImportError("No records found. Check the format and try again.");
        setRows([]);
        return;
      }
      setRows(parsed.map((r, idx) => ({ ...r, row: idx + 1, status: "idle" as RowStatus })));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't parse that input.");
      setRows([]);
    }
  };

  const buildEmail = useCallback(
    (record: CampaignRow) => {
      const filledSubject = fillCampaignTemplate(subject, record.data);
      const filledBody = fillCampaignTemplate(body, record.data).replace(
        /\{\{\s*claim_link\s*\}\}/gi,
        `${window.location.origin}/auth?role=politician&campaign=PREVIEW`
      );
      return { subject: filledSubject, html: filledBody };
    },
    [subject, body]
  );

  const sendOne = async (index: number) => {
    const record = rows[index];
    if (!record || record.error) return;
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, status: "sending" } : r)));

    const trackingToken = crypto.randomUUID();
    let trackedHtml = addTrackingPixelToTemplate(body, trackingToken);

    const linkRegex = /href="(https?:\/\/[^"]+)"/g;
    trackedHtml = trackedHtml.replace(linkRegex, (_match, url) => {
      let targetUrl = url;
      if (url.includes("/wall/")) {
        const sep = url.includes("?") ? "&" : "?";
        targetUrl = `${url}${sep}t=${trackingToken}`;
      }
      return `href="${createTrackedLink(targetUrl, trackingToken)}"`;
    });

    const { data: sentRow, error } = await sendCampaignInvite(supabase, {
      name: record.data.name,
      email: record.data.email,
      role: record.data.role,
      city: record.data.city,
      campaignName: campaignName.trim(),
      redirectOrigin: window.location.origin,
      htmlTemplate: trackedHtml,
      subject: fillCampaignTemplate(subject, record.data),
      trackingToken,
    });

    if (error) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                status: "failed",
                errorMessage: error.message,
              }
            : r
        )
      );
      return;
    }

    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              status: "sent",
              sentRow: sentRow || undefined,
            }
          : r
      )
    );

    loadHistory();
  };

  const runSendAll = async () => {
    setConfirmSendAll(false);
    setSendingAll(true);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].error || rows[i].status === "sent") continue;
      await sendOne(i);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    setSendingAll(false);
  };

  const canSendAll = validCount > 0 && campaignName.trim().length > 0 && !sendingAll;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Campaign"
        subtitle="Import a CSV or JSON list of politicians and send personalized wall-claim invitations."
      />

      <AdminSubNav active="campaign" />

      {/* Step 1: Choose Email Type & Target Audience */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-text-main flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
              Choose Email Type & Target Audience
            </h2>
            <p className="text-xs text-text-muted mt-1 max-w-2xl">
              Select who you are emailing. Each template automatically configures the required merge tags, subject lines, and recipient fields.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => previewPresetSample(selectedPreset)}
            className="text-xs gap-1.5 border-border-light/60 hover:bg-surface-hover"
          >
            <Eye size={13} className="text-primary" />
            Preview Active Template ({selectedPreset.label})
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CAMPAIGN_TEMPLATE_PRESETS.map((preset) => {
            const isSelected = selectedPreset.key === preset.key;
            return (
              <div
                key={preset.key}
                onClick={() => applyPreset(preset)}
                className={`relative flex flex-col justify-between p-4 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                    : "border-border-light/40 hover:border-primary/40 bg-surface/50 hover:bg-surface/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-2xl">{preset.icon}</span>
                    <div className="flex items-center gap-1.5">
                      {preset.badge && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? "bg-primary/20 text-primary"
                            : "bg-surface-active text-text-muted"
                        }`}>
                          {preset.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="font-bold text-sm text-text-main mb-1">{preset.label}</h3>
                  <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border-light/20 space-y-2 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted font-medium">
                      Needs: <code className="text-primary font-bold">{preset.requiredFields.join(", ")}</code>
                    </span>
                    {isSelected && (
                      <span className="text-primary font-bold text-xs">✓ Active</span>
                    )}
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewPresetSample(preset);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <Eye size={12} /> Preview email
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Step 2: Import Recipients */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-text-main flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
              <Upload size={16} className="text-primary" />
              Import Recipients for {selectedPreset.label}
            </h2>
            <p className="text-xs text-text-muted mt-1 max-w-2xl">
              Paste CSV or JSON records, search existing politicians, or upload a spreadsheet file.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleLoadSampleData}
              className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              📋 Load Sample Format
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => previewPresetSample(selectedPreset)}
              className="text-xs gap-1.5 border-border-light/60 hover:bg-surface-hover"
            >
              <Eye size={13} className="text-primary" />
              Preview Email
            </Button>
          </div>
        </div>

        {/* Dynamic Template Format Help Banner */}
        <div className="p-3 rounded-xl bg-surface-hover/80 border border-border-light/40 text-xs space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-text-main">
              <span>{selectedPreset.icon}</span>
              <span>Expected Columns for {selectedPreset.label}:</span>
            </div>
            <span className="text-[10px] text-text-muted">
              Header row is required (e.g. <code className="text-primary font-mono">{selectedPreset.csvHeader}</code>)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-text-muted font-medium mr-1">Required:</span>
            {selectedPreset.requiredFields.map((f: string) => (
              <span key={f} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px]">
                {f} *
              </span>
            ))}
            {selectedPreset.optionalFields.length > 0 && (
              <>
                <span className="text-text-muted font-medium ml-2 mr-1">Optional:</span>
                {selectedPreset.optionalFields.map((f: string) => (
                  <span key={f} className="px-2 py-0.5 rounded-md bg-surface-active text-text-muted font-mono text-[10px]">
                    {f}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border-light/40 hover:bg-surface-hover transition-colors">
            <FileJson size={13} />
            Upload .csv or .json
            <input type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFileChange} className="hidden" />
          </label>
          <Button size="sm" variant="outline" onClick={() => setSearchOpen((v) => !v)} className="gap-1.5">
            <Search size={13} /> Search politicians & office holders
          </Button>
        </div>

        {searchOpen && (
          <div className="relative max-w-md">
            <div className="flex items-center gap-2 w-full bg-surface-hover border border-border-light rounded-full pl-3.5 pr-2 py-1.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
              <Search size={16} className="text-text-muted shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, city, or role…"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-text-main placeholder:text-text-muted"
              />
              {searchLoading && <Spinner size="sm" />}
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="p-1 rounded-full text-text-muted hover:text-text-main hover:bg-surface-active transition-colors shrink-0"
                aria-label="Close search"
              >
                <X size={16} />
              </button>
            </div>

            {searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-border-light/40 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  {!searchLoading && searchResults.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-text-muted">
                      No politicians or office holders found for &ldquo;{searchQuery.trim()}&rdquo;.
                    </div>
                  )}
                  {searchResults.map((r) => (
                    <button
                      key={r.result_key}
                      onClick={() => addRecipientFromSearch(r)}
                      disabled={addingKey === r.result_key}
                      className="flex items-center gap-2.5 px-3 py-2.5 w-full text-left hover:bg-surface-hover transition-colors border-b border-border-light/10 last:border-b-0 disabled:opacity-50"
                    >
                      <Avatar src={r.photo_url} name={r.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-text-main truncate">{r.full_name}</p>
                        <p className="text-[11px] text-text-muted truncate">
                          {[r.role_title, r.jurisdiction_name].filter(Boolean).join(" · ") || r.country}
                        </p>
                      </div>
                      {addingKey === r.result_key ? (
                        <Spinner size="sm" />
                      ) : (
                        <UserPlus size={14} className="text-text-muted shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Textarea
          rows={8}
          placeholder={selectedPreset.sampleData}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          className="font-mono text-xs"
        />

        {importError && <p className="text-xs text-danger">{importError}</p>}

        <Button size="sm" onClick={handleParse} disabled={!importText.trim()}>
          Parse recipients ({selectedPreset.label})
        </Button>

        {rows.length > 0 && (
          <p className="text-xs text-text-muted">
            {validCount} valid recipient{validCount === 1 ? "" : "s"}
            {errorCount > 0 && <span className="text-danger"> · {errorCount} with errors (won&apos;t be sent)</span>}
          </p>
        )}
      </Card>

      {/* Step 3: Compose Email */}
      {rows.length > 0 && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-text-main flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
              Compose the email ({selectedPreset.label})
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => previewPresetSample(selectedPreset)}
              className="text-xs gap-1.5 border-border-light/60 hover:bg-surface-hover"
            >
              <Eye size={13} className="text-primary" />
              Preview Rendered Email
            </Button>
          </div>

          <label className="text-xs font-semibold text-text-muted block">
            Campaign name
            <Input
              className="mt-1"
              placeholder="e.g. BC Mayors & Councillors 2026"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold text-text-muted block">
            Subject
            <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className="text-xs font-semibold text-text-muted block">
            Body (HTML) — use {"{{first_name}}"}, {"{{name}}"}, {"{{role}}"}, {"{{city}}"}, {"{{wall_slug}}"},{" "}
            {"{{wall_url}}"}, {"{{claim_link}}"}
            <Textarea
              rows={10}
              className="mt-1 font-mono text-xs"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
        </Card>
      )}

      {/* Step 4: Review & Send */}
      {rows.length > 0 && (
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-text-main flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
              Review & send ({validCount} recipients)
            </h2>
            <Button
              size="sm"
              onClick={() => setConfirmSendAll(true)}
              disabled={!canSendAll}
              className="gap-1.5"
            >
              <Send size={14} /> {sendingAll ? "Sending…" : `Send all (${validCount})`}
            </Button>
          </div>

          {!campaignName.trim() && (
            <p className="text-xs text-warning">Set a campaign name above before sending.</p>
          )}

          <div className="border border-border-light/40 rounded-xl divide-y divide-border-light/30 overflow-hidden">
            {rows.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm flex-wrap"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-semibold text-text-main truncate">
                    {r.data.name || <span className="text-text-muted italic">No name</span>}
                    {r.data.role && <span className="text-text-muted font-normal"> — {r.data.role}</span>}
                    {r.data.city && <span className="text-text-muted font-normal"> · {r.data.city}</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Input
                      size="sm"
                      type="email"
                      value={r.data.email}
                      onChange={(e) => updateRowField(i, "email", e.target.value)}
                      placeholder="email@example.com"
                      disabled={r.status === "sending" || r.status === "sent"}
                      className="!w-52 !py-1 text-xs"
                    />
                    <Input
                      size="sm"
                      value={r.data.wallSlug || ""}
                      onChange={(e) => updateRowField(i, "wallSlug", e.target.value)}
                      placeholder="wall slug, e.g. brenda-locke-mayor"
                      disabled={r.status === "sending" || r.status === "sent"}
                      className="!w-56 !py-1 text-xs"
                    />
                  </div>
                  {r.data.wallSlug?.trim() ? (
                    // The exact link fillCampaignTemplate substitutes for
                    // {{wall_url}} — shown here, clickable, so an admin can
                    // eyeball (or click through and confirm the page isn't a
                    // 404) that this row's wall_slug is right *before*
                    // sending, not after a recipient reports a broken link.
                    <a
                      href={`https://www.choseno.com/wall/${r.data.wallSlug.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink size={11} />
                      choseno.com/wall/{r.data.wallSlug.trim()}
                    </a>
                  ) : (
                    <p className="text-xs text-warning">No wall slug — the {"{{wall_url}}"} link will be blank in the email.</p>
                  )}
                  {r.error && <p className="text-xs text-danger">{r.error}</p>}
                  {r.status === "failed" && r.errorMessage && (
                    <p className="text-xs text-danger">Send error: {r.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(r.status)}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewRow(r)}
                    disabled={!!r.error}
                    className="gap-1"
                  >
                    <Eye size={13} /> Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendOne(i)}
                    disabled={!!r.error || r.status === "sending" || r.status === "sent" || !campaignName.trim() || sendingAll}
                    className="gap-1"
                  >
                    <Send size={13} /> {r.status === "sent" ? "Sent" : "Send"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {previewRow && (
        <PreviewModal record={previewRow} buildEmail={buildEmail} onClose={() => setPreviewRow(null)} />
      )}

      <ConfirmDialog
        open={confirmSendAll}
        title={`Send to ${validCount} recipient${validCount === 1 ? "" : "s"}?`}
        message={`This sends a real email to each valid recipient in "${campaignName || "Untitled Campaign"}". This can't be undone.`}
        tone="primary"
        confirmLabel="Send all"
        loading={sendingAll}
        onConfirm={runSendAll}
        onCancel={() => setConfirmSendAll(false)}
      />

      <Card padding="md" className="space-y-4 overflow-visible">
        <h2 className="font-bold text-text-main">Campaign history</h2>

        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stats.map((s) => (
              <div key={s.campaign_name} className="p-3 rounded-xl border border-border-light/30 bg-surface/40">
                <p className="text-xs font-bold text-text-main truncate">{s.campaign_name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {s.sent_count} sent · {s.failed_count} failed
                  {s.claimed_count > 0 && ` · ${s.claimed_count} claimed`}
                </p>
              </div>
            ))}
          </div>
        )}

        {loadingHistory && history.length === 0 ? (
          <Spinner />
        ) : history.length === 0 ? (
          <p className="text-sm text-text-muted">No campaign sends yet.</p>
        ) : (
          <div className="border border-border-light/40 rounded-xl divide-y divide-border-light/30 overflow-visible">
            {history.map((h) => {
              const engScore = calculateEngagementScore(h);
              const lastOpenedText = formatLastOpened(h.last_opened_at || h.opened_at);
              return (
                <div key={h.id} className="relative flex items-center justify-between gap-3 px-4 py-2.5 text-sm flex-wrap hover:bg-surface/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-main truncate">{h.politician_name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {h.politician_email} · {h.campaign_name}
                      {h.error_message && ` · ${h.error_message}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap text-xs">
                    {/* Open status with hover timestamps & forward detection */}
                    <OpenedStatusBadge send={h} />

                    {/* Time to Open */}
                    {h.first_open_time_seconds ? (
                      <span className="text-text-muted" title="Time to first open">
                        ⏱ {formatTimeToOpen(h.first_open_time_seconds)}
                      </span>
                    ) : null}

                    {/* Link Clicks with hover link details */}
                    <ClickStatusBadge send={h} />

                    {/* Wall visit */}
                    {h.wall_visited ? (
                      <Badge tone="primary">
                        Wall: {h.wall_visit_duration_seconds ? `${h.wall_visit_duration_seconds}s` : "visited"}
                      </Badge>
                    ) : null}

                    {/* Engagement Score with hover popup */}
                    <EngagementScoreBadge send={h} />

                    {historyBadge(h.status)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function PreviewModal({
  record,
  buildEmail,
  onClose,
}: {
  record: CampaignRow;
  buildEmail: (record: CampaignRow) => { subject: string; html: string };
  onClose: () => void;
}) {
  const { subject, html } = buildEmail(record);
  return (
    <div className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <Card
        variant="hero"
        padding="md"
        className="max-w-4xl w-full max-h-[92vh] overflow-y-auto space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-light/30 pb-2.5">
          <div className="min-w-0 flex-1 pr-3">
            <h3 className="font-bold text-text-main text-base truncate">Preview: {record.data.name}</h3>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              <span className="font-semibold text-text-main/80">To:</span> {record.data.email} · <span className="font-semibold text-text-main/80">Subject:</span> {subject}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="text-xs shrink-0">
            Close
          </Button>
        </div>

        <div
          className="border border-border-light/40 rounded-xl overflow-hidden shadow-sm bg-[#eef1f5] p-2 sm:p-4 text-black text-sm w-full"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="flex justify-end pt-1">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </Card>
    </div>
  );
}
