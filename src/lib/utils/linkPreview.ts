// Some news sites (NDTV, others behind Akamai/Cloudflare) answer Microlink's
// server-side fetch with a bot-block page, and Microlink reports that page's
// title as if it were the article ("Access Denied", "Just a moment..."). These
// helpers detect that and recover a readable title from the URL's slug so the
// preview card is still useful.
const BLOCK_PAGE_TITLE_RE =
  /^(access denied|just a moment|attention required|403\b|forbidden|error 403|are you a robot|robot check|pardon our interruption|request blocked|security check|verifying you are human)/i;

export function isBlockPageMetadata(title?: string | null, description?: string | null): boolean {
  if (title && BLOCK_PAGE_TITLE_RE.test(title.trim())) return true;
  return Boolean(description && /^reference #[\w.]+/i.test(description.trim()));
}

// "…/trump-fires-press-secretary-katie-zacharia-after-5-days-12196998?x=1"
// -> "Trump fires press secretary katie zacharia after 5 days". Null when the
// last path segment doesn't look like a headline slug (fewer than 3 words).
export function titleFromUrlSlug(rawUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return null;
  }
  const segment = pathname.split("/").filter(Boolean).pop() || "";
  const words = decodeURIComponent(segment)
    .replace(/\.(html?|php|aspx?)$/i, "")
    .split(/[-_]+/)
    .filter((w) => w && !/^\d{6,}$/.test(w));
  if (words.length < 3) return null;
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
