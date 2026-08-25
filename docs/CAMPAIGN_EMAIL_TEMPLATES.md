# Campaign Email Templates — What Each One Needs

No single doc covered all six `/admin/campaign` templates before this — [OUTREACH_GUIDE.md](../OUTREACH_GUIDE.md) §4
only documents the Mayor/Councillor pair in depth (copy rationale, layout, the MIME delivery fix).
This doc is the field-by-field reference for **all six**, sourced directly from the preset
definitions in [`campaignTemplates.ts`](../src/lib/utils/campaignTemplates.ts).

**Send tool**: `/admin/campaign` (gated to `profiles.role='admin'`, per [ADMIN_FEATURES.md](ADMIN_FEATURES.md)).
**Component**: [`CampaignAdminClient.tsx`](../src/components/features/CampaignAdminClient.tsx).
**Import/validation logic**: [`campaignImport.ts`](../src/lib/utils/campaignImport.ts).
**Send/logging logic**: [`campaigns.ts`](../src/lib/services/campaigns.ts).

---

## 1. Prerequisites for sending *any* campaign

- **Admin role** on your account.
- **Campaign name** — a non-empty text field; the "Send All" button stays disabled without one.
  Each preset has a sensible default (e.g. "BC Mayors 2026") but you can rename it.
- **At least one valid recipient row** — rows with a validation error (missing name/email,
  malformed email, or missing a field the template marks required) are excluded from the send count.
- **SMTP delivery configured**:
  - Local dev routes through `/api/admin/send-email`, using `TITAN_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` from `.env.local`.
  - Production routes through the Supabase Edge Function `send-email`, using `SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` set as **Supabase Edge Function secrets** — separate from `.env.local`, not verifiable from a local checkout. Check the Supabase dashboard if prod sends start failing.

## 2. Adding recipients

Three ways, per [OUTREACH_GUIDE.md §4](../OUTREACH_GUIDE.md):
1. **Paste CSV or JSON** directly into the text box.
2. **Upload a file** (CSV or JSON).
3. **Search politicians & office holders** — reuses the nav-bar search RPC to find someone already
   on Choseno and add them with one click. This is the safest way to fill `wall_slug` correctly
   (see §4 below).

### CSV/JSON parsing rules (shared across all six templates)

- Header matching is case-insensitive and accepts aliases (`parseCampaignCsv` /
  `HEADER_ALIASES` in `campaignImport.ts`):

  | Canonical field | Accepted headers |
  |---|---|
  | `name` | `name`, `full_name`, `fullname`, `politician_name` |
  | `email` | `email`, `politician_email` |
  | `role` | `role`, `role_title`, `title`, `position` |
  | `city` | `city`, `municipality` |
  | `wallSlug` | `wall_slug`, `wallslug`, `wall`, `wall_url`, `wallurl` |

- `name` and `email` are **always** required, regardless of template — a row missing either, or
  with a malformed email, gets excluded with a per-row error.
- JSON accepts a bare array or `{"records": [...]}`, same field names (plus camelCase variants
  like `fullName`, `wallUrl`).
- Lines starting with `#` are treated as comments and skipped.

## 3. The six templates

Each row's **Required** column is what that specific template additionally demands beyond
`name`/`email` (always required). A row missing a required field is skipped on send.

| Key | Label | Required fields | Optional fields | Default campaign name |
|---|---|---|---|---|
| `mayor` | Mayor | `name`, `email`, `city`, **`wall_slug`** | `role` | BC Mayors 2026 |
| `councillor` | Councillor | `name`, `email`, `city`, **`wall_slug`** | `role` | BC Councillors 2026 |
| `candidate` | New Candidate Nominees | `name`, `email`, `role`, `city` | `wall_slug` | 2026 Candidate Nominees Outreach |
| `parties` | Civic Parties | `name`, `email`, `city` | `role`, `wall_slug` | BC Civic Parties 2026 |
| `pssa` | Students Association | `name`, `email` | `role` | Student Association Election Researchers 2026 |
| `professor` | Professor / Academic | `name`, `email`, `role` | — | Academic Collaboration 2026 |

