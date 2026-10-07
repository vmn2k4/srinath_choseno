"use client";

import React, { useEffect, useState } from "react";
import AdminSubNav from "./AdminSubNav";
import { getAdminSignupSourceReport, type SignupSourceReport, type SignupSourceRow } from "@/lib/services/analytics";
import { Card, Spinner, PageHeader } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

const RANGES = [7, 30, 90];

function Breakdown({ title, hint, rows, total }: { title: string; hint?: string; rows: SignupSourceRow[]; total: number }) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-text-main">{title}</h3>
      {hint && <p className="text-xs text-text-muted mb-3">{hint}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted mt-2">No data yet.</p>
      ) : (
        <ul className="space-y-1.5 mt-2">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate text-text-main" title={r.label}>{r.label}</span>
                <span className="tabular-nums text-text-muted shrink-0">
                  {r.count} · {total ? Math.round((r.count / total) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 rounded bg-primary/10 mt-0.5">
                <div className="h-1.5 rounded bg-primary" style={{ width: `${total ? (r.count / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function SignupSourcesAdminClient() {
  const [supabase] = useState(() => createClient());
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<SignupSourceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAdminSignupSourceReport(supabase, days).then((res) => {
      if (!active) return;
      setReport(res.report);
      setError(res.success ? null : res.error ?? "Failed to load");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [supabase, days]);

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader title="Signup Sources" subtitle="What brings visitors to sign up (real signups only, tracked since this feature launched)." />
      <AdminSubNav active="signup-sources" />
      <div className="flex gap-2">
        {RANGES.map((d) => (
          <button
            key={d}
            onClick={() => {
              setLoading(true);
              setDays(d);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm border ${d === days ? "bg-primary/10 border-primary/30 text-primary font-semibold" : "border-border text-text-muted"}`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error || !report ? (
        <p className="text-sm text-red-500">{error ?? "No data"}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-2xl font-bold">{report.total_signups}</div><div className="text-xs text-text-muted">Real signups</div></Card>
            <Card className="p-4"><div className="text-2xl font-bold">{report.tracked}</div><div className="text-xs text-text-muted">With source recorded</div></Card>
            <Card className="p-4"><div className="text-2xl font-bold">{report.untracked}</div><div className="text-xs text-text-muted">Before tracking / no browser data</div></Card>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Breakdown title="What they clicked to start signup" hint="Button/link text right before the auth page opened" rows={report.by_trigger} total={report.tracked} />
            <Breakdown title="Page type they were on" hint="Section of the site just before signup" rows={report.by_page_type} total={report.tracked} />
            <Breakdown title="Exact page just before signup" rows={report.by_last_page} total={report.tracked} />
            <Breakdown title="First page they landed on" rows={report.by_landing_page} total={report.tracked} />
            <Breakdown title="Where they came from" hint="External referrer on first visit" rows={report.by_referrer} total={report.tracked} />
            <Breakdown title="Signup method" rows={report.by_method} total={report.tracked} />
          </div>
          <Card className="p-4">
            <h3 className="font-semibold text-text-main mb-2">Recent signups — navigation trail</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-text-muted">
                  <tr><th className="pr-3 py-1">#</th><th className="pr-3">When</th><th className="pr-3">Clicked</th><th className="pr-3">From</th><th>Pages viewed (oldest → newest)</th></tr>
                </thead>
                <tbody>
                  {report.recent.map((r) => (
                    <tr key={r.signup_order} className="border-t border-border align-top">
                      <td className="pr-3 py-1.5">{r.signup_order}</td>
                      <td className="pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="pr-3">{r.trigger}</td>
                      <td className="pr-3">{r.referrer}</td>
                      <td className="break-all">{r.trail ?? r.landing_page ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
