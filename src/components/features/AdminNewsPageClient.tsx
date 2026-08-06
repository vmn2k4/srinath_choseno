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
  Newspaper, Plus, Trash2, Edit3, Eye, Save,
  X, ImagePlus, FileJson, ChevronDown, ChevronUp, Calendar,
  Globe, AlignLeft, User, RefreshCw, Upload, ClipboardPaste, Zap, Copy, List,
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
  isBreakingNewsActive,
  BREAKING_NEWS_ACTIVE_HOURS,
  type NewsArticle,
  type NewsArticleContent,
  type NewsArticleInsert,
} from "@/lib/services/news";
import { normalizeCountryCode, normalizeProvinceCode } from "@/lib/utils/newsGeography";

// ── Types ─────────────────────────────────────────────────────────────────

interface ArticleFormData {
  slug: string;
  headline: string;
  summary: string;
  category: string;
  country: string;
  province: string;
  status: "draft" | "scheduled" | "published" | "archived";
  published_at: string;
  hero_image_url: string;
  seoTitle: string;
  metaDescription: string;
  body: string;
  heroImageAlt: string;
  heroImageCaption: string;
  tags: string;
  breakingNews: boolean;
  authorName: string;
  authorBio: string;
  authorPhotoUrl: string;
  sources: string; // one per line: "Label | https://url"
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
  hero_image_url: "",
  seoTitle: "",
  metaDescription: "",
  body: "",
  heroImageAlt: "",
  heroImageCaption: "",
  tags: "",
  breakingNews: false,
  authorName: "",
  authorBio: "",
  authorPhotoUrl: "",
  sources: "",
};

const STATUS_CONFIG: Record<string, { label: string; tone: "primary" | "accent" | "amber" | "emerald" | "rose" | "neutral" }> = {
  draft:     { label: "Draft",     tone: "neutral"  },
  scheduled: { label: "Scheduled", tone: "amber"    },
  published: { label: "Live",      tone: "emerald"  },
  archived:  { label: "Archived",  tone: "neutral"  },
};

const CATEGORY_OPTIONS = [
  "General", "Engineering", "Privacy", "Product Update", "Policy",
  "Elections", "Local", "National", "International", "Opinion",
];

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
    hero_image_url:f.hero_image_url|| null,
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
    hero_image_url:a.hero_image_url  ?? "",
    seoTitle:      c?.seoTitle       ?? "",
    metaDescription:c?.metaDescription?? "",
    body:          c?.body           ?? "",
    heroImageAlt:  c?.heroImageAlt   ?? "",
    heroImageCaption:c?.heroImageCaption??"",
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

