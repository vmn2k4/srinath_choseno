#!/usr/bin/env python3
"""
BC provincial 2026 candidate bios + social links from the party sites.

Sources (all fetched live, cached under --cache):
  NDP           bcndp.ca/team JSON feed (civic_tag=cand2026)
  Conservative  conservativebc.ca/our-team/ -> /candidate/<slug>/
  OneBC         1bc.ca/candidates -> /candidates/<slug>
  CentreBC      centrebc.ca/candidates/ -> /candidates/<slug>/
  BC Green      bcgreens.ca wp-json children of /candidates-2026/

Matches each scraped candidate to election_candidates on the
"2026 BC Provincial Election" by party + riding + surname, then sets
politician_profiles.bio (prose + trailing "Links: Facebook: ... | ..." line, the
convention parsed by src/lib/utils/bioLinks.ts). Bios >= 80 chars are never
replaced (only get a Links line if they have none). Each UPDATE is guarded on
the bio value that was read.

  python3 scripts/bc_party_site_bios.py            # dry run
  python3 scripts/bc_party_site_bios.py --apply
Requires DATABASE_URL (+ PGPASSWORD) and bs4.
"""
import argparse, concurrent.futures as cf, hashlib, html, json, os, re, subprocess, sys, unicodedata
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import uuid
from sync_bc_provincial_bcpolitracker import (ADMIN_PROFILE_ID, load_bc_ridings, load_election_id, load_seats,
                                              normalize_riding, psql_csv, psql_run, sql_str)

UA = "Mozilla/5.0 Chrome/124"
SOCIAL = [("facebook.com", "Facebook"), ("instagram.com", "Instagram"), ("twitter.com", "X"), ("x.com", "X"),
          ("tiktok.com", "TikTok"), ("linkedin.com", "LinkedIn"), ("youtube.com", "YouTube"), ("bsky.app", "Bluesky")]
PARTY_HANDLES = ("onebc", "one_bc", "centrebc", "conservativebc", "bcconservative", "bcgreens", "bcndp", "youngbcgreens",
                 "sharer", "intent/tweet", "share?", "/sharing", "bcgreenparty", "bc_greens", "vnp-bcndp")
DB_PARTY = {"Conservative": "Conservative Party", "OneBC": "OneBC", "CentreBC": "CentreBC",
            "BC Green": "Green Party", "BC NDP": "New Democratic Party (NDP)"}
BOILER = re.compile(r"keep up with|stay connected|donate|volunteer|lawn sign|all rights|privacy|authorized by|paid for by|"
                    r"^follow$|subscribe|get news|tax credit|donation|contribution|attest|permanent resident|credit card|receipt|cannot contribute|contributed \$|confirmation|secure payment|encrypted|the plan is working|can.t stop now|🌿|canvassing", re.I)


def get(url, cache):
    f = os.path.join(cache, hashlib.md5(url.encode()).hexdigest())
    if os.path.exists(f) and os.path.getsize(f) > 3000:
        return open(f).read()
    # centrebc.ca 403s when browser-style Accept headers are added; conservativebc.ca 403s without them
    hdr = [] if "centrebc.ca" in url else ["-H", "Accept: text/html,application/xhtml+xml", "-H", "Accept-Language: en-US,en;q=0.9"]
    t = subprocess.run(["curl", "-sL", "-A", UA, *hdr, url], capture_output=True, text=True).stdout
    open(f, "w").write(t)
    return t


def socials(tag):
    out, seen = [], set()
    for a in tag.find_all("a", href=True):
        h = a["href"].strip()
        low = h.lower()
        if not low.startswith("http") or any(p in low for p in PARTY_HANDLES):
            continue
        for dom, label in SOCIAL:
            if re.search(r"//([a-z]+\.)?" + re.escape(dom) + r"/", low + "/") and not low.rstrip("/").endswith(dom):
                if (label, low) not in seen and label not in [l for l, _ in out]:
                    out.append((label, h.split("?")[0] if "facebook" not in low else h))
                    seen.add((label, low))
                break
    return out


