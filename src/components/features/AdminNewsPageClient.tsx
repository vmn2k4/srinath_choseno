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
  Globe, AlignLeft, User, RefreshCw, Upload, ClipboardPaste,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listAllNewsArticlesForAdmin,
  getNewsArticleByIdForAdmin,
  createNewsArticle,
  updateNewsArticle,
  deleteNewsArticle,
  uploadNewsHeroImage,
  type NewsArticle,
  type NewsArticleContent,
  type NewsArticleInsert,
} from "@/lib/services/news";

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
}

const EMPTY_FORM: ArticleFormData = {
  slug: "",
  headline: "",
  summary: "",
  category: "General",
  country: "",
  province: "",
  status: "draft",
  published_at: "",
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

function applyJsonToForm(parsed: any, prev: ArticleFormData): ArticleFormData {
  const flat = { ...parsed, ...(parsed.content ?? {}) };
  return {
    ...prev,
    slug:           flat.slug           ?? prev.slug,
    headline:       flat.headline       ?? flat.title ?? prev.headline,
    summary:        flat.summary        ?? prev.summary,
    category:       flat.category       ?? prev.category,
    country:        flat.country        ?? prev.country,
    province:       flat.province       ?? prev.province,
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
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  // ── JSON import ───────────────────────────────────────────────────────────

  function parseAndApplyJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      setForm((prev) => applyJsonToForm(parsed, prev));
      setJsonPasteError("");
      return true;
    } catch {
      setJsonPasteError("Invalid JSON — check your syntax and try again.");
      return false;
    }
  }

  function handleJsonFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ok = parseAndApplyJson(ev.target?.result as string);
      if (ok) setStatusMsg({ type: "success", msg: "JSON imported — review fields and save." });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleJsonPasteApply() {
    if (!jsonPasteText.trim()) { setJsonPasteError("Paste some JSON first."); return; }
    const ok = parseAndApplyJson(jsonPasteText);
    if (ok) {
      setStatusMsg({ type: "success", msg: "JSON applied — review fields and save." });
      setJsonPasteMode(false);
      setJsonPasteText("");
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
                    {a.country && (
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Globe size={11} /> {a.country.toUpperCase()}
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
                  Paste any JSON object. Top-level keys like <code className="text-primary text-xs bg-surface px-1 rounded">headline</code>, <code className="text-primary text-xs bg-surface px-1 rounded">body</code>, <code className="text-primary text-xs bg-surface px-1 rounded">tags</code>, etc. will be mapped into the form fields automatically.
                </p>
                <Textarea
                  value={jsonPasteText}
                  onChange={(e) => { setJsonPasteText(e.target.value); setJsonPasteError(""); }}
                  placeholder={'{\n  "headline": "My article",\n  "body": "## Intro\\n\\nContent here…",\n  "status": "published",\n  "published_at": "2026-08-04T00:00:00Z"\n}'}
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

                <FieldGroup label="Country (ISO-2)">
                  <Input
                    value={form.country}
                    onChange={(e) => setField("country", e.target.value.toUpperCase())}
                    placeholder="CA, US, GB — blank = global"
                    maxLength={2}
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
                    🔴 Breaking News
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