function getAiPrompt(mode: "single" | "batch" = "single"): string {
  if (mode === "batch") {
    return getBatchAiPrompt();
  }
  return `You are an expert, objective news writer and senior editor. When I provide a news article topic, source text, or headline, you will generate a complete, publication-ready news story based strictly on the provided input.

The output must strictly be a valid JSON object matching the schema below, with no markdown code blocks outside of the JSON formatting (or pure JSON text).

### Strict Guidelines:
1. **Tone & Objectivity:** The content must be strictly neutral, fact-based, and objective. Avoid bias, loaded language, or sensationalism while maintaining plain, accessible language for a general audience.

2. **Anti-Hallucination & Accuracy Rules:**
   - Never invent names, quotes, statistics, dates, locations, sources, or details not present in the input.
   - If information is unavailable, explicitly omit it or state uncertainty rather than filling gaps with plausible assumptions.

3. **Factual Openings (No Sensationalism):** Open the body immediately with a standard journalistic dateline (e.g., \`CITY, Prov. — \`) followed by a concrete, factual scene or verified statistic from the source material. Avoid dramatic metaphors or clickbait.

4. **Verified Quotes Only:** Integrate direct quotes or attributions *only* when explicitly provided in the source material. If no verified quotes are available, summarize perspectives using neutral paraphrasing without quotation marks.

5. **Structure & Readability:** Break up sections into shorter, digestible subsections with punchy, action-oriented subheads tailored to the specific story topic.

6. **Format & Schema:** Fill out every field in the JSON accurately. The \`body\` must use standard Markdown formatting.

### Required JSON Structure:
{
  "slug": "url-friendly-hyphenated-slug",
  "headline": "Compelling, accurate news headline",
  "summary": "Short, punchy card excerpt summarizing the core development",
  "category": "Choose one: ${CATEGORY_OPTIONS.join(", ")}",
  "country": "CA — ISO-2 code (CA, US, GB…); full names like \\"Canada\\" also work and get normalized. Blank = global",
  "province": "ON — province/state code (ON, BC, NY, CA…); full names like \\"Ontario\\" also work. Blank = country-wide",
  "status": "Choose one: ${Object.keys(STATUS_CONFIG).join(", ")}",
  "published_at": "2026-08-06T00:00:00Z",
  "body": "CITY, Prov. — [Concrete, factual opening based strictly on source material...]\\n\\n## [Action-Oriented Subhead]\\n\\n[Core details, verified facts, and bullet points for metrics...]\\n\\n## Outlook\\n\\n[Forward-looking context grounded strictly in the source material...]",
  "seoTitle": "Optimized SEO Title under 60 characters",
  "metaDescription": "Concise meta description under 160 characters summarizing the article for search engines",
  "tags": ["tag1", "tag2", "tag3"],
  "breakingNews": false,
  "author": {
    "name": "Jane Doe",
    "bio": "Civic and investigative reporter",
    "photoUrl": "https://... — OPTIONAL, omit if not provided"
  },
  "sources": [
    {
      "label": "Source Name",
      "url": "https://example.com/source"
    }
  ],
  "hero_image_url": "https://example.com/photo.jpg — OPTIONAL. Only include if the source material explicitly provides an image URL. Never invent, guess, or reuse a stock URL — omit this field entirely if no image was given.",
  "heroImageAlt": "Accessible description of what's in the image — REQUIRED whenever hero_image_url is set, omit otherwise",
  "heroImageCaption": "Photo credit / caption shown under the image — OPTIONAL, only if provided in source material"
}

### Key Points:
- Headline: 60-80 characters, compelling but factual
- Summary: 100-150 characters, card-friendly excerpt
- Body: Use Markdown formatting with ## for subheadings
- Category: MUST be exactly one of: ${CATEGORY_OPTIONS.join(", ")} — any other value will be miscategorized on the site
- Status: MUST be exactly one of: ${Object.keys(STATUS_CONFIG).join(", ")} — any other value will be rejected when saving
- SEO Title: 50-60 characters, include primary keyword
- Meta Description: 150-160 characters, write for CTR not gaming
- Tags: 3-5 tags, relevant to the story
- Breaking News: Only mark as true if article is <6 hours old and unexpected. The badge auto-clears itself ${BREAKING_NEWS_ACTIVE_HOURS} hours after publish, so never set it for older or evergreen stories.
- Country/Province: prefer ISO-2 codes (CA, US, ON, BC…), but full names are accepted too
- Sources: cite every source the input material actually came from — this renders as a "Sources" section on the published article. Omit the array entirely if no sources were given, never invent one.
- Images: Never fabricate a hero_image_url — only set it if the source material gives you a real image URL and its photo credit. No image? Omit all three image fields; it can be uploaded manually afterward in the admin panel.
- All timestamps in ISO 8601 format with timezone

### Common Mistakes to Avoid:
❌ DON'T invent quotes, statistics, or details not in source material
❌ DON'T use sensational language ("Shocking", "Bombshell", "Massive")
❌ DON'T bury the lede - start with the news, not background
❌ DON'T assume or fill gaps with reasonable inferences
❌ DON'T include editorializing or opinion

✅ DO start with verified facts and datelines
✅ DO quote only when explicitly provided in source
✅ DO attribute opinion: "According to X, [opinion]"
✅ DO explain complex topics in plain language
✅ DO let the facts speak - no editorializing

Here is my news topic/headline and source details:`;
}

