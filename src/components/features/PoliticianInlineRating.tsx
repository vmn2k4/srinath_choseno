"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Textarea, StarRating, Spinner } from "@/components/primitives";
import { getMyRatingTimestamp, upsertPoliticianRating, getPoliticianRatingsList } from "@/lib/services/ratings";
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

// Inline "leave a review" panel — the non-modal alternative to
// PoliticianRatingModal. Expands in place under whatever trigger renders it
// (a news article's rate row, the wall page header, the election results
// poll) instead of opening a popup or navigating away, so the reader never
// loses their spot on the page. Posts through the exact same
// upsert_politician_rating RPC as the modal, so a rating cast here is the
// same row the wall page and every other widget read back — just a
// different entry point onto identical data. Also shows past reviews (same
// getPoliticianRatingsList query the modal uses) in a capped, scrollable
// list — every call site of this component gets that for free rather than
// each one needing its own copy.
export default function PoliticianInlineRating({
  politicianId,
  politicianName,
  onSubmitted,
  onCancel,
}: {
  politicianId: string;
  politicianName: string;
  // Fires right after a successful submit (no payload — this widget doesn't
  // know the true new aggregate, only its own vote) so the caller can
  // re-fetch the real summary for its own stats row.
  onSubmitted?: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rateValue, setRateValue] = useState(0);
  const [rateComment, setRateComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Timestamp of the viewer's own rating, never its value — used only to
  // compute the 6-month re-rate cooldown below (mirrors the modal).
  const [myRatedAt, setMyRatedAt] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reviews, setReviews] = useState<RatingRecord[]>([]);

  const isOwner = !!user && user.id === politicianId;

  const loadReviews = async () => {
    const { data } = await getPoliticianRatingsList(supabase, politicianId);
    setReviews((data || []) as RatingRecord[]);
  };

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      // Reviews are public — fetched regardless of sign-in state, so a
      // signed-out visitor can still see what others said before deciding
      // whether to sign in and rate themselves.
      const reviewsPromise = getPoliticianRatingsList(supabase, politicianId);
      const myRatingPromise = user ? getMyRatingTimestamp(supabase, politicianId, user.id) : null;
      const [{ data: reviewsData }, myRatingResult] = await Promise.all([reviewsPromise, myRatingPromise]);
      if (isMounted) {
        setReviews((reviewsData || []) as RatingRecord[]);
        setMyRatedAt(myRatingResult?.data?.updated_at ?? null);
        setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [politicianId, user?.id]);

  // Mirrors the RPC's `INTERVAL '6 months'` check — server-side is what
  // actually enforces this, this just drives the composer's visibility.
  const cooldownEnd = myRatedAt ? new Date(myRatedAt) : null;
  if (cooldownEnd) cooldownEnd.setMonth(cooldownEnd.getMonth() + 6);
  const isLocked = !!cooldownEnd && cooldownEnd > new Date();

  const handleSubmit = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (rateValue < 1) {
      setError("Pick a star rating first.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { error: submitError } = await upsertPoliticianRating(supabase, politicianId, rateValue, rateComment.trim());
      if (submitError) throw submitError;

      onSubmitted?.();
      setMyRatedAt(new Date().toISOString());
      setSubmitted(true);
      loadReviews();
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Failed to submit rating.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 p-4 bg-surface/40 rounded-xl border border-border-light/30 space-y-4">
      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : (
        <>
          {submitted ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-success">Thanks — your rating for {politicianName} was posted.</p>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Close
              </Button>
            </div>
          ) : isOwner ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-muted italic">You can&apos;t rate your own profile.</p>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Close
              </Button>
            </div>
          ) : !user ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-text-muted">Sign in to rate {politicianName}.</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => router.push("/auth")}>
                  Sign in
                </Button>
              </div>
            </div>
          ) : isLocked ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-text-secondary">
                You already rated {politicianName}. Come back on{" "}
                <span className="font-semibold text-text-main">{cooldownEnd?.toLocaleDateString()}</span> to rate again.
              </p>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Close
              </Button>
            </div>
          ) : (
            <>
              {/* Star picker sits right next to the label instead of its own
                  centered row below — that used to add a whole extra row
                  of vertical space just to show 5 stars. Label shortens and
                  stars shrink on mobile so the whole row fits on one line
                  instead of wrapping. */}
              <div className="flex items-center justify-between gap-2 flex-nowrap">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <p className="text-[0.65rem] sm:text-xs font-semibold text-label-text uppercase tracking-wide shrink-0 truncate">
                    Rate {politicianName.trim().split(" ").pop()}
                    <span className="hidden sm:inline">&apos;s Performance</span>
                  </p>
                  <StarRating value={rateValue} size="sm" className="sm:hidden" onChange={setRateValue} />
                  <StarRating value={rateValue} size="md" className="hidden sm:inline-flex" onChange={setRateValue} />
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 px-2" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
              <Textarea
                placeholder="Share your thoughts (optional)…"
                value={rateComment}
                onChange={(e) => setRateComment(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
              {error && <p className="text-danger text-xs font-semibold">{error}</p>}
              <Button
                type="button"
                className="w-full font-semibold"
                disabled={submitting}
                onClick={handleSubmit}
                size="md"
              >
                {submitting ? "Submitting…" : "Submit Rating"}
              </Button>
            </>
          )}

          {/* Past reviews — same getPoliticianRatingsList data the modal
              shows, capped to a scrollable panel so a well-reviewed
              politician doesn't blow up the height of whatever page
              embeds this (news article, wall header, election poll row). */}
          <div className="pt-3 border-t border-border-light/20">
            <p className="text-xs font-semibold text-label-text uppercase tracking-wide mb-2">
              Community feedback{reviews.length > 0 ? ` (${reviews.length})` : ""}
            </p>
            {reviews.length === 0 ? (
              <p className="text-xs text-text-muted italic py-1">No feedback yet — be the first to share what you think.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-3 bg-surface/60 rounded-lg border border-border-light/20 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-text-main">
                        {getGhostDisplayName(review.ghost_id)}
                      </span>
                      <span className="text-[10px] font-medium text-text-muted">
                        {new Date(review.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <StarRating value={review.rating} size="xs" />
                    {review.comment && (
                      <p className="text-xs text-text-secondary leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
