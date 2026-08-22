"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { X } from "lucide-react";
import { Card, Button, Modal, Textarea, StarRating, Spinner } from "@/components/primitives";
import {
  getMyRatingTimestamp,
  upsertPoliticianRating,
  getPoliticianRatingsList,
  getPoliticianEngagementSummaries,
} from "@/lib/services/ratings";
import { createClient } from "@/lib/supabase/client";
import { getGhostDisplayName } from "@/lib/utils/ghostName";

interface RatingRecord {
  id: string;
  rating: number;
  comment: string | null;
  ghost_id: string;
  created_at: string;
  updated_at: string;
}

// The single "view + post ratings" surface for a politician, reused
// everywhere a politician's star rating is shown as a clickable widget
// (the wall page header, sidebars, candidate chips, office-holder cards,
// the boundary directory). Self-contained: fetches its own reviews/summary/
// cooldown state given just a politician id, so every call site needs is a
// trigger that opens it — no duplicated fetch/submit logic per widget.
export default function PoliticianRatingModal({
  politicianId,
  politicianName,
  onClose,
  onChange,
}: {
  politicianId: string;
  politicianName: string;
  onClose: () => void;
  // Fires with fresh totals right after a successful submit so the widget
  // that opened this modal (already showing a batch-fetched stats row) can
  // update in place instead of re-querying its whole list.
  onChange?: (summary: { avgRating: number; ratingCount: number; commentCount: number }) => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [ratingSummary, setRatingSummary] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [ratingsList, setRatingsList] = useState<RatingRecord[]>([]);
  const [rateValue, setRateValue] = useState(0);
  const [rateComment, setRateComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState("");
  // Timestamp of the viewer's own rating, never its value (sealed like a
  // ballot) — used only to compute the 6-month re-rate cooldown below.
  const [myRatedAt, setMyRatedAt] = useState<string | null>(null);

  const isOwner = !!user && user.id === politicianId;

  const refresh = async () => {
    const [{ data: summaries }, { data: reviews }] = await Promise.all([
      getPoliticianEngagementSummaries(supabase, [politicianId]),
      getPoliticianRatingsList(supabase, politicianId),
    ]);
    const summary = (summaries || [])[0] as
      | { avg_rating: number; rating_count: number; comment_count: number }
      | undefined;
    setRatingSummary({ avg: summary?.avg_rating || 0, count: summary?.rating_count || 0 });
    setRatingsList((reviews || []) as RatingRecord[]);
    return summary;
  };

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      await refresh();
      if (user && isMounted) {
        const { data: myRating } = await getMyRatingTimestamp(supabase, politicianId, user.id);
        if (isMounted) setMyRatedAt(myRating?.updated_at ?? null);
      }
      if (isMounted) setLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [politicianId, user?.id]);

  // Mirrors the RPC's `INTERVAL '6 months'` check — server-side is what
  // actually enforces this, this just drives the composer's visibility so
  // the viewer isn't allowed to fill out a form the backend will reject.
  const ratingCooldownEnd = myRatedAt ? new Date(myRatedAt) : null;
  if (ratingCooldownEnd) ratingCooldownEnd.setMonth(ratingCooldownEnd.getMonth() + 6);
  const isRatingLocked = !!ratingCooldownEnd && ratingCooldownEnd > new Date();

  const handleSubmitRating = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (rateValue < 1) {
      setRatingError("Pick a star rating first.");
      return;
    }

    setRatingSubmitting(true);
    setRatingError("");
    try {
      const { error } = await upsertPoliticianRating(supabase, politicianId, rateValue, rateComment.trim());
      if (error) throw error;

      const summary = await refresh();
      setMyRatedAt(new Date().toISOString());
      setRateValue(0);
      setRateComment("");
      if (summary) {
        onChange?.({
          avgRating: summary.avg_rating || 0,
          ratingCount: summary.rating_count || 0,
          commentCount: summary.comment_count || 0,
        });
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Failed to submit rating.";
      setRatingError(msg);
    } finally {
      setRatingSubmitting(false);
    }
  };

  return (
    <Modal onOverlayClick={onClose}>
      {/* !bg-surface overrides Card's default translucent "glass" look
          (bg-surface/30) -- fine for a card embedded in a page, but this
          modal sits over a blurred overlay + whatever page opened it, and
          the translucent version read as washed-out/hard to read there.
          Same fix MissionRegisterCTA already applies to its own modal. */}
      <Card padding="lg" className="!bg-surface space-y-6 w-[90vw] max-w-4xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="font-bold text-lg text-text-main">{politicianName}</h2>
            <StarRating value={ratingSummary.avg} count={ratingSummary.count} size="sm" className="mt-2" />
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <>
            {isOwner ? (
              <p className="text-sm text-text-muted italic py-4 px-3 bg-surface/30 rounded-2xl border border-border-light/20">
                You can&apos;t rate your own profile.
              </p>
            ) : !user ? (
              <Button size="md" className="w-full font-semibold" onClick={() => router.push("/auth")}>
                Sign in to share your feedback
              </Button>
            ) : isRatingLocked ? (
              <div className="p-5 bg-primary/10 rounded-2xl border-2 border-primary/30">
                <p className="font-bold text-base text-status-text mb-2">You already rated this person</p>
                <p className="text-base text-status-text leading-relaxed">Come back on <span className="font-bold text-status-highlight">{ratingCooldownEnd?.toLocaleDateString()}</span> to rate again.</p>
              </div>
            ) : (
              <div className="space-y-5 pb-6 border-b border-border-light/20">
                <div>
                  <p className="text-sm font-semibold text-label-text uppercase tracking-wide mb-4">Rate their performance</p>
                  <div className="flex justify-center py-4 bg-surface/30 rounded-2xl">
                    <StarRating value={rateValue} size="lg" onChange={setRateValue} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Share your thoughts (optional)</p>
                  <Textarea
                    placeholder="What's your experience? E.g., 'Listened to my concerns' or 'Needs to do better on local issues'..."
                    value={rateComment}
                    onChange={(e) => setRateComment(e.target.value)}
                    rows={4}
                    className="resize-none text-base"
                  />
                </div>
                {ratingError && <p className="text-danger text-sm font-semibold px-2">{ratingError}</p>}
                <Button
                  type="button"
                  className="w-full font-semibold text-base"
                  disabled={ratingSubmitting}
                  onClick={handleSubmitRating}
                  size="lg"
                >
                  {ratingSubmitting ? "Submitting..." : "Submit Your Rating"}
                </Button>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-label-text uppercase tracking-wide mb-4">Community feedback</p>
              <div className="space-y-3">
                {ratingsList.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-surface/20 rounded-2xl border border-border-light/30">
                    <p className="text-sm font-semibold text-text-muted mb-1">No feedback yet</p>
                    <p className="text-xs text-text-muted">Be the first to share what you think.</p>
                  </div>
                ) : (
                  ratingsList.map((review) => (
                    <div
                      key={review.id}
                      className="p-4 bg-surface/40 rounded-2xl border border-border-light/30 hover:border-border-light/50 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-text-main">
                          {getGhostDisplayName(review.ghost_id)}
                        </span>
                        <span className="text-[11px] font-medium text-text-muted">
                          {new Date(review.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <StarRating value={review.rating} size="xs" />
                      {review.comment && (
                        <p className="text-sm text-text-secondary leading-relaxed">{review.comment}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </Modal>
  );
}
