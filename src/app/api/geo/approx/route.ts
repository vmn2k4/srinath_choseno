import { NextRequest, NextResponse } from "next/server";

// Approximate (city-level) location of the CALLER, from the geo headers
// Vercel's edge attaches to every request. Used by the "Auto-detect" fallback
// when the browser denies or can't provide GPS. Nothing is stored or logged
// and the answer goes only back to the requester about their own request.
// Absent outside Vercel (e.g. local dev) -> found:false.
export const dynamic = "force-dynamic";

function decode(v: string | null) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function GET(request: NextRequest) {
  const lat = parseFloat(request.headers.get("x-vercel-ip-latitude") || "");
  const lng = parseFloat(request.headers.get("x-vercel-ip-longitude") || "");
  const headers = { "Cache-Control": "private, no-store" };

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ found: false }, { headers });
  }

  const city = decode(request.headers.get("x-vercel-ip-city"));
  const region = request.headers.get("x-vercel-ip-country-region");
  return NextResponse.json(
    { found: true, lat, lng, place: [city, region].filter(Boolean).join(", ") || null },
    { headers }
  );
}
