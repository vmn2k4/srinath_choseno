BEGIN;

CREATE TEMP TABLE staging_nl_winners (
  map_shape_id bigint,
  election_role_type_id uuid,
  full_name text,
  source_url text
) ON COMMIT DROP;

INSERT INTO staging_nl_winners VALUES
(16557, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Michelle Dalton', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16868, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Gerry Gros', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16742, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Garrett Watton', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16550, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Deborah Windsor- Hynes', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16572, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'John Barrett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16617, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Justin Foote', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16750, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dennis Butt', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16843, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jamie Seymour', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16666, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Todd Kenway', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16628, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Chris Dredge', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16633, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Keith O''Driscoll', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16657, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Debbie Banfield', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16605, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Geoff Seymour', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16591, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Louis Keats', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16809, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Theola Budden', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16831, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lorne Pittman', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16881, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Larry House', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16674, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Daniel Leights', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16807, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Sterling Quinlan', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16870, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Nadine Gould', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16602, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Gary N. Smith', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16747, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Krista Toms', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16764, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'John Norman', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16749, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Myra Budgell', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16563, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kelly Power', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16841, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Colleen Haas', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16613, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Shears Mercer Jr.', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16598, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Chris Mercer', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16753, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dave Boland', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16689, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Trevor Green', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16638, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kevin Lundrigan', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16835, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Rudy Norman', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16692, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Paul Strickland', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16806, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Maisie Clark', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16546, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Beverly O''Brien', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16709, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Stella Cornect', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16596, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Sam Slade', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16797, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Marilyn Tulk', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16786, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ivan Pickett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16575, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Larry Clarke', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16798, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Paula Flood', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16693, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Mark Andrews', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16577, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lloyd Reid', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16896, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ricky Oram 949-0205', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16757, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'John Pickett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16609, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Danielle Bussey', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16845, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Cari-An Barker', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16561, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'V. Joan Nolan', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16615, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Andy Parsley', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16573, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Carol Molloy', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16808, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Christopher Head', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16620, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Darrin Bent', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16616, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Judy Rotchford', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16854, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Brendon Fitzpatrick', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16876, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Barry Decker', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16723, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'anthony Alexander', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16727, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Linda Chaisson', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16802, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Rodney Wheeler', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16861, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Deanna Hutchings', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16731, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Perry Sheppard', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16800, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lloyd Andrews', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16611, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Rod Delaney', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16860, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ross Humber', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16714, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dean Ball', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16790, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Tony Keats', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16778, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Peter Moss', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16762, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Geraldine Baker', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16811, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Tammy Fifield', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16852, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Stephanie Fillier', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16665, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Laura Lee Labour', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16548, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jerome Kenny', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16551, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Aidan Costello', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16625, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jeffrey Connors', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16839, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jeacques Dzerounian', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16869, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lynn Way', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16850, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Andrew Shea', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16888, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dean Flynn', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16649, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Rita Piercey', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16655, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Daniel Power', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16568, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Carmel Perham', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16648, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Mildred Rideout', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16703, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Todd Brake', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16783, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Peter Lush', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16741, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Percy Farwell', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16651, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'David Yetman', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16554, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ronald Dillon', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16681, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Gordon Hunt', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16724, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Charlotte Gauthier', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16873, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Bella Young', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16743, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Allison Laite', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16780, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Douglas Churchill', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16879, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Roy Ward', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16650, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'John Burfitt', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16746, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Mike Browne', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16659, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Sherman Bolt', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16718, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Calvin Wilton', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16588, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Korri Power', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16777, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Carl Turner', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16899, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Bert Pomeroy', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16677, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Roy Drake', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16599, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Terry Barnes', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16618, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Mike Doyle', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16785, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Darlene Collins', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16863, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lloyd Bennett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16585, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Glenda Hiscock', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16582, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Tina Chislett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16583, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Francis St. George', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16680, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Stephen Crewe', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16619, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Laura Crawley', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16910, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Marjorie Flowers', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16716, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Betty Stead', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16734, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Debbie White', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16729, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Erica Humber-Shears', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16792, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Christa Lane', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16735, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Keith Goodyear', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16691, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Thomas Herritt', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16715, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Wicks, Herbert', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16766, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Annie Fitzgerald', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16768, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Mike Ricketts', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16833, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Perry Gillingham', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16706, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Paul Noseworthy', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16887, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Philip Chubbs', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16901, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jordan Brown', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16643, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Donald Collins', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16732, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Wade Park', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16642, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Shane Kearney', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16816, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Melissa Chippett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16637, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'James Mullett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16812, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Krista Freake', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16670, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Cora Scott', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16813, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jennifer Stuckless', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16627, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Bradley Power', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16570, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Walter Keating', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16644, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'John Hennebury', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16710, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Henry Gaudon', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16794, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kayla Hicks', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16822, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Shane Slade', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16871, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ian Brenton', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16909, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Barry Andersen', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16894, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Alton Rumbolt', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16654, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Gerry Brenton', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16726, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Donald Brown', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16730, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Susan Park-White', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16733, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Timothy Anderson', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16836, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Neville Robinson', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16849, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kimberley Grimes', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16751, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Fiona Humber', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16683, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Marina Burke', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16847, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Miles Regular', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16685, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Andy Kendell', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16559, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Elaine Nash', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16736, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Harold Payne', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16631, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dave Aker', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16795, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jason Chaulk', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16771, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Melvin Humby', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16911, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Julius (Joe) Dicker', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16586, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ivy Piercey', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16791, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dean Kean', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16834, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Rex Starkes', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16739, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Clay Hollett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16858, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Sheralyn Rumbolt', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16608, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Patrick Mackey', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16898, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Melanie Blake', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16745, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Peter Chayter', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16590, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Cliff Morgan', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16842, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kira Rideout', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16629, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Patrick Martin', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16662, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Harold Murphy', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16862, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Blaine Payne', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16722, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Darren Gardner', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16748, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Corey Samson', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16632, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Ed Dyke', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16819, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Wanda Seitl', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16890, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Joanne Dorey', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16567, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jamie Neville', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16646, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Terry Hillier', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16564, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Melvin Careen', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16817, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Denny Andrews', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16645, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Darren Harris', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16815, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Bernard Primmer', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16675, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Josephine Marshall', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16827, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Shawn Burton', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16772, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Darlene Clouter', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16892, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Edward Skinner', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16549, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Eugene Brothers', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16760, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Chris Kelly', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16864, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Tony Ryan', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16867, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Donald P. Spence', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16707, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kimberly De Groot', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16711, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Chalsie Kook Marche', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16623, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dave Bartlett', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16542, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Rowena Nichol', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16908, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Diane Gear', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16624, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Brad Richards', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16877, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Sherman Elliott', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16886, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Eric Paul', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16664, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Fred Kenway', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16719, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Clarence Moss', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16672, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Peter Giovannini', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16547, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'John Lawlor', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16907, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Chesley Sheppard', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16883, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Eric Patey', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16825, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Gregory Strickland', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16859, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Walter Nicolle', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16853, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Phyllis Randell', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16696, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Gary Bateman', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16661, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Sheldon Whiffen', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16594, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kelly Russell', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16782, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Bruce Critchley', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16779, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Meletta Harvey', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16679, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Maisie Simms', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16844, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Adam Gillingham', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16592, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Curtis Delaney', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16610, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Beverly Wells', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16571, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Joseph Brewer', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16603, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Tammy Oliver', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16826, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jenna Young- Balnchard', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16684, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Adam Wilcott', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16872, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Michelle Tucker', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16667, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Wally Scott', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16784, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'William Broderick', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16565, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Glenn Lake', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16701, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Conrad White', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16673, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Bruce Vallis', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16630, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Danny Breen', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16558, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Joanie Dobbin', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16640, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kevin Pittman', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16893, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Helen Poole', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16875, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Dale Colbourne', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16555, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Stephen Ryan', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16865, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Melvin Reid', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16544, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Anita Molloy', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16553, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Verna Hayward', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16721, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'William Dawson', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16705, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Bob Byrnes', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16704, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lisa Lucas', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16803, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kevin Barnes', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16574, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Wanda Simmonds', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16776, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Andrea Cornell', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16663, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Irene Augot', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16626, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Craig Scott', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16773, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Shannon Carter', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16543, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Wanda Waddleton', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16763, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Terry Stead', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16820, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jason Roberts', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16856, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Roger Hann', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16804, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Deborah Bourden', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16600, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Cindy Dobbin', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16622, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Phillip Tobin', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16902, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Gertrude Canning', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16889, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Agnes Pike', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16846, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'William Wheeler', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16579, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Hilda Whalen', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16581, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Albert Legge', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16653, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'David Pittman', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16587, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Lily Webber', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16634, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Jacob Hayden', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16848, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Kirk Simms', 'https://www.gov.nl.ca/mca/municipal-directory/'),
(16737, '3855aeb9-c840-4d81-bb83-66cad128ea8c', 'Michael Kendell', 'https://www.gov.nl.ca/mca/municipal-directory/');

UPDATE office_holders oh
SET is_current = false, term_ended_at = CURRENT_DATE, updated_at = NOW()
WHERE oh.is_current = true
  AND EXISTS (SELECT 1 FROM staging_nl_winners s WHERE s.map_shape_id = oh.map_shape_id)
  AND NOT EXISTS (
    SELECT 1 FROM staging_nl_winners s
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
FROM staging_nl_winners s
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
    JOIN staging_nl_winners s ON s.map_shape_id = oh.map_shape_id AND s.full_name = oh.full_name
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
  RAISE NOTICE 'NL sync: created % new ghost profile walls, linked % to existing profiles.', created_count, linked_count;
END $$;

COMMIT;