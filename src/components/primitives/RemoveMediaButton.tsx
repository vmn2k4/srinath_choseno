import { X } from "lucide-react";

// Small solid-danger circular "remove attachment" affordance for image/video
// preview thumbnails — previously duplicated verbatim across CandidacyWall,
// PoliticianWall, and FeedPage's upload previews.
export default function RemoveMediaButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute -top-2 -right-2 bg-danger text-white rounded-full p-1 shadow-lg hover:bg-danger-light ${className}`.trim()}
    >
      <X size={14} />
    </button>
  );
}
