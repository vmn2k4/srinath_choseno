#!/usr/bin/env python3
"""Enrich Burnaby's Councillor candidate profiles with real bio, phone,
email, party and source URL -- fetched from burnaby.ca on 2026-09-09 in
the same visit that pulled their photos (bc_sept9_burnaby_photos_and_new.py),
but the bio/contact/party half of that data was never written to the DB,
only the photos -- exactly the enrichment-scope gap documented in
docs/CANDIDATE_DATA_PULL_LOG.md ("Same gap, one office type over" /
Surrey School Trustee section): fetching a page's full text and only using
part of it. Follows the same DATA-dict pattern as surrey_enrich.py; this
is the equivalent reusable template for Burnaby.

Also fixes a real, source-confirmed wrong-party bug found while building
this: James Wang, Joe Keithley, and Maita Santiago were all imported
earlier with political_party_id -> "Independent", but burnaby.ca's own
candidate page states all three run under "BCA - Burnaby Citizens
Association". Corrected with a direct (non-COALESCE) UPDATE since the
existing wrong value isn't NULL and would never be touched by the normal
COALESCE-safe enrichment below.

Not yet done, left for a future pass rather than guessed at here: Burnaby
Mayor (3 candidates) and SD41 School Trustee (9 candidates) bio/contact --
only their photos were fetched+applied so far (see
bc_sept9_burnaby_mayor_trustee_photos.py); the full profile-text fetch for
those two office types hasn't been done yet, unlike Councillor here.
"""
import sys

BASE_URL = "https://www.burnaby.ca/our-city/mayor-and-council/elections/candidates/office-of-councillor-candidate-profiles"

