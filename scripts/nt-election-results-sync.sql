BEGIN;

CREATE TEMP TABLE staging_nt_winners (
  map_shape_id bigint,
  election_role_type_id uuid,
  full_name text,
  source_url text
) ON COMMIT DROP;

INSERT INTO staging_nt_winners VALUES
(21935, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'James Marlowe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21935, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ron Desjarlais', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21935, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ron Fatt', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21935, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Gilbert Abel', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21935, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Celine Marlowe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21935, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Berna Catholique', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21935, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Charlie Catholique', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jordan McLeod', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Dave McLeod', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Karlyn Blake', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Courtney Charlie', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Edwin (Eddie) Greenland', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kathy Greenland', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Shirley Koe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Richard Storr', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21905, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'William (Billy) Storr', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Bertha Rabesca-Zoe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Skye Ekendia', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Stephanie Joyce Behrens', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Titus Lafferty-Rabesca', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mary Adele Mackenzie', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mabel Huskey', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'James Rabesca', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Rosa Mantla', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Edie Erasmus', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21915, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tammy Steinwand Deschambeault', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21913, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Richard Kochon', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21913, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Dakota Orlias', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21913, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ryan Kochon', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21913, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Hyacinthe Kochon', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21913, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Bobby Manuel', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21913, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joseph Turo', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21913, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Sheena Snow', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21913, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Alvin Orlias', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21938, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ernest Betsina', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Shawn Grandjambe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'William McNeely', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Dwayne Barnaby', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Darcy James Edgi', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joseph Tobac', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Roger Boniface', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Norman Pierrot', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lucy Jackson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Angela Grandjambe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21912, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Naomi Gully', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21922, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Derwin Kotchea', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21922, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kristina Powder', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21922, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mike Gonet', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21922, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Michelle Browning', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21922, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Shayla McLeod', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21922, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Gregory Wilson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21922, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Hillary Deneron', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21903, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Rebecca Blake', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21903, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Sierra Daley', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21903, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Dennis Wright', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21903, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ruby McDonald', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Danny Beaulieu', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Alayna Krutko', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Miranda Elleze', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Louie Constant', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joyce McLeod', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Wayne Sanderson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Trisha Landry', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Bernadette Landry', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21925, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Margaret Thom', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Leslie (Les) Wright', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Troy Bellefontaine', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Eliza Jane Chalifoux', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Richenda Cli', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Renalyn Pascua-Matte', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'James Tsetso', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kathy Tsetso', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Josh Campbell', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21927, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Cheryl Cli', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dana Fergusson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mike Keizer', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Connie Benwell', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Karl Cox', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Al Karasiuk', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Leonard (Len) Tuckey', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Adam Bathe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mike Couvrette', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21930, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Patricia Heaton', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21917, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Doreen Ann Arrowmaker', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21917, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Brenden Bekale', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21917, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Peter John Apples', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21917, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Pamela Quitte', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21917, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Guerin Zoe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21917, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Justin Gon', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21917, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Carrcie Mantla', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kandis Jameson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Linda Duford', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Keith Dohey', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Thomas Lakusta', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Rena Squirrel', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Robert Bouchard', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Brian Willows', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Corina Gagnier', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21933, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Karen Wall', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Peter Clarkson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Steve Baryluk', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ned Day', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Melinda Gillis', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Mario Lemieux', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kendall McDonald', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Alana Mero', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jennifer Parrott', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21904, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kurt Wainman', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21924, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Melanie Norwegian-Menacho', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21924, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Howard Gargan', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21924, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ericson Sanguez', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21924, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nolene Hardisty', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21924, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Misty Ireland', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21924, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Rhonda Grossetete (Youth)', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21924, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Margaret Ireland', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21920, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lloyd Chicot', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nora Simba', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Terry Simba', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Melanie Simba', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21920, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Henri Landry', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21923, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Steve Vital', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21923, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jayne Konisenta', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21923, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Laura Vital', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21923, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Brian Ekotla', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21923, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Stanley Betsaka', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21923, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Peter Marcellais', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21923, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Eric Matou', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21911, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Frank Pope', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21911, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Alexis Peachy', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21911, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Trevor Smith', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21911, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Robert (Bob) Greek', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21911, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Carol Lorentz', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21911, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Heidi Hodgson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ray Ruben Sr.', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Albert Ruben Sr.', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jason Reidford', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Donna Ruben', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Keasha Green', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lily-Ann Green', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Micheal J. Green', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jermaine Green', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21902, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Gilbert Thrasher Sr.', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21907, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Donna Keogak', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21907, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Wayne Gully', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21907, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Pamela Kimiksana', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21907, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Bernadette Nakimayak', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21907, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Yvonne Elias', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21907, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jasmine Keogak', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21907, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Norman Anikina', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21921, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dolphus Jumbo', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Yvonne Jumbo', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ron Kotchea', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tanya Jeanbo', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jessica Jumbo', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21921, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tony Jumbo', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21901, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Shawn James Roland VanLoon', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21901, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'James Andre', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21901, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Charlene Blake', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21901, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Dinah Blake', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21901, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Georgie Niditchie', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21901, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Peter Ross', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Vince Teddy', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Elizabeth Arey', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ryan Yakeleya', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tyrone Raddi', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joe Nasogaluak Jr.', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jocelyn Noksana', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joshua Campbell', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jackie Jacobson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21906, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Chukita Gruben', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21910, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Douglas Yallee', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21910, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Sally Ann Horassi (Deputy Mayor)', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21910, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'James Mendo', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21910, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Robert McPherson', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21910, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Janet Bayha-MacCauley', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21910, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'William Chapple', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Pat Klengenberg', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Delma Klengenberg', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'David Kuptana', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nicolas Kopot', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Margaret Kanayok', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kimberly Joss', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joyce Banksland', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Janet Kanayok', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21908, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Susie Memogana', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21918, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Adeline Football', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21918, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Joseph Dryneck', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21918, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Chris Football', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21918, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Trent Devon Rabesca', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21918, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nathaniel Tom', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Charles Nitsiza', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Sonny Zoe', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Kerry Ann Franki', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Walter Beaverho', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'George Nitsiza', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Lisa Nitsiza', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Charlie Jeremick&#039;ca', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tina Nitsiza', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21916, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Michel Moosenose', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21928, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jamie Moses', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21928, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jason Horesay', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21928, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Albert Clillie', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21928, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Freddie Clillie', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21928, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Jensen Clillie', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21928, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Nicole Hardisty', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21928, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'David Moses', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21939, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ben Hendriksen', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21939, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Rob Warburton', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21939, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Cat McGurk', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21939, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Stacie Smith', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21939, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Tom McLennan', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21939, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Garett Cochrane', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21939, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Ryan Fequet', 'https://www.maca.gov.nt.ca/en/community-contact-listing'),
(21939, '6d2e3815-05d9-4784-b220-1d73140b5bf3', 'Steve Payne', 'https://www.maca.gov.nt.ca/en/community-contact-listing');

UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_nt_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_nt_winners s
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
FROM staging_nt_winners s
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
    JOIN staging_nt_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
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
  RAISE NOTICE 'NT sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;

COMMIT;