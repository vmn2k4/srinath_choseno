// Edge Function: fetch-candidates
//
// Given a Choseno election_seats.id, detects which official-data
// jurisdiction its boundary belongs to (see
// docs/ELECTION_DATA_SOURCES.md), live-fetches that jurisdiction's
// current candidate list for this specific district from the official
// government source, and returns it -- WITHOUT writing anything to our
// own official-data tables (federal_election_candidates etc; those stay
// owned by the scripts/sync_*_candidates.py CLI tools). This is a
// read-only preview for the admin UI: the admin sees the fetched list
// and adds whichever candidates are missing via the existing
// add_unregistered_candidate RPC, one click at a time.
//
// This is the browser-callable counterpart to
// scripts/sync_federal_candidates.py / sync_bc_candidates.py /
// sync_manitoba_candidates.py / sync_ontario_candidates.py /
// sync_quebec_candidates.py -- the parsing logic below is a direct port
// of those, verified against the same real data. See that doc for why
// each endpoint/pattern was chosen.
//
// Request: POST { seatId: string }
// Response: { jurisdiction, status: 'ok'|'no_candidates_yet'|'no_event'|'unsupported'|'error',
//              candidates: [{name, party, elected?}], sourceUrl, eventName }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const UA = 'Mozilla/5.0 (compatible; ChosenoCandidateSync/1.0)';

const CA_PROVINCE_BY_PREFIX: Record<string, string> = {
  '10': 'NL', '11': 'PE', '12': 'NS', '13': 'NB', '24': 'QC', '35': 'ON',
  '46': 'MB', '47': 'SK', '48': 'AB', '59': 'BC', '60': 'YT', '61': 'NT', '62': 'NU',
};

const CA_PROVINCIAL_PROPERTY_SIGNATURE: Record<string, string> = {
  ed_abbreviation: 'bc',
  ednameen: 'mb',
  ed_id: 'on',
  nm_cep: 'qc',
  edname2017: 'ab',
  con_num: 'sk',
  dist_no: 'pe',
};

