import type { ComponentPropsWithoutRef } from "react";

// Centralized text-input recipe. Previously 6 incompatible variants existed
// (bg opacity/radius/padding all drifted); this also gives every input a
// visible keyboard-focus ring, which before this only existed on AuthPage.
const SIZE_PAD = { sm: "p-2.5 text-sm", md: "p-3 text-sm" } as const;

type InputSize = keyof typeof SIZE_PAD;

export default function Input({
  size = "md",
  className = "",
  ...rest
}: { size?: InputSize } & Omit<ComponentPropsWithoutRef<"input">, "size">) {
  return (
    <input
      className={`w-full bg-surface-hover border border-border-light rounded-xl text-text-main placeholder:text-text-muted outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50 ${SIZE_PAD[size] || SIZE_PAD.md} ${className}`.trim()}
      {...rest}
    />
  );
}
