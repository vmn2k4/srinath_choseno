// Edge Function: generate-election-parties-og-image
//
// Public share-card endpoint for an election's "parties & candidates" hub
// (choseno.com/elections/e/[election]). GET ?electionId=<elections.id> -> PNG.
//
// Same architecture as generate-election-og-image (the seat card): renders
// with the service-role key straight from the DB (so nobody can feed it fake
// numbers), caches the PNG in the election-og-images Storage bucket (under
// parties/), and is proxied through src/app/elections/e/[electionSlug]/
// opengraph-image.tsx so the public og:image URL stays same-origin. Deployed
// with --no-verify-jwt (public image endpoint).
//
// The party grouping + hue logic mirrors src/lib/utils/electionParties.ts
// (duplicated: this runs in Deno, outside the Next module graph) -- keep the
// two in sync by eye.
import { ImageResponse } from 'npm:@vercel/og@^0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { PartiesOgCard, type PartyCardRow } from './card.tsx';

const BUCKET = 'election-og-images';
// No TTL: the stored PNG is reused until the election's candidate/seat roster
// changes. Triggers on election_candidates/election_seats stamp
// election_og_state.changed_at; a PNG older than that is re-rendered.
const SIZE = { width: 1200, height: 630 };
// Bump whenever card.tsx's layout/copy changes: it's folded into the cached
// object's path so a deploy invalidates every cached PNG at once.
const CARD_VERSION = 'v1';
const SITE = 'https://www.choseno.com';
const MAX_CARDS = 8;
const AVATARS_PER_CARD = 4;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same hues as the --color-party-* tokens (Tailwind 500-ish); Satori can't read CSS variables.
const HUE: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', orange: '#f97316', green: '#22c55e', yellow: '#facc15',
  teal: '#14b8a6', purple: '#a855f7', pink: '#ec4899', slate: '#94a3b8',
};
const NAME_RULES: Array<[RegExp, string]> = [
  [/republican/, 'red'], [/new democratic|\bndp\b/, 'orange'], [/democrat/, 'blue'], [/conservative/, 'blue'],
  [/green/, 'green'], [/liberal/, 'red'], [/libertarian/, 'yellow'], [/centre\s?bc|centrist/, 'teal'],
  [/one\s?bc/, 'purple'], [/independent|unaffiliated|no affiliation/, 'slate'],
];
const FALLBACK_HUES = ['teal', 'purple', 'pink', 'yellow', 'blue', 'green', 'orange', 'red'];

function hueFor(name: string | null, id: number | null): string {
  if (!name) return HUE.slate;
  const lower = name.toLowerCase();
  const hit = NAME_RULES.find(([re]) => re.test(lower));
  if (hit) return HUE[hit[1]];
  const seed = id ?? [...lower].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return HUE[FALLBACK_HUES[Math.abs(seed) % FALLBACK_HUES.length]];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const electionId = new URL(req.url).searchParams.get('electionId');
  if (!electionId) {
    return new Response('electionId query param is required', { status: 400, headers: CORS_HEADERS });
  }

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const objectPath = `parties/${electionId}-${CARD_VERSION}.png`;
  const refresh = new URL(req.url).searchParams.get('refresh') === '1';

  const cached = await loadCached(supabaseAdmin, objectPath);
  const changedAt = await getChangedAt(supabaseAdmin, electionId);
  const isStale = !cached || (changedAt != null && cached.updatedAt < changedAt);

  // Serving never renders when a stored PNG exists. A fresh render of the
  // 200-candidate card sits near this worker's compute limit and fails
  // (WORKER_RESOURCE_LIMIT, which can't be caught) a good share of the time,
  // so a stale card is served right away with x-og-stale: 1 and the caller
  // asks for ?refresh=1 out-of-band, retrying until a render lands.
  if (!refresh && cached) {
    return new Response(cached.file, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', 'x-og-stale': isStale ? '1' : '0' },
    });
  }
  if (refresh && !isStale) {
    return new Response('fresh', { status: 200, headers: CORS_HEADERS });
  }

  // Either an explicit refresh of a stale/missing card, or the very first
  // request for an election with nothing stored yet.
  try {
    const startedAt = Date.now();
    const png = await renderCard(supabaseAdmin, electionId);
    if (!png) return new Response('Election not found', { status: 404, headers: CORS_HEADERS });

    // If the roster changed while rendering, this PNG is already stale: don't
    // store it, so the next refresh re-renders.
    const changedDuring = await getChangedAt(supabaseAdmin, electionId);
    if (!changedDuring || changedDuring < startedAt) {
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(objectPath, png, { contentType: 'image/png', upsert: true });
      if (uploadError) console.error('parties-og-image upload failed:', uploadError.message);
    }
    if (refresh) return new Response('refreshed', { status: 200, headers: CORS_HEADERS });
    return new Response(png, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', 'x-og-stale': '0' },
    });
  } catch (e) {
    console.error('parties-og-image generation failed:', e);
    return new Response(`OG image generation failed: ${e instanceof Error ? e.message : String(e)}`, {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});

async function getChangedAt(supabaseAdmin: any, electionId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from('election_og_state')
    .select('changed_at')
    .eq('election_id', electionId)
    .maybeSingle();
  return data?.changed_at ? new Date(data.changed_at).getTime() : null;
}

// Staleness comes from the bucket object's own updated_at (no cache table).
async function loadCached(supabaseAdmin: any, objectPath: string): Promise<{ file: Blob; updatedAt: number } | null> {
  const [dir, filename] = objectPath.split('/');
  const { data: listing } = await supabaseAdmin.storage.from(BUCKET).list(dir, { search: filename });
  const meta = listing?.find((f: any) => f.name === filename);
  if (!meta?.updated_at) return null;
  const { data: file, error } = await supabaseAdmin.storage.from(BUCKET).download(objectPath);
  if (error || !file) return null;
  return { file, updatedAt: new Date(meta.updated_at).getTime() };
}

// Satori fetches <img> with no timeout, so photos are pre-fetched with a short
// deadline and inlined as data URIs; anything slow/unsupported -> initial letter.
async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !/image\/(jpeg|png)/.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 400_000) return null;
    return `data:${type};base64,${encodeBase64(bytes)}`;
  } catch {
    return null;
  }
}

