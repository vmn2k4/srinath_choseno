"use client";

import { ArrowUpDown, CalendarRange } from "lucide-react";
import { Select } from "@/components/primitives";

export type NewsFeedSortMode = "recent" | "engagement" | "interesting";
export type NewsFeedTimeRange = "2d" | "week" | "month";

// Sort + time-range controls for NewsInfiniteFeed -- same small
// icon-label-Select shape as FeedSortControl (the social /feed's own sort
// control), kept as its own file for the same reason that one is: two
// independent dropdowns that belong together visually but shouldn't bloat
// the feed component itself.
export default function NewsFeedControls({
  sortMode,
  onSortChange,
  timeRange,
  onTimeRangeChange,
}: {
  sortMode: NewsFeedSortMode;
  onSortChange: (mode: NewsFeedSortMode) => void;
  timeRange: NewsFeedTimeRange;
  onTimeRangeChange: (range: NewsFeedTimeRange) => void;
}) {
  return (
    <div className="flex items-center gap-4 flex-wrap pb-1">
      <div className="flex items-center gap-2">
        <ArrowUpDown size={12} className="text-primary shrink-0" />
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider shrink-0">Sort:</span>
        <Select
          size="sm"
          className="!w-auto py-1.5"
          value={sortMode}
          onChange={(e) => onSortChange(e.target.value as NewsFeedSortMode)}
        >
          <option value="recent">Most recent</option>
          <option value="engagement">Most engagement</option>
          <option value="interesting">Interesting stories</option>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <CalendarRange size={12} className="text-primary shrink-0" />
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider shrink-0">Show:</span>
        <Select
          size="sm"
          className="!w-auto py-1.5"
          value={timeRange}
          onChange={(e) => onTimeRangeChange(e.target.value as NewsFeedTimeRange)}
        >
          <option value="2d">Last 2 days</option>
          <option value="week">Last week</option>
          <option value="month">Last month</option>
        </Select>
      </div>
    </div>
  );
}
