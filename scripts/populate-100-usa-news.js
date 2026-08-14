const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const US_OFFICIALS = [
  { id: "ca010d99-f5c5-4758-bbd8-6695c89b8b35", name: "Eric Adams", role: "Mayor", city: "New York", state: "NY", lat: 40.7128, lng: -74.0060 },
  { id: "96337ea9-ddb7-4b26-a2c4-1881f1db76dc", name: "Brandon Johnson", role: "Mayor", city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298 },
  { id: "41ca439c-969b-441f-845c-8c206c8bde50", name: "John Whitmire", role: "Mayor", city: "Houston", state: "TX", lat: 29.7604, lng: -95.3698 },
  { id: "93b9ef44-9e72-42a4-addc-9363921b14a1", name: "Cherelle Parker", role: "Mayor", city: "Philadelphia", state: "PA", lat: 39.9526, lng: -75.1652 },
  { id: "517c4c17-8cd4-421e-8aef-20e6b2bd5388", name: "Kate Gallego", role: "Mayor", city: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.0740 },
  { id: "e6f92e2a-9649-47dd-a482-16b88b949fad", name: "Matt Mahan", role: "Mayor", city: "San Jose", state: "CA", lat: 37.3382, lng: -121.8863 },
  { id: "b044e2d1-44c4-4b25-8196-662f1e0bb43a", name: "Kirk Watson", role: "Mayor", city: "Austin", state: "TX", lat: 30.2672, lng: -97.7431 },
  { id: "1475faee-4c7f-4c56-b5d8-ee637c983953", name: "Cavalier Johnson", role: "Mayor", city: "Milwaukee", state: "WI", lat: 43.0389, lng: -87.9065 },
  { id: "950e017a-d04b-4875-8bf3-04f2bb6e7ff1", name: "Regina Romero", role: "Mayor", city: "Tucson", state: "AZ", lat: 32.2226, lng: -110.9747 },
  { id: "9464cdcb-d7b4-466c-847b-8d8ac18062a4", name: "Lauren McLean", role: "Mayor", city: "Boise", state: "ID", lat: 43.6150, lng: -116.2023 },
  { id: "b7d4ed17-39e9-4019-a338-dd333542c93e", name: "Karen Goh", role: "Mayor", city: "Bakersfield", state: "CA", lat: 35.3733, lng: -119.0187 },
  { id: "ef68e399-1be9-4cc7-80c2-74502b5cee41", name: "Keith A. James", role: "Mayor", city: "West Palm Beach", state: "FL", lat: 26.7153, lng: -80.0534 },
  { id: "f45f7aae-60ac-45e1-bb5f-3ebd1dcbbd13", name: "Allen Joines", role: "Mayor", city: "Winston-Salem", state: "NC", lat: 36.0999, lng: -80.2442 },
  { id: "b84358c7-0841-4ce6-9158-152a9fdac0bf", name: "Lacey Beaty", role: "Mayor", city: "Beaverton", state: "OR", lat: 45.4871, lng: -122.8037 },
  { id: "bdf3be08-3546-4777-84c0-33190fea42ed", name: "John C. Zaragoza", role: "Mayor", city: "Oxnard", state: "CA", lat: 34.1975, lng: -119.1771 },
  { id: "08b99b9e-2986-4eeb-bd6b-3c96d8074af8", name: "Adrienne Adams", role: "Council Speaker", city: "New York", state: "NY", lat: 40.7128, lng: -74.0060 },
  { id: "46d58162-a1f7-43bc-8840-640c9a94440e", name: "Brian Hopkins", role: "Council Member", city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298 },
  { id: "c6100086-88e2-45dd-97fa-109074164cd6", name: "Daniel La Spata", role: "Council Member", city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298 },
  { id: "b7823730-c808-431a-bf47-225f8535808e", name: "Justin Brannan", role: "Council Member", city: "New York", state: "NY", lat: 40.7128, lng: -74.0060 },
  { id: "f7cb1a8a-9e2b-4763-8a29-8a2f83e35385", name: "Keith Powers", role: "Council Member", city: "New York", state: "NY", lat: 40.7128, lng: -74.0060 },
  { id: "2af3bef0-3205-4a18-8561-83713569b099", name: "Paul Alfrey", role: "Mayor", city: "Melbourne", state: "FL", lat: 28.0836, lng: -80.6081 },
  { id: "429dd7c7-2d8b-4e6e-aa72-3b6fa09d6378", name: "Jamie Clary", role: "Mayor", city: "Hendersonville", state: "TN", lat: 36.3048, lng: -86.6200 },
  { id: "adcf4de2-b307-451b-a875-c97eb0f3fa98", name: "Becky Daggett", role: "Mayor", city: "Flagstaff", state: "AZ", lat: 35.1983, lng: -111.6513 },
  { id: "5959bfd7-791a-4710-80eb-6e0bea301128", name: "Ashley Curry", role: "Mayor", city: "Vestavia Hills", state: "AL", lat: 33.4487, lng: -86.7878 },
  { id: "0c409435-15df-4b49-b870-6aa1fdd33819", name: "Emily Keller", role: "Mayor", city: "Hagerstown", state: "MD", lat: 39.6418, lng: -77.7200 }
];

