from helpers import *
save("langley_city",21304,"Langley (City)","https://www.langleycity.ca/city-hall/local-elections",[
 place("Timms Community Centre","20399 Douglas Crescent, Langley",
  [dict(type="advance",date="2026-10-06",open="13:00",close="20:00"),dict(type="advance",date="2026-10-07",open="08:00",close="20:00"),
   dict(type="advance",date="2026-10-08",open="08:30",close="16:30"),dict(type="advance",date="2026-10-14",open="08:00",close="20:00")]+gen(),"Advance and election day")])
save("white_rock",21306,"White Rock","https://www.whiterockcity.ca/elections",[
 place("Centennial Arena","14600 North Bluff Road, White Rock",
  [dict(type="advance",date=d,open=None,close=None) for d in ("2026-10-07","2026-10-08","2026-10-13")],
  "Advance voting hours not published; election day locations not yet published by the city (election day 8 am to 8 pm)")])
