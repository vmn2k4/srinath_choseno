# Source: en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_elections_in_Illinois (District 4 spot-check)
NOMINEES = {
    4: [("Patty Garcia", "Democratic"), ("Lupe Castillo", "Republican"), ("Chris Getty", "Independent")],
}
# "Jesus Garcia" (withdrawn incumbent Chuy Garcia) shares last name "Garcia" with
# real nominee Patty Garcia -- force-delete him explicitly to avoid a false match.
FORCE_DELETE = {
    4: {"Jesus Garcia"},
}
