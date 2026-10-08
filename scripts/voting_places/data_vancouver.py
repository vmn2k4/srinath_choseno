from helpers import *
RAW = """Best Western Premier Chateau Granville Hotel & Suites|1100 Granville St|F
Britannia Community Elementary School|1110 Cotton Drive|S
Captain James Cook Elementary School|3340 East 54th Ave|G
Carnarvon Community Elementary School|3400 Balaclava St|S
Carnegie Community Centre|401 Main St|F
Champlain Heights Community Centre|3350 Maquinna Dr|F
Charles Dickens Annex|3877 Glen Dr|S
Chief Maquinna Elementary School|2684 East 2nd Ave|S
Coal Harbour Community Centre|480 Broughton St|F
Collingwood Neighbourhood House|5288 Joyce St|G
Creekside Community Recreation Centre|1 Athletes Wy|F
šxʷwəq̓ʷəθət Crosstown Elementary School|55 Expo Blvd|S
David Lloyd George Elementary School|8370 Cartier St|S
David Thompson Secondary School|1755 East 55th Ave|S
Douglas Park Community Centre|801 West 22nd Ave|F
Dr. Annie B. Jamieson Elementary School|6350 Tisdall St|S
Dr. R. E. McKechnie Elementary School|7455 Maple St|S
Dunbar Community Centre|4747 Dunbar St|F
École des Colibris|590 West 65th Ave|G
False Creek Community Centre|1318 Cartwright St|G
False Creek Elementary School|900 School Green|S
Fraser Lands Church|3330 SE Marine Dr|F
General Brock Elementary School|4860 Main St|G
General Gordon Elementary School|2268 Bayswater St|G
Gordon Neighbourhood House|1019 Broughton St|G
¿uuqinak’uuh Grandview Elementary School|2055 Woodland Dr|G
Hastings Community Centre|3096 East Hastings St|F
Henry Hudson Elementary School|1530 Maple St|S
Hillcrest Centre|4575 Clancy Loranger Wy|F
Holy Trinity Anglican Church|1440 West 12th Ave|F
John Norquay Elementary School|4710 Slocan St|S
John Oliver Secondary School|530 East 41st Ave|S
JW Sexsmith Community Elementary School|7410 Columbia St|S
Kensington Community Centre|5175 Dumfries St|F
Kerrisdale Community Centre|5851 West Blvd|F
Kerrisdale Elementary School|5555 Carnarvon St|S
Killarney Community Centre|6260 Killarney St|F
King George Secondary School|1755 Barclay St|S
Kitsilano Neighbourhood House|2305 West 7th Ave|G
Kitsilano War Memorial Community Centre|2690 Larch St|F
Kivan Club (BGC South Coast BC)|2875 St George St|G
L'Ecole Bilingue Elementary School|1166 West 14th Ave|S
Lord Byng Secondary School|3939 West 16th Ave|S
Lord Kitchener Elementary School|3455 West King Edward Ave|G
Lord Roberts Elementary School|1100 Bidwell St|S
Lord Selkirk Elementary School|1750 East 22nd Ave|G
Lord Strathcona Community Elementary School|601 Keefer St|S
Lord Tennyson Elementary School|2650 Maple St|S
Morris J. Wosk Centre for Dialogue|580 W Hastings St|F
Mount Pleasant Community Centre|1 Kingsway|F
Mount Pleasant Neighbourhood House|800 East Broadway|G
Musqueam Community Centre|6777 Salish Dr|G
Prince of Wales Secondary School|2250 Eddington Dr|S
Queen Alexandra Elementary School|1300 East Broadway|S
Queen Victoria Annex|1850 East 3rd Ave|S
RayCam Co-operative Centre|920 East Hastings St|G
Redemption Church|3512 West 7th Ave|F
Renfrew Community Elementary School|3315 East 22nd Ave|G
Renfrew Park Community Centre|2929 East 22nd Ave|F
Roundhouse Community Arts & Recreation Centre|181 Roundhouse Mews|F
Scottish Cultural Centre|8886 Hudson Street|G
Shaughnessy Elementary School|4250 Marguerite Street|G
Simon Fraser Elementary School|100 West 15th Ave|G
Sir Charles Tupper Secondary School|315 East 23rd Ave|S
Sir James Douglas Elementary School|7416 Victoria Dr|S
Sir John Franklin Community School|250 Skeena St|G
Sir Richard McBride Annex|4750 St. Catherines St|G
Sir William Van Horne Elementary School|5855 Ontario St|G
Sir Winston Churchill Secondary School|7055 Heather St|S
St. Andrew's-Wesley United Church|1022 Nelson St|G
St. Helen's West Point Grey Anglican Church|4405 West 8th St|G
St. Mary's Parish|5251 Joyce St|A
St. Paul's Anglican Church|1130 Jervis St|F
Sunset Community Centre|6810 Main St|F
Tecumseh Elementary School|1850 East 41st Ave|S
Templeton Secondary School|727 Templeton Dr|S
Thunderbird Community Centre|2311 Cassiar St|F
Tillicum Community Annex|2450 Cambridge St|G
Trinity Baptist Church|1460 West 49th Ave|G
Trout Lake Community Centre|3360 Victoria Dr|F
Vancouver City Hall|453 West 12th Ave|F
Vancouver Public Library - Central Branch|350 West Georgia St|F
VanDusen Botanical Garden|5251 Oak St|F
Walter Moberly Elementary School|1000 East 59th Avenue|S
Waverley Elementary School|6111 Elliott St|G
West Point Grey Community Centre|4397 West 2nd Ave|F"""
# F = advance Oct 3/7/10/13 + election day; S = school: advance Oct 7/13 only + election day;
# G = election day only; A = advance only
ADV = {"F": ["10-03","10-07","10-10","10-13"], "S": ["10-07","10-13"], "G": [], "A": ["10-03","10-07","10-10","10-13"]}
places = []
for l in RAW.split("\n"):
    n, a, k = l.split("|")
    s = adv(ADV[k]) + ([] if k == "A" else gen())
    note = {"F":"Advance and election day","S":"Schools host advance voting on Oct 7 and 13 only","G":"Election day only","A":"Advance voting only"}[k]
    places.append(place(n, a + ", Vancouver", s, note))
places.append(place("UBC - AMS Student Nest", "6133 University Blvd, Vancouver", adv(["10-07","10-13"]) + gen(), "Only for voters living at UBC / University Endowment Lands (school trustee vote only)"))
places.append(place("University Hill Secondary", "3228 Ross Dr, Vancouver", gen(), "Only for voters living at UBC / University Endowment Lands (school trustee vote only)"))
save("vancouver", 21308, "Vancouver", "https://vancouver.ca/election/2026/list-of-all-voting-places.aspx", places)
