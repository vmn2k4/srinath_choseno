"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { Tabs, Card, Button } from "@/components/primitives";
import RepresentationBranchTree, { RepresentationBranch } from "./RepresentationBranchTree";
import { reportContent, type ReportTargetType } from "@/lib/services/moderation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveRepresentationBranch, branchKeyFor } from "@/lib/services/elections";
import { getUserBoundaryMemberships } from "@/lib/services/profile";
import { ANON_REP_PREVIEW_LIMIT } from "@/lib/constants/site";
import { trackRepListGateShown, trackRepListGateClicked } from "@/lib/analytics/events";

// Trims branch.top/branch.bottom down to a total of `budget` people across
// ALL branches combined (tops counted first, so a signed-out visitor always
// sees the head of each branch they do get before any councillors) and
// reports how many were cut. Pure function, no rendering -- so callers that
// don't gate (the SEO-indexed /elections/[boundarySlug] page) never call it
// and pay zero cost.
function capBranchesToBudget(branches: RepresentationBranch[], budget: number) {
  let remaining = budget;
  let hidden = 0;
  const capped = branches.map((b) => {
    let top = b.top;
    if (top) {
      if (remaining > 0) remaining -= 1;
      else {
        top = null;
        hidden += 1;
      }
    }
    const bottom = remaining > 0 ? b.bottom.slice(0, remaining) : [];
    hidden += b.bottom.length - bottom.length;
    remaining -= bottom.length;
    return { ...b, top, bottom };
  });
  return { branches: capped, hidden };
}

