import type { LinkMetadata } from "@/components/features/LinkPreview";

// Read the current tab. Only works after the user opens the popup (activeTab),
// so nothing is ever read in the background.
const TRACKING = /^(utm_|fbclid|gclid|mc_|igshid|ref$|ref_src|spm$)/i;

export function canonicalUrl(raw: string, canonical?: string | null): string {
  try {
    const u = new URL(canonical && /^https?:/i.test(canonical) ? canonical : raw);
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

export type PageInfo = { shareable: boolean; url: string; meta: LinkMetadata | null; selection: string };

export async function readCurrentPage(): Promise<PageInfo> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  if (!tab?.id || !/^https?:/i.test(url)) return { shareable: false, url: "", meta: null, selection: "" };

  let scraped: { title?: string; description?: string; image?: string; canonical?: string; selection?: string } = {};
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const m = (sel: string) => document.querySelector<HTMLMetaElement>(sel)?.content?.trim() || undefined;
        const abs = (v?: string) => {
          try {
            return v ? new URL(v, location.href).toString() : undefined;
          } catch {
            return undefined;
          }
        };
        return {
          title: m('meta[property="og:title"]') || document.title || undefined,
          description: m('meta[property="og:description"]') || m('meta[name="description"]'),
          image: abs(m('meta[property="og:image"]') || m('meta[name="twitter:image"]')),
          canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
          selection: window.getSelection()?.toString().trim().slice(0, 500) || undefined,
        };
      },
    });
    scraped = res?.result ?? {};
  } catch {
    // restricted page (Web Store, PDF viewer…) — fall back to tab info
  }

  const clean = canonicalUrl(url, scraped.canonical);
  return {
    shareable: true,
    url: clean,
    selection: scraped.selection ?? "",
    meta: {
      url: clean,
      title: scraped.title || tab.title || undefined,
      description: scraped.description,
      image: scraped.image,
    },
  };
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
