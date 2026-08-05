import { Video } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/services/video";

export default function MediaThumbnail({
  url,
  type,
  alt = "Preview",
  onClick,
}: {
  url: string;
  type: "image" | "video";
  alt?: string;
  onClick?: () => void;
}) {
  const normalized = normalizeMediaUrl(url);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-lg overflow-hidden border border-border-light/45 w-20 h-28 shrink-0 group hover:shadow-md transition-shadow"
      style={type === "video" ? { backgroundColor: "rgba(0, 0, 0, 0.2)" } : {}}
    >
      {type === "image" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalized}
            alt={alt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        </>
      ) : (
        <>
          <video
            src={normalized}
            className="w-full h-full object-cover"
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/50 transition-colors">
            <Video size={20} className="text-white" />
          </div>
        </>
      )}
    </button>
  );
}
