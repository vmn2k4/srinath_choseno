/**
 * Grok-specific wrapper around the shared news-prompt/validation utilities
 * for the automated bulk-import flow (NewsImportAdminClient + api/admin/
 * news-import). Deliberately thin: the actual schema/field guidance lives
 * once in newsPrompts.ts (getBatchNewsAiPrompt) and is reused here rather
 * than duplicated, per docs/CODE_LAYERS.md ("reuse or extend what exists").
 * This module only adds what's specific to unattended AI generation:
 *   1. A JSON-only output contract (the manual UI lets an admin eyeball and
 *      fix stray markdown before pasting; an unattended pipeline can't).
 *   2. Programmatic re-verification of the requested date range and dedup
 *      — never trust the prompt alone, same reasoning as the DB CHECK
 *      constraints mirroring the JS enum validation elsewhere in this app.
 *   3. Mapping validated JSON straight to NewsArticleInsert — the manual
 *      UI's formToInsert() (AdminNewsPageClient.tsx) does the equivalent
 *      job but operates on its own form-state shape (string-typed fields,
 *      comma-joined tags, etc.), so it isn't reusable here; this reuses the
 *      one genuinely shared piece (matchEnum) rather than re-deriving it.
 *
 * Politician tagging is NOT parsed from the AI's output at all (see
 * mapGeneratedArticleToInsert/the API route) — the caller already holds the
 * politician's UUID (it's the input driving this whole request) and tags
 * every inserted article with it directly via syncNewsArticlePoliticianTags
 * after insert. That's more robust than trusting an LLM to echo a UUID back
 * correctly.
 *
 * Dependency flow: Grok → JSON → Validation → DB Insert → Wall Sync
 */

import { getBatchNewsAiPrompt, type NewsPromptPersonContext, type BatchPromptOptions } from "./newsPrompts";
import { validateNewsArticleJson, matchEnum } from "./newsValidation";
import {
  NEWS_CATEGORIES,
  NEWS_IMPACT_AREAS,
  type NewsArticleInsert,
  type NewsArticleContent,
  type NewsStatus,
} from "@/lib/services/news";

export type { NewsPromptPersonContext, BatchPromptOptions };

/**
 * Builds the Grok prompt: the shared batch schema/guidelines (with person +
 * date-range + exclusion-list instructions already woven in by
 * getBatchNewsAiPrompt), plus a strict JSON-only output contract on top —
 * unattended generation has no human to strip a stray code fence.
 */
export function getGrokBatchNewsPrompt(person: NewsPromptPersonContext, opts?: BatchPromptOptions): string {
  const basePrompt = getBatchNewsAiPrompt(person, opts);
  return `${basePrompt}

### STRICT OUTPUT CONTRACT (unattended pipeline — read this carefully)
- Respond with ONLY the JSON object described above. No markdown code fences, no explanation, no preamble or trailing commentary.
- If you cannot find any qualifying stories, respond with exactly: {"batch":[]}
- You do not need to fill in "taggedPoliticianIds" — the caller tags every article to ${person.name}'s profile automatically using its own records, not from anything you output. Focus on getting the reporting right.

Search for and generate the news stories now.`;
}

/**
 * Strict JSON parser with detailed error messages.
 * Throws on ANY invalid JSON; returns null if output indicates failure.
 */
