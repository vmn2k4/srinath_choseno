/**
 * politician_profiles.bio has no dedicated social-links column (see
 * docs/CANDIDATE_DATA_PULL_LOG.md, "Bonus, same source" section) -- when a
 * candidate enrichment pass (surrey_enrich.py, burnaby_enrich.py, ...)
 * finds a website/Facebook/Instagram/etc on the source page, it appends a
 * trailing "Website: ... | Facebook: ... | Instagram: ..." line to bio,
 * pipe-separated, as its own paragraph. Rendered as plain text that line
 * is just inert copy -- this turns it back into real clickable links
 * without a schema change, by recognizing that trailing-line convention
 * and parsing it out of the prose.
 *
 * Deliberately conservative: only strips/parses the last paragraph when
 * EVERY pipe-separated segment cleanly matches "Label: value" -- one
 * unrecognized segment and the whole bio is left untouched, so a bio that
 * doesn't follow this convention (or a false-positive-looking coincidence)
 * never has real prose silently cut off.
 */

export interface ParsedBioLink {
  label: string;
  /** Display value (handle, name, or URL) as written in the source line. */
  value: string;
  /** Resolved absolute URL, or null when the value isn't safely linkable
   *  (e.g. a plain display name with no real handle/URL to build from) --
   *  render as plain text in that case rather than guess a broken link. */
  href: string | null;
}

export interface ParsedBio {
  /** Bio text with the trailing links line removed, if one was found. */
  text: string;
  links: ParsedBioLink[];
}

function isUrlLike(value: string): boolean {
  return !/\s/.test(value) && (/^https?:\/\//i.test(value) || value.includes("."));
}

function ensureProtocol(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

// A bare handle (no domain in it) that still contains "@" after its
// leading one is stripped is almost always mangled data (e.g. an email
// address that got merged into a handle field), not a real handle -- see
// "Instagram: @gulamfirdos@gmail.com6" caught in the Burnaby data.
function isPlausibleHandle(handle: string): boolean {
  return handle.length > 0 && !/\s/.test(handle) && !handle.slice(1).includes("@");
}

const HANDLE_BASE_URL: Record<string, string> = {
  facebook: "https://facebook.com/",
  instagram: "https://instagram.com/",
  x: "https://x.com/",
  twitter: "https://x.com/",
  "x (formerly twitter)": "https://x.com/",
  tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/@",
};

// LinkedIn has no safe bare-handle base -- a source page almost always
// gives a display name ("Mike Bose"), not the /in/... slug, so a
// constructed URL would just be wrong. Only linkify it when the value is
// already a real linkedin.com URL.
const NO_HANDLE_FALLBACK = new Set(["linkedin"]);

function resolveLinkHref(label: string, value: string): string | null {
  const key = label.trim().toLowerCase();
  if (isUrlLike(value)) return ensureProtocol(value);
  if (key === "website" || NO_HANDLE_FALLBACK.has(key)) return null;
  const base = HANDLE_BASE_URL[key];
  if (!base) return null;
  const handle = value.replace(/^@/, "");
  return isPlausibleHandle(handle) ? base + handle : null;
}

export function parseBioLinks(bio: string | null | undefined): ParsedBio {
  if (!bio) return { text: "", links: [] };

  const paragraphs = bio.split(/\n{2,}/);
  const lastParagraph = paragraphs[paragraphs.length - 1]?.trim();
  if (!lastParagraph || !lastParagraph.includes("|")) {
    return { text: bio, links: [] };
  }

  const segments = lastParagraph.split(/\s*\|\s*/).map((s) => s.trim());
  const parsed: { label: string; value: string }[] = [];
  for (const segment of segments) {
    const match = segment.match(/^([^:]{1,20}):\s*(.+)$/);
    if (!match) return { text: bio, links: [] }; // one bad segment -> leave bio untouched
    parsed.push({ label: match[1].trim(), value: match[2].trim() });
  }
  if (parsed.length === 0) return { text: bio, links: [] };

  const links = parsed.map(({ label, value }) => ({
    label,
    value,
    href: resolveLinkHref(label, value),
  }));

  const text = paragraphs.slice(0, -1).join("\n\n").trim();
  return { text: text || bio, links };
}
