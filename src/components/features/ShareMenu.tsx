"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Share2, Copy, Check, Image as ImageIcon, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Single source of truth for "share this article" data + the dropdown of
// destinations (Copy Link, X, WhatsApp, LinkedIn, Facebook, Telegram,
// Pinterest, Email). Used by both the /news list cards and the article
// detail page's header + briefing-card share buttons.
export interface ShareData {
  url: string;
  basePostText: string;
  hashtagList: string;
  shareText: string;
  hashtags: string[];
  twitterUrl: string;
  tweetArticleText?: string;
  /**
   * Medium-length X post -- shorter than tweetArticleText (the 800-1500
   * char X-Premium-only long post) but unlike twitterUrl's bare 280-char
   * headline hook, this one leads with the review CTA: names the tagged
   * politician and links straight to their wall, since that's the point of
   * this whole share flow more than the news summary is. Falls back to
   * basePostText when the caller has no politician/wall to point at.
   */
  mediumPostText?: string;
  mediumTwitterUrl?: string;
  imageUrl?: string;
}

interface ShareMenuProps {
  articleId: string;
  shareData: ShareData;
  onShare?: (platform?: string) => void;
  className?: string;
  iconSize?: number;
  label?: string;
  hideLabelOnMobile?: boolean;
  menuAlign?: "above" | "below";
  triggerTitle?: string;
  shareTitle?: string;
  // "menu" (default): a button that opens the dropdown. "icons": an inline
  // row of destination icons.
  layout?: "menu" | "icons";
}