def parse_page(party, url, cache):
    s = BeautifulSoup(get(url, cache), "html.parser")
    title = (s.title.string or "") if s.title else ""
    for x in s(["script", "style", "nav", "header", "footer", "noscript"]):
        x.decompose()
    m = s.find("main") or s.body
    text = m.get_text("\n", strip=True)
    name = re.split(r"\s+[|–-]\s+", title)[0].strip()
    name = re.sub(r"^\s*Meet\s+", "", name)
    riding = None
    for pat in (r"CANDIDATE FOR\s+(.+)", r"Candidate\s+[—-]\s+(.+)", r"Candidate for\s+(.+)",
                r"candidate for\s+([A-Z][\w\s.,–-]+?)\.", r"^(?:Candidate|MLA)?.*$"):
        mm = re.search(pat, text, re.M if pat != r"^(?:Candidate|MLA)?.*$" else 0)
        if mm and pat != r"^(?:Candidate|MLA)?.*$":
            riding = mm.group(1).strip().split("\n")[0].rstrip(".")
            break
    if party == "BC Green":
        lines = text.split("\n")
        i = next((k for k, l in enumerate(lines) if l.strip() == name), None)
        if i is not None and i + 1 < len(lines):
            riding = lines[i + 1].strip()
    paras = []
    for p in m.find_all("p"):
        t = p.get_text(" ", strip=True)
        if len(t) < 40 or BOILER.search(t) or t[0] in "“\"":
            continue
        if t not in paras:
            paras.append(t)
    return {"party": party, "name": name, "riding": riding, "bio": "\n\n".join(paras), "links": socials(m), "url": url}


def scrape(cache):
    os.makedirs(cache, exist_ok=True)
    out, jobs = [], []
    con = get("https://conservativebc.ca/our-team/", cache)
    jobs += [("Conservative", u) for u in sorted(set(re.findall(r"https://conservativebc\.ca/candidate/[a-z0-9-]+", con)))]
    one = get("https://1bc.ca/candidates", cache)
    jobs += [("OneBC", "https://1bc.ca/candidates/" + x) for x in sorted(set(re.findall(r"candidates/([a-z0-9-]+)", one)))]
    cen = get("https://www.centrebc.ca/candidates/", cache)
    jobs += [("CentreBC", u) for u in sorted(set(re.findall(r"https://www\.centrebc\.ca/candidates/[a-z0-9-]+/", cen)))]
    g = json.loads(get("https://bcgreens.ca/wp-json/wp/v2/pages?parent=15753&per_page=100&_fields=link", cache))
    jobs += [("BC Green", x["link"]) for x in g]
    with cf.ThreadPoolExecutor(6) as ex:
        out += list(ex.map(lambda j: parse_page(j[0], j[1], cache), jobs))
    nd = json.loads(get("https://www.bcndp.ca/team?action_handler=bcndp-2024/action--civic-profiles&action=action--civic-profiles--get&civic_tag=cand2026&json=1", cache))
    for p in nd["profiles"].values():
        bio = "\n\n".join(x.get_text(" ", strip=True) for x in BeautifulSoup(p.get("bio_text") or "", "html.parser").find_all(["p", "h1", "h2"]) if x.get_text(strip=True) and not BOILER.search(x.get_text(" ", strip=True)))
        links = [(l, p[k]) for l, k in (("Facebook", "facebook_link"), ("X", "twitter_link"), ("Instagram", "instagram_link")) if p.get(k) and "bcndp" not in p[k].lower()]
        out.append({"party": "BC NDP", "name": p["fullname"], "riding": p["riding_name"], "bio": bio, "links": links, "url": "https://www.bcndp.ca/team"})
    return out


