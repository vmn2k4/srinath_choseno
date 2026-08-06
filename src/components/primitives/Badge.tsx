import type { ReactNode } from "react";

// Centralized badge/status-pill recipe — covers every status/role/type label
// in the app (election status, candidate status, "you"/"owner" markers,
// boundary type tags, etc.), which previously had 7+ incompatible one-off
// variants (font size, radius, padding, and case all drifted independently).
const TONES = {
  primary: "bg-primary/20 text-primary-light font-bold border border-primary/30",
  accent: "bg-accent/20 text-accent-hover font-bold border border-accent/30",
  amber: "bg-amber-500/20 text-amber-900 dark:text-amber-50 font-bold border border-amber-500/40",
  emerald:
    "bg-emerald-500/20 text-emerald-950 dark:text-emerald-50 font-bold border border-emerald-500/40",
  rose: "bg-rose-500/20 text-rose-950 dark:text-rose-50 font-bold border border-rose-500/40",
  neutral: "bg-surface-active text-text-main font-semibold border border-border-light",
} as const;

const SIZES = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-xs px-2.5 py-1",
} as const;

type BadgeTone = keyof typeof TONES;
type BadgeSize = keyof typeof SIZES;

export default function Badge({
  tone = "neutral",
  shape = "rounded",
  size = "xs",
  uppercase = true,
  icon,
  className = "",
  children,
}: {
  tone?: BadgeTone;
  shape?: "rounded" | "pill";
  size?: BadgeSize;
  uppercase?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const shapeClass = shape === "pill" ? "rounded-full" : "rounded";
  const caseClass = uppercase ? "uppercase tracking-wider" : "";

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold whitespace-nowrap ${caseClass} ${TONES[tone] || TONES.neutral} ${SIZES[size] || SIZES.xs} ${shapeClass} ${className}`.trim()}
    >
      {icon}
      {children}
    </span>
  );
}
