"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { searchTaggablePoliticians } from "@/lib/services/profile";
import Avatar from "@/components/primitives/Avatar";
import Spinner from "@/components/primitives/Spinner";

type Client = SupabaseClient<Database>;

type MentionCandidate = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  subtitle: string | null;
};

type SearchResultRow = NonNullable<Awaited<ReturnType<typeof searchTaggablePoliticians>>["data"]>[number];

// Twitter-style "@" autocomplete, shared by the Feed/PoliticianWall/
// CandidacyWall composers (three near-identical <Textarea>s otherwise). Owns
// the query-on-"@" / debounce / keyboard-nav / insert-on-select lifecycle;
// the caller just gets `value` back (plain text, "@Full Name" as typed) plus
// `mentionedPoliticianIds` (best-effort: any id whose "@Full Name" text is
// still present in the current value, so deleting the mention text drops it).
export default function MentionTextarea({
  supabase,
  value,
  onChange,
  onMentionsChange,
  placeholder,
  rows = 3,
  autoFocus,
  className = "",
  viewerShapeIds,
  viewerCountry,
}: {
  supabase: Client;
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (ids: string[]) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
  // Ranks suggestions by proximity: the viewer's own constituency first,
  // then same-country, then everyone else (see searchTaggablePoliticians).
  // Omit either to fall back to plain alphabetical order.
  viewerShapeIds?: number[];
  viewerCountry?: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // { start, end } = the "@query" span currently being typed (end is the
  // caret position), null when the caret isn't inside a mention trigger.
  const [mentionSpan, setMentionSpan] = useState<{ start: number; end: number } | null>(null);
  const [suggestions, setSuggestions] = useState<MentionCandidate[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  // name -> id, for every mention ever inserted via selection this session.
  // Re-filtered against the live text below so an edited/deleted mention
  // stops counting without needing to track exact character offsets.
  const [insertedMentions, setInsertedMentions] = useState<Map<string, string>>(new Map());

  const open = mentionSpan !== null;

  // Re-derive which inserted mentions are still textually present whenever
  // the content changes (covers deletion, retyping, etc).
  useEffect(() => {
    const stillPresent = [...insertedMentions.entries()].filter(([name]) => value.includes(`@${name}`));
    const ids = stillPresent.map(([, id]) => id);
    onMentionsChange?.(ids);
    // Only re-run when value changes -- insertedMentions itself is updated
    // by handleSelect below, which doesn't need to re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMentionSpan(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function findMentionTrigger(text: string, caret: number): { start: number; end: number; query: string } | null {
    const uptoCaret = text.slice(0, caret);
    const at = uptoCaret.lastIndexOf("@");
    if (at === -1) return null;
    // Must be start-of-text or preceded by whitespace -- otherwise "email@x" triggers it.
    if (at > 0 && !/\s/.test(uptoCaret[at - 1])) return null;
    const query = uptoCaret.slice(at + 1);
    if (/[\s\n]/.test(query)) return null; // caret moved past the mention word
    if (query.length > 40) return null;
    return { start: at, end: caret, query };
  }

  function runSearch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const myRequestId = ++requestIdRef.current;
      const { data } = await searchTaggablePoliticians(supabase, query, { viewerShapeIds, viewerCountry });
      if (myRequestId !== requestIdRef.current) return; // stale response, a newer keystroke has since fired
      const results: MentionCandidate[] = (data || []).map((row: SearchResultRow) => ({
        id: row.id,
        fullName: row.full_name || "Politician",
        avatarUrl: row.politician_profiles?.avatar_url || row.politician_profiles?.photo_url || null,
        subtitle: row.politician_profiles?.wall_slug ? `@${row.politician_profiles.wall_slug}` : null,
      }));
      setSuggestions(results);
      setActiveIndex(0);
      setLoading(false);
    }, 200);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    onChange(text);
    const caret = e.target.selectionStart ?? text.length;
    const trigger = findMentionTrigger(text, caret);
    if (trigger) {
      setMentionSpan({ start: trigger.start, end: trigger.end });
      runSearch(trigger.query);
    } else {
      setMentionSpan(null);
      setSuggestions([]);
    }
  }

  function handleSelect(candidate: MentionCandidate) {
    if (!mentionSpan) return;
    const before = value.slice(0, mentionSpan.start);
    const after = value.slice(mentionSpan.end);
    const inserted = `@${candidate.fullName} `;
    const nextValue = `${before}${inserted}${after}`;
    onChange(nextValue);
    setInsertedMentions((prev) => {
      const next = new Map(prev);
      next.set(candidate.fullName, candidate.id);
      return next;
    });
    setMentionSpan(null);
    setSuggestions([]);

    // Restore focus + caret right after the inserted mention.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const caret = before.length + inserted.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionSpan(null);
      setSuggestions([]);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={`w-full bg-surface-hover border border-border-light rounded-xl p-3 text-sm text-text-main placeholder:text-text-muted outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none disabled:opacity-50 ${className}`.trim()}
      />

      {open && (loading || suggestions.length > 0) && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-surface elevation-2 rounded-xl border border-border-light/50 shadow-lg">
          {loading && suggestions.length === 0 ? (
            <div className="flex items-center justify-center py-3">
              <Spinner size="sm" />
            </div>
          ) : (
            suggestions.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep textarea focus so caret math stays valid
                onClick={() => handleSelect(s)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
                  idx === activeIndex ? "bg-primary/10" : "hover:bg-surface-hover"
                }`}
              >
                <Avatar src={s.avatarUrl} name={s.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-main truncate">{s.fullName}</p>
                  {s.subtitle && <p className="text-xs text-text-muted truncate">{s.subtitle}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
