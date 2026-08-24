/**
 * Convert UTC ISO date string to Pacific Standard/Daylight Time
 * @param isoDate - ISO date string (e.g., "2026-08-23T17:00:00Z")
 * @returns Formatted date string in PST/PDT (e.g., "2026-08-23 10:00")
 */
export function convertToPackificTime(isoDate?: string | null): string {
  if (!isoDate) {
    const now = new Date();
    return formatPackificTime(now);
  }

  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "Unknown Time";
    return formatPackificTime(d);
  } catch {
    return "Unknown Time";
  }
}

/**
 * Format a Date object to Pacific time string (e.g., "2026-08-23 10:00")
 */
function formatPackificTime(date: Date): string {
  try {
    // Use Intl.DateTimeFormat with Pacific timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;

    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return "Unknown Time";
  }
}

/**
 * Get timezone abbreviation (PST or PDT) for a given date
 */
export function getPackificTimezoneName(isoDate?: string | null): string {
  if (!isoDate) return "PDT/PST";

  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "PDT/PST";

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      timeZoneName: "short",
    });

    const parts = formatter.formatToParts(d);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value;
    return tzName || "PDT/PST";
  } catch {
    return "PDT/PST";
  }
}
