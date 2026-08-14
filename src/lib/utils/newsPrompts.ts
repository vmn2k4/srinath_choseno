/**
 * Builds the "AI Prompt" text shown/copied in the admin News editor
 * (single-article and batch modes). Pure string building, no I/O — lives in
 * utils per docs/CODE_LAYERS.md. Was previously inlined in
 * AdminNewsPageClient.tsx; pulled out so OfficeHoldersAdminClient's
 * "Generate News Article" button (per politician/office holder) can build
 * the same prompt with a person pinned into it, instead of duplicating the
 * schema text.
 */

import {
  NEWS_CATEGORIES,
  NEWS_STATUSES,
  NEWS_IMPACT_AREAS,
  NEWS_IMPACT_AREA_DESCRIPTIONS,
  BREAKING_NEWS_ACTIVE_HOURS,
} from "@/lib/services/news";

/** Pinned when generating from a specific politician/office holder's admin profile — see PersonNewsPrompt in OfficeHoldersAdminClient. */
export interface NewsPromptPersonContext {
  id?: string;   // profiles.id — unambiguous; only set when the officeholder has a linked/claimed profile
  name: string;
}

const IMPACT_AREA_GUIDE = NEWS_IMPACT_AREAS
  .map((v) => `  - "${v}": ${NEWS_IMPACT_AREA_DESCRIPTIONS[v]}`)
  .join("\n");

function personInstructions(person?: NewsPromptPersonContext): string {
  if (!person) return "";
  const idLine = person.id
    ? `Their Choseno profile id is "${person.id}" — put this exact string in "taggedPoliticianIds" so the tag is unambiguous even if other people share their name. Do not alter or guess at this id.`
    : `No Choseno profile id is on file for them yet — put their exact full name in "taggedPoliticians" instead; it can be tagged manually once they claim a profile.`;
  return `\n\n### Subject of This Article\nThis article must be about, or substantially involve, ${person.name}. ${idLine}\n`;
}

export function getSingleNewsAiPrompt(person?: NewsPromptPersonContext): string {
  return `You are an expert, objective news writer and senior editor. When I provide a news article topic, source text, or headline, you will generate a complete, publication-ready news story based strictly on the provided input.

The output must strictly be a valid JSON object matching the schema below, with no markdown code blocks outside of the JSON formatting (or pure JSON text).
${personInstructions(person)}
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
  "category": "Choose one: ${NEWS_CATEGORIES.join(", ")}",
  "country": "CA — ISO-2 code (CA, US, GB…); full names like \\"Canada\\" also work and get normalized. Blank = global",
  "province": "ON — province/state code (ON, BC, NY, CA…); full names like \\"Ontario\\" also work. Blank = country-wide",
  "status": "Choose one: ${NEWS_STATUSES.join(", ")}",
  "eventDate": "2026-08-05T18:00:00Z — WHEN THE NEWS EVENT ITSELF HAPPENED in the real world, per the source material. Omit if genuinely unknown.",
  "published_at": "2026-08-06T00:00:00Z — WHEN THIS ARTICLE GOES LIVE on Choseno (usually now/today, NOT the same as eventDate for backfilled stories)",
  "impactArea": "Choose one: ${NEWS_IMPACT_AREAS.join(", ")} — how far the story's relevance reaches:\n${IMPACT_AREA_GUIDE}",
  "latitude": 49.1913 - OPTIONAL. Decimal latitude of where the event happened. REQUIRED if impactArea is "local" and the source material names a specific place. Omit if not determinable.,
  "longitude": -122.8490 - OPTIONAL. Decimal longitude, paired with latitude. Omit if not determinable.,
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
  "heroImageCaption": "Photo credit / caption shown under the image — OPTIONAL, only if provided in source material",
  "taggedPoliticians": ["Full Name As Registered On Choseno"],
  "taggedPoliticianIds": ["uuid-of-a-specific-politician-if-known — see 'Subject of This Article' above if one was given to you"],
  "taggedParty": "Party Name — OPTIONAL"
}

### Key Points:
- Headline: 60-80 characters, compelling but factual
- Summary: 100-150 characters, card-friendly excerpt
- Body: Use Markdown formatting with ## for subheadings
- Category: MUST be exactly one of: ${NEWS_CATEGORIES.join(", ")} — any other value will be miscategorized on the site
- Status: MUST be exactly one of: ${NEWS_STATUSES.join(", ")} — any other value will be rejected when saving
- eventDate vs published_at: these are TWO DIFFERENT DATES. eventDate is when the real-world thing happened (can be days/weeks/years in the past for a backfilled story). published_at is when this article itself becomes visible on Choseno. Do not merge them into one value.
- impactArea: MUST be exactly one of: ${NEWS_IMPACT_AREAS.join(", ")} — any other value will be rejected when saving. Pick "local" whenever the story is about a specific city/riding/municipality (and provide latitude/longitude for it); the system uses that point to automatically find and tag the exact electoral boundaries so local residents see it as local news.
- Latitude/Longitude: only set them together, only when the source material names a specific real-world place precisely enough to geolocate. Never guess coordinates.
- SEO Title: 50-60 characters, include primary keyword
- Meta Description: 150-160 characters, write for CTR not gaming
- Tags: 3-5 tags, relevant to the story
- Breaking News: Only mark as true if article is <6 hours old and unexpected. The badge auto-clears itself ${BREAKING_NEWS_ACTIVE_HOURS} hours after publish, so never set it for older or evergreen stories.
- Country/Province: prefer ISO-2 codes (CA, US, ON, BC…), but full names are accepted too
- Sources: cite every source the input material actually came from — this renders as a "Sources" section on the published article. Omit the array entirely if no sources were given, never invent one.
- Images: Never fabricate a hero_image_url — only set it if the source material gives you a real image URL and its photo credit. No image? Omit all three image fields; it can be uploaded manually afterward in the admin panel.
- All timestamps in ISO 8601 format with timezone
- taggedPoliticians: full name(s) of any politician who is a direct subject of the story (e.g. the story is about them, quotes them, or is their announcement). Use their full name exactly as it would appear on a public profile. Omit the field (or leave it an empty array) if no specific politician is the subject — never guess a name just to fill the field. Names that don't match a registered profile will simply be skipped and can be added manually afterward in the admin panel.
- taggedPoliticianIds: use this INSTEAD of (or alongside) taggedPoliticians whenever you were given an explicit profile id for the subject — an id match is exact and never ambiguous the way a name match can be when two people share a name. Never invent an id.
- taggedParty: the political party the story is about, if any. Omit if the story isn't about a specific party.

### Common Mistakes to Avoid:
❌ DON'T invent quotes, statistics, or details not in source material
❌ DON'T use sensational language ("Shocking", "Bombshell", "Massive")
❌ DON'T bury the lede - start with the news, not background
❌ DON'T assume or fill gaps with reasonable inferences
❌ DON'T include editorializing or opinion
❌ DON'T invent or guess at a taggedPoliticians/taggedPoliticianIds/taggedParty value — only include one explicitly named/given as a subject
❌ DON'T conflate eventDate and published_at — they answer different questions ("when did this happen" vs "when does this go live")
❌ DON'T set impactArea to "local" without also giving latitude/longitude when the source material makes the place determinable

✅ DO start with verified facts and datelines
✅ DO quote only when explicitly provided in source
✅ DO attribute opinion: "According to X, [opinion]"
✅ DO explain complex topics in plain language
✅ DO let the facts speak - no editorializing

Here is my news topic/headline and source details:`;
}

