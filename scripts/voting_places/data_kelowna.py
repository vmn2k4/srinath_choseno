from helpers import *
campus = lambda d: adv([d], "08:00", "18:00")
places = [
 place("Parkinson Recreation Centre", "1800 Parkinson Way, Kelowna", adv(["10-10","10-14","10-15","10-16"]) + gen()),
 place("MNP Place", "4105 Gordon Dr, Kelowna", adv(["10-10","10-16"]) + gen()),
 place("North Glenmore Elementary", "125 Snowsell St, Kelowna", adv(["10-10"]) + gen()),
 place("Rutland Elementary School", "620 Webster Rd, Kelowna", adv(["10-10"]) + gen()),
 place("Black Box Theatre", "1375 Water St, Kelowna", adv(["10-14"]) + gen()),
 place("Okanagan College S Building Atrium", "1000 KLO Rd, Kelowna", campus("10-14"), "Campus location, closes 6 pm", lat=49.8608, lng=-119.4617),
 place("UBC Okanagan University Centre Ballroom", "3272 University Way, Kelowna", campus("10-14"), "Campus location, closes 6 pm"),
 place("Central Okanagan United Church", "721 Bernard Ave, Kelowna", gen(), "Election day only"),
 place("East Kelowna Community Hall", "2704 East Kelowna Rd, Kelowna", gen(), "Election day only"),
 place("Evangel Church", "3261 Gordon Dr, Kelowna", gen(), "Election day only"),
 place("Mission Creek Alliance Church", "2091 Springfield Rd, Kelowna", gen(), "Election day only"),
 place("Okanagan Mission Hall", "4409 Lakeshore Rd, Kelowna", gen(), "Election day only"),
 place("Quigley Elementary School", "705 Kitch Rd, Kelowna", gen(), "Election day only"),
 place("Springvalley Middle School", "350 Ziprick Rd, Kelowna", gen(), "Election day only"),
 place("Watson Elementary", "475 Yates Rd, Kelowna", gen(), "Election day only"),
]
save("kelowna", 21597, "Kelowna", "https://www.kelowna.ca/city-hall/city-government/elections/voting-locations-map", places)