### 3a. Mayor

- **Subject**: `Your Mayor Wall is Ready on Choseno — Connect with {{city}} Voters This Election`
- **CSV header**: `name,email,role,city,wall_slug`
- **Sample row**: `Brenda Locke,brenda@surrey.ca,Mayor,Surrey,brenda-locke-mayor`
- **Use case**: Connect with mayors/mayoral candidates to claim their Candidate Wall and engage local voters.
- `wall_slug` is **required** here — see §4, this is the field most likely to trip up a send.

### 3b. Councillor

- **Subject**: `Your Councillor Wall is Ready on Choseno — Connect with {{city}} Voters This Election`
- **CSV header**: `name,email,role,city,wall_slug`
- **Sample row**: `Sarah Kirby-Yung,sarah@vancouver.ca,Councillor,Vancouver,sarah-kirby-yung-councillor`
- **Use case**: Invite municipal councillors to claim their Candidate Wall.
- Same `wall_slug` requirement as Mayor.

### 3c. New Candidate Nominees

- **Subject**: `Congratulations on Your {{role}} Nomination in {{city}} — Your Campaign Wall is Ready`
- **CSV header**: `name,email,role,city,wall_slug`
- **Sample row**: `Simran Sandhu,simran@surreycandidate.ca,Councillor,Surrey,simran-sandhu-councillor`
- **Use case**: Congratulate a newly-nominated candidate (Mayor or Councillor) and invite them to
  claim their wall. `role` is required (fills the subject line), `wall_slug` is optional — if
  omitted, `fillCampaignTemplate` auto-generates one from name+role, but only when the role
  matches `/mayor|councillor|councilor/i`.

### 3d. Civic Parties

- **Subject**: `Candidate & Slate Outreach on Choseno — Free Civic Platform for {{city}} Elections`
- **CSV header**: `name,email,city,role,wall_slug`
- **Sample row**: `ABC Vancouver,info@abcvancouver.ca,Vancouver,Party Executive,abcvancouver`
- **Use case**: Reach party executives to onboard their whole candidate slate, not one individual.
- `wall_slug` here would point to the *party's* own wall if it has one, not a candidate's.

### 3e. Students Association (PSSA)

- **Subject**: `Opportunity for Students: Choseno is Recruiting Election Researchers for 2026`
- **CSV header**: `name,email,role`
- **Sample row**: `UBC Political Science Association,exec@pssa.ubc.ca,Executive Team`
- **Use case**: Recruit volunteer "Election Researcher" students via Political Science student unions. No `city`/`wall_slug` — this isn't a wall-claim pitch, it's a volunteer recruitment ask.

### 3f. Professor / Academic

- **Subject**: `Collaboration Inquiry: Civic Tech & Election Research`
- **CSV header**: `name,email,role`
- **Sample row**: `Dr. Paul Quirk,pquirk@ubc.ca,Professor of Political Science`
- **Use case**: Propose academic research collaboration (student researcher placements) with
  faculty. `role` is required here (e.g. their title) even though it's optional elsewhere.

## 4. `wall_slug` — the field most likely to break a send

- It's the Choseno wall URL slug (e.g. `brenda-locke-mayor` → `choseno.com/wall/brenda-locke-mayor`).
- **Never auto-guessed from a template** for Mayor/Councillor — must be supplied in the
  CSV/JSON or typed in by hand, because a slug that doesn't match a real profile **404s** when
  the recipient clicks it.
- For Candidate Nominee sends, an unsupplied slug *is* auto-generated via `buildPoliticianWallSlug`,
  but only when `role` matches mayor/councillor — still worth verifying rather than trusting blindly.
- **Safest path**: use "Search politicians & office holders" in the admin UI instead of typing a
  slug by hand — it looks up the real Choseno profile and fills the correct slug.
