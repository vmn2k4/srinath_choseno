import type { ReactNode } from "react";
import { Globe, Link as LinkIcon, Music2 } from "lucide-react";
import type { ParsedBioLink } from "@/lib/utils/bioLinks";

/**
 * Renders the platform links parsed out of a bio's trailing "Website: ... |
 * Facebook: ..." line (see src/lib/utils/bioLinks.ts) as small clickable
 * chips. A link whose value couldn't be safely resolved to a URL (href ===
 * null -- e.g. a LinkedIn display name with no real slug) still shows as
 * plain text rather than being dropped, so the information isn't lost.
 */
// lucide-react dropped its brand icons, so these are inline stroke glyphs
// (same 24x24 outline style as lucide) for the platforms enrichment finds.
function glyph(children: ReactNode) {
  return function Glyph({ size = 15 }: { size?: number }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };
}

const FacebookIcon = glyph(<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />);
const InstagramIcon = glyph(
  <>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </>
);
const XIcon = glyph(
  <>
    <path d="M4 4l11.7 16H20L8.3 4z" />
    <path d="M4 20l6.8-6.8M13.2 10.8L20 4" />
  </>
);
const YoutubeIcon = glyph(
  <>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </>
);
const LinkedinIcon = glyph(
  <>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </>
);

const PLATFORM_ICONS: Record<string, (p: { size?: number }) => ReactNode> = {
  website: (p) => <Globe size={p.size} />,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  x: XIcon,
  twitter: XIcon,
  "x (formerly twitter)": XIcon,
  tiktok: (p) => <Music2 size={p.size} />,
  youtube: YoutubeIcon,
  linkedin: LinkedinIcon,
};

/** Compact row of platform icons, each linking to that account. Links with
 *  no resolvable URL are skipped -- an icon that goes nowhere is worse than
 *  none. Clicks don't bubble, so it's safe inside a clickable row. */
export function BioLinkIcons({ links }: { links: ParsedBioLink[] }) {
  const linkable = links.filter((l) => l.href);
  if (linkable.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      {linkable.map((link, i) => {
        const Icon = PLATFORM_ICONS[link.label.trim().toLowerCase()] ?? ((p: { size?: number }) => <LinkIcon size={p.size} />);
        return (
          <a
            key={`${link.label}-${i}`}
            href={link.href!}
            target="_blank"
            rel="noopener noreferrer"
            title={`${link.label}: ${link.value}`}
            aria-label={`${link.label} (opens in new tab)`}
            onClick={(e) => e.stopPropagation()}
            className="text-text-muted hover:text-accent transition-colors"
          >
            <Icon size={15} />
          </a>
        );
      })}
    </span>
  );
}

export default function BioLinks({ links }: { links: ParsedBioLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
      {links.map((link, i) =>
        link.href ? (
          <a
            key={`${link.label}-${i}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-accent hover:underline"
          >
            <LinkIcon size={11} className="shrink-0" />
            {link.label}: {link.value}
          </a>
        ) : (
          <span key={`${link.label}-${i}`} className="text-xs text-text-muted">
            {link.label}: {link.value}
          </span>
        )
      )}
    </div>
  );
}
