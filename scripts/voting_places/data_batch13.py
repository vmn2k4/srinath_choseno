from helpers import *
save("prince_rupert",22023,"Prince Rupert","https://www.princerupert.ca/election",[
 place("Raven Lounge, Prince Rupert Recreation Complex","1000 McBride Street, Prince Rupert",adv(["10-07","10-14"]),"Advance voting only. Election-day locations not published yet; election day voting is 8 am to 8 pm"),
 place("Prince Rupert Hospital (special voting)",None,sch("special",["2026-10-15"],"13:00","15:00"),"Special voting for staff, patients and residents only"),
 place("Acropolis Manor (special voting)",None,sch("special",["2026-10-15"],"15:00","17:00"),"Special voting for staff, patients and residents only")])
save("dawson_creek",21839,"Dawson Creek","https://www.dawsoncreek.ca/election",[place("Ovintiv Events Centre, Upper Lobby","300 Hwy 2, Dawson Creek",adv(["10-07","10-14"])+gen(),"Advance and election day")])
save("fort_st_john",21844,"Fort St. John","https://www.fortstjohn.ca/vote",[
 place("Fort St. John Legion","10103 105 Ave, Fort St. John",adv(["10-07","10-14"])+gen(),"Advance and election day"),
 place("North Peace Senior Housing Building 1 Activity Room","9812 108 Ave, Fort St. John",sch("special",["2026-10-15"],"14:30","15:30"),"Special voting opportunity")])