- The row editor shows a **live clickable preview link** (`choseno.com/wall/<slug>`) next to each
  recipient so you can verify it resolves before sending.
- If someone doesn't have a wall yet, create their office-holder/candidate stub first via
  `/admin/office-holders` or `/admin/elections` so a real slug exists to point to.

## 5. What happens automatically on send

Per recipient, `sendCampaignInvite` (`campaigns.ts`):
1. Mints a fresh `claim_token` (UUID) and builds the claim link:
   `{redirectOrigin}/auth?role=politician&campaign={token}`.
2. Substitutes `{{claim_link}}` in the HTML body with that link — the template **must** contain
   the literal placeholder, since the token is generated here, not by the caller, so the link
   emailed and the link logged to the DB never drift apart.
3. A tracking pixel is appended before `</body>` (`addTrackingPixelToTemplate`) for open tracking,
   and outbound links get rewritten through `createTrackedLink` for click tracking — see
   [CAMPAIGN_TRACKING_IMPLEMENTATION.md](CAMPAIGN_TRACKING_IMPLEMENTATION.md) for the tracking
   pipeline internals.
4. Sends via `sendEmail` → Supabase Edge Function `send-email` (or local SMTP route in dev).
5. Logs the attempt to `politician_claim_campaigns` regardless of outcome — `status: "sent"` or
   `"failed"` with `error_message` set. **Never throws** — a failure on one recipient doesn't stop
   the rest of a bulk send.

## 6. Merge tags available in the body

`{{name}}`, `{{first_name}}`, `{{role}}`, `{{city}}`, `{{wall_slug}}`, `{{wall_url}}` (the full
`https://www.choseno.com/wall/{{wall_slug}}` link), and `{{claim_link}}` (filled in at send time,
per §5). Legacy square-bracket tags (`[Name]`, `[City]`, etc.) are also supported for backward
compatibility with older template drafts.

## 7. Pulling a recipient CSV straight from the backend

Everything a campaign CSV needs — name, email, role, city, `wall_slug`, plus municipality
population — already lives in Choseno's own database. There's no admin-UI report for this yet
(the "Search politicians & office holders" add-one-at-a-time flow in §2 is the only UI path), so
today this means a direct SQL pull. The query below is exactly how the BC top-20-population
councillor CSV was generated.

### Where each field comes from

| CSV field | Source | Path |
|---|---|---|
| `name` | `office_holders.full_name` | direct column |
| `email` | `office_holders.contact_email` | direct column — **frequently NULL**, see caveat below |
| `role` | `election_role_types.role_title` | `office_holders.election_role_type_id → election_role_types.id`, filter `role_key = 'councillor'` or `'mayor'` |
| `city` | `map_shapes.name` | `office_holders.map_shape_id → map_shapes.id` |
| `wall_slug` | `politician_profiles.wall_slug` | `office_holders.linked_profile_id → politician_profiles.id` (nullable — see caveat) |
| `population` | `map_shapes.census_data->>'population_2021'` | same `map_shapes` row as `city`, jsonb field |

`map_shapes.census_data` is a StatCan 2021 Census Profile jsonb blob per shape — also has
`households`, `median_age`, `land_area_km2`, `population_density`, `median_household_income`,
`unemployment_rate`, and more, wherever StatCan published it for that shape. Filter to BC
municipalities with `boundary_type = 'Municipal'` and `properties->>'PRUID' = '59'` (StatCan's
province/territory code — BC is `59`; `properties` also carries `CSDUID`/`CSDTYPE` from the
census shapefile import).

### Reusable query — top-N BC municipalities by population, with current officeholders

