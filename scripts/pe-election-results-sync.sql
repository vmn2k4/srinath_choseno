BEGIN;

CREATE TEMP TABLE staging_pe_winners (
  map_shape_id bigint,
  election_role_type_id uuid,
  full_name text,
  source_url text
) ON COMMIT DROP;

INSERT INTO staging_pe_winners VALUES
(16970, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Philip Brown', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Justin Muttart', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Norman Beck', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mitchell Tweel', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kevin Ramsay', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Bob Doiron', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'John McAleer', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Trevor MacKinnon', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Julie McCabe', 'https://fpeim.ca/municipal-directory/'),
(16970, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Terry Bernard', 'https://fpeim.ca/municipal-directory/'),
(16987, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dan Kutcher', 'https://fpeim.ca/municipal-directory/'),
(16987, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Bruce MacDougall', 'https://fpeim.ca/municipal-directory/'),
(16987, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Justin Doiron', 'https://fpeim.ca/municipal-directory/'),
(16987, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ken Trenholm', 'https://fpeim.ca/municipal-directory/'),
(16987, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Norma McColeman', 'https://fpeim.ca/municipal-directory/'),
(16987, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Rick Morrison', 'https://fpeim.ca/municipal-directory/'),
(16987, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Carrie Adams', 'https://fpeim.ca/municipal-directory/'),
(16987, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nicholas Cameron', 'https://fpeim.ca/municipal-directory/'),
(16976, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Barbara Wood', 'https://fpeim.ca/municipal-directory/'),
(16976, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nicole Arsenault', 'https://fpeim.ca/municipal-directory/'),
(16976, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ashley Steele', 'https://fpeim.ca/municipal-directory/'),
(16976, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Marcia Green', 'https://fpeim.ca/municipal-directory/'),
(16976, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Patricia Marshall', 'https://fpeim.ca/municipal-directory/'),
(16972, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Minerva McCourt', 'https://fpeim.ca/municipal-directory/'),
(16972, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Steven Campbell', 'https://fpeim.ca/municipal-directory/'),
(16972, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Corey Frizzell', 'https://fpeim.ca/municipal-directory/'),
(16972, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Judy Herlihy', 'https://fpeim.ca/municipal-directory/'),
(16972, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Cory Stevenson', 'https://fpeim.ca/municipal-directory/'),
(16979, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jeff Spencer', 'https://fpeim.ca/municipal-directory/'),
(16928, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Debbie Johnston', 'https://fpeim.ca/municipal-directory/'),
(16988, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Paul Gallant', 'https://fpeim.ca/municipal-directory/'),
(16988, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Yolande Gallant', 'https://fpeim.ca/municipal-directory/'),
(16988, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Paulette LeBlanc', 'https://fpeim.ca/municipal-directory/'),
(16988, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joel Bernard', 'https://fpeim.ca/municipal-directory/'),
(16988, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Allyca Arsenault', 'https://fpeim.ca/municipal-directory/'),
(16937, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Melody vanOmme', 'https://fpeim.ca/municipal-directory/'),
(16937, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Natalie Murphy', 'https://fpeim.ca/municipal-directory/'),
(16937, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Stephanie Young', 'https://fpeim.ca/municipal-directory/'),
(16937, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Roy Beaton', 'https://fpeim.ca/municipal-directory/'),
(16937, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Paul Gallant', 'https://fpeim.ca/municipal-directory/'),
(16937, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lucille Carter', 'https://fpeim.ca/municipal-directory/'),
(16920, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Edwin McKie', 'https://fpeim.ca/municipal-directory/'),
(16920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Matt Downe', 'https://fpeim.ca/municipal-directory/'),
(16920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Bruce Henderson', 'https://fpeim.ca/municipal-directory/'),
(16920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Erica MacDonald', 'https://fpeim.ca/municipal-directory/'),
(16920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Michael MacDonald', 'https://fpeim.ca/municipal-directory/'),
(16920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nancy MacDonald', 'https://fpeim.ca/municipal-directory/'),
(16920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Larry Victor', 'https://fpeim.ca/municipal-directory/'),
(16980, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nichola Arsenault', 'https://fpeim.ca/municipal-directory/'),
(16980, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Derrick Blacquiere', 'https://fpeim.ca/municipal-directory/'),
(16980, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Robert Green', 'https://fpeim.ca/municipal-directory/'),
(16980, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Barry Stewart', 'https://fpeim.ca/municipal-directory/'),
(16980, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Andrew David', 'https://fpeim.ca/municipal-directory/'),
(16932, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Garth Gillis', 'https://fpeim.ca/municipal-directory/'),
(16932, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Katherine Bryson', 'https://fpeim.ca/municipal-directory/'),
(16932, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Trisha Carter', 'https://fpeim.ca/municipal-directory/'),
(16932, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Billy Gamble', 'https://fpeim.ca/municipal-directory/'),
(16932, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'James Kinnee', 'https://fpeim.ca/municipal-directory/'),
(16932, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Charley McGovern', 'https://fpeim.ca/municipal-directory/'),
(16957, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Greg McQuaid', 'https://fpeim.ca/municipal-directory/'),
(16957, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Cody Good', 'https://fpeim.ca/municipal-directory/'),
(16957, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Don Jardine', 'https://fpeim.ca/municipal-directory/'),
(16957, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tyler Shea', 'https://fpeim.ca/municipal-directory/'),
(16956, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Irene Novaczek', 'https://fpeim.ca/municipal-directory/'),
(16956, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kent MacLennan', 'https://fpeim.ca/municipal-directory/'),
(16956, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lisa MacLennan', 'https://fpeim.ca/municipal-directory/'),
(16956, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'David Ross', 'https://fpeim.ca/municipal-directory/'),
(16956, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jessica Stewart', 'https://fpeim.ca/municipal-directory/'),
(16956, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Rebecca MacLeod', 'https://fpeim.ca/municipal-directory/'),
(16995, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Rod Millar', 'https://fpeim.ca/municipal-directory/'),
(16950, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Steven Shoemaker', 'https://fpeim.ca/municipal-directory/'),
(16950, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Julia Purcell', 'https://fpeim.ca/municipal-directory/'),
(16950, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Maureen MacNevin', 'https://fpeim.ca/municipal-directory/'),
(16950, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jeff Mallett', 'https://fpeim.ca/municipal-directory/'),
(16950, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Catherine Murray-Grandjean', 'https://fpeim.ca/municipal-directory/'),
(16950, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Fred Beer', 'https://fpeim.ca/municipal-directory/'),
(16925, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Larry Fitzpatrick', 'https://fpeim.ca/municipal-directory/'),
(16925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Arthur Baker', 'https://fpeim.ca/municipal-directory/'),
(16925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Bernadette McInnis', 'https://fpeim.ca/municipal-directory/'),
(16925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Donna Campbell Dixon', 'https://fpeim.ca/municipal-directory/'),
(16925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Donald Humphrey', 'https://fpeim.ca/municipal-directory/'),
(16925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nathan Paton', 'https://fpeim.ca/municipal-directory/'),
(16999, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'LeRoy Hiltz', 'https://fpeim.ca/municipal-directory/'),
(16999, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Amy Blanchard-Graham', 'https://fpeim.ca/municipal-directory/'),
(16999, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Christopher Dunbar', 'https://fpeim.ca/municipal-directory/'),
(16999, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Dean Getson', 'https://fpeim.ca/municipal-directory/'),
(16999, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Alan Warren', 'https://fpeim.ca/municipal-directory/'),
(16999, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Grant Wilkie', 'https://fpeim.ca/municipal-directory/'),
(16944, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Patrick Butler', 'https://fpeim.ca/municipal-directory/'),
(16944, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Norman Clow', 'https://fpeim.ca/municipal-directory/'),
(16944, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nancy Kelly', 'https://fpeim.ca/municipal-directory/'),
(16944, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lorna MacGregor', 'https://fpeim.ca/municipal-directory/'),
(16944, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Roger Smith', 'https://fpeim.ca/municipal-directory/'),
(16944, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'George Stewart', 'https://fpeim.ca/municipal-directory/'),
(16936, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tyler MacKenzie', 'https://fpeim.ca/municipal-directory/'),
(16936, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Carrie Fraser', 'https://fpeim.ca/municipal-directory/'),
(16936, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Robert MacDougall', 'https://fpeim.ca/municipal-directory/'),
(16936, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Vivian Doyle', 'https://fpeim.ca/municipal-directory/'),
(16936, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kenneth Matheson', 'https://fpeim.ca/municipal-directory/'),
(16936, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nadya Dominique', 'https://fpeim.ca/municipal-directory/'),
(16952, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ashley Doucette', 'https://fpeim.ca/municipal-directory/'),
(16952, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Richard Hollands', 'https://fpeim.ca/municipal-directory/'),
(16952, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Michelle McCourt', 'https://fpeim.ca/municipal-directory/'),
(16952, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kenneth Stewart', 'https://fpeim.ca/municipal-directory/'),
(16945, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Alan Miller', 'https://fpeim.ca/municipal-directory/'),
(16985, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'William Jones', 'https://fpeim.ca/municipal-directory/'),
(16985, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Amy Walfield', 'https://fpeim.ca/municipal-directory/'),
(16985, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'James Marchbank', 'https://fpeim.ca/municipal-directory/'),
(16985, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Benjamin Campbell', 'https://fpeim.ca/municipal-directory/'),
(16985, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Greg Compton', 'https://fpeim.ca/municipal-directory/'),
(16977, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Paul Brown', 'https://fpeim.ca/municipal-directory/'),
(16977, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Krista Ashley', 'https://fpeim.ca/municipal-directory/'),
(16977, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Wayne Crosby', 'https://fpeim.ca/municipal-directory/'),
(16977, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ghislaine Duplain', 'https://fpeim.ca/municipal-directory/'),
(16977, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jason MacLellan', 'https://fpeim.ca/municipal-directory/'),
(16977, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Marla Simmons', 'https://fpeim.ca/municipal-directory/'),
(16951, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Hal Parker', 'https://fpeim.ca/municipal-directory/'),
(16951, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Andrew Frizzell', 'https://fpeim.ca/municipal-directory/'),
(16951, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Leo Doucette', 'https://fpeim.ca/municipal-directory/'),
(16951, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Spencer MacDonald', 'https://fpeim.ca/municipal-directory/'),
(16951, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Rosemarie Ramsay', 'https://fpeim.ca/municipal-directory/'),
(16951, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jamie Taylor', 'https://fpeim.ca/municipal-directory/'),
(16943, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'T. Wade Campbell', 'https://fpeim.ca/municipal-directory/'),
(16943, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Robert Keith Belbin', 'https://fpeim.ca/municipal-directory/'),
(16943, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Robert Bertram', 'https://fpeim.ca/municipal-directory/'),
(16943, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Travis Deacon', 'https://fpeim.ca/municipal-directory/'),
(16943, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tyler Deacon', 'https://fpeim.ca/municipal-directory/'),
(16943, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Leah-Jane Hayward', 'https://fpeim.ca/municipal-directory/'),
(16996, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Hubert Fraser', 'https://fpeim.ca/municipal-directory/'),
(16996, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lisa Fraser', 'https://fpeim.ca/municipal-directory/'),
(16996, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Suzanne Matthews', 'https://fpeim.ca/municipal-directory/'),
(16996, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Karen Milligan', 'https://fpeim.ca/municipal-directory/'),
(16996, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Michaela Fraser', 'https://fpeim.ca/municipal-directory/'),
(16981, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ron Chappell', 'https://fpeim.ca/municipal-directory/'),
(16981, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Neil Arsenault', 'https://fpeim.ca/municipal-directory/'),
(16981, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Anne Fitzgerald', 'https://fpeim.ca/municipal-directory/'),
(16981, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lee MacLeod', 'https://fpeim.ca/municipal-directory/'),
(16981, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joel Noonan', 'https://fpeim.ca/municipal-directory/'),
(16981, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kris Pauptit', 'https://fpeim.ca/municipal-directory/'),
(16921, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Pat O’Connor', 'https://fpeim.ca/municipal-directory/'),
(16921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lane Mingo', 'https://fpeim.ca/municipal-directory/'),
(16921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Hugh-Andrew MacAulay', 'https://fpeim.ca/municipal-directory/'),
(16921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Anne Galbraith', 'https://fpeim.ca/municipal-directory/'),
(16921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Grant Galbraith', 'https://fpeim.ca/municipal-directory/'),
(16921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Leo Gerard Flynn', 'https://fpeim.ca/municipal-directory/'),
(16998, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Vance Keough', 'https://fpeim.ca/municipal-directory/'),
(16998, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Vernon Gaudette', 'https://fpeim.ca/municipal-directory/'),
(16998, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Leah Kinch', 'https://fpeim.ca/municipal-directory/'),
(16998, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Murray Perry', 'https://fpeim.ca/municipal-directory/'),
(16998, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Crystal Gaudet', 'https://fpeim.ca/municipal-directory/'),
(16998, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Katherine Gaudet', 'https://fpeim.ca/municipal-directory/'),
(16984, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jason Woodbury', 'https://fpeim.ca/municipal-directory/'),
(16984, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Sharon Gaudet', 'https://fpeim.ca/municipal-directory/'),
(16984, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Chris Greencorn', 'https://fpeim.ca/municipal-directory/'),
(16984, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Theresa Mahar', 'https://fpeim.ca/municipal-directory/'),
(16984, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Brian Tredenick', 'https://fpeim.ca/municipal-directory/'),
(16984, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Billy Arsenault', 'https://fpeim.ca/municipal-directory/'),
(17002, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Parker Arsenault', 'https://fpeim.ca/municipal-directory/'),
(17002, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Linda Gallant', 'https://fpeim.ca/municipal-directory/'),
(17002, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Cindy Gavin', 'https://fpeim.ca/municipal-directory/'),
(17002, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Vanessa McRae', 'https://fpeim.ca/municipal-directory/'),
(17002, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Helene Pitre', 'https://fpeim.ca/municipal-directory/'),
(17002, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Judy Pitre', 'https://fpeim.ca/municipal-directory/'),
(16955, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Fern Yeo', 'https://fpeim.ca/municipal-directory/'),
(16955, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Anita Hopkins', 'https://fpeim.ca/municipal-directory/'),
(16955, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tim LeLacheur', 'https://fpeim.ca/municipal-directory/'),
(16955, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Cory Pater', 'https://fpeim.ca/municipal-directory/'),
(16955, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Gerald Proctor', 'https://fpeim.ca/municipal-directory/'),
(16955, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Cynthia Yeo', 'https://fpeim.ca/municipal-directory/'),
(17010, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Martin Ruben', 'https://fpeim.ca/municipal-directory/'),
(17010, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Thomas Wright', 'https://fpeim.ca/municipal-directory/'),
(17010, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Shelley Trainor', 'https://fpeim.ca/municipal-directory/'),
(17010, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Janet Lauzon', 'https://fpeim.ca/municipal-directory/'),
(17010, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Susan Oxley', 'https://fpeim.ca/municipal-directory/'),
(17010, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Andrea Slysz', 'https://fpeim.ca/municipal-directory/'),
(16966, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Noémie Wheatley', 'https://fpeim.ca/municipal-directory/'),
(16966, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'David Malone', 'https://fpeim.ca/municipal-directory/'),
(16966, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Coady Tawil', 'https://fpeim.ca/municipal-directory/'),
(16966, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mary Catherine Connolly', 'https://fpeim.ca/municipal-directory/'),
(16966, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Houston Stewart', 'https://fpeim.ca/municipal-directory/'),
(16966, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'and Nicholas Oakes', 'https://fpeim.ca/municipal-directory/'),
(16964, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Helen Smith-MacPhail', 'https://fpeim.ca/municipal-directory/'),
(16960, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mark Ashley', 'https://fpeim.ca/municipal-directory/'),
(16960, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lyndon Doiron', 'https://fpeim.ca/municipal-directory/'),
(16960, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Darryl Lewis', 'https://fpeim.ca/municipal-directory/'),
(16960, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kurtis Jay', 'https://fpeim.ca/municipal-directory/');

UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_pe_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_pe_winners s
    WHERE s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
      AND s.election_role_type_id = oh.election_role_type_id
  );


INSERT INTO office_holders (
  map_shape_id, election_role_type_id, full_name, bio, source_url,
  is_current, term_ended_at, updated_at
)
SELECT DISTINCT ON (s.map_shape_id, s.election_role_type_id, s.full_name)
  s.map_shape_id, s.election_role_type_id, s.full_name,
  (SELECT ert.role_title FROM election_role_types ert WHERE ert.id = s.election_role_type_id) || ' for ' ||
  (SELECT ms.name FROM map_shapes ms WHERE ms.id = s.map_shape_id),
  s.source_url, true, NULL, NOW()
FROM staging_pe_winners s
ORDER BY s.map_shape_id, s.election_role_type_id, s.full_name
ON CONFLICT (map_shape_id, election_role_type_id, full_name) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  is_current = true,
  term_ended_at = NULL,
  updated_at = NOW();


DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  new_ghost_id UUID;
  existing_profile_id UUID;
  computed_slug TEXT;
  created_count INT := 0;
  linked_count INT := 0;
BEGIN
  FOR r IN
    SELECT oh.id as office_holder_id, oh.full_name, oh.bio,
           ms.country, ms.name as boundary_name, ms.boundary_type, ert.role_title
    FROM office_holders oh
    JOIN map_shapes ms ON oh.map_shape_id = ms.id
    JOIN election_role_types ert ON oh.election_role_type_id = ert.id
    JOIN staging_pe_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
    WHERE oh.linked_profile_id IS NULL
  LOOP
    computed_slug := lower(regexp_replace(regexp_replace(r.full_name || '-' || r.role_title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
    SELECT pp.id INTO existing_profile_id FROM politician_profiles pp WHERE pp.wall_slug = computed_slug LIMIT 1;
    IF existing_profile_id IS NULL THEN
      SELECT p.id INTO existing_profile_id FROM profiles p
      WHERE p.role = 'politician' AND lower(p.full_name) = lower(r.full_name) AND p.constituency = r.boundary_name
      LIMIT 1;
    END IF;
    IF existing_profile_id IS NOT NULL THEN
      UPDATE office_holders SET linked_profile_id = existing_profile_id WHERE id = r.office_holder_id;
      linked_count := linked_count + 1;
    ELSE
      new_profile_id := gen_random_uuid();
      new_ghost_id := gen_random_uuid();
      INSERT INTO profiles (id, role, full_name, country, constituency, designation, current_ghost_id, updated_at)
      VALUES (new_profile_id, 'politician', r.full_name, r.country, r.boundary_name, r.role_title, new_ghost_id, NOW());
      INSERT INTO politician_profiles (id, political_target_role, target_boundary_type, target_boundary_name, bio, wall_slug, created_at, updated_at)
      VALUES (new_profile_id, r.role_title, r.boundary_type, r.boundary_name, r.bio, computed_slug, NOW(), NOW());
      UPDATE office_holders SET linked_profile_id = new_profile_id WHERE id = r.office_holder_id;
      created_count := created_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'PE sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;

COMMIT;