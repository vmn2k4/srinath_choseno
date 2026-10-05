// Search-friendly place labels. Many municipal/riding names are ambiguous on
// their own ("Victoria" is also a city in Manitoba, a state in Australia...),
// so titles, headings and descriptions append the province: "Victoria, BC".
// Display text only -- never feed this into slugs or canonical URLs, which
// would change already-indexed URLs.

const CA_PROVINCE_ABBR: Record<string, string> = {
  "british columbia": "BC",
  alberta: "AB",
  saskatchewan: "SK",
  manitoba: "MB",
  ontario: "ON",
  quebec: "QC",
  "québec": "QC",
  "new brunswick": "NB",
  "nova scotia": "NS",
  "prince edward island": "PE",
  "newfoundland and labrador": "NL",
  yukon: "YT",
  "northwest territories": "NT",
  nunavut: "NU",
};

export function provinceAbbr(provinceName?: string | null): string | null {
  return provinceName ? CA_PROVINCE_ABBR[provinceName.trim().toLowerCase()] ?? null : null;
}

/** "Victoria" + "British Columbia" -> "Victoria, BC". Unchanged when the province is unknown or already in the name. */
export function withProvince(name: string, provinceName?: string | null): string {
  const abbr = provinceAbbr(provinceName);
  if (!abbr || !provinceName) return name;
  const lower = name.toLowerCase();
  if (lower.includes(provinceName.toLowerCase()) || new RegExp(`(^|[\\s,(])${abbr.toLowerCase()}($|[\\s,)])`).test(lower)) return name;
  return `${name}, ${abbr}`;
}
