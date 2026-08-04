import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";

// Centralized button recipe. Fixes a real contrast bug found in the design
// audit: three different "text on primary button" colors were in use
// (text-slate-950 / text-white / text-surface) against the same pale
// primary token — standardized on the --color-text-on-primary token here,
// the most legible.
const VARIANTS = {
  primary:
    "bg-primary hover:bg-primary-hover text-text-on-primary font-bold shadow-[0_4px_14px_color-mix(in_srgb,var(--color-primary)_15%,transparent)] hover:shadow-[0_6px_18px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]",
  secondary: "bg-surface-active hover:bg-border text-text-main font-semibold",
  outline:
    "bg-surface-hover/80 backdrop-blur-sm text-text-secondary border border-border-light hover:bg-surface-active hover:text-text-main font-semibold",
  danger: "bg-danger/15 hover:bg-danger/25 text-danger-light border border-danger/30 font-bold",
  ghost: "text-text-muted hover:text-text-main hover:bg-surface-hover font-semibold",
  icon: "", // handled separately below
} as const;

const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3 text-sm",
} as const;

const ICON_SIZES = { sm: "p-1.5", md: "p-2", lg: "p-2.5" } as const;
const ICON_TONES = {
  default: "text-text-muted hover:text-text-main hover:bg-surface-hover",
  danger: "text-text-muted hover:text-danger hover:bg-danger/10",
  primary: "text-text-muted hover:text-primary-light hover:bg-primary/10",
  success: "text-text-muted hover:text-success hover:bg-success/10",
} as const;

type ButtonVariant = keyof typeof VARIANTS;
type ButtonSize = keyof typeof SIZES;
type IconTone = keyof typeof ICON_TONES;

type ButtonOwnProps<T extends ElementType> = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: IconTone; // icon variant only
  as?: T;
  className?: string;
  children?: ReactNode;
};

type ButtonProps<T extends ElementType> = ButtonOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

export default function Button<T extends ElementType = "button">({
  variant = "primary",
  size = "md",
  tone = "default",
  as,
  className = "",
  children,
  ...rest
}: ButtonProps<T>) {
  const Tag = (as || "button") as ElementType;

  if (variant === "icon") {
    const iconPad = ICON_SIZES[size] || ICON_SIZES.md;
    const toneClass = ICON_TONES[tone] || ICON_TONES.default;
    return (
      <Tag
        className={`${iconPad} ${toneClass} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`.trim()}
        {...rest}
      >
        {children}
      </Tag>
    );
  }

  const sizeClass = SIZES[size] || SIZES.md;
  const variantClass = VARIANTS[variant] || VARIANTS.primary;

  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${sizeClass} ${variantClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
