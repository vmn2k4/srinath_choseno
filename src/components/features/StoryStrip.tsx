import { Video } from "lucide-react";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { normalizeMediaUrl } from "@/lib/services/video";

export type StoryPost = {
  id: string;
  ghost_id: string;
  video_url: string | null;
};

// Extracted from FeedPage.jsx's "Politician Pitches" horizontal video strip
// (Instagram/TikTok-style story thumbnails, tap opens StoryViewerModal).
// Filtering to video posts is the caller's job (pass only posts that have
// video_url set) since what counts as "story-worthy" is page-specific.
export default function StoryStrip({
  posts,
  onSelect,
  label = "Politician Pitches",
}: {
  posts: StoryPost[];
  onSelect: (videoUrl: string) => void;
  label?: string;
}) {
  if (posts.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-text-muted text-sm font-medium mb-3 flex items-center gap-2">
        <Video size={16} className="text-primary-light" /> {label}
      </h3>
      <div
        className="flex gap-4 overflow-x-auto pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {posts.map((post) => (
          <button
            key={`story-${post.id}`}
            onClick={() => post.video_url && onSelect(post.video_url)}
            className="flex flex-col items-center min-w-[100px] group"
          >
            <div className="w-[100px] h-[150px] rounded-xl border-2 border-primary/50 group-hover:border-primary p-0.5 relative overflow-hidden bg-surface-hover shrink-0 transition-all group-hover:scale-105 shadow-lg">
              <video
                src={normalizeMediaUrl(post.video_url) || undefined}
                className="w-full h-full rounded-lg object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent rounded-lg transition-opacity group-hover:opacity-80" />
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 border border-primary-light">
                  <Video size={8} className="text-text-on-primary" />
                </div>
                <span className="text-[10px] text-white font-medium truncate drop-shadow-md">
                  {getGhostDisplayName(post.ghost_id)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
