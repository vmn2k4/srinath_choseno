"use client";

import React, { useState } from "react";
import { Share2, Check } from "lucide-react";

// Share a single post: the OS share sheet where the browser has one (phones),
// otherwise copy the link. The link opens the post's own page
// (/post/[id]) with its full conversation.
export default function PostShareButton({ url, title }: { url: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ url, title: title || "Choseno" });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // User dismissed the share sheet, or clipboard was blocked — nothing to do.
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer"
      aria-label="Share this post"
      title="Share this post"
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      <span>{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
