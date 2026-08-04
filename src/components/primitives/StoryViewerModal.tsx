"use client";

import React, { useState } from "react";
import Modal from "./Modal";
import { normalizeMediaUrl } from "@/lib/services/video";
import { AlertCircle } from "lucide-react";

export default function StoryViewerModal({
  url,
  onClose,
}: {
  url?: string | null;
  onClose: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  if (!url) return null;

  return (
    <Modal overlayClassName="bg-overlay-heavy backdrop-blur-sm" zIndexClassName="z-[100]">
      <div className="relative max-w-sm w-full bg-surface rounded-2xl overflow-hidden shadow-2xl border border-border-light min-h-[300px] flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer"
        >
          ✕
        </button>

        {hasError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle size={36} className="text-warning mx-auto" />
            <p className="text-sm font-bold text-text-main">
              Video Unavailable
            </p>
            <p className="text-xs text-text-muted">
              This video recording file is missing or no longer exists in Supabase storage.
            </p>
          </div>
        ) : (
          <video
            src={normalizeMediaUrl(url)}
            controls
            autoPlay
            onError={() => setHasError(true)}
            className="w-full max-h-[85vh] object-contain bg-black"
          />
        )}
      </div>
    </Modal>
  );
}
