# Office Holders Feature — Implementation Guide

> **Claiming status (2026-08-11):** Auto-populated officeholder walls can be publicly displayed and an admin can manually link an `office_holders` row to a profile, but a safe officeholder claim/invite/merge/reversal flow is not implemented yet. Do not use the manual link as a substitute for a merge: it changes the reference only and does not move wall content or create recovery history. See [OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md](OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md) for the current flow, schema map, task list, and verification log.

## Overview

The Office Holders feature displays the current incumbent (MLA, MP, Mayor, etc.) for each electoral boundary on the seat detail page. This allows users to see who currently represents them before viewing candidates running for that seat.

---

## Architecture

### 1. **Service Layer** (`src/lib/services/elections.ts`)

**Functions:**
- `getOfficeHoldersForShape(mapShapeId)` — Get all office holders for a boundary
- `getOfficeHolderByRole(mapShapeId, electionRoleTypeId)` — Get a specific office holder by role
- `getOfficeHoldersByShapeAndRole(mapShapeId, roleTitle?)` — Get office holders by boundary and optional role title
- `upsertOfficeHolder(fields, updatedBy)` — Create or update an office holder record
- `removeOfficeHolder(officeHolderId)` — Delete an office holder

These functions handle all Supabase queries and always pass data through unchanged (`{ data, error }` pattern).

### 2. **Component Layer** (`src/components/features/CurrentOfficeHolderCard.tsx`)

**Props:**
```typescript
interface CurrentOfficeHolderCardProps {
  mapShapeId: number | string;      // Electoral boundary ID
  roleTitle?: string;                // Optional role title for filtering
  className?: string;                // Additional CSS classes
}
```

**Features:**
- Displays office holder's name, photo, and role
- Shows party affiliation with color coding
- Displays term dates (start and end)
- Shows contact information (email, phone, official page)
- Links to Choseno profile if the office holder is a registered user
- Responsive loading state with skeleton
- Returns null if no office holder exists (clean fallback)

**Design Theme:**
- Uses primary color accent (MapPin icon header)
- Gradient background (`from-primary/5 to-transparent`)
- Consistent with existing Card primitives
- Light and dark theme support via CSS variables

### 3. **Page Integration** (`src/components/features/ElectionSeatPageClient.tsx`)

The office holder card appears:
- **Position:** Immediately after the seat header and above candidate roster
- **Visibility:** Always displayed if data exists (no login required)
- **Context:** Clearly labeled as "Current Representative"

**Render Order:**
```
1. Header Card (Election title, boundary, date, candidate count)
2. Current Office Holder Card ← NEW
3. Candidate Roster
4. Right Sidebar (Sign-in prompt, apply buttons, admin panel)
```

---

## Database Schema Integration

### `office_holders` Table
```sql
id                      UUID PK
map_shape_id           BIGINT FK → map_shapes.id
election_role_type_id  UUID FK → election_role_types.id
full_name              TEXT
political_party_id     UUID FK → political_parties.id (nullable)
bio                    TEXT (nullable)
photo_url              TEXT (nullable)
source_url             TEXT (nullable) — Official government source
holding_since          DATE (nullable) — Legacy field
term_start             DATE (nullable)
term_end               DATE (nullable)
contact_email          TEXT (nullable)
contact_phone          TEXT (nullable)
linked_profile_id      UUID FK → profiles.id (nullable)
updated_by             UUID FK → profiles.id (nullable)
created_at             TIMESTAMPTZ
updated_at             TIMESTAMPTZ
```

### Key Relationships
```
map_shapes (boundaries)
  ↓ (via map_shape_id)
office_holders
  ↓ (via election_role_type_id)
election_role_types (MLA, MP, Mayor, etc.)

office_holders
  ↓ (via political_party_id)
political_parties (Liberal, Conservative, etc.)

office_holders
  ↓ (via linked_profile_id)
profiles (if office holder has a Choseno account)
```

---

## Admin Panel: Managing Office Holders

Located at `/admin/office-holders`, the **OfficeHoldersAdminClient** component provides:

1. **Search & Filter**
   - Select country → boundary type → search by name
   - Returns matching boundaries

2. **Add/Edit Officeholder**
   - Full name (required)
   - Political party dropdown
   - Short bio
   - Official source URL
   - Term start/end dates
   - Contact email and phone
   - Optional link to Choseno profile (searchable)

3. **Actions**
   - **Set officeholder** (for new roles without data)
   - **Edit** (update existing data)
   - **Remove** (delete record)

4. **Visual Feedback**
   - Shows current officeholder with party affiliation
   - Badge indicator if linked to Choseno profile
   - Status messages on save/delete

---

## Usage Flow for Admins

### Adding an MLA for BC Provincial Ridings

1. Navigate to `/admin/office-holders`
2. Select **Country:** "Canada"
3. Select **Boundary Type:** "Provincial" (or appropriate type)
4. Search for the riding (e.g., "Vancouver-Granville")
5. Click on the boundary
6. Find the "Member of Provincial Assembly" role
7. Click **"Set officeholder"**
8. Enter:
   - Full name (e.g., "John Smith")
   - Select party (e.g., "BC New Democrats")
   - Bio (optional): "Educator and community advocate"
   - Source URL: Link to official government page
   - Term start: Date elected
   - Email/phone (optional)
