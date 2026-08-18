import type { CSSProperties, ReactNode } from "react";

// Centralized badge/status-pill recipe — covers every status/role/type label
// in the app (election status, candidate status, "you"/"owner" markers,
// boundary type tags, etc.), which previously had 7+ incompatible one-off
// variants (font size, radius, padding, and case all drifted independently).
const TONES = {
  primary: "bg-primary/20 text-primary-light font-bold border border-primary/30",
  accent: "bg-accent/20 text-accent-hover font-bold border border-accent/30",
  amber: "bg-warning text-slate-950 font-bold border border-warning/60",
  emerald: "bg-success text-slate-950 font-bold border border-success/60",
  rose: "bg-danger text-white font-bold border border-danger/60",
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
  style,
  children,
}: {
  tone?: BadgeTone;
  shape?: "rounded" | "pill";
  size?: BadgeSize;
  uppercase?: boolean;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const shapeClass = shape === "pill" ? "rounded-full" : "rounded";
  const caseClass = uppercase ? "uppercase tracking-wider" : "";

  return (
    <span
      style={style}
      className={`inline-flex items-center gap-1 font-bold whitespace-nowrap ${caseClass} ${TONES[tone] || TONES.neutral} ${SIZES[size] || SIZES.xs} ${shapeClass} ${className}`.trim()}
    >
      {icon}
      {children}
    </span>
  );
}