function detectJurisdiction(mapShape: any, roleTitle?: string): string | null {
  if (!mapShape) return null;
  const { country, boundary_type, properties } = mapShape;
  if (country === 'Canada' && boundary_type === 'Federal') return 'ca-federal';
  if (country === 'Canada' && boundary_type === 'Provincial') {
    for (const [key, jurisdiction] of Object.entries(CA_PROVINCIAL_PROPERTY_SIGNATURE)) {
      if (properties && Object.prototype.hasOwnProperty.call(properties, key)) return jurisdiction;
    }
    return null;
  }
  if (country === 'USA' && boundary_type === 'Federal') return 'us-federal';
  // 'State' is shared with Governor (a non-federal office with no data
  // source built for most states yet) -- only the seat's own role_title
  // tells them apart, since both attach to the exact same map_shapes row.
  // 'State Senate'/'State House' are unambiguous (one office each), but are
  // single NATIONAL layers (see ARCHITECTURE.md §14) -- properties.stusps
  // says which specific US state a given district belongs to, same field
  // used for 'State' rows. Must stay in sync with
  // src/services/candidateSync.js's copy of this same function.
  if (country === 'USA' && boundary_type === 'State') {
    const stusps = properties?.stusps?.toLowerCase();
    if (roleTitle === 'U.S. Senator') return 'us-senate';
    if (roleTitle === 'Governor' && stusps) return `us-gov-${stusps}`;
    return null;
  }
  if (country === 'USA' && boundary_type === 'State Senate') {
    const stusps = properties?.stusps?.toLowerCase();
    return stusps ? `us-sen-${stusps}` : null;
  }
  if (country === 'USA' && boundary_type === 'State House') {
    const stusps = properties?.stusps?.toLowerCase();
    return stusps ? `us-hou-${stusps}` : null;
  }
  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function foldAccents(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

async function pickEvent(supabaseAdmin: any, table: string, filterCol: string | null, filterVal: string | null) {
  let q = supabaseAdmin.from(table).select('*');
  if (filterCol) q = q.eq(filterCol, filterVal);
  if (table === 'federal_election_events') {
    // General elections cover every riding; by-elections only cover their own
    // few specific ridings (not tracked structurally) -- a scheduled-but-not-
    // yet-held by-election's event_date can otherwise sort above the actual
    // general election's, pointing most ridings at a VIS EV that doesn't
    // recognize them (confirmed live: redirects to a generic "find your
    // district" page instead of showing candidates).
    q = q.order('is_general', { ascending: false });
  }
  // Same ordering as src/services/candidateSync.js's getCandidateSourceInfo
  // -- must stay in sync so "here's the link" and "here's what fetch
  // shows" never disagree. See that file's comment for why discovered_at
  // is ascending, not descending.
  const { data } = await q.order('event_date', { ascending: false, nullsFirst: false }).order('discovered_at', { ascending: true });
  return data?.[0] || null;
}

// ── Canada federal ──────────────────────────────────────────────────────
async function fetchCaFederal(supabaseAdmin: any, mapShape: any) {
  const event = await pickEvent(supabaseAdmin, 'federal_election_events', null, null);
  if (!event) return { status: 'no_event' };

  const prefix = String(mapShape.code).slice(0, 2);
  const prov = CA_PROVINCE_BY_PREFIX[prefix];
  const url = `https://www.elections.ca/Scripts/vis/Candidates?L=e&ED=${mapShape.code}&EV=${event.id}&EV_TYPE=${event.ev_type}&PROV=${prov}&PROVID=${prefix}&QID=-1&PAGEID=17`;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const html = await res.text();

  const header = /<h3 class="HeaderInfo1">([^<]+)<\/h3>/.exec(html);
  if (!header) return { status: 'error', sourceUrl: url, eventName: event.name };
  if (html.includes('no candidates who have been officially confirmed')) {
    return { status: 'no_candidates_yet', sourceUrl: url, eventName: event.name };
  }

  const rowRe = /alt="(Elected candidate|Candidate)"[^>]*\/>\s*&nbsp;([^<]+?)\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>/gs;
  const candidates = [];
  let m;
  while ((m = rowRe.exec(html))) {
    candidates.push({ name: decodeEntities(m[2]), party: decodeEntities(m[3]), elected: m[1] === 'Elected candidate' });
  }
  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl: url, eventName: event.name };
}

// ── British Columbia ─────────────────────────────────────────────────────
async function fetchBc(supabaseAdmin: any, mapShape: any) {
  const event = await pickEvent(supabaseAdmin, 'provincial_election_events', 'province', 'BC');
  if (!event) return { status: 'no_event' };

  const res = await fetch(event.source_url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return { status: 'no_candidates_yet', sourceUrl: event.source_url, eventName: event.name };
  const html = await res.text();

  // 5 columns per row: hidden district (repeats every row, used for the
  // filter below), hidden numeric sort key, a *visible* district-name repeat
  // (class="bold-on-mobile", only on a district's first candidate row --
  // empty/class="hide-on-mobile" on subsequent rows), candidate name, party.
  // Confirmed directly against a live capture -- the previous version of
  // this regex read name/party from columns 3/4 (the district-repeat column
  // and the candidate name), off by one from the real column 4/5.
  const rowRe = /<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>(\d*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g;
  const candidates = [];
  let m;
  while ((m = rowRe.exec(html))) {
    const district = decodeEntities(m[1]);
    if (district !== mapShape.name) continue;
    candidates.push({ name: decodeEntities(m[4]), party: decodeEntities(m[5]) });
  }
  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl: event.source_url, eventName: event.name };
}

// ── Manitoba ─────────────────────────────────────────────────────────────
async function fetchMb(supabaseAdmin: any, mapShape: any) {
  const event = await pickEvent(supabaseAdmin, 'provincial_election_events', 'province', 'MB');
  if (!event) return { status: 'no_event' };
  const slug = decodeURIComponent(event.source_url.split('/').pop());

  const res = await fetch('https://www.electionsmanitoba.ca/en/Voting/_FilterCandidates', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ EventShortName: slug, edid: String(mapShape.code), ptid: '', status: '', sortby: '1' }).toString(),
  });
  const html = await res.text();

  const blockRe = /<span class="name"><strong>Name: <\/strong>([^<]+)<\/span>.*?<span class="party"><strong>Affiliation: <\/strong>([^<]*)<\/span>/gs;
  const candidates = [];
  let m;
  while ((m = blockRe.exec(html))) {
    let name = decodeEntities(m[1]);
    if (name.includes(',')) {
      const [last, first] = name.split(',', 2);
      name = `${first.trim()} ${last.trim()}`;
    }
    candidates.push({ name, party: decodeEntities(m[2]) });
  }
  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl: event.source_url, eventName: event.name };
}

