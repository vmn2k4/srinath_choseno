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
      <Card padding="md" className="space-y-4 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-sm text-text-main">{politicianName}</h3>
            <StarRating value={ratingSummary.avg} count={ratingSummary.count} size="sm" className="mt-1" />
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <>
            {isOwner ? (
              <p className="text-xs text-text-muted italic pb-3 border-b border-border-light/20">
                You can&apos;t rate your own profile.
              </p>
            ) : !user ? (
              <Button size="sm" className="w-full" onClick={() => router.push("/auth")}>
                Log in to leave a rating
              </Button>
            ) : isRatingLocked ? (
              <div className="p-3 bg-surface/40 rounded-xl border border-border-light/30 text-xs text-text-muted">
                You&apos;ve already rated this politician. You can rate again on{" "}
                <span className="font-semibold text-text-secondary">
                  {ratingCooldownEnd?.toLocaleDateString()}
                </span>
                .
              </div>
            ) : (
              <div className="space-y-3 pb-4 border-b border-border-light/20">
                <div className="flex justify-center py-1">
                  <StarRating value={rateValue} size="lg" onChange={setRateValue} />
                </div>
                <Textarea
                  placeholder="Share your experience with this politician's performance (optional)..."
                  value={rateComment}
                  onChange={(e) => setRateComment(e.target.value)}
                  rows={3}
                />
                {ratingError && <p className="text-danger text-xs">{ratingError}</p>}
                <Button type="button" className="w-full" disabled={ratingSubmitting} onClick={handleSubmitRating}>
                  {ratingSubmitting ? "Submitting..." : "Submit Rating"}
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {ratingsList.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">No reviews yet — be the first.</p>
              ) : (
                ratingsList.map((review) => (
                  <div
                    key={review.id}
                    className="p-3 bg-surface/30 rounded-xl border border-border-light/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StarRating value={review.rating} size="xs" />
                      <span className="text-[10px] text-text-muted">
                        {new Date(review.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-text-secondary leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Card>
    </Modal>
  );
}
