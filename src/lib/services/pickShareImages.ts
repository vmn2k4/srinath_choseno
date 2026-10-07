import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVER ONLY (uses the service-role key; only imported by
// src/app/p/[code]/opengraph-image.tsx). Persistent store for a pick share's
// rendered OG card in the public `pick-share-og-images` bucket
// (20261008000003): a share's picks/notes are immutable, so the card is
// rendered once and read back from storage on every later request.
//
// Bump IMAGE_VERSION whenever the card layout changes so old renders are
// ignored (new key) instead of served stale forever.
const BUCKET = "pick-share-og-images";
const IMAGE_VERSION = "v1";

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const objectPath = (code: string) => `${IMAGE_VERSION}/${code}.png`;

export async function getStoredPickShareImage(code: string): Promise<ArrayBuffer | null> {
  const base = supabaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/storage/v1/object/public/${BUCKET}/${objectPath(code)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

// Best-effort: a failed upload just means the next request renders again.
export async function storePickShareImage(code: string, png: ArrayBuffer): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = supabaseUrl();
  if (!key || !base) return;
  try {
    const client = createSupabaseClient(base, key, { auth: { persistSession: false } });
    // upsert:false -- two concurrent first requests both render, the loser's
    // "already exists" error is harmless.
    await client.storage.from(BUCKET).upload(objectPath(code), png, { contentType: "image/png", upsert: false });
  } catch {
    // ignore
  }
}
