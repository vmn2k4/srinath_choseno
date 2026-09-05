#!/usr/bin/env python3
"""Generate SQL for the 2026-09-04 BC LECFA refresh: candidates newly
registered since the 2026-09-03 pull (13-page PDF vs the original 80-row
pull). Dedup against office_holders already done by hand (see chat) --
LINKED entries reuse an existing profile id; STUB entries mint a fresh one."""
import sys

ADMIN_ID = "5b66563e-2674-4fed-b733-3e19955a166a"

NEW_PARTIES = [
    ("Canada", "Burnaby First"), ("Canada", "NEW Burnaby"),
]

# (seat_id, name, party_name_or_None)
STUB = [
    # Abbotsford SD34 trustee
    ("57ade7a2-3779-472f-a4e0-d281c4381f7d", "Raj Patara", None),
    # Anmore councillor
    ("82e5490c-607a-49d6-8556-3a1703bf68ef", "Georgia Lyons", None),
    ("82e5490c-607a-49d6-8556-3a1703bf68ef", "Neil Lyons", None),
    # Armstrong councillor (Cramer/Wehner/Pieper are officeholder-linked, see LINKED)
    ("85f3e7d7-d7f5-45d1-9ad4-2788cb43acca", "Dale Bradley", None),
    ("85f3e7d7-d7f5-45d1-9ad4-2788cb43acca", "Mark Casson", None),
    # Bulkley Valley SD54 trustee
    ("3c458dbd-6346-4b42-9339-54666805f899", "Diane Mackay", None),
    ("3c458dbd-6346-4b42-9339-54666805f899", "Priscilla Michell", None),
    # Burnaby
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Fiorella Ravelli", "Burnaby First"),
    ("f66d0c6e-a32d-4100-8ae5-65345b9ec102", "Neha Unadkat", "NEW Burnaby"),
    ("ada1447c-2368-4dc5-8c40-6b8f61781ba7", "Michael Angelo A_BC Robin Hood", None),
    ("78212b91-2bb4-4e68-9d4f-f9548d8102b0", "Haini Xiao", "NEW Burnaby"),
    # Castlegar (MacLeod is linked)
    # Chetwynd Mayor (Courtoreille is linked)
    # Clearwater councillor
    ("b0e9fed2-40e2-48de-8f6a-3f795a3ff3a6", "Brent Buck", None),
    ("b0e9fed2-40e2-48de-8f6a-3f795a3ff3a6", "Michael Krish-Penny", None),
    # Coast Mountains SD82 trustee
    ("0afc5e77-5290-473b-bd96-108014946755", "Monica Simms", None),
    ("0afc5e77-5290-473b-bd96-108014946755", "Margaret Warcup", None),
    # Coldstream councillor
    ("997c6228-75ed-498f-b8be-e9c6ca8792e4", "Scot McNair", None),
    # Colwood councillor
    ("96ea5d44-01e2-4cc3-8e72-96a512fbff57", "Eugene Tseng", None),
    # Coquitlam
    ("8e26193f-60fb-43a9-b263-028195334245", "Genevieve Kyle-Lefebvre", None),
    ("621d9928-55ca-484d-bc9a-2f526a36fa56", "Madhavee Inamdar", None),
    ("5195b31e-97f2-4b03-b658-b6b90d376449", "Michael Baumann", None),
    ("5195b31e-97f2-4b03-b658-b6b90d376449", "Tracy Green", None),
    # Cowichan Valley SD79 trustee
    ("0c2279a5-067a-4b46-b379-3e0c428686bc", "David Bellis", None),
    # Dawson Creek councillor
    ("184f40f0-96a0-4201-8f78-5e5790e07383", "Amy Kaempf", None),
    # Delta councillor (Johal is linked)
    ("ee50d01e-c2ca-4753-b14b-4acc3c217c79", "Sylvia Bishop", "One Delta"),
    ("ee50d01e-c2ca-4753-b14b-4acc3c217c79", "Sarah Gallop", "One Delta"),
    ("ee50d01e-c2ca-4753-b14b-4acc3c217c79", "Pawan Joshi", "One Delta"),
    ("ee50d01e-c2ca-4753-b14b-4acc3c217c79", "Brian White", None),
    # Delta SD37 trustee
    ("d17fe13a-6e1b-4b0c-a358-02035db724a5", "Ammen Dhillon", "One Delta"),
    ("d17fe13a-6e1b-4b0c-a358-02035db724a5", "Masako Gooch", "One Delta"),
    ("d17fe13a-6e1b-4b0c-a358-02035db724a5", "Gurinder Kahlon", "One Delta"),
    ("d17fe13a-6e1b-4b0c-a358-02035db724a5", "Jim McMurtry", None),
    ("d17fe13a-6e1b-4b0c-a358-02035db724a5", "Surj Uppal", "One Delta"),
    ("d17fe13a-6e1b-4b0c-a358-02035db724a5", "Val Windsor", "One Delta"),
    # Fernie councillor
    ("69edefb2-67d0-449b-9763-f9a990ce7ed3", "Joshua Slykhuis", None),
    # Fort St. James
    ("3ccab755-735d-416c-9aa9-5f1ea516a104", "Brenda Gouglas", None),
    ("d8538b6f-5913-4725-8058-02e0a1ab4b2c", "Bob Maxwell Motion", None),
    # Fort St. John councillor (Hansen mayor is linked)
    ("e514452d-5a34-42ec-be0a-eb2a6a4e6143", "Ovvian Hill", None),
    # Fruitvale Mayor
    ("21470afa-b570-4636-bd48-36e0c52f041e", "Catherine Guesford", None),
    # Grand Forks councillor
    ("53cbee7f-0686-4240-bdb1-60635b25b3a4", "Shaun Aquiline", None),
    # Harrison Hot Springs councillor (Facio is linked)
    ("e138a0ff-8753-4a01-a7cb-e70b60ab23f3", "Greg Veltman", None),
    ("e138a0ff-8753-4a01-a7cb-e70b60ab23f3", "Gary Webster", None),
    # Ladysmith councillor (Virtanen is linked)
    # Lake Country councillor (Patel is linked)
    # Langford Mayor (Goodmanson is linked)
    # Langley SD35 trustee
    ("60f27447-52f0-40be-a90f-a3f3a49e29b6", "Celene Hoag", None),
    # Langley Township councillor (Baillie/Ferguson/Rindt are linked); St. Germain new
    ("a57ca0c5-9958-43ce-938d-7550e5af3468", "Michele St. Germain", "Progress for Langley"),
    # Langley Township Mayor (Woodward is linked)
    # Metchosin councillor
    ("5c274704-5508-486b-9e51-1f32e38ec49e", "Shelly Donaldson", None),
    ("5c274704-5508-486b-9e51-1f32e38ec49e", "Eric White", None),
    # Midway (Pownall/McMynn/Dunsdon are linked) -- none left new
    # Mission SD75 trustee
    ("86f4d538-0ccc-4782-9b60-6e99ad955329", "Linda Hamel", None),
    # Nanaimo councillor
    ("10cdc667-621c-4af6-88c1-0bbe2b29912f", "Rob Phelan", None),
    # Nanaimo Ladysmith SD68 trustee
    ("f9a7ddc0-9e90-4143-9932-84671a488368", "Kailey Gillam", None),
    # Nechako Lakes SD91 trustee
    ("73598fee-a71f-4562-a03b-9ca87f2b5175", "Dave Christie", None),
    # Nicola Similkameen SD58 trustee
    ("958ea2ad-c5c7-49b6-a170-555e2e341d94", "Jamie Kent-Laidlaw", None),
    # North Cowichan councillor (Istace is linked)
    # North Vancouver City councillor
    ("1421cf3d-eb28-4bef-bcb6-613c77923f94", "Max Lai", None),
    # North Vancouver District councillor -- Jim Hanson is an officeholder
    # under NV *City* (different map_shape); treated as a distinct stub
    # rather than force-linked across jurisdictions.
    ("10861b65-804e-4083-bf0c-fb475db0d295", "Jim Hanson", None),
    # Osoyoos Mayor
    ("d368d266-ada4-44ba-8e4b-8abc357f203a", "Hart Buckendahl", None),
    # Parksville councillor (Fras is linked)
    # Peace River South SD59 trustee
    ("3f5b043c-f134-4a28-9885-f44419eb1931", "Chad Anderson", None),
    ("3f5b043c-f134-4a28-9885-f44419eb1931", "Roxanne Gulick", None),
    ("3f5b043c-f134-4a28-9885-f44419eb1931", "Travis Jones", None),
    # Port Alberni councillor
    ("f208fdb8-368e-431d-a65f-78aa56fae1a9", "Nina Kossenko", None),
    # Port Edward (McDonald/Franzen are linked)
    # Port Hardy Mayor
    ("280babed-2bfb-4d61-893c-45332c4df2ea", "Pat Corbett-Labatt", None),
    # Port McNeill councillor
    ("54205f36-8128-459b-84d3-ce78d0754ba7", "Leighann Ruel", None),
    # Pouce Coupe councillor
    ("7bce4e0d-83c8-4a50-aab9-8186c3bc353e", "Chad Spencer", None),
    # Prince George (Scott/Frizzell are linked)
    # Princeton councillor
    ("44ab6c2a-52db-44cd-84a8-89bc49910038", "Amanda Werry", None),
    # Quesnel SD28 trustee
    ("fc4f873e-5c1b-474c-9f65-a561b63a48df", "Lisa Boudreau", None),
    ("fc4f873e-5c1b-474c-9f65-a561b63a48df", "Tony Goulet", None),
    # Revelstoke councillor (Devlin already in DB)
    ("fa44503f-29fd-4378-89c1-fff661db6964", "Robyn Goldsmith", None),
    ("fa44503f-29fd-4378-89c1-fff661db6964", "John Hordyk", None),
    # Revelstoke Mayor (Palmer is linked)
    # Revelstoke SD19 trustee
    ("acf34324-42e8-40a4-9ed9-ec4e0b67a4dc", "Joanne Gawler", None),
    # Saanich SD63 trustee
    ("a7e987c6-dd76-4158-96e7-460d1fb38d74", "Monique Hiltz", None),
    ("a7e987c6-dd76-4158-96e7-460d1fb38d74", "Joey Martin", None),
    # Sea to Sky SD48 trustee
    ("f467660b-73e0-4d76-9d21-734bcf5e0df5", "Susan Hamersley", None),
    # Sidney councillor (Garnett/Novek are linked)
    ("975c2001-e785-4830-a030-5ec2c6ac62d1", "Eric Diller", None),
    # Slocan councillor
    ("3b24b1b3-fbbe-400d-a1d6-8d5fb75151eb", "Alex Cendese", None),
    ("3b24b1b3-fbbe-400d-a1d6-8d5fb75151eb", "Therin Rhaintre", None),
    # Spallumcheen councillor (Bakker/Casson are linked)
    # Squamish councillor (Hamilton is linked)
    # Surrey SD36 trustee
    ("496873af-b915-4556-a90b-c6a2efff415a", "Dee Reiter", None),
    # Vancouver Island North SD85 trustee
    ("07067241-90b0-4c73-b525-4e8c777d51b7", "Fred Robertson", None),
    # Vanderhoof councillor (Martens is linked)
    ("08d0f5ad-3dba-446a-829c-7d6219331cfa", "Ross Coubrough", None),
    # Vanderhoof Mayor (Moutray is linked)
    # Victoria Mayor
    ("69ceedd7-76ab-4dcd-9439-e7c0090e5883", "Lyall Atkinson", None),
    # West Kelowna councillor
    ("6f563307-af86-49b0-974a-2f4d6bcb7b41", "Chris Moyer", None),
    # West Vancouver councillor
    ("675639f8-dff3-41e9-b664-ba3d15fb927c", "Jay Sidhu", None),
    # West Vancouver Mayor (Sager is linked)
    # West Vancouver SD45 trustee
    ("3117da5c-6ded-4b36-a32c-ed0a87845b6b", "Sheelah Donahue", None),
    # Whistler councillor
    ("ea35648f-c326-4dcb-bb34-0b471a9273cc", "Raul Bautista", None),
    # White Rock councillor (Cheung is linked)
]

