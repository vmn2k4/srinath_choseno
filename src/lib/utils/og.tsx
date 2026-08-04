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
  const safeTitle = truncate(title, 90);
  const safeSubtitle = subtitle ? truncate(subtitle, 140) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #14080e 0%, #201a24 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #f97316, #f59e0b)",
            }}
          />
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>
            <span style={{ color: "#f97316" }}>Chosen</span>
            <span style={{ color: "#f59e0b" }}>o</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                textTransform: "uppercase",
                letterSpacing: 4,
                color: "#f59e0b",
                fontWeight: 600,
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: safeTitle.length > 55 ? 48 : 60,
                fontWeight: 800,
                lineHeight: 1.15,
                color: "#f7f5f2",
              }}
            >
              {safeTitle}
            </div>
            {safeSubtitle && (
              <div style={{ display: "flex", fontSize: 26, color: "#c9c2ce", lineHeight: 1.4 }}>
                {safeSubtitle}
              </div>
            )}
          </div>
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              width={220}
              height={220}
              style={{
                borderRadius: "50%",
                objectFit: "cover",
                border: "6px solid #f59e0b",
              }}
            />
          )}
        </div>

        <div style={{ display: "flex", fontSize: 20, color: "#8a8291" }}>choseno.com</div>
      </div>
    ),
    { ...OG_IMAGE_SIZE }
  );
}
