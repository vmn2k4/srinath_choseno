import { ImageResponse } from "next/og";
import {
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
  buildOgCardElement,
  buildNewsArticleOgCardElement,
  truncateWordSafe,
  type OgCardProps,
  type NewsArticleOgCardInput,
} from "./ogCard";

// Server-only rendering: wraps the pure element builders in ogCard.tsx with
// next/og's ImageResponse (Satori + PNG encode). Kept in its own file
// because `next/og` pulls in Node-only internals that break the client
// bundle -- see the big comment at the top of ogCard.tsx. Only ever import
// this file from server code (route handlers, opengraph-image.tsx files);
// for a browser render, use ogCardBrowser.ts instead.

export { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE, truncateWordSafe };
export type { OgCardProps, NewsArticleOgCardInput };

export function renderOgCard(props: OgCardProps): ImageResponse {
  return new ImageResponse(buildOgCardElement(props), { ...OG_IMAGE_SIZE });
}

export function renderNewsArticleOgCard(input: NewsArticleOgCardInput): ImageResponse {
  return new ImageResponse(buildNewsArticleOgCardElement(input), { ...OG_IMAGE_SIZE });
}
