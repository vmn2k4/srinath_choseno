# News Article JSON Schema — Quick Reference

## Required vs. Optional Fields

| Field | Required | Type | Validation |
|-------|----------|------|-----------|
| `slug` | ✅ | string | Lowercase, hyphens, URL-safe |
| `headline` | ✅ | string | 60-80 characters |
| `summary` | ✅ | string | 100-150 characters |
| `category` | ✅ | enum | One of: General, Engineering, Privacy, Product Update, Policy, Elections, Local, National, International, Opinion |
| `status` | ✅ | enum | One of: draft, scheduled, published, archived |
| `body` | ✅ | markdown | Markdown formatted, starts with dateline |
| `seoTitle` | ✅ | string | <60 characters |
| `metaDescription` | ✅ | string | <160 characters |
| `taggedPoliticianIds` | ✅ | UUID[] | **MUST include politician's UUID** |
| `taggedPoliticians` | ✅ | string[] | **MUST include politician's full name** |
| --- | --- | --- | --- |
| `country` | ❌ | string | ISO-2 (CA, US, GB) or full name (Canada) |
| `province` | ❌ | string | ISO-2 (ON, BC) or full name (Ontario) |
| `published_at` | ❌ | ISO 8601 | When article goes LIVE on Choseno |
| `event_date` | ❌ | ISO 8601 | When the real-world event happened |
| `impactArea` | ❌ | enum | One of: local, state, country, international |
| `latitude` | ❌ | number | -90 to 90 (REQUIRED if impactArea=local) |
| `longitude` | ❌ | number | -180 to 180 (REQUIRED if impactArea=local) |
| `tags` | ❌ | string[] | 3-5 relevant tags |
| `breakingNews` | ❌ | boolean | true/false (auto-expires after 3 hours) |
| `sources` | ❌ | object[] | Array of {label, url} — cite your sources |
| `hero_image_url` | ❌ | URL string | ONLY if source provides real image — never invent |
| `heroImageAlt` | ❌ | string | Accessible description (REQUIRED if hero_image_url set) |
| `heroImageCaption` | ❌ | string | Photo credit |
| `author` | ❌ | object | {name, bio, photoUrl (optional)} |
| `taggedParty` | ❌ | string | Political party name (if specific party is subject) |
| `political_party_id` | ❌ | number | Internal DB ID (auto-set from taggedParty) |

---

## Date Format (ISO 8601)

```
✅ CORRECT:    2026-08-14T14:30:00Z
❌ WRONG:      08/14/2026
❌ WRONG:      August 14, 2026
❌ WRONG:      2026-08-14 (missing time and timezone)
```

**Pattern:** `YYYY-MM-DDTHH:MM:SSZ`
- `Z` = UTC timezone
- Always include timezone indicator

---

## Category Enum (EXACT Match)

Grok must use **exactly these strings** (case-sensitive):

```
✅ "General"
✅ "Engineering"
✅ "Privacy"
✅ "Product Update"
✅ "Policy"
✅ "Elections"
✅ "Local"
✅ "National"
✅ "International"
✅ "Opinion"

❌ "general" (lowercase — wrong)
❌ "Finance" (not in enum)
❌ "Local News" (extra words)
```

---

## Status Enum (EXACT Match)

```
✅ "draft"       — Not visible to public
✅ "scheduled"   — Will go live at scheduled time
✅ "published"   — Visible now (on politician's wall if tagged)
✅ "archived"    — Was published, now hidden

❌ "pending"     (wrong)
❌ "public"      (wrong)
```

---

## Impact Area Enum (EXACT Match)

```
✅ "local"           → Small area (city/riding/municipality)
                       REQUIRES: latitude & longitude
✅ "state"           → Province/state-wide
✅ "country"         → Country-wide
✅ "international"   → Multiple countries

❌ "city"            (use "local")
❌ "provincial"      (use "state")
❌ "worldwide"       (use "international")
```

---

## Politician Tagging (The Critical Part)

### ✅ Correct Tagging

If politician has UUID `550e8400-e29b-41d4-a716-446655440000`:

```json
{
  "taggedPoliticianIds": ["550e8400-e29b-41d4-a716-446655440000"],
  "taggedPoliticians": ["Brenda Locke"]
}
```

