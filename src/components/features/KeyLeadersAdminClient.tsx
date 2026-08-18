"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Plus, Trash2, Search, Link2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listKeyPoliticalLeaders,
  createKeyPoliticalLeader,
  updateKeyPoliticalLeader,
  deleteKeyPoliticalLeader,
  searchPoliticians,
} from "@/lib/services/politicians";
import { Card, Button, Input, Select, Textarea, Spinner, PageHeader, Badge, ConfirmDialog } from "@/components/primitives";
import AdminSubNav from "./AdminSubNav";

interface LeaderRow {
  id: string;
  full_name: string;
  role_title: string | null;
  priority: number;
  notes: string | null;
  politician_profile_id: string | null;
  office_holder_id: string | null;
  created_at: string;
}

type LinkCandidate = {
  full_name: string;
  role_title: string | null;
  jurisdiction_name: string | null;
  politician_profile_id: string | null;
  office_holder_id: string | null;
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "1 — Head of state/government",
  2: "2 — Cabinet ministers, party & opposition leaders, premiers/governors",
  3: "3 — Other high-priority figures",
};

// Admin roster behind the nav-bar search's "always float to the top"
// behavior — see search_politicians_and_officeholders RPC and
// GlobalPoliticianSearch. Seeded from NewsPrompts/KeyLeadersNewsCollectionPrompt.md's
// 30-leader list; this page is where an admin adds/removes/re-prioritizes it.
export default function KeyLeadersAdminClient() {
  const supabase = createClient();
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LeaderRow | null>(null);

  // Add-form state
  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [priority, setPriority] = useState(2);
  const [notes, setNotes] = useState("");
  const [linked, setLinked] = useState<LinkCandidate | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<LinkCandidate[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listKeyPoliticalLeaders(supabase);
    if (!error) setLeaders((data as LeaderRow[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = linkQuery.trim();
    if (trimmed.length < 2) {
      setLinkResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const { data } = await searchPoliticians(supabase, trimmed, { limit: 8 });
      setLinkResults((data as LinkCandidate[] | null) || []);
    }, 250);
  }, [linkQuery, supabase]);

  const resetForm = () => {
    setFullName("");
    setRoleTitle("");
    setPriority(2);
    setNotes("");
    setLinked(null);
    setLinkQuery("");
    setLinkResults([]);
    setLinkOpen(false);
  };

  const handlePickLink = (c: LinkCandidate) => {
    setLinked(c);
    if (!fullName.trim()) setFullName(c.full_name);
    if (!roleTitle.trim() && c.role_title) setRoleTitle(c.role_title);
    setLinkOpen(false);
    setLinkQuery("");
    setLinkResults([]);
  };

  const handleAdd = async () => {
    if (!fullName.trim()) {
      setStatus("Full name is required.");
      return;
    }
    setSaving(true);
    setStatus("");
    const { error } = await createKeyPoliticalLeader(supabase, {
      fullName: fullName.trim(),
      roleTitle: roleTitle.trim() || null,
      priority,
      notes: notes.trim() || null,
      politicianProfileId: linked?.politician_profile_id || null,
      officeHolderId: linked?.office_holder_id || null,
    });
    setSaving(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    resetForm();
    load();
  };

  const handlePriorityChange = async (leader: LeaderRow, newPriority: number) => {
    setLeaders((prev) => prev.map((l) => (l.id === leader.id ? { ...l, priority: newPriority } : l)));
    await updateKeyPoliticalLeader(supabase, leader.id, { priority: newPriority });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteKeyPoliticalLeader(supabase, deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        icon={Crown}
        title="Key Political Leaders"
        subtitle="The always-top-of-search priority roster — heads of state/government, cabinet ministers, opposition/party leaders, and premiers/governors always outrank other name matches in the nav-bar search."
      />
      <AdminSubNav active="key-leaders" />

      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Plus size={18} className="text-primary" /> Add a Key Leader
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input placeholder="Role / title (optional)" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
          <Select value={String(priority)} onChange={(e) => setPriority(Number(e.target.value))}>
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <Textarea
            placeholder="Notes (optional — e.g. why they're flagged)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
          />
        </div>

        <div className="relative">
          {linked ? (
            <div className="flex items-center justify-between gap-2 p-2.5 bg-primary/10 border border-primary/25 rounded-lg text-xs">
              <span className="flex items-center gap-1.5 text-text-main">
                <Link2 size={13} className="text-primary" />
                Linked to <strong>{linked.full_name}</strong>
                {linked.jurisdiction_name ? ` — ${linked.jurisdiction_name}` : ""}
              </span>
              <button onClick={() => setLinked(null)} className="text-text-muted hover:text-danger">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border border-border-light/30 rounded-lg px-2.5 py-2">
              <Search size={14} className="text-text-muted shrink-0" />
              <input
                value={linkQuery}
                onChange={(e) => {
                  setLinkQuery(e.target.value);
                  setLinkOpen(true);
                }}
                onFocus={() => setLinkOpen(true)}
                placeholder="Optional — search to link an existing profile/office holder for exact matching"
                className="flex-1 bg-transparent outline-none text-xs text-text-main placeholder:text-text-muted"
              />
            </div>
          )}

          {linkOpen && linkResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-surface-elevated border border-border-light/40 rounded-lg shadow-xl max-h-56 overflow-y-auto">
              {linkResults.map((c, idx) => (
                <button
                  key={`${c.politician_profile_id || c.office_holder_id || idx}`}
                  onClick={() => handlePickLink(c)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors border-b border-border-light/10 last:border-b-0"
                >
                  <div className="font-semibold text-text-main">{c.full_name}</div>
                  <div className="text-text-muted">
                    {[c.role_title, c.jurisdiction_name].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {status && <p className="text-xs text-danger">{status}</p>}

        <Button size="sm" onClick={handleAdd} disabled={saving} className="gap-1 text-xs">
          <Plus size={14} /> {saving ? "Adding..." : "Add Leader"}
        </Button>
      </Card>

      <Card padding="md" className="space-y-3">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Crown size={18} className="text-primary" /> Current Roster ({leaders.length})
        </h2>

        {loading ? (
          <Spinner />
        ) : leaders.length === 0 ? (
          <p className="text-sm text-text-muted">No key leaders yet.</p>
        ) : (
          <div className="space-y-2">
            {leaders.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface/30 border border-border-light/20 rounded-xl"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-text-main">{l.full_name}</span>
                    {(l.politician_profile_id || l.office_holder_id) ? (
                      <Badge tone="primary" size="xs" icon={<Link2 size={10} />}>
                        Linked
                      </Badge>
                    ) : (
                      <Badge tone="amber" size="xs">
                        Name only
                      </Badge>
                    )}
                  </div>
                  {l.role_title && <div className="text-xs text-text-muted">{l.role_title}</div>}
                  {l.notes && <div className="text-xs text-text-muted italic mt-0.5">{l.notes}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={String(l.priority)}
                    onChange={(e) => handlePriorityChange(l, Number(e.target.value))}
                    className="text-xs w-16"
                  >
                    {[1, 2, 3].map((p) => (
                      <option key={p} value={p}>
                        Tier {p}
                      </option>
                    ))}
                  </Select>
                  <button
                    onClick={() => setDeleteTarget(l)}
                    className="text-text-muted hover:text-danger p-1.5 cursor-pointer"
                    aria-label={`Remove ${l.full_name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.full_name || "this leader"} from the priority roster?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
