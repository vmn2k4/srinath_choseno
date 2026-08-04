"use client";

import React from "react";
import AdminSubNav from "./AdminSubNav";
import { useTheme, THEMES, ThemeKey } from "@/contexts/ThemeContext";
import { Heart, MessageCircle, Check, Palette } from "lucide-react";
import { Card, PageHeader } from "@/components/primitives";

function ThemePreview({ themeKey }: { themeKey: string }) {
  return (
    <div
      data-theme={themeKey}
      className="rounded-xl p-3"
      style={{ background: "var(--color-background)" }}
    >
      <div className="rounded-lg p-3 bg-surface border border-border-light/40">
        <div className="flex gap-1.5 mb-3">
          <span className="text-[11px] px-2 py-1 rounded-md bg-primary/15 text-primary-light font-semibold">
            Feed
          </span>
          <span className="text-[11px] px-2 py-1 rounded-md text-text-muted">
            Elections
          </span>
        </div>
        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full bg-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex gap-1.5 items-center">
              <span className="text-xs font-semibold text-text-main">
                Vijay
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent-hover font-semibold">
                Politician
              </span>
            </div>
            <p className="text-[11px] text-text-muted my-1">
              What's happening in your district today...
            </p>
            <div className="flex gap-3 items-center">
              <Heart size={13} className="text-text-muted" />
              <MessageCircle size={13} className="text-text-muted" />
              <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-md bg-primary text-text-on-primary">
                Post
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThemeAdminClient() {
  const { theme, setTheme, loading } = useTheme();

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-6">
      <AdminSubNav active="theme" />
      <PageHeader
        icon={Palette}
        title="Site theme"
        subtitle="Pick the color theme every visitor sees. Changes apply immediately, site-wide."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {THEMES.map((t) => {
          const active = t.key === theme;
          return (
            <button
              key={t.key}
              onClick={() => setTheme(t.key as ThemeKey)}
              disabled={loading}
              className="text-left cursor-pointer"
            >
              <Card
                padding="sm"
                className={`transition-colors ${
                  active
                    ? "border-2 border-primary"
                    : "hover:border-border-light/60"
                }`}
              >
                <ThemePreview themeKey={t.key} />
                <div className="flex items-center justify-between mt-3 px-1">
                  <div>
                    <p className="text-sm font-semibold text-text-main">
                      {t.label}
                    </p>
                    <p className="text-[11px] text-text-muted capitalize">
                      {t.mode} mode
                    </p>
                  </div>
                  {active && (
                    <span className="w-6 h-6 rounded-full bg-primary text-text-on-primary flex items-center justify-center shrink-0">
                      <Check size={14} />
                    </span>
                  )}
                </div>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
