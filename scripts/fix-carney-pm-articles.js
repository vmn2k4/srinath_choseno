const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?headline=ilike.*USMCA*&select=id,slug,headline,content,body`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const rows = await res.json();
  console.log('Found USMCA rows:', rows.length);
  for (const art of rows) {
    console.log('Updating article:', art.id, art.headline);
    const content = art.content || {};

    const newSummary = "Prime Minister Mark Carney and Deputy Prime Minister Chrystia Freeland initiate formal dispute resolution panels under Chapter 31 of the USMCA, challenging US Department of Commerce anti-dumping duties on Canadian timber and structural steel.";
    const newTweet = "Prime Minister Mark Carney initiates formal USMCA dispute proceedings challenging US Department of Commerce tariff duties on Canadian softwood lumber and steel.";
    const newTweetArticle = `Prime Minister Mark Carney and Deputy Prime Minister Chrystia Freeland have formally requested the establishment of a dispute resolution panel under Chapter 31 of the USMCA to strike down US Department of Commerce anti-dumping duties on Canadian softwood lumber and fabricated steel.

Review Mark Carney on Choseno:
https://choseno.com/wall/mark-carney

WHAT CHANGED & TAXPAYER IMPACT:
- Triggers formal Chapter 31 binational dispute panel proceedings under the United States-Mexico-Canada Agreement.
- Challenges US countervailing duty hikes increasing average import levies on Canadian timber from 8% to 14.5%.
- Canadian forestry and steel producers pay over $1.8B annually in deposited duties held in escrow by US Customs.
- Impacts US homebuilders and buyers by adding an estimated $7,500 to the construction cost of a standard single-family home.

THE DEBATE:
- Canadian Government & Forestry Associations: Maintain that Canadian timber harvest stumpage rates are fair and that punitive US tariffs violate free-trade commitments and artificially drive up North American housing costs.
- US Lumber Coalition & Domestic Producers: Argue that Canadian provincial crown land tenure systems provide unfair state subsidies to Canadian mills, undercutting American logging businesses and workers.

NOW YOU HAVE THE SAY — CHOSENO:
Choseno is like Google Reviews for politicians. Don't just watch decisions happen from the sidelines — now you have the say. Review Mark Carney's record, speak your mind, and let your fellow constituents know where you stand on his official public wall:
https://choseno.com/wall/mark-carney

Read the full investigative report on Choseno:
https://choseno.com/news/canada-launches-formal-usmca-dispute-over-us-softwood-lumber-and-steel-tariffs-2026-08-25

#Canada #MarkCarney #ChrystiaFreeland #USMCA #TradeWar #Tariffs #Economy #HousingCrisis #Choseno`;

    const newBody = (art.body || '').replace(/Prime Minister Justin Trudeau/g, 'Prime Minister Mark Carney')
      .replace(/Justin Trudeau/g, 'Mark Carney');

    content.summary = newSummary;
    content.tweet = newTweet;
    content.tweetarticle = newTweetArticle;
    content.taggedPoliticians = ["Mark Carney", "Chrystia Freeland"];
    content.tags = ["Mark Carney", "Chrystia Freeland", "Canada", "USMCA", "Trade", "Tariffs", "Economy", "CrossBorder"];

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        summary: newSummary,
        body: newBody,
        content: content
      })
    });

    console.log('Patch result status:', patchRes.status);
  }

  // Also update Miller article
  const resMiller = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?headline=ilike.*Marc Miller*&select=id,slug,headline,content,body`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const rowsMiller = await resMiller.json();
  console.log('Found Miller rows:', rowsMiller.length);
  for (const art of rowsMiller) {
    console.log('Updating Miller article:', art.id, art.headline);
    const content = art.content || {};

    const newSummary = "Immigration, Refugees and Citizenship Minister Marc Miller and Prime Minister Mark Carney announce an additional 10% reduction in international study permits and restrict spousal open work permits to ease pressure on Canadian municipal housing and healthcare systems.";
    const newTweet = "Immigration Minister Marc Miller announces a further 10% reduction in international student study permits and restricts work visas in Canada.";
    const newTweetArticle = `Immigration Minister Marc Miller and Prime Minister Mark Carney have announced tightened federal immigration rules, reducing international study permits by an additional 10% and restricting post-graduate work permits.

Review Marc Miller on Choseno:
https://choseno.com/wall/marc-miller

WHAT CHANGED & TAXPAYER IMPACT:
- Reduces national study permit target to 437,000 for 2026, representing a cumulative 35% reduction from 2023 levels.
- Restricts Post-Graduation Work Permit (PGWP) eligibility to graduates from public college and university programs linked directly to national labor shortages.
- Eliminates spousal open work permits for partners of students in non-doctoral programs.
- Aims to relieve intense rental vacancy strain and emergency healthcare wait times in Toronto, Vancouver, Montreal, and Waterloo.

THE DEBATE:
- Federal Government & Urban Mayors: Emphasize that temporary resident numbers grew at an unsustainable pace, overwhelming rental housing markets and undermining the integrity of Canada's post-secondary education brand.
- University Presidents & Business Chambers: Warn that sharp visa cuts create severe tuition budget deficits for public universities and exacerbate labor shortages in retail and hospitality sectors.

NOW YOU HAVE THE SAY — CHOSENO:
Choseno is like Google Reviews for politicians. Don't just watch decisions happen from the sidelines — now you have the say. Review Marc Miller's record, speak your mind, and let your fellow constituents know where you stand on his official public wall:
https://choseno.com/wall/marc-miller

Read the full investigative report on Choseno:
https://choseno.com/news/immigration-minister-marc-miller-tightens-international-student-caps-and-work-permits-2026-08-25

#Canada #MarcMiller #MarkCarney #Immigration #HousingCrisis #PostSecondary #CdnPoli #Economy #Choseno`;

    const newBody = (art.body || '').replace(/Prime Minister Justin Trudeau/g, 'Prime Minister Mark Carney')
      .replace(/Justin Trudeau/g, 'Mark Carney');

    content.summary = newSummary;
    content.tweet = newTweet;
    content.tweetarticle = newTweetArticle;
    content.taggedPoliticians = ["Marc Miller", "Mark Carney"];
    content.tags = ["Marc Miller", "Mark Carney", "Canada", "Immigration", "International Students", "Housing", "CdnPoli"];

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?id=eq.${art.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        summary: newSummary,
        body: newBody,
        content: content
      })
    });

    console.log('Patch Miller status:', patchRes.status);
  }
}

run().catch(console.error);
