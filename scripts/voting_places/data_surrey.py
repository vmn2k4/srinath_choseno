from helpers import *
A = ["10-07", "10-10", "10-14", "10-15"]
both = lambda: adv(A) + gen()
adv_sites = [
 ("Kwantlen Park Secondary", "10441 132 Street"), ("Guildford Recreation Centre", "15105 105 Avenue"),
 ("Fraser Heights Recreation Centre", "10588 160 Street"), ("Fleetwood Community Centre", "15996 84 Avenue"),
 ("Frank Hurt Secondary", "13940 77 Avenue"), ("Princess Margaret Secondary", "12870 72 Avenue"),
 ("École Panorama Ridge Secondary", "13220 64 Avenue"), ("Cloverdale Recreation Centre", "6188 176 Street"),
 ("Semiahmoo Secondary", "1785 148 Street"), ("Earl Marriott Secondary", "15751 16 Avenue")]
day = """A.H.P Matthew Elementary|13367 97 Avenue
Old Yale Road Elementary|10135 132 Street
LA Matheson Secondary|9484 122 Street
Queen Elizabeth Secondary|9457 King George Boulevard
James Ardiel Elementary|13751 112 Avenue
Guildford Park Secondary|10707 146 Street
Bonaccord Elementary|14986 98 Avenue
William F. Davidson Elementary|15550 99A Avenue
Johnston Heights Secondary|15350 99 Avenue
Berkshire Park Elementary|15372 94 Avenue
Coast Meridian Elementary|8222 168A Street
Fleetwood Park Secondary|7940 156 Street
Green Timbers Elementary|8824 144 Street
Maple Green Elementary|14898 Spenser Drive
Enver Creek Secondary|14505 84 Avenue
Janice Churchill Elementary|8226 146 Street
Strawberry Hill Elementary|7633 124 Street
Newton Elementary|13359 81 Avenue
Chimney Hill Elementary|14755 74 Avenue
Georges Vanier Elementary|6985 142 Street
Cougar Creek Elementary|12236 70A Avenue
Tamanawis Secondary|12600 66 Avenue
Boundary Park Elementary|12332 Boundary Park Drive
Colebrook Elementary|5404 125A Street
Goldstone Park Elementary|6248 142 Street
École Woodward Hill Elementary|6082 142 Street
Salish Secondary School|7278 184 Street
Surrey Centre Elementary|16650 104 Avenue
Adams Road Elementary|18228 68 Avenue
Katzie Elementary|6887 194A Street
Don Christian Elementary|6256 184 Street
Hazelgrove Elementary|7055 190 Street
Elgin Hall|14250 Crescent Road
Elgin Park Secondary|13484 24 Avenue
Ocean Cliff Elementary|12550 20 Avenue
Ray Shepherd Elementary|1650 146 Street
Jessie Lee Elementary|2064 154 Street
Morgan Elementary|3366 156B Street
South Meridian Elementary|16244 13 Avenue
Edgewood Elementary|16666 23 Avenue
Douglas Elementary|17325 2 Avenue
Rosemary Heights Elementary|15516 36 Avenue""".split("\n")
places = [place(n, a + ", Surrey", both(), "Advance and election day") for n, a in adv_sites]
places += [place(l.split("|")[0], l.split("|")[1] + ", Surrey", gen(), "Election day only") for l in day]
save("surrey", 21305, "Surrey", "https://www.surrey.ca/2026-municipal-election/voters/where-vote", places)
