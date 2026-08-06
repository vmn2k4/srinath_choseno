const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const url = "https://qlzyfdwrkcxyqapewxwg.supabase.co/rest/v1/";
const key = "sb_publishable_m7I392hi0eurPIRFrr6IZQ_VOQa7EzK";
const headers = { apikey: key, Authorization: "Bearer " + key };

function cleanString(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const fipsToState = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
  "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS",
  "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY",
  "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
  "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY", "72": "PR", "11": "DC"
};

// Map raw party names to database party names
function mapParty(partyName, country) {
  if (!partyName) return country === 'Canada' ? 'Independent' : 'Independent';
  const p = partyName.toLowerCase();
  if (country === 'Canada') {
    if (p.includes('liberal')) return 'Liberal Party';
    if (p.includes('conservative')) return 'Conservative Party';
    if (p.includes('ndp') || p.includes('new democratic')) return 'New Democratic Party (NDP)';
    if (p.includes('bloc')) return 'Bloc Québécois';
    if (p.includes('green')) return 'Green Party';
    if (p.includes('people')) return "People's Party of Canada";
    return 'Independent';
  } else {
    if (p.includes('democrat') || p.includes('democrat')) return 'Democratic Party';
    if (p.includes('republican') || p.includes('gop')) return 'Republican Party';
    if (p.includes('libertarian')) return 'Libertarian Party';
    if (p.includes('green')) return 'Green Party';
    return 'Independent';
  }
}

// 50 US Governors Data
const US_GOVERNORS = [
  { state: "AL", name: "Kay Ivey", party: "Republican Party", url: "https://governor.alabama.gov" },
  { state: "AK", name: "Mike Dunleavy", party: "Republican Party", url: "https://gov.alaska.gov" },
  { state: "AZ", name: "Katie Hobbs", party: "Democratic Party", url: "https://azgovernor.gov" },
  { state: "AR", name: "Sarah Huckabee Sanders", party: "Republican Party", url: "https://governor.arkansas.gov" },
  { state: "CA", name: "Gavin Newsom", party: "Democratic Party", url: "https://www.gov.ca.gov" },
  { state: "CO", name: "Jared Polis", party: "Democratic Party", url: "https://www.colorado.gov/governor" },
  { state: "CT", name: "Ned Lamont", party: "Democratic Party", url: "https://portal.ct.gov/office-of-the-governor" },
  { state: "DE", name: "Matt Meyer", party: "Democratic Party", url: "https://governor.delaware.gov" },
  { state: "FL", name: "Ron DeSantis", party: "Republican Party", url: "https://www.flgov.com" },
  { state: "GA", name: "Brian Kemp", party: "Republican Party", url: "https://gov.georgia.gov" },
  { state: "HI", name: "Josh Green", party: "Democratic Party", url: "https://governor.hawaii.gov" },
  { state: "ID", name: "Brad Little", party: "Republican Party", url: "https://gov.idaho.gov" },
  { state: "IL", name: "JB Pritzker", party: "Democratic Party", url: "https://gov.illinois.gov" },
  { state: "IN", name: "Mike Braun", party: "Republican Party", url: "https://www.in.gov/gov" },
  { state: "IA", name: "Kim Reynolds", party: "Republican Party", url: "https://governor.iowa.gov" },
  { state: "KS", name: "Laura Kelly", party: "Democratic Party", url: "https://governor.kansas.gov" },
  { state: "KY", name: "Andy Beshear", party: "Democratic Party", url: "https://governor.ky.gov" },
  { state: "LA", name: "Jeff Landry", party: "Republican Party", url: "https://gov.louisiana.gov" },
  { state: "ME", name: "Janet Mills", party: "Democratic Party", url: "https://www.maine.gov/governor" },
  { state: "MD", name: "Wes Moore", party: "Democratic Party", url: "https://governor.maryland.gov" },
  { state: "MA", name: "Maura Healey", party: "Democratic Party", url: "https://www.mass.gov/orgs/office-of-the-governor" },
  { state: "MI", name: "Gretchen Whitmer", party: "Democratic Party", url: "https://www.michigan.gov/whitmer" },
  { state: "MN", name: "Tim Walz", party: "Democratic Party", url: "https://mn.gov/governor" },
  { state: "MS", name: "Tate Reeves", party: "Republican Party", url: "https://governorreeves.ms.gov" },
  { state: "MO", name: "Mike Kehoe", party: "Republican Party", url: "https://governor.mo.gov" },
  { state: "MT", name: "Greg Gianforte", party: "Republican Party", url: "https://governor.mt.gov" },
  { state: "NE", name: "Jim Pillen", party: "Republican Party", url: "https://governor.nebraska.gov" },
  { state: "NV", name: "Joe Lombardo", party: "Republican Party", url: "https://gov.nv.gov" },
  { state: "NH", name: "Kelly Ayotte", party: "Republican Party", url: "https://www.governor.nh.gov" },
  { state: "NJ", name: "Phil Murphy", party: "Democratic Party", url: "https://nj.gov/governor" },
  { state: "NM", name: "Michelle Lujan Grisham", party: "Democratic Party", url: "https://www.governor.state.nm.us" },
  { state: "NY", name: "Kathy Hochul", party: "Democratic Party", url: "https://www.governor.ny.gov" },
  { state: "NC", name: "Josh Stein", party: "Democratic Party", url: "https://governor.nc.gov" },
  { state: "ND", name: "Kelly Armstrong", party: "Republican Party", url: "https://www.governor.nd.gov" },
  { state: "OH", name: "Mike DeWine", party: "Republican Party", url: "https://governor.ohio.gov" },
  { state: "OK", name: "Kevin Stitt", party: "Republican Party", url: "https://oklahoma.gov/governor.html" },
  { state: "OR", name: "Tina Kotek", party: "Democratic Party", url: "https://www.oregon.gov/gov" },
  { state: "PA", name: "Josh Shapiro", party: "Democratic Party", url: "https://www.governor.pa.gov" },
  { state: "RI", name: "Dan McKee", party: "Democratic Party", url: "https://governor.ri.gov" },
  { state: "SC", name: "Henry McMaster", party: "Republican Party", url: "https://governor.sc.gov" },
  { state: "SD", name: "Kristi Noem", party: "Republican Party", url: "https://governor.sd.gov" },
  { state: "TN", name: "Bill Lee", party: "Republican Party", url: "https://www.tn.gov/governor.html" },
  { state: "TX", name: "Greg Abbott", party: "Republican Party", url: "https://gov.texas.gov" },
  { state: "UT", name: "Spencer Cox", party: "Republican Party", url: "https://governor.utah.gov" },
  { state: "VT", name: "Phil Scott", party: "Republican Party", url: "https://governor.vermont.gov" },
  { state: "VA", name: "Glenn Youngkin", party: "Republican Party", url: "https://www.governor.virginia.gov" },
  { state: "WA", name: "Bob Ferguson", party: "Democratic Party", url: "https://governor.wa.gov" },
  { state: "WV", name: "Patrick Morrisey", party: "Republican Party", url: "https://governor.wv.gov" },
  { state: "WI", name: "Tony Evers", party: "Democratic Party", url: "https://evers.wi.gov" },
  { state: "WY", name: "Mark Gordon", party: "Republican Party", url: "https://governor.wyo.gov" }
];