# profile_id -> dict(bio, phone, email, party, links)
DATA = {
    "1f05024c-17eb-4574-a33c-e7d7a6f137ab": dict(  # Neil Chapman
        bio=None, phone=None, email=None, party="Restore Burnaby", links=None),
    "523ea22c-8e16-4078-8a35-5deed50926d4": dict(  # Daniel Chen
        bio="A Creative Entrepreneur, Dedicated Family Man. Born and raised in Greater Vancouver, Daniel moved to Burnaby a decade ago to raise his family, drawn to its urban energy and natural spaces. Over the past ten years, he has witnessed both the promise and pressures facing local families -- from rising living costs to the strains of rapid overdevelopment. As co-founder of Burnaby First and with over 20 years of branding experience, Daniel solves problems by bringing people together and balancing creative ideas with practical solutions. He is dedicated to representing families, young adults and residents who want a thriving community. Daniel believes effective local government requires sound planning and fiscal responsibility to ensure property taxes do not overburden residents and businesses.",
        phone="778-858-7888", email="Daniel.kt.chen@gmail.com", party="Burnaby First",
        links="Website: bio.site/Danchen | Instagram: @danielktchen | Facebook: @mr.danchen | X: @danielktchen"),
    "bfc8ff8d-2171-4fab-8726-dc8e99daacce": dict(  # Larry Chin
        bio="Burnaby has been my home for over 30 years. My spouse and I raised our two children here, surrounded by family, friends and neighbours. I am an experienced leader, entrepreneur and community builder. I earned my Engineering degree from UBC and served as a School Governor, non-profit board member, and director with Fortune 500 and mid-sized companies. I also founded a technology company. For more than a decade, I have devoted my time to community service, supporting cultural and heritage organizations. I currently serve on Burnaby's Public Art Committee. As an independent candidate for Council, I bring practical leadership, community-building experience and independent thinking.",
        phone="778-994-6670", email="larrychinburnaby@gmail.com", party=None,
        links="Website: larrychinburnaby.com | Instagram: @larrychinburnaby | Facebook: @larrychinburnaby"),
    "3b44aba1-08b3-450b-b03e-d5f9cde0dbd2": dict(  # Rocky Dong
        bio="Rocky Dong is a dedicated more than 20-year Burnaby resident, prestigious educator, and entrepreneur. He holds a Computer Science degree alongside professional Cisco CCNA, CCNP, and Microsoft MCSE certifications. With over two decades of experience in Canada's education sector, Rocky possesses the unique leadership skills and business acumen needed to guide our municipality. Notably, he earned the highest votes among all independent candidates during the 2022 Burnaby election. Rocky advocates for job creation, enhanced community safety, and senior and unfortunate people supportive housing.",
        phone="778-801-9723", email="rocky.dong@restoreburnaby.ca", party="Restore Burnaby",
        links="Website: restoreburnaby.ca | Instagram: @restoreburnaby | Facebook: @restoreburnaby"),
    "573d3287-007e-43de-b1dd-610595aa1355": dict(  # Tina Fiorda
        bio="Tina Fiorda has lived in Burnaby since attending high school. She graduated from Burnaby North Senior Secondary and studied Fashion Design and Business Communications at Kwantlen College. Tina ran her own fashion business and won an FBDB award for Best Marketing Program. She spent 26 years as a Costume Designer in film and television, amassing close to 100 film production credits and a Leo Award nomination. Tina believes Burnaby should meet residents' needs while ensuring major projects are effective, affordable, and financially accountable over the long term.",
        phone="778-801-6194", email="tina.fiorda@restoreburnaby.ca", party="Restore Burnaby",
        links="Website: restoreburnaby.ca | Instagram: @restoreburnaby | Facebook: @Restore Burnaby"),
    "33e10eca-47bc-45df-ba3f-99f272cf86c7": dict(  # Gulam Firdos
        bio="I am running for Burnaby City Council as an Independent Liberal to bring experience, community commitment, and leadership to our growing city. As a City Planner and former Board of Variance Member, I understand challenges in the development of Burnaby and importance of municipal decision-making. My objective is to improve the planning process through a universally adaptable and improved Official Community Plan and Land use By Laws, reduce approval time for Building Permits, and ensure residents have a stronger voice in decision making affecting their communities.",
        phone="604-442-2145", email="gulamfirdos@gmail.com", party=None,
        links="Facebook: @Gulam Firdos"),
    "a6f4200e-bc8a-405c-8c0c-df004de825a2": dict(  # Garnet Heidt
        bio="I was born at Burnaby General and came back because I love this city. I work in commercial pest control and I'm running as an independent -- no party, no slate, just Burnaby. To prepare, I attended every city council meeting I could, studied every agenda and met with senior staff and council to understand this role before asking for your vote. My priorities: financial accountability, community engagement, responsible growth.",
        phone="236-509-7092", email="garnet@garnetforburnaby.ca", party=None,
        links="Website: garnetforburnaby.ca | Instagram: @garnetforburnaby"),
    "b721c0e9-3c97-47bc-9ccc-aaf163ce2a33": dict(  # Joe Keithley
        bio="Hello, I'm Joe Keithley and I'm running with the BCA for re-election to a third term on City Council. Born and raised in Burnaby, I'm dedicated to working for fairness, inclusion and opportunity for everyone who calls our city home. My priorities include affordable housing, quality child care and helping the most vulnerable in our community. Since being elected over 7 years ago, I have worked with the BCA team and Mayor Hurley to keep Burnaby taxes among the lowest in the Metro Vancouver region. As Chair of the City's Environment Committee, I've worked to dedicate more than 25% of our land to parks and green spaces.",
        phone=None, email=None, party="Burnaby Citizens Association",
        links="Website: burnaby-citizens.ca"),
    "6d9117d4-b7f1-4e2e-9d13-0b2c068d257d": dict(  # Martin Kendell
        bio="I have proudly called Burnaby home for 25 years where I live with my wife and two children. I am running for City Council to bring honesty, accountability and community involvement to City Hall. Over the past five years, I founded the Clean Up Burnaby Campaign, raising awareness about neighbourhood cleanliness and helping remove more than 3,500 pounds of garbage from Burnaby's streets, parks, and streams. I also successfully advocated for a new City bylaw addressing LED light pollution.",
        phone=None, email="martin@burnabygreenparty.com", party="Burnaby Green Party",
        links="Website: martinkendell.ca and burnabygreenparty.com | Instagram: @martinkendell"),
    "3587f15b-fd81-460b-943b-2a447f21fc91": dict(  # Cindy Lee
        bio="Cindy Lee is a Burnaby lawyer, community advocate and Burnaby Citizens Association candidate for City Council. Cindy earned her law degree from UBC and has built her career supporting workers, families and local businesses. Before practicing law, she spent six years at S.U.C.C.E.S.S., assisting newcomers, families and seniors. A dedicated civic leader, Cindy serves on the boards of the New Vista Society and Burnaby Family Life and is Vice-Chair of the Burnaby North Road BIA.",
        phone=None, email="cindyhylee87@gmail.com", party="Burnaby Citizens Association",
        links="Website: burnaby-citizens.ca | Instagram: @cindy4burnaby | Facebook: @hsinyi.c.lee"),
    "9fcf1a3e-c7dc-4ffa-ada3-5bd680495f4b": dict(  # Ragina Naidu
        bio="Ragina Naidu is a scientist, entrepreneur, business leader and community advocate who believes public service begins with listening. With experience in cancer drug research and business, Ragina has spent her career solving complex problems, bringing people together and turning ideas into practical solutions. Her priorities include affordability, responsible use of taxpayers' money, community safety, support for seniors and families, healthy and connected neighbourhoods and a strong local economy.",
        phone="778-358-4092", email="Ragina.naidu@restoreburnaby.ca", party="Restore Burnaby",
        links="Website: restoreburnaby.ca | Instagram: @restoreburnaby | Facebook: @restoreburnaby"),
    "5c8c898b-7b07-4a94-aaf1-f7c056228a96": dict(  # Morgan Nicholsfigueiredo
        bio="Morgan Nicholsfigueiredo is a third-generation Burnaby resident running for Council with the New Burnaby Party. He will build a safer Burnaby that is more affordable, and inclusive for families, seniors, renters, and working people. Morgan brings more than 30 years of experience managing commercial properties and helping small businesses navigate city processes. He is an elected resident representative on the Burnaby Transportation Committee, a member of the Burnaby Board of Trade, and has served on his Strata Council for more than 20 years.",
        phone=None, email="morgan.nicholsfigueiredo@newburnaby.ca", party="NEW Burnaby",
        links="Website: newburnaby.ca | Instagram: @morgannicholsfigueiredo | Facebook: @morgan.nicholsfigueiredo | LinkedIn: @morgannicholsfigueiredo"),
    "31056d4f-70b1-40d1-a1c7-3ed5c751b9f4": dict(  # Rea Park
        bio=None, phone=None, email=None, party="Burnaby Citizens Association", links=None),
    "cc4d3644-8813-467b-9a1c-229224460359": dict(  # Fiorella Ravelli
        bio=None, phone=None, email=None, party="Burnaby First", links=None),
    "ff70ec28-eb0f-4ac0-be9c-21340b8f6550": dict(  # Maita Santiago
        bio=None, phone=None, email=None, party="Burnaby Citizens Association", links=None),
    "fcef7666-5b99-4937-ac54-ef53adb868ca": dict(  # Tara Shushtarian
        bio="Tara is a proud Burnaby resident and unwavering environmental, social justice, and Indigenous rights activist. Her community work focuses on energy equity and climate resilience. During her two terms on Burnaby's Environment Committee and Fair Vote Canada's Board, Tara advocated for local environmental protection and electoral reform. She currently serves on the Boards of West Coast Climate Action Network, New West Film Society, and CARFAC BC. Tara played a pivotal role in the All On Board Campaign which secured free transit for children under 12.",
        phone="604-889-4216", email="bgp.tara@gmail.com", party="Burnaby Green Party",
        links="Website: burnabygreenparty.com | Instagram: @tarashustarian | Facebook: @Tara Shushtarian | X: @TaraShushtarian | LinkedIn: @Tara Shushtarian"),
    "12eda3b2-e814-4cfb-8d57-cc0bc40bdf46": dict(  # Kiran Singh
        bio="Kiran Singh is a national award-winning investigative and municipal reporter with years of experience in the Canadian media. A reporter and radio producer with CBC News, Kiran's reporting served as a catalyst for municipal and BC-wide changes. Kiran's vision for Burnaby includes robust investments in the arts and recreation, increased political accountability, an equitable transit system, and a renewed focus on active transportation. Kiran speaks English, Hindi, Punjabi, and Urdu, and lives in Burnaby with his partner.",
        phone="778-251-0084", email="kiran4burnaby@gmail.com", party="Burnaby Citizens Association",
        links="Website: burnaby-citizens.ca/candidates/kiransingh | Instagram: @kiransingh4burnaby | Facebook: @kiransingh4burnaby | X: @vancitysingh"),
    "1bf0a565-22b5-4f90-9855-6d035739a330": dict(  # Philip Stojanovski
        bio="As a Burnaby resident and professional workplace investigator, my job is to cut through noise, listen to people, and find the real root cause of problems. I'm running for City Councillor because our local government desperately needs that same accountability and common-sense approach. I'm fighting for better traffic flow, safer streets for everyone walking, biking, and driving, and a city hall that puts residential safety first.",
        phone="778-979-5068", email="Philip.stojanovski55@hotmail.com", party=None,
        links="LinkedIn: @PhilipStojanovski"),
    "22788e03-0d90-4825-ba48-df49322b8799": dict(  # Neha Unadkat
        bio=None, phone=None, email=None, party="NEW Burnaby", links=None),
    "29738513-6ce0-442c-b893-68709fb1263f": dict(  # Mary Blanca Villa y Battenberg
        bio=None, phone=None, email=None, party="Burnaby First", links=None),
    "98a6913e-b3a6-4c65-a85e-fc478983269f": dict(  # James Wang
        bio="My name is James Wang, and I am seeking your support for re-election to Burnaby City Council. I moved to Canada in the late 1990s and have proudly called Burnaby home for more than 20 years. Before being elected to Council in 2014, I served two terms as a Burnaby School Trustee. Working alongside Mayor Mike Hurley and my fellow Burnaby Citizens Association councillors, I remain committed to building a strong, vibrant and well-managed city.",
        phone=None, email="james4burnaby@gmail.com", party="Burnaby Citizens Association",
        links="Website: burnaby-citizens.ca | Instagram: @james4burnaby | Facebook: @james4burnaby | X: @james4burnaby"),
    "deb094f2-65fd-43fc-a793-f7c551c5a549": dict(  # Sabrina Yang
        bio=None, phone=None, email=None, party="NEW Burnaby", links=None),
    # No page text at all beyond "Nomination document / Financial
    # disclosure statement" -- Daniel Tetrault and Vincent Tong genuinely
    # have nothing more on burnaby.ca to enrich with.
    "e5ac35ff-cfd2-4524-95ff-83ff09fdc3bc": dict(bio=None, phone=None, email=None, party=None, links=None),  # Daniel Tetrault
    "b64086ff-0a84-4d53-b6b3-a71e7ebd0456": dict(bio=None, phone=None, email=None, party=None, links=None),  # Vincent Tong
}

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

