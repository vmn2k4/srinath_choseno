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
    id: "6501ecde-63d5-4719-8833-f8d3a5d2a71d",
    headline: "Vance and EPA Administrator Zeldin Demand Inspector General Probe Into East Palestine Derailment Response",
    summary: "Vice President JD Vance and EPA Administrator Lee Zeldin have formally petitioned the EPA Office of Inspector General to investigate federal decision-making during the 2023 East Palestine, Ohio chemical disaster.",
    seoTitle: "Vance, Zeldin Call for EPA East Palestine Investigation | Choseno",
    metaDescription: "Vice President JD Vance and EPA Administrator Lee Zeldin request independent OIG probe into previous administration's East Palestine toxic spill response.",
    tweet: "VP JD Vance and EPA Administrator Lee Zeldin call for an independent Inspector General investigation into the 2023 East Palestine disaster response.",
    tags: ["JD Vance", "Lee Zeldin", "EPA", "Ohio", "East Palestine", "Environmental Policy"],
    sources: [{ name: "The Hill Politics", url: "https://thehill.com/homenews/administration/6058719-vance-zeldin-epa-probe-ohio-derailment/" }],
    body: `Vice President JD Vance and Environmental Protection Agency (EPA) Administrator Lee Zeldin have formally requested that the EPA's Office of Inspector General (OIG) open a comprehensive, independent investigation into the federal government's response to the February 2023 Norfolk Southern train derailment in East Palestine, Ohio. In a detailed letter addressed to Acting Inspector General Nicole Murley, both officials called for an exhaustive audit of inter-agency decision-making, chemical containment choices, and public health advisories issued in the immediate aftermath of the catastrophe.

The joint inquiry centers on mounting revelations and newly disclosed internal assessments regarding the controlled vent-and-burn procedure executed days after the crash. Watchdog reports—including findings compiled by the Government Accountability Project—have raised critical questions over whether emergency personnel and federal liaisons adequately accounted for the atmospheric dispersal of phosgene gas and hydrogen chloride across surrounding residential valleys, and whether initial community safety assurances aligned with early internal toxicological modeling.

For residents of East Palestine and neighboring western Pennsylvania townships, persistent health symptoms, lingering water quality anxieties, and economic dislocation have fueled deep distrust toward environmental monitoring protocols. The petition by Vance, who previously represented Ohio in the U.S. Senate and visited the disaster zone on multiple occasions, reflects ongoing pressure from Appalachian communities seeking binding regulatory accountability, independent epidemiological tracking, and compensation for long-term health monitoring.

Administrator Zeldin emphasized that the requested OIG review aims to determine whether federal oversight failures contributed to lapses in testing transparency, worker safety enforcement, or soil remediation timeliness. The findings of the independent watchdog are expected to shape future legislative reforms governing hazardous rail freight classifications, emergency evacuation protocols, and the standards used by federal agencies to certify post-disaster air and water safety.`
  },
  {
    id: "34c438ec-ba79-4fbd-b078-17723a829dff",
    headline: "Tennessee Governor Issues Proclamation Lowering State Flags to Honor Cultural Icon Dolly Parton",
    summary: "Governor Bill Lee directed all state flags across Tennessee state facilities to fly at half-staff in recognition of Dolly Parton's enduring philanthropic and cultural contributions.",
    seoTitle: "Tennessee Flags Lowered to Honor Dolly Parton | Choseno",
    metaDescription: "Tennessee Governor orders flags lowered to half-staff across state buildings to honor Dolly Parton's philanthropic legacy and literacy advocacy.",
    tweet: "Tennessee state flags lowered to half-staff across government buildings to honor the cultural and philanthropic legacy of Dolly Parton.",
    tags: ["Bill Lee", "Tennessee", "Dolly Parton", "State Government", "Philanthropy", "Education"],
    sources: [{ name: "The Rochester Post (.gov)", url: "https://news.google.com/rss/articles/CBMinwFBVV95cUxNWmdqRmc0czZWUGY2SnNmaFp6Tno0NXpxV25JVldWWWNBam0xTTdYNXRaZmV2ZDBVWHJ1Ty1remNoNVB2UDQ3YmcyNEhJQnRZMC1oRHA2MWFCU1d4RlNmVTg1eVRaRGxIbzU4RV9EdmQ0MlVvbkx4THpiZTR5aURFbW1UUzEzM3I5VUFWbDBfTjN0ZWtLYTlDRkZEaUhrT2M" }],
    body: `Tennessee Governor Bill Lee issued an executive proclamation directing that both the United States and state flags be flown at half-staff across all state capitol buildings, administrative agencies, and public institutions to formally honor the lifelong contributions and philanthropic legacy of global cultural icon Dolly Parton. The statewide ceremonial order recognizes Parton's unparalleled civic impact on education, healthcare access, and economic development throughout the state of Tennessee.

Beyond her international renown as a singer-songwriter and entrepreneur, Parton's civic footprint in Tennessee has redefined modern corporate philanthropy. Through the Dollywood Foundation, her flagship initiative—the Imagination Library—has mailed more than 200 million free books to preschool children worldwide, fundamentally altering early childhood literacy rates across rural Appalachian counties and establishing public-private reading partnerships that state governments nationwide have sought to replicate.

The gubernatorial decree follows widespread legislative discussions regarding civic honors, including recent state proposals to rename key regional infrastructure assets in her honor. State leaders praised Parton's rapid mobilization during natural disasters, particularly her immediate financial relief efforts following the devastating 2016 Great Smoky Mountains wildfires, where her foundation provided direct cash assistance to hundreds of displaced working families.

The half-staff flag directive carries no fiscal expenditure on the state budget but stands as a rare statewide ceremonial honor for a living cultural ambassador. Civic organizations, educators, and local leaders across the state joined in applauding the proclamation, highlighting how sustained private philanthropic commitment can effectively complement public educational infrastructure and foster community resilience.`
  }
];

updateArticles(batch).catch(console.error);
