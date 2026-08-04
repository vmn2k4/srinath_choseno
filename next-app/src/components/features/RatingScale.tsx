import { RATING_SCALE } from "@/lib/utils/ratingScale";

// Unifies two independently-hand-rolled rating widgets that shared the same
// RATING_SCALE constant but diverged in every other way: AnswerValue.jsx's
// read-only display dots (candidacy wall / admin review) and
// CandidateApplication.jsx's interactive selector buttons. Pass `onChange`
// for the interactive form control; omit it for the read-only display
// (matching AnswerValue's `ratingValue == null` -> render nothing).
export default function RatingScale({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange?: (n: number) => void;
}) {
  if (!onChange && value == null) return null;

  if (onChange) {
    return (
      <div className="flex items-center gap-2">
        {RATING_SCALE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              value === n
                ? "bg-primary text-text-on-primary border-primary"
                : "border-border-light text-text-muted hover:border-primary/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {RATING_SCALE.map((n) => (
        <span
          key={n}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
            value != null && n <= value
              ? "bg-primary text-text-on-primary border-primary"
              : "border-border-light text-text-muted"
          }`}
        >
          {n}
        </span>
      ))}
    </div>
  );
}
