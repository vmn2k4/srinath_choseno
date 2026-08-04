import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";

// Centralized card recipe — every "glass card" / composer box / list row /
// empty-state box in the app should go through this instead of hand-rolled
// Tailwind strings, so the look can be changed from one place. The
// elevation-N classes (globals.css) carry the actual glass physics — blur,
// saturation, shadow depth, and top-edge highlight — scaled to how close to
// the viewer each variant should feel: row/dashed are small and frequent
// (elevation-1), default/composer are standard panels (elevation-2), hero
// is the most prominent, closest-to-viewer surface (elevation-3).
const VARIANTS = {
  default: "bg-surface/30 elevation-2 rounded-2xl border border-border-light/45",
  hero: "relative overflow-hidden bg-surface/30 elevation-3 rounded-3xl border border-border-light/45",
  composer: "bg-surface/50 elevation-2 rounded-xl border border-border-light/50",
  row: "bg-surface/30 elevation-1 rounded-xl border border-border-light/35",
  dashed: "bg-surface/20 elevation-1 rounded-2xl border border-dashed border-border-light/60",
} as const;

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

type CardVariant = keyof typeof VARIANTS;
type CardPadding = keyof typeof PADDING;

type CardOwnProps<T extends ElementType> = {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  as?: T;
  className?: string;
  children?: ReactNode;
};

type CardProps<T extends ElementType> = CardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

export default function Card<T extends ElementType = "div">({
  variant = "default",
  padding = "md",
  interactive = false,
  as,
  className = "",
  children,
  ...rest
}: CardProps<T>) {
  const Tag = (as || "div") as ElementType;
  const base = VARIANTS[variant] || VARIANTS.default;
  const pad = PADDING[padding] ?? PADDING.md;
  const hoverClass = interactive ? " hover:border-primary/25 transition-all duration-300" : "";

  return (
    <Tag className={`${base}${hoverClass} ${pad} ${className}`.trim()} {...rest}>
      {variant === "hero" ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative">{children}</div>
        </>
      ) : (
        children
      )}
    </Tag>
  );
}
