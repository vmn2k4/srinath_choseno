/**
 * Helper to fetch elected officials by municipality name OR by politician name from Supabase
 *
 * Usage:
 *   # By Municipality:
 *   node .agents/councillor-agent/scripts/fetch-municipality-officials.js --city "Surrey"
 *   node .agents/councillor-agent/scripts/fetch-municipality-officials.js --city "Vancouver"
 *
 *   # By Politician Name:
 *   node .agents/councillor-agent/scripts/fetch-municipality-officials.js --name "Brenda Locke"
 *   node .agents/councillor-agent/scripts/fetch-municipality-officials.js --name "David Eby"
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found at', envPath);
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const args = process.argv.slice(2);
let city = null;
let name = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--city' && args[i + 1]) {
    city = args[++i];
  } else if (args[i] === '--name' && args[i + 1]) {
    name = args[++i];
  } else if (!args[i].startsWith('--')) {
    if (!city && !name) {
      city = args[i]; // default fallback to city or name
    }
  }
}

if (!city && !name) {
  console.error('Please specify a query: node fetch-municipality-officials.js --city "City Name" OR --name "Politician Name"');
  process.exit(1);
}

async function run() {
  let url = '';
  if (name) {
    url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,full_name,designation,constituency,role&role=eq.politician&full_name.ilike.*${encodeURIComponent(name)}*&limit=20`;
  } else {
    url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,full_name,designation,constituency,role&role=eq.politician&or=(constituency.ilike.*${encodeURIComponent(city)}*,designation.ilike.*${encodeURIComponent(city)}*)&limit=100`;
  }
  
  const res = await fetch(url, {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch officials:', await res.text());
    process.exit(1);
  }

  const officials = await res.json();
  console.log(JSON.stringify({
    queryType: name ? 'politician' : 'municipality',
    queryValue: name || city,
    count: officials.length,
    officials
  }, null, 2));
}

run().catch(console.error);
