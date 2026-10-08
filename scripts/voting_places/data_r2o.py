from helpers import *
save("port_alice",21710,"Port Alice","https://portalice.ca/?p=2766",[place("Port Alice Municipal Office","1061 Marine Drive, Port Alice",
 adv(["10-07"])+[dict(type="advance",date=f"2026-10-{d}",open="08:30",close="16:30") for d in (13,14,15,16)]+gen(),"Advance and election day")])
save("invermere",21169,"Invermere","https://invermere.net/2026/notice-of-advance-voting-2026-general-local-elections/",[place("District of Invermere Office","914 8th Avenue, Invermere",
 adv(["10-07"])+[dict(type="advance",date="2026-10-15",open="08:30",close="16:30")],"Advance voting; election-day location not confirmed")])
save("valemount",21823,"Valemount","https://www.valemount.ca",[place("Valemount Municipal Office",None,adv(["10-07"]),"Advance voting; election-day location not confirmed")])
