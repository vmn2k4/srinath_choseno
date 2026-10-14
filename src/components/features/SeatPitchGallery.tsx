"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Play, X } from "lucide-react";
import { Modal, Avatar, Button } from "@/components/primitives";
import { parseYouTubeId } from "@/lib/utils/youtube";
import { facebookVideoEmbedUrl } from "@/lib/utils/facebookVideo";

export interface PitchGalleryCandidate {
  id: string;
  name: string;
  avatarUrl?: string | null;
  partyName?: string | null;
  videoUrl: string;
}

// Large player opened from a gallery card. The cards themselves only show a
// thumbnail: embedding the live YouTube player there drew its title bar,
// channel avatar and CC/volume icons over a small frame. Here the player is
// big, so those overlays are minor, and the Fullscreen button fullscreens the
// whole frame. Vertical (/shorts/) links get a 9:16 frame, everything else 16:9.
function PitchLightbox({ candidate, onClose }: { candidate: PitchGalleryCandidate; onClose: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const url = candidate.videoUrl;
  const youTubeId = parseYouTubeId(url);
  const facebookEmbed = youTubeId ? null : facebookVideoEmbedUrl(url, true);
  const vertical = /\/shorts\//.test(url) || (!youTubeId && !facebookEmbed);
  const frameClass = vertical
    ? "h-[80vh] max-h-[44rem] aspect-[9/16] max-w-[92vw]"
    : "w-[92vw] max-w-4xl aspect-video";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Modal onOverlayClick={onClose} zIndexClassName="z-[60]" overlayClassName="bg-black/85 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-between w-full gap-3 text-white">
          <span className="font-bold truncate">{candidate.name}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => frameRef.current?.requestFullscreen?.().catch(() => {})}
              aria-label="Fullscreen"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm hover:bg-white/15 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" /> Fullscreen
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close video"
              className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div ref={frameRef} className={`${frameClass} bg-black rounded-xl overflow-hidden`}>
          {youTubeId || facebookEmbed ? (
            <iframe
              className="w-full h-full border-0"
              src={
                youTubeId
                  ? `https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&cc_load_policy=0&fs=1`
                  : facebookEmbed!
              }
              title={`${candidate.name} pitch video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
            />
          ) : (
            <video src={url} controls autoPlay playsInline className="w-full h-full" />
          )}
        </div>
      </div>
    </Modal>
  );
}

// Popup gallery of every candidate pitch video in a race. Order is shuffled
// per open so no candidate gets the first slot by default. Closing it (X,
// backdrop, Escape, or "View all candidates") leaves the full roster behind it.
export default function SeatPitchGallery({
  candidates,
  totalCandidates,
  onClose,
  onViewAll,
  onSelectCandidate,
}: {
  candidates: PitchGalleryCandidate[];
  totalCandidates: number;
  onClose: () => void;
  onViewAll: () => void;
  onSelectCandidate: (id: string) => void;
}) {
  const [playing, setPlaying] = useState<PitchGalleryCandidate | null>(null);
  const ordered = useMemo(() => [...candidates].sort(() => Math.random() - 0.5), [candidates]);
  const missing = totalCandidates - candidates.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !playing && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, playing]);

  return (
    <>
    <Modal
      onOverlayClick={onClose}
      className="w-full max-w-3xl bg-surface rounded-2xl border border-border-light shadow-2xl p-4 sm:p-6 space-y-4"
    >
      <div role="dialog" aria-label="Candidate pitch videos" className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text-main">Watch the candidate pitches</h2>
            <p className="text-sm text-text-secondary">
              {candidates.length} of {totalCandidates} candidates have shared a pitch
              {missing > 0 ? ` — ${missing} yet to share.` : "."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pitch gallery"
            className="shrink-0 p-1.5 rounded-full text-text-muted hover:bg-surface-hover cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
          {ordered.map((c) => (
            <div key={c.id} className="snap-start shrink-0 w-[220px] space-y-2">
              <button
                type="button"
                onClick={() => setPlaying(c)}
                aria-label={`Play ${c.name}'s pitch`}
                className="group relative block w-full aspect-[9/16] rounded-xl overflow-hidden bg-gradient-to-br from-surface via-surface-hover to-surface-active cursor-pointer"
              >
                {parseYouTubeId(c.videoUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://i.ytimg.com/vi/${parseYouTubeId(c.videoUrl)}/hqdefault.jpg`}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <span className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-14 h-14 rounded-full bg-primary text-text-on-primary flex items-center justify-center shadow-xl transition-transform group-hover:scale-110">
                    <Play className="w-6 h-6 fill-current translate-x-0.5" aria-hidden="true" />
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSelectCandidate(c.id)}
                className="flex items-center gap-2 w-full text-left cursor-pointer group"
              >
                <Avatar src={c.avatarUrl} name={c.name} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-text-main truncate group-hover:underline">{c.name}</span>
                  {c.partyName && <span className="block text-xs text-text-muted truncate">{c.partyName}</span>}
                </span>
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button type="button" size="sm" onClick={onViewAll}>
            View all {totalCandidates} candidates
          </Button>
        </div>
      </div>
    </Modal>
    {playing && <PitchLightbox candidate={playing} onClose={() => setPlaying(null)} />}
    </>
  );
}
