// Renders the two images for the BC 2026 "where each party stands" news article:
//   share-card.png  1200x630  -> og:image / twitter:image (readable as a thumbnail)
//   grid.png        1200 wide -> article-page hero (trimmed party x issue grid)
// Run from repo root:  node scripts/bc_election_share_images/render.mjs [outDir]
// Edit DATA below when announcements land, then re-render and re-upload.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] || "scripts/bc_election_share_images/out";
mkdirSync(OUT, { recursive: true });

const PARTIES = [
  { key: "ndp", name: "NDP", leader: "Eby", color: "#e8710a" },
  { key: "con", name: "Conservatives", leader: "Doerkson", color: "#1e4fa3" },
  { key: "grn", name: "Greens", leader: "Lowan", color: "#2e8b3d" },
  { key: "one", name: "OneBC", leader: "Brodie", color: "#0f766e" },
];

// kind: p = pledge, o = opposes, u = unclear/general, undefined = nothing published yet
const ROWS = [
  ["Taxes", [
    ["p", "Higher rates over $190K"],
    ["p", "No new taxes; basic exemption to $32K"],
    ["p", "Wealth tax over $50M"],
    ["p", "Cut every bracket 25%"],
  ]],
  ["Cost of living & housing", [
    ["p", "10¢ fuel-tax cut; grocery price guard; unsold-condo tax"],
    ["p", "No PST on Canadian alcohol"],
    ["p", "26,000 affordable homes a year; free child care by 2031"],
    ["p", "Cut PST by 2 points"],
  ]],
  ["Health care", [
    ["p", "8 MRIs, 10 CTs; 20 primary-care clinics"],
    ["p", "Hold funding; $50M rural fund; wait-times panel"],
    ["p", "Health centre in every riding"],
    ["p", "Allow private care"],
  ]],
  ["Seniors", [
    ["p", "500 home-care workers; free shingles shot"],
    ["p", "Portable care funding; free shingles shot"],
    ["p", "Raise SAFER rent cut-off to $48K"],
    null,
  ]],
  ["ICBC", [
    ["p", "Keep no-fault; freeze rates to 2030"],
    ["p", "Hybrid system; right to sue for serious injury"],
    null,
    null,
  ]],
  ["Energy", [
    ["p", "Back LNG Phase 2; critical minerals"],
    ["p", "Triple LNG by 2035; Pacific Link pipeline"],
    ["o", "No new pipelines or tankers"],
    ["p", "Oil pipeline to north coast"],
  ]],
  ["DRIPA", [
    ["u", "Position unclear"],
    ["p", "Repeal"],
    null,
    ["p", "Repeal; Indian Act too"],
  ]],
  ["Drugs & safety", [
    null,
    ["p", "250 police, 500 RCMP; end safe supply"],
    ["p", "Decriminalize; regulated alternatives"],
    ["p", "End safe supply; involuntary rehab"],
  ]],
];

// Summary rows shown above / below the issue rows (order matches PARTIES). All from the article.
const TOP_ROWS = [
  ["Core pitch", [
    "Stand up to Trump; warns Conservatives mean cuts",
    "No new taxes, a tax cut, balance the budget by deregulating",
    "Tax big wealth to pay for child care, transit, housing",
    "Cut taxes 25%, repeal DRIPA, allow private care",
  ]],
  ["Could mean for you (party claims)", [
    "Up to $700/yr on groceries, ~$500/yr on ICBC; 96% pay no new income tax",
    "Up to $1,000/yr tax cut; ~$2,000 for the average couple",
    "Free child care by 2031; free transit phased in for under-25s and 65+",
    "25% off every income-tax bracket; 2 points off PST",
  ]],
];
const BOTTOM_ROWS = [
  ["Biggest open question", [
    "DRIPA stance; how the ICBC freeze is paid for",
    "No costing yet; interim leader after Findlay quit",
    "Can a 2-seat party hold the balance of power?",
    "No costing; may split the right-of-centre vote",
  ]],
  ["On your ballot?", [
    "92 of 93 ridings",
    "93 of 93 ridings",
    "73 of 93 ridings",
    "33 of 93 ridings",
  ]],
];

const POLL = [ // Liaison Strategies, Oct 7-8
  { key: "con", v: 43 }, { key: "ndp", v: 37 }, { key: "grn", v: 10 }, { key: "one", v: 4 },
];
const RIDINGS = { ndp: 92, con: 93, grn: 73, one: 33 };
const P = Object.fromEntries(PARTIES.map((p) => [p.key, p]));