// Brand font, served from the site's own /public/fonts. Satori reads woff/ttf
// (not woff2). Cached per isolate; any failure just means the default font.
let fontsPromise: Promise<any[] | undefined> | null = null;
function loadFonts(): Promise<any[] | undefined> {
  fontsPromise ??= (async () => {
    try {
      const [bold, black] = await Promise.all(
        ['PublicSans-Bold.woff', 'PublicSans-Black.woff'].map(async (f) => {
          const r = await fetch(`${SITE}/fonts/${f}`, { signal: AbortSignal.timeout(4000) });
          if (!r.ok) throw new Error(`font ${f} ${r.status}`);
          return await r.arrayBuffer();
        }),
      );
      return [
        { name: 'Public Sans', data: bold, weight: 700, style: 'normal' },
        { name: 'Public Sans', data: black, weight: 900, style: 'normal' },
      ];
    } catch (e) {
      console.error('font load failed, using default:', e);
      return undefined;
    }
  })();
  return fontsPromise;
}

// Mirrors getElectionCandidatesWithParty() + summarizeParties() in the Next app.
async function renderCard(supabaseAdmin: any, electionId: string): Promise<ArrayBuffer | null> {
  const { data: election } = await supabaseAdmin
    .from('elections')
    .select('id, name, election_date, status')
    .eq('id', electionId)
    .maybeSingle();
  // The service role bypasses RLS, so enforce "drafts are private" here.
  if (!election || election.status === 'draft') return null;

  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('election_candidates')
      .select(
        'id, seat_id, election_seats!inner(election_id), profiles!election_candidates_politician_id_fkey!inner(id, full_name, is_test, politician_profiles(avatar_url, political_parties(id, name)))',
      )
      .eq('election_seats.election_id', electionId)
      .eq('profiles.is_test', false)
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const { count: seatCount } = await supabaseAdmin
    .from('election_seats')
    .select('id', { count: 'exact', head: true })
    .eq('election_id', electionId);

  type Cand = { name: string; avatarUrl: string | null; seatId: string };
  const groups = new Map<string, { name: string; id: number | null; cands: Cand[] }>();
  for (const r of rows) {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const pp = Array.isArray(prof?.politician_profiles) ? prof.politician_profiles[0] : prof?.politician_profiles;
    const partyRaw = Array.isArray(pp?.political_parties) ? pp.political_parties[0] : pp?.political_parties;
    // A literal "Independent" party and a missing party are one group.
    const party = partyRaw && !/^independent$/i.test(partyRaw.name || '') ? partyRaw : null;
    const key = party ? `p${party.id}` : 'none';
    const g = groups.get(key) ?? { name: party ? party.name : 'Independents', id: party ? party.id : null, cands: [] };
    g.cands.push({ name: prof?.full_name || 'Candidate', avatarUrl: pp?.avatar_url ?? null, seatId: r.seat_id });
    groups.set(key, g);
  }

  // Biggest party first, the independents group last.
  const sorted = [...groups.values()].sort((a, b) => {
    if (a.id == null) return 1;
    if (b.id == null) return -1;
    return b.cands.length - a.cands.length || a.name.localeCompare(b.name);
  });
  const shown = sorted.slice(0, MAX_CARDS);
  const totalRaces = seatCount || new Set(rows.map((r) => r.seat_id)).size;

  // Prefer candidates who actually have a photo for the avatar strip.
  const previews = shown.map((g) =>
    [...g.cands].sort((a, b) => Number(!!b.avatarUrl) - Number(!!a.avatarUrl)).slice(0, AVATARS_PER_CARD),
  );
  const photos = await Promise.all(previews.map((list) => Promise.all(list.map((c) => toDataUri(c.avatarUrl)))));

  const parties: PartyCardRow[] = shown.map((g, i) => ({
    name: g.name,
    count: g.cands.length,
    raceCount: new Set(g.cands.map((c) => c.seatId)).size,
    hue: hueFor(g.id == null ? null : g.name, g.id),
    avatars: previews[i].map((c, k) => ({ name: c.name, photo: photos[i][k] })),
  }));

  const dateLabel = election.election_date
    ? new Date(`${election.election_date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const image = new ImageResponse(
    PartiesOgCard({
      electionName: election.name,
      dateLabel,
      totalCandidates: rows.length,
      partyCount: sorted.filter((g) => g.id != null).length,
      totalRaces,
      parties,
      hiddenParties: sorted.length - shown.length,
    }) as any,
    { ...SIZE, fonts: await loadFonts() },
  );
  return await image.arrayBuffer();
}
