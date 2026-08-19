// Pure parsing/validation for the admin Campaign tab's CSV/JSON import.
// No I/O here — file reading happens in the component, Supabase calls happen
// in src/lib/services/campaigns.ts.

export interface CampaignRecordInput {
  name: string;
  email: string;
  role?: string;
  city?: string;
  // The Choseno wall slug (e.g. "brenda-locke-mayor") — never auto-inferred
  // from a template, always either supplied in the import or typed in by an
  // admin, since a guessed slug that doesn't match a real profile 404s.
  wallSlug?: string;
}

export interface ParsedCampaignRecord {
  row: number; // 1-based, for error messages
  data: CampaignRecordInput;
  error: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidCampaignEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

function validate(data: Partial<CampaignRecordInput>): string | null {
  if (!data.name || !data.name.trim()) return "Missing name";
  if (!data.email || !data.email.trim()) return "Missing email";
  if (!isValidCampaignEmail(data.email)) return `Invalid email: ${data.email}`;
  return null;
}

// Handles quoted fields (so names/roles containing a comma survive a
// spreadsheet export) without pulling in a CSV library.
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

const HEADER_ALIASES: Record<string, keyof CampaignRecordInput> = {
  name: "name",
  full_name: "name",
  fullname: "name",
  politician_name: "name",
  email: "email",
  politician_email: "email",
  role: "role",
  role_title: "role",
  title: "role",
  position: "role",
  city: "city",
  municipality: "city",
  wall_slug: "wallSlug",
  wallslug: "wallSlug",
  wall: "wallSlug",
  wall_url: "wallSlug",
  wallurl: "wallSlug",
};

export function parseCampaignCsv(text: string): ParsedCampaignRecord[] {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const fieldFor = headers.map((h) => HEADER_ALIASES[h] || null);

  const results: ParsedCampaignRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const data: Partial<CampaignRecordInput> = {};
    fieldFor.forEach((field, idx) => {
      if (field) data[field] = values[idx] ?? "";
    });
    results.push({
      row: i + 1,
      data: {
        name: data.name || "",
        email: data.email || "",
        role: data.role || "",
        city: data.city || "",
        wallSlug: data.wallSlug || "",
      },
      error: validate(data),
    });
  }
  return results;
}

export function parseCampaignJson(text: string): ParsedCampaignRecord[] {
  const parsed: unknown = JSON.parse(text);
  const rawRecords = Array.isArray(parsed)
    ? parsed
    : (parsed as { records?: unknown[] })?.records;
  if (!Array.isArray(rawRecords)) {
    throw new Error('Expected a JSON array, or an object with a "records" array.');
  }

  return rawRecords.map((item, i) => {
    const obj = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    // Accept either our canonical keys or the same aliases CSV headers allow.
    const get = (...keys: string[]) => {
      for (const k of keys) {
        if (typeof obj[k] === "string" && obj[k]) return obj[k] as string;
      }
      return "";
    };
    const data: CampaignRecordInput = {
      name: get("name", "full_name", "fullName", "politician_name"),
      email: get("email", "politician_email"),
      role: get("role", "role_title", "title", "position"),
      city: get("city", "municipality"),
      wallSlug: get("wallSlug", "wall_slug", "wall", "wall_url", "wallUrl"),
    };
    return { row: i + 1, data, error: validate(data) };
  });
}

// Auto-detects CSV vs JSON from the pasted/uploaded text's shape.
export function parseCampaignInput(text: string): ParsedCampaignRecord[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseCampaignJson(trimmed);
  }
  return parseCampaignCsv(trimmed);
}

// Simple {{name}}/{{role}}/{{city}}/{{wall_slug}} substitution for subject/body
// templates. {{claim_link}} is deliberately left untouched — sendCampaignInvite
// (src/lib/services/campaigns.ts) fills that one in once it mints the token, so
// the link actually emailed and the link logged to the database never drift.
export function fillCampaignTemplate(template: string, data: CampaignRecordInput): string {
  const firstName = (data.name || "").trim().split(/\s+/)[0] || data.name || "";
  return template
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*name\s*\}\}/gi, data.name || "")
    .replace(/\{\{\s*role\s*\}\}/gi, data.role || "")
    .replace(/\{\{\s*city\s*\}\}/gi, data.city || "")
    .replace(/\{\{\s*wall_slug\s*\}\}/gi, (data.wallSlug || "").trim())
    .replace(/\{\{\s*wall_url\s*\}\}/gi, (data.wallSlug || "").trim() ? `https://www.choseno.com/wall/${(data.wallSlug || "").trim()}` : "");
}
