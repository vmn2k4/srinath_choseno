from helpers import *
day = """Campus View Elementary School|3900 Gordon Head Road
Cedar Hill Middle School|3910 Cedar Hill Road
Cloverdale Elementary School|3427 Quadra Street
Cordova Bay Elementary School|5238 Cordova Bay Road
Doncaster Elementary School|1525 Rowan Street
Frank Hobbs Elementary School|3875 Haro Road
Glanford Middle School|4140 Glanford Avenue
Gordon Head Recreation Centre|4100 Lambrick Way
Hillcrest Elementary School|4421 Greentree Terrace
Lansdowne Middle School|1765 Lansdowne Road
Lochside Elementary School|1145 Royal Oak Drive
Prospect Lake Elementary School|321 Prospect Lake Road
Reynolds Secondary School|3963 Borden Street
Saanich Commonwealth Place|4636 Elk Lake Drive
Silver Threads (Les Passmore Centre)|286 Hampton Road
Spectrum Community School|957 Burnside Road West""".split("\n")
places = [
 place("Saanich Municipal Hall","770 Vernon Avenue, Saanich", adv(["10-07","10-13"])+gen() if False else adv(["10-07","10-13"])),
 place("Hellenic Community Centre (Greek Hall)","4648 Elk Lake Drive, Saanich", adv(["10-07","10-14"])),
 place("Cedar Hill Recreation Centre","3220 Cedar Hill Road, Saanich", adv(["10-13"])),
 place("University of Victoria, Student Union Building, Michele Pujol Room","3800 Finnerty Road, Victoria", adv(["10-14"],"10:00","16:00")),
] + [place(n,a+", Saanich",gen(),"Election day only") for n,a in (x.split("|") for x in day)]
save("saanich",21342,"Saanich","https://www.saanich.ca/EN/main/local-government/2026-election/where-to-vote.html",places)
