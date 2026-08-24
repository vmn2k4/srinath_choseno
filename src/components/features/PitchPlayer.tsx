"use client";

import React, { useRef } from "react";
import Link from "next/link";
import Modal from "@/components/primitives/Modal";
import { Avatar, Badge, Spinner } from "@/components/primitives";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import { normalizeMediaUrl } from "@/lib/services/video";
import {
  X,
  ChevronUp,
  ChevronDown,
  Heart,
  MessageCircle,
  Send,
  AlertCircle,
  CheckCircle2,
  Share2,
  Check,
} from "lucide-react";

export interface PitchComment {
  id: string;
  ghost_id: string;
  content: string;
  created_at: string | null;
}

export interface PitchSlide {
  id: string;
  videoUrl: string | null;
  // The linked `posts` row id this slide's like/comment/share act on. null
  // means there's nothing to react to (e.g. a pre-recorded question prompt
  // with no answer yet) -- the whole action rail is hidden for that slide.
  postId: string | null;
  // Top overlay, e.g. {label: "Question", text: "..."} / {label: "Answer", text: "..."}
  caption?: { label: string; text: string } | null;
  authorName: string;
  authorAvatarUrl?: string | null;
  likesCount: number;
  comments: PitchComment[];
  // ghost_id of this slide's own candidate/owner -- flags their replies with
  // a "Candidate" badge in the comment thread, same as PostCard does for the
  // main feed.
  ownerGhostId?: string | null;
  shareUrl?: string | null;
  noVideoMessage?: string;
  autoPlayOnEnd?: boolean;
}

