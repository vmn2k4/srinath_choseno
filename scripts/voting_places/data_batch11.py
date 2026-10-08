from helpers import *
save("penticton",21222,"Penticton","https://www.penticton.ca/elections",[
 place("Penticton Community Centre Gymnasium","325 Power Street, Penticton",adv(["10-07"]),"Advance voting only"),
 place("Skaha Lake Elementary School","110 Green Avenue West, Penticton",adv(["10-10"])+gen(),"Advance (Oct 10) and election day; smaller venue, may have lineups"),
 place("Penticton Trade and Convention Centre","273 Power Street, Penticton",adv(["10-14"])+gen(),"Advance (Oct 14) and election day")])
save("cranbrook",21165,"Cranbrook","https://cranbrook.ca/our-city/city-departments/corporate-services-1/elections-start",[
 place("Senior Citizens Hall","125 17 Ave S, Cranbrook",adv(["10-07","10-14"]),"Advance voting only"),
 place("Laurie Middle School Gymnasium","1808 2 St S, Cranbrook",gen(),"Election day only")])
build("salmon_arm",21625,"Salmon Arm","https://www.salmonarm.ca/election","Salmon Arm",
 [("5 Avenue Seniors Activity Centre","170 5 Avenue SE",["10-07","10-13"])],
 """Little Mountain Fieldhouse|250 30 Street SE
North Canoe Elementary School|6451 50 Street NE""", both_names=True)
