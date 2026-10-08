from helpers import *
adv_sites = """Bill Copeland Sports Centre|3676 Kensington Ave
Bonsor Recreation Complex|6550 Bonsor Ave
Confederation Seniors' Centre|4585 Albert St
Edmonds Community Centre|7433 Edmonds St
Temporary Cameron Community Centre|110-9855 Austin Ave
Willingdon Community Centre|1491 Carleton Ave""".split("\n")
day = """Armstrong Elementary School|8757 Armstrong Ave
BCIT Burnaby Campus|3700 Willingdon Ave
Burnaby Central Secondary School|6011 Deer Lake Pkwy
Burnaby North Secondary School|751 Hammarskjold Dr
Capitol Hill Elementary School|350 Holdom Ave
Cascade Heights Elementary School|4343 Smith Ave
Chaffey-Burke Elementary School|4404 Sardis St
Clinton Elementary School|5858 Clinton St
Forest Grove Elementary School|8525 Forest Grove Dr
Gilmore Avenue Community School|50 Gilmore Ave
Lakeview Elementary School|7777 Mayfield St
Lochdale Community School|6990 Aubrey St
Marlborough Elementary School|6060 Marlborough Ave
Metrotown Banquet Hall|6515 Bonsor Ave
Morley Elementary School|7355 Morley St
Moscrop Secondary School|4433 Moscrop St
Nelson Elementary School|4850 Irmin St
Parkcrest Elementary School|6055 Halifax St
Seaforth Elementary School|7881 Government Rd
Second Street Community School|7502 2nd St
South Slope Elementary School|4446 Watling St
Sperling Elementary School|2200 Sperling Ave
Stoney Creek Community School|2740 Beaverbrook Cres
Taylor Park Elementary School|7590 Mission Ave
University Highlands Elementary School|9388 Tower Rd
Westridge Elementary School|510 Duncan Ave
Windsor Elementary School|6166 Imperial St""".split("\n")
A = ["10-03", "10-07", "10-10"]
places = [place(n, a + ", Burnaby", adv(A) + gen(), "Advance and election day") for n, a in (x.split("|") for x in adv_sites)]
places += [place(n, a + ", Burnaby", gen(), "Election day only") for n, a in (x.split("|") for x in day)]
save("burnaby", 21309, "Burnaby", "https://www.burnaby.ca/our-city/mayor-and-council/elections/voters", places)
