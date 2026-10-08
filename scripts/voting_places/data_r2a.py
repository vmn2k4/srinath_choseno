from helpers import *
build("mission",21249,"Mission","https://www.mission.ca/node/1828","Mission",
 [("Mission Leisure Centre","7650 Grand Street",["10-07","10-10"])],
 """Albert McMahon Elementary School|32865 Cherry Avenue
Cherry Hill Elementary School|32557 Best Avenue
École Mission Central Elementary School|7466 Welton Street
Hatzic Middle School|34800 Dewdney Trunk Road
Silverdale Elementary School|29715 Donatelli Avenue
Stave Falls Elementary School|30204 Brackley Avenue
West Heights Elementary School|32065 Van Velzen Avenue""", both_names=True)
build("powell_river",21455,"Powell River","https://dev.powellriver.ca/pages/elections","Powell River",
 [("Powell River City Hall, Council Chambers","6910 Duncan Street",["10-07","10-10","10-14"])],
 """Westview Elementary|3900 Selkirk Avenue
Cranberry Seniors Centre|6792 Cranberry Street
James Thomson Elementary|6388 Sutherland Ave""", both_names=True)
save("lake_country",21599,"Lake Country","https://www.lakecountry.bc.ca/mayorandcouncil/elections",[
 place("Lake Country Municipal Hall","10150 Bottom Wood Lake Road, Lake Country",adv(["10-07","10-13"]),"Advance voting only"),
 place("George Elliott Secondary School (GESS)","10241 Bottom Wood Lake Road, Lake Country",gen(),"Election day only")])
