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
1. **Editorial Quality & Depth (Comprehensive Coverage):**
   - Articles must be rich, substantive, and deeply informative (aim for 400–750 words across 3–4 structured sections). Never produce superficial 2-paragraph summaries.
   - Readers come to Choseno for clear, authoritative civic analysis. Every article must answer:
     - **The Core Action**: Exactly what policy, executive order, legislation, or appointment occurred.
     - **Specifics & Numbers**: Dollar amounts, bill names/numbers, statutory timelines, affected districts, and concrete metrics.
     - **Why It Matters (Constituent Impact)**: How residents, local businesses, or specific public services are directly affected.
     - **Next Steps & Accountability**: Upcoming legislative votes, public comment periods, implementation dates, or opposition perspectives.

2. **Headline Integrity & Anti-Scaled Content Abuse (CRITICAL):**
   - **Google Search Essentials strictly bans formulaic, template-swapped content ("Scaled Content Abuse").**
   - 🚫 **BANNED HEADLINE FORMULAS:**
     - NEVER use: \`[Name] Advances [Topic] [Initiative/Expansion] for [City]\`
     - NEVER use: \`[Name] Unveils [Topic] Plan for [City]\`
     - NEVER use crutch verbs: *"Advances"*, *"Champions"*, *"Spearheads"*, *"Unveils"*, *"Rolls Out"*, *"Pushes for"*, *"Highlights"*.
     - AVOID ending headlines with repetitive prepositional tails like \`"...for [City]"\`. Integrate location naturally into the action or subject.
   - ✅ **ROTATE ACROSS 6 JOURNALISTIC ARCHETYPES:**
     1. *Outcome/Fiscal Impact Lead*: E.g. *"Henderson Secures $14M Regional Emergency Care Expansion as Patient Volume Climbs"*
     2. *Institutional Action Lead*: E.g. *"Bakersfield City Council Restructures Community Patrols in $3.2M Safety Overhaul"*
     3. *Conflict & Oversight*: E.g. *"Manhattan Council Hearing Sparks Clash Over Transit Safety and Mental Health Teams"*
     4. *Regulatory / Statutory Specifics*: E.g. *"Alberta Institutes 2% Grid Levy on Large AI Data Centers Exceeding 75 Megawatts"*
     5. *Direct Quote / Active Stance*: E.g. *"'Quite Firm': Trade Negotiators Meet in Final Push to Avert 14% Softwood Lumber Tariffs"*
     6. *Electoral / Regional Stakes*: E.g. *"Florida Primary Eve: High-Stakes Race to Decide Gubernatorial and U.S. Senate Succession"*

3. **Tone & Objectivity:** The content must be strictly neutral, fact-based, and objective. Avoid bias, loaded language, or sensationalism while maintaining plain, accessible language for a general audience.

4. **Anti-Hallucination & Accuracy Rules:**
   - Never invent names, quotes, statistics, dates, locations, sources, or details not present in the input.
   - If information is unavailable, explicitly state context or omit rather than filling gaps with plausible assumptions.

5. **Factual Openings (No Sensationalism):** Open the body immediately with a standard journalistic dateline (e.g., \`CITY, Prov. — \`) followed by a concrete, factual scene or verified statistic from the source material. Avoid dramatic metaphors or clickbait.

6. **Direct & Specific Source Citations:**
   - In \`sources\`, provide the **exact, direct deep-link URL** to the specific article, government press release, or official report (e.g. \`https://news.gov.bc.ca/releases/2026PREM0045-001234\`), **never** generic homepages (e.g. \`https://apnews.com\` or \`https://cbc.ca\`).
   - Use clear, professional publication labels (e.g., "B.C. Government Executive Office", "The Associated Press", "CBC British Columbia").

7. **Structure & Readability:** Break up sections into shorter, digestible subsections with punchy, action-oriented subheads tailored to the specific story topic (using Markdown \`##\`). Use bulleted breakdowns for multi-part policies or financial allocations.

8. **Format & Schema:** Fill out every field in the JSON accurately. The \`body\` must use standard Markdown formatting.

### Required JSON Structure:
{
  "slug": "url-friendly-hyphenated-slug",
  "headline": "Compelling, accurate news headline (60-80 chars)",
  "summary": "Short, punchy card excerpt summarizing the core development (100-150 chars)",
  "category": "Choose one: ${NEWS_CATEGORIES.join(", ")}",
  "country": "CA — ISO-2 code (CA, US, GB…); full names like \\"Canada\\" also work and get normalized. Blank = global",
  "province": "ON — province/state code (ON, BC, NY, CA…); full names like \\"Ontario\\" also work. Blank = country-wide",
  "status": "Choose one: ${NEWS_STATUSES.join(", ")}",
  "eventDate": "2026-08-05T18:00:00Z — WHEN THE NEWS EVENT ITSELF HAPPENED in the real world, per the source material. Omit if genuinely unknown.",
  "published_at": "2026-08-06T00:00:00Z — WHEN THIS ARTICLE GOES LIVE on Choseno (usually now/today, NOT the same as eventDate for backfilled stories)",
  "impactArea": "Choose one: ${NEWS_IMPACT_AREAS.join(", ")} — how far the story's relevance reaches:\n${IMPACT_AREA_GUIDE}",
  "latitude": 49.1913 - OPTIONAL. Decimal latitude of where the event happened. REQUIRED if impactArea is "local" and the source material names a specific place. Omit if not determinable.,
  "longitude": -122.8490 - OPTIONAL. Decimal longitude, paired with latitude. Omit if not determinable.,
  "body": "CITY, Prov. — [Concrete, factual opening based strictly on source material...]\\n\\n## [Action-Oriented Subhead: Policy Mechanics & Core Decisions]\\n\\n[Detailed explanation of the decision, key stakeholders involved, and concrete figures...]\\n\\n## [Key Takeaways & Regional Impact]\\n\\n* **Immediate Effect**: [Bullet point]\\n* **Fiscal & Policy Allocation**: [Bullet point]\\n\\n## Outlook & Next Steps\\n\\n[Timelines for implementation, legislative milestones, and public accountability mechanisms...]",
  "seoTitle": "Optimized SEO Title under 60 characters",
  "metaDescription": "Concise meta description under 160 characters summarizing the article for search engines",
  "tags": ["tag1", "tag2", "tag3"],
  "tweet": "REQUIRED & CLICK-OPTIMIZED. A highly engaging, captivating 1-2 sentence hook designed for X/Twitter sharing to maximize discovery and click-throughs. Focus on the civic stakes, key decision, or accountability angle (e.g. 'Premier David Eby reshuffles BC Cabinet amid surging healthcare demands — see how the changes impact your riding.'). Plain text ONLY — no emojis, no hashtags, no URLs (Choseno automatically appends the canonical card link and topic hashtags). Keep under 200 characters.",
  "tweetmedium": "REQUIRED whenever taggedPoliticians/taggedPoliticianIds is non-empty, otherwise omit. A single neutral sentence that puts REVIEWING THE POLITICIAN ahead of everything else — not a news summary, a review prompt. Anchor it to THIS STORY'S specific decision/action, not a generic prompt. Pattern: 'Do you agree with {full name}'s {short 4-8 word neutral noun phrase naming the actual decision/action from this story, e.g. \\"new family planning grant requirements\\" or \\"the cabinet reshuffle\\"}? Review them on Choseno.' — swap in the actual tagged politician's name (join with 'and' if 2, use 'the officials involved' if 3+). If the tagged politician is the target/subject of someone else's action rather than the one deciding (e.g. a lawsuit against their policy), phrase it as 'Do you agree with {policy/decision}? Review {name} on Choseno.' instead. Strictly neutral: 'agree with' is a question, not a verdict — no loaded adjectives like 'controversial', 'bold', or 'reckless', no praise, no criticism baked in — the sentence should invite a yes or a no equally, regardless of whether the story reflects well or badly on the person. Plain text ONLY — no emoji, no hashtags, no URL (Choseno resolves and appends the politician's actual wall link afterwards, since a newly-tagged politician may not have one yet at generation time).",
  "breakingNews": false,
  "author": {
    "name": "Choseno Civic News Desk",
    "bio": "Provincial and municipal political affairs reporting",
    "photoUrl": "https://... — OPTIONAL, omit if not provided"
  },
  "sources": [
    {
      "label": "Specific Outlet / Office Name",
      "url": "https://example.com/exact-deep-link-article-url"
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
- Depth & Substance: 400–750 words. Do NOT create short 1-paragraph stubs. Every article must provide comprehensive background, civic impact, and actionable timelines.
- Headline: 60-80 characters, compelling but factual. Strictly avoid repetitive formulaic templates like '[Name] Advances [Topic] for [City]'.
- Summary: 100-150 characters, card-friendly excerpt
- Body: Use Markdown formatting with ## for subheadings and bullet points for complex breakdowns
- Category: MUST be exactly one of: ${NEWS_CATEGORIES.join(", ")} — any other value will be miscategorized on the site
- Status: MUST be exactly one of: ${NEWS_STATUSES.join(", ")} — any other value will be rejected when saving
- Sources: Provide direct, canonical article links (deep URLs) to the specific reporting or government release, never generic domain root URLs.
- eventDate vs published_at: these are TWO DIFFERENT DATES. eventDate is when the real-world thing happened (can be days/weeks/years in the past for a backfilled story). published_at is when this article itself becomes visible on Choseno. Do not merge them into one value.
- impactArea: MUST be exactly one of: ${NEWS_IMPACT_AREAS.join(", ")} — any other value will be rejected when saving. Pick "local" whenever the story is about a specific city/riding/municipality (and provide latitude/longitude for it); the system uses that point to automatically find and tag the exact electoral boundaries so local residents see it as local news.
- Latitude/Longitude: only set them together, only when the source material names a specific real-world place precisely enough to geolocate. Never guess coordinates.
- SEO Title: 50-60 characters, include primary keyword
- Meta Description: 150-160 characters, write for CTR not gaming
- Tags: 3-5 tags, relevant to the story
- Tweet: High-engagement 1-2 sentence hook (~140-200 chars). Plain text, NO emoji, NO hashtags, NO URL — Choseno appends the link and auto-generated hashtags itself.
- Tweet Medium: One neutral sentence putting the review CTA first, only when a politician is tagged — anchored to this story's specific decision, e.g. "Do you agree with {name}'s {short decision phrase}? Review them on Choseno." No loaded adjectives, no praise or criticism baked in, no emoji/hashtags/URL (Choseno appends the wall link itself once it's resolved).
- Breaking News: Only mark as true if article is <6 hours old and unexpected. The badge auto-clears itself ${BREAKING_NEWS_ACTIVE_HOURS} hours after publish, so never set it for older or evergreen stories.
- Country/Province: prefer ISO-2 codes (CA, US, ON, BC…), but full names are accepted too
- Images: Never fabricate a hero_image_url — only set it if the source material gives you a real image URL and its photo credit. No image? Omit all three image fields; Choseno automatically renders the dynamic OpenGraph visual card.
- All timestamps in ISO 8601 format with timezone
- taggedPoliticians: full name(s) of any politician who is a direct subject of the story (e.g. the story is about them, quotes them, or is their announcement).
- taggedPoliticianIds: use this INSTEAD of (or alongside) taggedPoliticians whenever you were given an explicit profile id for the subject.
- taggedParty: the political party the story is about, if any.

### Common Mistakes to Avoid:
❌ DON'T use robotic formulaic headlines like "[Name] Advances [Topic] Initiative for [City]" — rotate across diverse journalistic archetypes
❌ DON'T write superficial 2-paragraph summaries — include full civic context, key metrics, and constituent impact
❌ DON'T provide generic homepage links in sources (e.g. "https://apnews.com") — always link to the exact specific article URL
❌ DON'T invent quotes, statistics, or details not in source material
❌ DON'T use sensational language ("Shocking", "Bombshell", "Massive")
❌ DON'T bury the lede - start with the news, not background
❌ DON'T assume or fill gaps with reasonable inferences
❌ DON'T include editorializing or opinion
❌ DON'T put emoji, hashtags, or a URL inside "tweet" — Choseno strips/derives those automatically and you'll get duplicates
❌ DON'T put emoji, a URL, or any opinion/praise/criticism inside "tweetmedium" — it's a neutral review prompt, not a take

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
      "tweet": "Captivating 1-2 sentence hook designed for high engagement on X/Twitter. Focus on civic stakes/key decisions. Plain text ONLY (no emoji, hashtags, or URLs — Choseno appends those). ~200 chars max.",
      "tweetmedium": "REQUIRED whenever taggedPoliticians/taggedPoliticianIds is non-empty, otherwise omit. One neutral sentence putting the review CTA first, not a news summary, anchored to this story's specific decision: 'Do you agree with {full name}'s {short 4-8 word neutral phrase naming the actual decision/action}? Review them on Choseno.' If the tagged politician is the target of someone else's action rather than the decider, use 'Do you agree with {policy/decision}? Review {name} on Choseno.' instead. No praise/criticism/loaded adjectives, no emoji/hashtags/URL — Choseno appends the wall link itself.",
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

1. **Editorial Quality & Depth:** Aim for substantive 400–750 word coverage per story. Break into 3–4 logical sections (## subheads) covering the core action, concrete numbers/policy mechanics, constituent impact, and next steps. Never generate superficial 1-2 paragraph stubs.

2. **Headline Integrity & Anti-Scaled Content Abuse (CRITICAL):**
   - **Google Search Essentials strictly penalize repetitive formulaic content ("Scaled Content Abuse").**
   - 🚫 **BANNED HEADLINE FORMULAS:**
     - NEVER use: \`[Name] Advances [Topic] [Initiative/Expansion] for [City]\`
     - NEVER use: \`[Name] Unveils [Topic] Plan for [City]\`
     - NEVER use crutch verbs: *"Advances"*, *"Champions"*, *"Spearheads"*, *"Unveils"*, *"Rolls Out"*, *"Pushes for"*, *"Highlights"*.
     - AVOID ending headlines with repetitive prepositional tails like \`"...for [City]"\`. Integrate location naturally into the subject or action.
   - ✅ **ROTATE ACROSS 6 JOURNALISTIC ARCHETYPES:**
     1. *Outcome/Fiscal Impact Lead*: E.g. *"Henderson Secures $14M Regional Emergency Care Expansion as Patient Volume Climbs"*
     2. *Institutional Action Lead*: E.g. *"Bakersfield City Council Restructures Community Patrols in $3.2M Safety Overhaul"*
     3. *Conflict & Oversight*: E.g. *"Manhattan Council Hearing Sparks Clash Over Transit Safety and Mental Health Teams"*
     4. *Regulatory / Statutory Specifics*: E.g. *"Alberta Institutes 2% Grid Levy on Large AI Data Centers Exceeding 75 Megawatts"*
     5. *Direct Quote / Active Stance*: E.g. *"'Quite Firm': Trade Negotiators Meet in Final Push to Avert 14% Softwood Lumber Tariffs"*
     6. *Electoral / Regional Stakes*: E.g. *"Florida Primary Eve: High-Stakes Race to Decide Gubernatorial and U.S. Senate Succession"*
   - 📐 **BATCH DIVERSITY RATIO:**
     - Maximum 20% Name-Led: In a batch of 5-10 stories, at least 80% must lead with the city, agency, bill, or outcome—NOT the politician's personal name.
     - Zero Shared Verbs: No two headlines in the batch may share the same primary verb.

3. **Diversity:** Cover different topics, regions, categories, or angles. Avoid repetition.

4. **Anti-Hallucination:** Never invent facts, quotes, or statistics not in source material.

5. **Category:** MUST be exactly one of ${NEWS_CATEGORIES.join(", ")} for every article — no other values, they won't display correctly on the site.

6. **Status:** MUST be exactly one of ${NEWS_STATUSES.join(", ")} — any other value will be rejected when saving.

7. **eventDate vs published_at:** two different dates per article — eventDate is when the real-world thing happened, published_at is when the article itself goes live on Choseno. Never merge them.

8. **impactArea:** MUST be exactly one of ${NEWS_IMPACT_AREAS.join(", ")} for every article:
${IMPACT_AREA_GUIDE}
   Set latitude/longitude whenever impactArea is "local" and the story names a determinable place — the system uses that point to automatically find and tag the matching electoral boundaries.

9. **Country/Province:** Prefer ISO-2 codes — CA/US/GB for country, ON/BC/NY/CA for province or state. Full names ("Canada", "Ontario") are accepted too and get normalized automatically, but codes are more reliable. Leave "province" blank for country-wide stories, and "country" blank for global stories.

10. **Direct Source Citations:** In \`sources\`, cite the exact, direct canonical deep link (e.g. \`https://news.gov.bc.ca/releases/2026PREM0045-001234\`), never generic root domains (e.g. \`https://apnews.com\`). Use accurate publication labels.

11. **Breaking News:** Only set \`breakingNews: true\` on articles that are genuinely <6 hours old and represent a sudden, unexpected development. The badge auto-clears itself ${BREAKING_NEWS_ACTIVE_HOURS} hours after \`published_at\` — never set it on older or evergreen stories in the batch.

12. **Images:** Never fabricate a hero_image_url for any article in the batch. Only set it (with heroImageAlt) when the source material actually supplies an image URL — otherwise omit all three image fields for that article; Choseno automatically generates the dynamic OpenGraph visual card.

13. **Politician/Party tagging:** Only set taggedPoliticians/taggedPoliticianIds/taggedParty when a specific politician or party is a direct subject of that article. Use the politician's full name exactly as it would appear on a public profile, or their exact profile id if one is known. Never invent an id.

14. **Tweet Copy:** Captivating 1-2 sentence hook (~140-200 chars). Plain text only — no emoji, no hashtags, no URL. Choseno automatically appends the canonical card link and topic hashtags.

15. **Tweet Medium Copy:** Whenever an article tags a politician, also write \`tweetmedium\`: one neutral sentence leading with the review CTA instead of the news, anchored to THIS article's specific decision — "Do you agree with {name}'s {short decision phrase}? Review them on Choseno." (or "Do you agree with {policy/decision}? Review {name} on Choseno." when the tagged politician is the target of someone else's action rather than the decider). No praise, criticism, loaded adjectives, emoji, hashtags, or URL — Choseno resolves and appends the actual wall link afterwards.

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
