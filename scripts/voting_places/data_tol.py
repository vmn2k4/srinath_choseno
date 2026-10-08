from helpers import *
T = "Langley"
day = """Aldergrove Community Secondary School|26850 29 Avenue
Alex Hope Elementary School|21150 85 Avenue
Coghlan Community Hall|6795 256 Street
D.W. Poppy Secondary School|23752 52 Avenue
Dorothy Peacock Elementary School|20292 91A Avenue
Glenwood Elementary School|20785 24 Avenue
James Hill Elementary School|22144 Old Yale Road
Lynn Fripps Elementary School|21020 83 Avenue
Parkside Centennial Elementary School|3300 270 Street
R.C. Garnett Demonstration Elementary School|7096 201 Street
Wix-Brown Elementary School|23851 24 Avenue""".split("\n")
places = [
 place("Salishan Place by the River","23430 Mavis Avenue, Langley", adv(["10-06"])+gen()),
 place("Langley Events Centre, West Gym","7888 200 Street, Langley", adv(["10-07","10-08"])+gen()),
 place("George Preston Recreation Centre","20699 42 Avenue, Langley", adv(["10-08"])+gen()),
 place("Aldergrove Community Centre","27032 Fraser Highway, Aldergrove", adv(["10-09"]), "Source lists two slightly different street numbers (27032 / 27230); confirm before going"),
 place("Langley Regional Airport","5385 216 Street, Langley", adv(["10-10"])),
 place("James Kennedy Elementary School","9060 212 Street, Langley", adv(["10-10"])+gen()),
] + [place(n,a+", Langley",gen(),"Election day only") for n,a in (x.split("|") for x in day)]
save("langley_township",21303,"Langley (Township)","https://www.tol.ca/en/the-township/2026-voting-dates-and-locations.aspx",places)