export function parseGrokJsonResponse(response: string): { batch: any[] } | null {
  const trimmed = response.trim();

  if (!trimmed || trimmed === "null" || trimmed === "{}" || trimmed.toLowerCase().includes("cannot generate")) {
    return null;
  }

  // Tolerate a stray markdown fence even though the prompt forbids it.
  let jsonStr = trimmed;
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Grok JSON: ${message}\n\nRaw response: ${trimmed.slice(0, 500)}`);
  }

  if (!parsed.batch || !Array.isArray(parsed.batch)) {
    throw new Error('Response must contain {"batch": [...]} with batch as an array');
  }

  if (parsed.batch.length === 0) return null;
  return parsed;
}

// ── Validation ───────────────────────────────────────────────────────────

export interface GrokBatchValidationOptions {
  fromDate?: string;
  toDate?: string;
  /** Source URLs already imported for this politician — reject any article that reuses one. */
  excludeSourceUrls?: string[];
}

export interface GrokBatchValidationResult {
  valid: boolean;
  totalArticles: number;
  validArticles: number;
  failedArticles: Array<{ index: number; headline?: string; errors: string[] }>;
  /** Articles rejected specifically for reusing an already-imported source URL — reported separately from hard failures since this is expected on re-runs, not a generation error. */
  duplicateArticles: Array<{ index: number; headline?: string; reusedUrl: string }>;
  warnings: string[];
  summary: string;
}

function isWithinRange(dateStr: unknown, fromDate?: string, toDate?: string): boolean {
  if (typeof dateStr !== "string" || !dateStr.trim()) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  if (fromDate && t < new Date(fromDate).getTime()) return false;
  if (toDate && t > new Date(toDate).getTime()) return false;
  return true;
}

/**
 * Comprehensive validation of a batch before any DB operations. Builds on
 * validateNewsArticleJson (the same per-article check the manual paste-JSON
 * UI uses — see newsValidation.ts) and layers on the checks that are only
 * meaningful for unattended generation: the event must fall in the
 * requested date range, and the sources must not duplicate anything
 * already imported for this politician.
 *
 * Deliberately does NOT require taggedPoliticianIds/taggedPoliticians to
 * match `person` — this batch is generated for one known politician (the
 * caller already has their UUID, it's the input driving the whole request),
 * so the caller tags every inserted article with that UUID directly via
 * syncNewsArticlePoliticianTags() after insert. Trusting Grok to correctly
 * echo back a UUID it was merely shown, rather than using the UUID our own
 * code already holds, would be a pointless (and fragile) round-trip.
 */
export function validateGrokBatchOutput(
  batch: any[],
  person: NewsPromptPersonContext,
  opts: GrokBatchValidationOptions = {}
): GrokBatchValidationResult {
  const failedArticles: Array<{ index: number; headline?: string; errors: string[] }> = [];
  const duplicateArticles: Array<{ index: number; headline?: string; reusedUrl: string }> = [];
  const warnings: string[] = [];
  const excludeSet = new Set((opts.excludeSourceUrls ?? []).map((u) => u.trim()));

  if (!Array.isArray(batch)) {
    return {
      valid: false,
      totalArticles: 0,
      validArticles: 0,
      failedArticles: [{ index: 0, errors: ["Batch is not an array"] }],
      duplicateArticles: [],
      warnings: [],
      summary: "❌ Batch structure invalid: not an array",
    };
  }

  if (batch.length === 0) {
    return {
      valid: false,
      totalArticles: 0,
      validArticles: 0,
      failedArticles: [],
      duplicateArticles: [],
      warnings: [],
      summary: "❌ Batch is empty (Grok could not generate articles)",
    };
  }

  let validCount = 0;
  batch.forEach((item, index) => {
    // Reuse the same per-article schema/enum validation the manual
    // paste-JSON flow uses (newsValidation.ts) — single source of truth.
    const issues = validateNewsArticleJson(item, { label: `Article ${index + 1}` });
    const errors = [...issues.errors];

    if (!item.headline) errors.push(`Article ${index + 1}: headline is required`);
    if (!item.slug) errors.push(`Article ${index + 1}: slug is required`);
    if (!item.body) errors.push(`Article ${index + 1}: body is required`);

    // Date-range enforcement for backdated imports.
    const eventDateRaw = item.eventDate ?? item.event_date;
    if (opts.fromDate || opts.toDate) {
      if (!isWithinRange(eventDateRaw, opts.fromDate, opts.toDate)) {
        errors.push(
          `Article ${index + 1}: eventDate ("${eventDateRaw}") is missing or outside the requested range (${opts.fromDate ?? "…"} to ${opts.toDate ?? "now"})`
        );
      }
    }

    // Dedup check — reused source URL means this is a re-generation of a
    // story already imported. Reported separately (not a "failure") since
    // this is the expected/healthy outcome of re-running the import.
    const sources: Array<{ url?: string }> = Array.isArray(item.sources) ? item.sources : [];
    const reusedUrl = sources.map((s) => s?.url?.trim()).find((u) => u && excludeSet.has(u));
    if (reusedUrl) {
      duplicateArticles.push({ index, headline: item.headline, reusedUrl });
      return; // don't also count it as failed or valid
    }

    if (errors.length > 0) {
      failedArticles.push({ index, headline: item.headline, errors });
    } else {
      validCount++;
      warnings.push(...issues.warnings);
    }
  });

  const valid = failedArticles.length === 0;
  const summary = valid
    ? `✅ ${validCount} valid${duplicateArticles.length ? `, ${duplicateArticles.length} already-covered (skipped)` : ""}${warnings.length ? `, ${warnings.length} warnings` : ""}`
    : `❌ ${validCount}/${batch.length} valid, ${failedArticles.length} failed${duplicateArticles.length ? `, ${duplicateArticles.length} already-covered` : ""}`;

  return {
    valid,
    totalArticles: batch.length,
    validArticles: validCount,
    failedArticles,
    duplicateArticles,
    warnings,
    summary,
  };
}

/** User-facing error report for failed Grok batches. */
export function formatGrokValidationReport(result: GrokBatchValidationResult): string {
  let report = `\n📋 Grok Batch Validation Report\n${"=".repeat(50)}\n${result.summary}\n`;

  if (result.failedArticles.length > 0) {
    report += `\n❌ FAILED ARTICLES:\n${"-".repeat(50)}\n`;
    result.failedArticles.forEach((article) => {
      report += `\nArticle ${article.index + 1}${article.headline ? ` ("${article.headline}")` : ""}:\n`;
      article.errors.forEach((error) => (report += `  • ${error}\n`));
    });
  }

  if (result.duplicateArticles.length > 0) {
    report += `\n⏭️  ALREADY COVERED (skipped, not an error):\n${"-".repeat(50)}\n`;
    result.duplicateArticles.forEach((article) => {
      report += `  • ${article.headline ?? `Article ${article.index + 1}`} — ${article.reusedUrl}\n`;
    });
  }

  if (result.warnings.length > 0) {
    report += `\n⚠️  WARNINGS (non-blocking):\n${"-".repeat(50)}\n`;
    result.warnings.forEach((warning) => (report += `  • ${warning}\n`));
  }

  return report;
}

// ── Insert mapping ──────────────────────────────────────────────────────

/**
 * Maps one already-validated batch item to NewsArticleInsert. Only called
 * after validateGrokBatchOutput has passed the item, so required fields are
 * known present and category/impactArea are known to match one of the
 * enums (case/whitespace-tolerant) -- matchEnum here just recovers the
 * canonical casing, it isn't re-validating.
 *
 * status/eventDate/publishedAt are caller-supplied overrides, not read from
 * the AI's output: per the confirmed bulk-import design, published_at is
 * forced to equal event_date when publishing (true historical backdating,
 * not "posted today") and status is forced to what the admin selected for
 * the run -- both decided by the caller, not left to the model. eventDate
 * is kept separate from publishedAt so a draft insert (publishedAt: null,
 * not live yet) still records the correct historical event_date rather
 * than losing it.
 */
export function mapGeneratedArticleToInsert(
  item: any,
  overrides: { status: NewsStatus; eventDate: string; publishedAt: string | null }
): NewsArticleInsert {
  const flat = { ...item, ...(item.content ?? {}) };

  const content: NewsArticleContent = {
    seoTitle: flat.seoTitle || undefined,
    metaDescription: flat.metaDescription || undefined,
    body: flat.body || undefined,
    heroImageAlt: flat.heroImageAlt || undefined,
    heroImageCaption: flat.heroImageCaption || undefined,
    tweet: flat.tweet || undefined,
    breakingNews: flat.breakingNews || undefined,
    tags: Array.isArray(flat.tags)
      ? flat.tags
      : typeof flat.tags === "string"
        ? flat.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : undefined,
    author: flat.author
      ? { name: flat.author.name || undefined, bio: flat.author.bio || undefined, photoUrl: flat.author.photoUrl || undefined }
      : undefined,
    sources: Array.isArray(flat.sources) ? flat.sources : undefined,
  };

  return {
    slug: flat.slug,
    headline: flat.headline,
    summary: flat.summary || null,
    category: matchEnum(flat.category, NEWS_CATEGORIES) ?? "General",
    country: flat.country || null,
    province: flat.province || null,
    status: overrides.status,
    published_at: overrides.publishedAt,
    event_date: overrides.eventDate, // backdated import: published_at (when live) === event_date by design; event_date itself is always set
    latitude: flat.latitude != null && flat.latitude !== "" ? Number(flat.latitude) : null,
    longitude: flat.longitude != null && flat.longitude !== "" ? Number(flat.longitude) : null,
    impact_area: matchEnum(flat.impactArea ?? flat.impact_area, NEWS_IMPACT_AREAS) ?? null,
    hero_image_url: flat.hero_image_url || null,
    content,
  };
}

/** Pulls every sources[].url out of a validated batch item, for recordImportedSourceUrls. */
export function extractSourceUrls(item: any): string[] {
  const sources = Array.isArray(item?.sources) ? item.sources : [];
  return sources.map((s: any) => s?.url).filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0);
}
