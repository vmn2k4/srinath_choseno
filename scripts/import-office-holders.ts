#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface OfficeHolderRow {
  map_shape_id: number;
  role_title: string;
  full_name: string;
  political_party: string;
  bio?: string;
  contact_email?: string;
  contact_phone?: string;
  term_start?: string;
  term_end?: string;
  source_url?: string;
  photo_url?: string;
}

async function readCSV(filePath: string): Promise<OfficeHolderRow[]> {
  return new Promise((resolve, reject) => {
    const rows: OfficeHolderRow[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    let isHeader = true;
    let headers: string[] = [];

    rl.on("line", (line) => {
      if (line.startsWith("#") || line.trim() === "") return;

      if (isHeader) {
        headers = line.split(",").map((h) => h.trim().toLowerCase());
        isHeader = false;
        return;
      }

      const values = line.split(",").map((v) => v.trim());
      if (values.length < 4) return; // Skip incomplete rows

      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || null;
      });

      // Convert map_shape_id to number
      if (row.map_shape_id) {
        row.map_shape_id = parseInt(row.map_shape_id, 10);
      }

      rows.push(row as OfficeHolderRow);
    });

    rl.on("close", () => resolve(rows));
    rl.on("error", reject);
  });
}

async function getElectionRoleTypeId(
  country: string,
  boundaryType: string,
  roleTitle: string
): Promise<string | null> {
  const { data } = await supabase
    .from("election_role_types")
    .select("id")
    .eq("country", country)
    .eq("boundary_type", boundaryType)
    .eq("role_title", roleTitle)
    .maybeSingle();

  return data?.id || null;
}

async function getMapShapeInfo(
  mapShapeId: number
): Promise<{ country: string; boundary_type: string } | null> {
  const { data } = await supabase
    .from("map_shapes")
    .select("country, boundary_type")
    .eq("id", mapShapeId)
    .maybeSingle();

  return data || null;
}

async function getPoliticalPartyId(country: string, partyName: string): Promise<string | null> {
  const { data } = await supabase
    .from("political_parties")
    .select("id")
    .eq("country", country)
    .eq("name", partyName)
    .maybeSingle();

  return data?.id || null;
}

async function importOfficeHolders(filePath: string) {
  console.log(`📂 Reading CSV from: ${filePath}`);

  const rows = await readCSV(filePath);
  console.log(`📋 Found ${rows.length} office holder records`);

  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      // Get shape info
      const shapeInfo = await getMapShapeInfo(row.map_shape_id);
      if (!shapeInfo) {
        errors.push(`Row ${imported + 1}: map_shape_id ${row.map_shape_id} not found`);
        failed++;
        continue;
      }

      // Get election role type ID
      const roleTypeId = await getElectionRoleTypeId(
        shapeInfo.country,
        shapeInfo.boundary_type,
        row.role_title
      );
      if (!roleTypeId) {
        errors.push(
          `Row ${imported + 1}: role "${row.role_title}" not found for ${shapeInfo.country}/${shapeInfo.boundary_type}`
        );
        failed++;
        continue;
      }

      // Get political party ID
      let partyId = null;
      if (row.political_party) {
        partyId = await getPoliticalPartyId(shapeInfo.country, row.political_party);
        if (!partyId) {
          errors.push(
            `Row ${imported + 1}: party "${row.political_party}" not found for ${shapeInfo.country}`
          );
          failed++;
          continue;
        }
      }

      // Upsert office holder
      const { error } = await supabase.from("office_holders").upsert(
        {
          map_shape_id: row.map_shape_id,
          election_role_type_id: roleTypeId,
          full_name: row.full_name,
          political_party_id: partyId,
          bio: row.bio || null,
          contact_email: row.contact_email || null,
          contact_phone: row.contact_phone || null,
          term_start: row.term_start || null,
          term_end: row.term_end || null,
          source_url: row.source_url || null,
          photo_url: row.photo_url || null,
          updated_by: "00000000-0000-0000-0000-000000000000", // System user
          updated_at: new Date().toISOString(),
        },
        { onConflict: "map_shape_id,election_role_type_id" }
      );

      if (error) {
        errors.push(`Row ${imported + 1}: ${error.message}`);
        failed++;
      } else {
        imported++;
        process.stdout.write(
          `\r✅ Imported ${imported} | ❌ Failed ${failed} | 📊 Total ${imported + failed}`
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Row ${imported + 1}: ${errMsg}`);
      failed++;
    }
  }

  console.log(`\n\n📊 IMPORT SUMMARY`);
  console.log(`✅ Imported: ${imported}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total processed: ${imported + failed}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  ERRORS:`);
    errors.slice(0, 10).forEach((e) => console.log(`  • ${e}`));
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run
const csvPath = process.argv[2] || path.join(__dirname, "office-holders-data.csv");
importOfficeHolders(csvPath).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