// ── Ontario ──────────────────────────────────────────────────────────────
async function fetchOn(supabaseAdmin: any, mapShape: any) {
  const event = await pickEvent(supabaseAdmin, 'provincial_election_events', 'province', 'ON');
  if (!event) return { status: 'no_event' };

  const url = `${event.source_url}${mapShape.code}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity' } });
  if (res.status === 404) return { status: 'no_candidates_yet', sourceUrl: url, eventName: event.name };
  if (!res.ok) return { status: 'error', sourceUrl: url, eventName: event.name };
  const data = await res.json();

  const raw = data?.electoralDistrict?.candidates || [];
  const candidates = raw.map((c: any) => ({
    name: `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`.trim(),
    party: c.partyNameEnglish || null,
  })).filter((c: any) => c.name);
  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl: url, eventName: event.name };
}

// ── Quebec ───────────────────────────────────────────────────────────────
async function fetchQc(supabaseAdmin: any, mapShape: any) {
  const event = await pickEvent(supabaseAdmin, 'provincial_election_events', 'province', 'QC');
  if (!event) return { status: 'no_event' };

  const listRes = await fetch(event.source_url, { headers: { 'User-Agent': UA } });
  if (!listRes.ok) return { status: 'no_candidates_yet', sourceUrl: event.source_url, eventName: event.name };
  const { circonscriptions } = await listRes.json();

  const target = foldAccents(mapShape.name).toLowerCase();
  const riding = (circonscriptions || []).find((r: any) => foldAccents(r.nom_circonscription).toLowerCase() === target);
  if (!riding) return { status: 'no_candidates_yet', sourceUrl: event.source_url, eventName: event.name };

  const dataUrl = `https://www.dgeq.org/${riding.code_circonscription}.json`;
  const res = await fetch(dataUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return { status: 'no_candidates_yet', sourceUrl: dataUrl, eventName: event.name };
  const data = await res.json();

  const candidates = (data.candidats || []).map((c: any) => ({
    name: `${(c.prenom || '').trim()} ${(c.nom || '').trim()}`.trim(),
    party: c.abreviationPartiPolitique || null,
  })).filter((c: any) => c.name);
  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl: dataUrl, eventName: event.name };
}

// ── US federal (House + Senate) ──────────────────────────────────────────
// Direct port of scripts/sync_us_federal_candidates.py's office='H'/'S'
// paths -- the FEC's OpenFEC API is queried directly by (cycle, office,
// state[, district]), no event/discovery step needed at all (unlike every
// Canadian jurisdiction above).
const FEC_API_BASE = 'https://api.open.fec.gov/v1/candidates/';

const US_STATE_FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP',
  '72': 'PR', '78': 'VI',
};

// FEC cycles are even years -- the "current" one is the next even year at
// or after today (e.g. any day in 2025 or 2026 maps to cycle 2026). Mirrors
// src/services/candidateSync.js's currentFecCycle() -- keep in sync.
function currentFecCycle(): number {
  const year = new Date().getFullYear();
  return year % 2 === 0 ? year : year + 1;
}

