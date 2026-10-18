// Builds the extension into extension/dist using the repo's own node_modules
// and re-using src/lib/services directly (alias "@" -> src), so the extension
// talks to Supabase through the exact same service functions as the website.
//   node extension/build.mjs          production build (is_test = false)
//   node extension/build.mjs --dev    dev build (posts flagged is_test, like `next dev`)
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dist = path.join(here, "dist");
const dev = process.argv.includes("--dev");

function readEnv() {
  const env = { ...process.env };
  const f = path.join(root, ".env.local");
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}
const env = readEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing (.env.local)");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(path.join(here, "public"), dist, { recursive: true });
cpSync(path.join(here, "src/popup.html"), path.join(dist, "popup.html"));
cpSync(path.join(here, "src/popup.css"), path.join(dist, "popup.css"));

// theme.css: the website's own tokens + every [data-theme] block, lifted from globals.css so the
// extension can never drift from the site (add a theme there and it shows up here on next build).
{
  const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const start = css.indexOf("@theme {");
  let depth = 0, end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) { end = i; break; }
  }
  const base = css.slice(css.indexOf("{", start) + 1, end).split("\n").filter((l) => !/--font-/.test(l)).join("\n");
  const themes = css.match(/\[data-theme="[^"]+"\]\s*\{[^}]*\}/g) ?? [];
  // Tailwind palette entries the tokens above reference (Tailwind itself isn't bundled here).
  const palette = "--color-rose-300:#fda4af;--color-rose-400:#fb7185;--color-rose-500:#f43f5e;--color-amber-300:#fcd34d;--color-amber-500:#f59e0b;--color-orange-300:#fdba74;--color-orange-500:#f97316;--color-emerald-300:#6ee7b7;--color-emerald-500:#10b981;--color-slate-950:#020617;";
  writeFileSync(path.join(dist, "theme.css"), `:root{${palette}\n${base}\n}\n${themes.join("\n")}\n`);
}

await build({
  entryPoints: { popup: path.join(here, "src/popup.tsx"), background: path.join(here, "src/background.ts") },
  outdir: dist,
  bundle: true,
  format: "esm",
  target: "chrome114",
  jsx: "automatic",
  minify: !dev,
  sourcemap: dev,
  nodePaths: [path.join(root, "node_modules")],
  alias: { "@": path.join(root, "src") },
  loader: { ".woff": "file", ".woff2": "file" },
  define: {
    "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
    __SUPABASE_URL__: JSON.stringify(url),
    __SUPABASE_ANON_KEY__: JSON.stringify(anon),
    __SITE_URL__: JSON.stringify(dev ? "http://localhost:3000" : "https://choseno.com"),
  },
  logLevel: "info",
});

// manifest: dev builds are labelled so they can't be mistaken for the real one
if (dev) {
  const mf = path.join(dist, "manifest.json");
  const j = JSON.parse(readFileSync(mf, "utf8"));
  j.name += " (dev)";
  writeFileSync(mf, JSON.stringify(j, null, 2));
}
console.log(`\nBuilt ${dev ? "DEV" : "production"} extension → ${path.relative(root, dist)}`);
