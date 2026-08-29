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

async function updateArticles(articles) {
  const authRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: env.admin_un, password: env.admin_pwd })
  });
  const authData = await authRes.json();
  const token = authData.access_token;
  if (!token) {
    console.error('Failed to get admin token');
    return;
  }

  for (const art of articles) {
    const payload = {
      headline: art.headline,
      summary: art.summary,
      content: {
        body: art.body,
        seoTitle: art.seoTitle,
        metaDescription: art.metaDescription,
        tags: art.tags || ['Politics', 'Government'],
        tweet: art.tweet,
        author: { name: 'Choseno Civic News Desk', bio: 'Civic and political reporting' },
        sources: art.sources || []
      }
    };

    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
      method: 'PATCH',
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    console.log(`[PATCH] ${art.id} -> Status: ${res.status}`);
  }
}

const batch = [
  {
    id: "2d0ed4cf-ce3e-4a77-91b1-af712f6ebac2",
    headline: "Texas Governor Abbott Halts State Funding for AI-Powered Flock Surveillance Cameras",
    summary: "Governor Greg Abbott has ordered all Texas state agencies to immediately suspend grant funding for Flock Safety automated license plate reader cameras amid mounting civil liberties and data privacy concerns.",
    seoTitle: "Texas Halts Flock Camera Funding Over Privacy | Choseno",
    metaDescription: "Texas Governor Greg Abbott directs state agencies to pause funding for Flock Safety AI surveillance cameras following privacy controversies.",
    tweet: "Texas Governor Greg Abbott orders an immediate freeze on state grant funding for AI-powered Flock Safety surveillance cameras.",
    tags: ["Greg Abbott", "Texas", "Surveillance", "Privacy", "Law Enforcement", "AI Technology"],
    sources: [{ name: "930 WFMD Free Talk", url: "https://news.google.com/rss/articles/CBMizAFBVV95cUxQYWJCczJvVVdLb2lUaFhTQWxVYl9NczNyenl2VE1uekJ2aDUzSE95a3BkLWotWVcxaTBqX2o1QmFNZlZRYXpERVBWYTJBZFhQZnFza1liV2F4MXFST3BxZGNXeG1EVUFremZDTzF1ZDRNb28ydXdHbVlOZXdJeEJCZjkyYzd2aUJkd1hXSFEwc19oYVpJWDRiS2ZyZUZpb19CRFpNeHpFYndqVjJHMlU3a3hOczUyaVZCblp0cUM0RjNENlI3U2QwbkpFNnA" }],
    body: `Texas Governor Greg Abbott has directed all state agencies to immediately pause state-administered funding for Flock Safety surveillance cameras, marking a major turning point in the statewide expansion of automated license plate reader (ALPR) networks across Texas. The executive order instructs state departments to ensure that no state grants or public funds distributed to local police departments or sheriff's offices are utilized to procure, lease, or maintain Flock camera systems.

The decision comes in the wake of escalating scrutiny from civil liberties organizations, privacy advocates, and state lawmakers regarding the collection, retention, and potential misuse of vehicular travel data. Prior to the governor's directive, substantial state funding—estimated at more than $30 million—had been channeled into municipal surveillance networks through the Motor Vehicle Crime Prevention Authority. That funding mechanism was sustained by revenue from a $1 fee attached to automobile insurance policies, originally established by the Texas Legislature in 2023 to combat vehicle theft and catalytic converter trafficking.

While law enforcement agencies have praised Flock's machine-learning capabilities for assisting in the recovery of stolen vehicles and tracking suspects in violent offenses, critics have pointed to alarming incidents of data sharing across state borders and unauthorized searches by individual officers. Civil rights groups have argued that the pervasive deployment of interconnected ALPR systems creates an unregulated mass-surveillance apparatus capable of mapping the lawful movements of millions of everyday motorists without a warrant.

Governor Abbott's intervention halts the direct pipeline of state subsidies that fueled the rapid installation of thousands of roadside camera nodes in suburbs and major metropolitan corridors. Local municipal councils across Texas now face renewed pressure to audit their existing municipal contracts, balance public safety technology with constitutional protections, and determine whether local taxpayer dollars should continue funding private surveillance infrastructure in the absence of state support.`
  },
  {
    id: "ff0f54c6-beeb-4579-a148-5c8e5ca5511d",
    headline: "Texas State Funding for AI-Powered Surveillance Technology Faces Statewide Freeze",
    summary: "Texas freezes millions in state grant allocations designated for Flock Safety cameras following allegations of database misuse and privacy violations.",
    seoTitle: "Texas Freezes AI Camera Grants Amid Privacy Scrutiny | Choseno",
    metaDescription: "Statewide grants for AI automated license plate readers frozen in Texas as Governor Abbott orders state funding halt for Flock Safety networks.",
    tweet: "Texas enacts immediate freeze on state grant funding for AI-powered Flock license plate reader networks.",
    tags: ["Greg Abbott", "Texas", "Surveillance", "Civil Liberties", "State Budget", "Public Safety"],
    sources: [{ name: "930 WFMD Free Talk", url: "https://news.google.com/rss/articles/CBMizAFBVV95cUxQYWJCczJvVVdLb2lUaFhTQWxVYl9NczNyenl2VE1uekJ2aDUzSE95a3BkLWotWVcxaTBqX2o1QmFNZlZRYXpERVBWYTJBZFhQZnFza1liV2F4MXFST3BxZGNXeG1EVUFremZDTzF1ZDRNb28ydXdHbVlOZXdJeEJCZjkyYzd2aUJkd1hXSFEwc19oYVpJWDRiS2ZyZUZpb19CRFpNeHpFYndqVjJHMlU3a3hOczUyaVZCblp0cUM0RjNENlI3U2QwbkpFNnA" }],
    body: `State funding for AI-powered automated license plate readers has been frozen across Texas after Governor Greg Abbott issued a formal directive prohibiting state entities from subsidizing Flock Safety camera installations. The abrupt policy reversal halts a multi-year program that saw tens of millions of dollars in state-backed grants flow to municipal police departments seeking to automate vehicle tracking and traffic surveillance.

Under the framework previously overseen by the Texas Motor Vehicle Crime Prevention Authority, state revenues collected from automotive insurance surcharges were pooled to underwrite hardware leases and cloud software subscriptions for local police departments. While initially marketed as a targeted measure to curb property crime and auto theft, the rapid saturation of AI-equipped cameras in residential neighborhoods and along highway corridors prompted fierce pushback from bipartisan privacy watchdogs.

Concerns intensified following reports detailing unauthorized tracking by law enforcement personnel and the broader implications of private corporate databases housing billions of vehicle location records. Policy analysts noted that the lack of uniform state oversight allowed local agencies to share real-time vehicular tracking logs across disparate jurisdictions without judicial warrants, creating profound Fourth Amendment vulnerabilities.

With state grants now suspended, city councils and county commissioners throughout Texas must decide whether to absorb the significant recurring costs of Flock contracts entirely through local municipal tax revenues or dismantle their active camera networks. The funding freeze is expected to trigger legislative debates during the upcoming session regarding statutory data retention limits, warrant requirements for historical plate searches, and the boundary between digital crime prevention and public privacy.`
  }
];

updateArticles(batch).catch(console.error);
