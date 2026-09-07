#!/usr/bin/env python3
"""2026-09-06 BC LECFA refresh: PDF grew from 13 pages (Sept 4) to 23 pages
-- many brand-new jurisdictions (Vancouver, Surrey, Kamloops, Chilliwack,
Maple Ridge, Saanich, etc.) now have registered candidates. Dedup against
office_holders done by hand (see chat)."""
import sys

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"

NEW_PARTIES = [
    ("Canada", "Restore Burnaby"),
    ("Canada", "Sustain OUR Central Saanich"),
    ("Canada", "Langley City First"),
    ("Canada", "A Better Maple Ridge"),
    ("Canada", "REAL"),
    ("Canada", "SAVE OUR SAANICH"),
    ("Canada", "Surrey Connect Public IA"),
    ("Canada", "TEAM"),
    ("Canada", "Vancouver Liberals"),
    ("Canada", "Together For White Rock"),
]

# (seat_id, name, party_name_or_None)
STUB = [
    # Abbotsford councillor
    ("3462441b-d1cf-498a-9c4d-4ba24da5c1af", "Les Barkman", None),
    ("3462441b-d1cf-498a-9c4d-4ba24da5c1af", "Shirley Wilson", None),
    # Barriere
    ("2bfb8f83-931d-4a59-8211-2101c1bb7d18", "Stephen Boylan", None),
    ("4adc0a62-7ddc-4f20-a2b6-7e6512e11e19", "Rob Kerslake", None),
    # Bowen Island
    ("a6b79f34-c6ca-4cb1-b822-83f9ba91c4ab", "Sue Ellen Fast", None),
    ("b4549f83-4c5b-4c07-9889-5e42b359ecbf", "Andrew Leonard", None),
    # Burnaby
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Rocky Dong", "Restore Burnaby"),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Garnet Heidt", None),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Maita Santiago", "BCA - Burnaby Citizens Association"),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Mary Blanca Villa y Battenberg", "Burnaby First"),
    ("ada1447c-2368-4dc5-8c40-6b8f61781ba7", "Heymann Yip", "Burnaby First"),
    ("78212b91-2bb4-4e68-9d4f-f9548d8102b0", "Kristin Schnider", "BCA - Burnaby Citizens Association"),
    # Campbell River
    ("c61a1e72-5e29-45f2-8d93-e90f319b32cc", "Brittany Colville", None),
    ("c61a1e72-5e29-45f2-8d93-e90f319b32cc", "Laird Ruehlen", None),
    # Canal Flats
    ("ff9a5418-045c-4d78-8295-27386896f7c5", "Mark Doherty", None),
    # Castlegar
    ("2fe8e7c5-9e1d-43a0-bc4a-704ddf7e03c8", "Miguel Godau", None),
    # Central Okanagan SD23 trustee
    ("028307bc-ada4-4ae5-83c7-7eac080b8333", "Samuel Robson", None),
    # Central Saanich councillor
    ("4c449a9e-898d-41a5-8d3c-e97e973048cc", "David Lawson", "Sustain OUR Central Saanich"),
    # Chase
    ("73642ca2-9d20-4577-975d-56529670ff33", "Colin Connett", None),
    ("73642ca2-9d20-4577-975d-56529670ff33", "Sandra Welton", None),
    # Chilliwack
    ("be92d312-eb1f-4113-90e5-b022076e5f26", "Jared Mumford", None),
    ("be92d312-eb1f-4113-90e5-b022076e5f26", "Ghazaleh Nozamani", None),
    # Clearwater
    ("b0e9fed2-40e2-48de-8f6a-3f795a3ff3a6", "Ken Matheson", None),
    ("6da23a54-e09c-4335-b682-954e15fa0f93", "Merlin Blackwell", None),
    # Coquitlam councillor
    ("8e26193f-60fb-43a9-b263-028195334245", "Tali Campbell", None),
    # Cranbrook councillor
    ("b070c93c-95f2-4413-8377-bca7f5e3940c", "Al Dyck", None),
    # Dawson Creek
    ("184f40f0-96a0-4201-8f78-5e5790e07383", "Rob Atkinson", None),
    ("184f40f0-96a0-4201-8f78-5e5790e07383", "Monica Rogers", None),
    ("4b2f78a2-918e-4956-a96a-f5d965556009", "Dwaine Dilworth", None),
    # Delta councillor
    ("ee50d01e-c2ca-4753-b14b-4acc3c217c79", "Wendy Beck-Orlando", None),
    # Duncan
    ("dd6a5ac5-3f7c-4219-ae68-778d3d45864c", "Bernice Timmer", None),
    # Enderby
    ("a01fb16b-f5c4-4333-af28-dd6b0167307a", "David Lancaster", None),
    ("a01fb16b-f5c4-4333-af28-dd6b0167307a", "Shawn Shishido", None),
    # Esquimalt councillor
    ("91d7b53b-9a6c-4cc0-81ae-16e20ee10ece", "Robb Johnstone", None),
    # Fernie councillor
    ("69edefb2-67d0-449b-9763-f9a990ce7ed3", "Alleine Anselmo", None),
    ("69edefb2-67d0-449b-9763-f9a990ce7ed3", "Scott Tibballs", None),
    # Fort St. John councillor
    ("e514452d-5a34-42ec-be0a-eb2a6a4e6143", "Tony Zabinsky", None),
    # Fraser Cascade SD78 trustee
    ("91f5b39e-abca-4c46-a467-31bfd42d89ab", "Benita Hatt", None),
    # Fraser Lake councillor (Dave Christie is LINKED, see below)
    ("ea60bdac-2e11-433e-a266-4fb0e4369969", "Audrey Fennema", None),
    # Greater Victoria SD61 trustee
    ("15aec55c-6018-4299-9e3c-9497c67a54be", "Ken Waldron", None),
    # Greenwood
    ("6fb80a3e-99b1-4c26-afd5-4149a923cef0", "CJ Rhodes", None),
    # Haida Gwaii SD50 trustee
    ("f42b597b-5118-4a9f-b4d0-fef4ede6a826", "Tammy Gates", None),
    # Harrison Hot Springs councillor
    ("e138a0ff-8753-4a01-a7cb-e70b60ab23f3", "Gabby Thornton", None),
    # Highlands
    ("1371a880-1201-481f-b0b4-3ff5bd032e8c", "Marcie McLean", None),
    ("1371a880-1201-481f-b0b4-3ff5bd032e8c", "Karel Roessingh", None),
    # Hope
    ("15d3f45e-e043-471a-a429-b042a0ecd455", "Victor Smith", None),
    # Kamloops
    ("e2fff4bf-3f58-4dd3-aa05-ae2c501cd68f", "Nancy Bepple", None),
    ("e2fff4bf-3f58-4dd3-aa05-ae2c501cd68f", "Steve Bucher", None),
    # Kitimat
    ("527f1584-0159-4144-8d3b-f8d8b216c007", "Louise Avery", None),
    ("527f1584-0159-4144-8d3b-f8d8b216c007", "Mario Feldhoff", None),
    ("527f1584-0159-4144-8d3b-f8d8b216c007", "Gregory Judas", None),
    ("527f1584-0159-4144-8d3b-f8d8b216c007", "Gerry Leibel", None),
    ("527f1584-0159-4144-8d3b-f8d8b216c007", "Graham Pitzel", None),
    # Kootenay-Columbia SD20 trustee
    ("5052e421-7b0a-4e23-b989-b488d71ef54a", "Mark Wilson", None),
    # Kootenay Lake SD8 trustee
    ("9115c5bd-8a0f-4f48-ae9f-f92c918ac4e8", "Sharon Nazaroff", None),
    # Ladysmith
    ("2a845d59-9bd7-475e-ae96-d4c32b3cf4dc", "April Marrington", None),
    # Lake Country
    ("57f84363-2f3e-4067-8462-13a6fbd24d69", "Lynn Bursaw", None),
    # Langley City
    ("56cc8f29-e42a-438c-82e1-37d562f530a4", "Paul Albrecht", "Langley City First"),
    ("56cc8f29-e42a-438c-82e1-37d562f530a4", "Gurjit Dhillon", None),
    # Langley Township councillor
    ("a57ca0c5-9958-43ce-938d-7550e5af3468", "Sarb Rai", "Progress for Langley"),
    ("a57ca0c5-9958-43ce-938d-7550e5af3468", "Tess Rouse", "Progress for Langley"),
    # Lions Bay
    ("db3c82d6-f677-4656-9899-54ad29b652cb", "Ron McLaughlin", None),
    # Logan Lake
    ("61750ae6-eaf1-42ac-91fc-9c2bf03d0f42", "Robin Smith", None),
    # Mackenzie
    ("a03c8a47-7978-4a5c-b04c-21321aaf90a5", "Jesse Wright", None),
    # Maple Ridge
    ("2b9bb4f1-171d-457d-8c77-a1485364a2a9", "Korleen Carreras", "A Better Maple Ridge"),
    ("bff0f73f-4325-4081-b88b-851e096086ed", "Dan Ruimy", "A Better Maple Ridge"),
    # Maple Ridge-Pitt Meadows SD42 trustee
    ("0ff2755f-031f-4a8e-ad9f-f86f386432b1", "Jeff Stromgren", None),
    # Merritt
    ("6cd7b7af-4901-4037-8ce3-ef78778c27e6", "Paul Petroczi", None),
    ("9fc2a106-3d74-46f9-b924-7987d1971cab", "Michael Goetz", None),
    # Mission
    ("0cba1bcd-2059-436d-a115-1886b1a71314", "Sharon Sandhu", None),
    ("0cba1bcd-2059-436d-a115-1886b1a71314", "Nelson Tilbury", None),
    ("106924f7-7dba-46e4-aaf8-6b4c1f7e9617", "Jag Gill", None),
    # Nanaimo councillor
    ("10cdc667-621c-4af6-88c1-0bbe2b29912f", "Sandy Bartlett", "REAL"),
    ("10cdc667-621c-4af6-88c1-0bbe2b29912f", "Paul Chapman", None),
    ("10cdc667-621c-4af6-88c1-0bbe2b29912f", "Matthew Miller", None),
    ("10cdc667-621c-4af6-88c1-0bbe2b29912f", "Angela Waldick", None),
    # Nanaimo Mayor
    ("664c595d-619c-454e-a27f-a7525cc2eeda", "Brunie Brunie", None),
    ("664c595d-619c-454e-a27f-a7525cc2eeda", "Anne Marie Dryden", "REAL"),
    # North Cowichan
    ("8c5184e3-18f7-41ce-b4c7-88334ae9b616", "Don Allingham", None),
    # North Vancouver SD44 trustee
    ("c71331d1-10e2-4116-8af9-5465c5867996", "Raheela Khan", None),
    # North Vancouver District councillor
    ("10861b65-804e-4083-bf0c-fb475db0d295", "Jordan Back", None),
    # North Vancouver District Mayor
    ("73051a07-3746-4b20-b330-121a9410c402", "Paolo Pucci", None),
    # Oak Bay
    ("3f6b7cd9-b887-400a-9d44-07cb2f42158a", "Hazel Braithwaite", None),
    ("3f6b7cd9-b887-400a-9d44-07cb2f42158a", "Esther Paterson", None),
    # Oliver
    ("a5e7a9a4-da9e-4244-904c-bab82bdddc00", "Warren Brown", None),
    ("65bbb47b-3b7b-40a6-909c-b887e0192c74", "Wayne Anderson", None),
    # Osoyoos councillor
    ("9d7a7def-8b0a-4cd0-809a-1bdd0849bb77", "J.F. Launier", None),
    ("9d7a7def-8b0a-4cd0-809a-1bdd0849bb77", "Sy Murseli", None),
    ("9d7a7def-8b0a-4cd0-809a-1bdd0849bb77", "Ron Sargeant", None),
    # Penticton councillor
    ("0cda973e-f10d-49ed-b6b9-d6e66be68c5d", "John Cowan", None),
    # Pitt Meadows
    ("bf33a0d5-4351-46c4-b3fd-e6fce93e4a5e", "Nicole MacDonald", None),
    # Port Alberni
    ("f208fdb8-368e-431d-a65f-78aa56fae1a9", "Diljeet Hundal", None),
    # Port Moody councillor
    ("1724a9f2-acb9-42f3-ad39-17b37b355e19", "Tracey Schaeffer", None),
    # Pouce Coupe
    ("7bce4e0d-83c8-4a50-aab9-8186c3bc353e", "James Wall", None),
    # Powell River
    ("3250f58e-aa93-4b43-9785-37c594ce0116", "Diana Collicutt", None),
    ("3250f58e-aa93-4b43-9785-37c594ce0116", "Darryl Jackson", None),
    ("3250f58e-aa93-4b43-9785-37c594ce0116", "Dustin Silvey", None),
    # Prince George councillor
    ("febf40db-6b82-47c0-a1d8-348f0599c51f", "Tim Bennett", None),
    ("febf40db-6b82-47c0-a1d8-348f0599c51f", "Dan McLaren", None),
    ("febf40db-6b82-47c0-a1d8-348f0599c51f", "Bruce Wayne", None),
    # Princeton Mayor
    ("05689769-49af-47bf-8617-9f22795d4f4a", "Louise Schuck", None),
    # Quesnel councillor
    ("1fd9deac-682f-4074-9e27-b822af91e399", "Jeremy Drew", None),
    ("1fd9deac-682f-4074-9e27-b822af91e399", "Ben Freeman", None),
    # Quesnel Mayor (Tony Goulet is LINKED, see below)
    ("fa34da94-6ec8-45b1-af80-b059e84ac9ec", "Ron Paul", None),
    # Radium Hot Springs Mayor
    ("139eb7b7-0527-4b02-8bbb-2ab8368372f9", "Mike Gray", None),
    # Revelstoke councillor
    ("fa44503f-29fd-4378-89c1-fff661db6964", "Matt Cherry", None),
    # Rocky Mountain SD6 trustee
    ("8ae69a1b-039c-4845-b209-557b7bcc9477", "Scott King", None),
    # Rossland
    ("225a6981-688e-4b3b-bf22-5d6d59a0f719", "Melanie Mercier", None),
    # Saanich
    ("40f13ceb-7e5e-4cef-90e1-fb2e1428e37c", "Hollis Hodson", None),
    ("40f13ceb-7e5e-4cef-90e1-fb2e1428e37c", "Matt McGeachie", "SAVE OUR SAANICH"),
    ("726be175-6450-429a-abc3-28702b02db18", "Rishi Sharma", "SAVE OUR SAANICH"),
    # Salmon Arm councillor
    ("144198b7-09e0-4568-8bd1-68e271f4b97c", "Ian Gray", None),
    ("144198b7-09e0-4568-8bd1-68e271f4b97c", "Anthony McLean", None),
    ("144198b7-09e0-4568-8bd1-68e271f4b97c", "Scott Syme", None),
    # Sidney councillor
    ("975c2001-e785-4830-a030-5ec2c6ac62d1", "Steve Price", None),
    # Smithers councillor
    ("4ee750de-18fd-4312-8d73-941e442eca5e", "Sam Raven", None),
    # Summerland councillor
    ("a7b410c0-2af1-4170-970a-5effb6d44cc8", "Erin Trainer", None),
    # Surrey councillor
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Michael Dunn", "Surrey Connect Public IA"),
    ("cb10fe54-6ad7-42dd-b54a-4addb398448e", "Rob Stutt", "Surrey Connect Public IA"),
    # Tumbler Ridge councillor
    ("746bcdc1-4f4c-408c-bef6-df9611d28742", "Rick Consalvi", None),
    # Vancouver councillor
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Amanda Boggan", "TEAM"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "John Coupar", "Vancouver Liberals"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Josh Gordon", "TEAM"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Charles Kelly", "TEAM"),
    ("0d79fc10-524e-4bef-815f-b8886483a762", "Kathleen Larsen", "TEAM"),
    # Vancouver Mayor
    ("deb74440-dd43-475e-9166-bd2c921d5c91", "Colleen Hardwick", "TEAM"),
    # Vanderhoof councillor
    ("08d0f5ad-3dba-446a-829c-7d6219331cfa", "Tom Bulmer", None),
    # Victoria councillor
    ("a446fdd8-9e09-4a82-8053-706879a55acf", "Wendy Bowkett", None),
    ("a446fdd8-9e09-4a82-8053-706879a55acf", "Jerry Garcia", None),
    # West Kelowna councillor
    ("6f563307-af86-49b0-974a-2f4d6bcb7b41", "Gary Buckberry", None),
    ("6f563307-af86-49b0-974a-2f4d6bcb7b41", "Tom Groat", None),
    # West Vancouver SD45 trustee
    ("3117da5c-6ded-4b36-a32c-ed0a87845b6b", "John Calimente", None),
    # White Rock Mayor
    ("887a1734-4a4a-447e-983d-d8b2059f30ef", "Susan Bains", "Together For White Rock"),
    ("887a1734-4a4a-447e-983d-d8b2059f30ef", "Chris Shields", None),
]

