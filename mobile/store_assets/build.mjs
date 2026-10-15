// Renders the Play Store graphics (feature graphic + phone screenshots) from
// the real app screenshots in ./src. Run: node store_assets/build.mjs
import { chromium } from "../../node_modules/playwright-core/index.mjs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(new URL(import.meta.url).pathname);
const img = (n) => pathToFileURL(path.join(here, "src", `${n}.png`)).href;
const logo = pathToFileURL(path.join(here, "play", "icon-512.png")).href;

const css = `
*{box-sizing:border-box;margin:0}
body{font-family:Inter,system-ui,sans-serif;color:#fff}
.bg{background:radial-gradient(120% 80% at 80% 0%,#1e3a8a 0%,#0f172a 60%)}
.accent{color:#fb923c}
`;

const shots = [
  ["01-social-feed-local-politics", "feed", "The social network", "for local politics", "Discuss your local issues with your neighbours"],
  ["02-rate-your-representatives", "rate", "Review your", "elected representatives", "Rate office holders and share your feedback"],
  ["03-find-representatives", "reps", "Find who", "represents you", "From city hall to the legislature"],
  ["04-local-elections", "elections", "See who's running", "near you", "Local elections and open races"],
  ["05-back-candidates", "seat", "Back the candidates", "you support", "Share your picks with neighbours"],
  ["06-civic-news", "news", "Civic news for", "your community", "Stories tied to your area"],
];

const phone = (n, w) => `
<div style="width:${w}px;border-radius:${w*0.095}px;padding:${w*0.022}px;background:#0b1220;
 box-shadow:0 0 0 ${w*0.006}px #334155,0 40px 90px rgba(0,0,0,.55)">
 <img src="${img(n)}" style="display:block;width:100%;border-radius:${w*0.075}px"></div>`;

const screenshotHtml = ([, n, a, b, sub]) => `<style>${css}</style>
<div class="bg" style="width:1080px;height:1920px;position:relative;overflow:hidden;text-align:center">
 <img src="${logo}" style="width:84px;height:84px;border-radius:20px;margin-top:70px">
 <div style="font-size:84px;font-weight:800;line-height:1.05;margin-top:34px;letter-spacing:-2px">${a}<br><span class="accent">${b}</span></div>
 <div style="font-size:34px;color:#cbd5e1;margin-top:22px">${sub}</div>
 <div style="position:absolute;left:50%;top:520px;transform:translateX(-50%)">${phone(n, 700)}</div>
</div>`;

const featureHtml = `<style>${css}</style>
<div class="bg" style="width:1024px;height:500px;position:relative;overflow:hidden">
 <img src="${logo}" style="width:72px;height:72px;border-radius:18px;position:absolute;left:64px;top:62px">
 <div style="position:absolute;left:64px;top:165px;font-size:46px;font-weight:800;line-height:1.05;letter-spacing:-1.5px">The social network<br>for local politics.<br><span class="accent">Talk to your neighbours.</span></div>
 <div style="position:absolute;left:64px;top:410px;font-size:24px;color:#cbd5e1">Choseno · Rate your reps · Follow local elections</div>
 <div style="position:absolute;left:640px;top:70px;transform:rotate(6deg)">${phone("feed", 230)}</div>
 <div style="position:absolute;left:850px;top:120px;transform:rotate(6deg)">${phone("rate", 230)}</div>
</div>`;


// ── Sample feed screen: the app's real header + tab bar (cropped from an
// emulator screenshot) around illustrative neighbourhood posts. The posts are
// generic sample content — no named officials, no real users.
const posts = [
  ["7f3a2c", "2h", "The buses along Marine Drive are packed every morning by 7:30. Would love to see more frequency before the next budget.", 48, 14],
  ["b91d04", "5h", "Council is voting on a new rental housing proposal in our area. What matters most to you: family-size units or transit access?", 31, 22],
  ["2c68e1", "1d", "After-school programs at our local school lost funding again. Other parents here, are you hearing the same?", 67, 19],
  ["e45a90", "1d", "Good to see the park upgrade finished. New playground and lighting. What should the neighbourhood push for next?", 24, 6],
];
const person = `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`;
const card = ([id, t, text, up, c]) => `
<div style="border:3px solid #e2e8f0;border-radius:50px;padding:52px 52px 44px;background:#fff;margin-bottom:34px">
 <div style="display:flex;align-items:center;gap:26px">
  <div style="width:96px;height:96px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center">${person}</div>
  <div style="font-size:46px;font-weight:600;color:#475569">Ghost ${id}</div>
  <div style="font-size:42px;color:#94a3b8">${t}</div>
 </div>
 <div style="font-size:55px;line-height:1.42;color:#0f172a;margin-top:34px">${text}</div>
 <div style="display:flex;gap:26px;margin-top:38px;font-size:44px;font-weight:600;color:#64748b">
  <div style="background:#f1f5f9;border-radius:80px;padding:22px 44px;display:flex;gap:30px;align-items:center"><span>&#8593;</span><span style="color:#0f172a">${up}</span><span>&#8595;</span></div>
  <div style="background:#f1f5f9;border-radius:80px;padding:22px 44px;display:flex;gap:18px;align-items:center"><span>&#128488;&#65038;</span><span>${c}</span></div>
 </div>
</div>`;
const feedHtml = `<style>*{box-sizing:border-box;margin:0}body{font-family:Inter,system-ui,sans-serif;background:#fff}</style>
<div style="width:1440px;height:2900px;display:flex;flex-direction:column;background:#fff">
 <img src="${img("feed_top")}" style="display:block;width:1440px;height:405px">
 <div style="flex:1;padding:48px 58px 0;overflow:hidden;background:#fff">${posts.map(card).join("")}</div>
 <img src="${img("feed_bottom")}" style="display:block;width:1440px;height:325px">
</div>`;

const browser = await chromium.launch();
async function render(html, w, h, out) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const f = path.join(here, ".tmp.html");
  fs.writeFileSync(f, html);
  await page.goto(pathToFileURL(f).href);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(here, "play", out) });
  await page.close();
}
await render(feedHtml, 1440, 2900, "../src/feed.png");
await render(featureHtml, 1024, 500, "feature-graphic-1024x500.png");
for (const s of shots) await render(screenshotHtml(s), 1080, 1920, `${s[0]}.png`);
await browser.close();
fs.rmSync(path.join(here, ".tmp.html"), { force: true });
