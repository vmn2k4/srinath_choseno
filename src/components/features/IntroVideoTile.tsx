"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";
import { Modal } from "@/components/primitives";
import { parseYouTubeId } from "@/lib/utils/youtube";

// WhatsApp-status-style vertical tile for a candidate's intro video (they're
// shot as vertical shorts). The tile shows the video's thumbnail inside a
// gradient ring; tapping it opens the video in a 9:16 lightbox. YouTube uses
// the same youtube-nocookie embed as the home-page demo and only loads once
// opened.
export default function IntroVideoTile({ url, name }: { url: string; name: string }) {
  const [open, setOpen] = useState(false);
  const youTubeId = parseYouTubeId(url);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="group shrink-0 p-[2px] rounded-2xl bg-gradient-to-tr from-primary via-accent to-primary cursor-pointer"
        aria-label={`Play ${name}'s intro video`}
      >
        <span className="relative block w-11 h-[78px] rounded-[14px] overflow-hidden bg-black ring-2 ring-surface">
          {youTubeId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-[1.8]"
            />
          ) : (
            <video
              src={`${url}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )}
          <span className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-6 h-6 rounded-full bg-primary text-text-on-primary flex items-center justify-center shadow-md transition-transform group-hover:scale-110">
              <Play className="w-3 h-3 fill-current translate-x-px" aria-hidden="true" />
            </span>
          </span>
        </span>
      </button>

      {open && (
        <Modal
          zIndexClassName="z-[100]"
          overlayClassName="bg-black/80 backdrop-blur-sm"
          onOverlayClick={() => setOpen(false)}
          className="relative w-full max-w-[360px]"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute -top-10 right-0 inline-flex items-center gap-1 text-white/90 hover:text-white text-xs font-semibold cursor-pointer"
            aria-label="Close video"
          >
            <X size={16} /> Close
          </button>
          <div
            className="relative mx-auto rounded-2xl overflow-hidden bg-black shadow-2xl"
            style={{ aspectRatio: "9 / 16", width: "min(100%, calc(80vh * 9 / 16))" }}
          >
            {youTubeId ? (
              <iframe
                className="absolute inset-0 w-full h-full border-0"
                src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={`${name} intro video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video
                src={url}
                controls
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
          </div>
          <p className="mt-2 text-center text-xs font-semibold text-white/90">{name}</p>
        </Modal>
      )}
    </>
  );
}