// Shared full-screen, reels-style (up/down) video pitch viewer. Renders the
// 9:16 frame, swipe/wheel/arrow-key navigation, the like+comment+share
// action rail, and the comments drawer -- the exact same building blocks
// every place a "pitch" video plays, so QuestionAnswerCarousel (one
// question, every candidate's answer) and PlayInterviewReel (one
// candidate, every question then answer) don't each carry their own copy.
// Purely presentational: all data-fetching and the like/comment mutations
// themselves stay in the two callers, which is also where "postId" and
// "shareUrl" get resolved to whatever data shape their query returns.
export default function PitchPlayer({
  title,
  slides,
  index,
  loading = false,
  emptyMessage = "Nothing to show yet.",
  isComplete = false,
  completeTitle,
  completeSubtitle,
  onWatchAgain,
  footerLabel,
  showComments,
  onToggleComments,
  commentText,
  onCommentTextChange,
  onSubmitComment,
  posting = false,
  canComment = true,
  likedSlideIds,
  onLike,
  onClose,
  canGoNext,
  canGoPrev,
  onNext,
  onPrev,
}: {
  title?: string;
  slides: PitchSlide[];
  index: number;
  loading?: boolean;
  emptyMessage?: string;
  isComplete?: boolean;
  completeTitle?: string;
  completeSubtitle?: string;
  onWatchAgain?: () => void;
  footerLabel?: string;
  showComments: boolean;
  onToggleComments: () => void;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  posting?: boolean;
  canComment?: boolean;
  likedSlideIds: Set<string>;
  onLike: (slide: PitchSlide) => void;
  onClose: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}) {
  const touchStartY = useRef<number | null>(null);
  const [copiedShare, setCopiedShare] = React.useState(false);
  const current = slides[index];

  const handleShare = async (slide: PitchSlide) => {
    if (!slide.shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title: slide.authorName, url: slide.shareUrl });
        return;
      }
    } catch {
      // user cancelled the native share sheet, or it's unsupported -- fall
      // through to the copy-link path either way.
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(slide.shareUrl);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }
    } catch {
      // Clipboard access can be denied by the browser (e.g. an unfocused
      // document, or a permissions policy) -- nothing useful to do beyond
      // not crashing; the share URL is still visible in the address bar
      // the user came from.
    }
  };

  return (
    <Modal overlayClassName="bg-black/95 backdrop-blur-md" zIndexClassName="z-modal" onOverlayClick={onClose}>
      <div className="relative flex flex-col items-center w-full" style={{ maxWidth: "95vw" }}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-2 sm:top-2 sm:right-2 z-30 w-9 h-9 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer border border-white/20 shadow-lg"
          title="Close"
        >
          <X size={18} />
        </button>

        {title && <p className="text-white text-sm font-semibold text-center px-4 mb-2 max-w-md">{title}</p>}

        {loading ? (
          <div className="w-full flex justify-center py-16">
            <Spinner />
          </div>
        ) : slides.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-2xl border border-border-light max-w-sm">
            <AlertCircle size={32} className="text-warning mx-auto mb-2" />
            <p className="text-sm text-text-main font-semibold">{emptyMessage}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Progress dots -- one per slide */}
            <div className="flex gap-1 mb-2" style={{ width: "min(75vh * 9 / 16, 95vw)" }}>
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  className={`h-0.5 flex-1 rounded-full ${isComplete || i <= index ? "bg-white" : "bg-white/25"}`}
                />
              ))}
            </div>

            <div
              className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 flex items-center justify-center"
              style={{ aspectRatio: "9 / 16", height: "min(75vh, 720px)", maxWidth: "95vw" }}
              onWheel={(e) => {
                if (isComplete) return;
                if (e.deltaY > 30) onNext();
                else if (e.deltaY < -30) onPrev();
              }}
              onTouchStart={(e) => {
                if (isComplete) return;
                touchStartY.current = e.touches[0].clientY;
              }}
              onTouchEnd={(e) => {
                if (isComplete || touchStartY.current == null) return;
                const delta = touchStartY.current - e.changedTouches[0].clientY;
                if (delta > 50) onNext();
                else if (delta < -50) onPrev();
                touchStartY.current = null;
              }}
            >
              {isComplete ? (
                <div className="text-center p-8 space-y-3">
                  <CheckCircle2 size={40} className="text-success mx-auto" />
                  <p className="text-white font-bold">{completeTitle || "That's all of it"}</p>
                  {completeSubtitle && <p className="text-white/60 text-xs">{completeSubtitle}</p>}
                  {onWatchAgain && (
                    <button
                      onClick={onWatchAgain}
                      className="mt-2 px-4 py-2 bg-white text-black rounded-full text-xs font-bold cursor-pointer"
                    >
                      Watch Again
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {current?.videoUrl ? (
                    <video
                      key={current.id}
                      src={normalizeMediaUrl(current.videoUrl)}
                      controls
                      autoPlay
                      playsInline
                      onEnded={current.autoPlayOnEnd ? onNext : undefined}
                      className="w-full h-full object-cover bg-black"
                    />
                  ) : (
                    <div className="text-white/60 text-xs text-center p-6">
                      {current?.noVideoMessage || "No video for this answer."}
                    </div>
                  )}

                  {current?.caption && (
                    <div className="absolute top-3 inset-x-3 bg-black/50 rounded-xl px-3 py-2 pointer-events-none">
                      <p className="text-primary-light text-[10px] font-bold uppercase tracking-wider mb-0.5">
                        {current.caption.label}
                      </p>
                      <p className="text-white text-xs font-medium line-clamp-2">{current.caption.text}</p>
                    </div>
                  )}

                  {/* Identity, bottom-left */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 max-w-[60%]">
                    <Avatar src={current?.authorAvatarUrl} name={current?.authorName || "Candidate"} size="sm" />
                    <span className="text-white text-sm font-bold drop-shadow truncate">
                      {current?.authorName || "Candidate"}
                    </span>
                  </div>

                  {/* Action rail: like + comment + share -- only for a slide
                      with a real linked post, e.g. an answer clip, not a
                      bare question prompt with nothing to react to. */}
                  {current?.postId && (
                    <div className="absolute bottom-3 right-3 flex flex-col items-center gap-4">
                      <button
                        onClick={() => onLike(current)}
                        className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
                        title={likedSlideIds.has(current.postId) ? "Unlike this answer" : "Like this answer"}
                      >
                        <span className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                          <Heart size={20} className={likedSlideIds.has(current.postId) ? "fill-current text-danger" : ""} />
                        </span>
                        <span className="text-[11px] font-semibold drop-shadow">{current.likesCount}</span>
                      </button>
                      <button
                        onClick={onToggleComments}
                        className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
                        title="Comments"
                      >
                        <span className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                          <MessageCircle size={20} />
                        </span>
                        <span className="text-[11px] font-semibold drop-shadow">{current.comments.length}</span>
                      </button>
                      {current.shareUrl && (
                        <button
                          onClick={() => handleShare(current)}
                          className="flex flex-col items-center gap-0.5 text-white cursor-pointer"
                          title="Share this video"
                        >
                          <span className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                            {copiedShare ? <Check size={18} className="text-success" /> : <Share2 size={18} />}
                          </span>
                          <span className="text-[11px] font-semibold drop-shadow">
                            {copiedShare ? "Copied" : "Share"}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {canGoPrev && (
                    <button
                      onClick={onPrev}
                      className="absolute top-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white cursor-pointer"
                      title="Previous"
                    >
                      <ChevronUp size={18} />
                    </button>
                  )}
                  {canGoNext && (
                    <button
                      onClick={onNext}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white cursor-pointer"
                      title="Next"
                    >
                      <ChevronDown size={18} />
                    </button>
                  )}

                  {/* Comments drawer */}
                  {showComments && current?.postId && (
                    <div className="absolute inset-x-0 bottom-0 max-h-[55%] bg-black/85 backdrop-blur-sm rounded-t-2xl p-3 flex flex-col gap-2">
                      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                        {current.comments.length === 0 ? (
                          <p className="text-white/50 text-xs text-center py-4">No comments yet — be the first.</p>
                        ) : (
                          current.comments.map((c) => {
                            const isOwnerReply = current.ownerGhostId && c.ghost_id === current.ownerGhostId;
                            // docs/PLATFORM_SPEC.md §3A: choosing "politician"
                            // requires a real public full name specifically
                            // because it appears publicly, unlike the
                            // anonymous pseudonym citizens get -- so the
                            // candidate's own reply on their own answer shows
                            // their real name (still badged, per §3C's
                            // "spotlighted replies... badged as the owner"),
                            // not the Ghost pseudonym. Any other commenter
                            // here is a citizen and stays fully anonymous.
                            const displayName = isOwnerReply ? current.authorName : getGhostDisplayName(c.ghost_id);
                            return (
                              <div key={c.id} className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-white/60">{displayName}</span>
                                  {isOwnerReply && (
                                    <Badge tone="primary" className="text-[9px] px-1.5 py-0">
                                      Candidate
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-white/90">{c.content}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {canComment ? (
                        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                          <input
                            value={commentText}
                            onChange={(e) => onCommentTextChange(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && onSubmitComment()}
                            placeholder="Add a comment..."
                            className="flex-1 bg-white/10 text-white placeholder-white/40 text-xs rounded-full px-3 py-2 outline-none"
                          />
                          <button
                            onClick={onSubmitComment}
                            disabled={posting || !commentText.trim()}
                            className="text-white cursor-pointer disabled:opacity-40"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      ) : (
                        <Link href="/auth" className="text-xs text-white/70 underline text-center py-1">
                          Sign in to comment
                        </Link>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {footerLabel && !isComplete && (
              <p className="text-white/50 text-xs text-center mt-2">{footerLabel}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