async function main() {
  console.log("🚀 Gathering Office Holder Data for Canada & USA...");

  const headers = { apikey: key, Authorization: "Bearer " + key };

  // Fetch DB shapes
  async function getAllShapes(country, boundaryType) {
    let all = [];
    let page = 0;
    while (true) {
      const res = await fetch(`${url}map_shapes?select=id,name,code,properties&country=eq.${encodeURIComponent(country)}&boundary_type=eq.${encodeURIComponent(boundaryType)}&offset=${page * 1000}&limit=1000`, { headers }).then(r => r.json());
      if (!res || res.length === 0) break;
      all = all.concat(res);
      if (res.length < 1000) break;
      page++;
    }
    return all;
  }

  const canFedShapes = await getAllShapes("Canada", "Federal");
  const canProvShapes = await getAllShapes("Canada", "Provincial");
  const usStateShapes = await getAllShapes("USA", "State");
  const usFedShapes = await getAllShapes("USA", "Federal");

  console.log(`Loaded DB shapes: Canada Fed=${canFedShapes.length}, Canada Prov=${canProvShapes.length}, US State=${usStateShapes.length}, US Fed=${usFedShapes.length}`);

  const canFedMap = new Map();
  canFedShapes.forEach(s => canFedMap.set(cleanString(s.name), s));

  const canProvMap = new Map();
  canProvShapes.forEach(s => canProvMap.set(cleanString(s.name), s));

  const usStateMap = new Map();
  usStateShapes.forEach(s => usStateMap.set((s.code || s.name).toUpperCase(), s));

  const usFedMap = new Map();
  usFedShapes.forEach(s => {
    let codeStr = String(s.code || "").padStart(4, "0");
    let stateFips = codeStr.substring(0, 2);
    let distNum = parseInt(codeStr.substring(2), 10);
    let stAbbr = fipsToState[stateFips];
    if (stAbbr) {
      usFedMap.set(`${stAbbr}-${distNum}`, s);
    }
  });

  const records = [];

  // 1. Canadian Federal MPs
  console.log("Fetching Canadian Federal MPs...");
  let mps = [];
  let nextUrl = "https://represent.opennorth.ca/representatives/house-of-commons/?limit=500";
  while (nextUrl) {
    const res = await fetch(nextUrl).then(r => r.json()).catch(() => null);
    if (!res || !res.objects) break;
    mps = mps.concat(res.objects);
    nextUrl = res.meta?.next ? "https://represent.opennorth.ca" + res.meta.next : null;
  }

  for (const mp of mps) {
    const shape = canFedMap.get(cleanString(mp.district_name));
    if (shape) {
      const office = mp.offices && mp.offices[0] ? mp.offices[0] : {};
      records.push({
        map_shape_id: shape.id,
        role_title: "MP",
        full_name: mp.name,
        political_party: mapParty(mp.party_name, "Canada"),
        bio: `Member of Parliament for ${mp.district_name}`,
        contact_email: mp.email || "",
        contact_phone: office.tel || "",
        source_url: mp.url || mp.source_url || "",
        photo_url: mp.photo_url || ""
      });
    }
  }

  // 2. Canadian Provincial MLAs
  console.log("Fetching Canadian Provincial MLAs...");
  const provEndpoints = [
    { slug: "bc-legislature", role: "MLA" },
    { slug: "ontario-legislature", role: "MPP" },
    { slug: "alberta-legislature", role: "MLA" },
    { slug: "manitoba-legislature", role: "MLA" },
    { slug: "pei-legislature", role: "MLA" },
    { slug: "yukon-legislature", role: "MLA" },
    { slug: "northwest-territories-legislature", role: "MLA" },
    { slug: "nova-scotia-legislature", role: "MLA" },
    { slug: "newfoundland-labrador-legislature", role: "MHA" },
    { slug: "saskatchewan-legislature", role: "MLA" },
    { slug: "new-brunswick-legislature", role: "MLA" }
  ];

  for (const ep of provEndpoints) {
    let mlas = [];
    let urlEp = `https://represent.opennorth.ca/representatives/${ep.slug}/?limit=500`;
    while (urlEp) {
      const res = await fetch(urlEp).then(r => r.json()).catch(() => null);
      if (!res || !res.objects) break;
      mlas = mlas.concat(res.objects);
      urlEp = res.meta?.next ? "https://represent.opennorth.ca" + res.meta.next : null;
    }

    for (const m of mlas) {
      const shape = canProvMap.get(cleanString(m.district_name));
      if (shape) {
        const office = m.offices && m.offices[0] ? m.offices[0] : {};
        records.push({
          map_shape_id: shape.id,
          role_title: ep.role,
          full_name: m.name,
          political_party: mapParty(m.party_name, "Canada"),
          bio: `${ep.role} for ${m.district_name}`,
          contact_email: m.email || "",
          contact_phone: office.tel || "",
          source_url: m.url || m.source_url || "",
          photo_url: m.photo_url || ""
        });
      }
    }
  }

  // 3. US Governors
  console.log("Processing US Governors...");
  for (const gov of US_GOVERNORS) {
    const shape = usStateMap.get(gov.state);
    if (shape) {
      records.push({
        map_shape_id: shape.id,
        role_title: "Governor",
        full_name: gov.name,
        political_party: gov.party,
        bio: `Governor of ${shape.name}`,
        contact_email: "",
        contact_phone: "",
        source_url: gov.url,
        photo_url: ""
      });
    }
  }

  // 4. US Senators & US Representatives
  console.log("Fetching US Congress dataset...");
  const legislators = await fetch("https://unitedstates.github.io/congress-legislators/legislators-current.json").then(r => r.json()).catch(() => []);

  for (const leg of legislators) {
    const lastTerm = leg.terms[leg.terms.length - 1];
    const fullName = leg.name.official_full || `${leg.name.first} ${leg.name.last}`;
    const party = mapParty(lastTerm.party, "USA");

    if (lastTerm.type === "sen") {
      const shape = usStateMap.get(lastTerm.state);
      if (shape) {
        records.push({
          map_shape_id: shape.id,
          role_title: "U.S. Senator",
          full_name: fullName,
          political_party: party,
          bio: `U.S. Senator representing ${shape.name}`,
          contact_email: lastTerm.contact_form || "",
          contact_phone: lastTerm.phone || "",
          term_start: lastTerm.start || "",
          term_end: lastTerm.end || "",
          source_url: lastTerm.url || "",
          photo_url: ""
        });
      }
    } else if (lastTerm.type === "rep") {
      const distNum = lastTerm.district || 0;
      const shape = usFedMap.get(`${lastTerm.state}-${distNum}`);
      if (shape) {
        records.push({
          map_shape_id: shape.id,
          role_title: "U.S. Representative",
          full_name: fullName,
          political_party: party,
          bio: `U.S. Representative for ${lastTerm.state} Congressional District ${distNum}`,
          contact_email: lastTerm.contact_form || "",
          contact_phone: lastTerm.phone || "",
          term_start: lastTerm.start || "",
          term_end: lastTerm.end || "",
          source_url: lastTerm.url || "",
          photo_url: ""
        });
      }
    }
  }

  console.log(`\n🎉 Total Office Holder records compiled: ${records.length}`);

  // CSV Output
  const csvPath = path.join(__dirname, "office-holders-data.csv");
  const csvHeaders = ["map_shape_id", "role_title", "full_name", "political_party", "bio", "contact_email", "contact_phone", "term_start", "term_end", "source_url", "photo_url"];

  function escapeCsv(val) {
    if (val === null || val === undefined) return "";
    let str = String(val).replace(/"/g, '""');
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  }

  const csvRows = [csvHeaders.join(",")];
  records.forEach(r => {
    const row = csvHeaders.map(h => escapeCsv(r[h] || ""));
    csvRows.push(row.join(","));
  });

  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf8");
  console.log(`Saved ${records.length} records to CSV: ${csvPath}`);
}

main().catch(console.error);
