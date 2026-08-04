export type Chip = { key: string; label: string };

// Extracted from FeedPage.jsx's master-feed boundary-type filter row
// ("All" + one chip per boundary type + Country + International). Visually
// smaller/lighter-weight than Tabs (primitives/Tabs.tsx) on purpose — this
// is a secondary filter refinement within an already-selected tab, not
// primary navigation, so it reads as a row of badge-like pills rather than
// nav-style buttons.
export default function ChipGroup({
  chips,
  activeKey,
  onChange,
  className = "",
}: {
  chips: Chip[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${className}`.trim()}>
      {chips.map((chip) => {
        const active = chip.key === activeKey;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? "bg-primary/20 text-primary-light border-primary/30"
                : "bg-surface-hover text-text-muted border-border-light hover:text-text-main"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
