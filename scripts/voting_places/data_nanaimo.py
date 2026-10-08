from helpers import *
day = [("Brechin Elementary School","510 Millstone Avenue"),("Chase River Elementary School","1503 Cranberry Avenue"),("City of Nanaimo Service and Resource Centre","411 Dunsmuir Street"),("Dover Bay Secondary School","6135 McGirr Road"),("John Barsby Secondary School","550 Seventh Street"),("Nanaimo District Secondary School","355 Wakesiah Avenue"),("Randerson Ridge Elementary School","6021 Nelson Road"),("Uplands Park Elementary School","3821 Stronach Drive"),("Wellington Secondary School","3135 Mexicana Road")]
places = [place("Beban Park Social Centre","2300 Bowen Road, Nanaimo", adv(["10-07","10-14"])+gen(), "Advance and election day"),
          place("Protection Island Fire Hall","26 Pirates Lane, Nanaimo", sch("general",["2026-10-17"],"10:00","18:00"), "Election day only; open 10 am to 6 pm")] + \
         [place(n,a+", Nanaimo",gen(),"Election day only") for n,a in day]
save("nanaimo",22009,"Nanaimo","https://www.nanaimo.ca/your-government/elections/voter-information",places)
