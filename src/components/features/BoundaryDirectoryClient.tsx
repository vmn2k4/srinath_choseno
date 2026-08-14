"use client";

import { useState } from "react";
import { Tabs } from "@/components/primitives";
import RepresentationBranchTree, { RepresentationBranch } from "./RepresentationBranchTree";

// "All" stacks every branch (Federal, Provincial, Municipal, ...) the viewer
// has -- their own memberships plus whichever branch the boundary being
// viewed belongs to. Picking a specific tab (e.g. "Federal") narrows to just
// that branch's Prime Minister → MP tree, mirroring the Feed's own
// All Districts / Federal / Provincial / Municipal filter pills.
export default function BoundaryDirectoryClient({
  branches,
  defaultBranchKey,
}: {
  branches: RepresentationBranch[];
  defaultBranchKey: string;
}) {
  const [activeKey, setActiveKey] = useState(defaultBranchKey);

  if (branches.length === 0) return null;

  const tabItems = [
    { key: "all", label: "All" },
    ...branches.map((b) => ({ key: b.key, label: b.label })),
  ];

  const visibleBranches = activeKey === "all" ? branches : branches.filter((b) => b.key === activeKey);

  // Branches with more than a top+bottom pair (e.g. a Municipal branch with
  // a Mayor plus several Councillors) need the full row so their cards can
  // wrap without being squeezed into a half-width column; a lean branch
  // (Federal PM+MP, Provincial Premier+MLA) is compact enough to sit side by
  // side with another one. This groups by shape rather than a hardcoded
  // branch key so it holds for any country's boundary types.
  const isWide = (b: RepresentationBranch) => (b.top ? 1 : 0) + b.bottom.length > 2;
  const compactBranches = visibleBranches.filter((b) => !isWide(b));
  const wideBranches = visibleBranches.filter(isWide);

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
      <RepresentationBranchTree branch={branch} />
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
    </div>
  );
}
