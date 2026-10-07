import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE, truncateWordSafe } from "@/lib/utils/ogCard";
import { joinNames, type PickRosterCandidate } from "@/lib/utils/pickShare";
import { createPublicClient } from "@/lib/supabase/public";
import { isRacePickShareLive } from "@/lib/services/pickShares";
import { getStoredPickShareImage, storePickShareImage } from "@/lib/services/pickShareImages";
import { loadPickShare } from "./loadPickShare";

export const alt = "Candidates supported on Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Short TTL (vs the 7 days on the seat card): a share that gets reported and
// hidden should stop rendering within the hour.
export const revalidate = 3600;

interface Props {
  params: Promise<{ code: string }>;
}

const CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const ORANGE = "#f97316";
const INK = "#0f172a";
const MUTED = "#64748b";
const MAX_PICKED_SHOWN = 6;
const ROW_WIDTH_BUDGET = 1096;

// Satori fetches remote <img> itself but throws (failing the whole image) on
// a bad/slow URL, and doesn't decode every format -- so prefetch with a
// timeout and only inline png/jpeg/gif; anything else falls back to initials.
async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!["image/png", "image/jpeg", "image/gif"].includes(type)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 1_500_000) return null;
    return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

async function loadFonts() {
  try {
    const dir = join(process.cwd(), "public", "fonts");
    const [bold, black] = await Promise.all([
      readFile(join(dir, "PublicSans-Bold.woff")),
      readFile(join(dir, "PublicSans-Black.woff")),
    ]);
    const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    return [
      { name: "Public Sans", data: ab(bold), weight: 700 as const, style: "normal" as const },
      { name: "Public Sans", data: ab(black), weight: 900 as const, style: "normal" as const },
    ];
  } catch {
    return [];
  }
}

// The Choseno logo mark (forward/reverse arrow arcs around an "eye"), same
// paths as public/icon.svg and the ChosenoLogo primitive -- inlined because
// Satori can't import an SVG file or use the animated React component.
function ChosenoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cm-top" x1="4" y1="8" x2="44" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ff8c00" />
        </linearGradient>
        <linearGradient id="cm-bottom" x1="44" y1="28" x2="8" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <path d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z" fill="url(#cm-top)" />
      <path d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z" fill="url(#cm-bottom)" />
      <circle cx="24" cy="24" r="6" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
      <circle cx="24" cy="24" r="3.5" fill="#0f172a" />
    </svg>
  );
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function Face({ name, src, px, ring }: { name: string; src: string | null; px: number; ring: boolean }) {
  const face = src ? (
    <img src={src} width={px} height={px} style={{ width: px, height: px, borderRadius: "50%", objectFit: "cover" }} alt="" />
  ) : (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #fb923c, #ea580c)",
        color: "#fff",
        fontSize: Math.round(px * 0.38),
        fontWeight: 900,
      }}
    >
      {initials(name)}
    </div>
  );
  if (!ring) return face;
  const pad = Math.round(px * 0.09);
  const box = px + pad * 2;
  // Two slightly offset, rotated ovals read as a hand-drawn circle around
  // the candidate -- the "circle your pick on the ballot" look.
  return (
    <div style={{ display: "flex", position: "relative", width: box, height: box, alignItems: "center", justifyContent: "center" }}>
      {face}
      <div
        style={{
          position: "absolute", top: 0, left: 0, width: box, height: box, borderRadius: "50%",
          border: `${Math.max(6, Math.round(px * 0.04))}px solid ${ORANGE}`, transform: "rotate(-5deg) scaleX(1.03)",
        }}
      />
      <div
        style={{
          position: "absolute", top: -3, left: 4, width: box - 4, height: box + 2, borderRadius: "50%",
          border: `${Math.max(3, Math.round(px * 0.02))}px solid ${ORANGE}`, opacity: 0.75, transform: "rotate(6deg)",
        }}
      />
    </div>
  );
}

