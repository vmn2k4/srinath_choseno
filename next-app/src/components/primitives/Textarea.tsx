import type { ComponentPropsWithoutRef } from "react";

const SIZE_PAD = { sm: "p-2.5 text-sm", md: "p-3 text-sm" } as const;

type TextareaSize = keyof typeof SIZE_PAD;

// `plain` keeps the deliberate borderless-composer look already used for
// post/comment textareas (the surrounding Card variant="composer" already
// provides the visual frame) — not every textarea should get a border.
export default function Textarea({
  size = "md",
  plain = false,
  className = "",
  rows = 3,
  ...rest
}: { size?: TextareaSize; plain?: boolean } & ComponentPropsWithoutRef<"textarea">) {
  const base = plain
    ? "w-full bg-transparent text-text-secondary placeholder:text-text-muted resize-none outline-none"
    : `w-full bg-surface-hover border border-border-light rounded-xl text-text-main placeholder:text-text-muted outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none disabled:opacity-50 ${SIZE_PAD[size] || SIZE_PAD.md}`;

  return <textarea rows={rows} className={`${base} ${className}`.trim()} {...rest} />;
}
