#!/usr/bin/env python3
"""BC photo audit follow-up, 2026-09-09 (part 2): Burnaby Mayor + School
Trustee pages, same city as bc_sept9_burnaby_photos_and_new.py (Councillor).

MAYOR (burnaby.ca .../office-of-mayor-candidate-profiles):
  - Sabina Hsu was entirely missing from our system (officeholder-dedup
    checked against Burnaby map_shape_id 21309 -- no match, fresh stub).
    Has a photo on the city page.
  - Heymann Yip already in DB, missing photo -- now captured.
  - Michael Angelo A_BC Robin Hood: no photo submitted on the city page
    either -- nothing to fetch, not a miss.

SCHOOL TRUSTEE (SD41 - Burnaby, .../office-of-school-trustees-candidate-
profiles): all 9 candidates already in our system. 8 of 9 have a real
photo on the city page never captured; Jen Mezei has none submitted.
"""
ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
MAYOR_SEAT = "ada1447c-2368-4dc5-8c40-6b8f61781ba7"

PHOTOS = {
    # Mayor
    "c3d455a4-e3ae-400f-aa14-23d8c6bacd9d": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/MAY_YIP%20Heymann_Photo-Resized.jpg?h=373e1cea&itok=fY4MhAdV",  # Heymann Yip
    # School Trustee (SD41 - Burnaby)
    "a9bf0c52-44d3-4966-8339-66081e2381c9": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/TRU_ANDRADA%20Stephen_Photo-Resized.jpg?h=10046c59&itok=3PbawOnQ",  # Stephen Andrada
    "0a1eca9b-215b-439f-a64c-14645aabde77": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/TRU_BERGSHOEFF%20Hillary_Photo.jpg?h=10046c59&itok=KIqDFcFC",  # Hillary Bergshoeff
    "04cde9a0-6d23-42c0-bc17-981c32f24c82": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/TRU_BRASSINGTON%20Bill_Photo-Resized.png?h=10046c59&itok=0cql1D9P",  # Bill Brassington
    "8b1b24b2-5db2-4651-beb6-7b2b838ec7b9": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/TRU_JANG%20Jen_Photo.jpg?h=10046c59&itok=uc6ggnVp",  # Jen Jang
    "7dd05c72-474f-4926-89e8-6d2c9d60b67c": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/TRU_KWON%20Paul_Photo-Resized.png?h=10046c59&itok=LB287lbO",  # Paul Kwon
    "35a8ce64-7389-4137-8077-9e557fce6640": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/TRU_NICHOLSFIGUEIREDO%20Jasmine_Photo.png?h=10046c59&itok=sSzIk7UE",  # Jasmine Nicholsfigueiredo
    "efd22732-9228-4264-89cf-9452be96c25a": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/TRU_SCHNIDER%20Kristin_Photo.jpg?h=10046c59&itok=3m6WIzaY",  # Kristin Schnider
    "312cdb5e-47a2-42e0-8f53-287377dbaf91": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/TRU_XIAO%20Haini_Photo.jpg?h=10046c59&itok=IereqsUp",  # Haini Xiao
}

# fresh stub: (seat_id, name, party_name, photo_url)
STUB = [
    (MAYOR_SEAT, "Sabina Hsu", None,
     "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/MAY_HSU%20Sabina_Photo-bw-Resized.png?h=10046c59&itok=BObi-Rfi"),
]

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

for pid, url in PHOTOS.items():
    sql.append(
        f"UPDATE public.politician_profiles SET "
        f"avatar_url = COALESCE(avatar_url, {qstr(url)}), "
        f"photo_url = COALESCE(photo_url, {qstr(url)}) "
        f"WHERE id = '{pid}';"
    )

sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, photo_url text, stub_id uuid) ON COMMIT DROP;")
vals = ",\n".join(f"({qstr(s)},{qstr(n)},{qstr(p)},{qstr(ph)},gen_random_uuid())" for s, n, p, ph in STUB)
sql.append("INSERT INTO new_stub (seat_id, name, party_name, photo_url, stub_id) VALUES " + vals + ";")
sql.append(
    "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
    "SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;"
)
sql.append(
    "INSERT INTO public.politician_profiles (id, political_party_id, avatar_url, photo_url) "
    "SELECT ns.stub_id, pp.id, ns.photo_url, ns.photo_url FROM new_stub ns "
    "LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name;"
)
sql.append(
    f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
    f"SELECT seat_id, stub_id, 'approved', now(), {qstr(ADMIN_ID)} FROM new_stub;"
)
sql.append("COMMIT;")

out_path = "bc_sept9_burnaby_mayor_trustee_photos.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"PHOTOS: {len(PHOTOS)}  STUB: {len(STUB)}")
print(f"SQL written to {out_path}")
