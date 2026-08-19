// Pure, environment-agnostic share-card layout builder for news articles --
// no `next/og` import here on purpose. As of 2026-08-19, all server-side
// share-card rendering (news, election, wall, candidacy) runs in Supabase
// Edge Functions (supabase/functions/generate-*-og-image), not Vercel; each
// of those Deno functions keeps its own ported copy of this JSX rather than
// importing this file directly, since it's bundled by Next.js/webpack and
// assumes Node-ish resolution that doesn't carry over to a Deno import
// graph (see the header comment in
// supabase/functions/generate-news-og-image/card.tsx). This file is only
// still imported from one place: the *browser* render path
// (src/lib/utils/ogCardBrowser.ts wraps it in Satori + a <canvas> rasterize
// step, so an admin's own browser can render a preview at publish time with
// no server involved at all). Keeping the JSX definition here rather than
// duplicating it a third time means the admin-preview and the
// Deno-ported-copy only need to be kept in sync by eye in one direction.

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

export function truncateWordSafe(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.65) {
    return `${truncated.slice(0, lastSpace).trimEnd()}…`;
  }
  return `${truncated.trimEnd()}…`;
}

// ── News article share card ─────────────────────────────────────────────
//
// Used by the browser render path (renderNewsArticleOgCardToPngBlob in
// ogCardBrowser.ts, called from AdminNewsPageClient right at publish time)
// and ported separately into generate-news-og-image/card.tsx for the
// server-side render, so both ever produce pixel-identical output. Takes
// plain fields rather than a Supabase row shape so neither caller has to
// agree on a query shape with this file.

export interface NewsArticleOgCardInput {
  headline: string;
  summary?: string | null;
  category?: string | null;
  country?: string | null;
  province?: string | null;
  eventDate?: string | null;
  publishedAt?: string | null;
  bodyMarkdown?: string | null;
  politicianName?: string | null;
  politicianDesignation?: string | null;
  politicianConstituency?: string | null;
  politicianPhotoUrl?: string | null;
}