def fold(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def rkey(r):
    return " ".join(sorted(re.findall(r"[a-z0-9]+", fold(r or ""))))


def surname(n):
    w = re.findall(r"[a-z']+", fold(n))
    return w[-1] if w else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--add-missing", action="store_true",
                    help="with --apply: create candidates listed on a party site but absent from the seat")
    ap.add_argument("--cache", default=os.environ.get("BIO_CACHE", "/tmp/bc_party_pages"))
    a = ap.parse_args()
    db = os.environ["DATABASE_URL"]
    scraped = [c for c in scrape(a.cache) if c["name"]]
    rows = psql_csv(db, """
        SELECT pr.id, p.full_name, ms.name, coalesce(pp.name,''), coalesce(pr.bio,'')
        FROM election_candidates ec JOIN election_seats s ON s.id=ec.seat_id JOIN elections e ON e.id=s.election_id
        JOIN map_shapes ms ON ms.id=s.map_shape_id JOIN profiles p ON p.id=ec.politician_id
        JOIN politician_profiles pr ON pr.id=p.id LEFT JOIN political_parties pp ON pp.id=pr.political_party_id
        WHERE e.name='2026 BC Provincial Election'""")
    cands = [dict(id=r[0], name=r[1], riding=r[2], party=r[3], bio=r[4]) for r in rows]
    plan, nomatch = [], []
    for c in scraped:
        pool = [d for d in cands if d["party"] == DB_PARTY[c["party"]] and surname(d["name"]) == surname(c["name"])]
        hit = [d for d in pool if rkey(d["riding"]) == rkey(c["riding"])] or (pool if len(pool) == 1 else [])
        if len(hit) != 1:
            nomatch.append((c["party"], c["name"], c["riding"], len(pool)))
            continue
        d = hit[0]
        links = " | ".join(f"{l}: {v}" for l, v in c["links"])
        old = d["bio"]
        if len(old) < 80 and c["bio"]:
            new = c["bio"] + (f"\n\nLinks: {links}" if links else "")
        elif "Links:" not in old and links:
            new = old.rstrip() + f"\n\nLinks: {links}"
        else:
            continue
        plan.append((d, c, old, new))
    print(f"scraped {len(scraped)}; to update {len(plan)}; unmatched {len(nomatch)}")
    for d, c, old, new in plan:
        print(f"  {d['name']} ({c['party']}, {d['riding']}): {len(new)} chars, links={[l for l, _ in c['links']]}")
    for n in nomatch:
        print("  NOMATCH", n)
    extra = []
    if a.add_missing:
        ridings, eid = load_bc_ridings(db), load_election_id(db)
        seats = load_seats(db, eid)
        for i, c in enumerate(c for c in scraped if (c["party"], c["name"], c["riding"]) in {n[:3] for n in nomatch}):
            sid = ridings.get(normalize_riding(c["riding"] or ""))
            seat = seats.get(sid)
            if not seat:
                print("  CANNOT PLACE", c["name"], c["riding"]); continue
            there = [d for d in cands if rkey(d["riding"]) == rkey(c["riding"]) and surname(d["name"]) == surname(c["name"])]
            links = " | ".join(f"{l}: {v}" for l, v in c["links"])
            bio = c["bio"] + (f"\n\nLinks: {links}" if links else "")
            pname = DB_PARTY[c["party"]]
            pref = f"(SELECT id FROM public.political_parties WHERE country='Canada' AND name={sql_str(pname)} LIMIT 1)"
            if there:   # same person already on the seat under no/another party: fix party + bio
                d = there[0]
                extra.append(f"UPDATE public.politician_profiles SET political_party_id={pref}, bio=CASE WHEN length(coalesce(bio,''))<80 THEN {sql_str(bio)} ELSE bio END WHERE id={sql_str(d['id'])} AND political_party_id IS NULL;")
                print(f"  ~ set party {c['party']} on existing {d['name']} ({c['riding']})"); continue
            pid = str(uuid.uuid4())
            extra.append(f"""INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) VALUES ({sql_str(pid)}, 'politician', {sql_str(c['name'])}, true, 'Canada', gen_random_uuid());
INSERT INTO public.politician_profiles (id, political_party_id, source_url, bio) VALUES ({sql_str(pid)}, {pref}, {sql_str(c['url'])}, {sql_str(bio)});
INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) VALUES ({sql_str(seat)}, {sql_str(pid)}, 'approved', now(), {sql_str(ADMIN_PROFILE_ID)});""")
            print(f"  + new candidate {c['name']} ({c['party']}, {c['riding']})")
    if a.apply:
        sql = ["BEGIN;"] + [f"UPDATE public.politician_profiles SET bio={sql_str(new)} WHERE id={sql_str(d['id'])} AND coalesce(bio,'')={sql_str(old)};" for d, c, old, new in plan] + extra + ["COMMIT;"]
        psql_run(db, "\n".join(sql))
        print("applied")


if __name__ == "__main__":
    main()
