// Run in a real browser tab already on https://ballotpedia.org (plain curl/WebFetch get an
// empty HTTP 202 bot-challenge page). Same-origin fetch() works from there.
// Paste the helpers, then run ONE of the loops below, wait for the done flag, then use the
// transfer snippet at the bottom to get the data out (see README.md in this folder).
// Throttling: Ballotpedia starts returning pages with no #mw-content-text after ~60-100
// rapid requests -- keep >=1.2s between fetches and retry only the states still missing.

window.bpText = async (url) => {
  const r = await fetch(url); if (!r.ok) return null;
  const h = await r.text(); const d = new DOMParser().parseFromString(h, 'text/html');
  const c = d.getElementById('mw-content-text'); if (!c) return null;
  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;left:-9999px;top:0;width:900px';
  div.innerHTML = c.innerHTML; div.querySelectorAll('script,style').forEach(e => e.remove());
  document.body.appendChild(div); const t = div.innerText; div.remove(); return t;
};

window.STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New_Hampshire","New_Jersey","New_Mexico","New_York","North_Carolina","North_Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode_Island","South_Carolina","South_Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West_Virginia","Wisconsin","Wyoming"];

// ---- US House: two page layouts exist ("A": per-district "General election candidates" lists;
// "B": per-race "General election for U.S. House <State> District N" tables, used by at-large states
// and some others). Returns { districtNumber(0 = at-large): {src, c:["Name:Party", ...]} }.
// Withdrawn/unofficially-withdrew entries come back flagged ('!' prefix or party text) -- diff_house.py drops them.
window.parseHouse = (t) => {
  const out = {}; const sec = t.slice(Math.max(0, t.indexOf('Candidates and election results')));
  const reB = /General election for U\.S\. House .*?(At-large District|District (\d+))\s*\n/g; let m; const idxB = [];
  while ((m = reB.exec(sec))) idxB.push({ i: m.index, end: reB.lastIndex, d: m[2] ? +m[2] : 0 });
  idxB.forEach((x, k) => {
    const seg = sec.slice(x.end, k + 1 < idxB.length ? idxB[k + 1].i : sec.length);
    const a = seg.indexOf('\nCandidate\n'), b = seg.indexOf('Incumbents are bolded'); if (a < 0) return;
    const c = []; seg.slice(a, b < 0 ? undefined : b).split('\n').forEach(l => {
      const mm = l.trim().match(/^(.+?)\s+\(([^)]+)\)\s*$/);
      if (mm) c.push((/Withdrew|Unofficially/.test(l) ? '!' : '') + mm[1].trim() + ':' + mm[2]);
    });
    if (!out[x.d]) out[x.d] = { src: 'B', c };
  });
  const parts = sec.split(/^District (\d+)\s*$/m);
  for (let k = 1; k < parts.length; k += 2) {
    const d = +parts[k], seg = parts[k + 1], a = seg.indexOf('General election candidates'); if (a < 0) continue;
    let rest = seg.slice(a + 27); const e = rest.search(/Primary candidates|= candidate completed|Withdrawn|Did not make/);
    rest = e >= 0 ? rest.slice(0, e) : rest; const c = [];
    rest.split('\n').forEach(l => {
      l = l.trim(); if (!l) return; const mm = l.match(/^(.+?)\s+(?:\(Incumbent\)\s*)?\(([^)]*)\)\s*$/);
      if (mm) c.push(mm[1].replace(/\s*\(Incumbent\)/, '').trim() + ':' + mm[2].replace(/ Party$/, ''));
    });
    if (!out[d]) out[d] = { src: 'A', c };
  }
  return out;
};
window.HOUSE = {};
// (async () => { for (const s of STATES) { const t = await bpText(`/United_States_House_of_Representatives_elections_in_${s},_2026`) || await bpText(`/United_States_House_of_Representatives_election_in_${s},_2026`); if (t) HOUSE[s] = parseHouse(t); await new Promise(r => setTimeout(r, 1300)); } window.HOUSE_DONE = true; })();

// ---- Senate / Governor: take only the FIRST 2026 "General election for ..." (or "Special general
// election for ...") block. The page also contains the 2024/2022/2018 tables under the same heading --
// the intro-sentence check (must say 2026 and "running") is what keeps those out. Florida and Ohio
// Senate are SPECIAL elections (heading starts "Special general election"); Governor URLs are
// "<State>_gubernatorial_election,_2026" for most states but "<State>_gubernatorial_and_lieutenant_
// gubernatorial_election,_2026" for AK, IL, KS, MD, MN, OH, SD.
window.parse26 = (t, kind) => {
  const sec = t.slice(Math.max(0, t.indexOf('Candidates and election results')));
  const re = /(?:Special )?[Gg]eneral election for ([^\n]+)\n/g; let m; const found = [];
  while ((m = re.exec(sec))) {
    const h = m[1];
    if (kind === 'GOV' && !/^Governor/.test(h)) continue;      // skips "Lieutenant Governor of ..."
    if (kind === 'SEN' && !/^U\.S\. Senate/.test(h)) continue;
    let seg = sec.slice(re.lastIndex); const intro = seg.slice(0, 500);
    if (!/2026/.test(intro.slice(0, 400))) continue;
    if (/(ran|defeated)[^.]*general election/.test(intro.slice(0, 300)) && !/running/.test(intro.slice(0, 300))) continue;
    const a = seg.indexOf('\nCandidate\n'); if (a < 0) continue; seg = seg.slice(a);
    let e = seg.length;
    for (const s of ['Incumbents are bolded','Withdrawn or disqualified','primary election','primary for','Primary election','Candidate Connection','Do you want a spreadsheet']) { const i = seg.indexOf(s); if (i >= 0 && i < e) e = i; }
    const c = []; seg.slice(0, e).split('\n').forEach(l => { const mm = l.trim().match(/^(.+?)\s+\(([^)]+)\)\s*$/); if (mm) c.push(mm[1].trim() + ':' + mm[2]); });
    found.push({ h: m[0].trim(), intro: intro.slice(0, 160).replace(/\n+/g, ' '), c });
  }
  return found;
};
// SEN3[state] = parse26(await bpText(`/United_States_Senate_election_in_${s},_2026`) ||
//                       await bpText(`/United_States_Senate_special_election_in_${s},_2026`), 'SEN');
// GOV3[state] = parse26(await bpText(`/${s}_gubernatorial_election,_2026`), 'GOV');

// ---- Getting the data out of the browser (direct fetch() to localhost is blocked from this origin):
//   1. python3 scripts/ballotpedia_refresh/recv.py &            (listens on 127.0.0.1:8765)
//   2. in the page:   window.name = JSON.stringify(HOUSE)        (window.name survives navigation)
//   3. navigate that tab to  http://127.0.0.1:8765/?f=house_bp.json   -> file lands in recv.py's cwd.
