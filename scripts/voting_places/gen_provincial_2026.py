#!/usr/bin/env python3
"""Build data/provincial_2026.json (93 ridings) from Elections BC's Where to Vote GeoServer layer.

Source: https://ebcwtvgeoserver.canadacentral.cloudapp.azure.com/geoserver/wtv/ows (layer wtv:EBC_VOTING_PLACES),
the feed behind https://wheretovote.elections.bc.ca. OPEN_ADV_n holds 2^(n-1) when open on advance day n
(day 1 = Oct 16 ... day 6 = Oct 21). Advance hours 8am-8pm; Final Voting Day Oct 24 8am-8pm;
district electoral offices (DEO) vote until 4pm on Oct 24.
Usage: gen_provincial_2026.py <voting_places.json> <riding_shapes.json> > data/provincial_2026.json
"""
import json, sys, datetime as dt

NAME = "2026 BC Provincial Election"
DATE = "2026-10-24"
SRC = "https://wheretovote.elections.bc.ca"
feats = json.load(open(sys.argv[1]))["features"]
t = open(sys.argv[2]).read()
shapes = {r["name"]: r["id"] for r in json.loads(t[t.index("{"):])["rows"]}
first = dt.date(2026, 10, 16)
by_ed = {}
for f in feats:
    p = f["properties"]
    kind = p["VP_TYPE"]
    sched = []
    if kind != "Final Voting Place":
        for n in range(1, 7):
            if p[f"OPEN_ADV_{n}"]:
                sched.append({"type": "advance", "date": str(first + dt.timedelta(days=n - 1)), "open": "08:00", "close": "20:00"})
    if kind != "Advance Voting Place":
        sched.append({"type": "general", "date": DATE, "open": "08:00", "close": "16:00" if kind == "DEO Office" else "20:00"})
    if not sched:
        continue
    addr = ", ".join(x for x in [p["ADDRESS"], p["LOCALITY"]] if x)
    name = p["BLDNG_NAME"] or addr
    place = {"name": ("District Electoral Office - " + name) if kind == "DEO Office" else name, "address": addr,
             "lat": p["POINT_Y"], "lng": p["POINT_X"], "schedules": sched}
    if kind == "DEO Office":
        place["notes"] = "District electoral office: open regular hours through Oct 24 (until 4pm)"
    by_ed.setdefault(p["ED_NAME"], []).append(place)
docs = [{"map_shape_id": shapes[ed], "jurisdiction": ed, "source_url": SRC, "election_name": NAME,
         "election_date": DATE, "places": sorted(pl, key=lambda x: x["name"])} for ed, pl in sorted(by_ed.items())]
json.dump(docs, sys.stdout, indent=1)
