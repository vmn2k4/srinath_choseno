# Source: ballotpedia.org/United_States_House_of_Representatives_elections_in_New_York,_2026
# NOTE: NY has fusion voting -- a candidate can appear on multiple party lines
# (e.g. "Democratic Party, Working Families Party") but is still ONE person.
# Only distinct people missing from the DB are listed below. Where a minor
# party ran its OWN candidate separate from the major-party nominee (e.g.
# NY-07's WFP nominee Antonio Reynoso, distinct from Dem nominee Claire
# Valdez), that person is included as a real, separate general-election
# candidate.
NEW_PARTIES = [
    "Working Families Party", "Conservative Party", "Queens United Party",
    "4 Our Immigrants Party", "Our Future Party", "No Kings Party",
    "For All of Us Party", "Karen Ortiz Party", "Voice Party",
    "Party for Socialism and Liberation", "Speak The Truth Party",
    "What The H.E.C. Party", "Taxpayer Rights Party", "American Independent Party",
]
MISSING = {
    1: [("Jordan Maggio", "Independent"), ("Thomas Sorensen", "Independent")],
    4: [("Blay Tarnoff", "Libertarian Party")],
    7: [("Priscilla Ghaznavi", "Our Future Party"), ("Antonio Reynoso", "Working Families Party")],
    10: [("Nickie Kane", "No Kings Party")],
    12: [("Wilneida Negron", "For All of Us Party"), ("Karen Ortiz", "Karen Ortiz Party"),
         ("Robb Huhn", "Independent"), ("Lucian Wintrich", "Independent")],
    13: [("Candace Niles", "Voice Party"), ("Bob Cohen", "Working Families Party")],
    15: [("Gonzalo Duran", "Conservative Party"), ("Andre Easton", "Party for Socialism and Liberation"),
         ("Jose Vega", "Speak The Truth Party"), ("John Maynard Harris", "What The H.E.C. Party")],
    16: [("John Franklin Wilson IV", "Independent")],
    21: [("Michael Metzgier", "American Independent Party"), ("Christopher Schmidt", "Independent")],
    24: [("Ken Estes", "Independent"), ("Tony Macula", "Independent")],
    25: [("Kloud Walton", "Independent")],
}
