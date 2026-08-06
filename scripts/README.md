# Office Holders Data Import System

This directory contains tools and documentation for populating the `office_holders` table with current elected officials (MPs, MLAs, Senators, House members, governors).

## Quick Start

```bash
# 1. Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# 2. Prepare your CSV data (see IMPORT_GUIDE.md for format)
# Place it at scripts/office-holders-data.csv

# 3. Run the import
npm run import:office-holders

# Or with a custom path:
npm run import:office-holders:custom /path/to/data.csv
```

## Files

| File | Purpose |
|------|---------|
| `IMPORT_GUIDE.md` | Complete guide with setup, verification, troubleshooting |
| `office-holders-template.csv` | Empty template with headers and format instructions |
| `office-holders-sample.csv` | Example data showing proper format |
| `import-office-holders.ts` | TypeScript script that reads CSV and inserts into Supabase |
| `office-holders-data.csv` | Your actual data file (create from template) |

## Process Overview

```mermaid
graph LR
    A["Research Data<br/>(Government websites)"] -->|CSV| B["Prepare office-holders-data.csv"]
    B -->|map_shape_id, role_title, full_name...| C["Verify Prerequisites"]
    C -->|election_role_types<br/>political_parties| D["Run Import Script"]
    D -->|UPSERT| E["office_holders Table"]
    E -->|Public Display| F["Election Seat Pages"]
    F -->|Current Representative Card| G["User Views Officeholder"]
```

## Prerequisites

Before importing, verify these exist in your Supabase database:

### 1. Election Role Types
```sql
SELECT DISTINCT country, boundary_type, role_title 
FROM election_role_types 
WHERE country IN ('Canada', 'United States');
```

**Must have:**
- Canada / Federal / "Member of Parliament"
- Canada / Provincial / "Member of Legislative Assembly" (or province-specific: MLA, MPP, etc.)
- United States / Federal / "Senator"
- United States / Federal / "Representative"
- United States / State / "Governor"

### 2. Political Parties
```sql
SELECT DISTINCT country, name 
FROM political_parties 
WHERE country IN ('Canada', 'United States');
```

**Must have:**
- Canada: Liberal Party, Conservative, NDP, Bloc Québécois, Green
- United States: Democratic Party, Republican Party, Independent

### 3. Map Shapes (Boundaries)
```sql
SELECT COUNT(*) as total_boundaries
FROM map_shapes 
WHERE country IN ('Canada', 'United States');
```

Should have thousands of boundaries (federal ridings, provinces, states, districts).

## Data Format

CSV headers:
```
map_shape_id,role_title,full_name,political_party,bio,contact_email,contact_phone,term_start,term_end,source_url,photo_url
```

**Required fields:**
- `map_shape_id` - Boundary ID from map_shapes table
- `role_title` - Must match election_role_types.role_title
- `full_name` - Official name
- `political_party` - Must match political_parties.name

**Optional fields:**
- `bio` - Short biography
- `contact_email`, `contact_phone` - Contact information
- `term_start`, `term_end` - YYYY-MM-DD dates
- `source_url` - Link to official page
- `photo_url` - URL to official photo

## Example Data

See `office-holders-sample.csv` for examples of proper formatting.

## Import Steps

1. **Prepare data**
   - Research officeholder information
   - Create `office-holders-data.csv`
   - Verify all values match expected tables

2. **Verify prerequisites** (see section above)
   - election_role_types exist
   - political_parties exist
   - map_shapes exist

3. **Set environment variables**
   ```bash
   export SUPABASE_URL="https://..."
   export SUPABASE_SERVICE_ROLE_KEY="..."
   ```

4. **Run import**
   ```bash
   npm run import:office-holders
   ```

5. **Verify results**
   ```sql
   SELECT COUNT(*) FROM office_holders;
   SELECT * FROM office_holders LIMIT 5;
   ```

## Troubleshooting

See `IMPORT_GUIDE.md` for detailed troubleshooting, including:
- Role not found errors
- Party not found errors
- map_shape_id not found errors
- Authentication errors
- Performance issues

## Data Sources

### Canada
- [Parliament of Canada - Members](https://www.parl.gc.ca/members/)
- [Elections Canada](https://www.elections.ca/)
- Individual provincial legislature websites:
  - BC: [leg.bc.ca](https://www.leg.bc.ca)
  - Ontario: [ola.org](https://www.ola.org)
  - Quebec: [assnat.qc.ca](https://www.assnat.qc.ca)
  - Alberta: [assembly.ab.ca](https://www.assembly.ab.ca)

### United States
- [Congress.gov](https://www.congress.gov)
- [Senate.gov - Senators](https://www.senate.gov/senators)
- [House.gov - Representatives](https://www.house.gov)
- [Ballotpedia - State Governors](https://ballotpedia.org/State_executive_officials)
- [CQ Roll Call](https://cqrollcall.com)

## Advanced Usage

### Batch Import Multiple Files
```bash
for file in data/*.csv; do
  npm run import:office-holders:custom "$file"
done
```

### Update Existing Data
The import script uses UPSERT, so running it again with updated data will overwrite existing records:
```bash
# First import
npm run import:office-holders

# Later, with updated CSV (same map_shape_id + role_title)
# Running again will update those records
npm run import:office-holders
```

### Schedule Recurring Imports
Create a cron job to import updated data monthly:
```bash
# Add to crontab
0 2 1 * * cd /path/to/choseno && npm run import:office-holders >> /var/log/office-holders-import.log 2>&1
```

## Performance

- **Typical import time**: ~1-2 seconds per 100 records
- **Bottleneck**: Supabase API calls for validation (country/boundary_type lookups)
- **Optimization**: Script caches lookups to minimize duplicate queries

For large imports (>10k records), consider:
1. Using Supabase SQL directly
2. Batching requests in smaller groups
3. Running during low-traffic periods

## Validation

The import script validates:
- ✅ map_shape_id exists in map_shapes
- ✅ election_role_type_id found for (country, boundary_type, role_title)
- ✅ political_party_id found for (country, party_name)
- ✅ All required fields present
- ✅ Date formats (YYYY-MM-DD)

Invalid rows are skipped with error messages.

## API Structure

The import uses the `getOfficeHoldersByShapeAndRole()` service function to verify data before upsert. This ensures:
- Type safety (TypeScript)
- Consistent error handling
- Proper relationship validation

## Next Steps

1. **Gather data** - Research current officeholders from government sources
2. **Format CSV** - Use template and sample as guide
3. **Verify prerequisites** - Ensure election_role_types and political_parties exist
4. **Run import** - Execute script to load data
5. **Test publicly** - View officeholder cards on election seat pages

## Support

For issues:
1. Check `IMPORT_GUIDE.md` troubleshooting section
2. Verify CSV format against examples
3. Check Supabase dashboard for data state
4. Review import script output for specific error messages

---

**Last Updated**: 2025-08-06  
**Status**: Ready for data population
