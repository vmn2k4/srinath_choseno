#!/usr/bin/env node
/**
 * Send politician claim wall invitations via CSV
 * Uses existing Supabase email infrastructure
 *
 * Usage: npx ts-node scripts/send-politician-invites.ts <csv-file> [campaign-name]
 * Example: npx ts-node scripts/send-politician-invites.ts bc-mayors.csv "BC Mayors 2026"
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.choseno.com";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface PoliticianRecord {
  name: string;
  email: string;
  role?: string;
  city?: string;
  [key: string]: string | undefined;
}

interface CampaignResult {
  politician_name: string;
  politician_email: string;
  claim_token: string;
  claim_link: string;
  status: "sent" | "failed";
  error?: string;
  sent_at?: string;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateRecord(record: PoliticianRecord): boolean {
  if (!record.name || !record.name.trim()) {
    console.error("  ❌ Missing name");
    return false;
  }
  if (!record.email || !validateEmail(record.email)) {
    console.error(`  ❌ Invalid email: ${record.email}`);
    return false;
  }
  return true;
}

async function readCsvFile(filePath: string): Promise<PoliticianRecord[]> {
  return new Promise((resolve, reject) => {
    const rows: PoliticianRecord[] = [];
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
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      if (row.name || row.email) {
        rows.push(row as PoliticianRecord);
      }
    });

    rl.on("close", () => resolve(rows));
    rl.on("error", (err) => {
      console.error(`❌ Failed to read CSV: ${err}`);
      reject(err);
    });
  });
}

async function saveCampaignRecord(
  record: PoliticianRecord,
  token: string,
  link: string,
  campaignName: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from("politician_claim_campaigns").insert({
      politician_name: record.name,
      politician_email: record.email,
      claim_token: token,
      claim_link: link,
      campaign_name: campaignName,
      status: "sent",
    });

    if (error) {
      console.error(`  ❌ DB error: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`  ❌ Failed to save record: ${err}`);
    return false;
  }
}

async function sendClaimEmail(
  record: PoliticianRecord,
  claimLink: string
): Promise<boolean> {
  try {
    // Use Supabase Edge Function to send email
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to: record.email,
        subject: `Your Political Wall is Ready on Choseno`,
        html: generateEmailHtml(record.name, claimLink),
      },
    });

    if (error) {
      console.error(`  ❌ Email send error: ${error.message}`);
      return false;
    }

    if (!data?.ok) {
      console.error(`  ❌ Email service returned error`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`  ❌ Failed to send email: ${err}`);
    return false;
  }
}

function generateEmailHtml(name: string, claimLink: string): string {
  const cleanName = name.split(" ")[0]; // First name only
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
          .footer { color: #666; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Choseno! 🎉</h1>
          </div>

          <div class="content">
            <p>Hi ${cleanName},</p>

            <p>Your political wall on Choseno is ready to claim!</p>

            <p>Claim your wall using this link:</p>
            <p style="text-align: center;">
              <a href="${claimLink}" class="cta-button">Claim Your Wall</a>
            </p>

            <p>This link is unique to you and can only be used once. Once claimed, you'll be able to:</p>
            <ul>
              <li>Customize your political wall</li>
              <li>Connect with constituents</li>
              <li>Share your positions</li>
              <li>Respond to voter questions</li>
            </ul>

            <p>Questions? Reply to this email or visit <a href="${SITE_URL}">Choseno</a>.</p>

            <p>Best regards,<br>The Choseno Team</p>
          </div>

          <div class="footer">
            <p>© Choseno. Helping politicians and voters connect.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function runCampaign(csvFile: string, campaignName: string = "Political Wall Invites") {
  console.log("\n🚀 Starting Politician Wall Claim Invitation Campaign\n");

  // Check CSV file
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ CSV file not found: ${csvFile}`);
    process.exit(1);
  }

  console.log(`📄 Reading CSV file: ${csvFile}\n`);

  // Read CSV
  let records: PoliticianRecord[];
  try {
    records = await readCsvFile(csvFile);
  } catch {
    process.exit(1);
  }

  if (records.length === 0) {
    console.error("❌ No records found in CSV file");
    process.exit(1);
  }

  console.log(`📊 Found ${records.length} records to process\n`);

  // Validate records
  let validRecords: PoliticianRecord[] = [];
  for (const record of records) {
    if (validateRecord(record)) {
      validRecords.push(record);
    }
  }

  console.log(`✅ ${validRecords.length} valid records\n`);

  // Process each record
  const results: CampaignResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < validRecords.length; i++) {
    const record = validRecords[i];
    const token = randomUUID();
    const claimLink = `${SITE_URL}/claim-wall?token=${token}&email=${encodeURIComponent(record.email)}`;

    process.stdout.write(`[${i + 1}/${validRecords.length}] Sending to ${record.name}... `);

    // Send email using Supabase function
    const emailSent = await sendClaimEmail(record, claimLink);

    if (emailSent) {
      // Save to database
      const dbSaved = await saveCampaignRecord(record, token, claimLink, campaignName);

      if (dbSaved) {
        console.log("✅");
        results.push({
          politician_name: record.name,
          politician_email: record.email,
          claim_token: token,
          claim_link: claimLink,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        successCount++;
      } else {
        console.log("❌ (DB error)");
        results.push({
          politician_name: record.name,
          politician_email: record.email,
          claim_token: token,
          claim_link: claimLink,
          status: "failed",
          error: "Failed to save to database",
        });
        failCount++;
      }
    } else {
      console.log("❌ (Email error)");
      results.push({
        politician_name: record.name,
        politician_email: record.email,
        claim_token: token,
        claim_link: claimLink,
        status: "failed",
        error: "Failed to send email",
      });
      failCount++;
    }

    // Rate limit: 1 second between emails to avoid spam flags
    if (i < validRecords.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📈 CAMPAIGN SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Successfully sent: ${successCount}`);
  console.log(`❌ Failed to send: ${failCount}`);
  console.log(`📊 Total processed: ${validRecords.length}`);
  console.log("=".repeat(60) + "\n");

  // Save results
  const timestamp = new Date().toISOString().split("T")[0];
  const resultsFile = `campaign-results-${timestamp}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${resultsFile}\n`);
}

// Main entry point
const csvFile = process.argv[2] || "politicians.csv";
const campaignName = process.argv[3] || "Political Wall Invites";

runCampaign(csvFile, campaignName).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