// Shared by House and Senate -- both are plain (cycle, office, state[,
// district]) FEC queries, differing only in whether district is set and
// how the event label reads.
async function fetchFecCandidates(office: 'H' | 'S', state: string, district?: string) {
  const cycle = currentFecCycle();
  const apiKey = Deno.env.get('FEC_API_KEY') || 'DEMO_KEY';
  const baseParams: Record<string, string> = { cycle: String(cycle), office, state, ...(district ? { district } : {}) };
  const eventName = office === 'H' ? `${cycle} U.S. House — ${state}-${district}` : `${cycle} U.S. Senate — ${state}`;
  const sourceUrl = `https://www.fec.gov/data/candidates/?${new URLSearchParams(baseParams).toString()}`;

  let results: any[] = [];
  let page = 1;
  while (true) {
    const url = `${FEC_API_BASE}?${new URLSearchParams({ api_key: apiKey, ...baseParams, per_page: '100', page: String(page) }).toString()}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return { status: 'error', sourceUrl, eventName };
    const data = await res.json();
    results = results.concat(data.results || []);
    const pages = data.pagination?.pages || 1;
    if (page >= pages) break;
    page += 1;
  }

  // Only currently-active filings -- FEC keeps every candidate who's ever
  // filed for this office/district going back decades, unless narrowed by status.
  const candidates = results
    .filter((c: any) => c.candidate_status === 'C')
    .map((c: any) => ({ name: c.name, party: c.party_full || null }));

  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl, eventName };
}

async function fetchUsFederal(_supabaseAdmin: any, mapShape: any) {
  const state = US_STATE_FIPS[mapShape.properties?.statefp];
  const district = String(mapShape.code).slice(2); // GEOID = 2-digit state FIPS + 2-digit district
  if (!state || !district) return { status: 'error', eventName: 'US Federal — House' };
  return fetchFecCandidates('H', state, district);
}

async function fetchUsSenate(_supabaseAdmin: any, mapShape: any) {
  // Confirmed in scripts/sync_us_federal_candidates.py: map_shapes.code for
  // USA/State rows is already the 2-letter USPS abbreviation (no FIPS
  // conversion needed here, unlike House's statefp property).
  const state = String(mapShape.code || '').toUpperCase();
  if (!state) return { status: 'error', eventName: 'US Federal — Senate' };
  return fetchFecCandidates('S', state);
}

// ── US Governor + state legislature ──────────────────────────────────────
// See docs/ELECTION_DATA_SOURCES.md, "USA — Governor + state legislature",
// for how each of these was found/verified. Only the 4 states below have a
// live-fetch handler built so far -- every other researched state is
// manual-link-only (US_STATE_SOURCES in candidateSync.js). A US state
// legislature district's number is the last 3 digits of its GEOID
// (map_shapes.code, e.g. "17007" -> district 7) -- same convention as
// House's 2-digit-FIPS+district GEOID, just 3 digits instead of 2.
type UsStateOffice = 'governor' | 'senate' | 'house';

function usDistrictNumber(mapShape: any): number | null {
  const code = String(mapShape.code || '');
  const n = parseInt(code.slice(2), 10);
  return Number.isFinite(n) ? n : null;
}

// ── Idaho ────────────────────────────────────────────────────────────────
// api-run.voteidaho.gov has no bot-protection of its own (unlike the
// run.voteidaho.gov Angular SPA in front of it) -- confirmed working with a
// plain fetch, just an Origin/Referer header, no cookies/auth needed.
const ID_API_BASE = 'https://api-run.voteidaho.gov/api';
const ID_HEADERS = { 'User-Agent': UA, 'Content-Type': 'application/json', Origin: 'https://run.voteidaho.gov', Referer: 'https://run.voteidaho.gov/' };

async function idahoCurrentElectionId(): Promise<string | null> {
  const res = await fetch(`${ID_API_BASE}/PublicLookup/GetAllElections`, { method: 'POST', headers: ID_HEADERS, body: '{}' });
  if (!res.ok) return null;
  const { data } = await res.json();
  // Only one election has ever been listed live at a time in practice; if
  // more than one ever is, the most recently added is last in the array.
  return data?.[data.length - 1]?.value || null;
}

async function fetchIdaho(office: UsStateOffice, mapShape: any) {
  const sourceUrl = 'https://run.voteidaho.gov/search';
  const electionId = await idahoCurrentElectionId();
  if (!electionId) return { status: 'no_event', sourceUrl, eventName: 'Idaho candidate filing' };

  const district = usDistrictNumber(mapShape);
  let all: any[] = [];
  let pageNumber = 1;
  let eventName = 'Idaho candidate filing';
  // Server caps at 1000 candidates/page regardless of requested pageSize
  // (confirmed directly) -- ~2,500+ candidates file statewide each cycle, so
  // this must actually paginate rather than assume one page covers it.
  while (true) {
    const res = await fetch(`${ID_API_BASE}/FiledCandidates/SearchCandidates`, {
      method: 'POST', headers: ID_HEADERS,
      body: JSON.stringify({ electionId, pageNumber, pageSize: 1000 }),
    });
    if (!res.ok) return { status: 'error', sourceUrl, eventName };
    const { data } = await res.json();
    const batch = data?.candidates || [];
    all = all.concat(batch);
    if (batch[0]?.electionName) eventName = `Idaho — ${batch[0].electionName.trim()}`;
    if (batch.length === 0 || all.length >= (data?.totalCandidates || all.length)) break;
    pageNumber += 1;
  }

  const officeName = office === 'governor' ? 'Governor' : office === 'senate' ? 'State Senator' : 'State Representative';
  const candidates = all
    .filter((c: any) => c.officeName === officeName && c.filingStatusCode === 'A')
    .filter((c: any) => office === 'governor' || parseInt(c.district, 10) === district)
    .map((c: any) => ({ name: c.candidateName, party: c.partyName || null }));

  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl, eventName };
}

// ── Connecticut ──────────────────────────────────────────────────────────
function currentCalendarYear(): number {
  return new Date().getFullYear();
}

// Minimal quoted-field CSV split -- handles embedded commas (e.g. "Elias B
// Silva, Jr") since SEEC's export quotes any field containing one. No
// escaped-quote support needed; none observed in this data.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { fields.push(cur); cur = ''; continue; }
    cur += ch;
  }
  fields.push(cur);
  return fields;
}

async function fetchConnecticut(office: UsStateOffice, mapShape: any) {
  const year = currentCalendarYear();
  const sourceUrl = `https://seec.ct.gov/ecrisreporting/CandidateListDownLoad.aspx?key=${year}CANCSV`;
  const eventName = `${year} Connecticut candidate list`;
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return { status: 'error', sourceUrl, eventName };
  const text = await res.text();
  // Columns: Candidate, Committee Name, Office Sought, District, Party,
  // CEP Status, CEP Grant, Committee Status, Election Date -- confirmed
  // directly against the live export.
  const rows = text.split(/\r?\n/).filter(Boolean).slice(1).map(parseCsvLine);

  const district = usDistrictNumber(mapShape);
  const officeName = office === 'governor' ? 'Governor' : office === 'senate' ? 'State Senator' : 'State Representative';
  const candidates = rows
    .filter(r => (r[2] || '').trim() === officeName)
    .filter(r => office === 'governor' || parseInt((r[3] || '').trim(), 10) === district)
    .map(r => ({ name: (r[0] || '').trim(), party: (r[4] || '').trim() || null }))
    .filter(c => c.name);

  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl, eventName };
}

