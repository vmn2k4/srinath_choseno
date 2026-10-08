from helpers import *
N = "Advance voting only. Richmond assigns election-day voting places by home address (look up at richmond.ca/electionservices/votingOpportunities/SearchVotingPlace.aspx)"
save("richmond",22013,"Richmond","https://richmond.ca/electionservices/votingOpportunities/AdvanceList.aspx",[
 place("Richmond City Hall","6911 No. 3 Road, Richmond",adv(["10-03","10-07","10-08","10-09","10-10"]),N),
 place("Cambie Secondary School","4151 Jacombs Road, Richmond",adv(["10-03","10-10"]),N),
 place("City Centre Community Centre","5900 Minoru Blvd, Richmond",adv(["10-08"]),N),
 place("McRoberts Secondary School","8980 Williams Road, Richmond",adv(["10-10"]),N),
 place("McMath Secondary School","4251 Garry Street, Richmond",adv(["10-10"]),N),
 place("Hamilton Elementary School","5180 Smith Drive, Richmond",adv(["10-10"]),N),
 place("Burnett Secondary School","5011 Granville Avenue, Richmond",adv(["10-10"]),N)])