const BASE = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
`;

const shareCard = `<!doctype html><meta charset="utf-8"><style>${BASE}
body{width:1200px;height:630px;background:#12141f;color:#f8fafc;padding:48px 56px;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center}
.tag{font-size:20px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fdba74}
.brand{display:flex;align-items:center;gap:10px;background:#f97316;border-radius:999px;padding:8px 22px;font-size:28px;font-weight:900;color:#fff}
h1{font-size:72px;line-height:1.04;font-weight:900;letter-spacing:-.02em;margin-top:26px}
h1 span{color:#f97316}
.sub{font-size:26px;color:#94a3b8;margin-top:14px;font-weight:600}
.parties{display:flex;gap:14px;margin-top:auto}
.party{flex:1;background:#1c2033;border-radius:14px;border-top:8px solid var(--c);padding:14px 16px 14px}
.party .pct{font-size:50px;font-weight:900;line-height:1}
.party .nm{font-size:22px;font-weight:800;margin-top:6px}
.party .ld{font-size:17px;color:#94a3b8;font-weight:600}
.pollnote{font-size:16px;color:#94a3b8;margin-top:10px;font-weight:600}
.dates{display:flex;gap:12px;margin-top:18px}
.d{flex:1;background:#f1f5f9;color:#0f172a;border-radius:12px;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;font-size:21px;font-weight:700}
.d b{font-size:25px;font-weight:900}
.d.vote{background:#f97316;color:#fff}
</style>
<div class="top"><div class="tag">Choseno Civic Briefing · Updated Oct. 9</div><div class="brand">Choseno</div></div>
<h1>BC Election 2026:<br><span>Where the parties stand</span></h1>
<div class="sub">Taxes, health care, ICBC, DRIPA and more, side by side</div>
<div class="parties">${POLL.map(({ key, v }) => `<div class="party" style="--c:${P[key].color}"><div class="pct">${v}%</div><div class="nm">${P[key].name}</div><div class="ld">${P[key].leader} · ${RIDINGS[key]} ridings</div></div>`).join("")}</div>
<div class="pollnote">Latest poll (Liaison, Oct. 7–8): the race is close. Pollara had the NDP and Conservatives tied at 38.</div>
<div class="dates"><div class="d">Debate <b>Oct. 14</b></div><div class="d">Advance voting <b>Oct. 16–21</b></div><div class="d vote">Vote <b>Oct. 24</b></div></div>
`;

const cell = (c) => {
  if (!c) return `<div class="cell none">Nothing yet</div>`;
  const [k, t] = c;
  const pre = k === "o" ? "✕ " : k === "u" ? "? " : "";
  return `<div class="cell ${k}">${pre}${t}</div>`;
};

const grid = `<!doctype html><meta charset="utf-8"><style>${BASE}
body{width:1200px;background:#fdf6ec;padding:36px}
.card{background:#fff;border:2px solid #f0d9b8;border-radius:28px;padding:36px 36px 28px}
.tag{display:inline-block;background:#fde6d3;color:#b4451f;font-weight:800;font-size:17px;letter-spacing:.06em;text-transform:uppercase;padding:9px 18px;border-radius:999px}
h1{font-size:54px;line-height:1.08;font-weight:900;color:#12141f;letter-spacing:-.02em;margin-top:20px}
.sub{font-size:22px;color:#475569;margin-top:10px;line-height:1.35}
.table{display:grid;grid-template-columns:140px repeat(4,1fr);gap:8px;margin-top:26px}
.h{border-radius:12px;color:#fff;text-align:center;padding:12px 4px}
.h b{display:block;font-size:20px;font-weight:900}
.h i{display:block;font-style:normal;font-size:15px;opacity:.9;margin-top:2px}
.rl{display:flex;align-items:center;font-weight:900;font-size:16px;color:#12141f;padding-right:6px}
.cell{border-radius:10px;padding:10px 10px;font-size:16px;line-height:1.25;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;min-height:78px;color:#0f172a}
.cell.p{background:#fff;border:2px solid #cbd5e1;border-left:8px solid var(--c)}
.cell.o{background:#fee2e2;border:2px solid #f87171;color:#7f1d1d}
.cell.u{background:#fef3c7;border:2px solid #f59e0b;color:#78350f}
.cell.s{background:#fff7ed;border:2px solid #fed7aa;font-size:15px;font-weight:700}
.cell.q{background:#f1f5f9;border:2px dashed #94a3b8;font-size:15px}
.cell.b{background:#12141f;color:#fff;font-size:17px;font-weight:900;min-height:52px}
.cell.none{background:#f1f5f9;color:#94a3b8;font-weight:600;font-size:14px}
.legend{display:flex;gap:22px;margin-top:16px;font-size:15px;color:#475569;font-weight:600}
.legend span:before{content:"";display:inline-block;width:14px;height:14px;border-radius:4px;margin-right:7px;vertical-align:-2px;border:2px solid #cbd5e1}
.legend .l1:before{background:#fff;border-left:6px solid #64748b}.legend .l2:before{background:#fee2e2;border-color:#f87171}.legend .l3:before{background:#fef3c7;border-color:#f59e0b}.legend .l4:before{background:#f1f5f9}
.band{display:flex;gap:12px;margin-top:22px}
.d{flex:1;background:#12141f;color:#fff;border-radius:14px;padding:14px 18px;font-size:18px;font-weight:700;display:flex;justify-content:space-between;align-items:center}
.d b{font-size:22px;font-weight:900;color:#fdba74}
.d.vote{background:#f97316}.d.vote b{color:#fff}
.poll{margin-top:16px;font-size:18px;color:#12141f;line-height:1.4}
.poll b{font-weight:900}
.note{margin-top:12px;font-size:15px;color:#64748b;line-height:1.4}
.foot{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:16px;border-top:2px solid #f0d9b8;font-size:17px;font-weight:700;color:#475569}
.foot .b{color:#b4451f;font-size:24px;font-weight:900}
.foot .cta{background:#f97316;color:#fff;padding:9px 18px;border-radius:999px;font-weight:800}
</style>
<div class="card">
<span class="tag">★ Choseno Civic Briefing</span>
<h1>BC Election 2026: Where the Parties Stand</h1>
<div class="sub">Pick the issue you care about most and read across. As of day 18 (Oct. 9); full platforms are still to come.</div>
<div class="table">
<div></div>${PARTIES.map((p) => `<div class="h" style="background:${p.color}"><b>${p.name}</b><i>${p.leader}</i></div>`).join("")}
${TOP_ROWS.map(([label, cells]) => `<div class="rl">${label}</div>${cells.map((t) => `<div class="cell s">${t}</div>`).join("")}`).join("")}
${ROWS.map(([label, cells]) => `<div class="rl">${label}</div>${cells.map((c, i) => cell(c).replace('class="cell', `style="--c:${PARTIES[i].color}" class="cell`)).join("")}`).join("")}
${BOTTOM_ROWS.map(([label, cells], r) => `<div class="rl">${label}</div>${cells.map((t) => `<div class="cell ${r ? "b" : "q"}">${t}</div>`).join("")}`).join("")}
</div>
<div class="legend"><span class="l1">Has pledged</span><span class="l2">Opposes</span><span class="l3">Unclear / general</span><span class="l4">Nothing published yet</span></div>
<div class="band"><div class="d">Leaders' debate <b>Oct. 14</b></div><div class="d">Advance voting <b>Oct. 16–21</b></div><div class="d vote">Voting day <b>Oct. 24</b></div></div>
<div class="poll"><b>Latest poll (Liaison, Oct. 7–8):</b> Conservatives 43, NDP 37, Greens 10, OneBC 4. The race is close: Pollara had the NDP and Conservatives tied at 38.</div>
<div class="note">Dollar figures and savings are the parties' own claims, and most plans are not costed. Sources: party announcements and policy pages, Oct. 1–9.</div>
<div class="foot"><span class="b">★ Choseno</span><span class="cta">Find your riding: choseno.com/find-my-district</span></div>
</div>`;

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
async function shot(html, file, vp, scale, full) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: scale });
  await page.setContent(html);
  await page.screenshot({ path: join(OUT, file), fullPage: full });
  await page.close();
}
await shot(shareCard, "share-card.png", { width: 1200, height: 630 }, 1, false);
await shot(grid, "grid.png", { width: 1200, height: 900 }, 2, true);
await browser.close();
console.log("wrote", OUT);
