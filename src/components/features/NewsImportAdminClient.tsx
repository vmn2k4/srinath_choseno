"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import AdminSubNav from "./AdminSubNav";
import { getCountries } from "@/lib/services/boundaries";
import { getAllElectionRoleTypesForCountry, getOfficeHoldersByRoleTypeIds } from "@/lib/services/elections";
import { Newspaper, Play, Square, CheckCircle2, XCircle, SkipForward, Loader2 } from "lucide-react";
import { Card, Button, Select, Checkbox, PageHeader, Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────

interface RoleTypeRow {
  id: string;
  boundary_type: string;
  role_key: string;
  region_override: string;
  role_title: string;
}

interface HolderRow {
  id: string;
  full_name: string;
  linked_profile_id: string | null;
  map_shapes: { id: number; name: string; boundary_type: string; country: string } | null;
  election_role_types: { role_title: string; role_key: string } | null;
}

type RunStatus = "idle" | "running" | "done" | "error" | "skipped";

interface RunResult {
  holderId: string;
  status: RunStatus;
  createdCount?: number;
  duplicateCount?: number;
  failedCount?: number;
  message?: string;
}

type TimeRangePreset = "week" | "month" | "3months" | "year" | "custom";

const TIME_RANGE_PRESETS: { key: TimeRangePreset; label: string; days: number | null }[] = [
  { key: "week", label: "Past week", days: 7 },
  { key: "month", label: "Past month", days: 30 },
  { key: "3months", label: "Past 3 months", days: 90 },
  { key: "year", label: "Past year", days: 365 },
  { key: "custom", label: "Custom range", days: null },
];

/** role_key -> a friendlier collective label than the raw key, for the checkbox tree. Falls back to role_title of whichever row matches when no override is listed here. */
const ROLE_KEY_QUICK_LABELS: Record<string, string> = {
  mp: "All MPs",
  provincial_rep: "All MLAs / MPPs / MNAs / MHAs",
  premier: "All Premiers",
  prime_minister: "Prime Minister",
  mayor: "All Mayors",
  councillor: "All Councillors",
  council_member: "All Council Members",
  us_representative: "All U.S. Representatives",
  state_senator: "All State Senators",
  state_representative: "All State Representatives",
  president: "President",
};

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function NewsImportAdminClient() {
  const supabase = createClient();

  // ── Scope selector (country -> boundary type -> role_key), same idea as
  // BoundaryVisualizerClient's country/entityType checkbox tree ──────────
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [roleTypes, setRoleTypes] = useState<RoleTypeRow[]>([]);
  const [loadingRoleTypes, setLoadingRoleTypes] = useState(false);
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<Set<string>>(new Set()); // keyed by `${boundary_type}::${role_key}`

  // ── Matched officials preview (declared here, ahead of the country-change
  // effect below that resets it, so that reset isn't referencing state
  // before its own declaration) ───────────────────────────────────────────
  const [matchedHolders, setMatchedHolders] = useState<HolderRow[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedHolderIds, setSelectedHolderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCountries(supabase).then(({ data }) => setCountries((data || []).map((c: { name: string }) => c.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading the role-type tree for the newly selected country -- pulled into
  // its own callback (rather than inlined in the effect below) so the
  // effect body never calls setState directly, same pattern as
  // OfficeHoldersAdminClient's loadSelfRequests/loadRecentClaims.
  const loadRoleTypesForCountry = useCallback(
    async (selectedCountry: string) => {
      setSelectedRoleKeys(new Set());
      setRoleTypes([]);
      setMatchedHolders(null);
      if (!selectedCountry) return;
      setLoadingRoleTypes(true);
      const { data } = await getAllElectionRoleTypesForCountry(supabase, selectedCountry);
      setRoleTypes((data as RoleTypeRow[]) || []);
      setLoadingRoleTypes(false);
    },
    [supabase]
  );

  useEffect(() => {
    // Indirected through a locally-defined async function (rather than
    // calling loadRoleTypesForCountry directly) -- same idiom
    // OfficeHoldersAdminClient's initialLoad() uses for the same reason.
    async function run() {
      await loadRoleTypesForCountry(country);
    }
    run();
  }, [country, loadRoleTypesForCountry]);

  // Group role rows by boundary_type -> role_key (collapsing region_override
  // variants like MLA/MPP/MNA/MHA, which all share role_key='provincial_rep',
  // into a single checkbox — "select all provincial reps" should mean all of
  // them regardless of what a given province calls the seat).
  const roleTree = useMemo(() => {
    const byBoundaryType = new Map<string, Map<string, { ids: string[]; titles: Set<string> }>>();
    roleTypes.forEach((r) => {
      if (!byBoundaryType.has(r.boundary_type)) byBoundaryType.set(r.boundary_type, new Map());
      const byRoleKey = byBoundaryType.get(r.boundary_type)!;
      if (!byRoleKey.has(r.role_key)) byRoleKey.set(r.role_key, { ids: [], titles: new Set() });
      const entry = byRoleKey.get(r.role_key)!;
      entry.ids.push(r.id);
      entry.titles.add(r.role_title);
    });
    return byBoundaryType;
  }, [roleTypes]);

  const roleKeyId = (boundaryType: string, roleKey: string) => `${boundaryType}::${roleKey}`;

  const selectedRoleTypeIds = useMemo(() => {
    const ids: string[] = [];
    roleTree.forEach((byRoleKey, boundaryType) => {
      byRoleKey.forEach((entry, roleKey) => {
        if (selectedRoleKeys.has(roleKeyId(boundaryType, roleKey))) ids.push(...entry.ids);
      });
    });
    return ids;
  }, [roleTree, selectedRoleKeys]);

  const toggleRoleKey = (boundaryType: string, roleKey: string) => {
    setSelectedRoleKeys((prev) => {
      const next = new Set(prev);
      const key = roleKeyId(boundaryType, roleKey);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllRoleKeys = () => {
    const allKeys: string[] = [];
    roleTree.forEach((byRoleKey, boundaryType) => byRoleKey.forEach((_v, roleKey) => allKeys.push(roleKeyId(boundaryType, roleKey))));
    setSelectedRoleKeys((prev) => (prev.size === allKeys.length ? new Set() : new Set(allKeys)));
  };

  // ── Time range ───────────────────────────────────────────────────────
  const [rangePreset, setRangePreset] = useState<TimeRangePreset>("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const to = isoDateOnly(now);
    if (rangePreset === "custom") {
      return { fromDate: customFrom, toDate: customTo || to };
    }
    const preset = TIME_RANGE_PRESETS.find((p) => p.key === rangePreset);
    const from = new Date(now);
    from.setDate(from.getDate() - (preset?.days ?? 365));
    return { fromDate: isoDateOnly(from), toDate: to };
  }, [rangePreset, customFrom, customTo]);

  // ── Status for the run ───────────────────────────────────────────────
  const [runStatus, setRunStatus] = useState<"draft" | "published">("published");

  const handleFindMatches = async () => {
    if (!selectedRoleTypeIds.length) return;
    setLoadingMatches(true);
    setMatchedHolders(null);
    const { data } = await getOfficeHoldersByRoleTypeIds(supabase, selectedRoleTypeIds);
    const holders = (data as unknown as HolderRow[]) || [];
    setMatchedHolders(holders);
    // Default-select everyone who has a linked profile — an officeholder
    // without one can't be tagged to a wall at all, so there's nothing
    // useful to generate for them (see the disabled row + note below).
    setSelectedHolderIds(new Set(holders.filter((h) => h.linked_profile_id).map((h) => h.id)));
    setLoadingMatches(false);
  };

  const toggleHolder = (id: string) => {
    setSelectedHolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllHolders = () => {
    const eligible = (matchedHolders || []).filter((h) => h.linked_profile_id).map((h) => h.id);
    setSelectedHolderIds((prev) => (prev.size === eligible.length ? new Set() : new Set(eligible)));
  };

  // ── Generation run (sequential, client-driven — see api/admin/news-import/generate) ──
  const [results, setResults] = useState<Map<string, RunResult>>(new Map());
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  const selectedHolders = useMemo(
    () => (matchedHolders || []).filter((h) => selectedHolderIds.has(h.id)),
    [matchedHolders, selectedHolderIds]
  );

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleGenerate = async () => {
    if (!selectedHolders.length || running) return;
    setRunning(true);
    cancelRef.current = false;
    setResults(new Map());

    for (const holder of selectedHolders) {
      if (cancelRef.current) {
        setResults((prev) => new Map(prev).set(holder.id, { holderId: holder.id, status: "skipped", message: "Cancelled" }));
        continue;
      }
      setResults((prev) => new Map(prev).set(holder.id, { holderId: holder.id, status: "running" }));

      try {
        const res = await fetch("/api/admin/news-import/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            politicianId: holder.linked_profile_id,
            politicianName: holder.full_name,
            fromDate,
            toDate,
            status: runStatus,
          }),
        });
        const json = await res.json();

        if (!res.ok) {
          setResults((prev) => new Map(prev).set(holder.id, { holderId: holder.id, status: "error", message: json.error || `HTTP ${res.status}` }));
        } else {
          setResults((prev) =>
            new Map(prev).set(holder.id, {
              holderId: holder.id,
              status: "done",
              createdCount: json.created?.length ?? 0,
              duplicateCount: json.duplicates?.length ?? 0,
              failedCount: json.failed?.length ?? 0,
              message: json.message,
            })
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setResults((prev) => new Map(prev).set(holder.id, { holderId: holder.id, status: "error", message }));
      }

      // Gentle pacing between Grok calls.
      await sleep(800);
    }

    setRunning(false);
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const summary = useMemo(() => {
    let created = 0, duplicates = 0, failed = 0, errored = 0, done = 0;
    results.forEach((r) => {
      if (r.status === "done") {
        done++;
        created += r.createdCount ?? 0;
        duplicates += r.duplicateCount ?? 0;
        failed += r.failedCount ?? 0;
      }
      if (r.status === "error") errored++;
    });
    return { created, duplicates, failed, errored, done };
  }, [results]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <AdminSubNav active="news-import" className="mb-6" />
      <PageHeader
        icon={Newspaper}
        title="Bulk News Import"
        subtitle="Generate backdated news coverage for many office holders at once — tagged to their walls automatically, duplicate-safe on re-runs."
      />

      {/* Step 1: Scope */}
      <Card className="p-5 mb-4">
        <h2 className="font-semibold text-text-main mb-3">1. Choose scope</h2>
        <Select value={country} onChange={(e) => setCountry(e.target.value)} className="mb-4 max-w-xs">
          <option value="">Select a country…</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>

        {loadingRoleTypes && <Spinner size="sm" />}

        {!loadingRoleTypes && country && roleTree.size > 0 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={toggleAllRoleKeys}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {selectedRoleKeys.size > 0 ? "Deselect all" : "Select all"}
            </button>

            {Array.from(roleTree.entries()).map(([boundaryType, byRoleKey]) => (
              <div key={boundaryType} className="border border-border-light/40 rounded-lg p-3">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{boundaryType}</div>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {Array.from(byRoleKey.entries()).map(([roleKey, entry]) => (
                    <Checkbox
                      key={roleKey}
                      label={ROLE_KEY_QUICK_LABELS[roleKey] || Array.from(entry.titles).join(" / ")}
                      checked={selectedRoleKeys.has(roleKeyId(boundaryType, roleKey))}
                      onChange={() => toggleRoleKey(boundaryType, roleKey)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingRoleTypes && country && roleTree.size === 0 && (
          <p className="text-sm text-text-muted">No role types registered for {country} yet.</p>
        )}
      </Card>

      {/* Step 2: Time range */}
      <Card className="p-5 mb-4">
        <h2 className="font-semibold text-text-main mb-3">2. Time range (backdated import)</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {TIME_RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setRangePreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                rangePreset === p.key
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "border-border-light/40 text-text-muted hover:bg-surface-hover"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {rangePreset === "custom" && (
          <div className="flex gap-3 items-center">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="border border-border-light/40 rounded-lg px-3 py-1.5 text-sm bg-surface"
            />
            <span className="text-text-muted text-sm">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border border-border-light/40 rounded-lg px-3 py-1.5 text-sm bg-surface"
            />
          </div>
        )}
        <p className="text-xs text-text-muted mt-2">
          Range: <strong>{fromDate || "—"}</strong> to <strong>{toDate}</strong>. Articles are dated to when the real event happened within this range (event_date), and published_at is set to match — they&rsquo;ll appear at their true historical position, not today.
        </p>
      </Card>

      {/* Step 3: Find matches */}
      <Card className="p-5 mb-4">
        <h2 className="font-semibold text-text-main mb-3">3. Find matching officials</h2>
        <Button onClick={handleFindMatches} disabled={!selectedRoleTypeIds.length || loadingMatches}>
          {loadingMatches ? <Spinner size="sm" /> : `Find officials (${selectedRoleTypeIds.length ? selectedRoleTypeIds.length + " role type(s) selected" : "select a role above"})`}
        </Button>

        {matchedHolders !== null && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-muted">
                {matchedHolders.length} matched, {selectedHolderIds.size} selected
              </span>
              <button type="button" onClick={toggleAllHolders} className="text-xs font-semibold text-primary hover:underline">
                {selectedHolderIds.size > 0 ? "Deselect all" : "Select all eligible"}
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto border border-border-light/30 rounded-lg divide-y divide-border-light/20">
              {matchedHolders.map((h) => {
                const result = results.get(h.id);
                return (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={selectedHolderIds.has(h.id)}
                        onChange={() => toggleHolder(h.id)}
                        disabled={!h.linked_profile_id}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-text-main truncate">{h.full_name}</div>
                        <div className="text-xs text-text-muted truncate">
                          {h.election_role_types?.role_title} — {h.map_shapes?.name}
                          {!h.linked_profile_id && <span className="text-amber-600"> · No linked profile, cannot generate</span>}
                        </div>
                      </div>
                    </div>
                    {result && <RunResultBadge result={result} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Step 4: Generate */}
      <Card className="p-5">
        <h2 className="font-semibold text-text-main mb-3">4. Generate</h2>
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-text-secondary">Insert as:</label>
          <Select value={runStatus} onChange={(e) => setRunStatus(e.target.value as "draft" | "published")} className="max-w-[160px]">
            <option value="published">Published (live now)</option>
            <option value="draft">Draft (review first)</option>
          </Select>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleGenerate} disabled={!selectedHolders.length || running} className="gap-2">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Generate for {selectedHolders.length} selected
          </Button>
          {running && (
            <Button onClick={handleCancel} variant="secondary" className="gap-2">
              <Square size={16} /> Cancel
            </Button>
          )}
        </div>

        {results.size > 0 && (
          <div className="mt-4 text-sm text-text-secondary space-y-1">
            <div>✅ {summary.done} processed — {summary.created} articles created, {summary.duplicates} already-covered (skipped), {summary.failed} failed validation</div>
            {summary.errored > 0 && <div className="text-red-600">❌ {summary.errored} politicians hit a hard error (see rows above)</div>}
            {!running && <div className="text-text-muted">Done. {runStatus === "draft" ? "Review drafts at /admin/news." : "Live articles are now on each politician's wall."}</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

function RunResultBadge({ result }: { result: RunResult }) {
  if (result.status === "running") return <Loader2 size={14} className="animate-spin text-primary" />;
  if (result.status === "skipped") return <span className="text-xs text-text-muted flex items-center gap-1"><SkipForward size={14} /> Skipped</span>;
  if (result.status === "error") return <span title={result.message} className="text-xs text-red-600 flex items-center gap-1"><XCircle size={14} /> Error</span>;
  if (result.status === "done") {
    return (
      <span title={result.message} className="text-xs text-green-600 flex items-center gap-1">
        <CheckCircle2 size={14} /> +{result.createdCount ?? 0}
        {(result.duplicateCount ?? 0) > 0 && <span className="text-text-muted">({result.duplicateCount} dup)</span>}
      </span>
    );
  }
  return null;
}
