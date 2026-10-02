// Extracts the 11-char video id from any common YouTube URL shape (watch,
// youtu.be, shorts, embed, live) or a bare id. Returns null for anything else,
// so callers can use it both to validate input and to detect YouTube values.
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
      id = m ? m[1] : null;
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

export function youTubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}
