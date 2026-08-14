#!/usr/bin/env python3
"""
Populate School Board Trustees and Board Chairs for British Columbia School Districts.
Matches against map_shapes in the Choseno database where boundary_type = 'School District' and country = 'Canada'.
"""

import os
import sys
import subprocess

DB_URL = "postgresql://postgres.qlzyfdwrkcxyqapewxwg:pa.8tX5%2BHh%2FGZn2@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

ROLE_TRUSTEE_ID = "a03ac924-f894-4d7e-bb7f-152bcf23255e"
ROLE_CHAIR_ID = "84d05e6a-2411-4b3f-94aa-f45069425a54"

# BC School Trustees Data by District Code (SD number)
# Structure: code -> [ { name, role: 'chair' | 'trustee', email, bio, source_url } ]
BC_TRUSTEES = {
    "5": [ # SD5 - Southeast Kootenay
        {"name": "Doug McPhee", "role": "chair", "email": "doug.mcphee@sd5.bc.ca"},
        {"name": "Trina Ayling", "role": "trustee", "email": "trina.ayling@sd5.bc.ca"},
        {"name": "Irene Bischler", "role": "trustee", "email": "irene.bischler@sd5.bc.ca"},
        {"name": "Alysha Clarke", "role": "trustee", "email": "alysha.clarke@sd5.bc.ca"},
        {"name": "Chris Johns", "role": "trustee", "email": "chris.johns@sd5.bc.ca"},
        {"name": "Bev Bellina", "role": "trustee", "email": "bev.bellina@sd5.bc.ca"},
        {"name": "Nicole Heckendorf", "role": "trustee", "email": "nicole.heckendorf@sd5.bc.ca"},
        {"name": "Sarah Morrison", "role": "trustee", "email": "sarah.morrison@sd5.bc.ca"},
        {"name": "Wendy Turner", "role": "trustee", "email": "wendy.turner@sd5.bc.ca"}
    ],
    "6": [ # SD6 - Rocky Mountain
        {"name": "Amber Byklum", "role": "chair", "email": "amber.byklum@sd6.bc.ca"},
        {"name": "Rhonda Smith", "role": "trustee", "email": "rhonda.smith@sd6.bc.ca"},
        {"name": "Jane Fearing", "role": "trustee", "email": "jane.fearing@sd6.bc.ca"},
        {"name": "Betty-Lou Barrett", "role": "trustee", "email": "bettylou.barrett@sd6.bc.ca"},
        {"name": "Shannon Hood", "role": "trustee", "email": "shannon.hood@sd6.bc.ca"},
        {"name": "Jodi Gravelle", "role": "trustee", "email": "jodi.gravelle@sd6.bc.ca"},
        {"name": "Darlene Trach", "role": "trustee", "email": "darlene.trach@sd6.bc.ca"}
    ],
    "8": [ # SD8 - Kootenay Lake
        {"name": "Lenora Trenaman", "role": "chair", "email": "lenora.trenaman@sd8.bc.ca"},
        {"name": "Dawn Lang", "role": "trustee", "email": "dawn.lang@sd8.bc.ca"},
        {"name": "Julie Bremner", "role": "trustee", "email": "julie.bremner@sd8.bc.ca"},
        {"name": "Kristin Rousselle", "role": "trustee", "email": "kristin.rousselle@sd8.bc.ca"},
        {"name": "Susan Chew", "role": "trustee", "email": "susan.chew@sd8.bc.ca"},
        {"name": "David Feldman", "role": "trustee", "email": "david.feldman@sd8.bc.ca"},
        {"name": "Sheri Walsh", "role": "trustee", "email": "sheri.walsh@sd8.bc.ca"},
        {"name": "Sharon Nazaroff", "role": "trustee", "email": "sharon.nazaroff@sd8.bc.ca"},
        {"name": "Allan Gribbin", "role": "trustee", "email": "allan.gribbin@sd8.bc.ca"}
    ],
    "10": [ # SD10 - Arrow Lakes
        {"name": "Stephen Gascon", "role": "chair", "email": "stephen.gascon@sd10.bc.ca"},
        {"name": "Amanda Murphy", "role": "trustee", "email": "amanda.murphy@sd10.bc.ca"},
        {"name": "Rhonda Bouillet", "role": "trustee", "email": "rhonda.bouillet@sd10.bc.ca"},
        {"name": "Danya Mitzel", "role": "trustee", "email": "danya.mitzel@sd10.bc.ca"},
        {"name": "Christine Dixon", "role": "trustee", "email": "christine.dixon@sd10.bc.ca"}
    ],
    "19": [ # SD19 - Revelstoke
        {"name": "Wendy Rota", "role": "chair", "email": "wrota@sd19.bc.ca"},
        {"name": "Sarah Newton", "role": "trustee", "email": "snewton@sd19.bc.ca"},
        {"name": "Alan Chell", "role": "trustee", "email": "achell@sd19.bc.ca"},
        {"name": "Jodie Cooper", "role": "trustee", "email": "jcooper@sd19.bc.ca"},
        {"name": "Sasha Walsh", "role": "trustee", "email": "swalsh@sd19.bc.ca"}
    ],
    "20": [ # SD20 - Kootenay-Columbia
        {"name": "Catherine Zaitsoff", "role": "chair", "email": "czaitsoff@sd20.bc.ca"},
        {"name": "Terry Hanik", "role": "trustee", "email": "thanik@sd20.bc.ca"},
        {"name": "Mark Wilson", "role": "trustee", "email": "mwilson@sd20.bc.ca"},
        {"name": "Kristin Draper", "role": "trustee", "email": "kdraper@sd20.bc.ca"},
        {"name": "Gordon Smith", "role": "trustee", "email": "gsmith@sd20.bc.ca"},
        {"name": "Darren Peloso", "role": "trustee", "email": "dpeloso@sd20.bc.ca"},
        {"name": "Stephen Harris", "role": "trustee", "email": "sharris@sd20.bc.ca"},
        {"name": "Toni Driutti", "role": "trustee", "email": "tdriutti@sd20.bc.ca"},
        {"name": "Evelyn Cutts", "role": "trustee", "email": "ecutts@sd20.bc.ca"}
    ],
    "22": [ # SD22 - Vernon
        {"name": "Mark Olsen", "role": "chair", "email": "molsen@sd22.bc.ca"},
        {"name": "Kelli Sullivan", "role": "trustee", "email": "ksullivan@sd22.bc.ca"},
        {"name": "Gen Acton", "role": "trustee", "email": "gacton@sd22.bc.ca"},
        {"name": "Lori Mindnich", "role": "trustee", "email": "lmindnich@sd22.bc.ca"},
        {"name": "Vanessa Mitchell", "role": "trustee", "email": "vmitchell@sd22.bc.ca"},
        {"name": "Tom Williamson", "role": "trustee", "email": "twilliamson@sd22.bc.ca"},
        {"name": "Sylvia Hercun", "role": "trustee", "email": "shercun@sd22.bc.ca"}
    ],
    "23": [ # SD23 - Central Okanagan
        {"name": "Lee-Ann Tiede", "role": "chair", "email": "lee-ann.tiede@sd23.bc.ca"},
        {"name": "Julia Fraser", "role": "trustee", "email": "julia.fraser@sd23.bc.ca"},
        {"name": "Wayne Broughton", "role": "trustee", "email": "wayne.broughton@sd23.bc.ca"},
        {"name": "Norah Bowman", "role": "trustee", "email": "norah.bowman@sd23.bc.ca"},
        {"name": "Chantelle Desrosiers", "role": "trustee", "email": "chantelle.desrosiers@sd23.bc.ca"},
        {"name": "Val Johnson", "role": "trustee", "email": "val.johnson@sd23.bc.ca"},
        {"name": "Amy Geistlinger", "role": "trustee", "email": "amy.geistlinger@sd23.bc.ca"}
    ],
    "27": [ # SD27 - Cariboo-Chilcotin
        {"name": "Ciel Patenaude", "role": "chair", "email": "ciel.patenaude@sd27.bc.ca"},
        {"name": "Angie Delainey", "role": "trustee", "email": "angie.delainey@sd27.bc.ca"},
        {"name": "Mary Forbes", "role": "trustee", "email": "mary.forbes@sd27.bc.ca"},
        {"name": "Michael Franklin", "role": "trustee", "email": "michael.franklin@sd27.bc.ca"},
        {"name": "Linda Martens", "role": "trustee", "email": "linda.martens@sd27.bc.ca"},
        {"name": "Willow MacDonald", "role": "trustee", "email": "willow.macdonald@sd27.bc.ca"},
        {"name": "Anne Kohut", "role": "trustee", "email": "anne.kohut@sd27.bc.ca"}
    ],
    "28": [ # SD28 - Quesnel
        {"name": "Tony Goulet", "role": "chair", "email": "tonygoulet@sd28.bc.ca"},
        {"name": "David Chapman", "role": "trustee", "email": "davidchapman@sd28.bc.ca"},
        {"name": "Lisa Boudreau", "role": "trustee", "email": "lisaboudreau@sd28.bc.ca"},
        {"name": "Wendy Krause", "role": "trustee", "email": "wendykrause@sd28.bc.ca"},
        {"name": "Melissa Gould", "role": "trustee", "email": "melissagould@sd28.bc.ca"},
        {"name": "Honey Affleck", "role": "trustee", "email": "honeyaffleck@sd28.bc.ca"},
        {"name": "Cheri Simpson", "role": "trustee", "email": "cherisimpson@sd28.bc.ca"}
    ],
    "33": [ # SD33 - Chilliwack
        {"name": "Willow Reichelt", "role": "chair", "email": "willow_reichelt@sd33.bc.ca"},
        {"name": "Carin Bondar", "role": "trustee", "email": "carin_bondar@sd33.bc.ca"},
        {"name": "David Swankey", "role": "trustee", "email": "david_swankey@sd33.bc.ca"},
        {"name": "Margaret Reid", "role": "trustee", "email": "margaret_reid@sd33.bc.ca"},
        {"name": "Teri Westerby", "role": "trustee", "email": "teri_westerby@sd33.bc.ca"},
        {"name": "Heather Maahs", "role": "trustee", "email": "heather_maahs@sd33.bc.ca"},
        {"name": "Richard Procee", "role": "trustee", "email": "richard_procee@sd33.bc.ca"}
    ],
    "34": [ # SD34 - Abbotsford
        {"name": "Shirley Wilson", "role": "chair", "email": "shirley.wilson@abbyschools.ca"},
        {"name": "Preet Rai", "role": "trustee", "email": "preet.rai@abbyschools.ca"},
        {"name": "Korky Neufeld", "role": "trustee", "email": "korky.neufeld@abbyschools.ca"},
        {"name": "Stan Petersen", "role": "trustee", "email": "stan.petersen@abbyschools.ca"},
        {"name": "Rupi Rajwan", "role": "trustee", "email": "rupi.rajwan@abbyschools.ca"},
        {"name": "Jared White", "role": "trustee", "email": "jared.white@abbyschools.ca"},
        {"name": "Mike Rauch", "role": "trustee", "email": "mike.rauch@abbyschools.ca"}
    ],
    "35": [ # SD35 - Langley
        {"name": "Candy Ashdown", "role": "chair", "email": "cashdown@sd35.bc.ca"},
        {"name": "Holly Dickinson", "role": "trustee", "email": "hdickinson@sd35.bc.ca"},
        {"name": "Marnie Wilson", "role": "trustee", "email": "mwilson@sd35.bc.ca"},
        {"name": "Sarb Rai", "role": "trustee", "email": "srai@sd35.bc.ca"},
        {"name": "Joel Neufeld", "role": "trustee", "email": "jneufeld@sd35.bc.ca"},
        {"name": "Charlie Fox", "role": "trustee", "email": "cfox@sd35.bc.ca"},
        {"name": "Tony Ward", "role": "trustee", "email": "tward@sd35.bc.ca"}
    ],
    "36": [ # SD36 - Surrey
        {"name": "Laurie Larsen", "role": "chair", "email": "larsen_laurie@surreyschools.ca"},
        {"name": "Terry Allen", "role": "trustee", "email": "allen_t@surreyschools.ca"},
        {"name": "Garry Thind", "role": "trustee", "email": "thind_g@surreyschools.ca"},
        {"name": "Shawn Wilson", "role": "trustee", "email": "wilson_shawn@surreyschools.ca"},
        {"name": "Bob Holmes", "role": "trustee", "email": "holmes_b@surreyschools.ca"},
        {"name": "Gary Tymoschuk", "role": "trustee", "email": "tymoschuk_g@surreyschools.ca"},
        {"name": "Laurae McNally", "role": "trustee", "email": "mcnally_l@surreyschools.ca"}
    ],
    "37": [ # SD37 - Delta
        {"name": "Val Windsor", "role": "chair", "email": "vwindsor@deltasd.bc.ca"},
        {"name": "Joe Muego", "role": "trustee", "email": "jmuego@deltasd.bc.ca"},
        {"name": "Erica Beard", "role": "trustee", "email": "ebeard@deltasd.bc.ca"},
        {"name": "Nimmi Daula", "role": "trustee", "email": "ndaula@deltasd.bc.ca"},
        {"name": "Ammen Dhillon", "role": "trustee", "email": "adhillon@deltasd.bc.ca"},
        {"name": "Masako Gooch", "role": "trustee", "email": "mgooch@deltasd.bc.ca"},
        {"name": "Nick Kanakos", "role": "trustee", "email": "nkanakos@deltasd.bc.ca"}
    ],
    "38": [ # SD38 - Richmond
        {"name": "Debbie Tablotney", "role": "chair", "email": "dtablotney@sd38.bc.ca"},
        {"name": "Heather Larson", "role": "trustee", "email": "hlarson@sd38.bc.ca"},
        {"name": "Ken Hamaguchi", "role": "trustee", "email": "khamaguchi@sd38.bc.ca"},
        {"name": "Donna Sargent", "role": "trustee", "email": "dsargent@sd38.bc.ca"},
        {"name": "Alice Wong", "role": "trustee", "email": "awong@sd38.bc.ca"},
        {"name": "David Yang", "role": "trustee", "email": "dyang@sd38.bc.ca"},
        {"name": "Rod Belleza", "role": "trustee", "email": "rbelleza@sd38.bc.ca"}
    ],
    "39": [ # SD39 - Vancouver
        {"name": "Victoria Jung", "role": "chair", "email": "vjung@vsb.bc.ca"},
        {"name": "Preeti Faridkot", "role": "trustee", "email": "pfaridkot@vsb.bc.ca"},
        {"name": "Alfred Chien", "role": "trustee", "email": "achien@vsb.bc.ca"},
        {"name": "Janet Fraser", "role": "trustee", "email": "jfraser@vsb.bc.ca"},
        {"name": "Lois Chan-Pedley", "role": "trustee", "email": "lchan-pedley@vsb.bc.ca"},
        {"name": "Suzie Mah", "role": "trustee", "email": "smah@vsb.bc.ca"},
        {"name": "Christopher Richardson", "role": "trustee", "email": "crichardson@vsb.bc.ca"},
        {"name": "Jennifer Reddy", "role": "trustee", "email": "jreddy@vsb.bc.ca"},
        {"name": "Josh Zhang", "role": "trustee", "email": "jzhang@vsb.bc.ca"}
    ],
    "40": [ # SD40 - New Westminster
        {"name": "Maya Russell", "role": "chair", "email": "mrussell@sd40.bc.ca"},
        {"name": "Danielle Connelly", "role": "trustee", "email": "dconnelly@sd40.bc.ca"},
        {"name": "Dee Beattie", "role": "trustee", "email": "dbeattie@sd40.bc.ca"},
        {"name": "Marc Andres", "role": "trustee", "email": "mandres@sd40.bc.ca"},
        {"name": "Gurveen Dhaliwal", "role": "trustee", "email": "gdhaliwal@sd40.bc.ca"},
        {"name": "Cheryl Sluis", "role": "trustee", "email": "csluis@sd40.bc.ca"},
        {"name": "Elliott Slinn", "role": "trustee", "email": "eslinn@sd40.bc.ca"}
    ],
    "41": [ # SD41 - Burnaby
        {"name": "Bill Brassington", "role": "chair", "email": "bill.brassington@burnabyschools.ca"},
        {"name": "Kristin Schnider", "role": "trustee", "email": "kristin.schnider@burnabyschools.ca"},
        {"name": "Gary Wong", "role": "trustee", "email": "gary.wong@burnabyschools.ca"},
        {"name": "Jen Mezei", "role": "trustee", "email": "jen.mezei@burnabyschools.ca"},
        {"name": "Larry Hayes", "role": "trustee", "email": "larry.hayes@burnabyschools.ca"},
        {"name": "Peter Cech", "role": "trustee", "email": "peter.cech@burnabyschools.ca"},
        {"name": "Mikelle Sasakamoose", "role": "trustee", "email": "mikelle.sasakamoose@burnabyschools.ca"}
    ],
    "42": [ # SD42 - Maple Ridge-Pitt Meadows
        {"name": "Elaine Yamamoto", "role": "chair", "email": "elaine_yamamoto@sd42.ca"},
        {"name": "Kim Dumore", "role": "trustee", "email": "kim_dumore@sd42.ca"},
        {"name": "Hudson Campbell", "role": "trustee", "email": "hudson_campbell@sd42.ca"},
        {"name": "Mike Murray", "role": "trustee", "email": "mike_murray@sd42.ca"},
        {"name": "Pascale Shaw", "role": "trustee", "email": "pascale_shaw@sd42.ca"},
        {"name": "Kathleen Sullivan", "role": "trustee", "email": "kathleen_sullivan@sd42.ca"},
        {"name": "Gabe Liosis", "role": "trustee", "email": "gabe_liosis@sd42.ca"}
    ],
    "43": [ # SD43 - Coquitlam
        {"name": "Michael Thomas", "role": "chair", "email": "mthomas@sd43.bc.ca"},
        {"name": "Carol Cahoon", "role": "trustee", "email": "ccahoon@sd43.bc.ca"},
        {"name": "Jennifer Blatherwick", "role": "trustee", "email": "jblatherwick@sd43.bc.ca"},
        {"name": "Chuck Denison", "role": "trustee", "email": "cdenison@sd43.bc.ca"},
        {"name": "Kerri Palmer Isaak", "role": "trustee", "email": "kpalmerisaak@sd43.bc.ca"},
        {"name": "Craig Woods", "role": "trustee", "email": "cwoods@sd43.bc.ca"},
        {"name": "Zoe Royer", "role": "trustee", "email": "zroyer@sd43.bc.ca"},
        {"name": "Christine Pollock", "role": "trustee", "email": "cpollock@sd43.bc.ca"},
        {"name": "Soo Wong", "role": "trustee", "email": "swong@sd43.bc.ca"}
    ],
    "44": [ # SD44 - North Vancouver
        {"name": "Kulvir Mann", "role": "chair", "email": "kmann@sd44.ca"},
        {"name": "Linda Munro", "role": "trustee", "email": "lmunro@sd44.ca"},
        {"name": "Daniel Anderson", "role": "trustee", "email": "danderson@sd44.ca"},
        {"name": "Cyndi Gerlach", "role": "trustee", "email": "cgerlach@sd44.ca"},
        {"name": "Lailani Tumaneng", "role": "trustee", "email": "ltumaneng@sd44.ca"},
        {"name": "George Tsiakos", "role": "trustee", "email": "gtsiakos@sd44.ca"},
        {"name": "Megan Higgins", "role": "trustee", "email": "mhiggins@sd44.ca"}
    ],
    "45": [ # SD45 - West Vancouver
        {"name": "Carolyn Broady", "role": "chair", "email": "cbroady@wvschools.ca"},
        {"name": "Nicole Brown", "role": "trustee", "email": "nbrown@wvschools.ca"},
        {"name": "Dave Stevenson", "role": "trustee", "email": "dstevenson@wvschools.ca"},
        {"name": "Lynne Block", "role": "trustee", "email": "lblock@wvschools.ca"},
        {"name": "Felicia Zhu", "role": "trustee", "email": "fzhu@wvschools.ca"}
    ],
    "46": [ # SD46 - Sunshine Coast
        {"name": "Amanda Amaral", "role": "chair", "email": "aamaral@sd46.bc.ca"},
        {"name": "Stacia Leech", "role": "trustee", "email": "sleech@sd46.bc.ca"},
        {"name": "Sue Girard", "role": "trustee", "email": "sgirard@sd46.bc.ca"},
        {"name": "Ann Skelcher", "role": "trustee", "email": "askelcher@sd46.bc.ca"},
        {"name": "Samantha Haines", "role": "trustee", "email": "shaines@sd46.bc.ca"},
        {"name": "Maria Hampvent", "role": "trustee", "email": "mhampvent@sd46.bc.ca"},
        {"name": "Pammila Ruth", "role": "trustee", "email": "pruth@sd46.bc.ca"}
    ],
    "47": [ # SD47 - Powell River / qathet
        {"name": "Jaclyn Miller", "role": "chair", "email": "jaclyn.miller@sd47.bc.ca"},
        {"name": "Dale Lawson", "role": "trustee", "email": "dale.lawson@sd47.bc.ca"},
        {"name": "Rob Hill", "role": "trustee", "email": "rob.hill@sd47.bc.ca"},
        {"name": "Kirsten Van't Schip", "role": "trustee", "email": "kirsten.vantschip@sd47.bc.ca"},
        {"name": "Maureen Mason", "role": "trustee", "email": "maureen.mason@sd47.bc.ca"}
    ],
    "48": [ # SD48 - Sea to Sky
        {"name": "Rebecca Barley", "role": "chair", "email": "rbarley@sd48.bc.ca"},
        {"name": "Debra Bortolussi", "role": "trustee", "email": "dbortolussi@sd48.bc.ca"},
        {"name": "April Lowe", "role": "trustee", "email": "alowe@sd48.bc.ca"},
        {"name": "Celeste Bickford", "role": "trustee", "email": "cbickford@sd48.bc.ca"},
        {"name": "Cynthia Higgins", "role": "trustee", "email": "chiggins@sd48.bc.ca"},
        {"name": "Melissa Ronayne", "role": "trustee", "email": "mronayne@sd48.bc.ca"},
        {"name": "Rachael Lythe", "role": "trustee", "email": "rlythe@sd48.bc.ca"}
    ],
    "49": [ # SD49 - Central Coast
        {"name": "Terry Weber", "role": "chair", "email": "tweber@sd49.ca"},
        {"name": "Christina Hoppe", "role": "trustee", "email": "choppe@sd49.ca"},
        {"name": "Marlis Schultze", "role": "trustee", "email": "mschultze@sd49.ca"},
        {"name": "Nicola Waugh", "role": "trustee", "email": "nwaugh@sd49.ca"},
        {"name": "Ken McIlwain", "role": "trustee", "email": "kmcilwain@sd49.ca"}
    ],
    "50": [ # SD50 - Haida Gwaii
        {"name": "Dana Moraes", "role": "chair", "email": "dmoraes@sd50.bc.ca"},
        {"name": "Julia Breese", "role": "trustee", "email": "jbreese@sd50.bc.ca"},
        {"name": "Roeland Denooij", "role": "trustee", "email": "rdenooij@sd50.bc.ca"},
        {"name": "Wilson Brown", "role": "trustee", "email": "wbrown@sd50.bc.ca"},
        {"name": "Meagan Innes", "role": "trustee", "email": "minnes@sd50.bc.ca"}
    ],
    "51": [ # SD51 - Boundary
        {"name": "Rose Zitko", "role": "chair", "email": "rose.zitko@sd51.bc.ca"},
        {"name": "Loriann Sitron", "role": "trustee", "email": "loriann.sitron@sd51.bc.ca"},
        {"name": "Mark Danyluk", "role": "trustee", "email": "mark.danyluk@sd51.bc.ca"},
        {"name": "Shannon Hall", "role": "trustee", "email": "shannon.hall@sd51.bc.ca"},
        {"name": "Jaime Massey", "role": "trustee", "email": "jaime.massey@sd51.bc.ca"},
        {"name": "Cathy Riddle", "role": "trustee", "email": "cathy.riddle@sd51.bc.ca"},
        {"name": "Bronwen Bird", "role": "trustee", "email": "bronwen.bird@sd51.bc.ca"}
    ],
    "52": [ # SD52 - Prince Rupert
        {"name": "Kate Toye", "role": "chair", "email": "kate.toye@sd52.bc.ca"},
        {"name": "Kristy Maier", "role": "trustee", "email": "kristy.maier@sd52.bc.ca"},
        {"name": "James Horne", "role": "trustee", "email": "james.horne@sd52.bc.ca"},
        {"name": "Michael Pucci", "role": "trustee", "email": "michael.pucci@sd52.bc.ca"},
        {"name": "Janet Beil", "role": "trustee", "email": "janet.beil@sd52.bc.ca"},
        {"name": "Louisa Sanchez", "role": "trustee", "email": "louisa.sanchez@sd52.bc.ca"},
        {"name": "Jessica Newman", "role": "trustee", "email": "jessica.newman@sd52.bc.ca"}
    ],
    "53": [ # SD53 - Okanagan Similkameen
        {"name": "Monique Harrington", "role": "chair", "email": "mharring@sd53.bc.ca"},
        {"name": "Debbie Marten", "role": "trustee", "email": "dmarten@sd53.bc.ca"},
        {"name": "Rob Zandee", "role": "trustee", "email": "rzandee@sd53.bc.ca"},
        {"name": "Casey Brouwer", "role": "trustee", "email": "cbrouwer@sd53.bc.ca"},
        {"name": "Penny Duperron", "role": "trustee", "email": "pduperro@sd53.bc.ca"},
        {"name": "Agnes Jackson", "role": "trustee", "email": "ajackson@sd53.bc.ca"},
        {"name": "Rachel Allenbrand", "role": "trustee", "email": "rallenbr@sd53.bc.ca"}
    ],
    "54": [ # SD54 - Bulkley Valley
        {"name": "Jennifer Williams", "role": "chair", "email": "jennifer.williams@sd54.bc.ca"},
        {"name": "Floyd Krishan", "role": "trustee", "email": "floyd.krishan@sd54.bc.ca"},
        {"name": "Les Kearns", "role": "trustee", "email": "les.kearns@sd54.bc.ca"},
        {"name": "Priscilla Michell", "role": "trustee", "email": "priscilla.michell@sd54.bc.ca"},
        {"name": "Jason Hanson", "role": "trustee", "email": "jason.hanson@sd54.bc.ca"},
        {"name": "Frank Farrell", "role": "trustee", "email": "frank.farrell@sd54.bc.ca"},
        {"name": "Edward Quinlan", "role": "trustee", "email": "edward.quinlan@sd54.bc.ca"}
    ],
    "57": [ # SD57 - Prince George
        {"name": "Craig Brennan", "role": "chair", "email": "cbrennan@sd57.bc.ca"},
        {"name": "Erica McLean", "role": "trustee", "email": "emclean@sd57.bc.ca"},
        {"name": "Sarah Holland", "role": "trustee", "email": "sholland@sd57.bc.ca"},
        {"name": "Gillian Burnett", "role": "trustee", "email": "gburnett@sd57.bc.ca"},
        {"name": "Cory Antrim", "role": "trustee", "email": "cantrim@sd57.bc.ca"},
        {"name": "Sharel Warrington", "role": "trustee", "email": "swarrington@sd57.bc.ca"},
        {"name": "Rachael Weber", "role": "trustee", "email": "rweber@sd57.bc.ca"}
    ],
    "58": [ # SD58 - Nicola-Similkameen
        {"name": "Gordon Swan", "role": "chair", "email": "gswan@365.sd58.bc.ca"},
        {"name": "Justin Jepsen", "role": "trustee", "email": "jjepsen@365.sd58.bc.ca"},
        {"name": "John Chenoweth", "role": "trustee", "email": "jchenoweth@365.sd58.bc.ca"},
        {"name": "Lori Pratt", "role": "trustee", "email": "lpratt@365.sd58.bc.ca"},
        {"name": "Robert Peacock", "role": "trustee", "email": "rpeacock@365.sd58.bc.ca"},
        {"name": "Birgit Thompson", "role": "trustee", "email": "bthompson@365.sd58.bc.ca"},
        {"name": "Shannon Schill", "role": "trustee", "email": "sschill@365.sd58.bc.ca"}
    ],
    "59": [ # SD59 - Peace River South
        {"name": "Chad Anderson", "role": "chair", "email": "canderson@sd59.bc.ca"},
        {"name": "Crystal Hillton", "role": "trustee", "email": "chillton@sd59.bc.ca"},
        {"name": "Roxanne Gulick", "role": "trustee", "email": "rgulick@sd59.bc.ca"},
        {"name": "Travis Jones", "role": "trustee", "email": "tjones@sd59.bc.ca"},
        {"name": "Sherry Berringer", "role": "trustee", "email": "sberringer@sd59.bc.ca"},
        {"name": "Richard Powell", "role": "trustee", "email": "rpowell@sd59.bc.ca"},
        {"name": "Christina Wards", "role": "trustee", "email": "cwards@sd59.bc.ca"}
    ],
    "60": [ # SD60 - Peace River North
        {"name": "Helen Gilbert", "role": "chair", "email": "hgilbert@prn.bc.ca"},
        {"name": "Madeleine Hogan", "role": "trustee", "email": "mhogan@prn.bc.ca"},
        {"name": "Ida Campbell", "role": "trustee", "email": "icampbell@prn.bc.ca"},
        {"name": "Thomas Whitton", "role": "trustee", "email": "twhitton@prn.bc.ca"},
        {"name": "David Sloan", "role": "trustee", "email": "dsloan@prn.bc.ca"},
        {"name": "Bill Snow", "role": "trustee", "email": "bsnow@prn.bc.ca"},
        {"name": "Nicole Gilliss", "role": "trustee", "email": "ngilliss@prn.bc.ca"}
    ],
    "61": [ # SD61 - Greater Victoria
        {"name": "Nicole Duncan", "role": "chair", "email": "nduncan@sd61.bc.ca"},
        {"name": "Karin Kwan", "role": "trustee", "email": "kkwan@sd61.bc.ca"},
        {"name": "Angela Carmichael", "role": "trustee", "email": "acarmichael@sd61.bc.ca"},
        {"name": "Derek Gagnon", "role": "trustee", "email": "dgagnon@sd61.bc.ca"},
        {"name": "Mavis David", "role": "trustee", "email": "mdavid@sd61.bc.ca"},
        {"name": "Natalie Baillaut", "role": "trustee", "email": "nbaillaut@sd61.bc.ca"},
        {"name": "Emily Mahbobi", "role": "trustee", "email": "emahbobi@sd61.bc.ca"},
        {"name": "Rob Paynter", "role": "trustee", "email": "rpaynter@sd61.bc.ca"},
        {"name": "Diane McNally", "role": "trustee", "email": "dmcnally@sd61.bc.ca"}
    ],
    "62": [ # SD62 - Sooke
        {"name": "Amanda Dowhy", "role": "chair", "email": "adowhy@sd62.bc.ca"},
        {"name": "Ebony Logins", "role": "trustee", "email": "elogins@sd62.bc.ca"},
        {"name": "Cendra Beaton", "role": "trustee", "email": "cbeaton@sd62.bc.ca"},
        {"name": "Russ Chipps", "role": "trustee", "email": "rchipps@sd62.bc.ca"},
        {"name": "Christine Lervold", "role": "trustee", "email": "clervold@sd62.bc.ca"},
        {"name": "Trudy Spiller", "role": "trustee", "email": "tspiller@sd62.bc.ca"},
        {"name": "Allison Watson", "role": "trustee", "email": "awatson@sd62.bc.ca"}
    ],
    "63": [ # SD63 - Saanich
        {"name": "Tim Dunford", "role": "chair", "email": "tdunford@saanichschools.ca"},
        {"name": "Joyce Vandall", "role": "trustee", "email": "jvandall@saanichschools.ca"},
        {"name": "Susan Hickman", "role": "trustee", "email": "shickman@saanichschools.ca"},
        {"name": "Teri VanWell", "role": "trustee", "email": "tvanwell@saanichschools.ca"},
        {"name": "Keven Graham", "role": "trustee", "email": "kgraham@saanichschools.ca"},
        {"name": "Katie Leahy", "role": "trustee", "email": "kleahy@saanichschools.ca"},
        {"name": "Phil Shire", "role": "trustee", "email": "pshire@saanichschools.ca"}
    ],
    "64": [ # SD64 - Gulf Islands
        {"name": "Tisha Boulter", "role": "chair", "email": "tboulter@sd64.org"},
        {"name": "Rob Pingle", "role": "trustee", "email": "rpingle@sd64.org"},
        {"name": "Chana Rovner", "role": "trustee", "email": "crovner@sd64.org"},
        {"name": "Stefanie Denz", "role": "trustee", "email": "sdenz@sd64.org"},
        {"name": "Greg Lucas", "role": "trustee", "email": "glucas@sd64.org"},
        {"name": "Kylie Coates", "role": "trustee", "email": "kcoates@sd64.org"},
        {"name": "Jeannine Georgeson", "role": "trustee", "email": "jgeorgeson@sd64.org"}
    ],
    "67": [ # SD67 - Okanagan Skaha
        {"name": "James Palanio", "role": "chair", "email": "jpalanio@sd67.bc.ca"},
        {"name": "Shelley Clarke", "role": "trustee", "email": "sclarke@sd67.bc.ca"},
        {"name": "Dave Stathers", "role": "trustee", "email": "dstathers@sd67.bc.ca"},
        {"name": "Linda Van Alphen", "role": "trustee", "email": "lvanalphen@sd67.bc.ca"},
        {"name": "Tracy Van Raes", "role": "trustee", "email": "tvanraes@sd67.bc.ca"},
        {"name": "Karen Brown", "role": "trustee", "email": "kbrown@sd67.bc.ca"},
        {"name": "Lynn Kelsey", "role": "trustee", "email": "lkelsey@sd67.bc.ca"}
    ],
    "68": [ # SD68 - Nanaimo-Ladysmith
        {"name": "Greg Keller", "role": "chair", "email": "gkeller@sd68.bc.ca"},
        {"name": "Charlene McKay", "role": "trustee", "email": "cmckay@sd68.bc.ca"},
        {"name": "Naomi Bailey", "role": "trustee", "email": "nbailey@sd68.bc.ca"},
        {"name": "Chantelle Morvay", "role": "trustee", "email": "cmorvay@sd68.bc.ca"},
        {"name": "Tania Brzovic", "role": "trustee", "email": "tbrzovic@sd68.bc.ca"},
        {"name": "Bill Robinson", "role": "trustee", "email": "brobinson@sd68.bc.ca"},
        {"name": "Leana Hunter", "role": "trustee", "email": "lhunter@sd68.bc.ca"},
        {"name": "Tom Roc", "role": "trustee", "email": "troc@sd68.bc.ca"},
        {"name": "Mark Babchuk", "role": "trustee", "email": "mbabchuk@sd68.bc.ca"}
    ],
    "69": [ # SD69 - Qualicum
        {"name": "Eve Flynn", "role": "chair", "email": "eflynn@sd69.bc.ca"},
        {"name": "Julie Austin", "role": "trustee", "email": "jaustin@sd69.bc.ca"},
        {"name": "Barry Kurland", "role": "trustee", "email": "bkurland@sd69.bc.ca"},
        {"name": "Leanne Lee", "role": "trustee", "email": "llee@sd69.bc.ca"},
        {"name": "Carol Kellas", "role": "trustee", "email": "ckellas@sd69.bc.ca"}
    ],
    "70": [ # SD70 - Pacific Rim / Alberni
        {"name": "Pam Craig", "role": "chair", "email": "pcraig@sd70.bc.ca"},
        {"name": "Rosemarie Buchanan", "role": "trustee", "email": "rbuchanan@sd70.bc.ca"},
        {"name": "Larry Ransom", "role": "trustee", "email": "lransom@sd70.bc.ca"},
        {"name": "Janis Joseph", "role": "trustee", "email": "jjoseph@sd70.bc.ca"},
        {"name": "Chris Washington", "role": "trustee", "email": "cwashington@sd70.bc.ca"},
        {"name": "Connie Watts", "role": "trustee", "email": "cwatts@sd70.bc.ca"},
        {"name": "Cherilyn Bray", "role": "trustee", "email": "cbray@sd70.bc.ca"}
    ],
    "71": [ # SD71 - Comox Valley
        {"name": "Michelle Waite", "role": "chair", "email": "michelle.waite@sd71.bc.ca"},
        {"name": "Susan Leslie", "role": "trustee", "email": "susan.leslie@sd71.bc.ca"},
        {"name": "Janice Caton", "role": "trustee", "email": "janice.caton@sd71.bc.ca"},
        {"name": "Sarah Jane Howe", "role": "trustee", "email": "sarahjane.howe@sd71.bc.ca"},
        {"name": "Shannon Aldinger", "role": "trustee", "email": "shannon.aldinger@sd71.bc.ca"},
        {"name": "Chelsea McCreadie", "role": "trustee", "email": "chelsea.mccreadie@sd71.bc.ca"},
        {"name": "Cristi May Sacht", "role": "trustee", "email": "cristi.maysacht@sd71.bc.ca"}
    ],
    "72": [ # SD72 - Campbell River
        {"name": "Kat Eddy", "role": "chair", "email": "kat.eddy@sd72.bc.ca"},
        {"name": "Craig Gillis", "role": "trustee", "email": "craig.gillis@sd72.bc.ca"},
        {"name": "Joyce McMann", "role": "trustee", "email": "joyce.mcmann@sd72.bc.ca"},
        {"name": "Daryl Hagen", "role": "trustee", "email": "daryl.hagen@sd72.bc.ca"},
        {"name": "Shannon Briggs", "role": "trustee", "email": "shannon.briggs@sd72.bc.ca"},
        {"name": "Janice Gladish", "role": "trustee", "email": "janice.gladish@sd72.bc.ca"},
        {"name": "David Harper", "role": "trustee", "email": "david.harper@sd72.bc.ca"}
    ],
    "73": [ # SD73 - Kamloops-Thompson
        {"name": "Heather Grieve", "role": "chair", "email": "hgrieve@sd73.bc.ca"},
        {"name": "Rhonda Kershaw", "role": "trustee", "email": "rkershaw@sd73.bc.ca"},
        {"name": "Kathleen Karpuk", "role": "trustee", "email": "kkarpuk@sd73.bc.ca"},
        {"name": "John O'Fee", "role": "trustee", "email": "jofee@sd73.bc.ca"},
        {"name": "Diane Jules", "role": "trustee", "email": "djules@sd73.bc.ca"},
        {"name": "Shelley Sim", "role": "trustee", "email": "ssim@sd73.bc.ca"},
        {"name": "Cara McKelvey", "role": "trustee", "email": "cmckelvey@sd73.bc.ca"},
        {"name": "Jo Kang", "role": "trustee", "email": "jkang@sd73.bc.ca"},
        {"name": "Cole Hickson", "role": "trustee", "email": "chickson@sd73.bc.ca"}
    ],
    "74": [ # SD74 - Gold Trail
        {"name": "Carmen Ranta", "role": "chair", "email": "cranta@sd74.bc.ca"},
        {"name": "Nancy Rempel", "role": "trustee", "email": "nrempel@sd74.bc.ca"},
        {"name": "Valerie Adrian", "role": "trustee", "email": "vadrian@sd74.bc.ca"},
        {"name": "Larry Casper", "role": "trustee", "email": "lcasper@sd74.bc.ca"},
        {"name": "Orra Storkan", "role": "trustee", "email": "ostorkan@sd74.bc.ca"},
        {"name": "Donna Aljam", "role": "trustee", "email": "daljam@sd74.bc.ca"},
        {"name": "Rochelle Scotchman", "role": "trustee", "email": "rscotchman@sd74.bc.ca"}
    ],
    "75": [ # SD75 - Mission
        {"name": "Shelley Carter", "role": "chair", "email": "shelley.carter@mpsd.ca"},
        {"name": "Linda Hamel", "role": "trustee", "email": "linda.hamel@mpsd.ca"},
        {"name": "Randy Cairns", "role": "trustee", "email": "randy.cairns@mpsd.ca"},
        {"name": "Jaci Renwick", "role": "trustee", "email": "jaci.renwick@mpsd.ca"},
        {"name": "Tracy Loffler", "role": "trustee", "email": "tracy.loffler@mpsd.ca"}
    ],
    "78": [ # SD78 - Fraser-Cascade
        {"name": "Cathy Speth", "role": "chair", "email": "cathy.speth@sd78.bc.ca"},
        {"name": "Heather Stewin", "role": "trustee", "email": "heather.stewin@sd78.bc.ca"},
        {"name": "Wendy Colman Lawley", "role": "trustee", "email": "wendy.colmanlawley@sd78.bc.ca"},
        {"name": "Patt Draayers", "role": "trustee", "email": "patt.draayers@sd78.bc.ca"},
        {"name": "Linda Kerr", "role": "trustee", "email": "linda.kerr@sd78.bc.ca"},
        {"name": "Tom Hendrickson", "role": "trustee", "email": "tom.hendrickson@sd78.bc.ca"},
        {"name": "Ron Johnstone", "role": "trustee", "email": "ron.johnstone@sd78.bc.ca"}
    ],
    "79": [ # SD79 - Cowichan Valley
        {"name": "Cathy Schmidt", "role": "chair", "email": "cschmidt@sd79.bc.ca"},
        {"name": "Elizabeth Croft", "role": "trustee", "email": "ecroft@sd79.bc.ca"},
        {"name": "Cindy Lise", "role": "trustee", "email": "clise@sd79.bc.ca"},
        {"name": "Joe Thorne", "role": "trustee", "email": "jthorne@sd79.bc.ca"},
        {"name": "Rob Hutchins", "role": "trustee", "email": "rhutchins@sd79.bc.ca"},
        {"name": "Jennifer Strachan", "role": "trustee", "email": "jstrachan@sd79.bc.ca"},
        {"name": "Eduardo Sousa", "role": "trustee", "email": "esousa@sd79.bc.ca"}
    ],
    "81": [ # SD81 - Fort Nelson
        {"name": "Mike Gilbert", "role": "chair", "email": "mgilbert@sd81.bc.ca"},
        {"name": "Bill Dolan", "role": "trustee", "email": "bdolan@sd81.bc.ca"},
        {"name": "Yassin Guisti", "role": "trustee", "email": "yguisti@sd81.bc.ca"},
        {"name": "Linda Dolen", "role": "trustee", "email": "ldolen@sd81.bc.ca"},
        {"name": "Danielle Behn Smith", "role": "trustee", "email": "dbehnsmith@sd81.bc.ca"}
    ],
    "82": [ # SD82 - Coast Mountains
        {"name": "Shar McCrory", "role": "chair", "email": "shar.mccrory@cmsd.bc.ca"},
        {"name": "Karen Jonkman", "role": "trustee", "email": "karen.jonkman@cmsd.bc.ca"},
        {"name": "Ed Harrison", "role": "trustee", "email": "ed.harrison@cmsd.bc.ca"},
        {"name": "Mike Maxim", "role": "trustee", "email": "mike.maxim@cmsd.bc.ca"},
        {"name": "Julia Sundell", "role": "trustee", "email": "julia.sundell@cmsd.bc.ca"},
        {"name": "Wayne Jones", "role": "trustee", "email": "wayne.jones@cmsd.bc.ca"},
        {"name": "Sonny Haldane", "role": "trustee", "email": "sonny.haldane@cmsd.bc.ca"}
    ],
    "83": [ # SD83 - North Okanagan-Shuswap
        {"name": "Amanda Krebs", "role": "chair", "email": "akrebs@sd83.bc.ca"},
        {"name": "Tennile Lachmuth", "role": "trustee", "email": "tlachmut@sd83.bc.ca"},
        {"name": "Marianne VanBuskirk", "role": "trustee", "email": "mvanbusk@sd83.bc.ca"},
        {"name": "Brent Gennings", "role": "trustee", "email": "bgenning@sd83.bc.ca"},
        {"name": "Corryn Grayston", "role": "trustee", "email": "cgraysto@sd83.bc.ca"}
    ],
    "84": [ # SD84 - Vancouver Island West
        {"name": "Arlene Fehr", "role": "chair", "email": "afehr@viw.sd84.bc.ca"},
        {"name": "Jenniffer Hanson", "role": "trustee", "email": "jhanson@viw.sd84.bc.ca"},
        {"name": "Debbie Mann", "role": "trustee", "email": "dmann@viw.sd84.bc.ca"},
        {"name": "Allison Stiglitz", "role": "trustee", "email": "astiglitz@viw.sd84.bc.ca"},
        {"name": "Katie Unger", "role": "trustee", "email": "kunger@viw.sd84.bc.ca"}
    ],
    "85": [ # SD85 - Vancouver Island North
        {"name": "Leightan Wishart", "role": "chair", "email": "lwishart@sd85.bc.ca"},
        {"name": "Jeff Field", "role": "trustee", "email": "jfield@sd85.bc.ca"},
        {"name": "Carol Robertson", "role": "trustee", "email": "crobertson@sd85.bc.ca"},
        {"name": "Paul Brandt", "role": "trustee", "email": "pbrandt@sd85.bc.ca"},
        {"name": "Janet Hanuse", "role": "trustee", "email": "jhanuse@sd85.bc.ca"}
    ],
    "87": [ # SD87 - Stikine
        {"name": "Yvonne Tashoots", "role": "chair", "email": "ytashoots@sd87.bc.ca"},
        {"name": "Jolene Vance", "role": "trustee", "email": "jvance@sd87.bc.ca"},
        {"name": "Freda Campbell", "role": "trustee", "email": "fcampbell@sd87.bc.ca"},
        {"name": "Rose Vance", "role": "trustee", "email": "rvance@sd87.bc.ca"},
        {"name": "Clarence Vance", "role": "trustee", "email": "cvance@sd87.bc.ca"}
    ],
    "91": [ # SD91 - Nechako Lakes
        {"name": "Adele Gooding", "role": "chair", "email": "agooding@sd91.bc.ca"},
        {"name": "Dave Christie", "role": "trustee", "email": "dchristie@sd91.bc.ca"},
        {"name": "Sarah John", "role": "trustee", "email": "sjohn@sd91.bc.ca"},
        {"name": "Cheryl Peterson", "role": "trustee", "email": "cpeterson@sd91.bc.ca"},
        {"name": "Nyree Hazelton", "role": "trustee", "email": "nhazelton@sd91.bc.ca"},
        {"name": "Stephen Davis", "role": "trustee", "email": "sdavis@sd91.bc.ca"},
        {"name": "Tom Bulmer", "role": "trustee", "email": "tbulmer@sd91.bc.ca"}
    ],
    "92": [ # SD92 - Nisga'a
        {"name": "Elsie Davis", "role": "chair", "email": "edavis@nisgaa.bc.ca"},
        {"name": "Alvin Azak", "role": "trustee", "email": "aazak@nisgaa.bc.ca"},
        {"name": "Charlene Osee", "role": "trustee", "email": "cosee@nisgaa.bc.ca"},
        {"name": "Sally Nyce", "role": "trustee", "email": "snyce@nisgaa.bc.ca"},
        {"name": "Floyd Tait", "role": "trustee", "email": "ftait@nisgaa.bc.ca"}
    ]
}

