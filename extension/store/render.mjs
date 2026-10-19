// Renders Chrome Web Store listing images from HTML (HyperFrames-style compositions) with Playwright.
import { chromium } from "playwright";
import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const here = path.dirname(url.fileURLToPath(import.meta.url));
const css = (w, h) => `
@font-face{font-family:BS;src:url(src/BigShouldersDisplay-Variable.woff2);font-weight:100 900}
@font-face{font-family:PS;src:url(src/PublicSans-Variable.woff2);font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:${w}px;height:${h}px;overflow:hidden;font-family:PS,sans-serif;color:#17324d;
 background:radial-gradient(900px 600px at 15% 0%,#e8e4fb 0,transparent 60%),linear-gradient(135deg,#f4f8fd,#dfeaf8);position:relative}
.wm{font-family:BS;font-weight:800;letter-spacing:.01em;background:linear-gradient(90deg,#e8772e,#e9a23b);-webkit-background-clip:text;color:transparent}
.shot{position:absolute;border-radius:22px;box-shadow:0 30px 70px rgba(23,50,77,.28),0 0 0 1px rgba(23,50,77,.08);overflow:hidden;background:#fff}
.shot img{width:100%;display:block}
.logo{width:56px;height:56px;border-radius:14px}`;
const pages = {
 "screenshot-1-share.png": [1280, 800, `
  <div style="position:absolute;left:80px;top:150px;width:560px">
   <div style="display:flex;align-items:center;gap:14px"><img class=logo src="src/logo.svg"><span class=wm style="font-size:54px">Choseno</span></div>
   <h1 style="font-size:56px;line-height:1.08;margin-top:34px;font-weight:800;letter-spacing:-.02em">Comment on any link. Post it anonymously.</h1>
   <p style="font-size:24px;line-height:1.45;margin-top:24px;color:#3d607f">Choseno is social media for politics. Your view lands on your feed under a Ghost ID, visible to people in your electoral boundaries.</p></div>
  <div class=shot style="left:760px;top:36px;width:430px"><img src="src/composer.png"></div>`],
 "screenshot-2-start.png": [1280, 800, `
  <div style="position:absolute;left:80px;top:150px;width:560px">
   <div style="display:flex;align-items:center;gap:14px"><img class=logo src="src/logo.svg"><span class=wm style="font-size:54px">Choseno</span></div>
   <h1 style="font-size:56px;line-height:1.08;margin-top:34px;font-weight:800;letter-spacing:-.02em">Your honest view on politics, from any page.</h1>
   <p style="font-size:24px;line-height:1.45;margin-top:24px;color:#3d607f">Free to join. The page link is added for you, and no one knows it's you.</p></div>
  <div class=shot style="left:760px;top:24px;width:430px"><img src="src/welcome.png"></div>`],
 "promo-small-440x280.png": [440, 280, `
  <div style="position:absolute;left:28px;top:34px;width:230px">
   <span class=wm style="font-size:40px">Choseno</span>
   <h1 style="font-size:24px;line-height:1.12;margin-top:8px;font-weight:800">Social media for politics</h1>
   <p style="font-size:13px;line-height:1.4;margin-top:10px;color:#3d607f">Comment on any link. Post anonymously to your electoral boundaries.</p></div>
  <div class=shot style="left:272px;top:24px;width:150px;border-radius:10px"><img src="src/composer.png"></div>`],
 "marquee-1400x560.png": [1400, 560, `
  <div style="position:absolute;left:90px;top:110px;width:700px">
   <div style="display:flex;align-items:center;gap:14px"><img class=logo src="src/logo.svg"><span class=wm style="font-size:56px">Choseno Companion</span></div>
   <h1 style="font-size:60px;line-height:1.08;margin-top:26px;font-weight:800;letter-spacing:-.02em">Social media for politics.</h1>
   <p style="font-size:26px;line-height:1.4;margin-top:18px;color:#3d607f">Comment on any link and post it anonymously to people in your electoral boundaries.</p></div>
  <div class=shot style="left:930px;top:50px;width:290px;border-radius:16px;transform:rotate(3deg)"><img src="src/composer.png"></div>`],
};
const b = await chromium.launch();
for (const [name, [w, h, body]] of Object.entries(pages)) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const f = path.join(here, name.replace(".png", ".html"));
  fs.writeFileSync(f, `<!doctype html><meta charset=utf-8><style>${css(w, h)}</style>${body}`);
  await p.goto("file://" + f, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(here, name) });
  fs.unlinkSync(f);
}
await b.close();
