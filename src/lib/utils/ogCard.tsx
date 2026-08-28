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

// v2 (2026-08-28): full redesign matching the officeholder profile card's
// dark "Google reviews for politicians" system -- see ProfileOgCard in
// generate-profile-og-image/card.tsx, which this now deliberately mirrors
// (same banner copy, same dark ground, same star-rating language) instead
// of the light pastel-gradient "civic dashboard" look v1 used. Full-bleed
// photo poster on the left with name/stars/rate-button overlaid at its
// bottom (not the top -- a real headshot crop almost always frames the face
// in the upper 2/3, so a bottom overlay is far less likely to land across
// someone's face than a top one would; ProfileStoryCard already relies on
// this same placement). Right column leads with the exact profile-card
// banner, then the article's actual headline and its takeaways.
export function buildNewsArticleOgCardElement(input: NewsArticleOgCardInput) {
  const politicianName = input.politicianName || "Civic Leaders";
  const firstName = politicianName.trim().split(/\s+/)[0] || politicianName;
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

  const headline = truncateWordSafe(input.headline, 120);
  const dateStr = input.eventDate || input.publishedAt || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const locationLabel = [input.province, (input.country || "").toUpperCase()].filter(Boolean).join(", ") || "Canada";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        fontFamily: "sans-serif",
        background: "#12141f",
      }}
    >
      {/* Left: full-height photo poster -- real photo when we have one,
          otherwise the same radial-glow + giant-initial fallback the
          profile card uses. */}
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 460,
          height: "100%",
          background: politicianPhotoUrl
            ? "#05060a"
            : "radial-gradient(circle at 50% 45%, rgba(249,115,22,0.2) 0%, #171b28 55%, #05060a 100%)",
        }}
      >
        {politicianPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={politicianPhotoUrl}
            alt={politicianName}
            width="460"
            height="630"
            style={{ position: "absolute", top: 0, left: 0, width: 460, height: 630, objectFit: "cover" }}
          />
        ) : (
          <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
            <span style={{ display: "flex", fontSize: 180, fontWeight: 900, color: "#2d3142" }}>{initialLetter}</span>
          </div>
        )}

        {/* Scrim so the overlaid name/stars/CTA stay legible over any photo. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 340,
            display: "flex",
            background: "linear-gradient(to top, rgba(5,6,10,0.95) 0%, rgba(5,6,10,0.65) 55%, rgba(5,6,10,0) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", padding: "0 26px 24px" }}>
          <span style={{ display: "flex", fontSize: 38, fontWeight: 900, color: "#f97316", lineHeight: 1.0, letterSpacing: "-0.01em" }}>
            {truncateWordSafe(politicianName, 26)}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>
            <span style={{ display: "flex", fontSize: 13, fontWeight: 800, color: "#fbbf24" }}>Be the first to review</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              alignSelf: "flex-start",
              background: "#f97316",
              padding: "10px 20px",
              borderRadius: 10,
              marginTop: 12,
            }}
          >
            <span style={{ display: "flex", fontSize: 14, fontWeight: 900, color: "#ffffff" }}>
              {`Rate ${truncateWordSafe(politicianName, 22)}`}
            </span>
            <span style={{ display: "flex", fontSize: 14, color: "#ffffff" }}>→</span>
          </div>
        </div>
      </div>

      {/* Right: the profile card's own banner (same copy, word for word),
          then the article headline and its takeaways. */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "14px 14px 0",
            background: "rgba(241,245,249,0.97)",
            borderRadius: 16,
            padding: "14px 20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ display: "flex", fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Google reviews for politicians</span>
            <span style={{ display: "flex", fontSize: 13, fontWeight: 700, color: "#64748b" }}>
              {`Share your voice: review ${firstName} now`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#f97316", padding: "9px 20px", borderRadius: 999 }}>
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z" fill="#ffffff" />
              <path d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z" fill="#ffffff" />
              <circle cx="24" cy="24" r="6" fill="#ffffff" />
              <circle cx="24" cy="24" r="3.5" fill="#f97316" />
            </svg>
            <span
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 900,
                color: "#ffffff",
                textShadow: "0.6px 0 0 currentColor, -0.6px 0 0 currentColor, 0 0.6px 0 currentColor, 0 -0.6px 0 currentColor",
              }}
            >
              Choseno
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "18px 30px 20px", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                padding: "5px 13px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                color: "#ffffff",
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {input.category || "Policy"}
            </div>
            <span style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
              {`${formattedDate} · ${locationLabel}`}
            </span>
          </div>

          {/* The article's actual headline -- v1 buried this inside a
              cramped headline card; here it's the dominant line in the
              right column. */}
          <span style={{ display: "flex", fontSize: 30, fontWeight: 900, color: "#f8fafc", lineHeight: 1.18, letterSpacing: "-0.01em", marginTop: 12 }}>
            {headline}
          </span>

          {/* Takeaways: bold (900) and larger (19px) than v1's -- these
              carry the "what happened" summary now that rating/CTA live on
              the photo panel instead of competing for room here. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
            {crispHighlights.map((point, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 25,
                    height: 25,
                    borderRadius: 7,
                    background: "rgba(249,115,22,0.16)",
                    color: "#fdba74",
                    fontSize: 13,
                    fontWeight: 900,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {idx + 1}
                </div>
                <span style={{ display: "flex", fontSize: 19, color: "#f1f5f9", lineHeight: 1.4, fontWeight: 900 }}>{point}</span>
              </div>
            ))}
          </div>

          <span style={{ display: "flex", fontSize: 13, fontWeight: 700, color: "#64748b", marginTop: 20 }}>choseno.com</span>
        </div>
      </div>
    </div>
  );
}
