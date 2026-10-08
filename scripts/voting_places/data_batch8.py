from helpers import *
save("squamish",21466,"Squamish","https://squamish.ca/government-and-administration/council/election/",[
 place("55 Activity Centre","37926 Second Avenue, Squamish",[dict(type="advance",date="2026-10-07",open="08:00",close="20:00"),dict(type="advance",date="2026-10-08",open="12:00",close="20:00")],"Advance voting only"),
 place("Totem Hall","37458 Second Avenue, Squamish",adv(["10-10"]),"Advance voting only"),
 place("Brennan Park Recreation Centre","1009 Centennial Way, Squamish",[dict(type="advance",date="2026-10-15",open="12:00",close="20:00")]+gen(),"Advance (Oct 15) and election day")])
save("whistler",21469,"Whistler","https://www.whistler.ca/municipal-gov/elections",[
 place("Whistler Public Library","4329 Main Street, Whistler",adv(["10-07","10-10"]),"Advance voting only"),
 place("Myrtle Philip Community School","6195 Lorimer Road, Whistler",gen(),"Election day only")])
build("north_cowichan",21979,"North Cowichan","https://www.northcowichan.ca/election","North Cowichan",
 [("North Cowichan Municipal Hall","7030 Trans-Canada Highway",["10-07","10-13"])],
 """Chemainus Secondary School|9947 Daniel Street, Chemainus
Crofton Firehall|1681 Robert Street, Crofton
École Mount Prevost School|6177 Somenos Road
Maple Bay Elementary School|1500 Donnay Drive
Quw'utsun Secondary School|2003 University Way""", both_names=True)
