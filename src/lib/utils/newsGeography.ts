/**
 * Deterministic normalization of free-text country/province input to ISO
 * codes for news_articles. AI-generated JSON (or an admin typing by hand)
 * may write "Canada" one time and "CA" the next -- these turn either into
 * the same stored value so country/province filtering stays reliable.
 */

const COUNTRY_ALIASES: Record<string, string> = {
  canada: "CA",
  "united states": "US",
  "united states of america": "US",
  "the united states": "US",
  usa: "US",
  "u.s.a.": "US",
  "u.s.": "US",
  america: "US",
  "united kingdom": "GB",
  "great britain": "GB",
  britain: "GB",
  uk: "GB",
  "u.k.": "GB",
};

const CA_PROVINCE_ALIASES: Record<string, string> = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  newfoundland: "NL",
  "newfoundland and labrador": "NL",
  "nova scotia": "NS",
  "northwest territories": "NT",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  québec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
};

const US_STATE_ALIASES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

const ISO2 = /^[A-Z]{2}$/;

// news_articles.country is normalized to an ISO-2 code (see
// normalizeCountryCode below), but map_shapes.country / profiles.country --
// a separate table populated from boundary import data -- store a free-text
// country name instead ("Canada", "USA", "India", ...), not the code. Any
// query that filters map_shapes/office_holders by a news article's country
// (e.g. "key leaders for this article's country") needs to go through this
// translation first, or an inner-joined country filter silently matches
// zero rows.
const ISO_CODE_TO_MAP_SHAPES_COUNTRY: Record<string, string> = {
  US: "USA",
  CA: "Canada",
  IN: "India",
};

/** "US" -> "USA", "CA" -> "Canada" -- the map_shapes/profiles spelling for a
 * news_articles-style ISO-2 country code. Unrecognized codes pass through
 * unchanged (better to attempt the code as-is than silently return nothing). */
export function isoCountryToMapShapesCountry(code: string | null | undefined): string {
  const raw = (code ?? "").trim().toUpperCase();
  return ISO_CODE_TO_MAP_SHAPES_COUNTRY[raw] || raw;
}

/** "Canada" / "canada" / "CA" -> "CA". Unknown input is upper-cased and truncated to 2 chars. */
export function normalizeCountryCode(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const alias = COUNTRY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const upper = raw.toUpperCase();
  return ISO2.test(upper) ? upper : upper.slice(0, 2);
}

/**
 * "Ontario" -> "ON", "California" -> "CA". `country` (an already-normalized
 * ISO-2 code) disambiguates which table to check first so e.g. a bare "CA"
 * resolves the same whether it means Canada-the-country or California-the-
 * state doesn't matter for a code that's already 2 letters, but full names
 * like "Ontario" only exist in one table.
 */
export function normalizeProvinceCode(input: string | null | undefined, country?: string | null): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  const table =
    country === "US" ? US_STATE_ALIASES :
    country === "CA" ? CA_PROVINCE_ALIASES :
    { ...CA_PROVINCE_ALIASES, ...US_STATE_ALIASES };
  const alias = table[key];
  if (alias) return alias;
  const upper = raw.toUpperCase();
  return ISO2.test(upper) ? upper : upper.slice(0, 2);
}
