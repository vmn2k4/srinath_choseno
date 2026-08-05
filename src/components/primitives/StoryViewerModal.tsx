"use client";

import React, { useState } from "react";
import Modal from "./Modal";
import { normalizeMediaUrl } from "@/lib/services/video";
import { AlertCircle, X } from "lucide-react";

export default function StoryViewerModal({
  url,
  type,
  onClose,
}: {
  url?: string | null;
  type?: "image" | "video";
  onClose: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  if (!url) return null;

  const normalized = normalizeMediaUrl(url);
  const isVideo = type ? type === "video" : isLikelyVideoUrl(normalized);

  return (
    <Modal overlayClassName="bg-black/95 backdrop-blur-md" zIndexClassName="z-[100]" onOverlayClick={onClose}>
      <div className="relative flex items-center justify-center w-full">
        <button
          onClick={onClose}
          className="absolute -top-12 right-2 sm:top-2 sm:right-2 z-30 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer border border-white/20 shadow-lg"
          title="Close preview"
        >
          <X size={18} />
        </button>

        {hasError ? (
          <div className="p-8 text-center space-y-3 bg-surface rounded-2xl border border-border-light max-w-sm shadow-2xl">
            <AlertCircle size={36} className="text-warning mx-auto" />
            <p className="text-sm font-bold text-text-main">
              {isVideo ? "Video Unavailable" : "Image Unavailable"}
            </p>
            <p className="text-xs text-text-muted">
              This {isVideo ? "video recording" : "image"} file is missing or no longer exists in Supabase storage.
            </p>
          </div>
        ) : isVideo ? (
          /* TikTok-style 9:16 vertical video player */
          <div
            className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 flex items-center justify-center"
            style={{ aspectRatio: "9 / 16", height: "min(85vh, 800px)", maxWidth: "95vw" }}
          >
            <video
              src={normalized}
              controls
              autoPlay
              playsInline
              onError={() => setHasError(true)}
              className="w-full h-full object-cover bg-black"
            />
          </div>
        ) : (
          /* Image Preview Modal */
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={normalized}
              alt="Media attachment preview"
              onError={() => setHasError(true)}
              className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

function isLikelyVideoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:video/")) return true;
  if (
    lower.includes(".mp4") ||
    lower.includes(".webm") ||
    lower.includes(".mov") ||
    lower.includes(".ogg") ||
    lower.includes(".m4v")
  ) {
    return true;
  }
  if (lower.includes("/videos/") || lower.includes("/post_videos/")) return true;
  return false;
}


