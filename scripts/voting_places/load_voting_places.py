#!/usr/bin/env python3
"""Load researched BC voting places into voting_places / voting_place_schedules.

Usage: python3 scripts/voting_places/load_voting_places.py data/<file>.json [...]

Each data file: {"map_shape_id": int, "jurisdiction": str, "source_url": str,
 "places": [{"name","address","notes"?, "lat"?,"lng"?, "schedules":[{"type","date","open","close","notes"?}]}]}

Addresses are geocoded with Nominatim (1 req/s, cached in .geocode_cache.json);
a hit is accepted only if it lands within MAX_KM of the municipality centroid
(from munis.json), otherwise lat/lng stay NULL for manual review. Re-running a
file replaces that municipality's rows for the election.
"""
import json, math, os, subprocess, sys, time, urllib.parse, urllib.request

ELECTION_NAME = "2026 BC General Local Elections"
ELECTION_DATE = "2026-10-17"
MAX_KM = 60
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(HERE, ".geocode_cache.json")
MUNIS = {m["id"]: m for m in json.load(open(os.path.join(HERE, "munis.json")))}
cache = json.load(open(CACHE_PATH)) if os.path.exists(CACHE_PATH) else {}


def km(a, b, c, d):
    r = math.pi / 180
    h = math.sin((c - a) * r / 2) ** 2 + math.cos(a * r) * math.cos(c * r) * math.sin((d - b) * r / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def nominatim(q):
    if q in cache:
        return cache[q]
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"format": "json", "limit": 1, "countrycodes": "ca", "q": q})
    req = urllib.request.Request(url, headers={"User-Agent": "Choseno-Civic-App/1.0"})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=20))
    except Exception as e:
        print("  geocode error", e)
        return None
    time.sleep(1.1)
    res = (float(data[0]["lat"]), float(data[0]["lon"])) if data else None
    cache[q] = res
    json.dump(cache, open(CACHE_PATH, "w"))
    return res


def geocode(place, muni, jurisdiction):
    if place.get("lat") is not None and place.get("lng") is not None:
        return place["lat"], place["lng"], "manual"
    queries = []
    if place.get("address"):
        queries.append(f'{place["address"]}, BC, Canada')
    queries.append(f'{place["name"]}, {jurisdiction}, BC, Canada')
    for q in queries:
        r = nominatim(q)
        if r and km(r[0], r[1], float(muni["lat"]), float(muni["lng"])) <= MAX_KM:
            return r[0], r[1], "nominatim"
    return None, None, None


def q(v):
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def build_sql(doc):
    sid, jur = doc["map_shape_id"], doc["jurisdiction"]
    muni = MUNIS[sid]
    out = [f"DELETE FROM public.voting_places WHERE map_shape_id={sid} AND election_date='{ELECTION_DATE}';"]
    for p in doc["places"]:
        lat, lng, src = geocode(p, muni, jur)
        if lat is None:
            print(f"  NO GEOCODE: {jur} / {p['name']} / {p.get('address')}")
        out.append(
            "WITH ins AS (INSERT INTO public.voting_places (election_name, election_date, map_shape_id, "
            "jurisdiction_name, name, address, lat, lng, geocode_source, notes, source_url) VALUES ("
            f"{q(ELECTION_NAME)}, '{ELECTION_DATE}', {sid}, {q(jur)}, {q(p['name'])}, {q(p.get('address'))}, "
            f"{lat if lat is not None else 'NULL'}, {lng if lng is not None else 'NULL'}, {q(src)}, "
            f"{q(p.get('notes'))}, {q(doc.get('source_url'))}) RETURNING id) "
            "INSERT INTO public.voting_place_schedules (voting_place_id, voting_type, vote_date, opens_at, closes_at, notes) "
            "SELECT id, v.t, v.d::date, v.o::time, v.c::time, v.n FROM ins, (VALUES "
            + ", ".join(
                f"({q(s['type'])}, {q(s['date'])}, {q(s.get('open'))}, {q(s.get('close'))}, {q(s.get('notes'))})"
                for s in p["schedules"]
            )
            + ") AS v(t, d, o, c, n) ON CONFLICT DO NOTHING;"
        )
    return "\n".join(out)


for path in sys.argv[1:]:
    path = path if os.path.isabs(path) else os.path.join(os.getcwd(), path)
    docs = json.load(open(path))
    for doc in docs if isinstance(docs, list) else [docs]:
        print(doc["jurisdiction"], len(doc["places"]), "places")
        sql_path = os.path.join(HERE, f".load.{os.getpid()}.sql")
        open(sql_path, "w").write(build_sql(doc))
        r = subprocess.run(["supabase", "db", "query", "--linked", "-f", sql_path], capture_output=True, text=True)
        if r.returncode or "Error" in r.stdout:
            print("  SQL FAILED:", (r.stdout + r.stderr)[:500])
