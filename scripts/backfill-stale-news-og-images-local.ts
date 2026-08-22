/**
 * scripts/backfill-stale-news-og-images-local.ts
 *
 * ONE-OFF backfill (2026-08-22), local-rendering variant. See
 * backfill-stale-news-og-images.js for the full root-cause writeup
 * (migration 20260822000000_invalidate_stale_news_og_image_on_retag.sql).
 *
 * That first version regenerated each image by calling the deployed
 * generate-news-og-image Supabase Edge Function once per article -- real
 * render CPU on Supabase's infra for every one of 555 articles. This
 * version does the identical render (same buildNewsArticleOgCardElement
 * layout, satori, 1200x630) *on this machine* instead, using `sharp`
 * (already present in node_modules, not added for this) to rasterize
 * Satori's SVG output to PNG -- Supabase only ever sees a small Storage
 * upload + a single-row UPDATE per article, not a render.
 *
 * Run with tsx (already a devDependency) so it can import the existing
 * .tsx card layout directly:
 *   npx tsx scripts/backfill-stale-news-og-images-local.ts <path-to-slug-list>
 */

import fs from "fs";
import path from "path";
import satori from "satori";
import sharp from "sharp";
import { buildNewsArticleOgCardElement, OG_IMAGE_SIZE, type NewsArticleOgCardInput } from "../src/lib/utils/ogCard";

const envPath = path.resolve(__dirname, "..", ".env.local");
const env: Record<string, string> = {};
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = "news-images";
const FETCH_BATCH_SIZE = 40; // articles per PostgREST lookup (slug=in.(...))
const CONCURRENCY = 6; // local render is cheap; this just bounds concurrent Supabase uploads/updates

interface ArticleRow {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  category: string;
  country: string | null;
  province: string | null;
  event_date: string | null;
  published_at: string | null;
  content: { body?: string | null } | null;
  news_article_politicians: Array<{
    profiles: {
      full_name: string;
      designation: string | null;
      constituency: string | null;
      politician_profiles: { photo_url: string | null; avatar_url: string | null } | null;
    } | null;
  }> | null;
}

async function getAdminAccessToken(): Promise<string> {
  if (!env.admin_un || !env.admin_pwd) {
    console.error("Missing admin_un/admin_pwd in .env.local -- required to authenticate as admin.");
    process.exit(1);
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd }),
  });
  if (!res.ok) {
    console.error("Admin login failed:", await res.text());
    process.exit(1);
  }
  const data = await res.json();
  return data.access_token as string;
}

