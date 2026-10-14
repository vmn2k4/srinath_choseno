// Uploads the rendered PNGs to the news-images bucket and points the article at them:
//   grid.png       -> news_articles.hero_image_url (on-page hero)
//   share-card.png -> news_articles.content.shareImageUrl (og:image / twitter:image)
// Usage: node scripts/bc_election_share_images/publish.mjs <outDir>   (needs .env.local)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SLUG = "bc-election-2026-where-each-party-stands";
const dir = process.argv[2];
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const ts = Date.now();

async function up(file, name) {
  const path = `heroes/${SLUG}-${name}-${ts}.png`;
  const { error } = await sb.storage.from("news-images").upload(path, readFileSync(join(dir, file)), { contentType: "image/png", upsert: false });
  if (error) throw error;
  return sb.storage.from("news-images").getPublicUrl(path).data.publicUrl;
}

const { data: row, error: e0 } = await sb.from("news_articles").select("id, hero_image_url, content").eq("slug", SLUG).single();
if (e0) throw e0;
console.log("previous hero:", row.hero_image_url);
const gridUrl = await up("grid.png", "grid");
const cardUrl = await up("share-card.png", "share");
const content = { ...row.content, shareImageUrl: cardUrl, heroImageAlt: "Grid comparing where the BC NDP, Conservatives, Greens and OneBC stand on taxes, health care, ICBC, DRIPA and more, with election dates" };
const { error: e1 } = await sb.from("news_articles").update({ hero_image_url: gridUrl, content }).eq("id", row.id);
if (e1) throw e1;
console.log("hero:", gridUrl, "\nshare:", cardUrl);
