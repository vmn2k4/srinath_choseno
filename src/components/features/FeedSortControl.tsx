"use client";

import { Flame } from "lucide-react";
import { Select } from "@/components/primitives";

export default function FeedSortControl({
  sortMode,
  onSortChange,
}: {
  sortMode: "recency" | "engagement";
  onSortChange: (mode: "recency" | "engagement") => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-3">
      <Flame size={12} className="text-primary shrink-0" />
      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider shrink-0">
        Sort:
      </span>
      <Select
        size="sm"
        className="!w-auto py-1.5"
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as "recency" | "engagement")}
      >
        <option value="recency">Most recent</option>
        <option value="engagement">Most engagement</option>
      </Select>
    </div>
  );
}
