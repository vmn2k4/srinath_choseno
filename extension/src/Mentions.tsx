import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { AtSign, Check, Globe2, Search, X } from "lucide-react";
import { supabase } from "./supabase";
import {
  getLocalOfficials,
  listTaggablePoliticians,
  searchTaggablePoliticians,
  type MentionOfficial,
} from "@/lib/services/profile";

export function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string | null; size?: number }) {
  const initials = (name || "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return src ? (
    <img className="avatar" src={src} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  );
}

export type MentionTextareaHandle = { insertMention: (o: { id: string; fullName: string }) => void };

type Candidate = { id: string; fullName: string; avatarUrl: string | null; subtitle: string | null };

// "@" autocomplete, same behaviour as the website's MentionTextarea.
export function MentionTextarea({
  value, onChange, onMentionsChange, placeholder, viewerShapeIds, viewerCountry, handleRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onMentionsChange: (ids: string[]) => void;
  placeholder: string;
  viewerShapeIds: number[];
  viewerCountry?: string | null;
  handleRef: Ref<MentionTextareaHandle>;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const reqId = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [span, setSpan] = useState<{ start: number; end: number } | null>(null);
  const [items, setItems] = useState<Candidate[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [inserted, setInserted] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    onMentionsChange([...inserted.entries()].filter(([n]) => value.includes(`@${n}`)).map(([, id]) => id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inserted]);

  function trigger(text: string, caret: number) {
    const upto = text.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at === -1 || (at > 0 && !/\s/.test(upto[at - 1]))) return null;
    const q = upto.slice(at + 1);
    if (/\s/.test(q) || q.length > 40) return null;
    return { start: at, end: caret, q };
  }

  function search(q: string) {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q) { setItems([]); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const id = ++reqId.current;
      const { data } = await searchTaggablePoliticians(supabase, q, { viewerShapeIds, viewerCountry });
      if (id !== reqId.current) return;
      setItems(
        (data || []).map((r) => ({
          id: r.id,
          fullName: r.full_name || "Politician",
          avatarUrl: r.politician_profiles?.avatar_url || r.politician_profiles?.photo_url || null,
          subtitle: r.politician_profiles?.wall_slug ? `@${r.politician_profiles.wall_slug}` : null,
        }))
      );
      setActive(0);
      setLoading(false);
    }, 200);
  }

  function pick(c: Candidate) {
    if (!span) return;
    const before = value.slice(0, span.start);
    const text = `@${c.fullName} `;
    onChange(`${before}${text}${value.slice(span.end)}`);
    setInserted((p) => new Map(p).set(c.fullName, c.id));
    setSpan(null); setItems([]);
    requestAnimationFrame(() => {
      ta.current?.focus();
      const pos = before.length + text.length;
      ta.current?.setSelectionRange(pos, pos);
    });
  }

  useImperativeHandle(handleRef, () => ({
    insertMention: (o) => {
      const caret = ta.current?.selectionStart ?? value.length;
      const before = value.slice(0, caret);
      const text = `${before && !/\s$/.test(before) ? " " : ""}@${o.fullName} `;
      onChange(`${before}${text}${value.slice(caret)}`);
      setInserted((p) => new Map(p).set(o.fullName, o.id));
      requestAnimationFrame(() => {
        ta.current?.focus();
        const pos = before.length + text.length;
        ta.current?.setSelectionRange(pos, pos);
      });
    },
  }));

  function onKey(e: React.KeyboardEvent) {
    if (!span || items.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); setSpan(null); setItems([]); }
  }

  return (
    <div className="mention-wrap">
      <textarea
        ref={ta}
        className="composer-text"
        rows={5}
        autoFocus
        value={value}
        placeholder={placeholder}
        aria-label="Your view"
        onKeyDown={onKey}
        onChange={(e) => {
          onChange(e.target.value);
          const t = trigger(e.target.value, e.target.selectionStart ?? e.target.value.length);
          if (t) { setSpan({ start: t.start, end: t.end }); search(t.q); } else { setSpan(null); setItems([]); }
        }}
      />
      {span && (loading || items.length > 0) && (
        <div className="mention-menu" role="listbox">
          {loading && items.length === 0 ? <div className="center pad"><span className="spinner" /></div> : items.map((s, i) => (
            <button key={s.id} type="button" role="option" aria-selected={i === active}
              className={`row ${i === active ? "is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
              <Avatar src={s.avatarUrl} name={s.fullName} size={28} />
              <span className="row-text"><b>{s.fullName}</b>{s.subtitle && <small>{s.subtitle}</small>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE = 30;

// The "@" toolbar button's full picker: your districts' officials first, then everyone.
export function MentionPicker({
  viewerShapeIds, viewerCountry, onSelect, onClose,
}: {
  viewerShapeIds: number[];
  viewerCountry?: string | null;
  onSelect: (o: MentionOfficial) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [countryOnly, setCountryOnly] = useState(Boolean(viewerCountry));
  const [local, setLocal] = useState<MentionOfficial[]>([]);
  const [items, setItems] = useState<MentionOfficial[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const gen = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { getLocalOfficials(supabase, viewerShapeIds).then(setLocal); /* eslint-disable-next-line */ }, []);

  const load = useCallback(async (offset: number, g: number) => {
    setLoading(true);
    const page = await listTaggablePoliticians(supabase, { query, country: countryOnly ? viewerCountry : null, limit: PAGE, offset });
    if (g !== gen.current) return;
    setItems((p) => (offset === 0 ? page : [...p, ...page]));
    setDone(page.length < PAGE);
    setLoading(false);
  }, [query, countryOnly, viewerCountry]);

  useEffect(() => {
    const g = ++gen.current;
    const t = setTimeout(() => load(0, g), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, countryOnly, load]);

  const searching = query.trim().length > 0;
  const showLocal = !searching && local.length > 0;
  const ids = new Set(local.map((p) => p.id));
  const rest = showLocal ? items.filter((p) => !ids.has(p.id)) : items;
  const row = (p: MentionOfficial) => (
    <button key={p.id} type="button" className="row" onClick={() => onSelect(p)}>
      <Avatar src={p.avatarUrl} name={p.fullName} size={36} />
      <span className="row-text"><b>{p.fullName}</b>{p.office && <small>{p.office}</small>}</span>
    </button>
  );

  return (
    <div className="sheet" role="dialog" aria-label="Tag an official">
      <header className="sheet-head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <h2>Tag an official</h2>
      </header>
      <div className="search">
        <Search size={16} aria-hidden="true" />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search officials by name" aria-label="Search officials" />
        {query && <button type="button" className="icon-btn sm" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}
      </div>
      {viewerCountry && (
        <div className="chip-row">
          <button type="button" aria-pressed={countryOnly} className={`chip ${countryOnly ? "on" : ""}`} onClick={() => setCountryOnly((v) => !v)}>
            {countryOnly ? <Check size={14} /> : <Globe2 size={14} />} {countryOnly ? `${viewerCountry} only` : "All countries"}
          </button>
        </div>
      )}
      <div className="sheet-list" ref={scroller} onScroll={() => {
        const el = scroller.current;
        if (el && !loading && !done && el.scrollHeight - el.scrollTop - el.clientHeight < 200) load(items.length, gen.current);
      }}>
        {showLocal && (<><p className="eyebrow">IN YOUR DISTRICTS</p>{local.map(row)}{(rest.length > 0 || loading) && <p className="eyebrow">MORE OFFICIALS</p>}</>)}
        {rest.map(row)}
        {loading && <div className="center pad"><span className="spinner" /></div>}
        {!loading && rest.length === 0 && !showLocal && <p className="empty">{searching && countryOnly ? `No match in ${viewerCountry}.` : "No officials found."}</p>}
      </div>
    </div>
  );
}

export const AtIcon = AtSign;
