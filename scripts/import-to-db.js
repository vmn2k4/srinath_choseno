const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbUrl = "postgresql://postgres:pa.8tX5%2BHh%2FGZn2@db.qlzyfdwrkcxyqapewxwg.supabase.co:5432/postgres";

async function main() {
  const csvPath = path.join(__dirname, "office-holders-data.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found:", csvPath);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split("\n").filter(l => l.trim().length > 0);

  console.log(`Reading ${lines.length - 1} rows from ${csvPath}...`);

  function parseCsvLine(text) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  function sqlVal(v) {
    if (v === null || v === undefined || v.trim() === "") return "NULL";
    return "'" + v.replace(/'/g, "''") + "'";
  }

  const valueTuples = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const [map_shape_id, role_title, full_name, political_party, bio, contact_email, contact_phone, term_start, term_end, source_url, photo_url] = cols;
    if (!map_shape_id || !full_name) continue;

    valueTuples.push(`(${map_shape_id}, ${sqlVal(role_title)}, ${sqlVal(full_name)}, ${sqlVal(political_party)}, ${sqlVal(bio)}, ${sqlVal(contact_email)}, ${sqlVal(contact_phone)}, ${sqlVal(term_start)}, ${sqlVal(source_url)}, ${sqlVal(photo_url)})`);
  }

  const stagingSqlFile = path.join(__dirname, "staging_import.sql");
  const sqlContent = `
BEGIN;
TRUNCATE TABLE office_holders RESTART IDENTITY;

CREATE TEMP TABLE staging_office_holders (
  map_shape_id bigint,
  role_title text,
  full_name text,
  political_party text,
  bio text,
  contact_email text,
  contact_phone text,
  holding_since text,
  source_url text,
  photo_url text
) ON COMMIT DROP;

INSERT INTO staging_office_holders VALUES
${valueTuples.join(",\n")};

INSERT INTO office_holders (
  map_shape_id,
  election_role_type_id,
  full_name,
  political_party_id,
  bio,
  contact_email,
  contact_phone,
  holding_since,
  source_url,
  photo_url,
  updated_at
)
SELECT DISTINCT ON (s.map_shape_id, ert.id)
  s.map_shape_id,
  ert.id AS election_role_type_id,
  s.full_name,
  pp.id AS political_party_id,
  NULLIF(s.bio, ''),
  NULLIF(s.contact_email, ''),
  NULLIF(s.contact_phone, ''),
  CASE WHEN s.holding_since IS NOT NULL AND s.holding_since != '' THEN s.holding_since::date ELSE NULL END,
  NULLIF(s.source_url, ''),
  NULLIF(s.photo_url, ''),
  NOW()
FROM staging_office_holders s
JOIN map_shapes ms ON s.map_shape_id = ms.id
JOIN election_role_types ert ON ert.country = ms.country AND ert.boundary_type = ms.boundary_type AND ert.role_title = s.role_title
LEFT JOIN political_parties pp ON pp.country = ms.country AND pp.name = s.political_party
ORDER BY s.map_shape_id, ert.id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  political_party_id = EXCLUDED.political_party_id,
  bio = EXCLUDED.bio,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  holding_since = EXCLUDED.holding_since,
  source_url = EXCLUDED.source_url,
  photo_url = EXCLUDED.photo_url,
  updated_at = NOW();

COMMIT;
`;

  fs.writeFileSync(stagingSqlFile, sqlContent, "utf8");
  console.log(`Generated single batched SQL statement for ${valueTuples.length} rows. Running psql...`);

  execSync(`psql "${dbUrl}" -f "${stagingSqlFile}"`, { stdio: "inherit" });

  fs.unlinkSync(stagingSqlFile);

  const countRes = execSync(`psql "${dbUrl}" -t -A -c "SELECT COUNT(*) FROM office_holders;"`, { encoding: "utf8" });
  console.log(`\n🎉 SUCCESS! Inserted ${countRes.trim()} active office holders into Postgres!`);
}

main().catch(err => {
  console.error("Import error:", err);
  process.exit(1);
});
