"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";

// Single source of truth for "share this article" data + the dropdown of
// destinations (Copy Link, X, WhatsApp, LinkedIn, Facebook, Telegram,
// Pinterest, Email). Used by both the /news list cards and the article
// detail page's header + briefing-card share buttons -- previously the
// detail page had its own hand-rolled renderShareMenuItems() with a
// different (shorter) set of destinations, so the two surfaces silently
// drifted apart. Don't reintroduce a second copy; extend this one instead.
export interface ShareData {
  url: string;
  basePostText: string;
  hashtagList: string;
  shareText: string;
  hashtags: string[];
  twitterUrl: string;
}

interface ShareMenuProps {
  articleId: string;
  shareData: ShareData;
  onShare?: () => void;
  className?: string;
  iconSize?: number;
  // Optional text next to the icon -- omitted for the compact icon-only
  // trigger on news list cards; set to "Share" / "Share This Briefing" etc.
  // for the labeled buttons on the article detail page.
  label?: string;
  // Detail-page label buttons hide their text below `sm` (icon-only on
  // mobile) to avoid crowding the meta bar; list-card buttons have no label
  // to hide in the first place, so this defaults off.
  hideLabelOnMobile?: boolean;
  // Which way the dropdown opens relative to the trigger. List cards sit at
  // the bottom of a card that can be anywhere in the grid, so the menu
  // opens upward by default; the detail page's header/briefing buttons sit
  // near the top of the page and open downward instead.
  menuAlign?: "above" | "below";
  // Trigger tooltip + native share-sheet title. Both default to the
  // original news-article copy so every existing call site (list cards,
  // article detail page) keeps behaving exactly as before without passing
  // anything -- only a non-news caller (e.g. ElectionResultsPanel's "Share
  // This Race") needs to override these.
  triggerTitle?: string;
  shareTitle?: string;
}

export default function ShareMenu({
  articleId,
  shareData,
  onShare,
  className = "p-1.5 rounded-lg bg-surface/80 hover:bg-orange-500/20 text-text-muted hover:text-orange-500 transition-colors cursor-pointer",
  iconSize = 13,
  label,
  hideLabelOnMobile = false,
  menuAlign = "above",
  triggerTitle = "Share article",
  shareTitle = "News Article",
}: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close menu
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShareOrCopy = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareData.basePostText,
          url: shareData.url,
        });
        setIsOpen(false);
        onShare?.();
        return;
      } catch {
        // Fallback to copy if share dialog dismissed
      }
    }
    handleCopyLink();
  };

  const closeMenu = () => {
    setIsOpen(false);
    onShare?.();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={className}
        title={triggerTitle}
      >
        {copied ? (
          <>
            <Check size={iconSize} className="text-green-600 shrink-0" />
            {label && (
              <span className={hideLabelOnMobile ? "hidden sm:inline" : undefined}>
                Link Copied!
              </span>
            )}
          </>
        ) : (
          <>
            <Share2 size={iconSize} className="shrink-0" />
            {label && (
              <span className={hideLabelOnMobile ? "hidden sm:inline" : undefined}>{label}</span>
            )}
          </>
        )}
      </button>

      {/* Share Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute right-0 ${
            menuAlign === "above" ? "bottom-full mb-2" : "top-full mt-2"
          } w-56 p-2 rounded-lg bg-white border border-slate-200 shadow-xl z-50 flex flex-col gap-1 text-xs max-h-96 overflow-y-auto`}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNativeShareOrCopy();
              closeMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-semibold transition-colors text-left w-full cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={14} className="text-green-600" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(shareData.twitterUrl, "_blank", "noopener,noreferrer");
              closeMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-sky-50 text-sky-700 font-semibold transition-colors text-left w-full cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Share on X</span>
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.shareText)}`, "_blank", "noopener,noreferrer");
              closeMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-emerald-50 text-emerald-700 font-semibold transition-colors text-left w-full cursor-pointer"
          >
            <MessageCircle size={14} />
            <span>Share on WhatsApp</span>
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareData.url)}`, "_blank", "noopener,noreferrer");
              closeMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700 font-semibold transition-colors text-left w-full cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
            </svg>
            <span>Share on LinkedIn</span>
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`, "_blank", "noopener,noreferrer");
              closeMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-100 text-blue-600 font-semibold transition-colors text-left w-full cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Share on Facebook</span>
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(`https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.basePostText)}`, "_blank", "noopener,noreferrer");
              closeMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-sky-100 text-sky-600 font-semibold transition-colors text-left w-full cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a11.955 11.955 0 0 0-8.056 3.279m4.52 7.297c.666.009 1.227.219 1.728.696.318.29.521.772.523 1.364.013 1.314-.857 2.543-2.152 2.543-.393 0-.779-.117-1.114-.356-1.6-1.084-2.846-2.594-3.769-4.424 1.025.01 1.9.3 2.684.777z" />
            </svg>
            <span>Share on Telegram</span>
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareData.url)}&description=${encodeURIComponent(shareData.basePostText)}`, "_blank", "noopener,noreferrer");
              closeMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 text-red-700 font-semibold transition-colors text-left w-full cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m0 19c-3.859 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm3.5-9.5c-.828 0-1.5.672-1.5 1.5s.672 1.5 1.5 1.5 1.5-.672 1.5-1.5-.672-1.5-1.5-1.5z" />
            </svg>
            <span>Save to Pinterest</span>
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const mailtoLink = `mailto:?subject=${encodeURIComponent(shareData.basePostText.split("\n")[0])}&body=${encodeURIComponent(shareData.shareText)}`;
              window.location.href = mailtoLink;
              closeMenu();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-amber-50 text-amber-700 font-semibold transition-colors text-left w-full cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span>Share via Email</span>
          </button>
        </div>
      )}
    </div>
  );
}
