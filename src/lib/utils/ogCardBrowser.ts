import satori from "satori";
import { OG_IMAGE_SIZE, buildNewsArticleOgCardElement, type NewsArticleOgCardInput } from "./ogCard";

// Browser-only rendering: wraps the pure element builder in ogCard.tsx with
// Satori (pure JS, works outside Node/edge) + a <canvas> rasterize step, so
// an admin's browser can produce the exact same PNG the server would via
// renderNewsArticleOgCard in og.tsx -- without ever invoking a Vercel
// Function. See generateOgImages() in AdminNewsPageClient, which calls this
// right when an article is published and uploads the result straight to
// Supabase Storage via uploadNewsOgImage (src/lib/services/news.ts), falling
// back to the deployed api/news/[slug]/og-image route if anything here
// throws (unsupported browser, a font/photo fetch hiccup, etc).

type SatoriFont = { name: string; data: ArrayBuffer; weight: 700 | 900; style: "normal" };

let fontsPromise: Promise<SatoriFont[]> | null = null;

// Fonts are fetched once per page load and reused for every card rendered
// in that session. Satori has no built-in font -- unlike next/og server-side,
// it needs the actual bytes, and only accepts ttf/otf/woff (not woff2), which
// is why these are separate .woff files in public/fonts rather than reusing
// the site's self-hosted next/font woff2 build.
function loadFonts(): Promise<SatoriFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      fetch("/fonts/PublicSans-Bold.woff").then((r) => r.arrayBuffer()),
      fetch("/fonts/PublicSans-Black.woff").then((r) => r.arrayBuffer()),
    ]).then(([bold, black]) => [
      { name: "Public Sans", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Public Sans", data: black, weight: 900 as const, style: "normal" as const },
    ]);
  }
  return fontsPromise;
}

// Re-fetches a politician photo and inlines it as a data: URI before handing
// it to Satori. Satori embeds <img> sources into the output SVG as a plain
// reference to the original URL; rasterizing that SVG onto a <canvas> below
// would then taint the canvas as cross-origin (blocking canvas.toBlob) even
// though the photo itself is publicly readable -- inlining it as a data URI
// keeps the whole SVG same-origin-safe.
async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Renders the news-article share card in the browser and returns it as a PNG Blob. */
export async function renderNewsArticleOgCardToPngBlob(input: NewsArticleOgCardInput): Promise<Blob> {
  const [fonts, politicianPhotoUrl] = await Promise.all([loadFonts(), toDataUri(input.politicianPhotoUrl)]);

  const svg = await satori(
    buildNewsArticleOgCardElement({ ...input, politicianPhotoUrl }) as Parameters<typeof satori>[0],
    { ...OG_IMAGE_SIZE, fonts }
  );

  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load rendered SVG"));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = OG_IMAGE_SIZE.width;
    canvas.height = OG_IMAGE_SIZE.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(image, 0, 0, OG_IMAGE_SIZE.width, OG_IMAGE_SIZE.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
