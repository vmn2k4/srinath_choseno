const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
    return env;
  }
  return process.env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getAuthHeaders() {
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    };
  }

  if (env.admin_un && env.admin_pwd) {
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
    if (authRes.ok) {
      const authData = await authRes.json();
      return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authData.access_token}`
      };
    }
  }

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };
}

// Map of known viral scores from our recent batch
const KNOWN_SCORES = {
  "white-house-pauses-canadian-tariffs-72-hours-bilateral-talks-2026-08-19": 9.9,
  "byron-donalds-captures-florida-republican-gubernatorial-primary-2026-08-19": 9.8,
  "david-jolly-claims-florida-democratic-gubernatorial-nomination-2026-08-19": 9.8,
  "angie-nixon-pulls-off-primary-upset-florida-senate-contest-2026-08-19": 9.8,
  "ashley-moody-clinches-florida-republican-senate-special-primary-2026-08-19": 9.7,
  "ryan-elijah-unseats-cory-mills-florida-7th-district-gop-primary-2026-08-19": 9.7,
  "northwest-florida-primary-selects-jimmy-patronis-1st-district-2026-08-19": 9.6,
  "leela-gray-wins-florida-13th-district-democratic-primary-2026-08-19": 9.6,
  "maria-elvira-salazar-defeats-primary-challenger-florida-27th-district-2026-08-19": 9.5,
  "kissimmee-republican-primary-selects-dan-green-9th-district-2026-08-19": 9.5,
  "florida-state-rep-mike-caruso-arrested-child-exploitation-charges-2026-08-19": 9.4,
  "usda-proposes-repealing-2001-roadless-rule-45m-acres-national-forests-2026-08-19": 9.3,
  "us-treasury-sanctions-icc-president-tomoko-akane-executive-order-14203-2026-08-19": 9.3,
  "senate-finance-wyden-demands-records-base-group-payment-2026-08-19": 9.3,
  "pentagon-seoul-halve-joint-military-drills-diplomatic-talks-2026-08-19": 9.2,
  "global-bond-selloff-lifts-canadian-borrowing-costs-17-year-peak-2026-08-19": 9.2,
  "leblanc-concludes-washington-engagements-cusma-tariff-exemptions-2026-08-19": 9.1,
  "federal-court-vacates-injunction-ethiopian-tps-rescission-2026-08-19": 9.1,
  "federal-court-overturns-19-mile-izembek-refuge-road-swap-2026-08-19": 9.0,
  "maryland-federal-court-permits-birthright-citizenship-class-action-2026-08-19": 9.0,
  "federal-court-canada-rejects-volga-dnepr-appeal-grounding-cargo-jet-2026-08-19": 8.9,
  "crtc-temporarily-suspends-wireless-handset-unlock-mandate-2026-08-19": 8.8,
  "ontario-civil-liberties-groups-mount-charter-challenge-cash-bail-2026-08-19": 8.8,
  "saskatchewan-opposition-presses-ministers-20th-street-crisis-2026-08-19": 8.8,
  "federal-court-dissolves-injunction-rhode-island-cannabis-licensing-2026-08-19": 8.7,
  "federal-judge-authorizes-exterior-paint-testing-eisenhower-building-2026-08-19": 8.7,
  "oakland-federal-court-opens-landmark-youth-social-media-trial-meta-2026-08-19": 8.6,
  "san-diego-county-supervisors-prohibit-ice-firearms-training-facilities-2026-08-19": 8.6,
  "palo-alto-city-council-endorses-8-story-housing-san-antonio-road-2026-08-19": 8.5,
  "san-antonio-city-council-rebuffs-ballot-referendum-489m-spurs-arena-2026-08-19": 8.4,
  "memphis-city-council-enacts-moratorium-industrial-data-centers-2026-08-19": 8.4,
  "oklahoma-city-council-formalizes-28m-maps4-park-modernizations-2026-08-19": 8.3,
  "santa-barbara-supervisors-greenlight-commercial-rezoning-santa-ynez-2026-08-19": 8.3,
  "mills-county-supervisors-submit-five-member-board-expansion-ballot-2026-08-19": 8.3,
  "timmins-city-council-institutes-transit-pilot-ontario-northland-rail-2026-08-19": 8.2,
  "edmonton-city-council-commissions-infill-housing-property-value-study-2026-08-19": 8.2,
  "calgary-police-clears-91-warrants-citywide-targeted-enforcement-2026-08-19": 8.1,
  "alaska-nonpartisan-primary-advances-top-four-us-house-candidates-2026-08-19": 8.1,
  "wyoming-gop-primary-nominates-hageman-barrasso-cheyenne-2026-08-19": 8.0,
  "chinese-humanoid-robotics-maker-unitree-surges-market-debut-2026-08-19": 8.0,
  "sfmta-authorizes-42m-powell-street-transit-pedestrian-modernization-2026-08-19": 7.9,
  "la-county-supervisors-approve-16m-antelope-valley-flood-channel-hardening-2026-08-19": 7.8,
  "orange-county-supervisors-fund-18m-juvenile-mental-health-facility-2026-08-19": 7.8,
  "phoenix-city-council-mandates-heat-safety-standards-construction-2026-08-19": 7.8,
  "clark-county-commissioners-grant-35m-las-vegas-medical-corridor-2026-08-19": 7.7,
  "king-county-council-allocates-24m-rapidride-affordable-housing-2026-08-19": 7.7,
  "chicago-city-council-clears-45m-affordable-coop-conversion-fund-2026-08-19": 7.6,
  "harris-county-approves-52m-baytown-storm-surge-levee-reconstruction-2026-08-19": 7.6,
  "dallas-county-institutes-commercial-tax-abatement-clean-tech-2026-08-19": 7.5,
  "miami-dade-commission-adopts-biscayne-bay-stormwater-buffer-protections-2026-08-19": 7.5,
  "toronto-infrastructure-committee-endorses-65m-eglinton-east-watermain-2026-08-19": 7.4,
  "metro-vancouver-board-ratifies-110m-coquitlam-water-filtration-expansion-2026-08-19": 7.3,
  "montreal-executive-committee-designates-22m-ville-marie-green-promenade-2026-08-19": 7.3,
  "ottawa-transportation-committee-approves-15m-baseline-road-rapidbus-lanes-2026-08-19": 7.3,
  "bc-transportation-ministry-awards-85m-fraser-river-rail-bridge-contract-2026-08-19": 7.2,
};

async function backfill() {
  const authHeaders = await getAuthHeaders();
  const headers = {
    apikey: authHeaders.apikey,
    Authorization: authHeaders.Authorization,
    'Content-Type': 'application/json',
  };

  console.log('Fetching all published news articles...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,slug,published_at,created_at,content&limit=1000`, { headers });
  const articles = await res.json();

  console.log(`Found ${articles.length} articles to inspect/update.`);

  // Sort articles by created_at descending to cluster by ingestion run
  articles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 15-minute clustering threshold
  const GAP_MS = 15 * 60 * 1000;
  const clusters = [];
  let currentCluster = null;

  for (const art of articles) {
    const cTime = new Date(art.created_at).getTime();
    if (!currentCluster || (currentCluster.lastTime - cTime > GAP_MS)) {
      // Start a new cluster
      // Anchor name is based on the first article's published_at or created_at (e.g. YYYY-MM-DD HH:mm)
      const anchorDate = art.published_at || art.created_at;
      const batchName = `${anchorDate.slice(0, 10)} ${anchorDate.slice(11, 16)}`;
      currentCluster = {
        batchName,
        lastTime: cTime,
        articles: [art]
      };
      clusters.push(currentCluster);
    } else {
      currentCluster.articles.push(art);
      currentCluster.lastTime = cTime;
    }
  }

  console.log(`Grouped into ${clusters.length} distinct batches:`);
  clusters.forEach((c, idx) => {
    console.log(`  Batch ${idx + 1}: "${c.batchName}" (${c.articles.length} stories)`);
  });

  let updated = 0;
  for (const cluster of clusters) {
    for (const art of cluster.articles) {
      const content = art.content || {};
      let needsUpdate = false;

      // Assign the clustered batch name to all articles in the cluster!
      if (content.batch_number !== cluster.batchName) {
        content.batch_number = cluster.batchName;
        needsUpdate = true;
      }

      // Check viral_score
      if (typeof content.viral_score !== 'number') {
        if (KNOWN_SCORES[art.slug]) {
          content.viral_score = KNOWN_SCORES[art.slug];
        } else if (content.breakingNews) {
          content.viral_score = 9.5;
        } else {
          content.viral_score = 8.0;
        }
        needsUpdate = true;
      }

      // Check shared_platforms
      if (!Array.isArray(content.shared_platforms)) {
        content.shared_platforms = [];
        needsUpdate = true;
      }

      if (needsUpdate) {
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ content }),
        });
        if (patchRes.ok) {
          updated++;
        } else {
          console.error(`Failed to update ${art.slug}:`, await patchRes.text());
        }
      }
    }
  }

  console.log(`✅ Cluster backfill complete. Updated ${updated} articles across ${clusters.length} batches.`);
}

backfill().catch(console.error);