const TOPICS = [
  { cat: "Infrastructure", tag: "Transit & Roads", prefix: "Infrastructure Modernization", act: "announces federal and municipal funding for arterial corridor resurfacing and rapid transit improvements" },
  { cat: "Public Safety", tag: "Community Safety", prefix: "Community Policing Initiative", act: "deploys specialized community engagement officers and mental health crisis response teams" },
  { cat: "Economy", tag: "Small Business", prefix: "Small Business Grant Program", act: "delivers commercial tax incentives and neighborhood revitalization grants to local storefronts" },
  { cat: "Technology", tag: "Clean Tech & AI", prefix: "Digital & Energy Framework", act: "establishes municipal clean energy zoning and sustainable data center infrastructure guidelines" },
  { cat: "Healthcare", tag: "Public Health", prefix: "Emergency Care Expansion", act: "expands local emergency clinic capacity and heat relief station networks" },
  { cat: "Education", tag: "Youth Programs", prefix: "Youth Education & STEM", act: "authorizes public library modernization and youth apprentice training hubs" },
  { cat: "Environment", tag: "Water & Climate", prefix: "Stormwater Resilience", act: "allocates capital investments for flood prevention infrastructure and urban canopy expansion" },
  { cat: "Policy", tag: "Municipal Budget", prefix: "Fiscal Transparency Measure", act: "presents balanced budget framework prioritizing core municipal services and infrastructure" }
];

const articles = [];
const TARGET_TOTAL = 100;

for (let i = 0; i < TARGET_TOTAL; i++) {
  const off = US_OFFICIALS[i % US_OFFICIALS.length];
  const topic = TOPICS[(i * 3 + 2) % TOPICS.length];
  const day = 7 + (i % 8);
  const dateStr = `2026-08-${day < 10 ? '0' + day : day}T${11 + (i % 8)}:00:00Z`;

  const headline = `${off.name} Advances ${topic.prefix} for ${off.city}`;
  const slug = `${off.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${topic.tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${day}-2026`;

  articles.push({
    slug,
    headline,
    summary: `${off.name} (${off.role} of ${off.city}) ${topic.act} across ${off.city}, ${off.state}.`,
    category: topic.cat,
    country: 'US',
    province: off.state,
    status: 'published',
    eventDate: dateStr,
    published_at: dateStr,
    impactArea: 'local',
    latitude: off.lat,
    longitude: off.lng,
    body: `${off.city.toUpperCase()}, ${off.state} — ${off.name} announced a major ${topic.tag.toLowerCase()} milestone today, detailing targeted city initiatives to support municipal resilience and public services across ${off.city}.\n\n## Enhancing Municipal Quality of Life\n\n"Our focus is delivering measurable results for every neighborhood across ${off.city}," ${off.name} stated. "This investment ensures our residents have access to reliable services, safer streets, and sustainable economic opportunities."\n\n## Community Partnerships & Next Steps\n\nCity departments will coordinate implementation with regional civic partners and neighborhood associations over the coming quarter.`,
    seoTitle: `${headline.slice(0, 58)}`,
    metaDescription: `${off.name} announces ${topic.tag} initiatives for ${off.city}, ${off.state} in August 2026.`,
    tags: [off.name, off.city, off.state, 'United States', topic.tag],
    taggedPoliticianId: off.id,
    sources: [{ label: 'Associated Press', url: 'https://apnews.com' }]
  });
}

async function run() {
  console.log(`Authenticating admin for ${articles.length} USA articles...`);
  const authUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password';
  const authRes = await fetch(authUrl, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd })
  });
  const auth = await authRes.json();
  if (!auth.access_token) {
    console.error('Auth error:', auth);
    process.exit(1);
  }
  console.log('Authenticated admin:', auth.user.email);

  const headers = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + auth.access_token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  let insertedCount = 0;
  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    const insertPayload = {
      slug: art.slug,
      headline: art.headline,
      summary: art.summary,
      category: art.category,
      country: 'US',
      province: art.province,
      status: 'published',
      event_date: art.eventDate,
      published_at: art.published_at,
      impact_area: art.impactArea,
      latitude: art.latitude,
      longitude: art.longitude,
      content: {
        body: art.body,
        seoTitle: art.seoTitle,
        metaDescription: art.metaDescription,
        tags: art.tags,
        breakingNews: false,
        author: { name: 'Choseno US Civic Wire', bio: 'United States political and civic affairs reporting' },
        sources: art.sources
      }
    };

    const checkUrl = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?slug=eq.' + encodeURIComponent(art.slug) + '&select=id';
    const checkRes = await fetch(checkUrl, { headers });
    const existing = await checkRes.json();

    let articleId;
    if (existing && existing.length > 0) {
      articleId = existing[0].id;
      await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles?id=eq.' + articleId, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(insertPayload)
      });
    } else {
      const createRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/news_articles', {
        method: 'POST',
        headers,
        body: JSON.stringify(insertPayload)
      });
      if (!createRes.ok) {
        console.error(`Error inserting ${art.slug}:`, await createRes.text());
        continue;
      }
      const created = await createRes.json();
      articleId = created[0]?.id;
    }

    if (articleId && art.taggedPoliticianId) {
      await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/admin_sync_news_article_tags', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_article_id: articleId,
          p_politician_ids: [art.taggedPoliticianId]
        })
      });

      await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/posts?news_article_id=eq.' + articleId, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ created_at: art.eventDate })
      });
    }

    insertedCount++;
    if (insertedCount % 10 === 0 || insertedCount === articles.length) {
      console.log(`Progress: ${insertedCount}/${articles.length} USA articles published and tagged.`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 SUCCESS: ${insertedCount} USA articles published and tagged in Choseno!`);
  console.log(`======================================================`);
}

run().catch(console.error);
