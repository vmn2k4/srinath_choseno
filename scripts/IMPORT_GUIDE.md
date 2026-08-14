# Office Holders Data Import Guide

## Overview

This guide explains how to populate the `office_holders` table with current elected officials (MPs, MLAs, Senators, House members, governors).

---

## Prerequisites

1. **Supabase Access**
   - You need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables set
   - Service role key has full access to insert/update data

2. **Data Requirements**
   - Valid boundary IDs from `map_shapes` table
   - Valid role titles in `election_role_types` for the country/boundary_type
   - Valid party names in `political_parties` table

3. **Tools**
   - Node.js/TypeScript installed
   - CSV data file with office holders

---

## Step 1: Verify Election Role Types Exist

Before importing, ensure all role types are registered in `election_role_types`:

```sql
-- Check existing role types for Canada
SELECT country, boundary_type, role_key, region_override, role_title, description 
FROM election_role_types 
WHERE country = 'Canada'
ORDER BY boundary_type, role_title;

-- Check existing role types for US
SELECT country, boundary_type, role_key, region_override, role_title, description 
FROM election_role_types 
WHERE country = 'USA'
ORDER BY boundary_type, role_title;
```

**Required role types:**
- Canada Federal: `MP` (Federal), `Prime Minister` (National)
- Canada Provincial: `MLA` (BC/AB/Default), `MPP` (Ontario), `MNA` (Quebec), `MHA` (Newfoundland and Labrador), `Premier` (Province)
- Canada Municipal: `Mayor`, `Councillor` (with province-specific overrides where appropriate)
- Canada School Districts: `School Trustee`, `Board Chair` (with province-specific overrides where appropriate)
- US Federal: `U.S. Representative` (Federal), `President` (National)
- US State: `U.S. Senator` (State), `Governor` (State), `State Senator` (State Senate), `State Representative` (State House)
- US Municipal: `Mayor`, `Council Member`
- India: `Prime Minister` (National), `Chief Minister` (State), `MP` (Lok Sabha), `MLA` (Vidhan Sabha), `Corporator / Councillor` (Ward)

If missing or adding new roles/jurisdictions, you must create them with comprehensive descriptions and region overrides:

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

> **Important**: See [ROLES_AND_RESPONSIBILITIES_GUIDE.md](../docs/ROLES_AND_RESPONSIBILITIES_GUIDE.md) for full details on registering roles, province/state overrides, and tree hierarchy placement (`HEAD_ROLE_TITLES`).


---

## Step 2: Verify Political Parties Exist

Ensure all parties mentioned in your CSV exist:

```sql
-- List all Canadian parties
SELECT id, country, name FROM political_parties WHERE country = 'Canada' ORDER BY name;

-- List all US parties
SELECT id, country, name FROM political_parties WHERE country = 'United States' ORDER BY name;
```

**Common Canadian parties:**
- Liberal Party of Canada
- Conservative Party of Canada
- New Democratic Party
- Bloc Québécois
- Green Party of Canada

**Common US parties:**
- Democratic Party
- Republican Party
- Independent

If missing, create them:

```sql
INSERT INTO political_parties (country, name, color_hex)
VALUES 
  ('Canada', 'Liberal Party of Canada', '#D32F2F'),
  ('Canada', 'Conservative Party of Canada', '#1976D2'),
  ('Canada', 'New Democratic Party', '#F57C00'),
  ('Canada', 'Bloc Québécois', '#00A8E8'),
  ('Canada', 'Green Party of Canada', '#2E7D32'),
  ('United States', 'Democratic Party', '#0015BC'),
  ('United States', 'Republican Party', '#E81B23'),
  ('United States', 'Independent', '#888888');
```

---

## Step 3: Create CSV Data File

Create `office-holders-data.csv` with the following structure:

```csv
map_shape_id,role_title,full_name,political_party,bio,contact_email,contact_phone,term_start,term_end,source_url,photo_url
```

**Finding map_shape_id:**

```sql
-- Find a Canadian federal riding
SELECT id, name, boundary_type, country 
FROM map_shapes 
WHERE boundary_type = 'Federal' 
AND country = 'Canada'
AND name ILIKE 'Vancouver%'
LIMIT 5;

-- Find a US House district
SELECT id, name, boundary_type, country 
FROM map_shapes 
WHERE boundary_type = 'Federal' 
AND country = 'United States'
AND properties->>'district' = '1'
AND properties->>'state' = 'CA'
LIMIT 5;
```

**Example CSV rows:**

```csv
map_shape_id,role_title,full_name,political_party,bio,contact_email,contact_phone,term_start,term_end,source_url,photo_url
1234,Member of Parliament,John Smith,Liberal Party of Canada,"Lawyer and community advocate",john.smith@parl.gc.ca,(613) 992-1234,2021-09-20,,https://www.parliament.ca/members/...,https://example.com/photo.jpg
5678,Senator,Jane Doe,Independent,"Retired professor specializing in policy",jane.doe@senate.gov,(202) 224-5555,2023-01-03,,https://www.senate.gov/senators/...,
9999,Governor,Bob Johnson,Republican Party,"Former business leader","","",2019-01-14,2027-01-09,https://governor.example.com/bob-johnson,https://example.com/bob.jpg
```

