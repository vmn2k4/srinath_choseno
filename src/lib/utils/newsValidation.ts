/**
 * Pure validation for AI-generated / hand-pasted news article JSON before it
 * ever reaches a Supabase call. The admin "Paste JSON" flow used to only
 * catch `JSON.parse` syntax errors — a syntactically valid object with
 * `"category": "Politics"` (not in NEWS_CATEGORIES) or `"impactArea": "city"`
 * (not one of the four enum values) would silently save wrong/null and only
 * surface as a confusing UI state later. This gives the admin a specific,
 * per-field reason up front instead.
 *
 * No I/O, no Supabase — stays in utils per the layering rules in
 * docs/CODE_LAYERS.md. Mirrors the DB-level CHECK constraints added in
 * supabase/migrations/20260813000000_news_event_geo_impact_area.sql, so a
 * value that passes here is guaranteed to pass there too.
 */

import { NEWS_CATEGORIES, NEWS_STATUSES, NEWS_IMPACT_AREAS, type NewsImpactArea } from "@/lib/services/news";
import { containsEmoji } from "@/lib/utils/text";

export interface NewsJsonIssues {
  errors: string[];
  warnings: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDate(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Case/whitespace-tolerant match against an enum array; returns the canonical
 * value or null. Exported so grokNewsGeneration.ts's insert-mapper can reuse
 * the exact same normalization this validator already applies, instead of
 * re-implementing enum matching a second time.
 */
export function matchEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const needle = value.trim().toLowerCase();
  return allowed.find((v) => v.toLowerCase() === needle) ?? null;
}

/**
 * Validates one article object (a single-mode paste, or one entry of a
 * batch array). Doesn't mutate `item` — callers still run it through the
 * existing applyJsonToForm/formToInsert mapping; this only decides what
 * feedback to show alongside that.
 */
export function validateNewsArticleJson(item: any, opts: { label?: string } = {}): NewsJsonIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = opts.label ? `${opts.label}: ` : "";

  if (item == null || typeof item !== "object" || Array.isArray(item)) {
    return { errors: [`${prefix}expected a JSON object, got ${Array.isArray(item) ? "an array" : typeof item}.`], warnings: [] };
  }

  const flat = { ...item, ...(item.content ?? {}) };

  if (!flat.headline && !flat.title) {
    errors.push(`${prefix}missing "headline" — required to save.`);
  }

  if (flat.category != null && !matchEnum(flat.category, NEWS_CATEGORIES)) {
    errors.push(`${prefix}"category" is "${flat.category}" — must be one of: ${NEWS_CATEGORIES.join(", ")}.`);
  }

  if (flat.status != null && !matchEnum(flat.status, NEWS_STATUSES)) {
    errors.push(`${prefix}"status" is "${flat.status}" — must be one of: ${NEWS_STATUSES.join(", ")}.`);
  }

  const impactAreaRaw = flat.impactArea ?? flat.impact_area;
  let impactArea: NewsImpactArea | null = null;
  if (impactAreaRaw != null) {
    impactArea = matchEnum(impactAreaRaw, NEWS_IMPACT_AREAS);
    if (!impactArea) {
      errors.push(`${prefix}"impactArea" is "${impactAreaRaw}" — must be one of: ${NEWS_IMPACT_AREAS.join(", ")} (Local / State-wide / Country-wide / International).`);
    }
  }

  const lat = flat.latitude;
  const lng = flat.longitude;
  const hasLat = lat != null && lat !== "";
  const hasLng = lng != null && lng !== "";
  if (hasLat !== hasLng) {
    errors.push(`${prefix}"latitude" and "longitude" must both be set together, or both omitted.`);
  } else if (hasLat && hasLng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      errors.push(`${prefix}"latitude" (${lat}) must be a number between -90 and 90.`);
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      errors.push(`${prefix}"longitude" (${lng}) must be a number between -180 and 180.`);
    }
  }

  if (impactArea === "local" && !(hasLat && hasLng)) {
    warnings.push(`${prefix}"impactArea" is "local" but no latitude/longitude given — the story won't auto-tag to any electoral boundary until coordinates are added.`);
  }

  const eventDateRaw = flat.eventDate ?? flat.event_date;
  if (eventDateRaw != null && eventDateRaw !== "" && !isValidDate(eventDateRaw)) {
    errors.push(`${prefix}"eventDate" ("${eventDateRaw}") isn't a parseable date — use ISO 8601 (e.g. "2026-08-06T14:30:00Z").`);
  }

  if (flat.published_at != null && flat.published_at !== "" && !isValidDate(flat.published_at)) {
    errors.push(`${prefix}"published_at" ("${flat.published_at}") isn't a parseable date — use ISO 8601.`);
  }

  const taggedIds = flat.taggedPoliticianIds;
  if (taggedIds != null) {
    if (!Array.isArray(taggedIds)) {
      errors.push(`${prefix}"taggedPoliticianIds" must be an array of profile UUIDs.`);
    } else {
      taggedIds.forEach((id: unknown) => {
        if (typeof id !== "string" || !UUID_RE.test(id)) {
          warnings.push(`${prefix}"taggedPoliticianIds" contains "${id}", which isn't a valid UUID — it will be skipped.`);
        }
      });
    }
  }

  if (flat.taggedPoliticians != null && !Array.isArray(flat.taggedPoliticians)) {
    errors.push(`${prefix}"taggedPoliticians" must be an array of full-name strings.`);
  }

  if (flat.sources != null && !Array.isArray(flat.sources)) {
    errors.push(`${prefix}"sources" must be an array of { label, url } objects.`);
  }

  if (flat.tags != null && !Array.isArray(flat.tags) && typeof flat.tags !== "string") {
    errors.push(`${prefix}"tags" must be an array of strings.`);
  }

  if (flat.tweet != null) {
    if (typeof flat.tweet !== "string") {
      errors.push(`${prefix}"tweet" must be a string.`);
    } else {
      if (containsEmoji(flat.tweet)) {
        warnings.push(`${prefix}"tweet" contains an emoji — Choseno strips emoji before posting, so it's cleaner to leave them out of the source text.`);
      }
      if (/https?:\/\//i.test(flat.tweet)) {
        warnings.push(`${prefix}"tweet" appears to contain a URL — Choseno already appends the canonical article link automatically; a URL inside "tweet" will show up twice.`);
      }
      if (flat.tweet.length > 220) {
        warnings.push(`${prefix}"tweet" is ${flat.tweet.length} characters — Choseno appends hashtags and the article link after it, so keep it well under X's 280-character limit (220 or less is safest).`);
      }
    }
  }

  return { errors, warnings };
}

/** Runs validateNewsArticleJson over every item in a batch and merges the results, labeling each by index/headline. */
export function validateNewsArticleBatchJson(items: any[]): NewsJsonIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  items.forEach((item, i) => {
    const label = `Article ${i + 1}${item?.headline ? ` ("${item.headline}")` : ""}`;
    const result = validateNewsArticleJson(item, { label });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  });
  return { errors, warnings };
}
