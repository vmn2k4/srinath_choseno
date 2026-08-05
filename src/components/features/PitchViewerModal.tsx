"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, X, AlertCircle, Play } from "lucide-react";
import Modal from "@/components/primitives/Modal";
import { normalizeMediaUrl } from "@/lib/services/video";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import type { StoryPost } from "./StoryStrip";

// TikTok-style full-bleed 9:16 video viewer for the "Politician Pitches"
// story strip. Renders one pitch at a time, auto-advancing to the next on
// end and supporting swipe/scroll/keyboard navigation between the whole
// list -- centralized here so any future pitch feed (not just FeedPageClient)
// reuses the same viewer instead of a one-off video tag.
export default function PitchViewerModal({
  posts,
  startId,
  onClose,
}: {
  posts: StoryPost[];
  startId: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() => Math.max(0, posts.findIndex((p) => p.id === startId)));
  const [hasError, setHasError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef<number | null>(null);

  const post = posts[index];

  const goTo = (next: number) => {
    if (next < 0 || next >= posts.length) return;
    setHasError(false);
    setIsPaused(false);
    setIndex(next);
  };

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!post) return null;

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPaused(false);
    } else {
      video.pause();
      setIsPaused(true);
    }
  };

  return (
    <Modal overlayClassName="bg-black/95" zIndexClassName="z-[100]">
      <div
        className="relative flex items-center justify-center"
        onWheel={(e) => {
          if (e.deltaY > 30) goTo(index + 1);
          else if (e.deltaY < -30) goTo(index - 1);
        }}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (touchStartY.current == null) return;
          const delta = touchStartY.current - e.changedTouches[0].clientY;
          if (delta > 50) goTo(index + 1);
          else if (delta < -50) goTo(index - 1);
          touchStartY.current = null;
        }}
      >
        <button
          onClick={onClose}
          className="absolute -top-2 right-0 sm:top-2 sm:-right-12 z-20 w-9 h-9 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div
          className="relative rounded-xl overflow-hidden bg-black shadow-2xl"
          style={{ aspectRatio: "9 / 16", height: "min(85vh, 800px)", maxWidth: "95vw" }}
        >
          {hasError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertCircle size={36} className="text-warning" />
              <p className="text-sm font-bold text-white">Video Unavailable</p>
              <p className="text-xs text-white/60">
                This video recording file is missing or no longer exists in Supabase storage.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={togglePlayback}
              className="relative w-full h-full cursor-pointer"
              aria-label={isPaused ? "Play" : "Pause"}
            >
              <video
                key={post.id}
                ref={videoRef}
                src={normalizeMediaUrl(post.video_url) || undefined}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                onEnded={() => goTo(index + 1)}
                onError={() => setHasError(true)}
              />
              {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                    <Play size={28} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              )}
            </button>
          )}

          <div className="absolute top-3 left-3 right-3 flex gap-1 pointer-events-none">
            {posts.map((_, i) => (
              <div
                key={i}
                className={`h-0.5 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>

          <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
            <span className="text-white text-sm font-semibold drop-shadow-md">
              {getGhostDisplayName(post.ghost_id)}
            </span>
          </div>
        </div>

        <div className="hidden sm:flex flex-col gap-2 absolute -right-12 top-1/2 -translate-y-1/2">
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="w-9 h-9 flex items-center justify-center bg-black/50 hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-white transition-colors cursor-pointer"
            aria-label="Previous pitch"
          >
            <ChevronUp size={18} />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            disabled={index === posts.length - 1}
            className="w-9 h-9 flex items-center justify-center bg-black/50 hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-white transition-colors cursor-pointer"
            aria-label="Next pitch"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
