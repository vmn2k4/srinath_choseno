/**
 * scripts/seed-missing-politicians.js
 *
 * Seeds missing prominent political figures into Supabase profiles and
 * politician_profiles so they can be tagged in news articles and have walls.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const POLITICIANS_TO_SEED = [
  {
    full_name: 'Alex Padilla',
    designation: 'U.S. Senator',
    constituency: 'California',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'California',
    bio: 'Alex Padilla is the senior United States Senator from California, serving since 2021.',
    wall_slug: 'alex-padilla'
  },
  {
    full_name: 'Mikie Sherrill',
    designation: 'Governor',
    constituency: 'New Jersey',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'New Jersey',
    bio: 'Mikie Sherrill is the Governor of New Jersey and former U.S. Representative.',
    wall_slug: 'mikie-sherrill'
  },
  {
    full_name: 'Xavier Becerra',
    designation: 'Gubernatorial Candidate',
    constituency: 'California',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'California',
    bio: 'Xavier Becerra is a candidate for Governor of California and former U.S. Secretary of Health and Human Services.',
    wall_slug: 'xavier-becerra'
  },
  {
    full_name: 'Steve Hilton',
    designation: 'Gubernatorial Candidate',
    constituency: 'California',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'California',
    bio: 'Steve Hilton is a political commentator and candidate for Governor of California.',
    wall_slug: 'steve-hilton'
  },
  {
    full_name: 'Dale Caldwell',
    designation: 'Lieutenant Governor',
    constituency: 'New Jersey',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'New Jersey',
    bio: 'Dale Caldwell is the Lieutenant Governor of New Jersey.',
    wall_slug: 'dale-caldwell'
  },
  {
    full_name: 'Keisha Lance Bottoms',
    designation: 'Gubernatorial Candidate',
    constituency: 'Georgia',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'Georgia',
    bio: 'Keisha Lance Bottoms is a candidate for Governor of Georgia and former Mayor of Atlanta.',
    wall_slug: 'keisha-lance-bottoms'
  },
  {
    full_name: 'David Jolly',
    designation: 'Gubernatorial Candidate',
    constituency: 'Florida',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'Florida',
    bio: 'David Jolly is a political commentator, candidate for Governor of Florida, and former U.S. Representative.',
    wall_slug: 'david-jolly'
  },
  {
    full_name: 'Helena Foulkes',
    designation: 'Gubernatorial Candidate',
    constituency: 'Rhode Island',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'Rhode Island',
    bio: 'Helena Foulkes is a candidate for Governor of Rhode Island and former retail healthcare executive.',
    wall_slug: 'helena-foulkes'
  },
  {
    full_name: 'Sabina Matos',
    designation: 'Lieutenant Governor',
    constituency: 'Rhode Island',
    country: 'US',
    target_boundary_type: 'state',
    target_boundary_name: 'Rhode Island',
    bio: 'Sabina Matos is the Lieutenant Governor of Rhode Island.',
    wall_slug: 'sabina-matos'
  }
];

async function seed() {
  console.log('Checking and seeding missing politicians in Supabase...');

  for (const pol of POLITICIANS_TO_SEED) {
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,full_name&full_name=eq.${encodeURIComponent(pol.full_name)}&limit=1`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
    });

    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      console.log(`[EXISTS] ${pol.full_name} (${existing[0].id})`);
      continue;
    }

    const profileId = crypto.randomUUID();
    const ghostId = crypto.randomUUID();

    const insertProfRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: profileId,
        role: 'politician',
        full_name: pol.full_name,
        country: pol.country,
        constituency: pol.constituency,
        designation: pol.designation,
        current_ghost_id: ghostId,
        updated_at: new Date().toISOString()
      })
    });

    if (!insertProfRes.ok) {
      console.error(`Failed to insert profile for ${pol.full_name}:`, await insertProfRes.text());
      continue;
    }

    const insertPolRes = await fetch(`${SUPABASE_URL}/rest/v1/politician_profiles`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: profileId,
        political_target_role: pol.designation,
        target_boundary_type: pol.target_boundary_type,
        target_boundary_name: pol.target_boundary_name,
        bio: pol.bio,
        wall_slug: pol.wall_slug,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    if (!insertPolRes.ok) {
      console.warn(`Profile created for ${pol.full_name}, but politician_profiles failed:`, await insertPolRes.text());
    } else {
      console.log(`[SEEDED] ${pol.full_name} (${profileId}) -> wall: ${pol.wall_slug}`);
    }
  }

  // Invalidate cached politician profiles file so insert-news-batch.js reloads fresh
  const cachePath = path.join(__dirname, 'cached-politician-profiles.json');
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    console.log('Invalidated cached-politician-profiles.json');
  }

  console.log('Seeding complete.');
}

seed().catch(console.error);
