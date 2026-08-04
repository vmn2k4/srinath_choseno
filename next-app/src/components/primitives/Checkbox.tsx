import type { ComponentPropsWithoutRef, ReactNode } from "react";

// New primitive — the Vite app hand-rolled raw <input type="checkbox"
// className="accent-primary"> inline (CandidateApplication's multi-select
// questionnaire, ElectionsAdmin's question-flag toggles). One shared
// recipe from here on, still native-input-based (not a custom SVG box) so
// it keeps full keyboard/a11y behavior for free.
export default function Checkbox({
  label,
  className = "",
  id,
  ...rest
}: { label?: ReactNode; className?: string } & ComponentPropsWithoutRef<"input">) {
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none ${className}`.trim()}
    >
      <input
        type="checkbox"
        id={id}
        className="w-4 h-4 accent-primary rounded border-border-light cursor-pointer"
        {...rest}
      />
      {label}
    </label>
  );
}
