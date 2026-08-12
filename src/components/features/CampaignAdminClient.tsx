"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { Card, Button, Input, Textarea, Spinner, PageHeader, Badge, ConfirmDialog } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import {
  parseCampaignInput,
  fillCampaignTemplate,
  type ParsedCampaignRecord,
} from "@/lib/utils/campaignImport";
import {
  sendCampaignInvite,
  listCampaignSends,
  getCampaignStats,
  type CampaignSendRow,
  type CampaignStatsRow,
} from "@/lib/services/campaigns";

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

    const filledSubject = fillCampaignTemplate(subject, record.data);
    // Leave {{claim_link}} unresolved here — sendCampaignInvite mints the
    // token and substitutes it in one place, so the link actually emailed
    // always matches the claim_link logged to the database.
    const htmlTemplate = fillCampaignTemplate(body, record.data);

    const { error } = await sendCampaignInvite(supabase, {
      name: record.data.name,
      email: record.data.email,
      role: record.data.role,
      city: record.data.city,
      subject: filledSubject,
      htmlTemplate,
      campaignName: campaignName.trim() || "Untitled Campaign",
      redirectOrigin: window.location.origin,
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
            Paste CSV (<code className="text-[11px]">name,email,role,city</code>) or JSON
            (<code className="text-[11px]">{"[{ \"name\": ..., \"email\": ... }]"}</code>), or upload a file.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border-light/40 hover:bg-surface-hover transition-colors">
            <FileJson size={13} />
            Upload .csv or .json
            <input type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

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
            Body (HTML) — use {"{{first_name}}"}, {"{{name}}"}, {"{{role}}"}, {"{{city}}"}, {"{{claim_link}}"}
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
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-main truncate">
                    {r.data.name || <span className="text-text-muted italic">No name</span>}
                    {r.data.role && <span className="text-text-muted font-normal"> — {r.data.role}</span>}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {r.data.email || <span className="italic">No email</span>}
                    {r.data.city && ` · ${r.data.city}`}
                  </p>
                  {r.error && <p className="text-xs text-danger mt-0.5">{r.error}</p>}
                  {r.status === "failed" && r.errorMessage && (
                    <p className="text-xs text-danger mt-0.5">Send error: {r.errorMessage}</p>
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
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-text-main truncate">{h.politician_name}</p>
                  <p className="text-xs text-text-muted truncate">
                    {h.politician_email} · {h.campaign_name}
                    {h.error_message && ` · ${h.error_message}`}
                  </p>
                </div>
                {historyBadge(h.status)}
              </div>
            ))}
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