PSQL_BIN = "/opt/homebrew/opt/postgresql@15/bin/psql" if os.path.exists("/opt/homebrew/opt/postgresql@15/bin/psql") else "psql"

def escape_sql(s):
    if not s:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def main():
    print("Fetching BC School District map shapes from database...", flush=True)
    psql_cmd = [
        PSQL_BIN,
        DB_URL,
        "-t", "-A", "-F", "|",
        "-c", "SELECT id, code, name FROM map_shapes WHERE upload_id = (SELECT id FROM boundary_uploads WHERE name ILIKE '%BC School Districts%' LIMIT 1);"
    ]
    p = subprocess.run(psql_cmd, capture_output=True, text=True)
    if p.returncode != 0:
        print(f"Error fetching shapes: {p.stderr}", flush=True)
        sys.exit(1)

    code_to_shape_id = {}
    for line in p.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("|")
        if len(parts) >= 3:
            s_id = int(parts[0])
            code = parts[1].strip()
            name = parts[2].strip()
            code_to_shape_id[code] = (s_id, name)

    print(f"Found {len(code_to_shape_id)} BC School District shapes in database.", flush=True)

    sql_rows = []

    for code, trustees in BC_TRUSTEES.items():
        if code not in code_to_shape_id:
            print(f"⚠️ Warning: District code {code} not found in map_shapes, skipping.", flush=True)
            continue

        shape_id, district_name = code_to_shape_id[code]
        print(f"Processing SD{code} ({district_name}): {len(trustees)} trustees", flush=True)

        for t in trustees:
            name = t["name"]
            role = t.get("role", "trustee")
            role_id = ROLE_CHAIR_ID if role == "chair" else ROLE_TRUSTEE_ID
            email = t.get("email")
            phone = t.get("phone")
            bio = t.get("bio", f"Elected School Trustee for {district_name}")
            source_url = t.get("source_url", "https://bcsta.org/resources-and-services/branches-and-boards/")
            holding_since = "2022-11-01"

            row_sql = f"({shape_id}, '{role_id}', {escape_sql(name)}, {escape_sql(bio)}, {escape_sql(email)}, {escape_sql(phone)}, {escape_sql(source_url)}, '{holding_since}', NOW())"
            sql_rows.append(row_sql)

    print(f"\nPreparing multi-row batch inserts for {len(sql_rows)} trustees...", flush=True)

    # Batch into chunks of 50
    CHUNK_SIZE = 50
    for i in range(0, len(sql_rows), CHUNK_SIZE):
        chunk = sql_rows[i:i + CHUNK_SIZE]
        values_sql = ",\n".join(chunk)
        batch_sql = f"""
INSERT INTO office_holders (
    map_shape_id,
    election_role_type_id,
    full_name,
    bio,
    contact_email,
    contact_phone,
    source_url,
    holding_since,
    updated_at
) VALUES 
{values_sql}
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
    bio = EXCLUDED.bio,
    contact_email = EXCLUDED.contact_email,
    contact_phone = EXCLUDED.contact_phone,
    source_url = EXCLUDED.source_url,
    holding_since = EXCLUDED.holding_since,
    updated_at = NOW();
"""
        cmd = [PSQL_BIN, DB_URL, "-c", batch_sql]
        p_exec = subprocess.run(cmd, capture_output=True, text=True)
        if p_exec.returncode != 0:
            print(f"❌ Error in batch {i//CHUNK_SIZE + 1}: {p_exec.stderr}", flush=True)
    print(f"\nCreating/linking ghost profiles and politician walls for school trustees...", flush=True)
    ghost_sql = """
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  new_ghost_id UUID;
  clean_slug TEXT;
  counter INT := 0;
BEGIN
  FOR r IN (
    SELECT 
      oh.id AS office_holder_id,
      oh.full_name,
      oh.bio,
      oh.photo_url,
      oh.contact_email,
      oh.contact_phone,
      oh.source_url,
      oh.holding_since,
      oh.political_party_id,
      ms.name AS boundary_name,
      ms.boundary_type,
      ms.country,
      ert.role_title
    FROM office_holders oh
    JOIN map_shapes ms ON ms.id = oh.map_shape_id
    JOIN election_role_types ert ON ert.id = oh.election_role_type_id
    WHERE oh.linked_profile_id IS NULL
  )
  LOOP
    new_profile_id := gen_random_uuid();
    new_ghost_id := gen_random_uuid();

    clean_slug := lower(regexp_replace(r.full_name || '-' || r.role_title, '[^a-zA-Z0-9]+', '-', 'g'));
    clean_slug := trim(both '-' from clean_slug);

    INSERT INTO profiles (
      id,
      role,
      full_name,
      country,
      constituency,
      designation,
      current_ghost_id,
      updated_at
    ) VALUES (
      new_profile_id,
      'politician',
      r.full_name,
      r.country,
      r.boundary_name,
      r.role_title,
      new_ghost_id,
      NOW()
    );

    INSERT INTO politician_profiles (
      id,
      political_target_role,
      target_boundary_type,
      target_boundary_name,
      bio,
      avatar_url,
      contact_email,
      contact_phone,
      source_url,
      holding_since,
      political_party_id,
      wall_slug,
      created_at,
      updated_at
    ) VALUES (
      new_profile_id,
      r.role_title,
      r.boundary_type,
      r.boundary_name,
      r.bio,
      r.photo_url,
      r.contact_email,
      r.contact_phone,
      r.source_url,
      r.holding_since,
      r.political_party_id,
      clean_slug,
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      avatar_url = EXCLUDED.avatar_url,
      bio = EXCLUDED.bio,
      target_boundary_name = EXCLUDED.target_boundary_name,
      wall_slug = EXCLUDED.wall_slug;

    UPDATE office_holders
    SET linked_profile_id = new_profile_id
    WHERE id = r.office_holder_id;

    counter := counter + 1;
  END LOOP;
  RAISE NOTICE 'Created % ghost profile walls for office holders!', counter;
END $$;
"""
    cmd_ghost = [PSQL_BIN, DB_URL, "-c", ghost_sql]
    p_ghost = subprocess.run(cmd_ghost, capture_output=True, text=True)
    if p_ghost.returncode != 0:
        print(f"❌ Error creating ghost profiles: {p_ghost.stderr}", flush=True)
    else:
        print("✅ All politician profile walls generated and linked!", flush=True)

    print(f"\n🎉 Successfully populated {len(sql_rows)} BC trustees and chairs with live walls across {len(BC_TRUSTEES)} school districts!", flush=True)

if __name__ == "__main__":
    main()

