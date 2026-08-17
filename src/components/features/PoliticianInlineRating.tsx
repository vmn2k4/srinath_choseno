"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Textarea, StarRating, Spinner } from "@/components/primitives";
import { getMyRatingTimestamp, upsertPoliticianRating } from "@/lib/services/ratings";
import { createClient } from "@/lib/supabase/client";

// Inline "leave a review" panel — the non-modal alternative to
// PoliticianRatingModal. Expands in place under whatever trigger renders it
// (a news article's rate row, the wall page header) instead of opening a
// popup or navigating away, so the reader never loses their spot on the
// page. Posts through the exact same upsert_politician_rating RPC as the
// modal, so a rating cast here is the same row the wall page and every
// other widget read back — just a different entry point onto identical data.
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

  const isOwner = !!user && user.id === politicianId;

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: myRating } = await getMyRatingTimestamp(supabase, politicianId, user.id);
      if (isMounted) {
        setMyRatedAt(myRating?.updated_at ?? null);
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
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Failed to submit rating.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 p-4 bg-surface/40 rounded-xl border border-border-light/30 space-y-4">
      {submitted ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-success">Thanks — your rating for {politicianName} was posted.</p>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Close
          </Button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-label-text uppercase tracking-wide">Rate their performance</p>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          <div className="flex justify-center py-2">
            <StarRating value={rateValue} size="lg" onChange={setRateValue} />
          </div>
          <Textarea
            placeholder="Share your thoughts (optional)…"
            value={rateComment}
            onChange={(e) => setRateComment(e.target.value)}
            rows={3}
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
    </div>
  );
}
