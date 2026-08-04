import type { ComponentType, ReactNode } from "react";

const TONES = {
  primary: { selected: "border-primary bg-primary/10", hover: "hover:border-primary-light hover:bg-surface-hover" },
  accent: { selected: "border-accent bg-accent/10", hover: "hover:border-accent-hover hover:bg-surface-hover" },
} as const;

type ChoiceCardTone = keyof typeof TONES;

// Extracted from StepRole.jsx's citizen-vs-politician picker and
// EditProfileFlow's inline StepBasicInfo role cards — the same
// "large selectable card, big icon, bold title, muted description"
// pattern was hand-rolled independently in both places. One shared
// component from here on; the two callers just render two of these
// side by side with different tones/icons/copy.
export default function ChoiceCard({
  icon: Icon,
  title,
  description,
  selected,
  tone = "primary",
  onClick,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  selected: boolean;
  tone?: ChoiceCardTone;
  onClick: () => void;
}) {
  const { selected: selectedClass, hover } = TONES[tone] || TONES.primary;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 transition-all ${
        selected ? selectedClass : `border-border ${hover}`
      }`}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-surface-active flex items-center justify-center mb-3 sm:mb-4 text-text-secondary shrink-0">
        <Icon size={32} />
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-text-main mb-2">{title}</h3>
      {description && <p className="text-sm text-text-muted text-center">{description}</p>}
    </button>
  );
}