function getBatchAiPrompt(): string {
  return `You are an expert news curator and batch article generator. Your task is to generate multiple high-quality, publication-ready news articles in a single JSON batch format.

When provided with today's top news stories, key events, or a list of topics, you will generate between 3-10 complete news articles covering different angles, regions, or story types.

### Output Format - Batch Array:

The output MUST be a valid JSON object with a batch array:

{
  "batch": [
    {
      "slug": "url-friendly-slug-1",
      "headline": "Compelling headline",
      "summary": "Short excerpt for card",
      "category": "${CATEGORY_OPTIONS.join("|")}",
      "country": "CA|US|GB",
      "province": "ON|BC|NY|TX",
      "status": "${Object.keys(STATUS_CONFIG).join("|")}",
      "published_at": "2026-08-06T14:30:00Z",
      "body": "CITY, Prov. — [Content in Markdown...]",
      "seoTitle": "SEO title under 60 chars",
      "metaDescription": "Meta description under 160 chars",
      "tags": ["tag1", "tag2", "tag3"],
      "breakingNews": false,
      "author": { "name": "Author", "bio": "Role", "photoUrl": "https://... — OPTIONAL" },
      "sources": [{ "label": "Source", "url": "https://..." }],
      "hero_image_url": "https://... — OPTIONAL, only if source material gives a real image URL. Omit otherwise, never invent one.",
      "heroImageAlt": "Accessible description — REQUIRED if hero_image_url is set",
      "heroImageCaption": "Photo credit / caption — OPTIONAL"
    },
    { /* article 2 */ },
    { /* article 3 */ }
  ]
}

### Strict Guidelines:

1. **Diversity:** Cover different topics, regions, categories, or angles. Avoid repetition.

2. **Anti-Hallucination:** Never invent facts, quotes, or statistics not in source material.

3. **Category:** MUST be exactly one of ${CATEGORY_OPTIONS.join(", ")} for every article — no other values, they won't display correctly on the site.

4. **Status:** MUST be exactly one of ${Object.keys(STATUS_CONFIG).join(", ")} — any other value will be rejected when saving.

5. **Country/Province:** Prefer ISO-2 codes — CA/US/GB for country, ON/BC/NY/CA for province or state. Full names ("Canada", "Ontario") are accepted too and get normalized automatically, but codes are more reliable. Leave "province" blank for country-wide stories, and "country" blank for global stories.

6. **Factual & Neutral:** Start with dateline, no sensationalism, use Markdown formatting.

7. **Sources:** Cite every source each article's input actually came from — renders as a "Sources" section on the published page. Omit the array for an article with no sources, never invent one.

8. **Breaking News:** Only set \`breakingNews: true\` on articles that are genuinely <6 hours old and represent a sudden, unexpected development. The badge auto-clears itself ${BREAKING_NEWS_ACTIVE_HOURS} hours after \`published_at\` — never set it on older or evergreen stories in the batch.

9. **Images:** Never fabricate a hero_image_url for any article in the batch. Only set it (with heroImageAlt) when the source material actually supplies an image URL — otherwise omit all three image fields for that article; images can be added manually afterward in the admin panel.

Here are today's news stories and topics:`;
}