for pid, d in DATA.items():
    bio_parts = []
    if d["bio"]:
        bio_parts.append(d["bio"])
    if d["links"]:
        bio_parts.append(d["links"])
    bio_final = "\n\n".join(bio_parts) if bio_parts else None

    party_clause = ""
    if d["party"]:
        party_clause = (
            f", political_party_id = COALESCE(political_party_id, (SELECT id FROM public.political_parties "
            f"WHERE country='Canada' AND name={qstr(d['party'])}))"
        )

    sql.append(
        f"UPDATE public.politician_profiles SET "
        f"bio = COALESCE(bio, {qstr(bio_final)}), "
        f"contact_phone = COALESCE(contact_phone, {qstr(d['phone'])}), "
        f"contact_email = COALESCE(contact_email, {qstr(d['email'])}), "
        f"source_url = COALESCE(source_url, {qstr(BASE_URL)})"
        f"{party_clause} "
        f"WHERE id = '{pid}';"
    )

# Correction, not enrichment: these 3 were imported earlier with the wrong
# party ("Independent") -- burnaby.ca's own page confirms all three run
# under BCA. A plain COALESCE would never touch an already-non-null wrong
# value, so this is a direct SET, scoped tightly to just these 3 rows and
# only proceeding if the current value really is the known-wrong one (so
# re-running this script is always safe/idempotent).
WRONG_PARTY_FIXES = [
    "98a6913e-b3a6-4c65-a85e-fc478983269f",  # James Wang
    "b721c0e9-3c97-47bc-9ccc-aaf163ce2a33",  # Joe Keithley
    "ff70ec28-eb0f-4ac0-be9c-21340b8f6550",  # Maita Santiago
]
for pid in WRONG_PARTY_FIXES:
    sql.append(
        "UPDATE public.politician_profiles SET political_party_id = "
        "(SELECT id FROM public.political_parties WHERE country='Canada' AND name='Burnaby Citizens Association') "
        f"WHERE id = '{pid}' AND political_party_id = "
        "(SELECT id FROM public.political_parties WHERE country='Canada' AND name='Independent');"
    )

sql.append("COMMIT;")

out_path = sys.argv[1] if len(sys.argv) > 1 else "burnaby_enrich.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"{len(DATA)} candidates enriched, {len(WRONG_PARTY_FIXES)} wrong-party corrections")
print(f"SQL written to {out_path}")
