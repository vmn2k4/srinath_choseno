"""Compact builders for voting-place data files (see load_voting_places.py)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
G = "2026-10-17"


def sch(kind, dates, open="08:00", close="20:00", notes=None):
    return [dict(type=kind, date=d if len(d) > 5 else f"2026-{d}", open=open, close=close, **({"notes": notes} if notes else {})) for d in dates]


def adv(dates, open="08:00", close="20:00"):
    return sch("advance", dates, open, close)


def gen(open="08:00", close="20:00"):
    return sch("general", [G], open, close)


def place(name, address, schedules, notes=None, lat=None, lng=None):
    p = dict(name=name, address=address, schedules=schedules)
    if notes: p["notes"] = notes
    if lat is not None: p["lat"], p["lng"] = lat, lng
    return p


def save(slug, shape_id, jurisdiction, source_url, places):
    path = os.path.join(HERE, "data", f"{slug}.json")
    json.dump(dict(map_shape_id=shape_id, jurisdiction=jurisdiction, source_url=source_url, places=places), open(path, "w"), indent=1)
    print("wrote", path, len(places))


def build(slug, shape_id, jurisdiction, url, city, advance, day_only, both_names=()):
    """advance: [(name, addr, [mm-dd,...])]; day_only: 'name|addr' lines.
    Advance sites whose name is in both_names (or all, if True) also open on election day."""
    places = []
    for n, a, ds in advance:
        also = both_names is True or n in both_names
        places.append(place(n, f"{a}, {city}" if a else None, adv(ds) + (gen() if also else []),
                            "Advance and election day" if also else "Advance voting only"))
    for l in (x for x in day_only.strip().split("\n") if x):
        n, a = l.split("|")
        places.append(place(n, f"{a}, {city}", gen(), "Election day only"))
    save(slug, shape_id, jurisdiction, url, places)
