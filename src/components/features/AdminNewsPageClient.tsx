"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import AdminSubNav from "./AdminSubNav";
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Select,
  Spinner,
  PageHeader,
  ConfirmDialog,
} from "@/components/primitives";
import {
  Newspaper, Plus, Trash2, Edit3, Eye, EyeOff, Save,
  X, ImagePlus, FileJson, ChevronDown, ChevronUp, Calendar,
  Globe, AlignLeft, User, RefreshCw, Upload, ClipboardPaste, Zap, Copy, List,
  Users, Flag, MapPin, AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listAllNewsArticlesForAdmin,
  getNewsArticleByIdForAdmin,
  createNewsArticle,
  createNewsArticlesBatch,
  updateNewsArticle,
  deleteNewsArticle,
  uploadNewsHeroImage,
  uploadNewsOgImage,
  getNewsArticleBySlug,
  isBreakingNewsActive,
  BREAKING_NEWS_ACTIVE_HOURS,
  getNewsArticlePoliticianTags,
  syncNewsArticlePoliticianTags,
  syncNewsArticleBoundaries,
  NEWS_CATEGORIES,
  NEWS_STATUSES,
  NEWS_IMPACT_AREAS,
  NEWS_IMPACT_AREA_LABELS,
  NEWS_IMPACT_AREA_DESCRIPTIONS,
  type NewsArticle,
  type NewsArticleContent,
  type NewsArticleInsert,
  type NewsImpactArea,
  type TaggedPolitician,
} from "@/lib/services/news";
import { adminSearchProfiles, adminGetProfileById } from "@/lib/services/profile";
import { getPoliticalParties } from "@/lib/services/politicalParties";
import { normalizeCountryCode, normalizeProvinceCode } from "@/lib/utils/newsGeography";
import { getNewsAiPrompt, type NewsPromptPersonContext } from "@/lib/utils/newsPrompts";
import { validateNewsArticleJson, validateNewsArticleBatchJson } from "@/lib/utils/newsValidation";
import { containsEmoji } from "@/lib/utils/text";
import { renderNewsArticleOgCardToPngBlob } from "@/lib/utils/ogCardBrowser";

// ── Types ─────────────────────────────────────────────────────────────────

interface ArticleFormData {
  slug: string;
  headline: string;
  summary: string;
  category: string;
  country: string;
  province: string;
  status: "draft" | "scheduled" | "published" | "archived";
  published_at: string;  // "posted" date -- when this goes live on Choseno
  eventDate: string;     // when the real-world news event happened
  latitude: string;
  longitude: string;
  impactArea: NewsImpactArea | "";
  hero_image_url: string;
  seoTitle: string;
  metaDescription: string;
  body: string;
  heroImageAlt: string;
  heroImageCaption: string;
  tweet: string;
  tags: string;
  breakingNews: boolean;
  authorName: string;
  authorBio: string;
  authorPhotoUrl: string;
  sources: string; // one per line: "Label | https://url"
  politicalPartyId: string;
}

const EMPTY_FORM: ArticleFormData = {
  slug: "",
  headline: "",
  summary: "",
  category: "General",
  country: "",
  province: "",
  status: "published",
  published_at: new Date().toISOString().slice(0, 16),
  eventDate: "",
  latitude: "",
  longitude: "",
  impactArea: "",
  hero_image_url: "",
  seoTitle: "",
  metaDescription: "",
  body: "",
  heroImageAlt: "",
  heroImageCaption: "",
  tweet: "",
  tags: "",
  breakingNews: false,
  authorName: "",
  authorBio: "",
  authorPhotoUrl: "",
  sources: "",
  politicalPartyId: "",
};

const STATUS_CONFIG: Record<string, { label: string; tone: "primary" | "accent" | "amber" | "emerald" | "rose" | "neutral" }> = {
  draft:     { label: "Draft",     tone: "neutral"  },
  scheduled: { label: "Scheduled", tone: "amber"    },
  published: { label: "Live",      tone: "emerald"  },
  archived:  { label: "Archived",  tone: "neutral"  },
};

// The JSON "enums" (category/status/impact area) are the single source of
// truth in src/lib/services/news.ts -- this alias just keeps the rest of
// this file's existing `CATEGORY_OPTIONS` references working unchanged.
const CATEGORY_OPTIONS: readonly string[] = NEWS_CATEGORIES;

// ── Helpers ───────────────────────────────────────────────────────────────

/** "Label | https://url" per line <-> [{label, url}] -- the admin form's
 * plain-text stand-in for a structured source-citation editor. */
function parseSourcesText(text: string): Array<{ label: string; url: string }> | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return undefined;
  const sources = lines
    .map((line) => {
      const [label, url] = line.split("|").map((s) => s.trim());
      return { label: label || url || "Source", url: url || "" };
    })
    .filter((s) => s.url);
  return sources.length > 0 ? sources : undefined;
}

function formatSourcesText(sources?: Array<{ label: string; url: string }>): string {
  if (!sources || sources.length === 0) return "";
  return sources.map((s) => `${s.label} | ${s.url}`).join("\n");
}

function formToInsert(f: ArticleFormData): NewsArticleInsert {
  const content: NewsArticleContent = {
    seoTitle:        f.seoTitle        || undefined,
    metaDescription: f.metaDescription || undefined,
    body:            f.body            || undefined,
    heroImageAlt:    f.heroImageAlt    || undefined,
    heroImageCaption:f.heroImageCaption|| undefined,
    tweet:           f.tweet           || undefined,
    breakingNews:    f.breakingNews    || undefined,
    tags: f.tags
      ? f.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined,
    author: (f.authorName || f.authorBio || f.authorPhotoUrl)
      ? {
          name:     f.authorName     || undefined,
          bio:      f.authorBio      || undefined,
          photoUrl: f.authorPhotoUrl || undefined,
        }
      : undefined,
    sources: parseSourcesText(f.sources),
  };

  return {
    slug:          f.slug,
    headline:      f.headline,
    summary:       f.summary       || null,
    category:      f.category,
    country:       f.country       || null,
    province:      f.province      || null,
    status:        f.status,
    published_at:  f.published_at  ? new Date(f.published_at).toISOString() : null,
    event_date:    f.eventDate     ? new Date(f.eventDate).toISOString()    : null,
    latitude:      f.latitude      ? Number(f.latitude)  : null,
    longitude:     f.longitude     ? Number(f.longitude) : null,
    impact_area:   f.impactArea    || null,
    hero_image_url:f.hero_image_url|| null,
    political_party_id: f.politicalPartyId ? Number(f.politicalPartyId) : null,
    content,
  };
}

function articleToForm(a: NewsArticle): ArticleFormData {
  const c = a.content as NewsArticleContent;
  return {
    slug:          a.slug,
    headline:      a.headline,
    summary:       a.summary         ?? "",
    category:      a.category,
    country:       a.country         ?? "",
    province:      a.province        ?? "",
    status:        a.status,
    published_at:  a.published_at
      ? new Date(a.published_at).toISOString().slice(0, 16)
      : "",
    eventDate:     a.event_date
      ? new Date(a.event_date).toISOString().slice(0, 16)
      : "",
    latitude:      a.latitude  != null ? String(a.latitude)  : "",
    longitude:     a.longitude != null ? String(a.longitude) : "",
    impactArea:    a.impact_area ?? "",
    hero_image_url:a.hero_image_url  ?? "",
    politicalPartyId: a.political_party_id != null ? String(a.political_party_id) : "",
    seoTitle:      c?.seoTitle       ?? "",
    metaDescription:c?.metaDescription?? "",
    body:          c?.body           ?? "",
    heroImageAlt:  c?.heroImageAlt   ?? "",
    heroImageCaption:c?.heroImageCaption??"",
    tweet:         c?.tweet          ?? "",
    tags:          (c?.tags ?? []).join(", "),
    breakingNews:  c?.breakingNews   ?? false,
    authorName:    c?.author?.name   ?? "",
    authorBio:     c?.author?.bio    ?? "",
    authorPhotoUrl:c?.author?.photoUrl??"",
    sources:       formatSourcesText(c?.sources),
  };
}