**This ensures:**
- Article shows on Brenda Locke's wall (unambiguous UUID match)
- Falls back to name match for backup
- If no profile exists yet, name match works until one is created

### ❌ Incorrect Tagging

```json
{
  "taggedPoliticianIds": [],  // ❌ Empty — breaks wall sync
  "taggedPoliticians": ["Brenda"]  // ❌ Partial name — may not match
}
```

```json
{
  "taggedPoliticianIds": ["550e8400-WRONG-UUID"],  // ❌ Wrong UUID — no match
  "taggedPoliticians": ["Jane Smith"]  // ❌ Wrong person
}
```

---

## Latitude/Longitude Rules

### ✅ Correct

```json
{
  "impactArea": "local",
  "latitude": 49.1913,
  "longitude": -122.8490
}
```

**Constraints:**
- Latitude: -90 to 90
- Longitude: -180 to 180
- Both required together, or both omitted
- Must be valid coordinates (not 0,0 unless actually meant)

### ❌ Incorrect

```json
{
  "impactArea": "local",
  "latitude": 49.1913,
  "longitude": null  // ❌ Longitude missing
}
```

```json
{
  "impactArea": "local",
  "latitude": 91.0,  // ❌ Out of range
  "longitude": -122.8490
}
```

```json
{
  "impactArea": "state",
  "latitude": 49.1913,  // ❌ Don't set for non-local
  "longitude": -122.8490
}
```

---

## Sources Array (Cite Your Sources)

### ✅ Correct

```json
{
  "sources": [
    { "label": "CBC News", "url": "https://cbc.ca/news/..." },
    { "label": "Globe and Mail", "url": "https://theglobeandmail.com/..." }
  ]
}
```

### ❌ Incorrect

```json
{
  "sources": []  // ❌ Empty — you should cite your source
}
```

```json
{
  "sources": "CBC News"  // ❌ String instead of array
}
```

---

## Slug Format

### ✅ Correct

```
brenda-locke-elected-mayor
mayor-budget-announcement-2026
surrey-council-votes-on-bylaw
```

**Rules:**
- Lowercase only
- Hyphens to separate words
- No underscores, spaces, or special characters
- URL-safe (no unicode)

### ❌ Incorrect

```
Brenda Locke Elected Mayor          (spaces, uppercase)
mayor_budget_announcement_2026      (underscores)
mayor-budget-announcement-2026-🎉  (emoji)
mayor budget announcement           (spaces)
```

---

## Hero Image Rules

### ✅ Include Image

**ONLY if source article provides a real image URL:**

```json
{
  "hero_image_url": "https://cdn.example.com/photo-123.jpg",
  "heroImageAlt": "Mayor Brenda Locke speaking at a press conference",
  "heroImageCaption": "Photo: John Smith / CBC News"
}
```

### ❌ Don't Invent Images

```json
{
  "hero_image_url": "https://example.com/generic-city-photo.jpg"  // ❌ Hallucinated
}
```

```json
{
  "hero_image_url": "https://cdn.example.com/photo.jpg",
  "heroImageAlt": null  // ❌ Alt required if image set
}
```

**Rule:** Omit all three fields if source doesn't provide an image. Admins can upload manually in `/admin/news`.

---

## Breaking News (Auto-Expires)

### ✅ Breaking News

Only for articles <6 hours old:

```json
{
  "breakingNews": true,
  "published_at": "2026-08-14T13:45:00Z"  // Less than 6 hours ago
}
```

**After 3 hours**, the badge auto-disappears (no manual cleanup needed).

### ❌ Not Breaking News

```json
{
  "breakingNews": true,
  "published_at": "2026-08-10T13:45:00Z"  // ❌ 4 days old
}
```

```json
{
  "breakingNews": true,
  "published_at": "2026-08-14T13:45:00Z",
  "event_date": "2026-08-01T09:00:00Z"  // ❌ Event was 2 weeks ago
}
```

---

## Body Format (Markdown)

### ✅ Correct Structure

