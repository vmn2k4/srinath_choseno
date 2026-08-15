import { ImageResponse } from "next/og";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createPublicClient } from "@/lib/supabase/public";

export const alt = "Choseno News — Rate Your Politician";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cookie-free createPublicClient (see src/lib/supabase/public.ts) keeps this
// route eligible for Next's static image caching; revalidate bounds how
// stale a cached card can get after an article is edited.
export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data } = await supabase
    .from("news_articles")
    .select(
      "id, slug, headline, summary, category, country, province, event_date, published_at, content, news_article_politicians(politician_id, profiles(id, full_name, designation, constituency, politician_profiles(photo_url, avatar_url)))"
    )
    .eq("slug", slug)
    .single();

  const article = data as {
    id: string;
    slug: string;
    headline: string;
    summary: string | null;
    category: string;
    country: string | null;
    province: string | null;
    event_date?: string | null;
    published_at?: string | null;
    content?: {
      body?: string | null;
      tags?: string[] | null;
    } | null;
    news_article_politicians?: Array<{
      profiles?: {
        id: string;
        full_name: string;
        designation?: string | null;
        constituency?: string | null;
        politician_profiles?: {
          photo_url?: string | null;
          avatar_url?: string | null;
        } | null;
      } | null;
    }> | null;
  } | null;

  if (!article) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "#ffffff",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 800, color: "#0f172a" }}>Choseno Civic News</div>
        </div>
      ),
      { ...OG_IMAGE_SIZE }
    );
  }

  // Extract primary tagged politician
  const taggedList = article.news_article_politicians?.map((p) => p.profiles).filter(Boolean) || [];
  const primaryPolitician = taggedList[0];
  const politicianName = primaryPolitician?.full_name || "Civic Leader";
  const politicianRole = primaryPolitician?.designation
    ? `${primaryPolitician.designation}${primaryPolitician.constituency ? ` (${primaryPolitician.constituency})` : ""}`
    : article.province || article.country || "Elected Official";
  
  const politicianPhotoUrl =
    primaryPolitician?.politician_profiles?.photo_url ||
    primaryPolitician?.politician_profiles?.avatar_url ||
    null;

  const initialLetter = politicianName.trim() ? politicianName.trim().charAt(0).toUpperCase() : "C";

  // Extract crisp bullet takeaways from the markdown body or summary
  const bodyText = article.content?.body || "";
  const rawBullets: string[] = [];

  // Match bullet lines (* or -)
  const lines = bodyText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const clean = trimmed.replace(/^[\*\-]\s+/, "").replace(/\*\*/g, "").trim();
      if (clean.length > 15 && clean.length < 120) {
        rawBullets.push(clean);
      }
    }
  }

  // Fallback crisp points if no bullet points exist in body
  const crispHighlights = rawBullets.length >= 2
    ? rawBullets.slice(0, 3)
    : [
        article.summary || "Verified provincial and municipal civic policy update.",
        `Key policy decision impacting residents across ${article.province || article.country || "your district"}.`,
        `Read voter community perspectives & rate ${politicianName}'s performance.`
      ];

  const headline = article.headline.length > 78 ? `${article.headline.slice(0, 77)}…` : article.headline;
  const dateStr = article.event_date || article.published_at || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "36px 44px",
          background: "linear-gradient(135deg, #fff7ed 0%, #f0fdf4 35%, #eff6ff 70%, #faf5ff 100%)",
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
            width: 340,
            height: 340,
            borderRadius: 170,
            background: "radial-gradient(circle, rgba(249, 115, 22, 0.18) 0%, rgba(249, 115, 22, 0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -40,
            left: -40,
            width: 300,
            height: 300,
            borderRadius: 150,
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, rgba(59, 130, 246, 0) 70%)",
          }}
        />

        {/* Top Header Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Official Choseno Logo SVG */}
            <svg
              width="42"
              height="42"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
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

            <div style={{ display: "flex", fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em" }}>
              <span style={{ color: "#0f172a" }}>Chosen</span>
              <span style={{ color: "#f97316" }}>o</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 12,
                fontWeight: 900,
                color: "#f97316",
                background: "#ffedd5",
                padding: "3px 9px",
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
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1,
                boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)",
              }}
            >
              {article.category || "Policy"}
            </div>
            <div
              style={{
                display: "flex",
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(255, 255, 255, 0.85)",
                border: "1px solid #cbd5e1",
                fontSize: 13,
                fontWeight: 700,
                color: "#475569",
              }}
            >
              {formattedDate} · {article.province ? `${article.province}, ` : ""}{article.country?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Main Content Area: Left Dominant Headline & Takeaways + Right Featured Photo */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 24,
            zIndex: 10,
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          {/* Left: Dominant Bold Headline & Crisp Takeaways */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              flex: 1,
              padding: "24px 28px",
              borderRadius: 24,
              background: "rgba(255, 255, 255, 0.96)",
              border: "1.5px solid rgba(226, 232, 240, 0.95)",
              boxShadow: "0 12px 28px -5px rgba(15, 23, 42, 0.08)",
            }}
          >
            {/* High-Impact Dominant Headline */}
            <div
              style={{
                display: "flex",
                fontSize: headline.length > 55 ? 34 : 40,
                fontWeight: 900,
                lineHeight: 1.15,
                color: "#090d16",
                letterSpacing: "-0.03em",
                marginBottom: 14,
              }}
            >
              {headline}
            </div>

            {/* Crisp Highlights */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {crispHighlights.slice(0, 2).map((point, idx) => {
                const bgColors = ["#f0fdf4", "#eff6ff"];
                const borderColors = ["#bbf7d0", "#bfdbfe"];
                const numBgs = ["#16a34a", "#2563eb"];
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 14,
                      background: bgColors[idx % bgColors.length],
                      border: `1px solid ${borderColors[idx % borderColors.length]}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        background: numBgs[idx % numBgs.length],
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 900,
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ display: "flex", fontSize: 16, color: "#1e293b", lineHeight: 1.3, fontWeight: 600 }}>
                      {point}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Large Featured Politician Photo / Avatar Spotlight */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 220,
              padding: "18px 14px",
              borderRadius: 24,
              background: "linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)",
              border: "2px solid #fed7aa",
              boxShadow: "0 12px 28px -5px rgba(249, 115, 22, 0.2)",
              position: "relative",
            }}
          >
            {politicianPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={politicianPhotoUrl}
                alt={politicianName}
                width="128"
                height="128"
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: 64,
                  objectFit: "cover",
                  border: "4.5px solid #f97316",
                  boxShadow: "0 10px 22px rgba(249, 115, 22, 0.4)",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  color: "#ffffff",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 54,
                  fontWeight: 900,
                  border: "3.5px solid #ffffff",
                  boxShadow: "0 10px 22px rgba(249, 115, 22, 0.35)",
                }}
              >
                <span>{initialLetter}</span>
              </div>
            )}
            <div style={{ display: "flex", fontSize: 17, fontWeight: 900, color: "#0f172a", marginTop: 12, textAlign: "center" }}>
              {politicianName}
            </div>
            <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#ea580c", textAlign: "center", marginTop: 2 }}>
              {politicianRole}
            </div>
          </div>
        </div>

        {/* Action Bar: High Impact Gradient Rating Callout with SVG Stars */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 26px",
            borderRadius: 20,
            background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #311042 100%)",
            boxShadow: "0 12px 30px -5px rgba(249, 115, 22, 0.35), 0 4px 15px rgba(0,0,0,0.2)",
            border: "2px solid #f97316",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                width: 44,
                height: 44,
                borderRadius: 22,
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 14px rgba(249, 115, 22, 0.6)",
              }}
            >
              {/* Star Icon in badge */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 19, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.01em" }}>
                  Rate {politicianName} today on Choseno
                </span>
                {/* 5 Real SVG Star Shapes */}
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#fbbf24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", fontSize: 13, color: "#cbd5e1", fontWeight: 600, marginTop: 2 }}>
                Rate before elections · Hold local leaders accountable
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
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
    ),
    { ...OG_IMAGE_SIZE }
  );
}


