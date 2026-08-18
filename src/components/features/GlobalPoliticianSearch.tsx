"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchPoliticians } from "@/lib/services/politicians";
import { buildPoliticianWallSlug, buildBoundarySlug } from "@/lib/utils/slugs";
import { Avatar, Badge, Spinner } from "@/components/primitives";

type SearchResult = {
  result_key: string;
  source: string;
  full_name: string;
  role_title: string | null;
  jurisdiction_name: string | null;
  country: string | null;
  boundary_type: string | null;
  map_shape_id: number | null;
  party_name: string | null;
  photo_url: string | null;
  wall_slug: string | null;
  politician_profile_id: string | null;
  office_holder_id: string | null;
  is_key_leader: boolean;
  key_priority: number | null;
};

// Where a result should take the user — a registered profile always gets a
// wall (every profile carries a ghost_id from signup, so a wall link always
// resolves); an office holder with no linked profile falls back to their
// jurisdiction's public directory page instead.
function resultHref(r: SearchResult): string {
  if (r.politician_profile_id) {
    const slug = r.wall_slug || buildPoliticianWallSlug(r.full_name, r.role_title);
    return `/wall/${slug}`;
  }
  if (r.map_shape_id != null) {
    return `/elections/${buildBoundarySlug({ id: r.map_shape_id, name: r.jurisdiction_name ?? undefined })}`;
  }
  return "/elections";
}

// Nav-bar search across every politician & office holder on the platform —
// results prioritize key national/provincial leaders first, then rank by
// proximity to the searcher's own jurisdiction (see searchPoliticians /
// search_politicians_and_officeholders RPC for the actual ranking logic).
//
// Facebook-style: the icon itself morphs into an inline text box (growing
// into the nav row's available space, siblings stay put) with results
// dropping down directly below it — no full-screen takeover, no modal.
export default function GlobalPoliticianSearch({
  triggerClassName = "",
}: {
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const supabaseRef = useRef(createClient());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    setQuery("");
    setResults([]);
  }, [open]);

  // Click-outside and Escape both collapse the box back to just the icon.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const myRequestId = ++requestIdRef.current;
      const { data, error } = await searchPoliticians(supabaseRef.current, trimmed, { limit: 20 });
      if (myRequestId !== requestIdRef.current) return; // stale response, a newer keystroke has since fired
      setResults(error ? [] : ((data as SearchResult[] | null) || []));
      setLoading(false);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={
          triggerClassName ||
          "p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors shrink-0"
        }
        aria-label="Search politicians and office holders"
        title="Search politicians & office holders"
      >
        <Search size={18} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 max-w-md">
      <div className="flex items-center gap-2 w-full bg-surface-hover border border-border-light rounded-full pl-3.5 pr-2 py-1.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search politicians & office holders…"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-text-main placeholder:text-text-muted"
        />
        {loading && <Spinner size="sm" />}
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded-full text-text-muted hover:text-text-main hover:bg-surface-active transition-colors shrink-0"
          aria-label="Close search"
        >
          <X size={16} />
        </button>
      </div>

      {query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-border-light/40 rounded-xl shadow-2xl z-50 animate-fade-in overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {!loading && results.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-text-muted">
                No politicians or office holders found for &ldquo;{query.trim()}&rdquo;.
              </div>
            )}

            {results.map((r) => (
              <Link
                key={r.result_key}
                href={resultHref(r)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-hover transition-colors border-b border-border-light/10 last:border-b-0"
              >
                <Avatar src={r.photo_url} name={r.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs text-text-main truncate">{r.full_name}</span>
                    {r.is_key_leader && (
                      <Badge tone="primary" size="xs" icon={<BadgeCheck size={10} />}>
                        Key Leader
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted truncate">
                    {[r.role_title, r.jurisdiction_name].filter(Boolean).join(" · ") || r.country}
                    {r.party_name ? ` · ${r.party_name}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