```markdown
VANCOUVER, B.C. — Mayor Brenda Locke announced a $50 million budget increase for municipal services on Tuesday, marking the largest investment in five years.

## Budget Details

The funds will be allocated across three priority areas:
- Transit infrastructure ($20M)
- Community programs ($15M)
- Parks and recreation ($15M)

"This investment reflects our commitment to residents," Locke said at a press conference.

## Next Steps

City council will vote on the final budget on August 21.
```

### ❌ Wrong Formats

```markdown
# Main Headline  ❌ Use ## for subheads, not main headline
```

```markdown
Mayor Locke announced...  ❌ Missing dateline (CITY, PROV. — )
```

```markdown
😱 SHOCKING NEWS! Mayor announces... ❌ No sensationalism/emoji
```

---

## Complete Valid Example

```json
{
  "slug": "mayor-brenda-locke-budget-2026-august",
  "headline": "Mayor Brenda Locke announces $50M municipal budget",
  "summary": "Surrey's mayor unveils largest budget increase in 5 years for transit and community services",
  "category": "Local",
  "country": "CA",
  "province": "BC",
  "status": "draft",
  "published_at": "2026-08-14T14:00:00Z",
  "event_date": "2026-08-14T10:30:00Z",
  "impactArea": "local",
  "latitude": 49.0504,
  "longitude": -122.3045,
  "body": "SURREY, B.C. — Mayor Brenda Locke announced a $50 million budget increase for municipal services on Wednesday, marking the largest investment in five years.\n\n## Budget Breakdown\n\nThe funds will be allocated across three priority areas:\n- Transit infrastructure ($20M)\n- Community programs ($15M)\n- Parks and recreation ($15M)\n\n\"This investment reflects our commitment to residents,\" Locke said.\n\n## Next Steps\n\nCity council will vote on the budget on August 21.",
  "seoTitle": "Surrey mayor announces $50M budget increase",
  "metaDescription": "Mayor Brenda Locke unveils largest municipal budget in 5 years for Surrey, BC",
  "tags": ["Surrey", "budget", "municipal government"],
  "breakingNews": false,
  "author": {
    "name": "Jane Smith",
    "bio": "Municipal affairs reporter"
  },
  "sources": [
    {
      "label": "Surrey City Council Press Release",
      "url": "https://surrey.ca/news/budget-announcement-2026"
    }
  ],
  "taggedPoliticianIds": ["550e8400-e29b-41d4-a716-446655440000"],
  "taggedPoliticians": ["Brenda Locke"]
}
```

---

## Validation Checklist

Before running the script, verify Grok will generate:

- [ ] All required fields present
- [ ] `taggedPoliticianIds` includes politician's UUID
- [ ] `taggedPoliticians` includes politician's full name
- [ ] All enums match exactly (category, status, impactArea)
- [ ] Dates in ISO 8601 format with timezone
- [ ] If impactArea="local", latitude/longitude both set and valid
- [ ] Slug is lowercase, hyphens, URL-safe
- [ ] Body is Markdown formatted with dateline
- [ ] All sources cited (no hallucinated articles)
- [ ] Hero image URL only if source provides real image
- [ ] If hero_image_url set, heroImageAlt also set

---

## When Validation Fails

The system will show you **exactly which articles failed and why**:

```
❌ FAILED ARTICLES:
──────────────────────────────────────────────────
Article 3 ("Mayor Budget Cuts"):
  • "category" is "Finance" — must be one of: General, Engineering, ...
  • taggedPoliticianIds must include "550e8400-..." (got: [])

⚠️  WARNINGS (non-blocking):
──────────────────────────────────────────────────
  • Article 1: "impactArea" is "local" but no latitude/longitude given
```

**No articles will be inserted if there are ANY errors** — only warnings pass through.

---

## Quick Test

To verify your Grok prompt works, test with:

```bash
npx ts-node scripts/generate-news-for-politician.ts \
  --politician-id "550e8400-e29b-41d4-a716-446655440000" \
  --politician-name "Brenda Locke" \
  --dry-run \
  --limit 1
```

This will:
1. Request just 1 article (faster)
2. Not insert into DB (--dry-run)
3. Show you Grok's raw JSON output
4. Show validation results
5. Let you refine before doing a full run