// ── Colorado ─────────────────────────────────────────────────────────────
// NOT wired into HANDLERS -- parsing logic below is verified correct against
// real data (see docs/ELECTION_DATA_SOURCES.md), but coloradosos.gov returns
// 403 specifically to this Edge Function's egress (confirmed: the identical
// request succeeds from a plain dev-machine curl, same URL/UA, so this is a
// WAF blocking Supabase/Deno Deploy's known cloud IP ranges, not a bug here).
// Kept in source for whenever that's worked around (e.g. a proxy, or if
// Colorado's WAF posture changes) -- US_STATE_SOURCES in candidateSync.js
// correctly marks Colorado hasFetch:false in the meantime.
async function fetchColorado(office: UsStateOffice, mapShape: any) {
  const sourceUrl = 'https://www.coloradosos.gov/pubs/elections/vote/primaryCandidates.html';
  const eventName = 'Colorado primary candidate list';
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return { status: 'error', sourceUrl, eventName };
  const html = await res.text();

  const district = usDistrictNumber(mapShape);
  const officeName = office === 'governor' ? 'Governor' : office === 'senate' ? 'State Senate' : 'State House of Representatives';
  // Plain 5-column table, no class names: name, office, district, party, write-in(Y/N).
  const rowRe = /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>[YN]<\/td>\s*<\/tr>/g;
  const candidates: { name: string; party: string }[] = [];
  let m;
  while ((m = rowRe.exec(html))) {
    const [, rawName, off, dist, party] = m;
    if (off.trim() !== officeName) continue;
    if (office !== 'governor' && parseInt(dist.trim(), 10) !== district) continue;
    candidates.push({ name: decodeEntities(rawName.replace(/<[^>]+>/g, '')), party: party.trim() });
  }
  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl, eventName };
}