/** Extra constraints for the automated bulk-import flow (NewsImportAdminClient) — unused by the manual copy/paste UI, which never passes these. */
export interface BatchPromptOptions {
  /** ISO date (yyyy-mm-dd or full timestamp) — every article's eventDate must fall on/after this. */
  fromDate?: string;
  /** ISO date — every article's eventDate must fall on/before this. */
  toDate?: string;
  /** Source URLs already covered by an existing article for this person (from a prior bulk-import run OR a manually created article) — instructs the model not to regenerate them. Re-checked in code regardless (see grokNewsGeneration.ts); this list only reduces wasted generations. */
  excludeSourceUrls?: string[];
  /** Headlines of this person's existing articles (any status, any source) — a secondary dedup signal for the same real-world story reported without an exact source-URL match. */
  excludeHeadlines?: string[];
}

function dateRangeInstructions(opts?: BatchPromptOptions): string {
  if (!opts?.fromDate && !opts?.toDate) return "";
  const from = opts.fromDate ?? "any time in the past";
  const to = opts.toDate ?? "now";
  return `\n\n### Date Range (Backdated Import)\nOnly generate articles for real-world events that happened between ${from} and ${to}. Every "eventDate" MUST fall inside this range — omit any story you can't date within it rather than guessing.\nSet "published_at" to the SAME value as "eventDate" for every article (this is a historical backfill, not same-day news — the article should appear at its true historical position in the feed, not today's date).\n`;
}

function excludeSourcesInstructions(opts?: BatchPromptOptions): string {
  const urls = opts?.excludeSourceUrls;
  const headlines = opts?.excludeHeadlines;
  if ((!urls || urls.length === 0) && (!headlines || headlines.length === 0)) return "";
  let block = `\n\n### Already Covered — Do Not Regenerate\nThis person already has articles on Choseno covering the following. Do not generate another article about any of these stories, even from a different angle or a different source:\n`;
  if (urls && urls.length > 0) block += `\nAlready-covered source URLs:\n${urls.map((u) => `- ${u}`).join("\n")}\n`;
  if (headlines && headlines.length > 0) block += `\nAlready-covered story headlines (skip anything substantially the same story, even if you'd cite a different source for it):\n${headlines.map((h) => `- ${h}`).join("\n")}\n`;
  return block;
}

