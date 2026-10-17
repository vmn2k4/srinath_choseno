import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type LinkPreviewData = {
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  url: string;
};

// Title / description / image / video of a URL, read server-side by the
// `link-preview` edge function (shared with the mobile app). Null when the page
// can't be read, so callers just skip the card.
export async function fetchLinkPreview(supabase: Client, url: string): Promise<LinkPreviewData | null> {
  const { data, error } = await supabase.functions.invoke("link-preview", { body: { url } });
  if (error || !data || data.error) return null;
  return data as LinkPreviewData;
}