function generateSlug(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/**
 * Best-effort push of newly-published article URLs to IndexNow (Bing,
 * Yandex, etc.) via the server-side route -- never blocks or surfaces an
 * error to the publish flow, since a missed ping just means Bing falls back
 * to its normal sitemap crawl instead of an instant recrawl.
 */
function notifyIndexNow(slugs: string[]) {
  const urls = slugs.filter(Boolean).map((slug) => `/news/${slug}`);
  if (urls.length === 0) return;
  fetch("/api/admin/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  }).catch(() => {
    // Swallow -- see comment above.
  });
}

/**
 * Fires the one-time branded share-card generation for newly published
 * articles so hero_image_url is a static, pre-rendered PNG by the time
 * anyone shares the link, instead of depending on a live next/og render at
 * share time (the cause of X/Twitter sometimes showing no image).
 *
 * Renders entirely in the browser (renderNewsArticleOgCardToPngBlob, Satori
 * + canvas -- shares its layout code with the server renderer via
 * ogCard.tsx) and uploads straight to Supabase Storage, so publishing from
 * this admin UI never has to invoke the deployed Vercel Function
 * (api/news/[slug]/og-image) either. Falls back to that route if browser
 * rendering throws for any reason -- unsupported browser, a font/photo
 * fetch hiccup, etc. -- which is itself idempotent (never overwrites an
 * article that already has a hero_image_url), so this is always safe to
 * call on every publish, fire-and-forget, same as notifyIndexNow above.
 */
function generateOgImages(supabase: ReturnType<typeof createClient>, slugs: string[]) {
  slugs.filter(Boolean).forEach(async (slug) => {
    try {
      const { data: articleData } = await getNewsArticleBySlug(supabase, slug);
      if (!articleData || articleData.hero_image_url) return;

      // getNewsArticleBySlug's declared return type is the base NewsArticle
      // row -- its `select("*", ...)` also joins news_article_politicians,
      // which isn't on that interface. Same cast newsOgImage.ts uses for the
      // identical join shape server-side.
      const article = articleData as NewsArticle & {
        news_article_politicians?: Array<{
          profiles?: {
            full_name?: string;
            designation?: string | null;
            constituency?: string | null;
            politician_profiles?: { photo_url?: string | null; avatar_url?: string | null } | null;
          } | null;
        }> | null;
      };

      const primaryPolitician = article.news_article_politicians?.map((p) => p.profiles).filter(Boolean)[0];

      const blob = await renderNewsArticleOgCardToPngBlob({
        headline: article.headline,
        summary: article.summary,
        category: article.category,
        country: article.country,
        province: article.province,
        eventDate: article.event_date,
        publishedAt: article.published_at,
        bodyMarkdown: article.content?.body,
        politicianName: primaryPolitician?.full_name,
        politicianDesignation: primaryPolitician?.designation,
        politicianConstituency: primaryPolitician?.constituency,
        politicianPhotoUrl:
          primaryPolitician?.politician_profiles?.photo_url || primaryPolitician?.politician_profiles?.avatar_url,
      });

      const { publicUrl, error: uploadError } = await uploadNewsOgImage(supabase, blob, slug);
      if (uploadError || !publicUrl) throw uploadError ?? new Error("Upload returned no URL");
      await updateNewsArticle(supabase, article.id, { hero_image_url: publicUrl });
    } catch {
      // Browser rendering/upload failed -- fall back to the deployed route
      // (same fallback shape as scripts/insert-news-batch.js uses for the
      // script-ingestion path). Swallow: best-effort, and the live
      // opengraph-image.tsx route still works as a last-resort fallback if
      // this never succeeds either.
      fetch(`/api/news/${slug}/og-image`, { method: "POST" }).catch(() => {});
    }
  });
}

/** Case/whitespace-tolerant match of a pasted impactArea string against the enum; null if it doesn't match anything. */
function normalizeImpactArea(input: unknown): NewsImpactArea | null {
  if (typeof input !== "string") return null;
  const needle = input.trim().toLowerCase();
  return NEWS_IMPACT_AREAS.find((v) => v === needle) ?? null;
}

function applyJsonToForm(parsed: any, prev: ArticleFormData): ArticleFormData {
  const flat = { ...parsed, ...(parsed.content ?? {}) };
  const country = flat.country ? normalizeCountryCode(flat.country) : prev.country;
  const impactAreaRaw = flat.impactArea ?? flat.impact_area;
  return {
    ...prev,
    slug:           flat.slug           ?? prev.slug,
    headline:       flat.headline       ?? flat.title ?? prev.headline,
    summary:        flat.summary        ?? prev.summary,
    category:       flat.category       ?? prev.category,
    country,
    province:       flat.province ? normalizeProvinceCode(flat.province, country) : prev.province,
    status:         flat.status         ?? prev.status,
    published_at:   flat.published_at
      ? new Date(flat.published_at).toISOString().slice(0, 16)
      : prev.published_at,
    eventDate: (flat.eventDate ?? flat.event_date)
      ? new Date(flat.eventDate ?? flat.event_date).toISOString().slice(0, 16)
      : prev.eventDate,
    latitude:  flat.latitude  != null && flat.latitude  !== "" ? String(flat.latitude)  : prev.latitude,
    longitude: flat.longitude != null && flat.longitude !== "" ? String(flat.longitude) : prev.longitude,
    impactArea: impactAreaRaw != null ? (normalizeImpactArea(impactAreaRaw) ?? prev.impactArea) : prev.impactArea,
    hero_image_url: flat.hero_image_url ?? flat.heroImageUrl ?? prev.hero_image_url,
    seoTitle:       flat.seoTitle       ?? prev.seoTitle,
    metaDescription:flat.metaDescription?? prev.metaDescription,
    body:           flat.body           ?? prev.body,
    heroImageAlt:   flat.heroImageAlt   ?? prev.heroImageAlt,
    heroImageCaption:flat.heroImageCaption?? prev.heroImageCaption,
    tweet:          flat.tweet          ?? prev.tweet,
    tags: Array.isArray(flat.tags)
      ? flat.tags.join(", ")
      : (flat.tags ?? prev.tags),
    breakingNews:   flat.breakingNews   ?? prev.breakingNews,
    authorName:     flat.author?.name   ?? flat.authorName  ?? prev.authorName,
    authorBio:      flat.author?.bio    ?? flat.authorBio   ?? prev.authorBio,
    authorPhotoUrl: flat.author?.photoUrl ?? flat.authorPhotoUrl ?? prev.authorPhotoUrl,
    sources: Array.isArray(flat.sources)
      ? formatSourcesText(flat.sources)
      : (flat.sources ?? prev.sources),
  };
}

// ── Politician/party name resolution (AI JSON import) ──────────────────────
// The AI prompt asks for politician/party names as plain strings (it has no
// visibility into profile ids). These best-effort match those names against
// registered profiles/parties so import can auto-tag when a name is
// unambiguous, and report back what it couldn't match so the admin can add
// it manually via the picker already in the Politician & Party Tagging
// section (or, for a batch import, by editing that article afterward).

