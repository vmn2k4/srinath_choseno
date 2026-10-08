from helpers import *
save("golden",21621,"Golden","https://www.golden.ca/town-hall/town-council/elections/2026-municipal-election",[
 place("Mount 7 Rec Plex","1310 9th Street South, Golden",adv(["10-07"])+gen(),"Advance and election day")])
save("port_hardy",21711,"Port Hardy","https://porthardy.ca/municipal-hall/our-council/2026-general-election/",[
 place("Port Hardy Municipal Hall","7360 Columbia St, Port Hardy",adv(["10-07"]),"Advance voting only"),
 place("Fort Rupert Curling Club","5485 Beaver Harbour Rd, Port Hardy",[dict(type="advance",date="2026-10-08",open="14:00",close="19:00")],"Advance voting only"),
 place("Hardy Bay Seniors Citizens Centre","9150 Granville St, Port Hardy",[dict(type="advance",date="2026-10-14",open="11:00",close="15:00")],"Advance voting only"),
 place("Port Hardy Civic Centre","7450 Columbia St, Port Hardy",gen(),"Election day only")])
save("lillooet",21471,"Lillooet","https://lillooet.ca/2026-municipal-election",[
 place("Lillooet and District Rec Centre","930 Main Street, Lillooet",adv(["10-07"])+gen(),"Advance and election day")])
save("grand_forks",21208,"Grand Forks","https://www.grandforks.ca/election-2026/",[
 place("Grand Forks Seniors' Society",None,adv(["10-07"]),"Advance voting only; hours not confirmed"),
 place("Dr. D. A. Perley Elementary School",None,gen(),"Election day only")])
save("lantzville",21391,"Lantzville","https://www.lantzville.ca/cms.asp?wpID=1190",[
 place("Costin Hall","7232 Lantzville Road, Lantzville",adv(["10-07"]),"Advance voting; other days and election-day location not confirmed")])
