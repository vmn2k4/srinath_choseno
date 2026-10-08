from helpers import *
build("west_vancouver",21318,"West Vancouver","https://election.westvancouver.ca/voters/where-to-vote","West Vancouver",
 [("West Vancouver Municipal Hall","750 17th Street",["10-07","10-10","10-12"])],
 """Gleneagles Community Centre|6262 Marine Drive
Hollyburn Elementary School|1329 Duchess Avenue
Irwin Park Elementary School|2455 Haywood Avenue
Ridgeview Elementary School|1250 Mathers Avenue
Rockridge Secondary School|5350 Headland Drive
West Vancouver Community Centre (Sports Gym)|2121 Marine Drive
Westcot Elementary School|760 Westcot Road""")
save("esquimalt",21345,"Esquimalt (Township)","https://www.esquimalt.ca/government-bylaws/elections",[
 place("Esquimalt Recreation Centre Gym","527 Fraser St, Esquimalt",adv(["10-07","10-14"])+gen(),"Advance and election day")])
build("view_royal",21349,"View Royal","https://www.viewroyal.ca/EN/main/town/elections-main/voting-dates-locations.html","View Royal",
 [("View Royal Town Hall Council Chambers","45 View Royal Avenue",["10-07","10-13"])],
 """View Royal Elementary School|218 Helmcken Road
Eagle View Elementary School|97 Talcott Road""")
