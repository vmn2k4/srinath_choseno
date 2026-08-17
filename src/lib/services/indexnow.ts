import { SITE_URL } from "@/lib/constants/site";

// ── IndexNow ──────────────────────────────────────────────────────────────
//
// Pushes new/updated URLs to Bing, Yandex, and other IndexNow-participating
// engines the moment they go live, instead of waiting for a crawler to
// revisit the sitemap. Google does not consume IndexNow directly, but Bing
// results (and Bing-derived surfaces like Copilot/ChatGPT web search) update
// within minutes instead of days.
//
// The key below is intentionally public and committed -- IndexNow's only
// "auth" is hosting a `<key>.txt` file at the site root containing the key
// itself (see public/2ed122ee7f2e2692b45f25ffbae0bb4d.txt), so there's
// nothing secret to protect. Docs: https://www.indexnow.org/documentation
//
// Server-side only (plain fetch to a third-party API) -- call this from a
// route handler, never directly from a client component.

const INDEXNOW_KEY = "2ed122ee7f2e2692b45f25ffbae0bb4d";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export interface IndexNowResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * Notify IndexNow that the given absolute or path-only URLs were
 * added/updated. Best-effort: failures are swallowed into the returned
 * result rather than thrown, since a failed ping should never block a
 * publish action.
 */
export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  const absoluteUrls = urls
    .filter(Boolean)
    .map((u) => (u.startsWith("http") ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`));

  if (absoluteUrls.length === 0) return { ok: false, error: "No URLs provided" };

  const host = new URL(SITE_URL).host;

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: absoluteUrls,
      }),
    });

    // IndexNow returns 200 or 202 on success; it has no response body.
    if (res.ok || res.status === 202) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: `IndexNow responded ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "IndexNow request failed" };
  }
}
