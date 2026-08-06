# Office Holders Implementation — Complete Guide

**Status**: ✅ Feature Complete & Ready for Data Population  
**Date**: August 6, 2025

---

## 🎯 What Was Implemented

### 1. Service Layer (`src/lib/services/elections.ts`)

**New Functions:**
- `getOfficeHoldersForShape(mapShapeId)` — Query all office holders for a boundary
- `getOfficeHolderByRole(mapShapeId, electionRoleTypeId)` — Get specific officeholder by role
- `getOfficeHoldersByShapeAndRole(mapShapeId, roleTitle?)` — Main public function with role title filtering
- `upsertOfficeHolder()` — Create/update office holder (already existed)
- `removeOfficeHolder()` — Delete office holder (already existed)

**Updated Functions:**
- `getSeatById()` — Now includes `map_shape_id` field needed for office holder lookups

### 2. Component Layer (`src/components/features/CurrentOfficeHolderCard.tsx`)

**Features:**
- ✅ Displays current officeholder prominently above candidates
- ✅ Shows name, photo, party affiliation with color coding
- ✅ Displays term dates (start/end)
- ✅ Shows contact info (email, phone, official page)
- ✅ Links to Choseno profile if registered user
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Dark mode support
- ✅ Loading skeleton state
- ✅ Graceful null handling (no officeholder = invisible)

### 3. Page Integration (`src/components/features/ElectionSeatPageClient.tsx`)

**Location:** Top of main content, right after seat header, above candidate roster

**Visibility:** Always rendered if office holder exists (no login required)

**Visual Hierarchy:**
```
1. Seat Header (Title, Boundary, Date, Candidate Count)
2. CURRENT REPRESENTATIVE CARD ← NEW FEATURE
3. Candidate Roster
4. Right Sidebar (Sign-in, Apply buttons, Admin panel)
```

### 4. Data Import Tools (`scripts/`)

**Files Created:**
- `office-holders-template.csv` — Empty template with headers
- `office-holders-sample.csv` — Example data for reference
- `import-office-holders.ts` — TypeScript import script
- `IMPORT_GUIDE.md` — Complete setup and troubleshooting guide
- `README.md` — Quick start and process overview

**Features:**
- ✅ CSV-based import (easy to manage and version control)
- ✅ Validation of all relationships
- ✅ UPSERT logic (updates existing, inserts new)
- ✅ Detailed error reporting
- ✅ Progress tracking
- ✅ Support for custom file paths

### 5. npm Scripts

Added convenience scripts to `package.json`:
```bash
npm run import:office-holders              # Default CSV path
npm run import:office-holders:custom <path> # Custom path
```

---

## 🏗️ Architecture Overview

### Layered Design

```
┌─────────────────────────────────────────┐
│  Page Layer                             │
│  ElectionSeatPageClient.tsx             │
│  - Orchestrates page composition       │
│  - Passes props to components           │
└────────┬────────────────────────────────┘
         │ calls
┌────────v────────────────────────────────┐
│  Component Layer                        │
│  CurrentOfficeHolderCard.tsx            │
│  - Handles loading state               │
│  - Formats display data                 │
│  - Manages responsiveness              │
└────────┬────────────────────────────────┘
         │ calls
┌────────v────────────────────────────────┐
│  Service Layer                          │
│  src/lib/services/elections.ts          │
│  - getOfficeHoldersByShapeAndRole()    │
│  - All Supabase queries                │
│  - { data, error } return pattern      │
└────────┬────────────────────────────────┘
         │ calls
┌────────v────────────────────────────────┐
│  Supabase Database                      │
│  office_holders table                   │
│  ↓ relationships ↓                      │
│  - map_shapes (boundaries)             │
│  - election_role_types (roles)         │
│  - political_parties (party color)     │
│  - profiles (linked users)             │
└─────────────────────────────────────────┘
```

### Database Schema

