# Admin Features & Dashboard

Comprehensive administrative tools for managing boundaries, elections, content, and analytics.

---

## Overview

**Admin panel** (`/admin/*`) is gated to `profiles.role='admin'`. Seven separate top-level routes provide different functionality:

1. **Boundaries** — Geospatial data management
2. **Analytics** — Traffic, user signup, engagement metrics
3. **Elections** — Create/update/close elections and manage candidates
4. **Election Admins** — Approve/manage volunteer seat administrators
5. **Visualizer** — Interactive boundary map (preview/debug)
6. **Theme** — Site colors, logos, branding
7. **News** — Article authoring & lifecycle
8. **Moderation** — Content flags, hidden posts, audit log
9. **Office Holders** — Manage elected officials

---

## Boundaries (`/admin`)

**Foundation of the platform** — everything else depends on accurate boundaries.

### Sub-sections

#### Countries
- **Add**: Country name, ISO code, flag emoji
- **Edit**: Name, code (fields rarely change post-creation)
- **List**: All countries with boundary type count

#### Boundary Types
- **Add**: Type name (e.g., "Federal", "Provincial"), country, rank (1 = broadest)
- **Edit**: Name, rank, admin-only flag, is-container flag (see adding-boundary-data.md)
- **List**: Per-country, with upload/shape counts

#### Political Parties
- **Add**: Party name, country, optional color (hex)
- **Edit**: Name, color
- **List**: Per-country searchable

#### Upload Boundaries
- **Upload form**:
  - File picker (GeoJSON or zipped shapefile)
  - Country dropdown
  - Boundary type dropdown
  - Name field (which attribute is the shape name)
  - Code field (unique ID per shape)
  - Advanced: Vertex cutoff, field selection (drop problematic numeric fields)
- **Analyze-first**: Client-side parse, vertex histogram, warnings for oversized shapes
- **Progress tracking**: Live bar as shapes insert, resumable if interrupted

#### Uploaded Boundaries
- **Live list**: Recent uploads, per-shape delete

#### Upload Batches (`BoundaryUploadsPanel`)
- **Active/retired batches**: Collapsible rows showing shape counts, progress
- **Actions**: Rename, search, resume incomplete, delete batch, link to Redistricting

#### Redistricting (`RedistrictingPanel`)
- **Retire boundaries**: When a new riding map takes effect, retire old ones
- **Selection**: Map-based picker, or bulk-select by type
- **Preview**: How many users lose coverage if you retire this
- **Soft/hard delete**: Soft keeps history; hard is blocked if anything references it

---

## Analytics (`/admin/analytics`)

**GA4 integration** — traffic, user behavior, engagement metrics.

### Dashboards (if implemented)

| Dashboard | Metric | Update Freq |
|---|---|---|
| Daily Users | Unique daily active users | Daily |
| Sessions | Session count + avg duration | Daily |
| User Signups | New registrations per day | Daily |
| Geography | Traffic by country/region | Daily |
| Engagement | Posts, comments, ratings per day | Daily |
| Politician Ratings | Avg rating changes, support trends | On demand |

### Real Data Flow

```
GA4 sends events → Google Analytics API → /api/admin/ga4/route.ts
  ↓ (Server-side fetch + cache)
  ↓ JSON response to frontend
AdminAnalyticsClient renders charts (e.g., line chart of daily users)
```

**Backend route** (`src/app/api/admin/ga4/route.ts`):
- Authenticates with GA4 API key
- Queries GA4 for date range + metrics
- Returns `{ data: [...], cached_at, cache_ttl }`

**Frontend** (`GoogleAnalyticsAdminClient`):
- Renders chart library (e.g., Recharts line/bar charts)
- Shows metric cards (key stats)
- Date range picker (last 7 days, 30 days, custom)

---

## Elections (`/admin/elections`)

**Create and manage elections** — the core workflow for getting candidates on the platform.

