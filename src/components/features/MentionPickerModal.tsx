"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Globe2, Search, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getLocalOfficials, listTaggablePoliticians, type MentionOfficial } from "@/lib/services/profile";
import { Avatar, Spinner } from "@/components/primitives";
import Modal from "@/components/primitives/Modal";

const PAGE_SIZE = 30;

// The composer's "@" button: a search box on top, the officials of the
// viewer's own districts (with the office each holds), then a scrollable,
// paged list of every other official. Typing "@" in the text still gives the
// quick inline suggestions (MentionTextarea).
export default function MentionPickerModal({
  supabase,
  viewerShapeIds,
  viewerCountry,
  onSelect,
  onClose,
}: {
  supabase: SupabaseClient<Database>;
  viewerShapeIds: number[];
  viewerCountry?: string | null;
  onSelect: (official: MentionOfficial) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [countryOnly, setCountryOnly] = useState(Boolean(viewerCountry));
  const [local, setLocal] = useState<MentionOfficial[]>([]);
  const [items, setItems] = useState<MentionOfficial[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Bumped on every new search so a slow earlier page can't land in the
  // results of a newer one.
  const generation = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;
    getLocalOfficials(supabase, viewerShapeIds).then((rows) => {
      if (!ignore) setLocal(rows);
    });
    return () => {
      ignore = true;
    };
    // The districts are fixed for the lifetime of the open picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPage = useCallback(
    async (offset: number, gen: number) => {
      setLoading(true);
      const page = await listTaggablePoliticians(supabase, {
        query,
        country: countryOnly ? viewerCountry : null,
        limit: PAGE_SIZE,
        offset,
      });
      if (gen !== generation.current) return;
      setItems((prev) => (offset === 0 ? page : [...prev, ...page]));
      setDone(page.length < PAGE_SIZE);
      setLoading(false);
    },
    [supabase, query, countryOnly, viewerCountry]
  );

  // New search / filter: start over (debounced while typing).
  useEffect(() => {
    const gen = ++generation.current;
    const t = setTimeout(() => loadPage(0, gen), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, countryOnly, loadPage]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el || loading || done) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) loadPage(items.length, generation.current);
  }

  const searching = query.trim().length > 0;
  const showLocal = !searching && local.length > 0;
  const localIds = new Set(local.map((p) => p.id));
  const rest = showLocal ? items.filter((p) => !localIds.has(p.id)) : items;

  const row = (p: MentionOfficial) => (
    <button
      key={p.id}
      type="button"
      onClick={() => onSelect(p)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover transition-colors cursor-pointer"
    >
      <Avatar src={p.avatarUrl} name={p.fullName} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-main truncate">{p.fullName}</p>
        {p.office && <p className="text-xs text-text-muted truncate">{p.office}</p>}
      </div>
    </button>
  );

  const heading = (text: string) => (
    <p className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-wider text-text-muted">{text}</p>
  );

  return (
    <Modal className="w-full max-w-md" zIndexClassName="z-[60]" onOverlayClick={onClose}>
      <div
        role="dialog"
        aria-label="Tag an official"
        className="flex flex-col h-[80vh] max-h-[640px] bg-surface rounded-2xl border border-border-light/50 shadow-xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h3 className="flex-1 text-base font-bold text-text-main">Tag an official</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-border-light bg-surface-hover px-3 py-2 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <Search size={16} className="text-text-muted shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search officials by name"
              className="flex-1 min-w-0 bg-transparent text-sm text-text-main placeholder:text-text-muted outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-text-muted cursor-pointer">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {viewerCountry && (
          <div className="px-4 pb-2">
            <button
              type="button"
              onClick={() => setCountryOnly((v) => !v)}
              aria-pressed={countryOnly}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                countryOnly
                  ? "bg-primary text-white border-primary"
                  : "bg-surface-hover text-text-main border-border-light"
              }`}
            >
              {countryOnly ? <Check size={14} /> : <Globe2 size={14} />}
              {countryOnly ? `${viewerCountry} only` : "All countries"}
            </button>
          </div>
        )}

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto pb-2">
          {showLocal && (
            <>
              {heading("IN YOUR DISTRICTS")}
              {local.map(row)}
              {(rest.length > 0 || loading) && heading("MORE OFFICIALS")}
            </>
          )}
          {rest.map(row)}
          {loading && (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          )}
          {!loading && rest.length === 0 && !showLocal && (
            <div className="px-6 py-10 text-center text-sm text-text-muted">
              {searching && countryOnly ? `No match in ${viewerCountry}.` : "No officials found."}
              {searching && countryOnly && (
                <div>
                  <button
                    type="button"
                    onClick={() => setCountryOnly(false)}
                    className="mt-2 font-semibold text-primary cursor-pointer"
                  >
                    Search all countries
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
