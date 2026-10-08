from helpers import *
sch_cnv = [dict(type="advance",date="2026-10-07",open="08:00",close="20:00"),dict(type="advance",date="2026-10-10",open="10:00",close="16:00"),
 dict(type="advance",date="2026-10-13",open="10:00",close="19:00"),dict(type="advance",date="2026-10-14",open="08:00",close="20:00"),dict(type="advance",date="2026-10-15",open="10:00",close="18:00")]
places = [place("North Vancouver City Hall","141 West 14th St, North Vancouver",sch_cnv,"Advance voting only; curbside voting on 13th Street")]
for l in """Larson Elementary School (Gym)|2605 Larson Rd|c
Carson Graham Secondary School (Small Gym)|2145 Jones Ave|c
Westview Elementary School (Gym)|641 West 17th St|c
Queen Mary Elementary School (Gym)|230 W Keith Rd|c
Ridgeway Elementary School (Gym)|420 East 8th St|c
Sutherland Secondary School (Gym)|1860 Sutherland Ave|c
Harry Jerome Community Recreation Centre|130 East 23rd St|
John Braithwaite Community Centre (Shoreline Room)|145 West 1st St|
Pipe Shop|115 Victory Ship Way|""".split("\n"):
    n,a,c = l.split("|")
    places.append(place(n,a+", North Vancouver",gen(),"Election day only"+("; curbside voting available" if c else "")))
save("north_vancouver_city",21317,"North Vancouver (City)","https://www.cnv.org/city-hall/general-local-election/2026-general-local-election",places)