export function getBatchNewsAiPrompt(person?: NewsPromptPersonContext, opts?: BatchPromptOptions): string {
  return `You are an expert news curator and batch article generator. Your task is to generate multiple high-quality, publication-ready news articles in a single JSON batch format.

When provided with today's top news stories, key events, or a list of topics, you will generate between 3-10 complete news articles covering different angles, regions, or story types.
${personInstructions(person)}${dateRangeInstructions(opts)}${excludeSourcesInstructions(opts)}
### Output Format - Batch Array:

The output MUST be a valid JSON object with a batch array:

{
  "batch": [
    {
      "slug": "url-friendly-slug-1",
      "headline": "Compelling headline",
      "summary": "Short excerpt for card",
      "category": "${NEWS_CATEGORIES.join("|")}",
      "country": "CA|US|GB",
      "province": "ON|BC|NY|TX",
      "status": "${NEWS_STATUSES.join("|")}",
      "eventDate": "2026-08-06T09:00:00Z — when the real-world event happened",
      "published_at": "2026-08-06T14:30:00Z — when this article goes live on Choseno",
      "impactArea": "${NEWS_IMPACT_AREAS.join("|")}",
      "latitude": 43.6532 - OPTIONAL, only with impactArea \"local\" and a determinable place,
      "longitude": -79.3832 - OPTIONAL, paired with latitude,
      "body": "CITY, Prov. — [Content in Markdown...]",
      "seoTitle": "SEO title under 60 chars",
      "metaDescription": "Meta description under 160 chars",
      "tags": ["tag1", "tag2", "tag3"],
      "breakingNews": false,
      "author": { "name": "Author", "bio": "Role", "photoUrl": "https://... — OPTIONAL" },
      "sources": [{ "label": "Source", "url": "https://..." }],
      "hero_image_url": "https://... — OPTIONAL, only if source material gives a real image URL. Omit otherwise, never invent one.",
      "heroImageAlt": "Accessible description — REQUIRED if hero_image_url is set",
      "heroImageCaption": "Photo credit / caption — OPTIONAL",
      "taggedPoliticians": ["Full Name — OPTIONAL, only if a politician is a direct subject of this article"],
      "taggedPoliticianIds": ["uuid — OPTIONAL, use instead of/alongside taggedPoliticians when an exact profile id is known; never invent one"],
      "taggedParty": "Party Name — OPTIONAL"
    },
    { /* article 2 */ },
    { /* article 3 */ }
  ]
}

### Strict Guidelines:

1. **Diversity:** Cover different topics, regions, categories, or angles. Avoid repetition.

2. **Anti-Hallucination:** Never invent facts, quotes, or statistics not in source material.

3. **Category:** MUST be exactly one of ${NEWS_CATEGORIES.join(", ")} for every article — no other values, they won't display correctly on the site.

4. **Status:** MUST be exactly one of ${NEWS_STATUSES.join(", ")} — any other value will be rejected when saving.

5. **eventDate vs published_at:** two different dates per article — eventDate is when the real-world thing happened, published_at is when the article itself goes live on Choseno. Never merge them.

6. **impactArea:** MUST be exactly one of ${NEWS_IMPACT_AREAS.join(", ")} for every article:
${IMPACT_AREA_GUIDE}
   Set latitude/longitude whenever impactArea is "local" and the story names a determinable place — the system uses that point to automatically find and tag the matching electoral boundaries.

7. **Country/Province:** Prefer ISO-2 codes — CA/US/GB for country, ON/BC/NY/CA for province or state. Full names ("Canada", "Ontario") are accepted too and get normalized automatically, but codes are more reliable. Leave "province" blank for country-wide stories, and "country" blank for global stories.

8. **Factual & Neutral:** Start with dateline, no sensationalism, use Markdown formatting.

9. **Sources:** Cite every source each article's input actually came from — renders as a "Sources" section on the published page. Omit the array for an article with no sources, never invent one.

10. **Breaking News:** Only set \`breakingNews: true\` on articles that are genuinely <6 hours old and represent a sudden, unexpected development. The badge auto-clears itself ${BREAKING_NEWS_ACTIVE_HOURS} hours after \`published_at\` — never set it on older or evergreen stories in the batch.

11. **Images:** Never fabricate a hero_image_url for any article in the batch. Only set it (with heroImageAlt) when the source material actually supplies an image URL — otherwise omit all three image fields for that article; images can be added manually afterward in the admin panel.

12. **Politician/Party tagging:** Only set taggedPoliticians/taggedPoliticianIds/taggedParty when a specific politician or party is a direct subject of that article. Use the politician's full name exactly as it would appear on a public profile, or their exact profile id if one is known (ids are unambiguous even when two people share a name — prefer id when you have it). Never invent a name or id to fill the field — omit it for stories not centered on a specific politician or party. Names that don't match a registered profile are skipped automatically and can be tagged manually afterward by editing that article.

Here are today's news stories and topics:`;
}

/** Single entry point used by AdminNewsPageClient's prompt-mode toggle. */
export function getNewsAiPrompt(
  mode: "single" | "batch",
  person?: NewsPromptPersonContext,
  batchOpts?: BatchPromptOptions
): string {
  return mode === "batch" ? getBatchNewsAiPrompt(person, batchOpts) : getSingleNewsAiPrompt(person);
}