# (seat_id, existing_profile_id) -- confirmed same person via office_holders
# match on the SAME map_shape_id as the seat, or (Tony Goulet / Dave Christie)
# via the profile already minted for them in the Sept 4 pass on a related
# race in the same small community -- see chat for the reasoning per case.
LINKED = [
    ("e4ecd889-edeb-46b6-ae75-025c9c6a9684", "63708e7c-804d-4167-88c5-a2e46ddfbfd9"),  # Fernie Mayor - Kyle Hamilton
    ("d6979d9d-b9c0-4840-958b-63db46df2bfc", "d490ed17-e0cf-4ff3-9147-30ad148ab114"),  # Grand Forks Mayor - Everett Baker
    ("f9b66070-f23b-4f4e-8196-191e90e4437e", "b773dff5-ca3e-4eff-890e-810099ef7343"),  # Kamloops Mayor - Mike O'Reilly
    ("4a2f8e37-46d3-4d3f-ad76-70f026e76b2c", "272ac53d-01ce-4de2-a3df-7c49d5a4216d"),  # Kitimat Mayor - Philip/Phil Germuth
    ("ec1248e7-260c-4cd8-a69f-ae6e4e8905c9", "2b03d6f2-15af-454f-bf16-888fefa5bffa"),  # Port Hardy Councillor - John Tidbury
    ("c03ff9c7-b4b3-4d22-9412-c8ae2bbd59a1", "cc8bdc3d-5830-4af7-bb3b-a20f90b62d76"),  # Salmon Arm Mayor - Alan Harrison
    ("1d85f9fe-3aac-46d6-bffa-14daf1b69139", "a746afcd-ac71-45bf-addd-085992c24830"),  # Summerland Mayor - Doug Holmes
    ("40c371c5-1098-4351-ac2e-ed2cba922799", "d06486ce-31ca-4977-a367-37a7a0552282"),  # Surrey Mayor - Brenda Locke
    ("9afdb890-f866-4210-b282-c16e794dacd4", "3473cb5b-ffef-4014-b773-29d8dcd08627"),  # Williams Lake Mayor - Surinderpal Rathor
    ("69ceedd7-76ab-4dcd-9439-e7c0090e5883", "1a2e3ced-bfce-4f5d-bbb4-79883f784e66"),  # Victoria Mayor - Marianne Alto
    ("a446fdd8-9e09-4a82-8053-706879a55acf", "ed09ae8f-dc48-4e29-b842-01c5bf5aaa8f"),  # Victoria Councillor - Stephen Hammond
    ("fa34da94-6ec8-45b1-af80-b059e84ac9ec", "fde48f08-afea-42ee-830d-0bd349873503"),  # Quesnel Mayor - Tony Goulet (same profile as SD28 trustee bid)
    ("ea60bdac-2e11-433e-a266-4fb0e4369969", "9f75a956-e702-4307-bb8d-3ed7bfa66cdd"),  # Fraser Lake Councillor - Dave Christie (same profile as SD91 trustee bid)
]