**Field Notes:**
- `map_shape_id`: Required, must exist in map_shapes
- `role_title`: Required, must exist in election_role_types
- `full_name`: Required
- `political_party`: Required, must exist in political_parties
- `bio`: Optional, free text
- `contact_email`: Optional
- `contact_phone`: Optional
- `term_start`: Optional, YYYY-MM-DD format
- `term_end`: Optional, YYYY-MM-DD format
- `source_url`: Optional, URL to official page
- `photo_url`: Optional, URL to official photo

---

## Step 4: Set Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

Find these in:
- Supabase dashboard → Settings → API → Project URL
- Supabase dashboard → Settings → API → Service Role Key (⚠️ keep secret!)

---

## Step 5: Run the Import Script

```bash
# Install dependencies (if not already installed)
npm install @supabase/supabase-js csv-parse

# Run the import
npx ts-node scripts/import-office-holders.ts scripts/office-holders-data.csv

# Or with a different CSV file
npx ts-node scripts/import-office-holders.ts /path/to/your/data.csv
```

**Output:**
```
📂 Reading CSV from: scripts/office-holders-data.csv
📋 Found 150 office holder records
✅ Imported 145 | ❌ Failed 5 | 📊 Total 150

📊 IMPORT SUMMARY
✅ Imported: 145
❌ Failed: 5
📈 Total processed: 150

⚠️  ERRORS:
  • Row 3: map_shape_id 999999 not found
  • Row 15: role "Member of Parliament" not found for Canada/Provincial
  ...
```

---

## Step 6: Verify Import

```sql
-- Count imported office holders by country
SELECT 
  country,
  COUNT(*) as total,
  COUNT(DISTINCT map_shape_id) as boundaries,
  COUNT(DISTINCT election_role_type_id) as roles
FROM office_holders
JOIN map_shapes ON office_holders.map_shape_id = map_shapes.id
GROUP BY country
ORDER BY total DESC;

-- Check specific office holder
SELECT 
  oh.full_name,
  oh.election_role_types.role_title,
  ms.name as boundary,
  pp.name as party
FROM office_holders oh
JOIN map_shapes ms ON oh.map_shape_id = ms.id
JOIN political_parties pp ON oh.political_party_id = pp.id
WHERE ms.country = 'Canada'
LIMIT 10;
```

---

## Troubleshooting

### Error: "role not found for Country/BoundaryType"
**Cause:** Role title doesn't exist in election_role_types  
**Fix:** Create the role type first (see Step 1)

### Error: "party not found"
**Cause:** Political party name doesn't match exactly  
**Fix:** Check spelling in political_parties table, update CSV

### Error: "map_shape_id not found"
**Cause:** Boundary ID doesn't exist or is wrong  
**Fix:** Query map_shapes to find correct ID (see Step 3)

### Error: "AUTH" or "Permission denied"
**Cause:** Invalid Supabase keys or insufficient permissions  
**Fix:** Verify SUPABASE_SERVICE_ROLE_KEY is set (not public key)

### Script hangs or runs slowly
**Cause:** Large CSV file or slow network  
**Fix:** Test with smaller subset first, check network connectivity

---

## Best Practices

1. **Start small**: Test with 10-20 rows before importing thousands
2. **Verify data**: Double-check names, party names, and role titles
3. **Validate dates**: Use ISO format YYYY-MM-DD
4. **Clean URLs**: Ensure photo and source URLs are valid
5. **Handle updates**: Script uses UPSERT, so re-running updates existing records
6. **Backup data**: Always backup database before large imports

---

## Automating Future Updates

To keep officeholder data current, you can:

1. **Schedule monthly imports**: Create a cron job that runs the import script
2. **Use government APIs**: Scrape Elections Canada, state legislature APIs
3. **Webhook from government**: Set up webhooks for real-time updates

Example cron job:
```bash
# Run import every month on the 1st at 2 AM
0 2 1 * * cd /path/to/choseno && npx ts-node scripts/import-office-holders.ts scripts/latest-data.csv
```

---

## Data Sources

**Canada:**
- [Elections Canada MPs](https://www.parl.gc.ca/members/)
- [Parliament of Canada](https://www.parliament.ca)
- Provincial legislature websites

**United States:**
- [Congress.gov](https://www.congress.gov)
- [Senate.gov](https://www.senate.gov)
- [House.gov](https://www.house.gov)
- [Ballotpedia](https://ballotpedia.org) (governors, state officials)

---

## Next Steps

1. Prepare CSV data using the template above
2. Verify election_role_types and political_parties exist
3. Run the import script
4. Check results with verification queries
5. Test on public website to confirm office holders display correctly