9. **Save**

### Linking to Choseno Account

If the officeholder joins Choseno as a user:
1. Open the officeholder record in admin panel
2. In the "Link registered profile" section, search for their name
3. Click to select their profile
4. Save
5. Result: Badge shows "On Choseno" + "View Profile" button appears on public card

---

## Data Population Strategy

### Option A: Manual Admin Entry
- **Effort:** Medium (one by one)
- **Accuracy:** High (admin verified)
- **Best for:** Small jurisdictions or gradual rollout

### Option B: Bulk Import via CSV/RPC
- **Effort:** Low (one-time setup)
- **Accuracy:** Medium (depends on data source)
- **Best for:** Large rollout (all provinces/territories)
- **Process:**
  1. Export officeholder data from government sources
  2. Create import script to parse CSV → office_holders rows
  3. Run via Supabase SQL or Node.js script
  4. Verify via admin panel

### Option C: Automated Sync
- **Effort:** High (initial setup)
- **Accuracy:** High (always current)
- **Best for:** Future state
- **Process:**
  1. Schedule cron job to sync from government APIs
  2. Update office_holders records nightly
  3. Alert admins on changes

---

## UI/UX Notes

### Visual Hierarchy
- **Primary focus:** Current representative card
- **Secondary focus:** Candidate roster below
- **Context:** "Current Representative" label makes role clear

### Responsive Behavior
- **Desktop:** Card sits naturally above candidates
- **Mobile:** Maintains readability, stacks vertically
- **Tablet:** Adapts with grace

### Accessibility
- All text is readable (sufficient contrast via CSS variables)
- Icons have title attributes
- Links are keyboard-navigable
- Loading state uses semantic HTML

### Empty States
- If no office holder exists: Card returns `null` (no clutter)
- If data is loading: Skeleton placeholder shown
- If error occurs: Silently fails (doesn't break page)

---

## Query Performance

### Optimized Queries
```sql
-- Get office holder for a specific seat
SELECT * FROM office_holders
WHERE map_shape_id = $1 AND election_role_types.role_title = $2
INNER JOIN election_role_types ...
INNER JOIN political_parties ...
LEFT JOIN profiles ...
```

**Indexes hit:**
- `office_holders.map_shape_id` (FK index)
- `election_role_types.role_title` (lookup)
- `political_parties.id` (FK index)

**Expected latency:** <50ms for typical queries

---

## Future Enhancements

1. **Show on Boundary Pages**
   - Display office holder on `/boundaries/[boundaryId]` page
   - More context about jurisdiction

2. **Incumbent Badge on Candidate Cards**
   - If a candidate is running against an incumbent, show "Incumbent" label
   - Visual distinction for voters

3. **Term History**
   - Show previous officeholders and their tenure
   - "Timeline" view of jurisdiction leadership

4. **Contact Directory**
   - Public-facing directory of all officeholders by province/municipality
   - Searchable, with contact info

5. **Integration with Elections**
   - Auto-create officeholder record when candidate wins
   - Automatic status updates post-election

6. **Import Integrations**
   - Elections Canada API integration (federal MP data)
   - Provincial legislature APIs
   - Municipal government portals

---

## Testing Checklist

- [ ] Add test office holder via admin panel
- [ ] Verify card appears on election seat page
- [ ] Test with no office holder (should return null)
- [ ] Test with office holder linked to Choseno profile
- [ ] Test party color display
- [ ] Test contact links (email, phone, website)
- [ ] Test responsive layout (mobile/tablet/desktop)
- [ ] Test dark mode rendering
- [ ] Test edit/delete operations in admin panel
- [ ] Verify service layer error handling

---

## Troubleshooting

### Card Not Appearing

**Check:**
1. Is `map_shape_id` being passed from seat object?
   ```typescript
   console.log(seat.map_shape_id); // Should be a number
   ```
2. Is office holder record created for that boundary?
   ```sql
   SELECT * FROM office_holders WHERE map_shape_id = $1;
   ```
3. Are relationships properly expanded in query?
   ```typescript
   // Political parties should be nested
   console.log(holder.political_parties?.name);
   ```

### Missing Party Color

**Check:**
- Political party record exists
- `color_hex` column is populated
- Query includes `political_parties(name, color_hex)`

### Loading Spinner Stuck

**Check:**
- Supabase authentication active
- RLS policies allow read on office_holders table
- Network tab shows successful request

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/services/elections.ts` | Added/enhanced office holder service functions |
| `src/components/features/CurrentOfficeHolderCard.tsx` | New component for displaying office holder |
| `src/components/features/ElectionSeatPageClient.tsx` | Integrated office holder card into seat page |

---

## Related Documentation

- [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) — office_holders table schema
- [SCHEMA_RELATIONSHIPS.md](SCHEMA_RELATIONSHIPS.md) — Entity relationships
- [CODE_LAYERS.md](../docs/CODE_LAYERS.md) — Architecture overview
