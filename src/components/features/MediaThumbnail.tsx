import { Video } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/services/video";

export default function MediaThumbnail({
  url,
  type,
  alt = "Preview",
  onClick,
  // "portrait" (default) is the 5:7 box every user-uploaded photo/video
  // thumbnail has always used — unchanged for every existing call site.
  // "landscape" is for auto-generated OG cards (news articles, election
  // seats): those render at a fixed 1200x630 (~1.91:1) ratio with text
  // baked into the graphic itself, so object-cover inside a *portrait* box
  // was cropping down to a thin vertical sliver of the middle of the card
  // — landscape matches the source image's real aspect ratio 1:1, so
  // object-cover shows the whole card with nothing cropped, same as how
  // Twitter/X sizes its own link-preview cards.
  variant = "portrait",
}: {
  url: string;
  type: "image" | "video";
  alt?: string;
  onClick?: () => void;
  variant?: "portrait" | "landscape";
}) {
  const normalized = normalizeMediaUrl(url);
  const isLandscape = variant === "landscape";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden border border-border-light/45 shrink-0 group hover:shadow-md transition-all cursor-pointer ${
        type === "video"
          ? "w-28 sm:w-32 md:w-36 bg-black/90"
          : isLandscape
          ? "w-full sm:w-96 bg-surface"
          : "w-28 sm:w-36 md:w-44 bg-surface"
      }`}
      style={{ aspectRatio: type === "video" ? "9 / 16" : isLandscape ? "1200 / 630" : "5 / 7" }}
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
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-10 h-10 rounded-full bg-black/60 border border-white/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Video size={20} className="text-white" />
            </div>
          </div>
        </>
      )}
    </button>
  );
}
