const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MISSING_LEADERS = [
  {
    full_name: "JD Vance",
    role: "politician",
    country: "USA",
    designation: "Vice President of the United States",
    constituency: "Federal",
    party: "Republican Party"
  },
  {
    full_name: "Abigail Spanberger",
    role: "politician",
    country: "USA",
    designation: "Governor of Virginia",
    constituency: "Virginia",
    party: "Democratic Party"
  },
  {
    full_name: "Mikie Sherrill",
    role: "politician",
    country: "USA",
    designation: "Governor of New Jersey",
    constituency: "New Jersey",
    party: "Democratic Party"
  },
  {
    full_name: "Zohran Mamdani",
    role: "politician",
    country: "USA",
    designation: "Mayor of New York City",
    constituency: "New York City",
    party: "Democratic Party"
  },
  {
    full_name: "Scott Bessent",
    role: "politician",
    country: "USA",
    designation: "U.S. Secretary of the Treasury",
    constituency: "Federal",
    party: "Republican Party"
  },
  {
    full_name: "John Curtis",
    role: "politician",
    country: "USA",
    designation: "U.S. Senator",
    constituency: "Utah",
    party: "Republican Party"
  },
  {
    full_name: "Dan Driscoll",
    role: "politician",
    country: "USA",
    designation: "Secretary of the Army",
    constituency: "Federal",
    party: "Republican Party"
  },
  {
    full_name: "Jeff Leal",
    role: "politician",
    country: "Canada",
    designation: "Mayor of Peterborough",
    constituency: "Peterborough, Ontario",
    party: "Independent"
  },
  {
    full_name: "Joe Wilson",
    role: "politician",
    country: "USA",
    designation: "Mayor of Seattle",
    constituency: "Seattle, Washington",
    party: "Independent"
  }
];

async function main() {
  console.log('1. Authenticating with Supabase...');
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: env.admin_un,
      password: env.admin_pwd
    })
  });
  const authData = await authRes.json();
  const token = authData.access_token;
  const authHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  console.log('2. Ensuring all prominent national/state leaders exist in profiles...');
  for (const leader of MISSING_LEADERS) {
    // Check if profile exists
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?full_name=eq.${encodeURIComponent(leader.full_name)}&limit=1`, {
      headers: authHeaders
    });
    const rows = await checkRes.json();
    if (rows && rows.length > 0) {
      console.log(`- Profile already exists: ${leader.full_name} (${rows[0].id})`);
      continue;
    }

    // Insert new profile
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        full_name: leader.full_name,
        role: 'politician',
        country: leader.country,
        designation: leader.designation,
        constituency: leader.constituency
      })
    });
    if (insertRes.ok) {
      const [created] = await insertRes.json();
      console.log(`✅ Created profile: ${leader.full_name} -> ID: ${created.id}`);

      // Create politician_profiles entry
      const wallSlug = leader.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await fetch(`${SUPABASE_URL}/rest/v1/politician_profiles`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          id: created.id,
          wall_slug: wallSlug,
          political_target_role: leader.designation,
          party: leader.party
        })
      });
    } else {
      console.warn(`Failed to insert profile for ${leader.full_name}:`, await insertRes.text());
    }
  }

  console.log('\n3. Re-running comprehensive audit to link remaining articles...');
  const { execSync } = require('child_process');
  execSync('node scripts/comprehensive-leader-audit.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
}

main().catch(console.error);
