from helpers import *
day = """Argyle Secondary School|1131 Frederick Road
Blueridge Elementary School|2650 Bronte Drive
Brooksbank Elementary School|980 East 13th Street
Canyon Heights Elementary School|4501 Highland Boulevard
Capilano Elementary School|1230 West 20th Street
Carisbrooke Elementary School|510 East Carisbrooke Road
Cleveland Elementary School|1255 Eldon Road
Eastview Elementary School|1801 Mountain Highway
Handsworth Secondary School|1033 Handsworth Road
Highlands Elementary School|3150 Colwood Drive
Lions Gate Community Recreation Centre|1733 Lions Gate Lane
Lynn Creek Community Recreation Centre|1491 Hunter Street
Lynnmour Elementary School|800 Forsman Avenue
Montroyal Elementary School|5310 Sonora Drive
Mountainside Secondary School|3365 Mahon Avenue
Norgate Elementary School|1295 Sowden Street
Ross Road Elementary School|2875 Bushnell Place
Seycove Secondary School|1204 Caledonia Avenue
Sherwood Park Elementary School|4085 Dollar Road
Upper Lynn Elementary School|1540 Coleman Street
Windsor Secondary School|931 Broadview Drive""".strip()
places = [
 place("District Hall","355 West Queens Road, North Vancouver", adv(["10-07","10-10","10-12"]), "Advance voting only"),
 place("Parkgate Community Centre","3625 Banff Court, North Vancouver", adv(["10-10","10-12"])+gen(), "Advance and election day"),
 place("Lions Gate Hospital (special voting)","231 East 15th Street, North Vancouver", sch("special",["2026-10-10"],"09:00","16:00"), "Special voting for inpatients of Lions Gate Hospital, North Shore Hospice and HOpe Centre only"),
] + [place(l.split("|")[0], l.split("|")[1]+", North Vancouver", gen(), "Election day only") for l in day.split("\n")]
save("north_vancouver_district",21316,"North Vancouver (District)","https://www.dnv.org/government-administration/voting-dates-and-locations",places)
