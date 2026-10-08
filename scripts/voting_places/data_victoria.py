from helpers import *
V = "Victoria"
day = [("Central Middle School","1280 Fort St"),("George Jay Elementary School","1118 Princess Ave"),("Glenlyon Norfolk Senior School","781 Richmond Ave"),("James Bay Community School","140 Oswego St"),("Oaklands Elementary School","2827 Belmont Ave"),("Quadra Elementary School","3031 Quadra St"),("Quadra Village Neighbourhood Gym","950 Kings Rd"),("Royal Canadian Legion Branch 292","411 Gorge Rd East"),("Sir James Douglas Elementary School","401 Moss St"),("Victoria High School","1260 Grant St"),("Victoria West Elementary School","750 Front St")]
places = [
 place("Victoria Conference Centre, Upper Pavilion", "720 Douglas St, Victoria", adv(["10-07"]), "Second floor"),
 place("Crystal Garden", "713 Douglas St, Victoria", adv(["10-13","10-14","10-15"]) + gen(), "Accessible voting machine available"),
 place("University of Victoria, Student Union Building, Michèle Pujol Room", "3800 Finnerty Rd, Victoria", adv(["10-14"], "10:00", "16:00")),
] + [place(n, a + ", Victoria", gen(), "Election day only") for n, a in day]
save("victoria", 21344, "Victoria", "https://www.victoria.ca/city-government/elections", places)