```sql
office_holders
├── id (UUID PK)
├── map_shape_id (FK → map_shapes.id)
├── election_role_type_id (FK → election_role_types.id)
├── full_name (TEXT)
├── political_party_id (FK → political_parties.id)
├── bio (TEXT, nullable)
├── photo_url (TEXT, nullable)
├── contact_email (TEXT, nullable)
├── contact_phone (TEXT, nullable)
├── term_start (DATE, nullable)
├── term_end (DATE, nullable)
├── source_url (TEXT, nullable)
├── linked_profile_id (FK → profiles.id, nullable)
├── updated_by (FK → profiles.id, nullable)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

---

## 📊 Data Population Strategy

### Phase 1: Setup & Validation (Complete)
- ✅ Service layer implemented
- ✅ Component created
- ✅ Integration done
- ✅ Import tools created
- ⏳ Data being researched

### Phase 2: Data Population (In Progress)

**Scope:**
- Canada: Federal MPs + Provincial (BC, ON, AB, QC)
- United States: Federal (Senate + House) + State Governors

**Status:** Research agent gathering data (background)

### Phase 3: Deployment (Ready)
- CSV import script ready
- Validation checks in place
- Error handling configured

---

## 🚀 Getting Started

### Prerequisites

1. **Supabase Setup**
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-key"
   ```

2. **Verify Tables Exist**
   ```sql
   -- Check these tables have data:
   SELECT COUNT(*) FROM map_shapes;        -- Should have thousands
   SELECT COUNT(*) FROM election_role_types; -- Should have 5+ types
   SELECT COUNT(*) FROM political_parties;   -- Should have 10+ parties
   ```

3. **Prepare Data**
   - See `scripts/IMPORT_GUIDE.md` for detailed instructions
   - Use `scripts/office-holders-sample.csv` as template
   - Create `scripts/office-holders-data.csv` with actual data

### Quick Import

```bash
# 1. Navigate to project root
cd /Users/vmn2k4/Coding/Choseno

# 2. Prepare CSV (research + format data)
# Place at scripts/office-holders-data.csv

# 3. Verify environment variables
echo $SUPABASE_URL $SUPABASE_SERVICE_ROLE_KEY

# 4. Run import
npm run import:office-holders

# 5. Check results
npm run import:office-holders  # Will see summary with ✅ and ❌ counts
```

---

## 🔍 Verification

After import, verify data appears on public site:

1. **Go to election seat page:**
   ```
   http://localhost:3000/elections/seat/[any-seat-id]
   ```

2. **Look for "Current Representative" card**
   - Should appear above candidate roster
   - Shows name, party, term dates, contact info
   - Links to profile if registered user

3. **Check database:**
   ```sql
   SELECT COUNT(*) FROM office_holders;
   SELECT oh.full_name, pp.name, ms.name
   FROM office_holders oh
   JOIN political_parties pp ON oh.political_party_id = pp.id
   JOIN map_shapes ms ON oh.map_shape_id = ms.id
   LIMIT 5;
   ```

---

## 📁 File Structure

```
src/
├── components/features/
│   └── CurrentOfficeHolderCard.tsx         (NEW)
├── lib/services/
│   └── elections.ts                        (UPDATED)
└── app/elections/seat/[seatId]/
    └── page.tsx                            (UPDATED via client component)

scripts/
├── README.md                               (NEW - Quick start)
├── IMPORT_GUIDE.md                         (NEW - Detailed guide)
├── office-holders-template.csv             (NEW - Empty template)
├── office-holders-sample.csv               (NEW - Examples)
├── import-office-holders.ts                (NEW - Import script)
└── office-holders-data.csv                 (CREATE THIS - Your data)

docs/
├── OFFICE_HOLDERS_FEATURE.md               (NEW - Architecture)
└── OFFICE_HOLDERS_IMPLEMENTATION.md        (THIS FILE)

package.json
└── scripts section                         (UPDATED with import tasks)
```

---

## 🎨 Design Notes

### Visual Design
- **Color scheme**: Uses primary theme color for headers
- **Gradient background**: Subtle `from-primary/5 to-transparent`
- **Icons**: MapPin icon for "Current Representative" label
- **Typography**: Consistent with Choseno design system
- **Spacing**: Matches Card padding standards

### Responsive Behavior
- **Desktop**: Normal width, stacks cleanly with candidates below
- **Tablet**: Adjusts to available space
- **Mobile**: Full width, readable contact info

