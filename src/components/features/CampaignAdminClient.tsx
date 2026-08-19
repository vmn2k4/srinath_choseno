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

function calculateEngagementScore(send: CampaignSendRow): number {
  if (typeof send.engagement_score === "number" && send.engagement_score > 0) {
    return send.engagement_score;
  }
  let score = 0;

  // Opened (40 points + bonus for multiple opens)
  if (send.opened_at || (send.opened_count && send.opened_count > 0)) {
    score += 40;
    const count = send.opened_count || 1;
    if (count > 1) {
      score += Math.min((count - 1) * 5, 10);
    }
  }

  // Time to open (10 points) - faster is better
  if (send.first_open_time_seconds) {
    if (send.first_open_time_seconds < 3600) score += 10;
    else if (send.first_open_time_seconds < 86400) score += 5;
  }

  // Link clicks (30 points)
  if (send.link_clicks && send.link_clicks > 0) {
    score += Math.min(send.link_clicks * 10, 30);
  }

  // Wall visit (20 points + bonus for 30s+)
  if (send.wall_visited) {
    score += 20;
    if (send.wall_visit_duration_seconds && send.wall_visit_duration_seconds >= 30) {
      score += 10;
    }
  }

  return Math.min(score, 100);
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

  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [previewRow, setPreviewRow] = useState<CampaignRow | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [confirmSendAll, setConfirmSendAll] = useState(false);

  const [history, setHistory] = useState<CampaignSendRow[]>([]);
  const [stats, setStats] = useState<CampaignStatsRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Search-to-add — an alternative to pasting CSV/JSON, reusing the same
  // search_politicians_and_officeholders RPC the nav-bar search
  // (GlobalPoliticianSearch) uses. The RPC itself doesn't return contact
  // info (it also serves the public nav search), so picking a result does a
  // second, admin-only lookup for the email before it's added as a row.
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
      if (myRequestId !== searchRequestIdRef.current) return; // stale — a newer keystroke fired since
      setSearchResults(error ? [] : ((data as PoliticianSearchResult[] | null) || []));
      setSearchLoading(false);
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, supabase]);

  // Adds a search result as a new recipient row. Contact email isn't in the
  // search payload, so this does one more lookup — office_holders for a
  // currently-serving official, politician_profiles for a registered
  // candidate — and pre-fills the wall slug from the result (or a best-guess
  // via buildPoliticianWallSlug when the wall doesn't exist yet).
  const addRecipientFromSearch = async (result: PoliticianSearchResult) => {
    setAddingKey(result.result_key);

    let email = "";
    if (result.office_holder_id) {
      const { data } = await getOfficeHolderContact(supabase, result.office_holder_id);
      email = data?.contact_email || "";
    } else if (result.politician_profile_id) {
      const { data } = await getPoliticianProfile(supabase, result.politician_profile_id);
      email = (data as { contact_email?: string | null } | null)?.contact_email || "";
    }

    const wallSlug = result.wall_slug || buildPoliticianWallSlug(result.full_name, result.role_title);

    setRows((prev) => [
      ...prev,
      {
        row: prev.length + 1,
        data: {
          name: result.full_name,
          email,
          role: result.role_title || "",
          city: result.jurisdiction_name || "",
          wallSlug,
        },
        error: email ? null : "No email on file — add one below before sending.",
        status: "idle",
      },
    ]);

    setAddingKey(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  };

  // Inline edits from the review table — mainly for filling in an email the
  // search lookup couldn't find, or correcting/typing the wall slug, which
  // is never auto-trusted (see CampaignRecordInput.wallSlug).
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

  const applyTemplate = (preset: (typeof CAMPAIGN_TEMPLATE_PRESETS)[number] | null) => {
    if (!preset) {
      setSubject(DEFAULT_SUBJECT);
      setBody(DEFAULT_BODY);
      return;
    }
    setSubject(preset.subject);
    setBody(preset.body);
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
      setRows(parsed.map((r) => ({ ...r, status: "idle" as RowStatus })));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't parse that input.");
      setRows([]);
    }
  };

  const buildEmail = useCallback(
    (record: CampaignRow) => {
      const filledSubject = fillCampaignTemplate(subject, record.data);
      // {{claim_link}} needs the real per-recipient link, which only exists
      // once sendCampaignInvite mints a token — for preview we show a
      // placeholder so admins can see the layout before anything is sent.
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

    // Generate unique tracking token
    const trackingToken = crypto.randomUUID();

    // Add tracking pixel to email body
    let trackedHtml = addTrackingPixelToTemplate(body, trackingToken);

    // Rewrite all links with tracking (attaching ?t=trackingToken to wall links)
    const linkRegex = /href="(https?:\/\/[^"]+)"/g;
    trackedHtml = trackedHtml.replace(linkRegex, (_match, url) => {
      let targetUrl = url;
      if (url.includes("/wall/")) {
        const sep = url.includes("?") ? "&" : "?";
        targetUrl = `${url}${sep}t=${trackingToken}`;
      }
      return `href="${createTrackedLink(targetUrl, trackingToken)}"`;
    });

    const filledSubject = fillCampaignTemplate(subject, record.data);
    // Fill template variables into the tracked HTML
    const htmlTemplate = fillCampaignTemplate(trackedHtml, record.data);

    const { error } = await sendCampaignInvite(supabase, {
      name: record.data.name,
      email: record.data.email,
      role: record.data.role,
      city: record.data.city,
      subject: filledSubject,
      htmlTemplate,
      campaignName: campaignName.trim() || "Untitled Campaign",
      redirectOrigin: window.location.origin,
      trackingToken,
    });

    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, status: error ? "failed" : "sent", errorMessage: error?.message }
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
      // Small stagger so we don't hammer the send-email function with a
      // burst of concurrent SMTP connections.
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

      <Card padding="md" className="space-y-4">
        <div>
          <h2 className="font-bold text-text-main flex items-center gap-2">
            <Upload size={17} className="text-primary" />
            1. Import recipients
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Paste CSV (<code className="text-[11px]">name,email,role,city,wall_slug</code>) or JSON
            (<code className="text-[11px]">{"[{ \"name\": ..., \"email\": ... }]"}</code>), search for someone
            already on Choseno, or upload a file.
          </p>
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
          placeholder={"name,email,role,city\nJohn Smith,john@example.com,Mayor,Vancouver\nJane Doe,jane@example.com,Councillor,Burnaby"}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          className="font-mono text-xs"
        />

        {importError && <p className="text-xs text-danger">{importError}</p>}

        <Button size="sm" onClick={handleParse} disabled={!importText.trim()}>
          Parse recipients
        </Button>

        {rows.length > 0 && (
          <p className="text-xs text-text-muted">
            {validCount} valid recipient{validCount === 1 ? "" : "s"}
            {errorCount > 0 && <span className="text-danger"> · {errorCount} with errors (won&apos;t be sent)</span>}
          </p>
        )}
      </Card>

      {rows.length > 0 && (
        <Card padding="md" className="space-y-4">
          <h2 className="font-bold text-text-main">2. Compose the email</h2>

          <div>
            <p className="text-xs font-semibold text-text-muted mb-1.5">Template</p>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_TEMPLATE_PRESETS.map((preset) => (
                <Button key={preset.key} size="sm" variant="outline" onClick={() => applyTemplate(preset)}>
                  {preset.label}
                </Button>
              ))}
            </div>
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

      {rows.length > 0 && (
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-text-main">3. Review & send</h2>
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

      <Card padding="md" className="space-y-4">
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
          <div className="border border-border-light/40 rounded-xl divide-y divide-border-light/30 overflow-hidden max-h-96 overflow-y-auto">
            {history.map((h) => {
              const engScore = calculateEngagementScore(h);
              const lastOpenedText = formatLastOpened(h.last_opened_at || h.opened_at);
              return (
                <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-main truncate">{h.politician_name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {h.politician_email} · {h.campaign_name}
                      {h.error_message && ` · ${h.error_message}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap text-xs">
                    {/* Open status */}
                    {h.opened_at || (h.opened_count && h.opened_count > 0) ? (
                      <span title={h.last_opened_at || h.opened_at || ""}>
                        <Badge tone="emerald">
                          ✓ Opened {h.opened_count || 1}x {lastOpenedText ? `(${lastOpenedText})` : ""}
                        </Badge>
                      </span>
                    ) : (
                      <Badge tone="neutral">Unopened</Badge>
                    )}

                    {/* Time to Open */}
                    {h.first_open_time_seconds ? (
                      <span className="text-text-muted" title="Time to first open">
                        ⏱ {formatTimeToOpen(h.first_open_time_seconds)}
                      </span>
                    ) : null}

                    {/* Link Clicks */}
                    {h.link_clicks && h.link_clicks > 0 ? (
                      <Badge tone="accent">{h.link_clicks} {h.link_clicks === 1 ? "click" : "clicks"}</Badge>
                    ) : null}

                    {/* Wall visit */}
                    {h.wall_visited ? (
                      <Badge tone="primary">
                        Wall: {h.wall_visit_duration_seconds ? `${h.wall_visit_duration_seconds}s` : "visited"}
                      </Badge>
                    ) : null}

                    {/* Engagement Score */}
                    <div className="flex items-center gap-1.5" title={`Engagement Score: ${engScore}/100`}>
                      <div className="w-12 h-1.5 bg-border-light/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${engScore}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-text-muted">{engScore}/100</span>
                    </div>

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
    <div className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <Card
        variant="hero"
        padding="lg"
        className="max-w-lg w-full max-h-[80vh] overflow-y-auto space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-text-main">Preview: {record.data.name}</h3>
        <p className="text-xs text-text-muted">
          <span className="font-semibold">To:</span> {record.data.email}
        </p>
        <p className="text-xs text-text-muted">
          <span className="font-semibold">Subject:</span> {subject}
        </p>
        <div
          className="border border-border-light/30 rounded-lg p-4 bg-white text-black text-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
