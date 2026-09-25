import { ImageResponse } from "next/og";
import { getBlogPostBySlug } from "@/lib/services/blogs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400; // Cache for 24 hours

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  const title = post ? post.title : "Choseno Civic & Election Guide";
  const category = post ? post.category.toUpperCase() : "CIVIC GUIDE";
  const takeaway = post ? post.takeaways[0] : "Verified boundary-level representation and accountability.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          background: "#12141f",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient background glow blobs */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, rgba(18, 20, 31, 0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-100px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(18, 20, 31, 0) 70%)",
          }}
        />

        {/* Top Header Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            zIndex: 10,
          }}
        >
          {/* Logo Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #f97316 0%, #ff8c00 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: "bold",
                fontSize: "24px",
              }}
            >
              C
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "24px", fontWeight: "900", color: "#f4f5f0", letterSpacing: "-0.03em" }}>
                CHOSENO
              </span>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#f97316", letterSpacing: "0.15em" }}>
                CIVIC INTELLIGENCE
              </span>
            </div>
          </div>

          {/* Category Badge */}
          <div
            style={{
              padding: "6px 16px",
              borderRadius: "9999px",
              background: "rgba(249, 115, 22, 0.18)",
              border: "1px solid rgba(249, 115, 22, 0.35)",
              color: "#fb923c",
              fontSize: "12px",
              fontWeight: "700",
              letterSpacing: "0.08em",
            }}
          >
            {category} · US CIVIC GUIDE
          </div>
        </div>

        {/* Middle Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", zIndex: 10 }}>
          <div
            style={{
              fontSize: "44px",
              fontWeight: "800",
              color: "#f4f5f0",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              maxWidth: "1050px",
            }}
          >
            {title}
          </div>

          {/* Takeaway Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px 20px",
              borderRadius: "16px",
              background: "rgba(32, 26, 36, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              maxWidth: "1000px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 10px #10b981",
              }}
            />
            <span
              style={{
                fontSize: "16px",
                color: "#cbd5e1",
                fontStyle: "italic",
                lineHeight: 1.3,
              }}
            >
              &ldquo;{takeaway}&rdquo;
            </span>
          </div>
        </div>

        {/* Bottom CTA Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderRadius: "16px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: "14px", color: "#94a3b8" }}>
            Boundary-Verified Representation · 1-5 Star Politician Ratings · Anonymous Ghost IDs
          </span>
          <span style={{ fontSize: "14px", fontWeight: "700", color: "#f97316" }}>
            Explore on choseno.com →
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
