// JSX layout for the generic share card used by politician walls, wall
// post threads, and candidacy pages. Ported from buildOgCardElement in
// src/lib/utils/ogCard.tsx -- see the header comment in
// ../generate-news-og-image/card.tsx for why this is a standalone copy
// rather than an import.
//
// v2 (2026-08-26): full redesign, deliberately unlike v1's pastel-gradient
// "civic dashboard" card. The one job this card has is making a stranger
// scrolling social media understand, in under a second, that they can leave
// an anonymous review of this specific person -- v1 buried that in a small
// footer band under a big empty name card. This version leads with a
// full-bleed photo (poster-style) and a bold dark CTA panel built around a
// direct question, a visible "100% anonymous" badge, and one big button.
import React from 'npm:react@^19';

export interface OgCardInput {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  photoUrl?: string | null;
  /** Political party, shown under the name on the photo panel when provided. */
  partyName?: string | null;
  /**
   * Rating summary. Omitted entirely (both left undefined) by callers that
   * don't have this data yet -- the wall-post-thread and candidacy cards --
   * so it falls back to "Be the first to review" copy, which is a reasonable
   * default even when we don't actually know (better than claiming a count
   * that might be wrong). Only the wall profile card (the one page that
   * already fetches this for its own metadata) passes real values.
   */
  ratingAvg?: number | null;
  ratingCount?: number | null;
  /**
   * Most recent published headline tagged to this person, and their total
   * tagged-article count -- wall-profile-card-only, same reasoning as
   * ratingAvg/ratingCount above. Shown as a small "in the news" line so the
   * card's anonymous-review pitch feels grounded in something real instead
   * of purely generic.
   */
  latestHeadline?: string | null;
  newsCount?: number | null;
}

function truncateWordSafe(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.65) {
    return `${truncated.slice(0, lastSpace).trimEnd()}…`;
  }
  return `${truncated.trimEnd()}…`;
}

function StarRow({ filled, size, color }: { filled: number; size: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= filled ? color : 'none'} stroke={color} strokeWidth={i <= filled ? 0 : 1.5}>
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </div>
  );
}

