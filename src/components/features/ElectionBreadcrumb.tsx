import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Visible breadcrumb trail (the pages also emit it as BreadcrumbList JSON-LD).
export default function ElectionBreadcrumb({ items }: { items: Array<{ name: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={it.name} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} aria-hidden />}
            {it.href ? (
              <Link href={it.href} className="hover:text-text-main hover:underline">
                {it.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-text-secondary">
                {it.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