```sql
WITH bc_topN AS (
  SELECT id,
         -- North Vancouver exists twice (District vs City) under the identical
         -- plain name -- disambiguate with CSDTYPE or city/role columns collide.
         CASE
           WHEN name = 'North Vancouver' AND properties->>'CSDTYPE' = 'DM' THEN 'North Vancouver (District)'
           WHEN name = 'North Vancouver' AND properties->>'CSDTYPE' = 'CY' THEN 'North Vancouver (City)'
           ELSE name
         END AS name,
         (census_data->>'population_2021')::numeric AS population,
         row_number() OVER (ORDER BY (census_data->>'population_2021')::numeric DESC) AS rank
  FROM map_shapes
  WHERE country = 'Canada' AND boundary_type = 'Municipal'
    AND properties->>'PRUID' = '59'          -- British Columbia
    AND retired_at IS NULL
    AND census_data->>'population_2021' IS NOT NULL
  ORDER BY (census_data->>'population_2021')::numeric DESC
  LIMIT 20                                    -- top-N, adjust as needed
)
SELECT
  oh.full_name AS name,
  oh.contact_email AS email,
  ert.role_title AS role,
  b.name AS city,
  pp.wall_slug,
  b.population::bigint AS population,
  b.rank AS city_population_rank
FROM bc_topN b
JOIN office_holders oh
  ON oh.map_shape_id = b.id AND oh.is_current = true
JOIN election_role_types ert
  ON ert.id = oh.election_role_type_id AND ert.role_key = 'councillor'   -- or 'mayor'
LEFT JOIN politician_profiles pp ON pp.id = oh.linked_profile_id
ORDER BY b.population DESC, oh.full_name;
```

Swap `role_key = 'councillor'` for `'mayor'` to pull mayors instead — same query otherwise.

### How to run it

Direct `psql` access: the project's DB password is in `.env.local`'s `# Database Password:` comment line, connection string
`postgresql://postgres@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres`. Export the CSV with
`\copy (...) TO STDOUT WITH CSV HEADER` or plain `psql -At -F','` if `\copy` isn't available in
your invocation mode.

### Known data gaps to check for every time, not just once

- **`email` is frequently NULL.** In the BC top-20-population councillor pull (Aug 2026), only
  76 of 154 current councillors (49%) had `contact_email` populated. Split the result into a
  "sendable" file (has email) and a "needs manual lookup" file (doesn't) — don't silently drop
  the ones missing an email, since that hides how incomplete the campaign coverage actually is.
- **`wall_slug` can be NULL** if `office_holders.linked_profile_id` was never set — that
  officeholder has no wall yet. In practice this resolves for effectively all *current* BC
  municipal officeholders because of the bulk politician-import stub batch, but don't assume it
  for other boundary types/countries without checking.
- **Duplicate plain names across shapes** (North Vancouver being the known one) will silently
  merge two different jurisdictions' officeholders into one `city` value unless disambiguated —
  check `SELECT name, count(*) FROM map_shapes WHERE ... GROUP BY name HAVING count(*) > 1` for
  your query's boundary set before trusting `city` at face value.
- **A shape can have zero `office_holders` rows at all** (not just missing email) — e.g. District
  of North Vancouver had no councillor records whatsoever as of this writing. That's a bulk-import
  gap, not a contact-detail gap, and needs an `/admin/office-holders` CSV import to fix, not a
  better SQL query.

## Related docs

- [OUTREACH_GUIDE.md](../OUTREACH_GUIDE.md) §4 — Mayor/Councillor HTML template copy, layout
  rationale, and the MIME/SMTP delivery fix history.
- [CAMPAIGN_TRACKING_IMPLEMENTATION.md](CAMPAIGN_TRACKING_IMPLEMENTATION.md) — open/click/wall-view
  tracking pipeline, `tracking_events` schema, engagement scoring.
- [ADMIN_FEATURES.md](ADMIN_FEATURES.md) — admin panel access control and route list.
- [SEND_INVITES_QUICKREF.md](../SEND_INVITES_QUICKREF.md) / [CAMPAIGN_AUTOMATION_SUMMARY.md](CAMPAIGN_AUTOMATION_SUMMARY.md)
  — the legacy CLI script (`scripts/send-politician-invites.ts`). Still functional and logs to the
  same table, but sends a separate generic template, **not** these six HTML designs — use
  `/admin/campaign` for anything in this doc.
