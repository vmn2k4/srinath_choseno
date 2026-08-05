"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminSubNav from "./AdminSubNav";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import {
  getModerationQueue,
  getModerationRules,
  adminRemoveContent,
  adminDismissReports,
  adminUpdateModerationRule,
  type ReportTargetType,
} from "@/lib/services/moderation";
import {
  getPlatformRuleSettings,
  updatePlatformRuleSettings,
  type PlatformRuleSettings,
} from "@/lib/services/settings";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Spinner,
  PageHeader,
  ConfirmDialog,
} from "@/components/primitives";
import { ShieldAlert, Trash2, Check, Settings2, Sliders } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface QueueRow {
  target_type: ReportTargetType;
  target_id: string;
  abuse_type: string;
  report_count: number;
  last_reported_at: string | null;
  is_removed: boolean;
  content_snippet: string | null;
  author_label: string | null;
}

interface RuleRow {
  abuse_type: string;
  label: string;
  auto_remove_threshold: number;
  score_penalty: number;
  enabled: boolean;
}

export default function ModerationPageClient() {
  const supabase = createClient();

  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterAbuseType, setFilterAbuseType] = useState("all");
  const [minReports, setMinReports] = useState("");

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [ruleEdits, setRuleEdits] = useState<Record<string, { auto_remove_threshold: string; score_penalty: string; enabled: boolean }>>({});
  const [ruleStatus, setRuleStatus] = useState("");

  const [confirmRemove, setConfirmRemove] = useState<QueueRow | null>(null);

  const [ruleSettingsEdit, setRuleSettingsEdit] = useState<Record<keyof PlatformRuleSettings, string>>({
    comment_cooldown_days: "",
    politician_daily_post_limit: "",
    story_strip_hours: "",
  });
  const [loadingRuleSettings, setLoadingRuleSettings] = useState(true);
  const [ruleSettingsStatus, setRuleSettingsStatus] = useState("");

  const fetchQueue = async () => {
    if (queue.length > 0) setLoadingQueue(true);
    const { data } = await getModerationQueue(supabase);
    setQueue((data as unknown as QueueRow[]) || []);
    setLoadingQueue(false);
  };

  const fetchRules = async () => {
    if (rules.length > 0) setLoadingRules(true);
    const { data } = await getModerationRules(supabase, { includeDisabled: true });
    const rows = (data as unknown as RuleRow[]) || [];
    setRules(rows);
    setRuleEdits(
      Object.fromEntries(
        rows.map((r) => [
          r.abuse_type,
          { auto_remove_threshold: String(r.auto_remove_threshold), score_penalty: String(r.score_penalty), enabled: r.enabled },
        ])
      )
    );
    setLoadingRules(false);
  };

  const fetchRuleSettings = async () => {
    setLoadingRuleSettings(true);
    const { data } = await getPlatformRuleSettings(supabase);
    if (data) {
      setRuleSettingsEdit({
        comment_cooldown_days: String(data.comment_cooldown_days),
        politician_daily_post_limit: String(data.politician_daily_post_limit),
        story_strip_hours: String(data.story_strip_hours),
      });
    }
    setLoadingRuleSettings(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQueue();
    fetchRules();
    fetchRuleSettings();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredQueue = useMemo(() => {
    const min = parseInt(minReports, 10);
    return queue.filter((row) => {
      if (filterType !== "all" && row.target_type !== filterType) return false;
      if (filterAbuseType !== "all" && row.abuse_type !== filterAbuseType) return false;
      if (!isNaN(min) && row.report_count < min) return false;
      return true;
    });
  }, [queue, filterType, filterAbuseType, minReports]);

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    await adminRemoveContent(supabase, confirmRemove.target_type, confirmRemove.target_id, confirmRemove.abuse_type);
    setConfirmRemove(null);
    fetchQueue();
  };

  const handleDismiss = async (row: QueueRow) => {
    await adminDismissReports(supabase, row.target_type, row.target_id, row.abuse_type);
    fetchQueue();
  };

  const handleSaveRule = async (abuseType: string) => {
    const edit = ruleEdits[abuseType];
    if (!edit) return;
    setRuleStatus("");
    const threshold = parseInt(edit.auto_remove_threshold, 10);
    const penalty = parseInt(edit.score_penalty, 10);
    if (isNaN(threshold) || isNaN(penalty)) {
      setRuleStatus("Error: threshold and penalty must be numbers.");
      return;
    }
    await adminUpdateModerationRule(supabase, abuseType, threshold, penalty, edit.enabled);
    setRuleStatus(`Saved rule for "${abuseType}".`);
    fetchRules();
  };

  const handleSaveRuleSettings = async () => {
    setRuleSettingsStatus("");
    const parsed = {
      comment_cooldown_days: parseInt(ruleSettingsEdit.comment_cooldown_days, 10),
      politician_daily_post_limit: parseInt(ruleSettingsEdit.politician_daily_post_limit, 10),
      story_strip_hours: parseInt(ruleSettingsEdit.story_strip_hours, 10),
    };
    if (Object.values(parsed).some((n) => isNaN(n) || n <= 0)) {
      setRuleSettingsStatus("Error: all values must be positive numbers.");
      return;
    }
    const { error } = await updatePlatformRuleSettings(supabase, parsed);
    if (error) {
      setRuleSettingsStatus("Error: failed to save settings.");
      return;
    }
    setRuleSettingsStatus("Saved.");
    fetchRuleSettings();
  };

  const authorFor = (row: QueueRow) =>
    row.target_type === "politician_profile" ? row.author_label || "Unknown" : getGhostDisplayName(row.author_label);

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader
        title="Moderation"
        subtitle="Review flagged content, remove or dismiss reports, and tune auto-removal rules."
      />

      <AdminSubNav active="moderation" />

      {/* Platform Rules */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Sliders size={18} className="text-primary" /> Platform Rules
        </h2>

        {ruleSettingsStatus && <p className="text-xs text-text-secondary">{ruleSettingsStatus}</p>}

        {loadingRuleSettings ? (
          <Spinner />
        ) : (
          <div className="flex flex-wrap gap-4 items-end text-xs">
            <label className="flex flex-col gap-1 text-text-muted">
              Comment cooldown (days)
              <Input
                type="number"
                value={ruleSettingsEdit.comment_cooldown_days}
                onChange={(e) =>
                  setRuleSettingsEdit((prev) => ({ ...prev, comment_cooldown_days: e.target.value }))
                }
                className="w-28 text-xs"
              />
            </label>

            <label className="flex flex-col gap-1 text-text-muted">
              Politician posts / day
              <Input
                type="number"
                value={ruleSettingsEdit.politician_daily_post_limit}
                onChange={(e) =>
                  setRuleSettingsEdit((prev) => ({ ...prev, politician_daily_post_limit: e.target.value }))
                }
                className="w-28 text-xs"
              />
            </label>

            <label className="flex flex-col gap-1 text-text-muted">
              Story strip lifetime (hours)
              <Input
                type="number"
                value={ruleSettingsEdit.story_strip_hours}
                onChange={(e) =>
                  setRuleSettingsEdit((prev) => ({ ...prev, story_strip_hours: e.target.value }))
                }
                className="w-28 text-xs"
              />
            </label>

            <Button size="sm" onClick={handleSaveRuleSettings}>
              Save
            </Button>
          </div>
        )}
      </Card>

      {/* Report Queue */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <ShieldAlert size={18} className="text-primary" /> Report Queue
        </h2>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-xs w-44">
            <option value="all">All Types</option>
            <option value="post">Post</option>
            <option value="comment">Comment</option>
            <option value="politician_profile">Politician Profile</option>
          </Select>
          <Select value={filterAbuseType} onChange={(e) => setFilterAbuseType(e.target.value)} className="text-xs w-44">
            <option value="all">All Abuse Types</option>
            {rules.map((r) => (
              <option key={r.abuse_type} value={r.abuse_type}>
                {r.label}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            placeholder="Min reports"
            value={minReports}
            onChange={(e) => setMinReports(e.target.value)}
            className="text-xs w-32"
          />
        </div>

        {loadingQueue ? (
          <Spinner />
        ) : filteredQueue.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">No open reports match these filters.</p>
        ) : (
          <div className="space-y-2">
            {filteredQueue.map((row) => (
              <div
                key={`${row.target_type}-${row.target_id}-${row.abuse_type}`}
                className="p-3 bg-surface/30 rounded-xl border border-border-light/20 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone="primary" className="capitalize">
                      {row.target_type.replace("_", " ")}
                    </Badge>
                    <Badge tone="amber">{row.abuse_type}</Badge>
                    <span className="font-bold text-text-main">{row.report_count} report(s)</span>
                    {row.is_removed && <Badge tone="rose">Already Removed</Badge>}
                  </div>
                  <p className="text-text-secondary mt-1 truncate">
                    <span className="font-mono text-text-muted">{authorFor(row)}</span>
                    {row.content_snippet ? ` — ${row.content_snippet}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleDismiss(row)} className="gap-1">
                    <Check size={12} /> Dismiss
                  </Button>
                  {row.target_type !== "politician_profile" && !row.is_removed && (
                    <Button variant="danger" size="sm" onClick={() => setConfirmRemove(row)} className="gap-1">
                      <Trash2 size={12} /> Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Moderation Rules */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Settings2 size={18} className="text-primary" /> Moderation Rules
        </h2>

        {ruleStatus && <p className="text-xs text-text-secondary">{ruleStatus}</p>}

        {loadingRules ? (
          <Spinner />
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => {
              const edit = ruleEdits[rule.abuse_type] || {
                auto_remove_threshold: String(rule.auto_remove_threshold),
                score_penalty: String(rule.score_penalty),
                enabled: rule.enabled,
              };
              return (
                <div
                  key={rule.abuse_type}
                  className="p-3 bg-surface/30 rounded-xl border border-border-light/20 flex items-center gap-3 flex-wrap text-xs"
                >
                  <span className="font-bold text-text-main w-32 shrink-0">{rule.label}</span>

                  <label className="flex items-center gap-1.5 text-text-muted">
                    Auto-remove at
                    <Input
                      type="number"
                      value={edit.auto_remove_threshold}
                      onChange={(e) =>
                        setRuleEdits((prev) => ({
                          ...prev,
                          [rule.abuse_type]: { ...edit, auto_remove_threshold: e.target.value },
                        }))
                      }
                      className="w-20 text-xs"
                    />
                    reports
                  </label>

                  <label className="flex items-center gap-1.5 text-text-muted">
                    Score penalty
                    <Input
                      type="number"
                      value={edit.score_penalty}
                      onChange={(e) =>
                        setRuleEdits((prev) => ({
                          ...prev,
                          [rule.abuse_type]: { ...edit, score_penalty: e.target.value },
                        }))
                      }
                      className="w-20 text-xs"
                    />
                  </label>

                  <label className="flex items-center gap-1.5 text-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edit.enabled}
                      onChange={(e) =>
                        setRuleEdits((prev) => ({
                          ...prev,
                          [rule.abuse_type]: { ...edit, enabled: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                    Enabled
                  </label>

                  <Button size="sm" onClick={() => handleSaveRule(rule.abuse_type)} className="ml-auto">
                    Save
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove this content?"
        message={`This will soft-delete the ${confirmRemove?.target_type} and apply the "${confirmRemove?.abuse_type}" score penalty to its author. This can be reviewed later but won't show in the feed anymore.`}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