### Accessibility
- ✅ All text readable (sufficient contrast)
- ✅ Icons have title attributes
- ✅ Links keyboard-navigable
- ✅ Semantic HTML structure
- ✅ Loading state uses accessible spinner

### Performance
- ✅ Single query per load (no N+1)
- ✅ Returns null if no data (no render overhead)
- ✅ Efficient relationship expansion
- ✅ ~50ms query latency expected

---

## 🔄 Future Enhancements

1. **Incumbent Badge on Candidates**
   - Show "Incumbent" label if candidate is current officeholder
   - Visual distinction for voters

2. **Historical Timeline**
   - Show previous officeholders and their tenure
   - "Timeline" view of jurisdiction leadership

3. **Public Directory**
   - Searchable directory of all officeholders by region
   - Contact aggregation page

4. **Auto-Updates**
   - Election night: Auto-create new officeholder records for winners
   - Monthly sync: Updates existing records with government APIs

5. **Integrations**
   - Elections Canada API
   - State legislature APIs
   - Congress.gov integration

---

## 🧪 Testing Checklist

- [ ] Add test office holder via admin panel
- [ ] Verify card appears above candidates
- [ ] Test with no office holder (should return null)
- [ ] Test with officeholder linked to Choseno profile
- [ ] Test party color display
- [ ] Test contact links (email, phone, website)
- [ ] Test responsive layout (mobile/tablet/desktop)
- [ ] Test dark mode rendering
- [ ] Test edit/delete in admin panel
- [ ] Test import script error handling
- [ ] Verify service layer returns complete data

---

## 🐛 Troubleshooting

### Card Not Appearing
1. Check `map_shape_id` is passed correctly: `console.log(seat.map_shape_id)`
2. Verify officeholder exists: `SELECT * FROM office_holders WHERE map_shape_id = X`
3. Check relationships are expanded: Look for nested `election_role_types` and `political_parties`

### Import Script Errors
1. See `scripts/IMPORT_GUIDE.md` detailed troubleshooting
2. Common issues:
   - `map_shape_id not found` → Verify boundary exists
   - `role not found` → Ensure election_role_types record exists
   - `party not found` → Check political_parties table
   - `AUTH error` → Verify SUPABASE_SERVICE_ROLE_KEY (not public key)

### Performance Issues
1. Check Supabase network tab for slow requests
2. Verify database indexes on FK columns
3. Consider caching political_parties lookups during bulk import

---

## 📚 Related Documentation

- [OFFICE_HOLDERS_FEATURE.md](OFFICE_HOLDERS_FEATURE.md) — Feature overview & admin guide
- [scripts/README.md](../scripts/README.md) — Quick start & data sources
- [scripts/IMPORT_GUIDE.md](../scripts/IMPORT_GUIDE.md) — Setup & troubleshooting
- [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) — Database schema reference
- [CODE_LAYERS.md](CODE_LAYERS.md) — Architecture guidelines

---

## ✅ Checklist Before Going Live

- [ ] All prerequisite tables verified (election_role_types, political_parties)
- [ ] Sample data imported and tested
- [ ] Office holder card displays correctly
- [ ] Contact links work
- [ ] Profile links work (if linked)
- [ ] Admin panel can create/edit/delete
- [ ] Dark mode rendering verified
- [ ] Mobile responsive confirmed
- [ ] Error handling tested (no officeholder case)
- [ ] Performance acceptable (<100ms page load impact)

---

## 📞 Support

For detailed instructions:
1. **Quick Start**: See `scripts/README.md`
2. **Setup Guide**: See `scripts/IMPORT_GUIDE.md`
3. **Data Format**: See `scripts/office-holders-sample.csv`
4. **Feature Overview**: See `docs/OFFICE_HOLDERS_FEATURE.md`

For implementation questions, refer to this document.

---

**Implementation Date**: August 6, 2025  
**Status**: ✅ Complete & Ready for Data Population  
**Data Status**: ⏳ Researching current officeholders (background agent)  
**Next Step**: Create office-holders-data.csv with research results and run import