### List Elections
- **Columns**: Boundary, role, election date, seat count, candidate count, status
- **Status badge**: `draft` (admin still building it) → `nominations_open` → `nominations_closed`
  → `active` (voting day) → `closed`. Only `draft → nominations_open` and `→ closed` are manual
  clicks ("Open Nominations" / "Close Election"); the three date-driven stages between them
  advance on their own once the election's nomination-close date / election date pass — see
  [ARCHITECTURE.md's 2026-08-21 entry](../ARCHITECTURE.md).
- **Actions**: Edit dates, advance status (only shows the one valid next manual step), close
  election, delete election

### Create Election
- **Form**:
  - Name
  - Nomination open date, nomination close date, election day (in that order; validated
    open ≤ close ≤ election day)
  - Boundary/seats and the questionnaire are configured separately, after creation, from the
    election's own detail view (see Manage Seats / Seat Detail below)
- **On submit**: Create `elections` row (`status='draft'`)

### Edit Election
- **Editable fields**: all three dates ("Edit Dates" — re-validates and immediately
  re-evaluates which stage the election should be in)
- **Pre-filled**: current dates

### Manage Seats for Election
- **Table**: Boundary name, seat ID, candidate count, status
- **Per-seat actions**: create, delete

### Seat Detail
- **Info**: Boundary, role, nomination dates, questionnaire (each question can carry its own
  video, played to candidates before they answer, plus a per-question max video-answer length)
- **Candidates list**: Name, party, status (nominated/approved/rejected), support count, "has a
  video interview answer" indicator
- **Actions per candidate**:
  - Approve/reject nomination
  - **Search & Send Interview Invite** — search anyone on Choseno, stub if needed, send a
    claim-invite email in one step (faster alternative to Add Candidate Directly + Invite to
    Claim as two separate steps, which both still work too)
  - **Remove candidate** (Manage Candidates) — available to a site admin or this seat's approved
    election administrator on *any* candidate, registered or stub, self-added or not; this is
    the roster-management tool once nominations have closed and self-nomination is no longer
    possible
  - View campaign page (includes the candidate's video interview answers and "Play Interview"
    reel)

---

## Election Admins (`/admin/election-admins`)

**Approve volunteer seat administrators** who want to manage a specific election/seat.

### Pending Applications
- **Table**: Applicant name, seat, status (pending/approved/rejected), applied date
- **Detail panel**: Motivation, social media, contact email
- **Actions**: Approve (gives admin privileges for this seat), Reject, Message

### Approved Election Admins
- **List**: Name, seats managed, joined date
- **Actions**: Revoke access, message

---

## Visualizer (`/admin/visualize`, also `/admin/boundaries/visualize`)

**Interactive map showing loaded boundaries** — useful for:
- Previewing boundary uploads before committing
- Debugging why a location doesn't map to a boundary
- Spot-checking geometry (overlaps, gaps, distortions)

### Features
- **Map canvas**: Mapbox/Leaflet base
- **Boundary layers**: Toggle each boundary type on/off
- **Click to inspect**: Click a shape → show name, code, feature count, vertex count
- **Search**: Enter lat/lng or boundary name → zoom & highlight
- **Comparison mode**: Load two boundary sets side-by-side (useful for redistricting)

---

## Theme (`/admin/theme`)

**Branding & site appearance** — colors, logos, typography.

### Customizable Fields
- **Logo**: Upload image or text (used in nav bar)
- **Favicon**: Small icon
- **Colors**:
  - Primary (buttons, links)
  - Accent (highlights)
  - Neutral palette (grays)
- **Typography**: Font choice (system default, or pick Google Font)
- **Campaign hero images**: Featured imagery for home page

### Live Preview
- Shows how site looks with new colors before saving

---

## News (`/admin/news`)

**Covered in detail in NEWS_TAGGING.md**

Quick recap:
- Create/edit articles (headline, slug, body, hero image, category, tags)
- Status workflow: Draft → Scheduled → Published
- Scheduled articles auto-publish when date passes
- Link to politicians/parties (see NEWS_TAGGING.md)

---

## Moderation (`/admin/moderation`)

**Covered in detail in COMMENTS_AND_MODERATION.md**

Quick recap:
- **Pending flags**: Review user reports (spam, harassment, misinformation, etc.)
- **Detail panel**: View flagged content, add admin notes, approve/dismiss/hide
- **Hidden content log**: Audit trail of moderation actions
- **User search**: Jump to profile to see all their content

---

## Office Holders (`/admin/office-holders`)

**Manage politicians** — create, edit, update contact info, link to walls.

### List Office Holders
- **Filters**: Country, boundary type, role, party
- **Columns**: Name, boundary, role, party, contact email, phone
- **Actions**: Edit, view wall, delete

### Edit Office Holder
- **Editable fields**: Full name, contact email, phone, bio, photo URL, party
- **Linked profile**: Shows linked Ghost ID / wall URL (if exists)

### Bulk Import
- **CSV upload**: See OFFICE_HOLDERS_DATA_GUIDE.md
- **Auto-creates** politician walls if missing

### Create Stub Candidate
- (Alternative to CSV import)
- **Form**: Name, party, role, boundary
- **Result**: Creates unclaimed candidacy stub (election admin can claim later)

---

## Admin Access Control

### Who Can Access?

**Only users with**:
```sql
SELECT role FROM profiles WHERE id = auth.uid() AND role = 'admin'
```

### RLS on Admin Tables

**Example** — Only admins see office_holders:
```sql
CREATE POLICY "admins_see_office_holders" ON office_holders
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
```

### Page-Level Gating

```tsx
// src/app/admin/page.tsx
if (profile?.role !== 'admin') {
  return redirect('/feed');
}
```

---

## Admin Navigation

**Admin sub-nav** (`AdminSubNav`):
```
[Boundaries] [Analytics] [Elections] [Election Admins] [Visualizer] [Theme] [News]
```

Each link is its own top-level route (not tabs of one page).

---

## Related Files

| Page | Component | Purpose |
|---|---|---|
| `/admin` | [`AdminPageClient.tsx`](../src/components/features/AdminPageClient.tsx) | Boundaries overview |
| `/admin/analytics` | [`AnalyticsAdminClient.tsx`](../src/components/features/AnalyticsAdminClient.tsx) | GA4 dashboards |
| `/admin/elections` | [`ElectionsAdminClient.tsx`](../src/components/features/ElectionsAdminClient.tsx) | Election management |
| `/admin/election-admins` | [`ElectionAdminApplicationsClient.tsx`](../src/components/features/ElectionAdminApplicationsClient.tsx) | Approve volunteers |
| `/admin/visualize` | [`BoundaryVisualizerClient.tsx`](../src/components/features/BoundaryVisualizerClient.tsx) | Map preview |
| `/admin/theme` | [`ThemeAdminClient.tsx`](../src/components/features/ThemeAdminClient.tsx) | Branding |
| `/admin/news` | [`AdminNewsPageClient.tsx`](../src/components/features/AdminNewsPageClient.tsx) | Article editor |
| `/admin/moderation` | [`ModerationPageClient.tsx`](../src/components/features/ModerationPageClient.tsx) | Content review |
| `/admin/office-holders` | [`OfficeHoldersAdminClient.tsx`](../src/components/features/OfficeHoldersAdminClient.tsx) | Politician management |

---

## Audit & Logging

**Admin actions logged**:
- Boundary uploads (BoundaryUpload table tracks batch + completion)
- Hidden content (hidden_content_log table)
- Election admin approvals (tracked in election_admins table)
- Theme changes (in site_settings or audit_log if added)

---

## Future Enhancements

- [ ] **Bulk actions**: Select multiple elections/candidates, close/archive in one go
- [ ] **Audit log**: All admin actions (login, edit, delete) timestamped
- [ ] **Admin messaging**: Send notifications to election admins, politicians
- [ ] **Backup/restore**: Export election data, restore from backup
- [ ] **Analytics export**: Download reports as CSV/PDF
- [ ] **Multi-language**: Translate site content per boundary