// "All" stacks every branch (Federal, Provincial, Municipal, ...) the viewer
// has -- their own memberships plus whichever branch the boundary being
// viewed belongs to. Picking a specific tab (e.g. "Federal") narrows to just
// that branch's Prime Minister → MP tree, mirroring the Feed's own
// All Districts / Federal / Provincial / Municipal filter pills.
//
// `branches` from the server is always just the primary branch now (the
// page stopped resolving auth server-side so it can be cached -- see
// src/app/elections/[boundarySlug]/page.tsx). A signed-in visitor's OTHER
// branches (their own Provincial riding, Municipal ward, etc.) are resolved
// here instead, right after mount, using their own session, then appended
// to local state -- so "All" still shows their whole civic picture, just a
// beat later than before instead of baked into the SSR HTML.
export default function BoundaryDirectoryClient({
  branches: initialBranches,
  country,
  defaultBranchKey,
  gated = false,
}: {
  branches: RepresentationBranch[];
  country: string;
  defaultBranchKey: string;
  // Caps signed-out visitors to ANON_REP_PREVIEW_LIMIT people total, with a
  // sign-in prompt for the rest. Only pass this from surfaces that are
  // per-visitor and never crawled (e.g. /find-my-district, after the
  // visitor's own address resolves) -- never from /elections/[boundarySlug],
  // whose SSR HTML is the thing Google actually indexes for "who represents
  // me" queries. Defaults to false (fully open) for exactly that reason.
  gated?: boolean;
}) {
  const [activeKey, setActiveKey] = useState(defaultBranchKey);
  const [branches, setBranches] = useState(initialBranches);
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  // Fires the gate impression once per mount even though hiddenCount can
  // legitimately flip false->true more than once as the membership-resolve
  // effect below appends branches -- without this a single real pageview
  // would inflate "shown" counts and understate the CTA's real CTR.
  const gateShownRef = useRef(false);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      const { data: memberships } = await getUserBoundaryMemberships(supabase, user.id);
      const memberShapes = (memberships || [])
        .map((m: any) => m.map_shapes)
        .filter(
          (s: any): s is { id: number; name: string; country: string; boundary_type: string } =>
            s != null && s.country === country && !s.boundary_type.toLowerCase().includes("polling")
        );

      const seenKeys = new Set(initialBranches.map((b) => b.key));
      const shapesToResolve: typeof memberShapes = [];
      for (const memberShape of memberShapes) {
        const key = branchKeyFor(memberShape);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        shapesToResolve.push(memberShape);
      }
      if (shapesToResolve.length === 0) return;

      const resolvedBranches = await Promise.all(
        shapesToResolve.map((memberShape) => resolveRepresentationBranch(supabase, memberShape))
      );
      if (cancelled) return;
      setBranches((prev) => [...prev, ...(resolvedBranches as RepresentationBranch[])]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, country, supabase]);

  // Owns the actual reportContent RPC call (per the layered-architecture
  // rule that only page-level clients touch services) and hands it down to
  // every card in the tree below -- lets a viewer flag an office holder's
  // directory listing (name/role/party/contact info) as wrong right from
  // where they're reading it, on both the boundary directory page and
  // /find-my-district (both render through this same client).
  const handleReport = (targetType: ReportTargetType, targetId: string, abuseType: string) =>
    reportContent(supabase, targetType, targetId, abuseType);

  const tabItems = [
    { key: "all", label: "All" },
    ...branches.map((b) => ({ key: b.key, label: b.label })),
  ];

  const rawVisibleBranches = activeKey === "all" ? branches : branches.filter((b) => b.key === activeKey);

  // Capped before the wide/compact split below so that split (which counts
  // top+bottom per branch) reflects what's actually about to render, not the
  // pre-cap counts.
  const { branches: cappedBranches, hidden: hiddenCount } =
    gated && !user ? capBranchesToBudget(rawVisibleBranches, ANON_REP_PREVIEW_LIMIT) : { branches: rawVisibleBranches, hidden: 0 };

  // A branch that had people pre-cap but got trimmed down to nothing still
  // has a real districtName/label -- rendering it as-is would hit
  // RepresentationBranchTree's "No office holders recorded yet" fallback,
  // which reads as missing data rather than "sign in to see it." Drop it
  // from the grid entirely; the sign-in CTA below covers it instead.
  const visibleBranches = gated && !user ? cappedBranches.filter((b) => b.top || b.bottom.length > 0) : cappedBranches;

  // Branches with more than a top+bottom pair (e.g. a Municipal branch with
  // a Mayor plus several Councillors) need the full row so their cards can
  // wrap without being squeezed into a half-width column; a lean branch
  // (Federal PM+MP, Provincial Premier+MLA) is compact enough to sit side by
  // side with another one. This groups by shape rather than a hardcoded
  // branch key so it holds for any country's boundary types.
  const isWide = (b: RepresentationBranch) => (b.top ? 1 : 0) + b.bottom.length > 2;
  const compactBranches = visibleBranches.filter((b) => !isWide(b));
  const wideBranches = visibleBranches.filter(isWide);

  // Impression side of trackRepListGateClicked below -- fires once per
  // mount (guarded by gateShownRef, not just a dependency array -- see its
  // declaration) the first time the gate appears. Only ever true when
  // `gated` is set, which today is only FindMyDistrictClient, so
  // "find_my_district" is hardcoded rather than threaded through as a prop
  // nobody else needs yet.
  useEffect(() => {
    if (hiddenCount > 0 && !gateShownRef.current) {
      gateShownRef.current = true;
      trackRepListGateShown({ surface: "find_my_district", hiddenCount });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenCount > 0]);

  if (branches.length === 0) return null;

  const renderBranch = (branch: RepresentationBranch) => (
    <div key={branch.key} className="bg-surface/40 border border-border-light/40 rounded-2xl p-3 sm:p-4">
      <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider text-center mb-2 flex items-center justify-center gap-1.5 flex-wrap">
        <span>{branch.label}</span>
        {branch.districtName && (
          <>
            <span className="text-text-muted/50 font-normal select-none">·</span>
            <span className="text-text-main font-semibold normal-case tracking-normal">
              {branch.districtName}
            </span>
          </>
        )}
      </h3>
      <RepresentationBranchTree branch={branch} onReport={handleReport} />
    </div>
  );

  return (
    <div className="space-y-6">
      {branches.length > 1 && (
        <Tabs items={tabItems} activeKey={activeKey} onChange={setActiveKey} />
      )}

      <div className="space-y-4">
        {compactBranches.length > 0 && (
          <div className={compactBranches.length > 1 ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : ""}>
            {compactBranches.map(renderBranch)}
          </div>
        )}
        {wideBranches.map(renderBranch)}
      </div>

      {hiddenCount > 0 && (
        <Card padding="md" className="text-center space-y-2 border-primary/20 bg-primary/5">
          <p className="text-sm font-bold text-text-main">
            {hiddenCount} more representative{hiddenCount === 1 ? "" : "s"} in this area
          </p>
          <p className="text-xs text-text-muted">Sign in free to see who else represents you.</p>
          <Button
            as={Link}
            href="/auth?role=citizen&next=%2Ffind-my-district"
            onClick={() => trackRepListGateClicked({ surface: "find_my_district", hiddenCount })}
            variant="primary"
            size="sm"
            className="mx-auto"
          >
            <LogIn size={13} />
            Sign In to See the Rest
          </Button>
        </Card>
      )}
    </div>
  );
}