async function resolvePoliticianNamesToTags(
  supabase: ReturnType<typeof createClient>,
  names: string[]
): Promise<{ matched: TaggedPolitician[]; unmatched: string[] }> {
  const matched: TaggedPolitician[] = [];
  const unmatched: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const { data } = await adminSearchProfiles(supabase, name);
    const politicians = ((data as { id: string; full_name: string | null; role: string | null }[] | null) || [])
      .filter((p) => p.role === "politician");
    const exact = politicians.filter((p) => (p.full_name || "").trim().toLowerCase() === name.toLowerCase());
    if (exact.length === 1) {
      matched.push({ politician_id: exact[0].id, full_name: exact[0].full_name });
    } else {
      unmatched.push(name);
    }
  }
  return { matched, unmatched };
}

/**
 * Resolves the id-based `taggedPoliticianIds` (see newsPrompts.ts) --
 * unambiguous, unlike name matching, since two different politicians can
 * share a full name. Still validates each id actually belongs to a
 * `role = 'politician'` profile before trusting it (an AI could echo back
 * a malformed or unrelated id), and reports anything that doesn't resolve
 * the same way resolvePoliticianNamesToTags does.
 */
async function resolvePoliticianIdsToTags(
  supabase: ReturnType<typeof createClient>,
  ids: string[]
): Promise<{ matched: TaggedPolitician[]; unmatched: string[] }> {
  const matched: TaggedPolitician[] = [];
  const unmatched: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id) continue;
    const { data } = await adminGetProfileById(supabase, id);
    const row = data as { id: string; full_name: string | null; role: string | null } | null;
    if (row && row.role === "politician") {
      matched.push({ politician_id: row.id, full_name: row.full_name });
    } else {
      unmatched.push(id);
    }
  }
  return { matched, unmatched };
}

