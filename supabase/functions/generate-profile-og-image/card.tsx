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
        // Solid, not gradient -- this is what shows through behind the
        // right panel's text (orange name, white/gray copy, cyan badge,
        // gold "take action" line). A gradient here muddied contrast for
        // whichever color happened to land on its darker or oranger end;
        // flat color guarantees every text color reads the same everywhere
        // on the panel. Slightly warmer than pure black rather than a
        // harsh #000.
        background: '#12141f',
      }}
    >
      {/* Left: full-height photo poster, untouched by the banner -- the
          banner lives only in the right column below, not spanning over
          the image. */}
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: 460,
          height: '100%',
          // Same warm-glow treatment for the no-photo fallback so it's
          // never flat black either.
          background: 'radial-gradient(circle at 50% 45%, rgba(249,115,22,0.2) 0%, #171b28 55%, #05060a 100%)',
          overflow: 'hidden',
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={title}
            width="460"
            height="630"
            style={{ position: 'absolute', top: 0, left: 0, width: 460, height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ display: 'flex', fontSize: 180, fontWeight: 900, color: '#2d3142' }}>{initialLetter}</span>
          </div>
        )}
        <div style={{ position: 'absolute', top: 18, left: 18, display: 'flex' }}>
          <span
            style={{
              display: 'flex',
              fontSize: 12,
              fontWeight: 800,
              color: '#ffffff',
              background: 'rgba(0,0,0,0.55)',
              padding: '6px 14px',
              borderRadius: 999,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}
          >
            Public figure
          </span>
        </div>
      </div>

      {/* Right: banner + pitch panel stacked in one column, confined to
          this side only. */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
        {/* Banner -- same "light sticker over dark" theme as the Story
            card (ProfileStoryCard below), scaled down to fit landscape's
            much shorter frame. Ported here on request so the two formats
            read as one consistent brand, not two unrelated designs. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '14px 14px 0',
            background: 'rgba(241,245,249,0.97)',
            borderRadius: 16,
            padding: '14px 20px',
          }}
        >
          {/* "Google reviews for politicians" is the platform-identity line
              -- now the bigger, primary text -- with "Share your voice..."
              as a smaller caption underneath instead of the other way
              around. The Choseno logo sits to the right, vertically
              centered against the full two-line block (not pinned to just
              the top line) since alignItems: 'center' on this row applies
              to the whole row's cross-axis. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Google reviews for politicians</span>
            <span style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: '#64748b' }}>
              {`Share your voice: review ${firstName} now`}
            </span>
          </div>
          {/* Choseno as a solid orange pill instead of orange text on the
              light banner -- reads as a highlighted badge rather than just
              another line of text. Icon recolored to white-eye/orange-pupil
              (inverted from its usual orange-eye/white-pupil) since the
              original orange fill would nearly vanish against this same
              orange background. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#f97316', padding: '9px 20px', borderRadius: 999 }}>
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z" fill="#ffffff" />
              <path d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z" fill="#ffffff" />
              <circle cx="24" cy="24" r="6" fill="#ffffff" />
              <circle cx="24" cy="24" r="3.5" fill="#f97316" />
            </svg>
            <span
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 900,
                color: '#ffffff',
                textShadow: '0.6px 0 0 currentColor, -0.6px 0 0 currentColor, 0 0.6px 0 currentColor, 0 -0.6px 0 currentColor',
              }}
            >
              Choseno
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            gap: 14,
            padding: '0 32px',
          }}
        >
          {/* fontWeight: 900 is already the max standard weight, but
              Satori's fallback sans-serif doesn't render it as heavily as
              a real bold font would -- the multi-directional textShadow
              fakes extra stroke thickness on top of it, which is what
              actually reads as "bolder" once this shrinks to a feed
              thumbnail. */}
          <span
            style={{
              display: 'flex',
              fontSize: 48,
              fontWeight: 900,
              color: '#f97316',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              textShadow: '0.6px 0 0 currentColor, -0.6px 0 0 currentColor, 0 0.6px 0 currentColor, 0 -0.6px 0 currentColor',
            }}
          >
            {safeTitle}
          </span>

          {(partyName || safeSubtitle) && (
            <span style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: '#cbd5e1' }}>
              {[partyName, safeSubtitle].filter(Boolean).join(' · ')}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <StarRow filled={filledStars} size={30} color="#fbbf24" />
            <span style={{ display: 'flex', fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{statsLine}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              alignSelf: 'flex-start',
              background: '#083344',
              padding: '9px 18px',
              borderRadius: 999,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span style={{ display: 'flex', fontSize: 18, fontWeight: 900, color: '#67e8f9' }}>100% anonymous</span>
          </div>

          <span style={{ display: 'flex', fontSize: 21, fontWeight: 900, color: '#fbbf24' }}>TAKE ACTION: SUBMIT YOUR REVIEW</span>
          <span style={{ display: 'flex', fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>
            e.g. "Delivered on key promises this term" — anonymous review
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              alignSelf: 'flex-start',
              background: '#f97316',
              padding: '17px 30px',
              borderRadius: 14,
            }}
          >
            <span style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: '#ffffff' }}>Review this person</span>
            <span style={{ display: 'flex', fontSize: 22, color: '#ffffff' }}>→</span>
          </div>

          <span style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>choseno.com</span>
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
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '28px 28px 0',
          background: 'rgba(241,245,249,0.97)',
          borderRadius: 22,
          padding: '26px 32px',
          position: 'relative',
          zIndex: 5,
        }}
      >
        {/* "Google reviews for politicians" is the platform-identity line
            -- now the bigger, primary text -- with "Share your voice..."
            as a smaller caption underneath instead of the other way
            around. The Choseno logo sits to the right, vertically centered
            against the full two-line block via this row's own
            alignItems: 'center'. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ display: 'flex', fontSize: 30, fontWeight: 900, color: '#0f172a' }}>Google reviews for politicians</span>
          <span style={{ display: 'flex', fontSize: 17, fontWeight: 700, color: '#64748b' }}>
            {`Share your voice: review ${firstName} now`}
          </span>
        </div>
        {/* Choseno as a solid orange pill instead of orange text on the
            light banner -- reads as a highlighted badge rather than just
            another line of text. Icon recolored to white-eye/orange-pupil
            (inverted from its usual orange-eye/white-pupil) since the
            original orange fill would nearly vanish against this same
            orange background. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#f97316', padding: '12px 26px', borderRadius: 999 }}>
          <svg width="30" height="30" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z" fill="#ffffff" />
            <path d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z" fill="#ffffff" />
            <circle cx="24" cy="24" r="6" fill="#ffffff" />
            <circle cx="24" cy="24" r="3.5" fill="#f97316" />
          </svg>
          <span
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 900,
              color: '#ffffff',
              textShadow: '0.6px 0 0 currentColor, -0.6px 0 0 currentColor, 0 0.6px 0 currentColor, 0 -0.6px 0 currentColor',
            }}
          >
            Choseno
          </span>
        </div>
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
        {/* Same faux-bold textShadow trick as the landscape card's name --
            fontWeight: 900 alone doesn't render as heavily as expected in
            Satori's fallback sans-serif; this fakes extra stroke weight so
            the name stays clearly readable once shrunk to a thumbnail. */}
        <span
          style={{
            display: 'flex',
            fontSize: 44,
            fontWeight: 900,
            color: '#f97316',
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            textShadow: '0.6px 0 0 currentColor, -0.6px 0 0 currentColor, 0 0.6px 0 currentColor, 0 -0.6px 0 currentColor',
          }}
        >
          {safeTitle}
        </span>

        {(partyName || safeSubtitle) && (
          <span style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: '#cbd5e1' }}>
            {[partyName, safeSubtitle].filter(Boolean).join(' · ')}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StarRow filled={filledStars} size={32} color="#fbbf24" />
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
