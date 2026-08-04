"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// New primitive — the "row of pill buttons, one styled differently when
// active" pattern was hand-rolled independently in FeedPage's tab bar,
// PoliticianWall's All/My Posts/Reviews switcher, and AdminSubNav. Each
// item is either a route (renders as a Link, for AdminSubNav-style nav
// tabs) or a plain in-page switch (renders as a button calling onChange,
// for FeedPage/PoliticianWall-style tab state).
export type TabItem = {
  key: string;
  label: ReactNode;
  href?: string;
};

const pillClass = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
    active
      ? "text-primary bg-primary/10 border border-primary/25 font-semibold"
      : "text-text-muted hover:text-text-main hover:bg-surface-hover"
  }`;

export default function Tabs({
  items,
  activeKey,
  onChange,
  className = "",
}: {
  items: TabItem[];
  activeKey: string;
  onChange?: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 items-center flex-wrap ${className}`.trim()}>
      {items.map((item) => {
        const active = item.key === activeKey;
        if (item.href) {
          return (
            <Link key={item.key} href={item.href} className={pillClass(active)}>
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange?.(item.key)}
            className={pillClass(active)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
