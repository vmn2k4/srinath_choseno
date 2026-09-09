#!/usr/bin/env python3
"""BC municipal candidate check 2026-09-08: LECFA PDF unchanged (byte-identical
MD5 to Sept 6) since Elections BC hasn't republished, so this pass checked
city-own pages directly instead. Found real new filings in Vancouver,
Nanaimo, and Saanich since the Sept 6 pass."""
import sys

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
NEW_PARTIES = ["Bright Future Vancouver", "Affordable Housing", "Vote Vancouver"]

# (seat_id, name, party_name_or_None)
STUB = [
    # Vancouver Councillor (0d79fc10-524e-4bef-815f-b8886483a762)
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Ibrahima Cisse", "Bright Future Vancouver"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Mohadeseh Gharib P. Arasi", "Bright Future Vancouver"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Judith Kasiama", "Bright Future Vancouver"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Bilal Khan", "Bright Future Vancouver"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Andy Lin", "Bright Future Vancouver"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Yadwinder Mangat", "Bright Future Vancouver"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Raj Mundra", "TEAM"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Eric Redmond", "Affordable Housing"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Patrick Sauriol", "TEAM"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Jonathan Weisman", "TEAM"),
    # Vancouver SD39 School Trustee
    ("3dc5c699-ad61-41b2-b73b-80fc8f0e5131", "Tasha Doucas", "Vote Vancouver"),
    ("3dc5c699-ad61-41b2-b73b-80fc8f0e5131", "Kat Nystedt", "TEAM"),
    # Nanaimo Mayor (need seat_id lookup, see below placeholder)
    ("NANAIMO_MAYOR_SEAT", "Sarah Lovegrove", None),
    # Saanich Councillor (40f13ceb-7e5e-4cef-90e1-fb2e1428e37c)
    ("40f13ceb-7e5e-4cef-90e1-fb2e1428e37c", "Alli Deelstra", None),
    ("40f13ceb-7e5e-4cef-90e1-fb2e1428e37c", "Nancy Di Castri", None),
    ("40f13ceb-7e5e-4cef-90e1-fb2e1428e37c", "Jordan Weaver", None),
    # Saanich SD63 School Trustee
    ("a7e987c6-dd76-4158-96e7-460d1fb38d74", "Karen MacEwan", None),
]

# (seat_id, existing_profile_id) -- confirmed officeholder matches
LINKED = [
    ("NANAIMO_MAYOR_SEAT", "b7a73fe4-1975-4c43-911c-35790ee6fb09"),  # Nanaimo Mayor - Leonard Krog
    ("40f13ceb-7e5e-4cef-90e1-fb2e1428e37c", "7112225c-898d-4fdb-8450-8c2853e13882"),  # Saanich Cllr - Colin Plant
    ("726be175-6450-429a-abc3-28702b02db18", "2bfc56d2-d78a-47be-b2d7-2c96fed150a3"),  # Saanich Mayor - Karen Harper
    ("40f13ceb-7e5e-4cef-90e1-fb2e1428e37c", "520549dd-596f-4262-a95c-6abdbf755714"),  # Saanich Cllr - Nathalie Chambers
]

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

def main(nanaimo_mayor_seat_id, out_path):
    stub = [(nanaimo_mayor_seat_id if s == "NANAIMO_MAYOR_SEAT" else s, n, p) for s, n, p in STUB]
    linked = [(nanaimo_mayor_seat_id if s == "NANAIMO_MAYOR_SEAT" else s, p) for s, p in LINKED]

    sql = ["BEGIN;"]
    values = ",\n".join(f"('Canada',{qstr(n)})" for n in NEW_PARTIES)
    sql.append(
        "INSERT INTO public.political_parties (country, name)\n"
        f"SELECT v.country, v.name FROM (VALUES {values}) AS v(country, name)\n"
        "WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.country AND p.name=v.name);"
    )
    sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid) ON COMMIT DROP;")
    vals = ",\n".join(f"({qstr(s)},{qstr(n)},{qstr(p)},gen_random_uuid())" for s, n, p in stub)
    sql.append("INSERT INTO new_stub (seat_id, name, party_name, stub_id) VALUES " + vals + ";")
    sql.append(
        "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
        "SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;"
    )
    sql.append(
        "INSERT INTO public.politician_profiles (id, political_party_id) "
        "SELECT ns.stub_id, pp.id FROM new_stub ns "
        "LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name;"
    )
    sql.append(
        f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
        f"SELECT seat_id, stub_id, 'approved', now(), {qstr(ADMIN_ID)} FROM new_stub;"
    )
    if linked:
        link_values = ",\n".join(f"({qstr(s)},{qstr(p)},'approved',now(),{qstr(ADMIN_ID)})" for s, p in linked)
        sql.append(
            "INSERT INTO public.election_candidates "
            "(seat_id, politician_id, status, submitted_at, added_by_election_admin_id)\n"
            f"VALUES {link_values};"
        )
    sql.append("COMMIT;")
    with open(out_path, "w") as f:
        f.write("\n".join(sql) + "\n")
    print(f"STUB: {len(stub)}  LINKED: {len(linked)}")
    print(f"SQL written to {out_path}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
