#!/usr/bin/env python3
"""BC photo audit follow-up, 2026-09-09: Burnaby Councillor page.

Two things caught by re-fetching burnaby.ca's councillor accordion (the
same page visited on Sept 6/9 for bio/party but never checked for <img>
tags -- exactly the "fetch the photo in the same pass" mistake documented
in surrey_enrich.py):

1. PHOTOS: 11 of our 19 existing Burnaby councillor candidates have a real
   headshot on the city's own page that we never captured. (James Wang,
   Joe Keithley, Maita Santiago already have an avatar_url from an older
   2022 pull -- left alone via COALESCE.) 5 candidates (Fiorella Ravelli,
   Mary Blanca Villa y Battenberg, Neha Unadkat, Neil Chapman, Rea Park)
   have no photo submitted on the city page -- nothing to fetch, not a miss.

2. NEW_CANDIDATES: Burnaby's own roster grew to 24 councillor names since
   our last pass (19 in DB). 5 are missing entirely:
     - Tina Fiorda, Morgan Nicholsfigueiredo, Sabrina Yang: fresh stubs
       (officeholder-dedup checked against Burnaby's map_shape_id 21309 --
       no match).
     - Vincent Tong: fresh stub, no photo submitted, no party listed.
     - Daniel Tetrault: officeholder-dedup MATCH (current Burnaby office
       holder, linked_profile_id e5ac35ff-cfd2-4524-95ff-83ff09fdc3bc,
       not yet an election_candidate anywhere) -- linked, not stubbed.

Party names matched to what's already in political_parties for Canada/
Burnaby (id 8992 "NEW Burnaby", 8994 "Restore Burnaby" -- the DB already
uses shortened forms of "New Burnaby Party" / "Restore Burnaby Alliance").
"""
ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"
CLLR_SEAT = "f66d0c6e-a32d-4100-8ae5-65345b9ec102"

# profile_id -> photo URL, for candidates already in the DB
PHOTOS = {
    "523ea22c-8e16-4078-8a35-5deed50926d4": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_CHEN%20Daniel_Photo-Resized.png?h=10046c59&itok=t1sLUi04",  # Daniel Chen
    "bfc8ff8d-2171-4fab-8726-dc8e99daacce": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_CHIN%20Larry_Photo.jpg?h=10046c59&itok=VQ-JOewR",  # Larry Chin
    "3b44aba1-08b3-450b-b03e-d5f9cde0dbd2": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_DONG%20Rocky_Photo-Resized.png?h=10046c59&itok=1yjd81CZ",  # Rocky Dong
    "33e10eca-47bc-45df-ba3f-99f272cf86c7": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_FIRDOS%20Gulam_Photo-bw-Resized.png?h=10046c59&itok=lTfmPW11",  # Gulam Firdos
    "a6f4200e-bc8a-405c-8c0c-df004de825a2": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_HEIDT%20Garnet_Photo-Resized.jpg?h=10046c59&itok=ciJywzRe",  # Garnet Heidt
    "b721c0e9-3c97-47bc-9ccc-aaf163ce2a33": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_KEITHLEY%20Joe_Photo.jpg?h=10046c59&itok=vTD50N6A",  # Joe Keithley
    "6d9117d4-b7f1-4e2e-9d13-0b2c068d257d": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_KENDELL%20Martin_Photo-Resized.png?h=10046c59&itok=1LoofCzb",  # Martin Kendell
    "3587f15b-fd81-460b-943b-2a447f21fc91": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_LEE%20Cindy_Photo.jpg?h=10046c59&itok=ytWt8kxg",  # Cindy Lee
    "9fcf1a3e-c7dc-4ffa-ada3-5bd680495f4b": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_NAIDU%20Ragina_Photo-Resized.png?h=10046c59&itok=ts-tnvHj",  # Ragina Naidu
    "fcef7666-5b99-4937-ac54-ef53adb868ca": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_SHUSHTARIAN%20Tara_Photo-Resized.jpg?h=10046c59&itok=3BWttKOx",  # Tara Shushtarian
    "12eda3b2-e814-4cfb-8d57-cc0bc40bdf46": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_SINGH%20Kiran_Photo.jpg?h=10046c59&itok=yukyTA5W",  # Kiran Singh
    "1bf0a565-22b5-4f90-9855-6d035739a330": "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_STOJANOVSKI%20Philip_Photo.jpg?h=e46315f3&itok=MesRHW_f",  # Philip Stojanovski
}

# officeholder-dedup link: (seat_id, existing_profile_id)
LINKED = [
    (CLLR_SEAT, "e5ac35ff-cfd2-4524-95ff-83ff09fdc3bc"),  # Daniel Tetrault
]

# fresh stubs: (seat_id, name, party_name, photo_url)
STUB = [
    (CLLR_SEAT, "Tina Fiorda", "Restore Burnaby",
     "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_FIORDA%20Tina_Photo-Resized.JPG?h=f6ba2071&itok=kqOBMtGS"),
    (CLLR_SEAT, "Morgan Nicholsfigueiredo", "NEW Burnaby",
     "https://www.burnaby.ca/sites/default/files/styles/portrait_148w_/public/acquiadam/2026-09/COU_NICHOLSFIGUEIREDO%20Morgan_Photo-Resized.jpg?h=9705ee69&itok=SVSVAzA0"),
    (CLLR_SEAT, "Vincent Tong", None, None),
    (CLLR_SEAT, "Sabrina Yang", "NEW Burnaby", None),
]

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

# 1. Photos for existing candidates
for pid, url in PHOTOS.items():
    sql.append(
        f"UPDATE public.politician_profiles SET "
        f"avatar_url = COALESCE(avatar_url, {qstr(url)}), "
        f"photo_url = COALESCE(photo_url, {qstr(url)}) "
        f"WHERE id = '{pid}';"
    )

# 2. Link Daniel Tetrault (existing officeholder profile) to his candidacy
link_values = ",\n".join(f"({qstr(s)},{qstr(p)},'approved',now(),{qstr(ADMIN_ID)})" for s, p in LINKED)
sql.append(
    "INSERT INTO public.election_candidates "
    "(seat_id, politician_id, status, submitted_at, added_by_election_admin_id)\n"
    f"VALUES {link_values};"
)

# 3. New stub profiles for the other 4 missing candidates (with photo where available)
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

out_path = "bc_sept9_burnaby_photos_and_new.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"PHOTOS: {len(PHOTOS)}  LINKED: {len(LINKED)}  STUB: {len(STUB)}")
print(f"SQL written to {out_path}")