export function buildNewsArticleOgCardElement(input: NewsArticleOgCardInput) {
  const hasPolitician = Boolean(input.politicianName);
  const politicianName = input.politicianName || "Civic Leaders";
  const politicianRole = input.politicianDesignation
    ? `${input.politicianDesignation}${input.politicianConstituency ? ` (${input.politicianConstituency})` : ""}`
    : input.province || input.country || "Elected Official";
  const politicianPhotoUrl = input.politicianPhotoUrl || null;
  const initialLetter = politicianName.trim() ? politicianName.trim().charAt(0).toUpperCase() : "C";

  // Extract crisp bullet takeaways from the markdown body or summary
  const bodyText = input.bodyMarkdown || "";
  const rawBullets: string[] = [];
  for (const line of bodyText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const clean = trimmed.replace(/^[\*\-]\s+/, "").replace(/\*\*/g, "").trim();
      if (clean.length > 15 && clean.length < 180) {
        rawBullets.push(clean);
      }
    }
  }

  const crispHighlights =
    rawBullets.length >= 2
      ? rawBullets.slice(0, 2).map((b) => truncateWordSafe(b, 160))
      : [
          truncateWordSafe(input.summary || "Verified provincial and municipal civic policy update.", 160),
          `Key policy decision impacting residents across ${input.province || input.country || "your district"}.`,
        ];

  const headline = truncateWordSafe(input.headline, 105);
  const headlineFontSize = headline.length > 75 ? 28 : headline.length > 48 ? 32 : 36;
  const dateStr = input.eventDate || input.publishedAt || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "32px 42px",
          background: "linear-gradient(135deg, #fffaf5 0%, #f0fdf4 38%, #eff6ff 72%, #faf5ff 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Background decorative glow blobs */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 360,
            height: 360,
            borderRadius: 180,
            background: "radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -50,
            left: -50,
            width: 320,
            height: 320,
            borderRadius: 160,
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0) 70%)",
          }}
        />

        {/* ── Top Header Bar ────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Official Choseno Logo SVG */}
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="choseno-og-orange-top" x1="4" y1="8" x2="44" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ff8c00" />
                </linearGradient>
                <linearGradient id="choseno-og-orange-bottom" x1="44" y1="28" x2="8" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <path
                d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z"
                fill="url(#choseno-og-orange-top)"
              />
              <path
                d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z"
                fill="url(#choseno-og-orange-bottom)"
              />
              <circle cx="24" cy="24" r="6" fill="#0f172a" />
              <circle cx="24" cy="24" r="3.5" fill="#f97316" />
            </svg>

            <div style={{ display: "flex", fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em" }}>
              <span style={{ color: "#0f172a" }}>Chosen</span>
              <span style={{ color: "#f97316" }}>o</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 12,
                fontWeight: 900,
                color: "#c2410c",
                background: "#ffedd5",
                border: "1px solid #fed7aa",
                padding: "3px 10px",
                borderRadius: 6,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginLeft: 4,
              }}
            >
              Civic News
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                padding: "6px 14px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 1,
                boxShadow: "0 4px 10px rgba(37, 99, 235, 0.3)",
              }}
            >
              {input.category || "Policy"}
            </div>
            <div
              style={{
                display: "flex",
                padding: "6px 14px",
                borderRadius: 999,
                background: "rgba(255, 255, 255, 0.95)",
                border: "1.5px solid #cbd5e1",
                fontSize: 13,
                fontWeight: 800,
                color: "#334155",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}
            >
              {formattedDate} · {input.province ? `${input.province}, ` : ""}{input.country?.toUpperCase() || "CA"}
            </div>
          </div>
        </div>

        {/* ── Main Content Area: Left Dominant Headline + Right Politician Rating Spotlight ── */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 20,
            zIndex: 10,
            marginTop: 4,
            marginBottom: 4,
          }}
        >
          {/* Left: Dominant Bold Headline & High-Contrast Takeaways */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              flex: 1,
              padding: "22px 26px",
              borderRadius: 22,
              background: "#ffffff",
              border: "1.5px solid #e2e8f0",
              boxShadow: "0 12px 28px -5px rgba(15, 23, 42, 0.09)",
            }}
          >
            {/* High-Impact Dominant Headline */}
            <div
              style={{
                display: "flex",
                fontSize: headlineFontSize,
                fontWeight: 900,
                lineHeight: 1.18,
                color: "#090d16",
                letterSpacing: "-0.03em",
                marginBottom: 12,
              }}
            >
              {headline}
            </div>

            {/* Crisp High-Contrast Highlights */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {crispHighlights.slice(0, 2).map((point, idx) => {
                const isFirst = idx === 0;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: isFirst ? "#f0fdf4" : "#eff6ff",
                      border: `1.5px solid ${isFirst ? "#86efac" : "#93c5fd"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: isFirst ? "#16a34a" : "#2563eb",
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 900,
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ display: "flex", fontSize: 16, color: "#0f172a", lineHeight: 1.35, fontWeight: 700 }}>
                      {point}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Politician Rating Spotlight Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 245,
              padding: "18px 14px",
              borderRadius: 22,
              background: "linear-gradient(180deg, #ffffff 0%, #fff7ed 100%)",
              border: "2px solid #fdba74",
              boxShadow: "0 12px 28px -5px rgba(249, 115, 22, 0.25)",
              position: "relative",
            }}
          >
            {/* Top Pill: "RATE OFFICIAL" badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                borderRadius: 999,
                background: "#ffedd5",
                border: "1px solid #fed7aa",
                marginBottom: 8,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#ea580c" }} />
              <span style={{ fontSize: 11, fontWeight: 900, color: "#c2410c", textTransform: "uppercase", letterSpacing: 1.2 }}>
                {hasPolitician ? "Rate Leader" : "Civic Action"}
              </span>
            </div>

            {/* Politician Photo or Initials */}
            {politicianPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={politicianPhotoUrl}
                alt={politicianName}
                width="104"
                height="104"
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  objectFit: "cover",
                  border: "4px solid #f97316",
                  boxShadow: "0 8px 20px rgba(249, 115, 22, 0.4)",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  color: "#ffffff",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 48,
                  fontWeight: 900,
                  border: "3.5px solid #ffffff",
                  boxShadow: "0 8px 20px rgba(249, 115, 22, 0.35)",
                }}
              >
                <span>{initialLetter}</span>
              </div>
            )}

            {/* Name */}
            <div style={{ display: "flex", fontSize: 19, fontWeight: 900, color: "#0f172a", marginTop: 8, textAlign: "center", lineHeight: 1.15 }}>
              {truncateWordSafe(politicianName, 22)}
            </div>

            {/* Designation / Role Pill */}
            <div
              style={{
                display: "flex",
                padding: "2px 8px",
                borderRadius: 6,
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                marginTop: 4,
                maxWidth: "100%",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", textAlign: "center" }}>
                {truncateWordSafe(politicianRole, 26)}
              </span>
            </div>

            {/* 5 Prominent Gold Rating Stars */}
            <div style={{ display: "flex", gap: 3, marginTop: 7 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>

            {/* Direct Card CTA Button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 6,
                padding: "5px 14px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 900,
                boxShadow: "0 4px 12px rgba(249, 115, 22, 0.4)",
              }}
            >
              <span>Rate Profile</span>
              <span style={{ fontSize: 13 }}>→</span>
            </div>
          </div>
        </div>

        {/* ── Bottom Action Bar: High-Contrast Rating Banner ─────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 24px",
            borderRadius: 18,
            background: "linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e1b4b 100%)",
            boxShadow: "0 12px 30px -4px rgba(249, 115, 22, 0.35), 0 4px 16px rgba(0,0,0,0.3)",
            border: "2px solid #f97316",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Glowing Star Icon Badge */}
            <div
              style={{
                display: "flex",
                width: 44,
                height: 44,
                borderRadius: 22,
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 16px rgba(249, 115, 22, 0.7)",
                flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.01em" }}>
                  {hasPolitician ? `Rate ${politicianName} on Choseno` : "Rate Elected Officials on Choseno"}
                </span>
                {/* 5 Real SVG Star Shapes */}
                <div style={{ display: "flex", gap: 3 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#fbbf24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", fontSize: 13, color: "#e2e8f0", fontWeight: 700, marginTop: 2 }}>
                Hold leaders accountable · Citizen-powered verified civic ratings
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 900,
              boxShadow: "0 6px 18px rgba(249, 115, 22, 0.45)",
            }}
          >
            <span>Rate Now</span>
            <span style={{ fontSize: 18 }}>→</span>
          </div>
        </div>
      </div>
    );
}