export default function ShareMenu({
  articleId,
  shareData,
  onShare,
  className = "p-1.5 rounded-lg bg-surface/80 hover:bg-orange-500/20 text-text-muted hover:text-orange-500 transition-colors cursor-pointer",
  iconSize = 13,
  label,
  hideLabelOnMobile = false,
  menuAlign = "below",
  triggerTitle = "Share article",
  shareTitle = "News Article",
  layout = "menu",
}: ShareMenuProps) {
  // Long-form X options (Pre-Filled Long Post, X Articles, Medium Post) are
  // power-user/admin tools for the news-distribution workflow; everyone else
  // gets the standard destinations only. Gated here so every ShareMenu in the
  // app follows the same rule.
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 224; // 14rem / w-56
    const dropdownHeight = 360;

    // Check vertical positioning
    const spaceBelow = window.innerHeight - rect.bottom;
    const preferBelow = menuAlign === "below" || spaceBelow > dropdownHeight || spaceBelow > 200;

    let top = preferBelow ? rect.bottom + 6 : rect.top - dropdownHeight - 6;
    if (top < 10) top = rect.bottom + 6; // Fallback if pushed off top

    // Check horizontal positioning (align right with trigger button, constrained by viewport)
    let left = rect.right - dropdownWidth;
    if (left < 12) left = 12;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = window.innerWidth - dropdownWidth - 12;
    }

    setCoords({ top, left });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Click outside and scroll listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const [copiedImage, setCopiedImage] = useState(false);

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onShare?.("Copy Link");
    }
  };

  const handleCopyImage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!shareData.imageUrl) return;

    try {
      const res = await fetch(shareData.imageUrl);
      const blob = await res.blob();
      const pngBlob = blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
      if (typeof navigator !== "undefined" && navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            "image/png": pngBlob,
          }),
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
        onShare?.("Copy Image");
      } else {
        window.open(shareData.imageUrl, "_blank");
      }
    } catch (err) {
      console.warn("Clipboard image copy not supported, opening image:", err);
      window.open(shareData.imageUrl, "_blank");
    }
  };

  const handleDownloadImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!shareData.imageUrl) return;
    const a = document.createElement("a");
    a.href = shareData.imageUrl;
    a.download = `choseno-share-card-${articleId}.png`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    closeMenu("Download Image");
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
        onShare?.("Native Share");
        return;
      } catch {
        // Fallback to copy if share dialog dismissed
      }
    }
    handleCopyLink();
  };

  const closeMenu = (platform?: string) => {
    setIsOpen(false);
    if (platform) {
      onShare?.(platform);
    } else {
      onShare?.();
    }
  };

  // Standard share destinations, defined once and rendered by BOTH layouts
  // (the dropdown below and the inline icon row), so a destination is added or
  // changed in exactly one place. Admin-only long-form X options stay bespoke
  // in the dropdown.
  type Destination = {
    key: string;
    label: string;
    icon: React.ReactNode;
    // Dropdown row hover/text colours + the icon-row tint.
    itemClass: string;
    iconClass: string;
    onClick: () => void;
  };
  const copyShareText = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareData.shareText).catch(() => {});
    }
  };
  const openShare = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  const destinations: Destination[] = [
    {
      key: "copy",
      label: copied ? "Copied to Clipboard!" : "Copy Link",
      icon: copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-slate-600" />,
      itemClass: "hover:bg-slate-50 text-slate-700",
      iconClass: "text-slate-700",
      onClick: () => {
        handleNativeShareOrCopy();
        closeMenu("Copy Link");
      },
    },
    {
      key: "x",
      label: "Share on X (Short 280-char Hook)",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
      itemClass: "hover:bg-primary/10 text-primary",
      iconClass: "text-slate-900",
      onClick: () => {
        openShare(shareData.twitterUrl);
        closeMenu("X");
      },
    },
    {
      key: "whatsapp",
      label: "Share on WhatsApp",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-600">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.18 2.095 3.195 5.076 4.483.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
      itemClass: "hover:bg-emerald-50 text-emerald-700",
      iconClass: "text-emerald-600",
      onClick: () => {
        openShare(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareData.shareText)}`);
        closeMenu("WhatsApp");
      },
    },
    {
      key: "facebook",
      label: "Share on Facebook",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
      itemClass: "hover:bg-blue-100 text-blue-600",
      iconClass: "text-blue-600",
      onClick: () => {
        copyShareText();
        openShare(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}&quote=${encodeURIComponent(shareData.shareText)}`
        );
        closeMenu("Facebook");
      },
    },
    {
      key: "linkedin",
      label: "Share on LinkedIn",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" /></svg>,
      itemClass: "hover:bg-blue-50 text-blue-700",
      iconClass: "text-blue-700",
      onClick: () => {
        copyShareText();
        openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareData.url)}`);
        closeMenu("LinkedIn");
      },
    },
    {
      key: "telegram",
      label: "Share on Telegram",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>,
      itemClass: "hover:bg-sky-100 text-sky-600",
      iconClass: "text-sky-600",
      onClick: () => {
        openShare(
          `https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.basePostText)}`
        );
        closeMenu("Telegram");
      },
    },
    {
      key: "instagram",
      label: "Share on Instagram",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>,
      itemClass: "hover:bg-pink-50 text-pink-700",
      iconClass: "text-pink-600",
      onClick: () => {
        copyShareText();
        openShare("https://www.instagram.com/");
        closeMenu("Instagram");
      },
    },
    {
      key: "pinterest",
      label: "Save to Pinterest",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m0 19c-3.859 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm3.5-9.5c-.828 0-1.5.672-1.5 1.5s.672 1.5 1.5 1.5 1.5-.672 1.5-1.5-.672-1.5-1.5-1.5z" /></svg>,
      itemClass: "hover:bg-red-50 text-red-700",
      iconClass: "text-red-600",
      onClick: () => {
        openShare(
          `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareData.url)}&description=${encodeURIComponent(shareData.basePostText)}`
        );
        closeMenu("Pinterest");
      },
    },
    {
      key: "email",
      label: "Share via Email",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      ),
      itemClass: "hover:bg-amber-50 text-amber-700",
      iconClass: "text-amber-600",
      onClick: () => {
        window.location.assign(
          `mailto:?subject=${encodeURIComponent(shareData.basePostText.split("\n")[0])}&body=${encodeURIComponent(
            shareData.shareText
          )}`
        );
        closeMenu("Email");
      },
    },
  ];

  const renderItem = (d: Destination) => (
    <button
      key={d.key}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        d.onClick();
      }}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-colors text-left w-full cursor-pointer ${d.itemClass}`}
    >
      {d.icon}
      <span>{d.label}</span>
    </button>
  );

  const dropdownMenu = (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: coords ? `${coords.top}px` : "-9999px",
        left: coords ? `${coords.left}px` : "-9999px",
        zIndex: 99999,
      }}
      className="w-56 p-2 rounded-xl bg-white border border-slate-200 shadow-2xl flex flex-col gap-1 text-xs max-h-96 overflow-y-auto font-sans animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {destinations.slice(0, 1).map(renderItem)}

      {isAdmin && (
        <>
      {/* 2. Share on X (Auto-Filled Long Post for X Premium) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const longArticleText = shareData.tweetArticleText || shareData.shareText;
          const prefilledTwitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(longArticleText)}`;
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(longArticleText).catch(() => {});
          }
          window.open(prefilledTwitterUrl, "_blank", "noopener,noreferrer");
          closeMenu("X Long Post");
        }}
        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-primary/10 text-primary font-semibold transition-colors text-left w-full cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>Share on X (Pre-Filled Long Post)</span>
        </div>
        <span className="text-[9px] uppercase font-bold tracking-wider bg-primary/15 group-hover:bg-primary/25 text-primary px-1.5 py-0.5 rounded transition-colors">
          Auto-Filled
        </span>
      </button>

      {/* 2b. Publish as X Article (Copies to Clipboard + Opens x.com/compose/articles) */}
      <button
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const articleText = shareData.tweetArticleText || shareData.shareText;

          // Copy full article text to clipboard
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            try {
              await navigator.clipboard.writeText(articleText);
            } catch {}
          }

          // Open X's dedicated Article editor
          window.open("https://x.com/compose/articles", "_blank", "noopener,noreferrer");
          closeMenu("X Articles");
        }}
        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-primary/10 text-primary font-semibold transition-colors text-left w-full cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>Write on X Articles (x.com/articles)</span>
        </div>
        <span className="text-[9px] uppercase font-bold tracking-wider bg-slate-100 group-hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded transition-colors">
          Editor
        </span>
      </button>
        </>
      )}

      {/* 2c. Copy & Download Share Card Graphic */}
      {shareData.imageUrl && (
        <div className="flex items-center gap-1 my-0.5 px-1 py-1 rounded-lg bg-primary/10 border border-primary/20">
          <button
            onClick={handleCopyImage}
            title="Copy Share Card image to clipboard to paste (Cmd+V) into your X post"
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-primary/15 text-primary font-medium transition-colors text-[11px] cursor-pointer"
          >
            {copiedImage ? (
              <>
                <Check size={12} className="text-green-600" />
                <span className="text-green-700 font-bold">Image Copied!</span>
              </>
            ) : (
              <>
                <ImageIcon size={12} className="text-primary" />
                <span>Copy Image (Cmd+V)</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownloadImage}
            title="Download Share Card PNG"
            className="p-1.5 rounded-md hover:bg-primary/15 text-primary transition-colors cursor-pointer"
          >
            <Download size={13} />
          </button>
        </div>
      )}

      {destinations.slice(1, 2).map(renderItem)}

      {/* 2e. Share Medium (review-focused) Post on X -- between the bare
          280-char headline hook above and the 800-1500 char X-Premium-only
          long post further up. Leads with "review this person" instead of
          the news summary; still fits the free-tier 280-char limit for most
          names, but works for Premium too since it's not length-gated. */}
      {isAdmin && shareData.mediumTwitterUrl && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(shareData.mediumTwitterUrl, "_blank", "noopener,noreferrer");
            closeMenu("X Medium Post");
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-primary/10 text-primary font-semibold transition-colors text-left w-full cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>Share on X (Medium Post)</span>
        </button>
      )}

      {destinations.slice(2).map(renderItem)}
    </div>
  );

  if (layout === "icons") {
    // Inline row of destination icons (no dropdown) -- used where sharing is
    // the whole point of the screen, e.g. the pick-share dialog.
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Share">
        {destinations
          .filter((d) => d.key !== "pinterest")
          .map((d) => (
            <button
              key={d.key}
              type="button"
              title={d.label}
              aria-label={d.label}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                d.onClick();
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-200 shadow-sm hover:scale-110 hover:shadow-md active:scale-95 transition-all cursor-pointer ${d.iconClass}`}
            >
              {d.icon}
            </button>
          ))}
        {shareData.imageUrl && (
          <button
            type="button"
            title="Copy image (paste it into your post)"
            aria-label="Copy image"
            onClick={handleCopyImage}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-200 shadow-sm hover:scale-110 hover:shadow-md active:scale-95 transition-all cursor-pointer text-primary"
          >
            {copiedImage ? <Check size={16} className="text-green-600" /> : <ImageIcon size={16} />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={handleToggle}
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

      {isOpen && mounted && typeof document !== "undefined" && createPortal(dropdownMenu, document.body)}
    </div>
  );
}