function loadFonts() {
  const bold = fs.readFileSync(path.resolve(__dirname, "..", "public/fonts/PublicSans-Bold.woff"));
  const black = fs.readFileSync(path.resolve(__dirname, "..", "public/fonts/PublicSans-Black.woff"));
  return [
    { name: "Public Sans", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Public Sans", data: black, weight: 900 as const, style: "normal" as const },
  ];
}

// Re-fetches a politician photo and inlines it as a base64 data: URI --
// same reasoning as ogCardBrowser.ts's toDataUri: satori embeds <img> src
// as a plain URL reference, and a remote URL Satori itself can't fetch
// reliably outside a browser/edge fetch context is safer inlined up front.
async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function fetchArticles(slugs: string[], token: string): Promise<ArticleRow[]> {
  const select =
    "id,slug,headline,summary,category,country,province,event_date,published_at,content,news_article_politicians(profiles(full_name,designation,constituency,politician_profiles(photo_url,avatar_url)))";
  const url = `${SUPABASE_URL}/rest/v1/news_articles?select=${encodeURIComponent(select)}&slug=in.(${slugs
    .map((s) => `"${s}"`)
    .join(",")})`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function renderCard(article: ArticleRow, fonts: ReturnType<typeof loadFonts>): Promise<Buffer> {
  const primaryPolitician = (article.news_article_politicians ?? []).map((p) => p.profiles).filter(Boolean)[0];
  const photoUrl = primaryPolitician?.politician_profiles?.photo_url || primaryPolitician?.politician_profiles?.avatar_url;
  const inlinedPhoto = await toDataUri(photoUrl);

  const baseInput: NewsArticleOgCardInput = {
    headline: article.headline,
    summary: article.summary,
    category: article.category,
    country: article.country,
    province: article.province,
    eventDate: article.event_date,
    publishedAt: article.published_at,
    bodyMarkdown: article.content?.body,
    politicianName: primaryPolitician?.full_name,
    politicianDesignation: primaryPolitician?.designation,
    politicianConstituency: primaryPolitician?.constituency,
    politicianPhotoUrl: inlinedPhoto,
  };

  try {
    const svg = await satori(buildNewsArticleOgCardElement(baseInput) as Parameters<typeof satori>[0], {
      ...OG_IMAGE_SIZE,
      fonts: fonts as any,
    });
    return await sharp(Buffer.from(svg)).png().toBuffer();
  } catch (e) {
    // A small handful of external politician photos (not our own Storage
    // uploads) come back as bytes Satori can't lay out as an <img> even
    // after inlining to a data: URI -- degrade to the initials-avatar
    // fallback (politicianPhotoUrl omitted) rather than failing the whole
    // card over one photo.
    if (!inlinedPhoto) throw e;
    const svg = await satori(
      buildNewsArticleOgCardElement({ ...baseInput, politicianPhotoUrl: undefined }) as Parameters<typeof satori>[0],
      { ...OG_IMAGE_SIZE, fonts: fonts as any }
    );
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}

async function uploadAndSave(slug: string, png: Buffer, token: string): Promise<void> {
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/og-cards/${slug}.png`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: png,
  });
  if (!uploadRes.ok) throw new Error(`Storage upload failed: ${uploadRes.status} ${await uploadRes.text()}`);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/og-cards/${slug}.png`;
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ hero_image_url: publicUrl }),
  });
  if (!patchRes.ok) throw new Error(`DB update failed: ${patchRes.status} ${await patchRes.text()}`);
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

async function main() {
  const listPath = process.argv[2];
  if (!listPath) {
    console.error("Usage: npx tsx scripts/backfill-stale-news-og-images-local.ts <path-to-slug-list>");
    process.exit(1);
  }
  const allSlugs = fs.readFileSync(listPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  console.log(`Locally rendering share-card images for ${allSlugs.length} articles...`);

  const token = await getAdminAccessToken();
  const fonts = loadFonts();

  const batches: string[][] = [];
  for (let i = 0; i < allSlugs.length; i += FETCH_BATCH_SIZE) batches.push(allSlugs.slice(i, i + FETCH_BATCH_SIZE));

  let done = 0;
  const failures: Array<{ slug: string; error: string }> = [];

  for (const batch of batches) {
    const articles = await fetchArticles(batch, token);
    const foundSlugs = new Set(articles.map((a) => a.slug));
    for (const slug of batch) {
      if (!foundSlugs.has(slug)) failures.push({ slug, error: "not found (unpublished or deleted since list was captured)" });
    }

    await runWithConcurrency(articles, CONCURRENCY, async (article) => {
      try {
        const png = await renderCard(article, fonts);
        await uploadAndSave(article.slug, png, token);
      } catch (e) {
        failures.push({ slug: article.slug, error: e instanceof Error ? e.message : String(e) });
      }
      done += 1;
      if (done % 25 === 0 || done === allSlugs.length) console.log(`  ${done}/${allSlugs.length}`);
    });
  }

  console.log(`\nDone. ${allSlugs.length - failures.length} succeeded, ${failures.length} failed.`);
  if (failures.length) {
    const outPath = path.resolve(__dirname, "backfill-stale-news-og-images-local-failures.json");
    fs.writeFileSync(outPath, JSON.stringify(failures, null, 2));
    console.log(`Failures written to ${outPath}`);
  }
}

main();
