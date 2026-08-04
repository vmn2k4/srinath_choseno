import type { ComponentPropsWithoutRef, ReactNode } from "react";

// New primitive — sibling of Checkbox, same reasoning. Used for
// single-choice questionnaire questions.
export default function Radio({
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
        type="radio"
        id={id}
        className="w-4 h-4 accent-primary cursor-pointer"
        {...rest}
      />
      {label}
    </label>
  );
}