export function ProfileOgCard({
  title,
  subtitle,
  photoUrl,
  partyName,
  ratingAvg,
  ratingCount,
  latestHeadline,
  newsCount,
}: OgCardInput) {
  const safeTitle = truncateWordSafe(title, 42);
  const safeSubtitle = subtitle ? truncateWordSafe(subtitle, 70) : null;
  const initialLetter = title.trim() ? title.trim().charAt(0).toUpperCase() : 'C';
  const firstName = title.trim().split(/\s+/)[0] || title;

  const hasRatingData = ratingCount !== undefined && ratingCount !== null && ratingCount > 0;
  const filledStars = hasRatingData ? Math.round(ratingAvg || 0) : 0;
  const statsLine = hasRatingData
    ? `${ratingAvg?.toFixed(1)}/5 from ${ratingCount} review${ratingCount === 1 ? '' : 's'}`
    : 'Be the first to review';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: 'sans-serif',
        background: '#0b0d14',
      }}
    >
      {/* Left: full-bleed photo poster. No pastel card-in-a-card, no letter
          circle floating in whitespace -- the photo (or a bold placeholder)
          fills the whole left panel like a magazine cover. */}
      <div style={{ display: 'flex', position: 'relative', width: 500, height: 630, background: '#1a1d29', overflow: 'hidden' }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={title}
            width="500"
            height="630"
            style={{ position: 'absolute', top: 0, left: 0, width: 500, height: 630, objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ display: 'flex', fontSize: 220, fontWeight: 900, color: '#2d3142' }}>{initialLetter}</span>
          </div>
        )}

        {/* Bottom scrim so white name text stays legible over any photo. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 260,
            display: 'flex',
            background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 100%)',
          }}
        />

        <div style={{ position: 'absolute', top: 28, left: 28, display: 'flex' }}>
          <span
            style={{
              display: 'flex',
              fontSize: 13,
              fontWeight: 800,
              color: '#ffffff',
              background: 'rgba(0,0,0,0.55)',
              padding: '7px 16px',
              borderRadius: 999,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}
          >
            Public figure
          </span>
        </div>

        <div style={{ position: 'absolute', left: 28, right: 28, bottom: 28, display: 'flex', flexDirection: 'column' }}>
          <span style={{ display: 'flex', fontSize: 38, fontWeight: 900, color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            {safeTitle}
          </span>
          {(safeSubtitle || partyName) && (
            <span style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: '#cbd5e1', marginTop: 6 }}>
              {[partyName, safeSubtitle].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>

      {/* Right: the actual pitch. Dark solid panel, one direct question,
          visible star row, an explicit anonymity badge, one big button. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          height: 630,
          padding: '40px 44px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="og-orange-top" x1="4" y1="8" x2="44" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ff8c00" />
              </linearGradient>
              <linearGradient id="og-orange-bottom" x1="44" y1="28" x2="8" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            <path d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z" fill="url(#og-orange-top)" />
            <path d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z" fill="url(#og-orange-bottom)" />
            <circle cx="24" cy="24" r="6" fill="#0b0d14" />
            <circle cx="24" cy="24" r="3.5" fill="#f97316" />
          </svg>
          <span style={{ display: 'flex', fontSize: 20, fontWeight: 900, color: '#ffffff' }}>Choseno</span>
        </div>

        {/* Few, huge, high-contrast elements only -- this card is almost
            always viewed shrunk to a small thumbnail (iMessage, WhatsApp,
            a Twitter feed), where a descriptive sentence and small gray
            fine print (both present in v1 of this redesign) turn to mush.
            Every line here needs to survive being viewed at ~350px wide. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <span style={{ display: 'flex', fontSize: 58, fontWeight: 900, color: '#ffffff', lineHeight: 1.08, letterSpacing: '-0.02em' }}>
            Rate {firstName}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <StarRow filled={filledStars} size={34} color="#fbbf24" />
            <span style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: '#fbbf24' }}>{statsLine}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              alignSelf: 'flex-start',
              background: '#083344',
              padding: '10px 20px',
              borderRadius: 999,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span style={{ display: 'flex', fontSize: 20, fontWeight: 900, color: '#67e8f9' }}>100% anonymous</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            alignSelf: 'flex-start',
            background: '#f97316',
            padding: '20px 36px',
            borderRadius: 14,
          }}
        >
          <span style={{ display: 'flex', fontSize: 24, fontWeight: 900, color: '#ffffff' }}>Write a review</span>
          <span style={{ display: 'flex', fontSize: 24, color: '#ffffff' }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ── Story card (810x1440, 9:16) ─────────────────────────────────────────
// A separate asset for posting natively to Instagram/Facebook/Snapchat
// Stories or as a Reel cover -- NOT what's embedded via og:image/twitter:
// image. Every platform that unfurls a pasted link (Twitter/X, Facebook,
// WhatsApp, iMessage, LinkedIn, Slack) hard-codes that card to a landscape
// ~1.91:1 shape; dropping a 9:16 image into that slot gets cropped or
// squished, not shown in full. This renders full-bleed photo + a
// bottom-anchored dark scrim with the same anonymous-review pitch as
// ProfileOgCard, kept inside Instagram's own Story safe zone (roughly the
// top and bottom of the frame are covered by that app's own UI chrome --
// profile/close controls up top, reply bar at the bottom). All pixel
// values below are hand-scaled to STORY_SIZE (810x1440 in index.ts) --
// keep them in that same 3:4 relationship to each other if STORY_SIZE
// ever changes; they don't derive from it automatically.
export function ProfileStoryCard({ title, subtitle, photoUrl, partyName, ratingAvg, ratingCount }: OgCardInput) {
  const safeTitle = truncateWordSafe(title, 34);
  const safeSubtitle = subtitle ? truncateWordSafe(subtitle, 50) : null;
  const initialLetter = title.trim() ? title.trim().charAt(0).toUpperCase() : 'C';
  const firstName = title.trim().split(/\s+/)[0] || title;

  const hasRatingData = ratingCount !== undefined && ratingCount !== null && ratingCount > 0;
  const filledStars = hasRatingData ? Math.round(ratingAvg || 0) : 0;
  const statsLine = hasRatingData
    ? `${ratingAvg?.toFixed(1)}/5 · ${ratingCount} review${ratingCount === 1 ? '' : 's'}`
    : 'Be the first to review';

  // Built as a top-to-bottom flex column (banner, a flexible middle
  // spacer, then bottom content) instead of hand-placed absolute-pixel
  // offsets -- the spacer absorbs whatever room is left, so this can't
  // overflow the 1440px canvas regardless of how much bottom content
  // there is. The bottom-content block's own position (padding/anchoring)
  // never depends on photoUrl -- it's identical between both cases, so
  // name/stars/button/etc land in the same place on the canvas either
  // way. Only what fills the middle spacer differs: the photo (painted
  // behind everything, showing through the transparent spacer) or, with
  // no photo, a large initial circle centered in that same spacer.
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: '#0b0d14', fontFamily: 'sans-serif' }}>
      {/* The one and only place this card forks on photoUrl: a full-bleed
          background layer that's either the real photo or, without one, a
          centered initial circle in the same spot a face would occupy.
          Everything else on the card -- banner text, bottom content,
          alignment -- is identical regardless of which branch renders. */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={title}
          width="810"
          height="1440"
          style={{ position: 'absolute', top: 0, left: 0, width: 810, height: 1440, objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 810,
            height: 1440,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Warm radial glow behind the circle instead of flat black --
            // echoes the orange textShadow already on the initial letter
            // so the two read as one lit-from-within effect, fading out to
            // the same near-black the photo case's scrim bottoms out at.
            background: 'radial-gradient(circle at 50% 42%, rgba(249,115,22,0.22) 0%, rgba(17,20,30,1) 55%, #05060a 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 480,
              height: 480,
              borderRadius: 240,
              alignItems: 'center',
              justifyContent: 'center',
              border: '7px solid rgba(255,255,255,0.45)',
            }}
          >
            <span style={{ display: 'flex', fontSize: 220, fontWeight: 900, color: '#ffffff', textShadow: '0 0 50px rgba(249,115,22,0.75)' }}>
              {initialLetter}
            </span>
          </div>
        </div>
      )}

      {/* Top banner -- a light "sticker" card overlapping the background
          layer, the one loud, unmissable line on the whole card. Same text
          regardless of photoUrl. Deliberately dark text on a light card
          rather than white-on-photo: guarantees contrast no matter what's
          underneath. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          margin: '28px 28px 0',
          background: 'rgba(241,245,249,0.97)',
          borderRadius: 22,
          padding: '30px 32px',
          position: 'relative',
          zIndex: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', fontSize: 21, fontWeight: 800, color: '#334155' }}>Google reviews for politicians</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="og-orange-top" x1="4" y1="8" x2="44" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ff8c00" />
                </linearGradient>
                <linearGradient id="og-orange-bottom" x1="44" y1="28" x2="8" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <path d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z" fill="url(#og-orange-top)" />
              <path d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z" fill="url(#og-orange-bottom)" />
              <circle cx="24" cy="24" r="6" fill="#f1f5f9" />
              <circle cx="24" cy="24" r="3.5" fill="#f97316" />
            </svg>
            <span style={{ display: 'flex', fontSize: 30, fontWeight: 900, color: '#0f172a' }}>Choseno</span>
          </div>
        </div>
        <span style={{ display: 'flex', fontSize: 34, fontWeight: 900, color: '#0f172a', lineHeight: 1.15, textAlign: 'center' }}>
          {`SHARE YOUR VOICE: REVIEW ${firstName.toUpperCase()} NOW`}
        </span>
      </div>

      {/* Flexible spacer -- pure layout plumbing, no content. Pushes the
          bottom content block down to the bottom of the column regardless
          of which background layer rendered above. */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 2 }} />

      {/* Scrim -- darkens the background layer so text stays legible.
          Always rendered, same for both cases; on the flat no-photo
          background it just deepens an already-dark area near the bottom. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 760,
          display: 'flex',
          background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.88) 45%, rgba(0,0,0,0) 100%)',
          zIndex: 3,
        }}
      />

      {/* Bottom content -- identical for both cases, full stop. No
          photoUrl conditionals here at all: same padding, same
          left-alignment, same everything. The only thing that changes
          between a person on Choseno and one who isn't is the middle
          spacer above (photo vs. initial circle) -- this block doesn't
          know or care which one it got. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '0 44px 40px',
          position: 'relative',
          zIndex: 5,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ display: 'flex', fontSize: 44, fontWeight: 900, color: '#f97316', lineHeight: 1.08, letterSpacing: '-0.02em' }}>
          {safeTitle}
        </span>

        {(partyName || safeSubtitle) && (
          <span style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: '#cbd5e1' }}>
            {[partyName, safeSubtitle].filter(Boolean).join(' · ')}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StarRow filled={filledStars} size={26} color="#fbbf24" />
          <span style={{ display: 'flex', fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{statsLine}</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: '#083344',
            padding: '10px 18px',
            borderRadius: 999,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span style={{ display: 'flex', fontSize: 18, fontWeight: 900, color: '#67e8f9' }}>100% anonymous</span>
        </div>

        <span style={{ display: 'flex', fontSize: 23, fontWeight: 900, color: '#fbbf24' }}>
          TAKE ACTION: SUBMIT YOUR REVIEW
        </span>
        <span style={{ display: 'flex', fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>
          e.g. "Delivered on key promises this term" — anonymous review
        </span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            background: '#f97316',
            padding: '18px 28px',
            borderRadius: 14,
          }}
        >
          <span style={{ display: 'flex', fontSize: 24, fontWeight: 900, color: '#ffffff' }}>Review this person</span>
          <span style={{ display: 'flex', fontSize: 24, color: '#ffffff' }}>→</span>
        </div>

        <span style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: '#94a3b8' }}>choseno.com</span>
      </div>
    </div>
  );
}