export default async function Image({ params }: Props) {
  const { code } = await params;

  // A share's card never changes, so it is rendered once and stored: serve the
  // stored PNG if there is one (after a cheap check that the share hasn't been
  // removed), and only fall through to rendering on the first request.
  if (/^[a-z0-9]{6,12}$/.test(code)) {
    const stored = await getStoredPickShareImage(code);
    if (stored && (await isRacePickShareLive(createPublicClient(), code))) {
      return new Response(stored, { headers: { "Content-Type": "image/png", "Cache-Control": CACHE_CONTROL } });
    }
  }

  let loaded: Awaited<ReturnType<typeof loadPickShare>> = null;
  try {
    loaded = await loadPickShare(code);
  } catch {
    loaded = null;
  }

  if (!loaded) {
    const fallback = await readFile(join(process.cwd(), "public", "og-fallback.png"));
    return new Response(new Uint8Array(fallback), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
    });
  }

  const { share, seat, picked: allPicked, others: allOthers } = loaded;
  const picked = allPicked.slice(0, MAX_PICKED_SHOWN);
  const n = picked.length;
  // Per-pick quotes need width and height, so faces shrink when any pick
  // has a note; the quote font/length scale down as picks are added.
  const hasQuotes = picked.some((c) => c.note);
  const pickPx = hasQuotes
    ? n === 1 ? 165 : n === 2 ? 150 : n === 3 ? 125 : 100
    : n === 1 ? 220 : n === 2 ? 190 : n === 3 ? 160 : n === 4 ? 130 : 105;
  const otherPx = n >= 4 ? 52 : 64;
  const pickTileW = hasQuotes
    ? n === 1 ? 560 : n === 2 ? 400 : n === 3 ? 310 : 232
    : n === 1 ? 520 : n === 2 ? 380 : n === 3 ? 300 : pickPx + 70;
  const otherTileW = otherPx + 24;
  const quoteSize = n === 1 ? 26 : n === 2 ? 22 : n === 3 ? 20 : 17;
  const quoteMax = n === 1 ? 140 : n === 2 ? 110 : n === 3 ? 85 : 60;

  // Fill what's left of the row with the un-picked candidates (zoomed out);
  // anything that doesn't fit collapses into a "+N" tile.
  let used = n * pickTileW;
  const others: PickRosterCandidate[] = [];
  for (const c of allOthers) {
    const remaining = allOthers.length - others.length - 1;
    const reserve = remaining > 0 ? otherTileW : 0;
    if (used + otherTileW + reserve > ROW_WIDTH_BUDGET) break;
    others.push(c);
    used += otherTileW;
  }
  const hidden = allOthers.length - others.length + (allPicked.length - picked.length);

  const [fonts, pickedFaces, otherFaces] = await Promise.all([
    loadFonts(),
    Promise.all(picked.map((c) => toDataUri(c.avatarUrl))),
    Promise.all(others.map((c) => toDataUri(c.avatarUrl))),
  ]);

  const author = share.authorLabel || "A Choseno voter";
  const roleTitle = seat?.role_title || "this race";
  const place = seat?.map_shapes?.name || "";
  // "{author} is backing {names} for {Role} of {Place}. Who do you support?"
  const raceText = place ? `${roleTitle} of ${place}` : roleTitle;
  const allNames = allPicked.map((c) => c.name);
  const namesText = allNames.length <= 3 ? joinNames(allNames) : `${allNames[0]}, ${allNames[1]} and ${allNames.length - 2} others`;
  const headline = truncateWordSafe(`${author} is backing ${namesText} for ${raceText}.`, 120);
  const note = share.note ? truncateWordSafe(share.note, 120) : null;
  const nameSize = hasQuotes ? (n === 1 ? 30 : n <= 3 ? 24 : 19) : n === 1 ? 34 : n <= 3 ? 27 : 22;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "30px 52px 26px 52px",
          background: "linear-gradient(135deg, #fffaf5 0%, #fff7ed 45%, #fef3c7 100%)", fontFamily: "Public Sans, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ChosenoMark size={46} />
            <div style={{ display: "flex", fontSize: 27, fontWeight: 900, letterSpacing: "-0.03em" }}>
              <span style={{ color: INK }}>Chosen</span>
              <span style={{ color: ORANGE }}>o</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
          <div style={{ display: "flex", fontSize: 29, fontWeight: 900, color: INK, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            {headline}
          </div>
          <div style={{ display: "flex", marginTop: 4, fontSize: 32, fontWeight: 900, color: ORANGE, letterSpacing: "-0.01em" }}>
            Who do you support?
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: hasQuotes ? "flex-start" : "center", justifyContent: "center", gap: 0, paddingTop: hasQuotes ? 14 : 0 }}>
          {picked.map((c, i) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: pickTileW }}>
              <Face name={c.name} src={pickedFaces[i]} px={pickPx} ring />
              <div
                style={{
                  display: "flex", marginTop: 10, fontSize: nameSize, fontWeight: 900, color: INK, textAlign: "center",
                  justifyContent: "center", lineHeight: 1.1,
                }}
              >
                {truncateWordSafe(c.name, n === 1 ? 28 : 18)}
              </div>
              {c.partyName && n <= 3 && (
                <div style={{ display: "flex", marginTop: 4, fontSize: 20, fontWeight: 700, color: MUTED }}>
                  {truncateWordSafe(c.partyName, 24)}
                </div>
              )}
              {c.note && (
                <div
                  style={{
                    display: "flex", marginTop: 10, padding: "0 10px", fontSize: quoteSize, fontWeight: 700, color: INK,
                    fontStyle: "italic", textAlign: "center", justifyContent: "center", lineHeight: 1.25,
                  }}
                >
                  {`“${truncateWordSafe(c.note, quoteMax)}”`}
                </div>
              )}
            </div>
          ))}
          {others.map((c, i) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: otherTileW, opacity: 0.5 }}>
              <Face name={c.name} src={otherFaces[i]} px={otherPx} ring={false} />
              <div style={{ display: "flex", marginTop: 6, fontSize: 14, fontWeight: 700, color: MUTED, textAlign: "center" }}>
                {truncateWordSafe(c.name.split(/\s+/).slice(-1)[0] || c.name, 12)}
              </div>
            </div>
          ))}
          {hidden > 0 && (
            <div style={{ display: "flex", width: otherTileW, justifyContent: "center", fontSize: 22, fontWeight: 900, color: MUTED, opacity: 0.7 }}>
              +{hidden}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div
            style={{
              display: "flex", flex: 1, fontSize: note ? 26 : 22, fontWeight: 700, color: note ? INK : MUTED,
              lineHeight: 1.25, fontStyle: note ? "italic" : "normal",
            }}
          >
            {note ? `“${note}”` : ""}
          </div>
          <div
            style={{
              display: "flex", padding: "12px 26px", borderRadius: 999, background: ORANGE, color: "#fff", fontSize: 22,
              fontWeight: 900,
            }}
          >
            Make your picks · choseno.com
          </div>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE, fonts: fonts.length ? fonts : undefined }
  );
  // Persist the render (best-effort) so every later request is a storage read.
  // Also set explicit cache headers: without them the CDN serves
  // `max-age=0, must-revalidate`. The 1h s-maxage bounds how long a
  // reported/hidden share's image keeps serving from the edge.
  const png = await image.arrayBuffer();
  await storePickShareImage(code, png);
  return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": CACHE_CONTROL } });
}
