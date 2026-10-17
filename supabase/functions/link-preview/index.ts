// Link preview for the composer and post cards (web + mobile): fetches a
// URL server-side and returns {title, description, image, video, url} from
// its Open Graph / Twitter / <title> tags — the shape saved as
// posts.link_metadata. Replaces the third-party Microlink API, whose free
// tier is rate-limited per client IP (phones on a carrier network share IPs,
// so it routinely refused).
//
// POST { url } -> 200 { title?, description?, image?, video?, url }
//                 or 200 { error } when the page can't be read (never 5xx
//                 for an unreadable page, so clients just skip the card).
// SSRF guarded: http(s) only, no credentials / odd ports, every hop's host
// is resolved and refused if it points at a private/loopback/link-local IP.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Large enough for CNN-style pages whose JSON-LD (video) sits ~500KB in.
const MAX_HTML_BYTES = 1_500_000
const MAX_REDIRECTS = 4
const FETCH_TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX = 500
// Real-browser UA: many news sites serve a stripped page to unknown bots.
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"

type Preview = {
  title?: string
  description?: string
  image?: string
  video?: string
  url: string
}

const cache = new Map<string, { at: number; value: Preview }>()

function json(body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  })
}

// ── SSRF guard ───────────────────────────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase()
    if (v === "::1" || v === "::") return true
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivateIp(mapped[1]) : false
  }
  const p = ip.split(".").map(Number)
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true
  const [a, b] = p
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

async function assertPublicHost(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad scheme")
  if (u.username || u.password) throw new Error("credentials in url")
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("bad port")
  const host = u.hostname.replace(/^\[|\]$/g, "")
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("private host")
  }
  const isIp = /^[\d.]+$/.test(host) || host.includes(":")
  const ips: string[] = isIp ? [host] : []
  if (!isIp) {
    for (const type of ["A", "AAAA"] as const) {
      try {
        ips.push(...(await Deno.resolveDns(host, type)))
      } catch { /* no records of this type */ }
    }
  }
  if (ips.length === 0 || ips.some(isPrivateIp)) throw new Error("private host")
}

// ── fetch with manual, re-validated redirects ────────────────────────────
async function fetchHtml(start: URL): Promise<{ html: string; finalUrl: URL }> {
  let current = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current)
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current)
      continue
    }
    if (!res.ok) throw new Error(`status ${res.status}`)
    const type = res.headers.get("content-type") || ""
    if (!/html|xml/i.test(type)) throw new Error("not html")
    // Read only the first MAX_HTML_BYTES (og tags live in <head>; JSON-LD can sit deeper).
    const reader = res.body!.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    reader.cancel().catch(() => {})
    const buf = new Uint8Array(total)
    let off = 0
    for (const c of chunks) {
      buf.set(c, off)
      off += c.length
    }
    return { html: new TextDecoder().decode(buf), finalUrl: current }
  }
  throw new Error("too many redirects")
}

