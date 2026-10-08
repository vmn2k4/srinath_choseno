from helpers import *
a_day = [("Abbotsford Middle School","33231 Bevan Avenue"),("Aberdeen Elementary School","2975 Bradner Road"),("Bradner Elementary School","5291 Bradner Road"),("Eugene Reimer Middle School","3433 Firhill Drive"),("Máthxwi Elementary School","33661 Elizabeth Avenue"),("Robert Bateman Secondary School","35045 Exbury Avenue"),("Sema:th Elementary School","36321 Vye Road"),("South Poplar Traditional Elementary School","32746 Huntingdon Road"),("St. John Brebeuf Regional Secondary School","2747 Townline Road"),("Yale Secondary School","34620 Old Yale Road")]
A = ["10-07","10-10","10-11"]
ab = [place("Old Abbotsford Courthouse","32203 South Fraser Way, Abbotsford", adv(A)+gen(), "Advance and election day"),
      place("Abbotsford Exhibition Park, Gate 2 (Drive-Through)","32470 Haida Drive, Abbotsford", adv(A)+gen(), "Drive-through and curbside voting; open to all voters")] + \
     [place(n, a+", Abbotsford", gen(), "Election day only") for n,a in a_day]
save("abbotsford", 21248, "Abbotsford", "https://www.abbotsford.ca/election", ab)

c_day = """Alderson Elementary School|825 Gauthier Avenue
Bramblewood Elementary School|2875 Panorama Drive
Cape Horn Elementary School|155 Finnigan Street
Como Lake Middle School|1121 King Albert Avenue
Eagle Ridge Elementary School|1215 Falcon Drive
École Banting Middle School|820 Banting Drive
École Nestor Elementary School|1266 Nestor Street
École Panorama Heights Elementary School|1455 Johnson Street
École Porter Elementary School|728 Porter Street
Glen Elementary School|3064 Glen Drive
Gleneagle Secondary School|1195 Lansdowne Drive
Harbour View Elementary School|960 Lillian Street
Hillcrest Middle School|2161 Regan Avenue
Lord Baden-Powell Elementary School|450 Joyce Street
Maillardville Community Centre|1200 Cartier Avenue
Meadowbrook Elementary School|900 Sharpe Street
Mundy Road Elementary School|2200 Austin Avenue
Pinetree Community Centre|1260 Pinetree Way
Ranch Park Elementary School|2701 Spuraway Avenue
Riverview Park Elementary School|700 Clearwater Way
Smiling Creek Elementary School|3456 Princeton Avenue
Walton Elementary School|2960 Walton Avenue""".split("\n")
co = [place("Town Centre Park Community Centre", "1299 Pinetree Way, Coquitlam", adv(["10-05","10-08","10-10"])),
      place("Centennial Pavilion", None, adv(["10-07","10-10","10-13","10-15"]), "Coquitlam Centennial Pavilion"),
      place("Victoria Community Hall", "3435 Victoria Drive, Coquitlam", adv(["10-10"]) + gen())] + \
     [place(n, a+", Coquitlam", gen(), "Election day only") for n,a in (x.split("|") for x in c_day)]
save("coquitlam", 21311, "Coquitlam", "https://www.coquitlam.ca/1198/Voting-Locations", co)
