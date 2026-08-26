// JSX layout for the generic share card used by politician walls, wall
// post threads, and candidacy pages. Ported from buildOgCardElement in
// src/lib/utils/ogCard.tsx -- see the header comment in
// ../generate-news-og-image/card.tsx for why this is a standalone copy
// rather than an import.
import React from 'npm:react@^19';

export interface OgCardInput {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  photoUrl?: string | null;
  /** Political party, shown as a small chip under the title when provided. */
  partyName?: string | null;
  /**
   * Rating summary for the footer band's second line. Omitted entirely
   * (both left undefined) by callers that don't have this data yet -- the
   * wall-post-thread and candidacy cards -- so it falls back to the old
   * generic tagline instead of guessing "be the first" for a page that may
   * actually have reviews already. Only the wall profile card (the one
   * page that already fetches this for its own metadata) passes it.
   */
  ratingAvg?: number | null;
  ratingCount?: number | null;
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

export function ProfileOgCard({ eyebrow, title, subtitle, photoUrl, partyName, ratingAvg, ratingCount }: OgCardInput) {
  const safeTitle = truncateWordSafe(title, 85);
  const safeSubtitle = subtitle ? truncateWordSafe(subtitle, 140) : null;
  const initialLetter = title.trim() ? title.trim().charAt(0).toUpperCase() : 'C';
  const firstName = title.trim().split(/\s+/)[0] || title;
  // Only render a rating-aware line when the caller actually supplied rating
  // data (ratingCount !== undefined) -- see the ratingCount doc comment above.
  const hasRatingData = ratingCount !== undefined && ratingCount !== null;
  // No "★" glyph here (unlike the vector-SVG stars elsewhere on this card) --
  // the sans-serif font Satori falls back to for plain text doesn't carry
  // the Unicode star glyph, which rendered as a tofu box in testing. "/5"
  // reads just as clearly without depending on font glyph coverage.
  const footerSubtext = hasRatingData
    ? ratingCount > 0
      ? `${ratingAvg?.toFixed(1)}/5 average from ${ratingCount} constituent review${ratingCount === 1 ? '' : 's'} · Add yours anonymously`
      : `Be the first to rate ${firstName} — reviews are 100% anonymous`
    : 'Civic accountability platform · Rate candidates & elected leaders';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 44px',
        background: 'linear-gradient(135deg, #fffaf5 0%, #f0fdf4 38%, #eff6ff 72%, #faf5ff 100%)',
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 360,
          height: 360,
          borderRadius: 180,
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0) 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -50,
          left: -50,
          width: 320,
          height: 320,
          borderRadius: 160,
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0) 70%)',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <circle cx="24" cy="24" r="6" fill="#0f172a" />
            <circle cx="24" cy="24" r="3.5" fill="#f97316" />
          </svg>

          <div style={{ display: 'flex', fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em' }}>
            <span style={{ color: '#0f172a' }}>Chosen</span>
            <span style={{ color: '#f97316' }}>o</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            padding: '7px 18px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}
        >
          {eyebrow}
        </div>
      </div>

      {/* Product-mechanic advertisement -- the one line every share of this
          card carries regardless of whether this particular person has any
          coverage yet, since the card is generic across wall/candidacy/post
          call sites. Fills what used to be a wide empty gap between the top
          bar and the name card. */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, zIndex: 10 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 800,
            color: '#166534',
            background: '#dcfce7',
            padding: '6px 16px',
            borderRadius: 999,
            border: '1.5px solid rgba(22, 101, 52, 0.25)',
          }}
        >
          📰 Rated on real news coverage — not just opinion
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          zIndex: 10,
          marginTop: 14,
          marginBottom: 8,
          flex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            padding: '32px 36px',
            borderRadius: 22,
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: safeTitle.length > 45 ? 36 : 42,
              fontWeight: 900,
              lineHeight: 1.2,
              color: '#090d16',
              letterSpacing: '-0.03em',
              marginBottom: safeSubtitle || partyName ? 12 : 0,
            }}
          >
            {safeTitle}
          </div>

          {partyName && (
            <div style={{ display: 'flex', marginBottom: safeSubtitle ? 10 : 0 }}>
              <span
                style={{
                  display: 'flex',
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#1d4ed8',
                  background: 'rgba(37, 99, 235, 0.1)',
                  padding: '4px 14px',
                  borderRadius: 999,
                }}
              >
                {partyName}
              </span>
            </div>
          )}

          {safeSubtitle && (
            <div style={{ display: 'flex', fontSize: 18, color: '#334155', lineHeight: 1.4, fontWeight: 600 }}>
              {safeSubtitle}
            </div>
          )}
        </div>

        {photoUrl ? (
          <img
            src={photoUrl}
            alt={title}
            width="150"
            height="150"
            style={{
              width: 150,
              height: 150,
              borderRadius: 75,
              objectFit: 'cover',
              border: '4.5px solid #f97316',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: 140,
              height: 140,
              borderRadius: 70,
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 60,
              fontWeight: 900,
              border: '4px solid #ffffff',
              flexShrink: 0,
            }}
          >
            <span>{initialLetter}</span>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 26px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e1b4b 100%)',
          border: '2px solid #f97316',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 19, fontWeight: 900, color: '#ffffff' }}>Rate & Review on Choseno</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#fbbf24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', fontSize: 13, color: '#e2e8f0', fontWeight: 700, marginTop: 2 }}>
              {footerSubtext}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 900,
          }}
        >
          <span>Rate Now</span>
          <span style={{ fontSize: 18 }}>→</span>
        </div>
      </div>
    </div>
  );
}
