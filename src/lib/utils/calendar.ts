// "Add to calendar" helpers for voting-place hours: a Google Calendar link and
// a downloadable .ics file (Apple Calendar, Outlook, etc.). Pure, no I/O.

export interface CalendarEvent {
  title: string;
  /** YYYY-MM-DD, local to `timeZone`. */
  date: string;
  /** HH:MM or HH:MM:SS local time; when either is missing the event is all-day. */
  opensAt?: string | null;
  closesAt?: string | null;
  location?: string | null;
  description?: string | null;
  timeZone?: string;
}

const DEFAULT_TZ = "America/Vancouver";

const compactDate = (d: string) => d.replace(/-/g, "");
const compactTime = (t: string) => {
  const [h, m = "00", s = "00"] = t.split(":");
  return `${h.padStart(2, "0")}${m.padStart(2, "0")}${s.padStart(2, "0")}`;
};

function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return n.toISOString().slice(0, 10);
}

// UTC offset (minutes) of `timeZone` at the given local wall-clock time.
function offsetMinutes(date: string, time: string, timeZone: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT-7"
  const m = part?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1].startsWith("-") ? -1 : 1;
  return sign * (Math.abs(Number(m[1])) * 60 + Number(m[2] || 0));
}

function toUtcStamp(date: string, time: string, timeZone: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi) - offsetMinutes(date, time, timeZone) * 60000;
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const hasTimes = (e: CalendarEvent) => Boolean(e.opensAt && e.closesAt);

export function googleCalendarUrl(e: CalendarEvent) {
  const tz = e.timeZone || DEFAULT_TZ;
  const dates = hasTimes(e)
    ? `${compactDate(e.date)}T${compactTime(e.opensAt!)}/${compactDate(e.date)}T${compactTime(e.closesAt!)}`
    : `${compactDate(e.date)}/${compactDate(nextDay(e.date))}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, ctz: tz });
  if (e.location) params.set("location", e.location);
  if (e.description) params.set("details", e.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");

export function buildIcs(e: CalendarEvent) {
  const tz = e.timeZone || DEFAULT_TZ;
  const uid = `${compactDate(e.date)}-${Math.abs(hash(e.title + (e.location || "")))}@choseno.com`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Choseno//Voting Places//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${uid}`];
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
  if (hasTimes(e)) {
    lines.push(`DTSTART:${toUtcStamp(e.date, e.opensAt!, tz)}`, `DTEND:${toUtcStamp(e.date, e.closesAt!, tz)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`, `DTEND;VALUE=DATE:${compactDate(nextDay(e.date))}`);
  }
  lines.push(`SUMMARY:${icsEscape(e.title)}`);
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
  lines.push("BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Time to vote", "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function icsDataUrl(e: CalendarEvent) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(e))}`;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
