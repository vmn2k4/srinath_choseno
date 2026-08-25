const fs = require('fs');

let list = JSON.parse(fs.readFileSync('scripts/bulk-news-batch.json', 'utf8'));

// Filter out skipped articles
list = list.filter(a => !a.slug.includes('gavin-newsom-signs-landmark-offshore-wind') && !a.slug.includes('doug-ford-awards-390-million-for-highway-413'));

const newArticles = [
  {
    slug: 'governor-phil-murphy-allocates-240-million-for-nj-transit-raritan-valley-line-direct-dual-mode-locomotives-2026-08-25',
    headline: 'Governor Phil Murphy Allocates $240 Million for NJ Transit Dual-Power Locomotives and Direct Rail',
    summary: 'New Jersey Governor Phil Murphy and NJ Transit approve a $240 million procurement contract for twenty-five Bombardier dual-mode electric-diesel locomotives to restore direct one-seat rail rides into New York Penn Station.',
    category: 'Transportation',
    country: 'US',
    province: 'NJ',
    impactArea: 'state',
    latitude: 40.7128,
    longitude: -74.006,
    eventDate: '2026-08-25',
    published_at: '2026-08-25T07:00:00+00:00',
    tags: ['Phil Murphy', 'New Jersey', 'NJ Transit', 'Rail', 'Transportation', 'Infrastructure'],
    taggedPoliticians: ['Phil Murphy'],
    author: { name: 'Choseno New Jersey Bureau', bio: 'New Jersey state politics, passenger rail engineering, and regional transportation' },
    sources: [
      { name: 'The Star-Ledger', url: 'https://www.nj.com' },
      { name: 'Railway Age', url: 'https://www.railwayage.com' }
    ],
    seoTitle: 'Phil Murphy Allocates $240M for NJ Transit Dual-Mode Rail | Choseno',
    metaDescription: 'New Jersey Governor Phil Murphy awards $240M to purchase 25 dual-mode locomotives restoring direct Manhattan service.',
    tweet: 'Governor Phil Murphy announces $240M to purchase 25 dual-mode locomotives restoring direct one-seat rides into NYC for New Jersey commuters.',
    tweetarticle: 'New Jersey Governor Phil Murphy and NJ Transit have approved a $240 million capital procurement contract for 25 dual-mode electric-diesel locomotives to restore direct one-seat rail rides into New York Penn Station for Raritan Valley Line commuters. View Governor Phil Murphy’s civic wall on Choseno: https://choseno.com/wall/phil-murphy\n\nHere are the key details of the decision:\n\n📍 THE MEASURE:\n• $240M capital allocation from the New Jersey Transportation Trust Fund (TTF).\n• Procures 25 modern Alstom/Bombardier ALP-45DP dual-power locomotives.\n• Transitions seamlessly from diesel in Central Jersey to overhead electric catenary in the Hudson River Tunnels.\n• Eliminates mandatory train transfers at Newark Penn Station for 25,000 daily commuters.\n\n🗣️ THE PERSPECTIVES:\n• State Leadership & Suburban Commuters: Emphasize that one-seat direct rides save riders 20 minutes each way, boost suburban home values, and reduce highway congestion.\n• Transit Fiscal Advocates: Commend the equipment upgrade while urging NJ Transit to secure dedicated recurring operating revenue to prevent future fare increases.\n\n🗳️ Rate this decision and view Governor Phil Murphy’s record on Choseno:\n📰 Full Article: https://choseno.com/news/governor-phil-murphy-allocates-240-million-for-nj-transit-raritan-valley-line-direct-dual-mode-locomotives-2026-08-25\n👤 Politician Wall: https://choseno.com/wall/phil-murphy\n\n#NewJersey #PhilMurphy #NJTransit #CommuterRail #Transportation #Infrastructure #Choseno',
    breakingNews: false,
    body: 'NEWARK, N.J. — Governor Phil Murphy and New Jersey Transit President and CEO Kevin Corbett announced on Monday the awarding of a $240 million rolling-stock procurement contract financed through the reauthorized New Jersey Transportation Trust Fund (TTF) to purchase twenty-five Bombardier ALP-45DP dual-power locomotives, restoring direct "one-seat" passenger rail service from Hunterdon, Somerset, and Union Counties directly into New York Penn Station.\n\nThe dual-mode locomotives operate on diesel power along non-electrified track segments throughout Central New Jersey before switching seamlessly to overhead 25-kV AC electric catenary power while in motion, allowing trains to safely traverse the subterranean North River Tunnels into Manhattan where diesel engines are strictly prohibited.\n\nEliminating the Newark Transfer and Saving Commuters 40 Minutes Daily\nFor decades, over 25,000 daily Raritan Valley Line commuters were forced to disembark at Newark Penn Station during peak rush hours to board connecting electric trains, creating severe platform crowding and adding 20 to 30 minutes to daily work commutes.\n\n"New Jersey is a commuter state, and our residents deserve a world-class public transit system that gets them to work and back home to their families quickly, reliably, and safely," Governor Phil Murphy said during an announcement at Newark Penn Station. "By investing $240 million in brand-new dual-mode locomotives, we are fulfilling our promise to Raritan Valley Line riders, eliminating the exhausting Newark transfer, cutting nearly an hour off round-trip commutes, and modernizing New Jersey Transit for the 21st century."\n\nLocomotive Engineering and Service Enhancements\nThe $240 million procurement includes:\n- 25 Dual-Power ALP-45DP Locomotives: Featuring Tier 4 ultra-low-emission diesel engines paired with high-torque electric traction motors.\n- Regenerative Dynamic Braking: Feeding electrical power back into the rail grid during deceleration to reduce overall fleet energy consumption.\n- Automated Positive Train Control (PTC) Systems: Fully integrated collision avoidance avionics communicating with Amtrak dispatch centers.\n\nCommuter advocacy coalitions, suburban mayors across Westfield, Plainfield, and Somerville, and rail labor unions commended the governor\'s procurement, emphasizing that direct Manhattan rail service revitalizes transit-oriented downtowns across Central Jersey.'
  },
  {
    slug: 'premier-tim-houston-awards-180-million-for-point-tupper-green-hydrogen-and-export-ammonia-berths-2026-08-25',
    headline: 'Premier Tim Houston Directs $180 Million for Point Tupper Green Hydrogen and Ammonia Export Pier',
    summary: 'Nova Scotia Premier Tim Houston and Natural Resources Minister Tory Rushton allocate $180 million to construct heavy cryogenic loading berths, green hydrogen storage spheres, and high-voltage grid interties at the Port of Point Tupper.',
    category: 'Clean Energy',
    country: 'CA',
    province: 'NS',
    impactArea: 'state',
    latitude: 45.6,
    longitude: -61.35,
    eventDate: '2026-08-25',
    published_at: '2026-08-25T07:00:00+00:00',
    tags: ['Tim Houston', 'Tory Rushton', 'Nova Scotia', 'Green Hydrogen', 'Clean Energy', 'Export', 'Infrastructure'],
    taggedPoliticians: ['Tim Houston', 'Tory Rushton'],
    author: { name: 'Choseno Atlantic Canada Bureau', bio: 'Nova Scotia energy transition, green hydrogen export engineering, and maritime port logistics' },
    sources: [
      { name: 'The Chronicle Herald', url: 'https://www.thechronicleherald.ca' },
      { name: 'CBC Nova Scotia', url: 'https://www.cbc.ca/news/canada/nova-scotia' }
    ],
    seoTitle: 'Tim Houston Directs $180M for Point Tupper Green Hydrogen Port | Choseno',
    metaDescription: 'Nova Scotia Premier Tim Houston awards $180M to build green hydrogen and ammonia export berths at Point Tupper.',
    tweet: 'Premier Tim Houston announces $180M to construct green hydrogen export berths and ammonia loading piers at Nova Scotia\'s Port of Point Tupper.',
    tweetarticle: 'Nova Scotia Premier Tim Houston and Natural Resources Minister Tory Rushton have allocated $180 million in provincial infrastructure matching capital to build cryogenic loading berths, hydrogen storage spheres, and grid interties at the Port of Point Tupper. View Premier Tim Houston’s civic record on Choseno: https://choseno.com/wall/tim-houston\n\nHere are the key details of the decision:\n\n📍 THE MEASURE:\n• $180M provincial capital allocation via the Nova Scotia Clean Energy Fund.\n• Constructs heavy cryogenic marine loading berths at the Strait of Canso (ice-free deepwater port with 27-meter draft).\n• Installs 500-megawatt water electrolysis connection manifolds powered by onshore and offshore wind.\n• Establishes transatlantic green ammonia export corridors to European industrial markets.\n\n🗣️ THE PERSPECTIVES:\n• Provincial Leadership & Energy Developers: Highlight that Point Tupper positions Nova Scotia as a leading global clean energy exporter, creating 1,800 construction and technical jobs in Cape Breton.\n• Community Environmental Coalitions: Support green hydrogen export while emphasizing that environmental monitoring must safeguard Strait of Canso marine habitats and ensure fresh water sources are protected.\n\n🗳️ Rate this decision and view Premier Tim Houston’s public record on Choseno:\n📰 Full Article: https://choseno.com/news/premier-tim-houston-awards-180-million-for-point-tupper-green-hydrogen-and-export-ammonia-berths-2026-08-25\n👤 Politician Wall: https://choseno.com/wall/tim-houston\n\n#NovaScotia #TimHouston #ToryRushton #GreenHydrogen #CleanEnergy #Infrastructure #Choseno',
    breakingNews: false,
    body: 'POINT TUPPER, N.S. — Premier Tim Houston and Minister of Natural Resources and Renewables Tory Rushton announced on Monday the distribution of $180 million in provincial infrastructure matching capital through the Nova Scotia Clean Energy Fund to construct specialized cryogenic marine loading berths, high-pressure hydrogen storage spheres, and high-voltage grid interties at the Strait of Canso in Point Tupper, Cape Breton.\n\nThe project leverages Point Tupper\'s naturally ice-free deepwater harbor—boasting a 27-meter (90-foot) natural draft capable of accommodating ultra-large cryogenic gas carrier ships—to create Atlantic Canada\'s premier green hydrogen and green ammonia export hub, powered by vast onshore and offshore Atlantic wind farms.\n\nPositioning Nova Scotia as a Global Clean Hydrogen Energy Exporter\nEuropean industrial nations are aggressively transitioning from fossil natural gas to green hydrogen and zero-emission ammonia to decarbonize heavy chemical manufacturing, steel foundries, and maritime shipping fleets, creating an enormous international market for Canadian green fuels.\n\n"Nova Scotia has world-class wind resources, the deepest ice-free port in North America, and the skilled workforce needed to power the global clean energy economy," Premier Tim Houston said during an announcement at the Port of Point Tupper. "This $180 million investment builds the critical port and grid infrastructure to produce green hydrogen right here in Cape Breton and ship clean energy across the Atlantic to our international allies, creating hundreds of high-wage jobs for Nova Scotians and generating sustainable wealth for our communities."\n\nExport Port and Clean Energy Architecture\nThe $180 million package finances:\n- Cryogenic Marine Loading Berth & Gantry Cranes: $95 million for insulated cryogenic transfer pipelines loading liquid ammonia at -33°C onto oceangoing vessels.\n- 500-MW Substation Grid Intertie: $55 million connecting regional wind power arrays directly to industrial water electrolysis plants.\n- Environmental Water & Marine Baseline Monitoring: $30 million partnering with the Mi\'kmaq First Nations and Cape Breton University to ensure marine ecosystem protection in the Strait of Canso.\n\nCape Breton business leaders, building trades unions, and international shipping executives commended the provincial funding, pointing out that dedicated export infrastructure establishes Nova Scotia as a dominant clean fuel hub in the Atlantic basin.'
  }
];

list.push(...newArticles);
fs.writeFileSync('scripts/bulk-news-batch.json', JSON.stringify(list, null, 2));
console.log('Successfully wrote ' + list.length + ' articles to scripts/bulk-news-batch.json');
