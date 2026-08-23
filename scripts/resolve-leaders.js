const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function check() {
  const leaders = [
    'Mark Carney', 'Danielle Smith', 'David Eby', 'Doug Ford', 'Wab Kinew',
    'François Legault', 'Tim Houston', 'Gavin Newsom', 'Ron DeSantis',
    'Greg Abbott', 'JB Pritzker', 'Josh Shapiro', 'Gretchen Whitmer',
    'Spencer Cox', 'Mike Johnson', 'Hakeem Jeffries', 'John Thune',
    'Mélanie Joly', 'Dominic LeBlanc', 'Pierre Poilievre', 'Elizabeth May', 'Yves-François Blanchet'
  ];
  const results = {};
  for (const name of leaders) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,full_name&role=eq.politician&full_name=ilike.%25${encodeURIComponent(name)}%25&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      results[name] = data[0] ? data[0].id : null;
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

check();