// ── parsing ──────────────────────────────────────────────────────────────
const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
}
function unescapeHtml(v: string) {
  return v
    .replace(/&(amp|quot|lt|gt|nbsp|#39|#x27);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim()
}

function metaTags(html: string): Map<string, string> {
  const out = new Map<string, string>()
  const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : undefined)
  for (const tag of head.matchAll(/<meta\b[^>]*>/gi)) {
    const t = tag[0]
    const key = t.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    const c = t.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
    const val = c?.[1] ?? c?.[2]
    if (key && val && val.trim() && !out.has(key)) out.set(key, unescapeHtml(val))
  }
  return out
}

// Bot-block interstitials report their own text as the article. Same
// patterns as src/lib/utils/linkPreview.ts.
const BLOCK_TITLE_RE =
  /^(access denied|just a moment|attention required|403\b|forbidden|error 403|are you a robot|robot check|pardon our interruption|request blocked|security check|verifying you are human)/i
function isBlockPage(title?: string, description?: string) {
  return Boolean(
    (title && BLOCK_TITLE_RE.test(title.trim())) ||
      (description && /^reference #[\w.]+/i.test(description.trim())),
  )
}

function titleFromUrlSlug(raw: string): string | undefined {
  try {
    const seg = new URL(raw).pathname.split("/").filter(Boolean).pop() || ""
    const words = decodeURIComponent(seg)
      .replace(/\.(html?|php|aspx?)$/i, "")
      .split(/[-_]+/)
      .filter((w) => w && !/^\d{6,}$/.test(w))
    if (words.length < 3) return undefined
    const text = words.join(" ")
    return text.charAt(0).toUpperCase() + text.slice(1)
  } catch {
    return undefined
  }
}

// News sites (CNN, ...) often skip og:video but describe the clip in JSON-LD
// (VideoObject.contentUrl) or a <video>/<source> tag. Only direct, browser-
// playable files count — anything else would show a dead player.
const PLAYABLE_RE = /\.(mp4|webm|m4v|mov)(\?|$)/i
function findDirectVideo(html: string): string | undefined {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const stack: unknown[] = [JSON.parse(m[1])]
      while (stack.length) {
        const n = stack.pop()
        if (Array.isArray(n)) stack.push(...n)
        else if (n && typeof n === "object") {
          const o = n as Record<string, unknown>
          const type = ([] as unknown[]).concat(o["@type"] ?? []).join(",")
          const url = (o.contentUrl ?? o.embedUrl) as unknown
          if (/VideoObject/.test(type) && typeof url === "string" && PLAYABLE_RE.test(url)) return url
          stack.push(...Object.values(o))
        }
      }
    } catch { /* malformed JSON-LD */ }
  }
  return html.match(/<(?:video|source)\b[^>]*\bsrc\s*=\s*["']([^"']+\.(?:mp4|webm|m4v|mov)[^"']*)["']/i)?.[1]
}

function absolute(v: string | undefined, base: URL): string | undefined {
  if (!v) return undefined
  try {
    const u = new URL(v, base)
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined
  } catch {
    return undefined
  }
}

function parse(html: string, finalUrl: URL, requested: string): Preview {
  const m = metaTags(html)
  let title =
    m.get("og:title") || m.get("twitter:title") ||
    unescapeHtml(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "") || undefined
  let description = m.get("og:description") || m.get("twitter:description") || m.get("description")
  let image = absolute(m.get("og:image") || m.get("og:image:url") || m.get("twitter:image"), finalUrl)
  const ogVideo = m.get("og:video:secure_url") || m.get("og:video:url") || m.get("og:video")
  const video = absolute(
    ogVideo && PLAYABLE_RE.test(ogVideo) ? ogVideo : findDirectVideo(html) || ogVideo,
    finalUrl,
  )
  if (isBlockPage(title, description)) {
    title = titleFromUrlSlug(requested)
    description = undefined
    image = undefined
  }
  return {
    title: title?.slice(0, 300),
    description: description?.slice(0, 500),
    image,
    video,
    url: absolute(m.get("og:url"), finalUrl)?.startsWith(finalUrl.origin)
      ? absolute(m.get("og:url"), finalUrl)!
      : requested,
  }
}

// YouTube serves servers a generic consent page, so ask its oEmbed endpoint
// (public, no key) for the real title and thumbnail instead.
async function youTubePreview(target: URL): Promise<Preview | null> {
  const host = target.hostname.replace(/^(www|m)\./, "")
  if (host !== "youtube.com" && host !== "youtu.be") return null
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target.toString())}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    )
    if (!res.ok) return null
    const j = await res.json()
    return {
      title: j.title,
      description: j.author_name ? `${j.author_name} on YouTube` : undefined,
      image: j.thumbnail_url,
      url: target.toString(),
    }
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "POST only" })

  let raw: string | undefined
  try {
    raw = (await req.json())?.url
  } catch { /* fallthrough */ }
  if (typeof raw !== "string" || raw.length > 2048) return json({ error: "Missing url" })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return json({ error: "Invalid url" })
  }

  const key = target.toString()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return json(hit.value, { "X-Cache": "HIT" })

  const yt = await youTubePreview(target)
  if (yt) {
    cache.set(key, { at: Date.now(), value: yt })
    return json(yt, { "X-Cache": "MISS" })
  }

  try {
    const { html, finalUrl } = await fetchHtml(target)
    const preview = parse(html, finalUrl, key)
    if (!preview.title && !preview.image) return json({ error: "No preview found" })
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
    cache.set(key, { at: Date.now(), value: preview })
    return json(preview, { "X-Cache": "MISS" })
  } catch (e) {
    // Unreadable / blocked page: hand back the slug title if there is one so
    // the card still says something useful.
    const slug = titleFromUrlSlug(key)
    return json(slug ? { title: slug, url: key } : { error: String((e as Error).message) })
  }
})
