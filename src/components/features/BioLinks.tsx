import { Link as LinkIcon } from "lucide-react";
import type { ParsedBioLink } from "@/lib/utils/bioLinks";

/**
 * Renders the platform links parsed out of a bio's trailing "Website: ... |
 * Facebook: ..." line (see src/lib/utils/bioLinks.ts) as small clickable
 * chips. A link whose value couldn't be safely resolved to a URL (href ===
 * null -- e.g. a LinkedIn display name with no real slug) still shows as
 * plain text rather than being dropped, so the information isn't lost.
 */
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