function applyJsonToForm(parsed: any, prev: ArticleFormData): ArticleFormData {
  const flat = { ...parsed, ...(parsed.content ?? {}) };
  const country = flat.country ? normalizeCountryCode(flat.country) : prev.country;
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
    hero_image_url: flat.hero_image_url ?? flat.heroImageUrl ?? prev.hero_image_url,
    seoTitle:       flat.seoTitle       ?? prev.seoTitle,
    metaDescription:flat.metaDescription?? prev.metaDescription,
    body:           flat.body           ?? prev.body,
    heroImageAlt:   flat.heroImageAlt   ?? prev.heroImageAlt,
    heroImageCaption:flat.heroImageCaption?? prev.heroImageCaption,
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

  // JSON import state
  const [jsonPasteMode, setJsonPasteMode] = useState(false);
  const [jsonPasteText, setJsonPasteText] = useState("");
  const [jsonPasteError, setJsonPasteError] = useState("");

  // Batch import state — populated when the pasted JSON has a top-level
  // `batch` array instead of a single article.
  const [batchPreview, setBatchPreview] = useState<NewsArticleInsert[] | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);

  // AI Prompt state
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptTab, setPromptTab] = useState<"single" | "batch">("single");

  const [sectionsOpen, setSectionsOpen] = useState({
    core: true,
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

  function parseAndApplyJson(jsonString: string): { ok: boolean; batchCount?: number } {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && Array.isArray(parsed.batch)) {
        const drafts = parsed.batch.map((item: any) => formToInsert(applyJsonToForm(item, EMPTY_FORM)));
        setBatchPreview(drafts);
        setJsonPasteError("");
        return { ok: true, batchCount: drafts.length };
      }
      setBatchPreview(null);
      setForm((prev) => applyJsonToForm(parsed, prev));
      setJsonPasteError("");
      return { ok: true };
    } catch {
      setJsonPasteError("Invalid JSON — check your syntax and try again.");
      return { ok: false };
    }
  }

  function handleJsonFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseAndApplyJson(ev.target?.result as string);
      if (result.ok) {
        setStatusMsg({
          type: "success",
          msg: result.batchCount
            ? `Loaded ${result.batchCount} articles — review below and click "Import All".`
            : "JSON imported — review fields and save.",
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleJsonPasteApply() {
    if (!jsonPasteText.trim()) { setJsonPasteError("Paste some JSON first."); return; }
    const result = parseAndApplyJson(jsonPasteText);
    if (result.ok) {
      setStatusMsg({
        type: "success",
        msg: result.batchCount
          ? `Loaded ${result.batchCount} articles — review below and click "Import All".`
          : "JSON applied — review fields and save.",
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
    setBatchImporting(false);

    if (failed.length === 0) {
      setStatusMsg({ type: "success", msg: `Imported ${created.length} article${created.length === 1 ? "" : "s"}.` });
      setBatchPreview(null);
      await loadArticles();
      closeForm();
    } else {
      setStatusMsg({
        type: created.length > 0 ? "success" : "error",
        msg: `Imported ${created.length}, ${failed.length} failed — ${failed.map((f) => `"${f.headline}": ${f.error}`).join("; ")}`,
      });
      setBatchPreview(null);
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
    if (editingId) {
      const res = await updateNewsArticle(supabase, editingId, payload);
      err = res.error;
    } else {
      const res = await createNewsArticle(supabase, payload);
      err = res.error;
    }

    setSaving(false);
    if (err) {
      setStatusMsg({ type: "error", msg: err.message });
    } else {
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
    navigator.clipboard.writeText(getAiPrompt(promptTab));
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {articles.length} article{articles.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={loadArticles} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={openNewForm}>
            <Plus size={14} /> New Article
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
              <Card key={a.id} padding="sm" className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <Badge tone="primary">{a.category}</Badge>
                    {isBreakingNewsActive(a) && <Badge tone="rose">🔴 Breaking</Badge>}
                    {a.country && (
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Globe size={11} /> {a.country}{a.province ? `-${a.province}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-text-main truncate">{a.headline}</p>
                  <p className="text-xs text-text-muted font-mono">{a.slug}</p>
                  {a.published_at && (
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(a.published_at).toLocaleDateString("en-CA", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.status !== "published" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald hover:text-emerald-light"
                      onClick={() => handleQuickPublish(a.id)}
                      title="Publish this article"
                    >
                      <Zap size={13} />
                    </Button>
                  )}
                  {a.status === "published" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber hover:text-amber-light"
                      onClick={() => handleQuickUnpublish(a.id)}
                      title="Unpublish this article"
                    >
                      <Eye size={13} className="line-through" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" as="a" href={`/news/${a.slug}`} target="_blank" rel="noopener noreferrer">
                    <Eye size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditForm(a.id)}>
                    <Edit3 size={13} />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="text-danger hover:text-danger-light"
                    onClick={() => setDeleteTarget({ id: a.id, headline: a.headline })}
                  >
                    <Trash2 size={13} />
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
                {jsonPasteError && <p className="text-xs text-danger mt-1">{jsonPasteError}</p>}
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
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </Select>
                </FieldGroup>

                <FieldGroup label="Publish Date / Time">
                  <Input
                    type="datetime-local"
                    value={form.published_at}
                    onChange={(e) => setField("published_at", e.target.value)}
                  />
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
                  value={getAiPrompt(promptTab)}
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
