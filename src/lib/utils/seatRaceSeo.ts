// Pure helpers that turn one seat's real data (candidates + parties, current
// office holder, election) into the meta description and the visible "About
// this race" copy for a seat page. Every sentence is built from facts that
// differ per seat (who holds it, who is running for which party, whether the
// incumbent is on the ballot), so ~1,300 seat pages don't read as one
// template with the names swapped.

export interface RaceCandidate {
  name: string;
  party?: string | null;
  blurb?: string | null;
}

export interface RaceIncumbent {
  name: string;
  party?: string | null;
  since?: string | null;
}

export interface RaceFacts {
  roleTitle: string;
  boundaryName: string;
  electionName: string;
  electionDate?: string | null;
  candidates: RaceCandidate[];
  incumbent?: RaceIncumbent | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dateParts(iso?: string | null) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

export function shortDate(iso?: string | null): string | null {
  const p = dateParts(iso);
  return p ? `${MONTHS[p.mo]} ${p.d}, ${p.y}` : null;
}

export function longDate(iso?: string | null): string | null {
  const p = dateParts(iso);
  return p ? `${MONTHS_LONG[p.mo]} ${p.d}, ${p.y}` : null;
}

// "New Democratic Party (NDP)" -> "NDP"; "Conservative Party" stays as is.
export function partyShort(party?: string | null): string | null {
  if (!party) return null;
  const acronym = party.match(/\(([A-Za-z]{2,8})\)\s*$/);
  return acronym ? acronym[1] : party;
}

const label = (c: { name: string; party?: string | null }) => {
  const p = partyShort(c.party);
  return p ? `${c.name} (${p})` : c.name;
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function incumbentRunning(f: RaceFacts) {
  return !!f.incumbent && f.candidates.some((c) => sameName(c.name, f.incumbent!.name));
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Statements are often just links/handles ("Links: Website: ..."), which make
// poor copy -- only use a blurb that reads as prose.
export function usableBlurb(text?: string | null): string | null {
  const t = text?.replace(/\s+/g, " ").trim();
  if (!t || t.length < 60 || /https?:\/\/|www\.|^(links|website|facebook)\s*:/i.test(t)) return null;
  return t;
}

function clipSentence(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
}

/**
 * Meta description, most important facts first (race, election, date, who is
 * running for which party) so truncation only ever loses optional detail.
 * Tries richer variants first and keeps the first one that fits in `max`.
 */
export function buildRaceDescription(f: RaceFacts, max = 160): string {
  const election = f.electionName.replace(/^\d{4}\s+/, "");
  const date = shortDate(f.electionDate);
  const head = `${f.boundaryName} ${f.roleTitle} race, ${election}${date ? ` (${date})` : ""}`;
  const people = f.candidates.map(label);

  const incumbentClause = f.incumbent
    ? incumbentRunning(f)
      ? ` Incumbent ${f.incumbent.name} is running.`
      : ` Current ${f.roleTitle}: ${f.incumbent.name}.`
    : "";

  const variants: string[] = [];
  for (const n of [people.length, 3, 2, 1]) {
    if (n > people.length || n < 1) continue;
    const shown = people.slice(0, n);
    const more = people.length - n;
    const who = `${shown.join(" vs. ")}${more > 0 ? ` +${more} more` : ""}`;
    variants.push(`${head}: ${who}.${incumbentClause}`);
    variants.push(`${head}: ${who}.`);
  }
  variants.push(`${head}. Candidates, parties and voter ratings on Choseno.`);
  variants.push(`${f.boundaryName} ${f.roleTitle} race: candidates, parties and voter ratings on Choseno.`);

  return variants.find((v) => v.length <= max) || clipSentence(variants[variants.length - 1], max);
}

/** Visible, server-rendered paragraphs for the seat page. */
export function buildRaceParagraphs(f: RaceFacts): string[] {
  const out: string[] = [];
  const date = longDate(f.electionDate);
  const n = f.candidates.length;

  out.push(
    `The ${f.roleTitle} race in ${f.boundaryName} is part of the ${f.electionName}${date ? `, with voting on ${date}` : ""}. ` +
      (n === 0
        ? "No candidates have been listed yet."
        : `${n} ${n === 1 ? "candidate is" : "candidates are"} listed on Choseno: ${listNames(f.candidates.map(label))}.`)
  );

  if (f.incumbent) {
    const since = dateParts(f.incumbent.since)?.y;
    const party = partyShort(f.incumbent.party);
    const who = `${f.incumbent.name}${party ? ` (${party})` : ""}`;
    out.push(
      `${who} currently holds this seat${since ? `, in office since ${since}` : ""}. ` +
        (incumbentRunning(f)
          ? `${f.incumbent.name} is listed among the candidates for this race.`
          : `${f.incumbent.name} is not currently listed among the candidates for this race.`)
    );
  }

  const parties = [...new Set(f.candidates.map((c) => partyShort(c.party)).filter((p): p is string => !!p))];
  if (parties.length > 0) {
    const unaffiliated = f.candidates.length - f.candidates.filter((c) => c.party).length;
    out.push(
      `Parties on this ballot: ${listNames(parties)}${unaffiliated > 0 ? `, plus ${unaffiliated} without a listed party` : ""}.`
    );
  }

  for (const c of f.candidates) {
    const blurb = usableBlurb(c.blurb);
    if (blurb) out.push(`${c.name}: ${clipSentence(blurb, 240)}`);
  }

  return out;
}

export interface CandidateFacts {
  name: string;
  roleTitle: string;
  boundaryName?: string | null;
  party?: string | null;
  electionName?: string | null;
  electionDate?: string | null;
  statement?: string | null;
  isIncumbent?: boolean;
}

/**
 * Meta description for a candidate page: who, which party, which race and
 * when, then a bio snippet only if it reads as prose (not a links list).
 */
export function buildCandidateDescription(f: CandidateFacts, max = 160): string {
  const party = partyShort(f.party);
  const place = f.boundaryName ? ` in ${f.boundaryName}` : "";
  const election = f.electionName ? f.electionName.replace(/^\d{4}\s+/, "") : null;
  const date = shortDate(f.electionDate);
  const who = `${f.name}${party ? ` (${party})` : ""}`;
  const core = `${f.isIncumbent ? "Incumbent " : ""}${who} is running for ${f.roleTitle}${place}`;
  const when = election ? ` in the ${election}${date ? `, ${date}` : ""}` : date ? `, ${date}` : "";
  const blurb = usableBlurb(f.statement);

  const head = `${core}${when}. `;
  // Richest first: bio trimmed to whatever room is left (needs ~40+ chars to
  // be worth showing), then progressively shorter fallbacks.
  if (blurb && max - head.length >= 40) {
    const withBio = `${head}${clipSentence(blurb, max - head.length)}`;
    if (withBio.length <= max) return withBio;
  }
  const variants = [
    `${core}${when}. Voter ratings, stances and constituent feedback on Choseno.`,
    `${core}${when}.`,
    `${core}.`,
  ];
  return variants.find((v) => v.length <= max) || clipSentence(variants[variants.length - 1], max);
}

const TITLE_MAX = 66;

// First variant that fits; the last always wins if nothing does.
function fitTitle(variants: string[], max = TITLE_MAX) {
  return variants.find((v) => v.length <= max) || variants[variants.length - 1];
}

/**
 * Seat-page <title>, built so the distinctive part (riding, role, who is
 * running) comes first and the whole thing fits a ~60-char SERP title.
 */
export function buildRaceTitle(f: Pick<RaceFacts, "roleTitle" | "boundaryName" | "candidates">, max = TITLE_MAX): string {
  const base = `${f.boundaryName} ${f.roleTitle} 2026`;
  const [a, b] = f.candidates;
  const n = f.candidates.length;
  return fitTitle(
    [
      a && b && n === 2 ? `${base}: ${a.name} vs. ${b.name} | Choseno` : null,
      a && n === 1 ? `${base}: ${a.name} | Choseno` : null,
      a && n > 2 ? `${base}: ${a.name} & ${n - 1} more | Choseno` : null,
      n > 1 ? `${base}: ${n} Candidates | Choseno` : null,
      `${base} | Choseno`,
    ].filter((v): v is string => !!v),
    max
  );
}

/** Candidate <title> (seat-view and /candidacy/ pages): name first, race second. */
export function buildCandidateTitle(f: Pick<CandidateFacts, "name" | "roleTitle" | "boundaryName">, max = TITLE_MAX): string {
  const where = f.boundaryName ? `${f.boundaryName} ` : "";
  return fitTitle(
    [`${f.name} — ${where}${f.roleTitle} Candidate 2026 | Choseno`, `${f.name} — ${f.roleTitle} Candidate 2026 | Choseno`, `${f.name} — 2026 Candidate | Choseno`],
    max
  );
}
