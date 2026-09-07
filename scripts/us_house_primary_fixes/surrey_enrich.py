#!/usr/bin/env python3
"""Enrich Surrey's 32 mayor+councillor candidate profiles with real bio,
phone, email, party, and source URL -- fetched directly from each
candidate's own page at surrey.ca (2026-09-06). politician_profiles
already has bio/contact_phone/contact_email/source_url columns sitting
empty; no schema/social-links table exists, so website + social handles
are folded into a short "Links:" line appended to bio instead."""
import sys

# profile_id -> dict(bio, phone, email, party, source_url, links)
DATA = {
    "93629f07-4275-4ff7-a5d8-f50d43184ed8": dict(  # Jesse Aajohl
        bio=None, phone=None, email="info@surreynow.ca", party="SURREY NOW",
        source_url="candidates-office-of-councillor/aajohl-jesse", links="Website: www.surreynow.ca"),
    "77326bc2-5ccd-48fa-927d-e2657882de64": dict(  # Debra Antifaev
        bio="Debra Antifaev has spent more than 26 years as an advocate for children with special needs and currently serves as Director of Families for Early Autism Treatment (FEAT BC). She was also a member of the Pacific Autism Family Network's steering committee and is a lifelong volunteer and community fundraiser. Debra served on the Semiahmoo Secondary Parent Advisory Council, was team manager when her sons played hockey, and was an active member of the Semiahmoo Music Society. Together with her family, Debra lives in South Surrey.",
        phone="604-617-7437", email="deb.antifaev@surreyfirst.org", party="Surrey First",
        source_url="candidates-office-of-councillor/antifaev-debra",
        links="Website: www.surreyfirst.org | X: @debantifaev | Facebook: debra.antifaev | Instagram: @surreyfirst.debraantifaev"),
    "ef0848ed-5854-4a47-ad5a-4f9b064a3e30": dict(  # Harry Bains
        bio="Harry Bains is a lawyer, father of two, and proud Surrey resident of more than 30 years. Through his legal career, he has worked closely with local businesses and residents, gaining firsthand insight into the challenges facing Surrey's growing community. He is committed to building safer neighbourhoods, supporting families, and ensuring responsible, transparent leadership. As Chair of the Focus Newton Task Force, Harry helped advance initiatives to revitalize Newton through safer streets, improved public spaces, and key infrastructure investments. His priorities include enhancing public safety, improving housing affordability, supporting healthcare and education, strengthening transit, and fostering smart growth that keeps Surrey a vibrant, connected, and thriving city for generations to come.",
        phone="236-412-5575", email=None, party="Surrey Connect Public IA",
        source_url="candidates-office-of-councillor/bains-harry",
        links="Website: www.surrey-connect.ca | X: @HarryBainsSC | Instagram: @HarryBainsSC"),
    "4e2b8d5b-cd83-4e52-a3a0-d62edf290116": dict(  # Gail Beszedes
        bio=None, phone=None, email=None, party="SURREY NOW",
        source_url="candidates-office-of-councillor/beszedes-gail", links=None),
    "f7695818-1444-4552-a117-a70a249a64ba": dict(  # Mike Bose
        bio="Councillor Mike Bose is a fourth-generation Cloverdale farmer who was elected to council in 2022. A life-long advocate for Surrey agriculture and food security, Bose is chair of the Mutual Fire Insurance Company and was a Cloverdale hockey coach for 30 years. A founder of the city's Agriculture Advisory Committee, Bose has served on Metro Vancouver's Agriculture Advisory Committee, Provincial Agriculture Land Commission and was president of the Surrey Farmers Institute.",
        phone="604-309-1958", email="mjbose@telus.net", party="Surrey First",
        source_url="candidates-office-of-councillor/bose-mike",
        links="Website: www.surreyfirst.org | Facebook: Michael Bose | Instagram: @mjbose1961 | LinkedIn: Mike Bose"),
    "729ad397-94b9-4d0e-9213-c1eaeb1858d3": dict(  # Janet Brown
        bio="Janet Brown, an award-winning journalist with CKNW and Global TV for more than 30 years, is currently Director of Communications with Surrey Urban Mission. A proud hockey mom with roots in Cloverdale Minor Hockey, Brown is also a block watch captain in her Fraser Heights neighbourhood.",
        phone="778-389-1044", email="penalty44@telus.net", party="Surrey First",
        source_url="candidates-office-of-councillor/brown-janet",
        links="Website: www.surreyfirst.org | X: @JanetBrown980 | Facebook: Janet Brown | Instagram: @janet4surrey | LinkedIn: Janet Brown"),
    "f05d1a76-4493-4f87-8b1c-dd08f6709edc": dict(  # Leanna Chatwin
        bio=None, phone="778-558-4734", email="NewSurreyPlusCampaign@gmail.com", party="New Surrey+",
        source_url="candidates-office-of-councillor/chatwin-leanna", links=None),
    "32e6c84b-002d-48d1-b75d-bbe7f4cd3f13": dict(  # Bilal Cheema
        bio="Bilal Cheema holds a Business Administration degree from Simon Fraser University and spent nearly 20 years in government at both the political and public service levels. He later founded a government relations and business development firm. A former treaty negotiator, Cheema also served as Senior BC Advisor to the Minister of Fisheries and Oceans. He is Chair of the South Asian Community Hub, has served on the board of the Surrey Hospice Society and served on the Surrey Police Board until December 2025. In 2025, he received the King Charles III Coronation Medal for community service. Cheema and his family have called Surrey home for nearly 40 years.",
        phone=None, email=None, party="Surrey First",
        source_url="candidates-office-of-councillor/cheema-bilal", links="Website: www.surreyfirst.org"),
    "e8173181-bf43-4d82-9399-50aca2877f3f": dict(  # Isaac Daniel
        bio=None, phone="778-522-7744", email="isaacisrock76@gmail.com", party=None,
        source_url="candidates-office-of-councillor/daniel-isaac", links=None),
    "86c8b30f-4059-4ba8-bc9c-31f7ca40957b": dict(  # Ollivor Dickson
        bio="Ollivor Dickson is a business owner, healthcare advocate, husband, and father running to bring leadership to Surrey City Council. As founder of a multidisciplinary healthcare clinic employing more than 35 practitioners, Olli understands managing budgets, creating jobs, and delivering results. He serves as Treasurer of the Registered Massage Therapists' Association of BC (RMTBC), providing financial oversight and leadership, and is founding Chair of the GLCC NextGen Committee supporting business owners and entrepreneurs under the age of 40. Olli's priorities are clear: freeze property taxes and demand accountability for every tax dollar; make Surrey safer by strengthening enforcement and tackling crime; cut wasteful spending; support local businesses and responsible development; and invest in youth, recreation, and sports to build stronger communities.",
        phone="604-780-0342", email="info@surreynow.ca", party="SURREY NOW",
        source_url="candidates-office-of-councillor/dickson-ollivor",
        links="Website: www.surreynow.ca | Instagram: @ollidickson | LinkedIn: Olli Dickson"),
    "1f63cd2e-3b67-4f57-bfa5-3cfd35e23c32": dict(  # Michael Dunn
        bio="Michael Dunn is a second-generation Surrey resident and proud father of two. He attended Surrey schools from Kindergarten through Grade 12 and has degrees in Economics & Law. A lawyer and Realtor, Michael spent over 17 years as a barrister and the past 15 years working in real estate. He remains a registered member of the Law Society of British Columbia and has served on numerous boards and in public-service roles.",
        phone="236-878-1434", email="info@surrey-connect.ca", party="Surrey Connect Public IA",
        source_url="candidates-office-of-councillor/dunn-michael",
        links="Website: www.surrey-connect.ca | Facebook: michaeldunn339 | Instagram: @michaeldunn339 | LinkedIn: Michael Dunn JDFRI"),
    "a7b66aeb-4a8f-4c1b-83cc-995e783caeb3": dict(  # Rahul Gill
        bio="Rahul Gill is a Surrey business owner and longtime community advocate who has spent two decades helping families put down roots in this city. As founder of Gilco Real Estate and The GillTeam with his wife Aman, Rahul leads a local business that has supported more than 2,300 Surrey families. Rahul is running for Council to bring practical business sense, strong service standards, and a family-first perspective to City Hall.",
        phone="604-562-0068", email="rahulgill606@gmail.com", party="SURREY NOW",
        source_url="candidates-office-of-councillor/gill-rahul",
        links="X: @RahulGill | Facebook: Rahul Gill | Instagram: @RahulGill | TikTok: @RahulGill"),
    "c8d09e1e-b5c5-4919-bea9-1d49bae55b4f": dict(  # Jasroop Gosal
        bio="Jasroop Gosal is Government Relations Manager with the BC Real Estate Association. Prior to joining the Real Estate Association, he was spokesperson and Policy and Research Manager with the Surrey Board of Trade. Gosal earned his Masters in Public Policy from the University of Saskatchewan. Active in the community, Gosal has served on various boards and committees. Gosal and his family live in Fleetwood.",
        phone="778-873-6707", email="jasroop.gosal@surreyfirst.org", party="Surrey First",
        source_url="candidates-office-of-councillor/gosal-jasroop",
        links="Website: www.surreyfirst.org | Facebook: Jasroop Gosal | Instagram: @jasroop4surrey | LinkedIn: Jasroop Gosal"),
    "c23ff6cf-46ab-4ead-8533-98c9a8314f6e": dict(  # Gordon Hepner
        bio="Gordon Hepner is a lifelong Surrey resident, Notary Public, and dedicated community leader committed to building strong neighbourhoods and supporting local families and businesses. As Chair of Surrey's Parks, Recreation and Sport Tourism Committee, Gordon has helped deliver the largest parks and recreation capital program in the city's history. A father of two and longtime youth sports coach, he is passionate about creating healthy, active communities.",
        phone="236-878-1434", email="info@surrey-connect.ca", party="Surrey Connect Public IA",
        source_url="candidates-office-of-councillor/hepner-gordon",
        links="Website: www.surrey-connect.ca | X: @GordHepner | Facebook: Gord Hepner | LinkedIn: Gord Hepner"),
    "5a6149ff-b373-440e-b993-7bbd91a54fdb": dict(  # Youssef Khattab
        bio=None, phone="778-288-2100", email="ynkhattab@gmail.com", party=None,
        source_url="candidates-office-of-councillor/khattab-youssef",
        links="Website: www.youssefkhattab.ca | X: @khattabynk | Facebook: khattabynk | LinkedIn: Youssef Khattab"),
    "3fd62b99-aee2-435c-afaa-566142db7f57": dict(  # Brad Kielmann
        bio=None, phone=None, email=None, party="SURREY NOW",
        source_url="candidates-office-of-councillor/kielmann-brad", links=None),
    "7a688642-c4bf-40cf-8f19-766b0d837b4a": dict(  # Vera LeFranc
        bio="Vera LeFranc is a community-focused leader with a career spanning health care, housing, civic service, and social impact in Surrey. First elected to Surrey City Council in 2014 under Linda Hepner, Vera was named one of the Federation of Canadian Municipalities' Top 10 Municipal Innovators. She also served over five years on the Provincial Child Care Council and chairs the Network to Eliminate Violence in Relationships Board. A proud Guildford resident for more than 25 years.",
        phone="604-353-4898", email="Vera.LeFranc@gmail.com", party="Surrey Connect Public IA",
        source_url="candidates-office-of-councillor/lefranc-vera", links=None),
    "daa9cad5-6612-496a-b7ca-3c3a5fc91ba1": dict(  # Gagan Nahal
        bio="Gagan Nahal is a graduate of the University of British Columbia with a major in political science and minor in Asian language and culture. He graduated with a Bachelor of Laws degree from the University of Leicester and was called to the British Columbia Bar in 2020. Nahal is a criminal defence lawyer, and a recipient of the King Charles III Coronation Medal for his community service. He and his family reside in Surrey's Panorama Ridge neighbourhood.",
        phone="604-764-5710", email=None, party="Surrey First",
        source_url="candidates-office-of-councillor/nahal-gagan",
        links="Website: www.surreyfirst.org | Facebook: Gagan Nahal | Instagram: @gagannahal_"),
    "56d47dff-b6c2-466d-a64f-affc998fdedc": dict(  # Enrique Ponce de Leon
        bio=None, phone=None, email=None, party="SURREY NOW",
        source_url="candidates-office-of-councillor/ponce-de-leon-enrique", links=None),
    "d3c227b8-fff0-4c55-9d55-3eda93636b95": dict(  # Jimmy Rico
        bio="Jimmy Rico is a graduate in Architecture with a Master in Business Administration and extensive experience in the provincial housing sector, bringing a technical and policy-driven perspective to the City Council. His career has focused on infrastructure development, sustainable urban planning and housing affordability. Key commitments include advocating for purpose-built rental housing and family-friendly options, and working with provincial partners to align local zoning with provincial housing goals.",
        phone=None, email=None, party=None,
        source_url="candidates-office-of-councillor/rico-jimmy", links=None),
    "85e7b621-f5eb-4d7b-8406-7537646e2bdb": dict(  # Werner Spangehl
        bio=None, phone="604-780-0342", email="info@surreynow.ca", party="SURREY NOW",
        source_url="candidates-office-of-councillor/spangehl-werner", links="Website: www.surreynow.ca"),
    "fb21537f-f113-4042-beee-48bb48d4bd07": dict(  # Clint Stewart
        bio="Clint Stewart is a lifelong Surrey resident, community leader, and candidate for Surrey City Council with Surrey First. Raised in Newton and now raising his family in Whalley, Clint has deep roots in the city. As President of Whalley Little League and a longtime youth sports volunteer and coach, Clint believes strong communities bring people together. His priorities include safer neighbourhoods, more parks and recreation facilities, attracting businesses and good-paying jobs, and supporting seniors.",
        phone="604-354-1458", email="clint.stewart@surreyfirst.org", party="Surrey First",
        source_url="candidates-office-of-councillor/stewart-clint",
        links="Website: www.surreyfirst.org | Facebook: www.facebook.com/clintkent | Instagram: @surreyfirstclintstewart"),
    "65827d31-b427-4ebc-94c5-dc4ef3335bef": dict(  # Rob Stutt
        bio="Rob Stutt is a former RCMP officer, and career investigator with more than 40 years of experience in policing and the insurance industry. A Surrey resident for over 30 years, he is committed to public safety, responsible growth, and accountable leadership. He has long supported youth and community organizations through minor hockey, the Sullivan Community Association, and the Cloverdale Rodeo Board. As Chair of the Surrey Public Safety Committee and Surrey Heritage Advisory Commission, Rob remains dedicated to protecting Surrey's communities while preserving the city's rich history and character.",
        phone="236-878-1434", email="info@surrey-connect.ca", party="Surrey Connect Public IA",
        source_url="candidates-office-of-councillor/stutt-rob",
        links="Website: www.surrey-connect.ca"),
    "507f5c27-d99b-4407-be96-5f3da70c2bcd": dict(  # Rona Tepper
        bio="Rona Tepper has proudly called Surrey home for 23 years and is committed to building a safer, more connected, and more inclusive community. Married to a retired RCMP member, she has dedicated decades to serving others through volunteerism and public service, including with Royal Canadian Marine Search and Rescue and South Fraser Search and Rescue. As a Victim Services Case Worker, Rona helps individuals and families affected by crime and loss.",
        phone="236-878-1434", email="info@surrey-connect.ca", party="Surrey Connect Public IA",
        source_url="candidates-office-of-councillor/tepper-rona",
        links="Website: www.surrey-connect.ca | X: @rona_tepper | Facebook: Rona Tepper | Instagram: @rona.tepper | LinkedIn: Rona Tepper CCISM, CPPCN"),
    "3eb96acc-494b-4095-a830-c97883f50358": dict(  # Miguel Ting
        bio="A person of integrity, with empathy and kindness, competent, and committed to serve the public. A graduate of Master of Business Administration, BS Civil Engineering, Bachelor of Laws, and holder of several professional licenses including Master Electrician FSR Class B and Plumber.",
        phone=None, email=None, party=None,
        source_url="candidates-office-of-councillor/ting-miguel", links=None),
    "cff33abb-ece3-4ea3-8ea6-8d7d71cc33d9": dict(  # Lily Tsi
        bio=None, phone=None, email="NewSurreyPlusCampaign@gmail.com", party="New Surrey+",
        source_url="candidates-office-of-councillor/tsi-lily", links=None),
    "124fe662-dab5-4a71-b87b-14a241435e9a": dict(  # Shina Vermani
        bio="Shina is a research and policy analyst with the Ministry of Post Secondary Education and Future Skills and was an analyst with the Policing and Security Branch of the Ministry of Public Safety and Solicitor General. A resident of Newton, Shina has a Master's in Commerce, a Bachelor's in Education, and a postgraduate diploma in computer applications.",
        phone="236-625-1356", email="shina@surreyfirst.org", party="Surrey First",
        source_url="candidates-office-of-councillor/vermani-shina",
        links="Facebook: Shina Vermani | LinkedIn: Shina Vermani"),
    "f474b741-2177-4bb3-8856-b3fa06eb7f46": dict(  # Mila Wong-Kabush
        bio="My Vision and Mission: To progressively enhance the Smart Surrey Strategic Plan initiated in 2015 and to wisely and securely modernize our city to achieve accountability, integrity, efficiencies, consensus and access to public information. Priorities for a Better Surrey include freezing property taxes, addiction treatment capacity, and collaborative federal, provincial and municipal governments serving the same person.",
        phone=None, email=None, party=None,
        source_url="candidates-office-of-councillor/wong-kabush-mila", links=None),
    "cddc513b-0f6d-488e-8dfd-f111fa907666": dict(  # James Yu
        bio=None, phone="604-780-0342", email="info@surreynow.ca", party="SURREY NOW",
        source_url="candidates-office-of-councillor/yu-james", links="Website: www.surreynow.ca"),
    # Mayor
    "673efede-1b98-465c-9528-64f43b857b09": dict(  # Linda Annis
        bio="First elected to Surrey City Council in 2018 and re-elected in 2022, Councillor Linda Annis is the Executive Director of Metro Vancouver Crime Stoppers and a dedicated 20-year volunteer. Her past roles include Chair of Osteoporosis Canada and Zajac Ranch, and director for Uniti and the BC Sports Hall of Fame. Currently, she serves on the boards of the Surrey Cares Foundation, Surrey Arts Festival, and Metro Vancouver Regional District.",
        phone=None, email="LAnnis@surreyfirst.org", party="Surrey First",
        source_url="candidates-office-of-mayor/annis-linda",
        links="Website: www.surreyfirst.org | X: @LindaAnnisBC | Facebook: Linda Annis BC | Instagram: @LindaAnnisBC | LinkedIn: Linda Annis"),
    "d06486ce-31ca-4977-a367-37a7a0552282": dict(  # Brenda Locke
        bio="Brenda Locke has proudly called Surrey home for over 40 years, where she and her husband raised their family and now enjoy time with their grandchildren. Committed to responsible leadership, Brenda has championed investments in police and fire services while keeping property taxes among the lowest in the region. Under her leadership, Surrey has expanded recreation facilities, improved roads and infrastructure, and approved thousands of new housing units.",
        phone="236-878-1434", email="info@surrey-connect.ca", party="Surrey Connect Public IA",
        source_url="candidates-office-of-mayor/locke-brenda",
        links="Website: www.surrey-connect.ca | Facebook: surreyconnect | Instagram: @surreyconnect_"),
    "53b1d632-2639-4ecc-8de4-8d0082a0b78d": dict(  # Troy Van-Vliet
        bio=None, phone="604-780-0342", email="info@surreynow.ca", party="SURREY NOW",
        source_url="candidates-office-of-mayor/van-vliet-troy", links="Website: www.surreynow.ca"),
}

