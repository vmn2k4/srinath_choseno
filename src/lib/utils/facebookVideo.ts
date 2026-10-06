// Recognizes Facebook video links (watch, /<page>/videos/<id>, reel, share/v|r,
// video.php, fb.watch) so they can play inside Choseno through Facebook's own
// embeddable video player instead of sending the viewer off-site. Returns null
// for anything that isn't a video link (a profile or a plain post), so callers
// can use it both to validate input and to detect Facebook values -- same role
// parseYouTubeId plays for YouTube.
export function parseFacebookVideoUrl(input: string | null | undefined): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|web|mbasic|l)\./, "");
  const path = url.pathname.replace(/\/+$/, "");

  if (host === "fb.watch") {
    const code = path.split("/")[1];
    return code ? `https://fb.watch/${code}/` : null;
  }
  if (host !== "facebook.com" && host !== "fb.com") return null;

  if (path === "/watch" || path === "/video.php") {
    const id = url.searchParams.get("v");
    return id && /^\d+$/.test(id) ? `https://www.facebook.com/watch/?v=${id}` : null;
  }
  const reel = path.match(/^\/reel\/(\d+)/);
  if (reel) return `https://www.facebook.com/reel/${reel[1]}`;
  const share = path.match(/^\/share\/([vr])\/([^/]+)/);
  if (share) return `https://www.facebook.com/share/${share[1]}/${share[2]}/`;
  if (/^\/[^/]+(?:\/[^/]+)*\/videos\/(?:[^/]+\/)?\d+/.test(path)) return `https://www.facebook.com${path}`;
  return null;
}

/** Facebook's own embeddable player for a video link, or null if it isn't one. */
export function facebookVideoEmbedUrl(input: string | null | undefined, autoplay = false): string | null {
  const canonical = parseFacebookVideoUrl(input);
  if (!canonical) return null;
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=false&width=560${autoplay ? "&autoplay=true" : ""}`;
}
