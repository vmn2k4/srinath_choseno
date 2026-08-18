// JSX layout for the election-seat share card, split into its own .tsx file
// so index.ts (the Deno.serve entrypoint) never needs a JSX-capable parse --
// same split Supabase's own "Generating OG Images" Edge Function example
// uses (handler.tsx + index.ts). Rendered via @vercel/og's ImageResponse
// (Satori + resvg-wasm under the hood), same engine src/lib/utils/og.tsx
// already uses on the Vercel side -- just invoked from Deno here instead of
// Next.js. Not imported from src/lib/utils/ogCard.tsx: that file is bundled
// by Next.js/webpack and assumes Node-ish resolution, which doesn't carry
// over to a plain Deno import graph, so the layout is kept independently
// here. Keep the branding (logo mark, palette) in sync with ogCard.tsx by
// eye if that one changes.
import React from 'npm:react@^19';

export interface CandidateCardRow {
  name: string;
  avatarUrl: string | null;
  partyName: string | null;
  supporterCount: number;
  pct: number;
  isTop: boolean;
}

export interface ElectionOgCardInput {
  roleTitle: string;
  boundaryName: string;
  candidates: CandidateCardRow[];
  electionDateLabel: string | null;
  asOfLabel: string;
}

export function ElectionOgCard({
  roleTitle,
  boundaryName,
  candidates,
  electionDateLabel,
  asOfLabel,
}: ElectionOgCardInput) {
  const n = candidates.length;
  // Row density scales down as the roster grows so every candidate still
  // fits inside the fixed 1200x630 card instead of overflowing off the
  // bottom -- a 2-candidate race and a 10-candidate primary both need to
  // read cleanly at a glance. Tightened to leave room for CTA bar (Twitter
  // overlays text at the very bottom when sharing, so CTA must sit higher).
  const rowGap = n > 8 ? 4 : n > 5 ? 7 : 12;
  const avatarSize = n > 8 ? 26 : n > 5 ? 36 : 50;
  const nameFontSize = n > 8 ? 14 : n > 5 ? 17 : 21;
  const showParty = n <= 8;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '30px 44px 16px 44px',
        background:
          'linear-gradient(135deg, #fffaf5 0%, #f0fdf4 38%, #eff6ff 72%, #faf5ff 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Header: logo + eyebrow badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 900,
              boxShadow: '0 6px 16px rgba(249, 115, 22, 0.35)',
            }}
          >
            C
          </div>
          <div style={{ display: 'flex', fontSize: 27, fontWeight: 900, letterSpacing: '-0.03em' }}>
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
            fontSize: 13,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}
        >
          Community Support
        </div>
      </div>

      {/* Title block */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 900, color: '#090d16', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          {roleTitle} — {boundaryName}
        </div>
        <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: '#334155', marginTop: 5 }}>
          {n} candidate{n === 1 ? '' : 's'} running · Who will YOU vote for? See what they stand for on Choseno.
        </div>
      </div>

      {/* Candidate list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          gap: rowGap,
          // Satori only understands a subset of CSS values -- "space-evenly"
          // isn't one of them (confirmed live: throws "Invalid value for CSS
          // property justifyContent"), "space-around" is the closest
          // supported equivalent for spreading rows across the box.
          justifyContent: n > 0 ? 'space-around' : 'center',
          background: '#ffffff',
          borderRadius: 18,
          border: '1.5px solid #e2e8f0',
          padding: '14px 20px',
          boxShadow: '0 12px 28px -5px rgba(15, 23, 42, 0.09)',
        }}
      >
        {n === 0 ? (
          <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: '#64748b' }}>
            No candidates approved yet for this seat.
          </div>
        ) : (
          candidates.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', width: 24, fontSize: nameFontSize, fontWeight: 900, color: c.isTop ? '#16a34a' : '#94a3b8' }}>
                {i + 1}
              </div>
              {c.avatarUrl ? (
                <img
                  src={c.avatarUrl}
                  width={avatarSize}
                  height={avatarSize}
                  style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    objectFit: 'cover',
                    border: `2.5px solid ${c.isTop ? '#16a34a' : '#e2e8f0'}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: '#ffffff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.round(avatarSize * 0.45),
                    fontWeight: 900,
                    border: '2px solid #ffffff',
                  }}
                >
                  {c.name.trim().charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: nameFontSize, fontWeight: 800, color: '#0f172a' }}>{c.name}</span>
                  {c.isTop && (
                    <span
                      style={{
                        display: 'flex',
                        fontSize: 10,
                        fontWeight: 900,
                        color: '#166534',
                        background: '#dcfce7',
                        padding: '2px 9px',
                        borderRadius: 999,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Leading
                    </span>
                  )}
                  {c.partyName && showParty && (
                    <span style={{ display: 'flex', fontSize: nameFontSize - 6, fontWeight: 700, color: '#64748b' }}>
                      {c.partyName}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', width: '100%', height: 7, borderRadius: 4, background: '#f1f5f9', marginTop: 5 }}>
                  <div
                    style={{
                      display: 'flex',
                      width: `${Math.max(c.pct, 2)}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: c.isTop ? 'linear-gradient(90deg, #16a34a, #22c55e)' : '#cbd5e1',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', fontSize: nameFontSize, fontWeight: 900, color: '#0f172a' }}>{c.pct}%</div>
            </div>
          ))
        )}
      </div>

      {/* Footer: call-to-action bar, same dark/orange branding as the
          "Rate & Review on Choseno" bar in ogCard.tsx's buildOgCardElement --
          drives the share itself (someone else's support numbers) toward an
          action ("go add your own"), not just a passive stat. */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
        {electionDateLabel && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <span style={{ display: 'flex', fontSize: 11, fontWeight: 800, color: '#c2410c' }}>
              Election Day: {electionDateLabel}
            </span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e1b4b 100%)',
            boxShadow: '0 12px 30px -4px rgba(249, 115, 22, 0.35), 0 4px 16px rgba(0,0,0,0.3)',
            border: '2px solid #f97316',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ display: 'flex', fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
              Join Choseno — tell us who YOU support in {boundaryName}
            </span>
            <span style={{ display: 'flex', fontSize: 11, color: '#cbd5e1', fontWeight: 600, marginTop: 2 }}>
              As of {asOfLabel} · Community support only, not an official result
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 900,
              boxShadow: '0 6px 18px rgba(249, 115, 22, 0.45)',
            }}
          >
            <span>Join</span>
            <span style={{ fontSize: 16 }}>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}
