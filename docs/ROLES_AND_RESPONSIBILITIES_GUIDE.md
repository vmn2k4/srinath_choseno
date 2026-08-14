# Roles & Responsibilities System & Ingestion Guide

## Overview

The `election_role_types` table is Choseno's central catalog of elected offices and their jurisdictional powers across Canada, the United States, and India.

It powers:
1. **Chain of Representation Org Chart** on `/elections/[boundarySlug]` and `/find-my-district` (`RepresentationBranchTree.tsx`).
2. **Interactive Role Tooltips** that display "why this role matters" on badge hover without cluttering the cards.
3. **Roles & Responsibilities Reference Section** on directory pages, dynamically filtered to the active district's jurisdiction (e.g., showing BC-specific MLA/School Trustee/Mayor responsibilities for BC ridings, while cleanly excluding out-of-province titles like Quebec's MNA or Ontario's MPP).

---

## Database Schema (`election_role_types`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key (`gen_random_uuid()`) |
| `country` | TEXT | Country name (e.g., `'Canada'`, `'USA'`, `'India'`) |
| `boundary_type` | TEXT | Foreign key to `country_boundary_types(country, type_name)` (e.g., `'Federal'`, `'Provincial'`, `'Province'`, `'Municipal'`, `'School District'`, `'National'`) |
| `role_key` | TEXT | Semantic key grouping equivalent roles (e.g., `'mp'`, `'provincial_rep'`, `'premier'`, `'mayor'`, `'councillor'`, `'trustee'`, `'board_chair'`) |
| `region_override` | TEXT | Province/State name for localized variations (e.g., `'British Columbia'`, `'Ontario'`, `'Quebec'`, `'Alberta'`), or `''` (empty string) for national defaults |
| `role_title` | TEXT | Public title (e.g., `'MP'`, `'MLA'`, `'MPP'`, `'MNA'`, `'MHA'`, `'School Trustee'`, `'Board Chair'`, `'Mayor'`, `'Councillor'`) |
| `description` | TEXT | Detailed, plain-language description of legislative powers, key ministries, statutes, and constituent services |

**Constraint**: `UNIQUE(country, boundary_type, role_key, region_override)`

---

## Mandatory Rules When Adding New Roles or Boundary Types

Whenever you introduce a new boundary type or ingest new elected officials (e.g., School Trustees, County Commissioners, Regional Chairs, Panchayats):

### 1. Never Insert Roles with a `NULL` Description
Every office holder in Choseno is meant to educate voters on what their elected representatives actually decide. A role without a description leaves the hover tooltip empty and weakens the civic directory.

### 2. Add Region-Specific Overrides for Roles with Varying Provincial/State Powers
In federal systems, provincial/state legislation and titles differ significantly:
- **Provincial Representatives**: Use `region_override='Ontario'` for `MPP`, `region_override='Quebec'` for `MNA`, `region_override='Newfoundland and Labrador'` for `MHA`, and `region_override='British Columbia'` / `region_override='Alberta'` for `MLA`.
- **School Governance**: Include province-specific acts (e.g., *BC School Act* vs. *Ontario Education Act* vs. *Alberta Education Act*).
- **Municipal Governance**: Include provincial charters (e.g., BC *Community Charter* vs. Ontario *Municipal Act* / *Strong Mayor Powers*).

### 3. Register Executive Head Roles in `HEAD_ROLE_TITLES`
If the new role represents the top office of a tree branch (e.g., `Board Chair`, `Mayor`, `Premier`, `Governor`, `Chief Minister`, `Prime Minister`, `President`):
- Add the title to `HEAD_ROLE_TITLES` in both:
  - `src/components/features/RepresentationBranchTree.tsx`
  - `src/app/elections/[boundarySlug]/page.tsx`
  - `src/components/features/FindMyDistrictClient.tsx`
This ensures the visual tree places the executive head as the `top` node and the representatives as `bottom` sibling cards.

### 4. Create Linked Ghost Profiles & Politician Walls
As documented in [adding-boundary-data.md](adding-boundary-data.md):
- When populating `office_holders`, always create matching records in `profiles` (`role='politician'`, `current_ghost_id=gen_random_uuid()`) and `politician_profiles` (`wall_slug=slugify(...)`) so the `"View Wall ->"` action routes seamlessly to `/wall/<slug>`.

---

## SQL Migration Pattern for Adding/Updating Roles

```sql
INSERT INTO public.election_role_types (country, boundary_type, role_key, region_override, role_title, description)
VALUES
  ('Canada', 'School District', 'trustee', 'British Columbia', 'School Trustee',
   'Elected member of the local Board of Education governing a BC School District under the BC School Act. Sets the district''s multi-million dollar annual operating budget, establishes local educational and student-welfare policies, plans capital projects and school expansions/renovations, allocates funding across neighborhood schools, and hires and supervises the Superintendent of Schools.')
ON CONFLICT (country, boundary_type, role_key, region_override)
DO UPDATE SET
  role_title = EXCLUDED.role_title,
  description = EXCLUDED.description;
```

---

## Frontend Resolution Logic

When rendering a boundary page (`src/app/elections/[boundarySlug]/page.tsx`):
1. The page detects the current province from container relationships (`shape_containers` -> `boundary_type = 'Province'`).
2. The page extracts active role titles from the rendered tree nodes (`branches.top`, `branches.bottom`) and active candidate seats (`seatRows`).
3. For each active role, it queries `election_role_types` and resolves the description in order of priority:
   1. `region_override === currentProvince` (Exact regional match)
   2. `region_override === ''` (Clean national default)
   3. Extracted node description from joined office holder record
4. Irrelevant out-of-province roles are automatically excluded from the directory display.