sql = ["BEGIN;"]

if NEW_PARTIES:
    values = ",\n".join(f"('{c}','{n}')" for c, n in NEW_PARTIES)
    sql.append(
        "INSERT INTO public.political_parties (country, name)\n"
        f"SELECT v.country, v.name FROM (VALUES {values}) AS v(country, name)\n"
        "WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.country AND p.name=v.name);"
    )

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid) ON COMMIT DROP;")
values = []
for seat_id, name, party in STUB:
    values.append(f"({qstr(seat_id)},{qstr(name)},{qstr(party)},gen_random_uuid())")
sql.append("INSERT INTO new_stub (seat_id, name, party_name, stub_id) VALUES " + ",\n".join(values) + ";")

sql.append(
    "INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) "
    "SELECT stub_id, 'politician', name, true, 'Canada', gen_random_uuid() FROM new_stub;"
)
# Always create a politician_profiles row for every stub, party or not
# (political_party_id is nullable) -- the Sept 4 pass's bug was gating this
# insert on party_name IS NOT NULL and silently skipping the no-party rows.
sql.append(
    "INSERT INTO public.politician_profiles (id, political_party_id) "
    "SELECT ns.stub_id, pp.id FROM new_stub ns "
    "LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name;"
)
sql.append(
    f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) "
    f"SELECT seat_id, stub_id, 'approved', now(), {qstr(ADMIN_ID)} FROM new_stub;"
)

if LINKED:
    link_values = ",\n".join(
        f"({qstr(s)},{qstr(p)},'approved',now(),{qstr(ADMIN_ID)})" for s, p in LINKED
    )
    sql.append(
        "INSERT INTO public.election_candidates "
        "(seat_id, politician_id, status, submitted_at, added_by_election_admin_id)\n"
        f"VALUES {link_values};"
    )

sql.append("COMMIT;")

out_path = sys.argv[1] if len(sys.argv) > 1 else "bc_refresh_sept6.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"STUB: {len(STUB)}  LINKED: {len(LINKED)}")
print(f"SQL written to {out_path}")
