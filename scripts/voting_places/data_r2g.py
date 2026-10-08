from helpers import *
R="Location from the Regional District of Central Kootenay voting list; confirm with the municipality"
save("trail",21203,"Trail","https://trail.ca/city-hall/elections/",[
 place("Trail Aquatic and Leisure Centre","1875 Columbia Ave, Trail",adv(["10-07","10-14"]),"Advance voting only"),
 place("Trail Memorial Centre, Victoria View Room","1051 Victoria Street, Trail",gen(),"Election day only")])
save("merritt",21505,"Merritt","https://merritt.ca/election",[place("Merritt Civic Centre","1950 Mamette Ave, Merritt",adv(["10-07","10-14"])+gen(),"Advance and election day")])
save("fernie",21162,"Fernie","https://www.fernie.ca/EN/main/city/election-2026.html",[place("Fernie Senior Citizens Drop-In Centre","562 3rd Avenue, Fernie",adv(["10-07","10-14"])+gen(),"Advance and election day")])
save("sparwood",21161,"Sparwood","https://www.sparwood.ca/municipal-hall/election",[place("Sparwood Senior Drop In Centre","101 4th Ave, Sparwood",adv(["10-07","10-14"])+gen(),"Advance and election day")])
save("elkford",21160,"Elkford","https://elkford.ca/elections",[
 place("Elkford Municipal Hall",None,adv(["10-07"])+[dict(type="advance",date="2026-10-13",open="08:00",close="16:00")],"Advance voting only"),
 place("Elkford Community Conference Centre",None,gen(),"Election day only")])
save("creston",21180,"Creston","https://www.rdck.ca/corporate/elections/2026-general-local-election/i-want-to-vote/",[place("Creston Community Complex","312 19th Avenue North, Creston",adv(["10-07"])+gen(),R)])
save("salmo",21182,"Salmo","https://www.rdck.ca/corporate/elections/2026-general-local-election/i-want-to-vote/",[place("Salmo Community Centre","206 7th Street, Salmo",adv(["10-07"])+gen(),R)])
save("nakusp",21195,"Nakusp","https://www.rdck.ca/corporate/elections/2026-general-local-election/i-want-to-vote/",[place("Nakusp Community Complex","200 8th Avenue NW, Nakusp",adv(["10-07"])+gen(),R)])
save("new_denver",21189,"New Denver","https://www.rdck.ca/corporate/elections/2026-general-local-election/i-want-to-vote/",[place("Bosun Hall","710 Bellevue Street, New Denver",adv(["10-07","10-14"])+gen(),R)])
save("slocan",21186,"Slocan","https://www.rdck.ca/corporate/elections/2026-general-local-election/i-want-to-vote/",[place("Slocan Valley Legion Hall","502 Harold Street, Slocan",gen(),R)])
save("kaslo",21187,"Kaslo","https://www.rdck.ca/corporate/elections/2026-general-local-election/i-want-to-vote/",[place("Kaslo Legion Hall","403 5th Street, Kaslo",adv(["10-07"]),R)])
