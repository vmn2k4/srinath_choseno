import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Shared Prev/Next + numbered pager, real <a>/<Link> hrefs throughout (no
// client state) so it's crawlable and works with JS disabled. `buildHref`
// turns a target page number into the full URL for that page.
export default function NewsPager({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (page <= 4) {
    pages.push(1, 2, 3, 4, 5, "...", totalPages);
  } else if (page >= totalPages - 3) {
    pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
  }

  return (
    <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
      <div className="flex items-center gap-1.5">
        {page === 1 ? (
          <span className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 opacity-40 border border-border-light/30 rounded-lg">
            <ChevronLeft size={14} /> Previous
          </span>
        ) : (
          <Link
            href={buildHref(page - 1)}
            className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 border border-border-light/40 rounded-lg hover:bg-surface transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </Link>
        )}

        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-text-muted select-none">
              ...
            </span>
          ) : p === page ? (
            <span
              key={`page-${p}`}
              className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold bg-primary text-white shadow-sm inline-flex items-center justify-center"
            >
              {p}
            </span>
          ) : (
            <Link
              key={`page-${p}`}
              href={buildHref(Number(p))}
              className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all bg-surface/50 hover:bg-surface text-text-muted hover:text-text-main border border-border-light/30 inline-flex items-center justify-center"
            >
              {p}
            </Link>
          )
        )}

        {page === totalPages ? (
          <span className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 opacity-40 border border-border-light/30 rounded-lg">
            Next <ChevronRight size={14} />
          </span>
        ) : (
          <Link
            href={buildHref(page + 1)}
            className="px-2.5 py-1.5 text-xs inline-flex items-center gap-1 border border-border-light/40 rounded-lg hover:bg-surface transition-colors"
          >
            Next <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
