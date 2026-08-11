import csv

civic_parties_data = [
    {
        "Party Name": "ABC Vancouver",
        "City": "Vancouver",
        "Official Website": "https://abcvancouver.ca",
        "Contact Email": "info@abcvancouver.ca",
        "Key Figures": "Mayor Ken Sim, Sarah Kirby-Yung, Lisa Dominato",
        "Active Elected Reps": "8 (Mayor + 7 Councillors)",
        "Notes": "Currently holds governing majority on Vancouver City Council & Park Board."
    },
    {
        "Party Name": "Surrey Connect",
        "City": "Surrey",
        "Official Website": "https://surreyconnect.ca",
        "Contact Email": "info@surreyconnect.ca",
        "Key Figures": "Mayor Brenda Locke, Rob Stutt, Harry Bains, Gordon Hepner",
        "Active Elected Reps": "5 (Mayor + 4 Councillors)",
        "Notes": "Currently holds governing majority on Surrey City Council."
    },
    {
        "Party Name": "Surrey First",
        "City": "Surrey",
        "Official Website": "https://surreyfirst.ca",
        "Contact Email": "info@surreyfirst.ca",
        "Key Figures": "Linda Annis, Mike Bose",
        "Active Elected Reps": "2 Councillors",
        "Notes": "Longstanding Surrey electoral organization."
    },
    {
        "Party Name": "Safe Surrey Coalition",
        "City": "Surrey",
        "Official Website": "https://safesurreycoalition.ca",
        "Contact Email": "info@safesurreycoalition.ca",
        "Key Figures": "Doug Elford, Mandeep Nagra (Former Mayor Doug McCallum)",
        "Active Elected Reps": "2 Councillors",
        "Notes": "Active civic party in Surrey."
    },
    {
        "Party Name": "Burnaby Citizens Association (BCA)",
        "City": "Burnaby",
        "Official Website": "https://burnabycitizens.ca",
        "Contact Email": "info@burnabycitizens.ca",
        "Key Figures": "Mayor Mike Hurley, Alison Gu, Pietro Calendino, Sav Dhaliwal",
        "Active Elected Reps": "6 (Mayor + 5 Councillors)",
        "Notes": "Governing civic party in Burnaby."
    },
    {
        "Party Name": "Burnaby Green Party",
        "City": "Burnaby",
        "Official Website": "https://burnabygreens.ca",
        "Contact Email": "info@burnabygreens.ca",
        "Key Figures": "Carrie Rossi",
        "Active Elected Reps": "1 Councillor",
        "Notes": "Green electoral organization in Burnaby."
    },
    {
        "Party Name": "Contract with Langley",
        "City": "Langley Township",
        "Official Website": "https://contractwithlangley.ca",
        "Contact Email": "info@contractwithlangley.ca",
        "Key Figures": "Mayor Eric Woodward, Barb Martens, Tim Baillie, Steve Ferguson",
        "Active Elected Reps": "4 (Mayor + 3 Councillors)",
        "Notes": "Governing party in Township of Langley."
    },
    {
        "Party Name": "Community First New West",
        "City": "New Westminster",
        "Official Website": "https://communityfirstnw.ca",
        "Contact Email": "info@communityfirstnw.ca",
        "Key Figures": "Mayor Patrick Johnstone, Ruby Campbell, Jaimie McEvoy",
        "Active Elected Reps": "5 (Mayor + 4 Councillors)",
        "Notes": "Progressive governing party in New Westminster."
    },
    {
        "Party Name": "New Westminster Progressives",
        "City": "New Westminster",
        "Official Website": "https://nwprogressives.ca",
        "Contact Email": "info@nwprogressives.ca",
        "Key Figures": "Daniel Fontaine, Paul Minhas",
        "Active Elected Reps": "2 Councillors",
        "Notes": "Centre-right civic organization in New Westminster."
    },
    {
        "Party Name": "Achieving For Delta",
        "City": "Delta",
        "Official Website": "https://achievingfordelta.ca",
        "Contact Email": "info@achievingfordelta.ca",
        "Key Figures": "Mayor George V. Harvie, Dylan Kruger, Alicia Guichon",
        "Active Elected Reps": "3 (Mayor + 2 Councillors)",
        "Notes": "Governing civic organization in Delta."
    },
    {
        "Party Name": "Abbotsford First Electors Society",
        "City": "Abbotsford",
        "Official Website": "https://abbotsfordfirst.com",
        "Contact Email": "info@abbotsfordfirst.com",
        "Key Figures": "Kelly Chahal, Les Barkman",
        "Active Elected Reps": "2 Councillors",
        "Notes": "Civic electors organization in Abbotsford."
    },
    {
        "Party Name": "Green Party of Vancouver",
        "City": "Vancouver",
        "Official Website": "https://vancouvergreens.ca",
        "Contact Email": "info@vancouvergreens.ca",
        "Key Figures": "Adriane Carr, Pete Fry",
        "Active Elected Reps": "3 (2 Councillors + Park Board)",
        "Notes": "Vancouver Green civic party."
    },
    {
        "Party Name": "OneCity Vancouver",
        "City": "Vancouver",
        "Official Website": "https://onecityvancouver.ca",
        "Contact Email": "info@onecityvancouver.ca",
        "Key Figures": "Christine Boyle",
        "Active Elected Reps": "1 Councillor",
        "Notes": "Progressive civic party in Vancouver."
    },
    {
        "Party Name": "COPE (Coalition of Progressive Electors)",
        "City": "Vancouver",
        "Official Website": "https://copevancouver.ca",
        "Contact Email": "cope@copevancouver.ca",
        "Key Figures": "Jean Swanson, Tania Blyth",
        "Active Elected Reps": "School Board & Civic Movement",
        "Notes": "Historic progressive civic coalition in Vancouver."
    },
    {
        "Party Name": "TEAM for a Liveable Vancouver",
        "City": "Vancouver",
        "Official Website": "https://voteteam.ca",
        "Contact Email": "info@voteteam.ca",
        "Key Figures": "Colleen Hardwick",
        "Active Elected Reps": "Civic Organization",
        "Notes": "Neighbourhood advocacy civic party in Vancouver."
    },
    {
        "Party Name": "RITE Richmond",
        "City": "Richmond",
        "Official Website": "https://riterichmond.ca",
        "Contact Email": "info@riterichmond.ca",
        "Key Figures": "Michael Wolfe, Carol Day",
        "Active Elected Reps": "3 Councillors",
        "Notes": "Progressive Richmond electors society."
    },
    {
        "Party Name": "ONE Richmond",
        "City": "Richmond",
        "Official Website": "https://onerichmond.ca",
        "Contact Email": "info@onerichmond.ca",
        "Key Figures": "Chak Au, Kash Heed",
        "Active Elected Reps": "2 Councillors",
        "Notes": "Active civic organization in Richmond."
    },
    {
        "Party Name": "Richmond RISE",
        "City": "Richmond",
        "Official Website": "https://richmondrise.ca",
        "Contact Email": "info@richmondrise.ca",
        "Key Figures": "Andy Hobbs",
        "Active Elected Reps": "1 Councillor",
        "Notes": "Civic electors organization in Richmond."
    },
    {
        "Party Name": "Richmond United",
        "City": "Richmond",
        "Official Website": "https://richmondunited.ca",
        "Contact Email": "info@richmondunited.ca",
        "Key Figures": "Bill McNulty",
        "Active Elected Reps": "1 Councillor",
        "Notes": "Richmond civic electors organization."
    },
    {
        "Party Name": "Maple Ridge First",
        "City": "Maple Ridge",
        "Official Website": "https://mapleridgefirst.ca",
        "Contact Email": "info@mapleridgefirst.ca",
        "Key Figures": "Judy Dueck",
        "Active Elected Reps": "1 Councillor",
        "Notes": "Civic party in Maple Ridge."
    }
]

with open("scripts/bc-civic-parties-contacts.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=[
        "Party Name", "City", "Official Website", "Contact Email", 
        "Key Figures", "Active Elected Reps", "Notes"
    ])
    writer.writeheader()
    for row in civic_parties_data:
        writer.writerow(row)

print(f"Exported {len(civic_parties_data)} BC Civic Parties to scripts/bc-civic-parties-contacts.csv")