async function resolvePartyNameToId(
  supabase: ReturnType<typeof createClient>,
  name: string,
  country: string
): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data } = await getPoliticalParties(supabase, { country: country || undefined });
  const parties = (data as { id: number; name: string }[] | null) || [];
  const match = parties.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  return match ? match.id : null;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function AdminNewsPageClient() {
  const supabase = createClient();

  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ArticleFormData>(EMPTY_FORM);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; headline: string } | null>(null);

  // Politician tagging — chips of {id, full_name} plus the search-as-you-type
  // picker that adds to them (mirrors OfficeHoldersAdminClient's linked-
  // profile picker, extended to multi-select).
  const [taggedPoliticians, setTaggedPoliticians] = useState<TaggedPolitician[]>([]);
  const [politicianQuery, setPoliticianQuery] = useState("");
  const [politicianResults, setPoliticianResults] = useState<{ id: string; full_name: string | null; role: string | null }[]>([]);
  const [searchingPolitician, setSearchingPolitician] = useState(false);

  // Political parties available for the article's current country.
  const [partyOptions, setPartyOptions] = useState<{ id: number; name: string }[]>([]);

  // JSON import state
  const [jsonPasteMode, setJsonPasteMode] = useState(false);
  const [jsonPasteText, setJsonPasteText] = useState("");
  const [jsonPasteError, setJsonPasteError] = useState("");

  // Batch import state — populated when the pasted JSON has a top-level
  // `batch` array instead of a single article.
  const [batchPreview, setBatchPreview] = useState<NewsArticleInsert[] | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  // Politician/party name hints pulled from the pasted batch JSON, keyed by
  // slug -- applied to each article's tags after creation (see
  // handleBatchImport), since news_article_politicians rows need a real
  // article id that doesn't exist until after the insert.
  const [batchTagHints, setBatchTagHints] = useState<Record<string, { politicianNames: string[]; politicianIds: string[]; partyName?: string }>>({});

  // AI Prompt state
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptTab, setPromptTab] = useState<"single" | "batch">("single");
  // Pinned when arriving via a politician/office holder's "Generate News
  // Article" button (?personId=&personName= on the URL) -- baked into the
  // single-article prompt (newsPrompts.ts) so the AI tags this exact
  // profile id instead of a name the fuzzy matcher has to guess at.
  const [promptPerson, setPromptPerson] = useState<NewsPromptPersonContext | null>(null);

  const [sectionsOpen, setSectionsOpen] = useState({
    core: true,
    tagging: true,
    seo: false,
    content: true,
    author: false,
    media: false,
  });

  const jsonFileRef = useRef<HTMLInputElement>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listAllNewsArticlesForAdmin(supabase);
    if (!error) setArticles(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    Promise.resolve().then(() => loadArticles());
  }, [loadArticles]);

  // Arriving from a politician/office holder's "Generate News Article"
  // button (OfficeHoldersAdminClient) lands here as
  // /admin/news?personId=<uuid>&personName=<name> (personId omitted for an
  // unclaimed officeholder with no linked profile yet). Read via
  // window.location instead of next/navigation's useSearchParams so this
  // client component doesn't need a <Suspense> boundary just for a one-time
  // read on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const personId = params.get("personId") || undefined;
    const personName = params.get("personName");
    if (!personName) return;

    const person: NewsPromptPersonContext = { id: personId, name: personName };
    // openNewForm() resets promptPerson/taggedPoliticians to null/[] as part
    // of its normal "blank slate" behavior -- call it first so these two
    // setters (same batch, later call wins) are what the form actually ends
    // up with, not the reset.
    openNewForm();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL (an external system) into React state on mount, not derivable during render
    setPromptPerson(person);
    if (personId) {
      setTaggedPoliticians([{ politician_id: personId, full_name: personName }]);
    }
    setPromptTab("single");
    setShowAiPrompt(true);
    setStatusMsg({
      type: "success",
      msg: `Generating for ${personName}${personId ? "" : " (no linked profile yet — tag manually after saving)"}. Copy the prompt, paste your source material into your AI tool, then paste the JSON result back here.`,
    });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const runPoliticianSearch = useCallback(async () => {
    if (politicianQuery.trim().length < 2) {
      setPoliticianResults([]);
      return;
    }
    setSearchingPolitician(true);
    const { data } = await adminSearchProfiles(supabase, politicianQuery.trim());
    const rows = (data as { id: string; full_name: string | null; role: string | null }[] | null) || [];
    setPoliticianResults(rows.filter((p) => p.role === "politician"));
    setSearchingPolitician(false);
  }, [supabase, politicianQuery]);

  useEffect(() => {
    const id = setTimeout(runPoliticianSearch, 300);
    return () => clearTimeout(id);
  }, [runPoliticianSearch]);

  useEffect(() => {
    getPoliticalParties(supabase, { country: form.country || undefined }).then(({ data }) => {
      setPartyOptions((data as { id: number; name: string }[] | null) || []);
    });
  }, [supabase, form.country]);

  function addTaggedPolitician(p: { id: string; full_name: string | null }) {
    setTaggedPoliticians((prev) =>
      prev.some((tp) => tp.politician_id === p.id) ? prev : [...prev, { politician_id: p.id, full_name: p.full_name }]
    );
    setPoliticianQuery("");
    setPoliticianResults([]);
  }

  function removeTaggedPolitician(politicianId: string) {
    setTaggedPoliticians((prev) => prev.filter((tp) => tp.politician_id !== politicianId));
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  function setField<K extends keyof ArticleFormData>(key: K, value: ArticleFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openNewForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setHeroFile(null);
    setHeroPreview(null);
    setFormOpen(true);
    setStatusMsg(null);
    setJsonPasteMode(false);
    setJsonPasteText("");
    setJsonPasteError("");
    setBatchPreview(null);
    setBatchTagHints({});
    setTaggedPoliticians([]);
    setPoliticianQuery("");
    setPoliticianResults([]);
    setPromptPerson(null);
  }

  async function openEditForm(id: string) {
    const { data, error } = await getNewsArticleByIdForAdmin(supabase, id);
    if (error || !data) { setStatusMsg({ type: "error", msg: "Failed to load article" }); return; }
    setForm(articleToForm(data as unknown as NewsArticle));
    setEditingId(id);
    setHeroFile(null);
    setHeroPreview(null);
    setFormOpen(true);
    setStatusMsg(null);
    setJsonPasteMode(false);
    setJsonPasteText("");
    setJsonPasteError("");
    setBatchPreview(null);
    setBatchTagHints({});
    setPoliticianQuery("");
    setPoliticianResults([]);
    setPromptPerson(null);
    const { data: tags } = await getNewsArticlePoliticianTags(supabase, id);
    setTaggedPoliticians(tags || []);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  // ── JSON import ───────────────────────────────────────────────────────────
  // A pasted object with a top-level `batch` array (the multi-story AI
  // prompt's output shape) populates batchPreview instead of the single
  // form — each item goes through the same applyJsonToForm/formToInsert
  // mapping as a single paste, just run once per array entry.

  async function parseAndApplyJson(
    jsonString: string
  ): Promise<{ ok: boolean; batchCount?: number; unmatchedPoliticians?: string[]; warnings?: string[] }> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      setJsonPasteError("Invalid JSON — check your syntax and try again.");
      return { ok: false };
    }

    // Schema/enum debugging pass -- catches a syntactically-valid object
    // with e.g. an out-of-enum category/impactArea or a lat without a lng
    // before it ever reaches formToInsert, instead of silently saving
    // wrong/null. See src/lib/utils/newsValidation.ts.
    const isBatch = parsed && Array.isArray(parsed.batch);
    const { errors, warnings } = isBatch
      ? validateNewsArticleBatchJson(parsed.batch)
      : validateNewsArticleJson(parsed);
    if (errors.length > 0) {
      setJsonPasteError(errors.join("\n"));
      return { ok: false };
    }

    if (isBatch) {
      const hints: Record<string, { politicianNames: string[]; politicianIds: string[]; partyName?: string }> = {};
      const drafts = parsed.batch.map((item: any) => {
        const draft = formToInsert(applyJsonToForm(item, EMPTY_FORM));
        const politicianNames = Array.isArray(item?.taggedPoliticians) ? item.taggedPoliticians : [];
        const politicianIds = Array.isArray(item?.taggedPoliticianIds) ? item.taggedPoliticianIds : [];
        const partyName = typeof item?.taggedParty === "string" ? item.taggedParty : undefined;
        if (draft.slug && (politicianNames.length > 0 || politicianIds.length > 0 || partyName)) {
          hints[draft.slug] = { politicianNames, politicianIds, partyName };
        }
        return draft;
      });
      setBatchPreview(drafts);
      setBatchTagHints(hints);
      setJsonPasteError("");
      return { ok: true, batchCount: drafts.length, warnings };
    }

    setBatchPreview(null);
    setBatchTagHints({});
    const nextForm = applyJsonToForm(parsed, form);
    setForm(nextForm);

    // taggedPoliticianIds (unambiguous) resolve first; taggedPoliticians
    // (name, may be ambiguous) fills in anything the ids didn't cover.
    // Both can be present -- results merge by politician_id.
    let unmatchedPoliticians: string[] = [];
    const politicianIds: string[] = Array.isArray(parsed.taggedPoliticianIds) ? parsed.taggedPoliticianIds : [];
    const politicianNames: string[] = Array.isArray(parsed.taggedPoliticians) ? parsed.taggedPoliticians : [];
    if (politicianIds.length > 0 || politicianNames.length > 0) {
      const [byId, byName] = await Promise.all([
        politicianIds.length > 0 ? resolvePoliticianIdsToTags(supabase, politicianIds) : Promise.resolve({ matched: [], unmatched: [] }),
        politicianNames.length > 0 ? resolvePoliticianNamesToTags(supabase, politicianNames) : Promise.resolve({ matched: [], unmatched: [] }),
      ]);
      unmatchedPoliticians = [...byId.unmatched, ...byName.unmatched];
      const matched = [...byId.matched, ...byName.matched];
      if (matched.length > 0) {
        setTaggedPoliticians((prev) => {
          const byIdMap = new Map(prev.map((tp) => [tp.politician_id, tp]));
          matched.forEach((m) => byIdMap.set(m.politician_id, m));
          return Array.from(byIdMap.values());
        });
      }
    }
    if (typeof parsed.taggedParty === "string" && parsed.taggedParty.trim()) {
      const partyId = await resolvePartyNameToId(supabase, parsed.taggedParty, nextForm.country);
      if (partyId != null) setField("politicalPartyId", String(partyId));
    }

    setJsonPasteError("");
    return { ok: true, unmatchedPoliticians, warnings };
  }

  function unmatchedNote(names?: string[]): string {
    return names && names.length > 0
      ? ` Couldn't auto-match politician(s): ${names.join(", ")} — add them manually below.`
      : "";
  }

  function warningsNote(warnings?: string[]): string {
    return warnings && warnings.length > 0 ? ` ⚠ ${warnings.join(" ")}` : "";
  }

  function handleJsonFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const result = await parseAndApplyJson(ev.target?.result as string);
      if (result.ok) {
        setStatusMsg({
          type: "success",
          msg: result.batchCount
            ? `Loaded ${result.batchCount} articles — review below and click "Import All".${warningsNote(result.warnings)}`
            : `JSON imported — review fields and save.${unmatchedNote(result.unmatchedPoliticians)}${warningsNote(result.warnings)}`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleJsonPasteApply() {
    if (!jsonPasteText.trim()) { setJsonPasteError("Paste some JSON first."); return; }
    const result = await parseAndApplyJson(jsonPasteText);
    if (result.ok) {
      setStatusMsg({
        type: "success",
        msg: result.batchCount
          ? `Loaded ${result.batchCount} articles — review below and click "Import All".${warningsNote(result.warnings)}`
          : `JSON applied — review fields and save.${unmatchedNote(result.unmatchedPoliticians)}${warningsNote(result.warnings)}`,
      });
      setJsonPasteMode(false);
      setJsonPasteText("");
    }
  }

  async function handleBatchImport() {
    if (!batchPreview || batchPreview.length === 0) return;
    setBatchImporting(true);
    setStatusMsg(null);
    const { created, failed } = await createNewsArticlesBatch(supabase, batchPreview);

    // Best-effort auto-tag each created article from its JSON hints -- needs
    // a real article id, so this can only run after the insert above.
    const unmatchedByArticle: string[] = [];
    for (const article of created) {
      const hint = batchTagHints[article.slug];
      if (!hint) continue;

      let politicianIds: string[] = [];
      if (hint.politicianIds.length > 0 || hint.politicianNames.length > 0) {
        const [byId, byName] = await Promise.all([
          hint.politicianIds.length > 0 ? resolvePoliticianIdsToTags(supabase, hint.politicianIds) : Promise.resolve({ matched: [], unmatched: [] }),
          hint.politicianNames.length > 0 ? resolvePoliticianNamesToTags(supabase, hint.politicianNames) : Promise.resolve({ matched: [], unmatched: [] }),
        ]);
        const matchedIds = new Set<string>();
        [...byId.matched, ...byName.matched].forEach((m) => matchedIds.add(m.politician_id));
        politicianIds = Array.from(matchedIds);
        const unmatched = [...byId.unmatched, ...byName.unmatched];
        if (unmatched.length > 0) unmatchedByArticle.push(`"${article.headline}": ${unmatched.join(", ")}`);
      }
      if (politicianIds.length > 0) await syncNewsArticlePoliticianTags(supabase, article.id, politicianIds);

      if (hint.partyName) {
        const partyId = await resolvePartyNameToId(supabase, hint.partyName, article.country || "");
        if (partyId != null) await updateNewsArticle(supabase, article.id, { political_party_id: partyId });
      }

      // Boundary auto-tagging from lat/lng -- see admin_sync_news_article_
      // boundaries() in 20260813000000_news_event_geo_impact_area.sql.
      if (article.latitude != null && article.longitude != null) {
        await syncNewsArticleBoundaries(supabase, article.id);
      }
    }

    notifyIndexNow(created.filter((a) => a.status === "published").map((a) => a.slug));
    generateOgImages(supabase, created.filter((a) => a.status === "published").map((a) => a.slug));

    setBatchImporting(false);
    const tagNote = unmatchedByArticle.length
      ? ` Couldn't auto-match politician(s) on: ${unmatchedByArticle.join("; ")} — edit those articles to tag manually.`
      : "";

    if (failed.length === 0) {
      setStatusMsg({ type: "success", msg: `Imported ${created.length} article${created.length === 1 ? "" : "s"}.${tagNote}` });
      setBatchPreview(null);
      setBatchTagHints({});
      await loadArticles();
      closeForm();
    } else {
      setStatusMsg({
        type: created.length > 0 ? "success" : "error",
        msg: `Imported ${created.length}, ${failed.length} failed — ${failed.map((f) => `"${f.headline}": ${f.error}`).join("; ")}${tagNote}`,
      });
      setBatchPreview(null);
      setBatchTagHints({});
      if (created.length > 0) await loadArticles();
    }
  }

  // ── Hero image ────────────────────────────────────────────────────────────

  function handleHeroFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroFile(file);
    setHeroPreview(URL.createObjectURL(file));
  }

  async function uploadHeroNow() {
    if (!heroFile || !form.slug) {
      setStatusMsg({ type: "error", msg: "Need a slug and an image file first." });
      return;
    }
    setUploadingHero(true);
    const { publicUrl, error } = await uploadNewsHeroImage(supabase, heroFile, form.slug);
    setUploadingHero(false);
    if (error || !publicUrl) { setStatusMsg({ type: "error", msg: "Hero image upload failed." }); return; }
    setField("hero_image_url", publicUrl);
    setStatusMsg({ type: "success", msg: "Hero image uploaded." });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.slug || !form.headline) {
      setStatusMsg({ type: "error", msg: "Slug and Headline are required." });
      return;
    }
    setSaving(true);
    setStatusMsg(null);

    if (heroFile && form.slug && !form.hero_image_url) await uploadHeroNow();

    const payload = formToInsert(form);
    let err;
    let savedId = editingId;
    if (editingId) {
      const res = await updateNewsArticle(supabase, editingId, payload);
      err = res.error;
    } else {
      const res = await createNewsArticle(supabase, payload);
      err = res.error;
      savedId = res.data?.id ?? null;
    }

    if (!err && savedId) {
      const tagRes = await syncNewsArticlePoliticianTags(
        supabase,
        savedId,
        taggedPoliticians.map((tp) => tp.politician_id)
      );
      err = tagRes.error ?? undefined;
    }

    if (!err && savedId) {
      // Re-derives news_article_boundaries from the article's current
      // latitude/longitude every save -- cheap, and correctly clears stale
      // boundary tags if an admin removes the coordinates later, not just
      // adds them the first time.
      const boundaryRes = await syncNewsArticleBoundaries(supabase, savedId);
      if (boundaryRes.error) err = boundaryRes.error;
    }

    setSaving(false);
    if (err) {
      setStatusMsg({ type: "error", msg: err.message });
    } else {
      if (payload.status === "published") {
        notifyIndexNow([payload.slug]);
        generateOgImages(supabase, [payload.slug]);
      }
      setStatusMsg({ type: "success", msg: editingId ? "Article updated!" : "Article created!" });
      await loadArticles();
      closeForm();
    }
  }

  // ── Publish/Unpublish ─────────────────────────────────────────────────────

  async function handleQuickPublish(id: string) {
    const article = articles.find((a) => a.id === id);
    if (!article) return;
    const now = new Date().toISOString();
    const { error } = await updateNewsArticle(supabase, id, {
      status: "published",
      published_at: article.published_at || now,
    });
    if (error) {
      setStatusMsg({ type: "error", msg: error.message });
    } else {
      await syncNewsArticlePoliticianTags(supabase, id);
      notifyIndexNow([article.slug]);
      generateOgImages(supabase, [article.slug]);
      setStatusMsg({ type: "success", msg: `"${article.headline}" published!` });
      await loadArticles();
    }
  }

  async function handleQuickUnpublish(id: string) {
    const article = articles.find((a) => a.id === id);
    if (!article) return;
    const { error } = await updateNewsArticle(supabase, id, {
      status: "draft",
    });
    if (error) {
      setStatusMsg({ type: "error", msg: error.message });
    } else {
      await syncNewsArticlePoliticianTags(supabase, id);
      setStatusMsg({ type: "success", msg: `"${article.headline}" unpublished.` });
      await loadArticles();
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const { error } = await deleteNewsArticle(supabase, id);
    if (error) {
      setStatusMsg({ type: "error", msg: error.message });
    } else {
      setStatusMsg({ type: "success", msg: "Article deleted." });
      await loadArticles();
    }
    setDeleteTarget(null);
  }

  function toggleSection(key: keyof typeof sectionsOpen) {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(getNewsAiPrompt(promptTab, promptPerson ?? undefined));
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-none pb-20 px-4 lg:px-8 space-y-6">
      <PageHeader icon={Newspaper} title="News Management" />
      <AdminSubNav active="news" className="mb-2" />

      {/* Status bar */}
      {statusMsg && !formOpen && (
        <StatusBar msg={statusMsg} onDismiss={() => setStatusMsg(null)} />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-text-muted">
          {articles.length} article{articles.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={loadArticles} disabled={loading} className="flex items-center gap-1.5 cursor-pointer">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={openNewForm} className="flex items-center gap-1.5 cursor-pointer">
            <Plus size={14} /> <span>New Article</span>
          </Button>
        </div>
      </div>

      {/* Article list */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : articles.length === 0 ? (
        <Card padding="md" className="text-center py-12">
          <p className="text-text-muted text-sm">No articles yet. Create your first one!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => {
            const s = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.draft;
            return (
              <Card key={a.id} padding="sm" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <Badge tone="primary">{a.category}</Badge>
                    {isBreakingNewsActive(a) && <Badge tone="rose">🔴 Breaking</Badge>}
                    {a.country && (
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Globe size={11} /> {a.country}{a.province ? `-${a.province}` : ""}
                      </span>
                    )}
                    {a.impact_area && (
                      <Badge tone="accent">
                        {a.impact_area === "local" && a.latitude != null ? <MapPin size={10} className="inline -mt-0.5 mr-0.5" /> : null}
                        {NEWS_IMPACT_AREA_LABELS[a.impact_area as NewsImpactArea] ?? a.impact_area}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-text-main truncate">{a.headline}</p>
                  <p className="text-xs text-text-muted font-mono">{a.slug}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {a.published_at && (
                      <p className="text-xs text-text-muted flex items-center gap-1">
                        <Calendar size={11} /> Posted {new Date(a.published_at).toLocaleDateString("en-CA", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </p>
                    )}
                    {a.event_date && (
                      <p className="text-xs text-text-muted flex items-center gap-1">
                        <Calendar size={11} /> Happened {new Date(a.event_date).toLocaleDateString("en-CA", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Clear, labeled action buttons */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {a.status !== "published" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-1 cursor-pointer font-medium text-xs px-2.5 py-1"
                      onClick={() => handleQuickPublish(a.id)}
                      title="Publish this article immediately"
                    >
                      <Zap size={13} />
                      <span>Publish</span>
                    </Button>
                  )}
                  {a.status === "published" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-500 hover:bg-amber-500/10 flex items-center gap-1 cursor-pointer font-medium text-xs px-2.5 py-1"
                      onClick={() => handleQuickUnpublish(a.id)}
                      title="Unpublish this article and revert to draft"
                    >
                      <EyeOff size={13} />
                      <span>Unpublish</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    as="a"
                    href={`/news/${a.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-muted hover:text-text-main hover:bg-surface-hover flex items-center gap-1 cursor-pointer font-medium text-xs px-2.5 py-1"
                    title="View live article"
                  >
                    <Eye size={13} />
                    <span>View</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditForm(a.id)}
                    className="text-text-muted hover:text-primary hover:bg-primary/10 flex items-center gap-1 cursor-pointer font-medium text-xs px-2.5 py-1"
                    title="Edit article"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-500 hover:bg-rose-500/10 flex items-center gap-1 cursor-pointer font-medium text-xs px-2.5 py-1"
                    onClick={() => setDeleteTarget({ id: a.id, headline: a.headline })}
                    title="Delete article permanently"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Form Modal ─────────────────────────────────────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center py-8 px-4"
          style={{ backgroundColor: "var(--color-overlay-heavy)" }}>
          <div className="w-full max-w-3xl space-y-3">

            {/* Header bar */}
            <div
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-border-light/30"
              style={{ backgroundColor: "var(--color-surface)" }}
            >
              <h2 className="text-base font-bold text-text-main">
                {editingId ? "Edit Article" : "New Article"}
              </h2>
              <div className="flex items-center gap-2">
                <input ref={jsonFileRef} type="file" accept=".json" className="hidden" onChange={handleJsonFileUpload} />
                <Button size="sm" variant="ghost" onClick={() => setShowAiPrompt(true)} title="View AI prompt for generating news">
                  <Zap size={13} /> AI Prompt
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setJsonPasteMode((v) => !v); setJsonPasteError(""); }}>
                  <ClipboardPaste size={13} /> Paste JSON
                </Button>
                <Button size="sm" variant="ghost" onClick={() => jsonFileRef.current?.click()}>
                  <FileJson size={13} /> File
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : <Save size={13} />}
                  {saving ? "Saving…" : "Save"}
                </Button>
                <button
                  onClick={closeForm}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Status in form */}
            {statusMsg && <StatusBar msg={statusMsg} onDismiss={() => setStatusMsg(null)} />}

            {/* JSON Paste Panel */}
            {jsonPasteMode && (
              <FormSection title="Paste JSON" icon={<ClipboardPaste size={13} />}>
                <p className="text-xs text-text-muted mb-2">
                  Paste a single article object, or a batch of them as <code className="text-primary text-xs bg-surface px-1 rounded">{'{ "batch": [...] }'}</code>. Keys like <code className="text-primary text-xs bg-surface px-1 rounded">headline</code>, <code className="text-primary text-xs bg-surface px-1 rounded">body</code>, <code className="text-primary text-xs bg-surface px-1 rounded">tags</code>, etc. are mapped automatically; <code className="text-primary text-xs bg-surface px-1 rounded">country</code>/<code className="text-primary text-xs bg-surface px-1 rounded">province</code> are normalized to ISO codes.
                </p>
                <Textarea
                  value={jsonPasteText}
                  onChange={(e) => { setJsonPasteText(e.target.value); setJsonPasteError(""); }}
                  placeholder={'{\n  "headline": "My article",\n  "body": "## Intro\\n\\nContent here…",\n  "status": "published",\n  "published_at": "2026-08-04T00:00:00Z"\n}\n\n— or —\n\n{ "batch": [ { "headline": "…", … }, { "headline": "…", … } ] }'}
                  rows={10}
                  className="font-mono text-xs"
                />
                {jsonPasteError && (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-danger">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      {jsonPasteError.split("\n").map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={handleJsonPasteApply}>Apply JSON</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setJsonPasteMode(false); setJsonPasteText(""); setJsonPasteError(""); }}>
                    Cancel
                  </Button>
                </div>
              </FormSection>
            )}

            {/* Batch Import Preview */}
            {batchPreview && batchPreview.length > 0 && (
              <FormSection title={`Batch Preview (${batchPreview.length} articles)`} icon={<List size={13} />}>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {batchPreview.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border-light/20"
                      style={{ backgroundColor: "var(--color-surface-hover)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-main truncate">{a.headline || "(no headline)"}</p>
                        <p className="text-xs text-text-muted font-mono truncate">{a.slug || "(no slug)"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {a.country && <Badge tone="neutral">{a.country}{a.province ? `-${a.province}` : ""}</Badge>}
                        {a.impact_area && <Badge tone="accent">{NEWS_IMPACT_AREA_LABELS[a.impact_area]}</Badge>}
                        {a.content?.breakingNews && <Badge tone="rose">🔴 Breaking</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={handleBatchImport} disabled={batchImporting}>
                    {batchImporting ? <Spinner size="sm" /> : <Upload size={13} />}
                    {batchImporting ? "Importing…" : `Import All (${batchPreview.length})`}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setBatchPreview(null)} disabled={batchImporting}>
                    Discard
                  </Button>
                </div>
              </FormSection>
            )}

            {/* ── Core Fields ── */}
            <CollapsibleFormSection
              title="Core Fields"
              icon={<AlignLeft size={13} />}
              open={sectionsOpen.core}
              onToggle={() => toggleSection("core")}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Headline *">
                  <Input
                    value={form.headline}
                    onChange={(e) => {
                      setField("headline", e.target.value);
                      if (!editingId && !form.slug) setField("slug", generateSlug(e.target.value));
                    }}
                    placeholder="Article headline"
                  />
                </FieldGroup>

                <FieldGroup label="Slug (URL key) *">
                  <div className="flex gap-2">
                    <Input
                      value={form.slug}
                      onChange={(e) => setField("slug", e.target.value)}
                      placeholder="url-friendly-slug"
                      className="font-mono text-xs"
                    />
                    <Button size="sm" variant="ghost" onClick={() => setField("slug", generateSlug(form.headline))} title="Regenerate">
                      <RefreshCw size={12} />
                    </Button>
                  </div>
                </FieldGroup>

                <FieldGroup label="Category">
                  <Select value={form.category} onChange={(e) => setField("category", e.target.value)}>
                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </FieldGroup>

                <FieldGroup label="Status">
                  <Select value={form.status} onChange={(e) => setField("status", e.target.value as any)}>
                    {NEWS_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
                    ))}
                  </Select>
                </FieldGroup>

                <FieldGroup label="Posted Date / Time (when this goes live on Choseno)">
                  <Input
                    type="datetime-local"
                    value={form.published_at}
                    onChange={(e) => setField("published_at", e.target.value)}
                  />
                </FieldGroup>

                <FieldGroup label="Event Date (when the news itself happened, optional)">
                  <Input
                    type="datetime-local"
                    value={form.eventDate}
                    onChange={(e) => setField("eventDate", e.target.value)}
                  />
                  <p className="text-[11px] text-text-muted">
                    Distinct from Posted Date — set this when backfilling an older story so it isn&apos;t dated as if it just happened.
                  </p>
                </FieldGroup>

                <FieldGroup label="Country">
                  <Input
                    value={form.country}
                    onChange={(e) => setField("country", e.target.value)}
                    onBlur={(e) => setField("country", normalizeCountryCode(e.target.value))}
                    placeholder="Canada, CA, United States… — blank = global"
                  />
                </FieldGroup>

                <FieldGroup label="Province / State">
                  <Input
                    value={form.province}
                    onChange={(e) => setField("province", e.target.value)}
                    onBlur={(e) => setField("province", normalizeProvinceCode(e.target.value, form.country))}
                    placeholder="Ontario, ON, California… — blank = country-wide"
                  />
                </FieldGroup>

                <FieldGroup label="Impact Area">
                  <Select value={form.impactArea} onChange={(e) => setField("impactArea", e.target.value as NewsImpactArea | "")}>
                    <option value="">Not set</option>
                    {NEWS_IMPACT_AREAS.map((v) => (
                      <option key={v} value={v}>{NEWS_IMPACT_AREA_LABELS[v]}</option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-text-muted">
                    {form.impactArea ? NEWS_IMPACT_AREA_DESCRIPTIONS[form.impactArea] : "How far this story's relevance reaches — controls who sees it as \"their\" news."}
                  </p>
                </FieldGroup>

                <FieldGroup label="Event Latitude / Longitude" className="sm:col-span-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number" step="any" placeholder="Latitude, e.g. 49.1913"
                      value={form.latitude}
                      onChange={(e) => setField("latitude", e.target.value)}
                    />
                    <Input
                      type="number" step="any" placeholder="Longitude, e.g. -122.8490"
                      value={form.longitude}
                      onChange={(e) => setField("longitude", e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted flex items-start gap-1">
                    <MapPin size={12} className="mt-0.5 shrink-0" />
                    Where this news event happened. On save, the system automatically finds and tags the electoral boundaries containing this point (city, riding, etc.) — required for a &quot;Local&quot; impact area to actually surface as local news.
                  </p>
                </FieldGroup>

                <FieldGroup label="Summary (card excerpt)" className="sm:col-span-2">
                  <Textarea
                    value={form.summary}
                    onChange={(e) => setField("summary", e.target.value)}
                    placeholder="Short summary shown on the news listing card"
                    rows={2}
                  />
                </FieldGroup>

                <div className="sm:col-span-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="breakingNews"
                    checked={form.breakingNews}
                    onChange={(e) => setField("breakingNews", e.target.checked)}
                    className="w-4 h-4"
                    style={{ accentColor: "var(--color-primary)" }}
                  />
                  <label htmlFor="breakingNews" className="text-sm text-text-main cursor-pointer select-none">
                    🔴 Breaking News <span className="text-text-muted font-normal">(auto-clears {BREAKING_NEWS_ACTIVE_HOURS}h after publish)</span>
                  </label>
                </div>
              </div>
            </CollapsibleFormSection>

            {/* ── Politician & Party Tagging ── */}
            <CollapsibleFormSection
              title="Politician & Party Tagging"
              icon={<Users size={13} />}
              open={sectionsOpen.tagging}
              onToggle={() => toggleSection("tagging")}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Linked Political Party (optional)">
                  <Select
                    value={form.politicalPartyId}
                    onChange={(e) => setField("politicalPartyId", e.target.value)}
                  >
                    <option value="">None</option>
                    {partyOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </FieldGroup>

                <FieldGroup label="Tagged Politicians (optional)">
                  <p className="text-[11px] text-text-muted -mt-1 mb-1">
                    Tagging a politician posts this article to their wall as a normal post.
                  </p>
                  {taggedPoliticians.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {taggedPoliticians.map((tp) => (
                        <div
                          key={tp.politician_id}
                          className="flex items-center gap-1.5 text-xs bg-accent/10 text-accent font-semibold px-2.5 py-1 rounded-xl"
                        >
                          <Flag size={12} />
                          {tp.full_name || "Unnamed politician"}
                          <button
                            type="button"
                            onClick={() => removeTaggedPolitician(tp.politician_id)}
                            className="hover:text-danger cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Input
                      placeholder="Search politicians by name..."
                      value={politicianQuery}
                      onChange={(e) => setPoliticianQuery(e.target.value)}
                    />
                    {searchingPolitician && (
                      <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                    {politicianResults.length > 0 && (
                      <div className="mt-1.5 border border-border-light/40 rounded-xl divide-y divide-border-light/30 overflow-hidden">
                        {politicianResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addTaggedPolitician(p)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors cursor-pointer"
                          >
                            {p.full_name || "Unnamed politician"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </FieldGroup>
              </div>
            </CollapsibleFormSection>

            {/* ── SEO ── */}
            <CollapsibleFormSection
              title="SEO & Social Metadata"
              icon={<Globe size={13} />}
              open={sectionsOpen.seo}
              onToggle={() => toggleSection("seo")}
            >
              <div className="space-y-4">
                <FieldGroup label="SEO Title (overrides headline in <title> tag)">
                  <Input
                    value={form.seoTitle}
                    onChange={(e) => setField("seoTitle", e.target.value)}
                    placeholder="Leave blank to use headline"
                  />
                </FieldGroup>
                <FieldGroup label={`Meta Description (${form.metaDescription.length}/160 chars)`}>
                  <Textarea
                    value={form.metaDescription}
                    onChange={(e) => setField("metaDescription", e.target.value)}
                    placeholder="Shown in Google search results and social link previews"
                    rows={2}
                    maxLength={160}
                  />
                </FieldGroup>
                <FieldGroup label="Tags (comma-separated)">
                  <Input
                    value={form.tags}
                    onChange={(e) => setField("tags", e.target.value)}
                    placeholder="elections, privacy, technology"
                  />
                </FieldGroup>
                <FieldGroup label={`Tweet / X Post Text (${form.tweet.length} chars — optional, falls back to auto-generated share text)`}>
                  <Textarea
                    value={form.tweet}
                    onChange={(e) => setField("tweet", e.target.value)}
                    placeholder="Leave blank to use the auto-generated headline + CTA. Plain text only — no emoji, hashtags, or URL; Choseno appends the link and hashtags automatically."
                    rows={2}
                  />
                  {containsEmoji(form.tweet) && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> Contains an emoji — Choseno strips emoji before posting, so it's cleaner to remove it here.
                    </p>
                  )}
                  {form.tweet.length > 220 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> {form.tweet.length} characters — Choseno appends hashtags and the article link after this, so keep it under ~220 to stay within X's 280-character limit.
                    </p>
                  )}
                </FieldGroup>
                <FieldGroup label="Sources (one per line: Label | https://url)">
                  <Textarea
                    value={form.sources}
                    onChange={(e) => setField("sources", e.target.value)}
                    placeholder={"City of Toronto Press Release | https://toronto.ca/news/...\nStatistics Canada | https://statcan.gc.ca/..."}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </FieldGroup>
              </div>
            </CollapsibleFormSection>

            {/* ── Article Body ── */}
            <CollapsibleFormSection
              title="Article Body (Markdown)"
              icon={<Edit3 size={13} />}
              open={sectionsOpen.content}
              onToggle={() => toggleSection("content")}
            >
              <Textarea
                value={form.body}
                onChange={(e) => setField("body", e.target.value)}
                placeholder={"Write your article in Markdown…\n\n## Section heading\n\nParagraph with **bold** and *italic*."}
                rows={16}
                className="font-mono text-xs"
              />
            </CollapsibleFormSection>

            {/* ── Author ── */}
            <CollapsibleFormSection
              title="Author"
              icon={<User size={13} />}
              open={sectionsOpen.author}
              onToggle={() => toggleSection("author")}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Author Name">
                  <Input value={form.authorName} onChange={(e) => setField("authorName", e.target.value)} placeholder="Jane Doe" />
                </FieldGroup>
                <FieldGroup label="Author Photo URL">
                  <Input value={form.authorPhotoUrl} onChange={(e) => setField("authorPhotoUrl", e.target.value)} placeholder="https://…" />
                </FieldGroup>
                <FieldGroup label="Author Bio" className="sm:col-span-2">
                  <Textarea value={form.authorBio} onChange={(e) => setField("authorBio", e.target.value)} placeholder="Short bio shown under the article" rows={2} />
                </FieldGroup>
              </div>
            </CollapsibleFormSection>

            {/* ── Hero Image ── */}
            <CollapsibleFormSection
              title="Hero Image"
              icon={<ImagePlus size={13} />}
              open={sectionsOpen.media}
              onToggle={() => toggleSection("media")}
            >
              <div className="space-y-4">
                {(heroPreview || form.hero_image_url) && (
                  <div className="relative rounded-xl overflow-hidden border border-border-light/20 h-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroPreview ?? form.hero_image_url}
                      alt="Hero preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => { setHeroFile(null); setHeroPreview(null); setField("hero_image_url", ""); }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                <input ref={heroFileRef} type="file" accept="image/*" className="hidden" onChange={handleHeroFileChange} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => heroFileRef.current?.click()}>
                    <Upload size={13} /> Select Image
                  </Button>
                  {heroFile && (
                    <Button size="sm" onClick={uploadHeroNow} disabled={uploadingHero || !form.slug}>
                      {uploadingHero ? <Spinner size="sm" /> : <ImagePlus size={13} />}
                      {uploadingHero ? "Uploading…" : "Upload to Storage"}
                    </Button>
                  )}
                </div>

                <FieldGroup label="Or paste Hero Image URL">
                  <Input
                    value={form.hero_image_url}
                    onChange={(e) => { setField("hero_image_url", e.target.value); setHeroPreview(null); }}
                    placeholder="https://…"
                  />
                </FieldGroup>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldGroup label="Image Alt Text">
                    <Input value={form.heroImageAlt} onChange={(e) => setField("heroImageAlt", e.target.value)} placeholder="Accessible image description" />
                  </FieldGroup>
                  <FieldGroup label="Image Caption">
                    <Input value={form.heroImageCaption} onChange={(e) => setField("heroImageCaption", e.target.value)} placeholder="Photo credit / caption" />
                  </FieldGroup>
                </div>
              </div>
            </CollapsibleFormSection>

            {/* Bottom actions */}
            <div className="flex justify-end gap-3 pb-4">
              <Button variant="ghost" onClick={closeForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size="sm" /> : <Save size={14} />}
                {saving ? "Saving…" : editingId ? "Update Article" : "Create Article"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Prompt Modal */}
      {showAiPrompt && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center py-8 px-4"
          style={{ backgroundColor: "var(--color-overlay-heavy)" }}>
          <div className="w-full max-w-2xl space-y-3">
            <div
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-border-light/30"
              style={{ backgroundColor: "var(--color-surface)" }}
            >
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                <Zap size={18} /> AI Prompt for News Generation
              </h2>
              <button
                onClick={() => setShowAiPrompt(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Prompt Mode Tabs */}
            <div className="flex gap-2 px-2">
              <button
                onClick={() => setPromptTab("single")}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  promptTab === "single"
                    ? "bg-primary text-white"
                    : "bg-surface-hover text-text-main hover:bg-surface"
                }`}
              >
                📰 Single Article
              </button>
              <button
                onClick={() => setPromptTab("batch")}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  promptTab === "batch"
                    ? "bg-primary text-white"
                    : "bg-surface-hover text-text-main hover:bg-surface"
                }`}
              >
                <List size={14} className="inline mr-1" />
                Batch (Multi-Story)
              </button>
            </div>

            {promptTab === "single" && promptPerson && (
              <div className="mx-2 flex items-center justify-between gap-3 text-xs bg-accent/10 text-accent font-semibold px-3 py-2 rounded-xl">
                <span className="flex items-center gap-1.5">
                  <Flag size={13} />
                  Pinned to: {promptPerson.name}
                  {!promptPerson.id && " (no linked profile — will tag by name only)"}
                </span>
                <button type="button" onClick={() => setPromptPerson(null)} className="hover:text-danger cursor-pointer shrink-0">
                  <X size={13} />
                </button>
              </div>
            )}

            <div
              className="p-5 rounded-2xl border border-border-light/30 space-y-3"
              style={{ backgroundColor: "var(--color-surface)" }}
            >
              <div className="space-y-2">
                <p className="text-sm text-text-muted">
                  {promptTab === "single"
                    ? "👇 Copy this prompt and paste it into Claude, ChatGPT, or your preferred AI service. Provide your news topic/source material and it will generate publication-ready JSON you can paste directly into the \"Paste JSON\" field."
                    : "👇 Copy this prompt to generate 3-10 news articles at once. Provide today's top stories or key topics, and it will generate a batch JSON you can paste directly into \"Paste JSON\"."}
                </p>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={getNewsAiPrompt(promptTab, promptPerson ?? undefined)}
                  className="w-full h-96 p-4 rounded-lg border border-border-light/30 bg-surface-hover font-mono text-xs resize-none"
                  style={{ color: "var(--color-text-main)" }}
                />
                <Button
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="absolute top-3 right-3"
                >
                  <Copy size={13} /> {promptCopied ? "Copied!" : "Copy Prompt"}
                </Button>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-primary">📝 Workflow</p>
                <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside">
                  <li>Copy the prompt above</li>
                  <li>Open Claude, ChatGPT, or Gemini</li>
                  <li>Paste the prompt as the system instruction</li>
                  {promptTab === "single" ? (
                    <>
                      <li>Provide your news topic/source material</li>
                      <li>Copy the JSON output from the AI</li>
                    </>
                  ) : (
                    <>
                      <li>Describe today&apos;s top stories or key topics</li>
                      <li>Specify number of articles needed (3-10)</li>
                      <li>Copy the batch JSON output from the AI</li>
                    </>
                  )}
                  <li>Click &quot;Paste JSON&quot; and paste the output</li>
                  <li>Review and click &quot;{promptTab === "batch" ? "Import All" : "Save"}&quot;</li>
                </ol>
              </div>

              <div className="bg-amber/10 border border-amber/20 rounded-lg p-3 text-xs text-text-muted space-y-1">
                <p className="font-semibold text-amber">✨ Country/Province Auto-Normalization</p>
                <p>The system automatically converts country names (Canada → CA, United States → US) and province names (Ontario → ON, California → CA) to ISO-2 codes.</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowAiPrompt(false)}>Close</Button>
                <Button onClick={handleCopyPrompt}>
                  <Copy size={13} /> {promptCopied ? "Copied!" : "Copy Prompt"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Article"
          message={`Delete "${deleteTarget.headline}"? This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusBar({ msg, onDismiss }: { msg: { type: "success" | "error"; msg: string }; onDismiss: () => void }) {
  const isSuccess = msg.type === "success";
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium border"
      style={{
        backgroundColor: isSuccess
          ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
          : "color-mix(in srgb, var(--color-danger) 10%, transparent)",
        borderColor: isSuccess
          ? "color-mix(in srgb, var(--color-success) 25%, transparent)"
          : "color-mix(in srgb, var(--color-danger) 25%, transparent)",
        color: isSuccess ? "var(--color-success-light)" : "var(--color-danger-light)",
      }}
    >
      <span>{msg.msg}</span>
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
}

function FieldGroup({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="p-5 rounded-2xl border border-border-light/30 space-y-3"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function CollapsibleFormSection({
  title, icon, open, onToggle, children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-border-light/30 overflow-hidden"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-text-main hover:bg-surface-hover transition-colors"
      >
        <span className="flex items-center gap-2">{icon}{title}</span>
        {open ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}
