import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function uploadVideo(supabase: Client, bucket: string, fileName: string, blob: Blob) {
  return supabase.storage.from(bucket).upload(fileName, blob, { contentType: "video/webm" });
}

export function getVideoPublicUrl(supabase: Client, bucket: string, fileName: string) {
  return supabase.storage.from(bucket).getPublicUrl(fileName);
}
