// Edge Function: generate-profile-og-image
//
// Generic share-card renderer for pages whose og:image has no single
// "publish" moment to pre-generate at (unlike news articles) -- politician
// wall pages, wall post threads, and candidacy pages. POST
// ?cacheKey=<stable id> with a JSON body { eyebrow, title, subtitle?,
// photoUrl? } -> PNG bytes.
//
// Deliberately does NO database lookups of its own, unlike
// generate-news-og-image / generate-election-og-image. Those two own
// well-defined, single-shape queries; wall/candidacy resolution instead
// carries real business logic already living in
// src/lib/services/politicianWall.ts (merged-wall redirects, contact-info
// fallback enrichment) and src/lib/services/elections.ts. Re-deriving that
// in a second runtime would mean two copies of the same logic drifting
// apart. So the split here is: the calling Next.js route keeps doing the
// DB lookup it already needs anyway (for the page's own metadata -- not new
// cost), and POSTs just the resolved display fields; this function only
// does the actual expensive part (Satori render + PNG encode) and caches
// the result. Same reasoning as the Storage-bucket split in
// generate-news-og-image, just with the lookup responsibility staying on
// the Next.js side instead of moving here.
//
// Cached in the profile-og-images bucket keyed by the caller-supplied
// cacheKey (e.g. "wall/<ghostId>", "candidacy/<candidateId>") with the same
// 24h TTL-by-Storage-object-metadata pattern as
// generate-election-og-image's tryServeCached -- a repeat request for the
// same page within 24h is a cheap Storage read, not a re-render. Since the
// cache key doesn't encode the content itself, this is the same tradeoff
// election/news already accept: the card can be up to 24h stale after a
// profile edit, bounded by this TTL.
//
// --no-verify-jwt on deploy (matches generate-election-og-image /
// generate-news-og-image): the live proxy routes call this with no
// Authorization header, same public-image-endpoint reasoning.
import { ImageResponse } from 'npm:@vercel/og@^0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ProfileOgCard, ProfileStoryCard } from './card.tsx';

const BUCKET = 'profile-og-images';
const TTL_MS = 24 * 60 * 60 * 1000;
const LANDSCAPE_SIZE = { width: 1200, height: 630 };
const STORY_SIZE = { width: 810, height: 1440 };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CardBody {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  photoUrl?: string | null;
  // See the matching doc comment on OgCardInput in card.tsx -- optional,
  // wall-profile-card-only fields. Passed straight through to ProfileOgCard.
  partyName?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const cacheKey = url.searchParams.get('cacheKey');
  if (!cacheKey) {
    return new Response('cacheKey query param is required', { status: 400, headers: CORS_HEADERS });
  }
  // ?format=story renders the 810x1440 vertical asset (9:16, same ratio as
  // Instagram's 1080x1920 recommendation, scaled down 25% -- rendering a
  // remote photo into a full 1080x1920 canvas hit this function's compute
  // limit in testing; the no-photo case rendered fine at full size, so the
  // cost is specifically compositing a fetched image into a large
  // destination area, not the canvas size alone) for posting natively to
  // Instagram/Facebook/Snapchat Stories or as a Reel cover, instead of the
  // default 1200x630 landscape card used for og:image/twitter:image link
  // unfurling. Read from the query string (not the POST body) since the
  // cache check below runs before the body is parsed -- a GET request has
  // no body at all. Suffixed onto the object path (not a separate bucket
  // subfolder) so the existing "wall/<id>.png" landscape cache keys are
  // untouched by this addition.
  const format = url.searchParams.get('format') === 'story' ? 'story' : 'landscape';
  const SIZE = format === 'story' ? STORY_SIZE : LANDSCAPE_SIZE;
  const CardComponent = format === 'story' ? ProfileStoryCard : ProfileOgCard;

  // cacheKey arrives as a "/"-joined path (e.g. "wall/<id>") -- keep the
  // slashes as Storage subdirectories rather than flattening, purely for
  // readability when browsing the bucket; sanitize anything else so a
  // caller can't traverse out of the bucket namespace.
  const safeKey = cacheKey
    .split('/')
    .map((seg) => seg.replace(/[^a-zA-Z0-9_.-]/g, '_'))
    .join('/');
  const objectPath = format === 'story' ? `${safeKey}-story.png` : `${safeKey}.png`;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const cached = await tryServeCached(supabaseAdmin, objectPath);
    if (cached) return cached;

    if (req.method !== 'POST') {
      return new Response('No cached image yet -- POST a card body to render one', {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    const body = (await req.json().catch(() => null)) as CardBody | null;
    if (!body?.eyebrow || !body?.title) {
      return new Response('Body must include at least { eyebrow, title }', { status: 400, headers: CORS_HEADERS });
    }

    const image = new ImageResponse(CardComponent(body) as any, { ...SIZE });
    const png = await image.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, png, { contentType: 'image/png', upsert: true });
    if (uploadError) console.error('profile-og-image upload failed:', uploadError.message);

    return new Response(png, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('profile-og-image generation failed:', message);
    return new Response(`OG image generation failed: ${message}`, { status: 500, headers: CORS_HEADERS });
  }
});

// Mirrors generate-election-og-image's tryServeCached: checks the bucket's
// own object metadata for staleness rather than a separate cache table.
async function tryServeCached(supabaseAdmin: any, objectPath: string): Promise<Response | null> {
  const lastSlash = objectPath.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : objectPath.slice(0, lastSlash);
  const filename = lastSlash === -1 ? objectPath : objectPath.slice(lastSlash + 1);
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
