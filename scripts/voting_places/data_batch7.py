from helpers import *
N = "Advance voting only. General voting day locations not found in the city's published information; election day voting is 8 am to 8 pm"
build("langford",21348,"Langford","https://langford.ca/election-2026/","Langford",
 [("Eagle Ridge Community Centre (dry floor arena space)","1089 Langford Parkway",["10-07","10-14"])],
 """Ruth King Elementary School|2764 Jacklin Road
Millstream Elementary School|626 Hoylake Avenue
Happy Valley Elementary School|3291 Happy Valley Road
PEXSISEN Elementary School|3100 Constellation Ave""")
save("metchosin",21347,"Metchosin","https://www.metchosin.ca/municipal-hall/elections-voting",[
 place("Metchosin Council Chambers","4450 Happy Valley Road, Metchosin",adv(["10-07","10-14"]),"Advance voting only"),
 place("Metchosin School Gymnasium","4495 Happy Valley Road, Metchosin",gen(),"Election day only")])
save("highlands",21350,"Highlands","https://www.highlands.ca/local-government/elections",[
 place("Highlands Fire Department (East Fire Hall)","3613 Woodridge Place, Highlands",adv(["10-07"]),"Advance voting only"),
 place("Highlands Community Hall","729 Finlayson Arm Road, Highlands",adv(["10-14"])+gen(),"Advance (Oct 14) and election day")])
U="https://www.cfno.org/vitalvote-events"
save("vernon",21608,"Vernon",U,[
 place("Schubert Centre","3505 30th Avenue, Vernon",adv(["10-07"]),"Advance voting only"),
 place("Vernon City Hall Council Chambers","3400 30th Street, Vernon",adv(["10-14"]),"Advance voting only; election day locations not listed in sources")])
save("coldstream",21607,"Coldstream",U,[place("Coldstream Municipal Office","9901 Kalamalka Road, Coldstream",adv(["10-07","10-14","10-15"]),"Advance voting; election day location not listed in sources")])
save("armstrong",21614,"Armstrong",U,[place("Armstrong City Hall","3570 Bridge Street, Armstrong",adv(["10-07","10-14"]),"Advance voting; election day location not listed in sources")])
save("enderby",21615,"Enderby",U,[place("Enderby City Hall","619 Cliff Avenue, Enderby",adv(["10-07"]),"Advance voting; election day location not listed in sources")])
save("spallumcheen",21613,"Spallumcheen","https://spallumcheentwp.bc.ca/votingopportunities.htm",[place("Spallumcheen Municipal Hall","4144 Spallumcheen Way, Spallumcheen",adv(["10-07","10-14"]),"Advance voting; sources differ on street number (414 vs 4144) — confirm before going")])
save("west_kelowna",21602,"West Kelowna","https://www.westkelownacity.ca/city-hall/2026-local-government-election/",[place("West Kelowna City Hall","3731 Old Okanagan Highway, West Kelowna",adv(["10-07","10-13","10-15"]),"Advance voting; four election day polling stations listed on the city's page")])
save("nelson",21184,"Nelson","https://nelsonpolice.ca/3110/Elections",[
 place("Nelson City Hall (Council Chambers, 2nd Floor)","310 Ward Street, Nelson",adv(["10-07","10-14"]),"Advance voting only"),
 place("Prestige Lakeside Resort","701 Lakeside Drive, Nelson",gen(),"Election day only")])
