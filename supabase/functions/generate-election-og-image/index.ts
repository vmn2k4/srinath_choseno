// Edge Function: generate-election-og-image
//
// Public share-card endpoint for an election seat's "Community Support"
// standings. GET ?seatId=<election_seats.id> -> PNG bytes.
//
// Renders the SAME data every visitor already sees on the seat page's
// Community Support tab (ElectionResultsPanel.tsx -- same
// politician_supporters-backed get_politician_engagement_summaries RPC, no
// new field/table) into a share-card image, ALL candidates with photo/party/
// vote-share bar. First request for a given seat renders it live and caches
// the PNG in the election-og-images Storage bucket; every request within 24h
// of that gets the cached file straight back, no re-render. After 24h the
// next request regenerates.
//
// Deliberately server-authoritative: this runs with the service-role key and
// derives the numbers itself from the DB, so nobody can hand it fake vote
// counts to render -- the alternative (a client renders the image and
// uploads it) would let a visitor fabricate a "who's leading" card and get
// it distributed as if Choseno produced it.
//
// Called from src/app/elections/seat/[seatId]/opengraph-image.tsx, which
// proxies these bytes through so the public og:image URL stays same-origin
// (choseno.com/...), falling back to the old live next/og render if this
// function is ever unreachable. Public image endpoint -- deployed with
// --no-verify-jwt (see Supabase's own "Generating OG Images" example), so no
// Authorization header is required to fetch it.
import { ImageResponse } from 'npm:@vercel/og@^0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ElectionOgCard } from './card.tsx';

const BUCKET = 'election-og-images';
const TTL_MS = 24 * 60 * 60 * 1000;
const SIZE = { width: 1200, height: 630 };
// Bump this whenever card.tsx's layout/copy changes. It's folded into the
// cached object's path, so a deploy invalidates every cached PNG instantly
// instead of waiting out the 24h TTL -- without this, a design fix can sit
// behind a stale cached image (rendered by the OLD code) for up to a day
// after the fix ships, which reads as "the image generation is broken"
// even though the function itself is fine. Old-version objects just become
// orphaned in the bucket; harmless, and cheap enough not to bother pruning.
const CARD_VERSION = 'v3';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const seatId = url.searchParams.get('seatId');
  if (!seatId) {
    return new Response('seatId query param is required', { status: 400, headers: CORS_HEADERS });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const objectPath = `seat/${seatId}-${CARD_VERSION}.png`;

  try {
    const cached = await tryServeCached(supabaseAdmin, objectPath);
    if (cached) return cached;

    const png = await renderCard(supabaseAdmin, seatId);
    if (!png) return new Response('Seat not found', { status: 404, headers: CORS_HEADERS });

    // Best-effort cache write. If the upload fails (bucket hiccup, RLS
    // surprise, etc.) this request still returns a correct, freshly-rendered
    // image -- it just means the next request re-renders instead of reusing
    // a stored copy, not a broken response for this visitor.
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, png, { contentType: 'image/png', upsert: true });
    if (uploadError) console.error('election-og-image upload failed:', uploadError.message);

    return new Response(png, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (e) {
    console.error('election-og-image generation failed:', e);
    return new Response(
      `OG image generation failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500, headers: CORS_HEADERS },
    );
  }
});

// Checks the bucket's own object metadata for staleness rather than a
// separate cache table -- no new schema needed, Storage already tracks
// updated_at per object. `list()` with `search` is cheap (no file download)
// so a warm cache-hit path never pays for a wasted download+ISO-parse when
// the object turns out to be stale.
async function tryServeCached(supabaseAdmin: any, objectPath: string): Promise<Response | null> {
  const [dir, filename] = objectPath.split('/');
  const { data: listing } = await supabaseAdmin.storage.from(BUCKET).list(dir, { search: filename });
  const meta = listing?.find((f: any) => f.name === filename);
  if (!meta?.updated_at) return null;

  const age = Date.now() - new Date(meta.updated_at).getTime();
  if (age >= TTL_MS) return null;

  const { data: file, error } = await supabaseAdmin.storage.from(BUCKET).download(objectPath);
  if (error || !file) return null;

  return new Response(file, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  });
}

// Mirrors getCandidatesBySeatIds/getPoliticianEngagementSummaries from
// src/lib/services/elections.ts + ratings.ts (same join shape, same RPC) --
// duplicated here rather than imported because this runs in Deno, outside
// the Next.js module graph those files live in.
async function renderCard(supabaseAdmin: any, seatId: string): Promise<ArrayBuffer | null> {
  const { data: seat } = await supabaseAdmin
    .from('election_seats')
    .select('id, role_title, map_shapes(name), elections(election_date)')
    .eq('id', seatId)
    .maybeSingle();
  if (!seat) return null;

  const { data: candidatesRaw } = await supabaseAdmin
    .from('election_candidates')
    .select(
      'id, profiles!election_candidates_politician_id_fkey!inner(id, full_name, is_test, politician_profiles(avatar_url, political_parties(name)))',
    )
    .eq('seat_id', seatId)
    .eq('profiles.is_test', false);

  const candidates = candidatesRaw || [];
  const politicianIds = candidates.map((c: any) => c.profiles?.id).filter(Boolean);

  const supporterByPolitician = new Map<string, number>();
  if (politicianIds.length > 0) {
    const { data: engagement } = await supabaseAdmin.rpc('get_politician_engagement_summaries', {
      p_politician_ids: politicianIds,
      p_include_test: false,
    });
    for (const row of engagement || []) supporterByPolitician.set(row.politician_id, row.supporter_count || 0);
  }

  const rows = candidates
    .map((c: any) => {
      const pol = c.profiles?.politician_profiles;
      const polEntry = Array.isArray(pol) ? pol[0] : pol;
      const partyRaw = polEntry?.political_parties;
      const party = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw;
      return {
        name: c.profiles?.full_name || 'Candidate',
        avatarUrl: polEntry?.avatar_url || null,
        partyName: party?.name || null,
        supporterCount: (c.profiles?.id && supporterByPolitician.get(c.profiles.id)) || 0,
      };
    })
    .sort((a: any, b: any) => b.supporterCount - a.supporterCount);

  const totalSupport = rows.reduce((s: number, r: any) => s + r.supporterCount, 0);
  const topCount = rows[0]?.supporterCount ?? 0;

  const finalRows = rows.map((r: any) => ({
    ...r,
    pct: totalSupport > 0 ? Math.round((r.supporterCount / totalSupport) * 1000) / 10 : 0,
    isTop: totalSupport > 0 && r.supporterCount === topCount,
  }));

  const electionDateLabel = seat.elections?.election_date
    ? new Date(seat.elections.election_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const asOfLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const image = new ImageResponse(
    ElectionOgCard({
      roleTitle: seat.role_title || 'Electoral Seat',
      boundaryName: seat.map_shapes?.name || 'District',
      candidates: finalRows,
      electionDateLabel,
      asOfLabel,
    }) as any,
    { ...SIZE },
  );

  return await image.arrayBuffer();
}