BASE_URL = "https://www.surrey.ca/city-government/2026-municipal-election/candidates/"
NEW_PARTIES = ["SURREY NOW", "New Surrey+"]

def qstr(v):
    return "NULL" if v is None else "'" + v.replace("'", "''") + "'"

sql = ["BEGIN;"]

values = ",\n".join(f"('Canada',{qstr(n)})" for n in NEW_PARTIES)
sql.append(
    "INSERT INTO public.political_parties (country, name)\n"
    f"SELECT v.country, v.name FROM (VALUES {values}) AS v(country, name)\n"
    "WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.country AND p.name=v.name);"
)

for pid, d in DATA.items():
    bio_parts = []
    if d["bio"]:
        bio_parts.append(d["bio"])
    if d["links"]:
        bio_parts.append(d["links"])
    bio_final = "\n\n".join(bio_parts) if bio_parts else None
    source_url = BASE_URL + d["source_url"]

    party_clause = ""
    if d["party"]:
        party_clause = (
            f", political_party_id = (SELECT id FROM public.political_parties "
            f"WHERE country='Canada' AND name={qstr(d['party'])})"
        )

    sql.append(
        f"UPDATE public.politician_profiles SET "
        f"bio = COALESCE({qstr(bio_final)}, bio), "
        f"contact_phone = COALESCE({qstr(d['phone'])}, contact_phone), "
        f"contact_email = COALESCE({qstr(d['email'])}, contact_email), "
        f"source_url = {qstr(source_url)}"
        f"{party_clause} "
        f"WHERE id = '{pid}';"
    )

sql.append("COMMIT;")

out_path = sys.argv[1] if len(sys.argv) > 1 else "surrey_enrich.sql"
with open(out_path, "w") as f:
    f.write("\n".join(sql) + "\n")
print(f"{len(DATA)} candidates enriched")
print(f"SQL written to {out_path}")
