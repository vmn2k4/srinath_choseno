import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  const currentSupabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://qlzyfdwrkcxyqapewxwg.supabase.co";

  try {
    const currentDomain = new URL(currentSupabaseUrl).hostname;
    // Replace any legacy *.supabase.co domain with the active project's domain
    return url.replace(/https:\/\/[a-z0-9-]+\.supabase\.co/gi, `https://${currentDomain}`);
  } catch {
    return url;
  }
}

export async function uploadVideo(supabase: Client, bucket: string, fileName: string, blob: Blob) {
  return supabase.storage.from(bucket).upload(fileName, blob, { contentType: "video/webm" });
}

export function getVideoPublicUrl(supabase: Client, bucket: string, fileName: string) {
  const res = supabase.storage.from(bucket).getPublicUrl(fileName);
  return {
    ...res,
    data: {
      ...res.data,
      publicUrl: normalizeMediaUrl(res.data.publicUrl),
    },
  };
}