// ── Hawaii ───────────────────────────────────────────────────────────────
async function fetchHawaii(office: UsStateOffice, mapShape: any) {
  const sourceUrl = 'https://ags.hawaii.gov/campaign/ballot-legal-name/';
  const eventName = 'Hawaii Campaign Spending Commission candidate list';
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return { status: 'error', sourceUrl, eventName };
  const html = await res.text();

  const district = usDistrictNumber(mapShape);
  // Plain 4-column table: Contests, Party, Ballot Name ("LAST, First"), Legal Name.
  const rowRe = /<tr>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<\/tr>/g;
  const candidates: { name: string; party: string }[] = [];
  let m;
  while ((m = rowRe.exec(html))) {
    const [, contest, party, rawBallotName] = m;
    const c = contest.trim().toUpperCase();
    let matches = false;
    if (office === 'governor') {
      matches = c === 'GOVERNOR';
    } else {
      const distRe = office === 'senate' ? /^STATE SENATOR, DIST (\d+)$/ : /^STATE REPRESENTATIVE, DIST (\d+)$/;
      const dm = distRe.exec(c);
      matches = !!dm && parseInt(dm[1], 10) === district;
    }
    if (!matches) continue;
    let name = decodeEntities(rawBallotName);
    if (name.includes(',')) {
      const [last, first] = name.split(',', 2);
      name = `${first.trim()} ${last.trim()}`;
    }
    candidates.push({ name, party: decodeEntities(party) });
  }
  return { status: candidates.length ? 'ok' : 'no_candidates_yet', candidates, sourceUrl, eventName };
}

const HANDLERS: Record<string, (admin: any, mapShape: any) => Promise<any>> = {
  'ca-federal': fetchCaFederal,
  bc: fetchBc,
  mb: fetchMb,
  on: fetchOn,
  qc: fetchQc,
  'us-federal': fetchUsFederal,
  'us-senate': fetchUsSenate,
  'us-gov-id': (_a, m) => fetchIdaho('governor', m),
  'us-sen-id': (_a, m) => fetchIdaho('senate', m),
  'us-hou-id': (_a, m) => fetchIdaho('house', m),
  'us-gov-ct': (_a, m) => fetchConnecticut('governor', m),
  'us-sen-ct': (_a, m) => fetchConnecticut('senate', m),
  'us-hou-ct': (_a, m) => fetchConnecticut('house', m),
  'us-gov-co': (_a, m) => fetchColorado('governor', m),
  'us-sen-co': (_a, m) => fetchColorado('senate', m),
  'us-hou-co': (_a, m) => fetchColorado('house', m),
  'us-gov-hi': (_a, m) => fetchHawaii('governor', m),
  'us-sen-hi': (_a, m) => fetchHawaii('senate', m),
  'us-hou-hi': (_a, m) => fetchHawaii('house', m),
};

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { seatId } = await req.json();
    if (!seatId) return new Response(JSON.stringify({ error: 'seatId is required' }), { status: 400, headers: corsHeaders });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: seat, error: seatError } = await supabaseAdmin
      .from('election_seats')
      .select('id, role_title, map_shapes(id, name, boundary_type, country, code, properties)')
      .eq('id', seatId)
      .maybeSingle();
    if (seatError || !seat) {
      return new Response(JSON.stringify({ error: 'Seat not found' }), { status: 404, headers: corsHeaders });
    }

    const jurisdiction = detectJurisdiction(seat.map_shapes, seat.role_title);
    if (!jurisdiction || !HANDLERS[jurisdiction]) {
      return new Response(JSON.stringify({ jurisdiction, status: 'unsupported', candidates: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = await HANDLERS[jurisdiction](supabaseAdmin, seat.map_shapes);
    return new Response(JSON.stringify({ jurisdiction, candidates: [], ...result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ status: 'error', error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
});
