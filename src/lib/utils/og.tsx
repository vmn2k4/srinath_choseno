import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

interface OgCardProps {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  photoUrl?: string | null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function renderOgCard({ eyebrow, title, subtitle, photoUrl }: OgCardProps) {
  const safeTitle = truncate(title, 85);
  const safeSubtitle = subtitle ? truncate(subtitle, 140) : null;
  const initialLetter = title.trim() ? title.trim().charAt(0).toUpperCase() : "C";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px 48px",
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

        {/* Top Header: Choseno Logo + Eyebrow Badge */}
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
                <linearGradient id="og-orange-top" x1="4" y1="8" x2="44" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ff8c00" />
                </linearGradient>
                <linearGradient id="og-orange-bottom" x1="44" y1="28" x2="8" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <path
                d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z"
                fill="url(#og-orange-top)"
              />
              <path
                d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z"
                fill="url(#og-orange-bottom)"
              />
              <circle cx="24" cy="24" r="6" fill="#0f172a" />
              <circle cx="24" cy="24" r="3.5" fill="#f97316" />
            </svg>

            <div style={{ display: "flex", fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em" }}>
              <span style={{ color: "#0f172a" }}>Chosen</span>
              <span style={{ color: "#f97316" }}>o</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              padding: "8px 18px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)",
            }}
          >
            {eyebrow}
          </div>
        </div>

        {/* Main Content: Left Title/Subtitle + Right Optional Photo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            zIndex: 10,
            marginTop: 12,
            marginBottom: 12,
            flex: 1,
          }}
        >
          {/* Left: Title & Subtitle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              padding: "32px 36px",
              borderRadius: 24,
              background: "rgba(255, 255, 255, 0.96)",
              border: "1.5px solid rgba(226, 232, 240, 0.95)",
              boxShadow: "0 12px 28px -5px rgba(15, 23, 42, 0.08)",
            }}
          >
            {/* Bold Title */}
            <div
              style={{
                display: "flex",
                fontSize: safeTitle.length > 50 ? 36 : 44,
                fontWeight: 900,
                lineHeight: 1.2,
                color: "#090d16",
                letterSpacing: "-0.03em",
                marginBottom: safeSubtitle ? 14 : 0,
              }}
            >
              {safeTitle}
            </div>

            {/* Optional Subtitle */}
            {safeSubtitle && (
              <div style={{ display: "flex", fontSize: 18, color: "#64748b", lineHeight: 1.4, fontWeight: 500 }}>
                {safeSubtitle}
              </div>
            )}
          </div>

          {/* Right: Optional Avatar/Photo */}
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={title}
              width="140"
              height="140"
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                objectFit: "cover",
                border: "4.5px solid #f97316",
                boxShadow: "0 10px 22px rgba(249, 115, 22, 0.4)",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 140,
                height: 140,
                borderRadius: 70,
                background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                color: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 60,
                fontWeight: 900,
                border: "4px solid #ffffff",
                boxShadow: "0 10px 22px rgba(249, 115, 22, 0.35)",
                flexShrink: 0,
              }}
            >
              <span>{initialLetter}</span>
            </div>
          )}
        </div>

        {/* Footer: Call-to-Action Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 28px",
            borderRadius: 18,
            background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #311042 100%)",
            boxShadow: "0 12px 30px -5px rgba(249, 115, 22, 0.35), 0 4px 15px rgba(0,0,0,0.2)",
            border: "2px solid #f97316",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                width: 40,
                height: 40,
                borderRadius: 20,
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 14px rgba(249, 115, 22, 0.6)",
              }}
            >
              {/* Star Icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#ffffff" }}>Discover & Rate on Choseno</span>
              <div style={{ display: "flex", fontSize: 12, color: "#cbd5e1", fontWeight: 600, marginTop: 2 }}>
                Civic engagement platform for accountability
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE }
  );
}