# (seat_id, existing_profile_id) -- confirmed same person via office_holders
# match on the SAME map_shape_id as the seat, name matching exactly.
LINKED = [
    ("dd6a5ac5-3f7c-4219-ae68-778d3d45864c", "eae6d3c2-85b5-4d73-99fa-1891b8483b46"),  # Duncan - Carol Newington
    ("ee50d01e-c2ca-4753-b14b-4acc3c217c79", "3870af88-b1ed-45fc-a1d9-46ffc71701b6"),  # Delta - Jennifer Johal
    ("9b448b3e-5a7f-4516-b1b0-51a490a3fc94", "c7f58bb5-8d31-498a-a04b-5ea5e4489968"),  # Delta Mayor - Dylan Kruger
    ("8e9231e9-99c0-47f8-bf9a-7b02bb87d604", "c336fe88-d009-43b1-b693-46db4a6b25c0"),  # Parksville - Adam Fras
    ("f29b9e30-e091-488b-9ac3-6b8f736ffc12", "22e26df1-12d4-4437-819e-c0dfc029ceda"),  # Port Edward - Colleen McDonald
    ("142da00c-9005-4d92-9e02-8b2a9cdf8d81", "c8f50798-8044-42b4-bbbc-7185c4d8154d"),  # Port Edward Mayor - Dan Franzen
    ("febf40db-6b82-47c0-a1d8-348f0599c51f", "601eadb3-9526-4cb8-b4e4-2fb178fc690f"),  # Prince George - Susan Scott
    ("ea173600-a227-4dea-aa39-372da7672d6a", "d1978eef-f083-4be7-a9d4-47a070a71441"),  # Prince George Mayor - Garth Frizzell
    ("67a4f0ed-09cf-40ee-8ae9-3641a1619292", "d658c16a-b765-4ce6-968d-ce279016a334"),  # Revelstoke Mayor - Tim Palmer
    ("d28d6fe7-6888-48fa-b18f-91ec59ade768", "5023972b-000b-4399-b08e-d6e9238a590e"),  # Squamish - Andrew Hamilton
    ("df12b815-bda7-4da7-a9e9-e3be6ebcfb59", "1026a3a0-ed40-4de5-b2d4-5c2aecc73491"),  # West Vancouver Mayor - Mark Sager
    ("378f0aa5-19ff-4afe-b7ef-24b409046045", "72c579a7-ab62-4e31-9711-f60f12aaf8a6"),  # Chetwynd Mayor - Allen Courtoreille
    ("e48b07c0-b607-4f0a-ab7a-1245d511b122", "99c79171-4bf1-4017-89d5-46504b3eb7bf"),  # Enderby Mayor - Dave Ramey
    ("e38debbf-6f1a-4605-8d27-583a20e5811e", "0c445997-0278-4df8-b6bb-88fa7acf9f72"),  # Fort St. John Mayor - Lilia Hansen
    ("2a646ea0-85af-4da9-b903-07c440273575", "ec93217f-120e-447a-90fc-ec7ba0f7313e"),  # Langford Mayor - Scott Goodmanson
    ("a57ca0c5-9958-43ce-938d-7550e5af3468", "d51c0c00-33ba-4b51-a5f8-7c45c98e92b3"),  # Langley Twp - Rob Rindt
    ("a57ca0c5-9958-43ce-938d-7550e5af3468", "3ee39b3b-d850-49b9-b9d7-26d3b49f72c2"),  # Langley Twp - Tim Baillie
    ("a57ca0c5-9958-43ce-938d-7550e5af3468", "6a2fd324-1fa8-4ebf-85e3-d5799f5da13d"),  # Langley Twp - Steve Ferguson
    ("c9ec0dd8-ff22-414f-a08f-16e0cf724769", "a5637890-3678-4ae1-b4d6-ff4a4c61d1f7"),  # Langley Twp Mayor - Eric Woodward
    ("dadfa68a-fb2c-4d6d-833b-02a850cbc74a", "0d3245c2-6dd0-4c78-9ced-c6375d03b2ad"),  # Midway - Aaron Pownall
    ("e50f5e5e-b6a7-4dc3-b45c-22455a454777", "7b52b70b-dcc0-4b55-bae6-c3aaeaa69e4d"),  # Midway Mayor - Doug McMynn
    ("dadfa68a-fb2c-4d6d-833b-02a850cbc74a", "9e12c6c5-7e59-4d71-b09d-f8e9a5f10d03"),  # Midway - Richard Dunsdon
    ("bd2a5c89-ee67-43f4-b2e4-e44d15652f55", "2d25736d-dcc0-4fb7-98f0-6e1fe88fce99"),  # Vanderhoof Mayor - Kevin Moutray
    ("08d0f5ad-3dba-446a-829c-7d6219331cfa", "d0039e74-5258-4fd8-ad4f-136d1e17433f"),  # Vanderhoof - Ernest Martens
    ("523abd58-774f-4eac-bde6-d7ff90cf8cca", "5172a923-dcec-4302-aff4-9506f3437e7d"),  # Armstrong Mayor - Joe Cramer
    ("85f3e7d7-d7f5-45d1-9ad4-2788cb43acca", "de61a2ab-6dec-4a3d-ad3a-fdfb62d8a5f1"),  # Armstrong - Mark Wehner
    ("523abd58-774f-4eac-bde6-d7ff90cf8cca", "a2cfb9d2-e1bb-46dd-bf70-8e93225f7be2"),  # Armstrong Mayor - Chris Pieper
    ("2fe8e7c5-9e1d-43a0-bc4a-704ddf7e03c8", "38b5ef4a-37d3-4bdb-a683-f00745739371"),  # Castlegar - Cherryl MacLeod
    ("e138a0ff-8753-4a01-a7cb-e70b60ab23f3", "fc04a76d-d0b3-4946-b29e-67b670636793"),  # Harrison Hot Springs - Leo Facio
    ("2a845d59-9bd7-475e-ae96-d4c32b3cf4dc", "a17a8060-56a1-4306-b740-60a0c859399f"),  # Ladysmith - Jeff Virtanen
    ("57f84363-2f3e-4067-8462-13a6fbd24d69", "f4830a06-e87a-435f-b4b2-2853df42921f"),  # Lake Country - Bib Patel
    ("8c5184e3-18f7-41ce-b4c7-88334ae9b616", "692bbaa5-5386-4374-b751-28399c7e968d"),  # North Cowichan - Chris Istace
    ("58904782-5a9b-45a8-93fa-a4a5a6653867", "846154be-2da8-490f-8b45-251fe9cf25fb"),  # Spallumcheen - John Bakker
    ("58904782-5a9b-45a8-93fa-a4a5a6653867", "1b32e388-5af9-40b3-a2d4-6b029c403745"),  # Spallumcheen - Andrew Casson
    ("975c2001-e785-4830-a030-5ec2c6ac62d1", "18214b90-1f65-4f3a-ab31-cfe55f1451a4"),  # Sidney - Scott Garnett
    ("975c2001-e785-4830-a030-5ec2c6ac62d1", "0c8e0112-0bd6-469d-99a5-deddb2e3fb59"),  # Sidney - Richard Novek
    ("7de1f018-6c31-499c-bb4b-e7c09226425d", "38d7e176-8381-459e-afff-ebad51a36929"),  # White Rock - Elaine Cheung
]

sql = ["BEGIN;"]

if NEW_PARTIES:
    values = ",\n".join(f"({sql_c},{sql_n})" for sql_c, sql_n in
                         [(f"'{c}'", f"'{n}'") for c, n in NEW_PARTIES])
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
sql.append(
    "INSERT INTO public.politician_profiles (id, political_party_id) "
    "SELECT ns.stub_id, pp.id FROM new_stub ns "
    "LEFT JOIN public.political_parties pp ON pp.country='Canada' AND pp.name = ns.party_name "
    "WHERE ns.party_name IS NOT NULL;"
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

out_path = sys.argv[1] if len(sys.argv) > 1 else "bc_refresh_sept4.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"STUB: {len(STUB)}  LINKED: {len(LINKED)}")
print(f"SQL written to {out_path}")
