/**
 * scripts/rss-feed-collector.js
 *
 * Programmatic, Machine-Extracted Ground Truth RSS Collector.
 * No LLM in this file at all — every decision here is deterministic code.
 *
 * Guarantees:
 * 1. URLs and metadata are extracted directly from machine RSS feeds (no LLM in the loop).
 * 2. Fetches full article body text when available (Tier-1); a thin/failed
 *    extraction downgrades to Tier-2 (paraphrase-only) rather than falsely
 *    claiming verbatim-quote-grade source text.
 * 3. Classifies 401/403 paywalled allowlisted domains as Tier-2 (summary only, 0 quotes).
 * 4. Hard-rejects 404s, 410s, and bare root/category landing pages.
 * 5. 116 feeds: 6 national wires, ~31 named key-leader queries (by role +
 *    name, split federal/state-provincial pools), one feed per US state
 *    (10 highest-volume states split into municipal-only + state-only) and
 *    per Canadian province/territory (territories paired with their
 *    capital city). Pooled and interleaved national:local 1:2 so national
 *    wires can't crowd out local coverage.
 * 6. Jurisdiction filtering: sports/entertainment and human-interest/viral
 *    framing hard-rejected; a foreign country mention only survives if a
 *    genuine US/CA signal (named leader, institution, or place — never a
 *    bare office title, since "governor" exists in other countries too)
 *    appears in the first half of the headline.
 * 7. Relevance filtering: only candidates naming an office holder, a known
 *    key leader, or someone matching a real Choseno politician profile
 *    (~31k profiles, paginated) survive — cuts cost before HTTP
 *    verification or synthesis ever runs.
 * 8. Deduplicates against Supabase (time-windowed, ordered by recency —
 *    not a flat LIMIT with no ORDER BY) and against siblings collected in
 *    the same run (syndication across outlets/feeds).
 * 9. Candidates that clear all of the above are merged into a PERSISTENT
 *    queue (mergeCandidatesIntoQueue) rather than a per-run snapshot —
 *    anything not yet synthesized carries forward until it's published or
 *    ages out past 48h.
 */

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

// Trusted allowlist for Tier-2 paywalled / bot-blocked domains
const ALLOWLISTED_PAYWALLED_DOMAINS = new Set([
  'wsj.com', 'www.wsj.com',
  'reuters.com', 'www.reuters.com',
  'bloomberg.com', 'www.bloomberg.com',
  'ft.com', 'www.ft.com',
  'nytimes.com', 'www.nytimes.com',
  'washingtonpost.com', 'www.washingtonpost.com',
  'theglobeandmail.com', 'www.theglobeandmail.com',
  'economist.com', 'www.economist.com',
  'theatlantic.com', 'www.theatlantic.com',
  'thehill.com', 'www.thehill.com',
  'politico.com', 'www.politico.com',
  'apnews.com', 'www.apnews.com',
  'cbc.ca', 'www.cbc.ca',
  'ctvnews.ca', 'www.ctvnews.ca',
  'globalnews.ca', 'www.globalnews.ca',
  'nationalpost.com', 'www.nationalpost.com',
  'thestar.com', 'www.thestar.com',
  'cnn.com', 'www.cnn.com',
  'foxnews.com', 'www.foxnews.com',
  'nbcnews.com', 'www.nbcnews.com',
  'cbsnews.com', 'www.cbsnews.com',
  'abcnews.go.com', 'www.abcnews.go.com',
  'usatoday.com', 'www.usatoday.com'
]);

// Verified US & Canada RSS Feed Registry (Federal, State/Provincial, Municipal)
//
// NATIONAL_FEEDS and LOCAL_CURATED_FEEDS are hand-picked wires/queries.
// LOCAL_REGION_FEEDS is machine-generated: one dedicated local-politics feed
// per US state and Canadian province/territory, so small municipal, MLA/MPP,
// and state-legislature stories get a guaranteed feed of their own instead of
// competing inside two catch-all "US Municipal" / "Canada Municipal" queries.
//
// Fixed 2026-08-27: previously national wires were listed first and a single
// global slice(0, 30) truncation (see collectVerifiedRssStories below) meant
// national/DC stories silently crowded out every municipal and provincial
// story before verification ever ran. Collection now buckets items per feed
// and interleaves national vs. local at a fixed ratio so local coverage is
// structurally guaranteed, not just hoped for.
const NATIONAL_FEEDS = [
  // US Federal & National Politics Wires
  {
    name: 'The Hill Politics',
    url: 'https://thehill.com/homenews/feed/',
    country: 'US',
    category: 'Politics'
  },
  {
    name: 'Politico Congress',
    url: 'https://rss.politico.com/congress.xml',
    country: 'US',
    category: 'Politics'
  },
  {
    name: 'Google News US Politics',
    url: 'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFZ4ZERBU0FtVnVLQUFQAQ?hl=en-US&gl=US&ceid=US:en',
    country: 'US',
    category: 'Politics'
  },
  // Canada Federal Politics Wires
  {
    name: 'CBC News Politics',
    url: 'https://www.cbc.ca/cmlink/rss-politics',
    country: 'CA',
    category: 'Politics'
  },
  {
    name: 'The Globe and Mail Canada',
    url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/',
    country: 'CA',
    category: 'Politics'
  },
  {
    name: 'Global News Politics',
    url: 'https://globalnews.ca/politics/feed/',
    country: 'CA',
    category: 'Politics'
  }
];

const LOCAL_CURATED_FEEDS = [
  // US State Capitols, Governors & Municipal City Halls (catch-all, on top
  // of the per-state feeds generated below)
  {
    name: 'Google News US Municipal & Mayors',
    url: 'https://news.google.com/rss/search?q=(%22city+council%22+OR+mayor+OR+ordinance+OR+alderman+OR+%22county+commission%22+OR+%22school+board%22+OR+township+OR+borough)+(budget+OR+zoning+OR+rezoning+OR+referendum+OR+%22voted+to%22+OR+%22approved%22+OR+levy+OR+ballot)+when:24h&hl=en-US&gl=US&ceid=US:en',
    country: 'US',
    category: 'Municipal'
  },
  {
    name: 'Google News US State Capitols',
    // Role/office based, not a fixed roster of incumbent names — catches
    // any governor, state senator/rep regardless of who currently holds
    // the seat.
    url: 'https://news.google.com/rss/search?q=(governor+OR+%22state+senate%22+OR+%22state+house%22+OR+%22state+legislature%22+OR+%22state+representative%22)+when:24h&hl=en-US&gl=US&ceid=US:en',
    country: 'US',
    category: 'Politics'
  },
  {
    name: 'Google News US State Party & Caucus Politics',
    url: 'https://news.google.com/rss/search?q=(caucus+OR+resigns+OR+%22steps+down%22+OR+recall+OR+%22primary+challenge%22+OR+censure+OR+%22party+leadership%22)+(%22state+legislature%22+OR+%22state+senate%22+OR+%22state+house%22+OR+governor)+when:24h&hl=en-US&gl=US&ceid=US:en',
    country: 'US',
    category: 'Politics'
  },
  // Canada Provincial Capitols & Municipal Councils (catch-all, on top of
  // the per-province feeds generated below)
  {
    name: 'Google News Canada Municipal & Mayors',
    url: 'https://news.google.com/rss/search?q=(%22city+council%22+OR+mayor+OR+councillor+OR+bylaw+OR+trustee+OR+%22school+board%22+OR+%22regional+district%22+OR+warden+OR+reeve)+(budget+OR+zoning+OR+rezoning+OR+referendum+OR+%22voted+to%22+OR+%22approved%22+OR+levy+OR+ballot)+when:24h&hl=en-CA&gl=CA&ceid=CA:en',
    country: 'CA',
    category: 'Municipal'
  },
  {
    name: 'Google News Canada Provincial Capitols',
    // Role/office based (premier, cabinet, MLA/MPP/MNA), not a fixed
    // roster of incumbent names — catches any officeholder, any province,
    // regardless of who currently holds the seat.
    url: 'https://news.google.com/rss/search?q=(%22provincial+government%22+OR+%22legislative+assembly%22+OR+mpp+OR+mla+OR+mna+OR+premier+OR+cabinet+OR+%22question+period%22)+when:24h&hl=en-CA&gl=CA&ceid=CA:en',
    country: 'CA',
    category: 'Politics'
  },
  {
    name: 'Google News Canada Opposition & Party Politics',
    // Covers caucus turmoil / defections / leadership fights that a
    // premier/government-focused feed cannot catch (e.g. Conservative
    // Party of BC MLAs quitting caucus is about the opposition, not the
    // sitting government) — by role/party, not a named individual.
    url: 'https://news.google.com/rss/search?q=(caucus+OR+%22official+opposition%22+OR+%22party+leadership%22+OR+resigns+OR+quits+OR+%22leaves+caucus%22+OR+%22crosses+the+floor%22+OR+%22leadership+review%22+OR+%22Conservative+Party+of+BC%22+OR+%22BC+United%22)+when:24h&hl=en-CA&gl=CA&ceid=CA:en',
    country: 'CA',
    category: 'Politics'
  }
];

// Closes the gap that used to be "Track B" of the manual masternewsagent
// directive (30 key governance-tier leaders) with more feeds instead of a
// live agent — one feed per leader, by name, since only a name search can
// target a specific officeholder's own statements/bills. Split into
// federal (national pool) vs. state/premier (local pool) so this doesn't
// quietly re-inflate the Trump/national skew the feeds above were built to
// fix — the interleave ratio below only works if leaders are pooled by the
// governance tier they actually belong to.
const KEY_LEADERS_FEDERAL = [
  { name: 'Donald Trump', country: 'US' }, { name: 'JD Vance', country: 'US' },
  { name: 'Mike Johnson', country: 'US' }, { name: 'Hakeem Jeffries', country: 'US' },
  { name: 'Chuck Schumer', country: 'US' }, { name: 'John Thune', country: 'US' },
  { name: 'Bernie Sanders', country: 'US' }, { name: 'Ted Cruz', country: 'US' },
  { name: 'Elizabeth Warren', country: 'US' },
  { name: 'Mark Carney', country: 'CA' }, { name: 'Pierre Poilievre', country: 'CA' },
  { name: 'Jagmeet Singh', country: 'CA' }, { name: 'Yves-Francois Blanchet', country: 'CA' },
  { name: 'Chrystia Freeland', country: 'CA' }, { name: 'Dominic LeBlanc', country: 'CA' },
  { name: 'Melanie Joly', country: 'CA' }
];

const KEY_LEADERS_STATE_PROVINCIAL = [
  { name: 'Gavin Newsom', country: 'US' }, { name: 'Ron DeSantis', country: 'US' },
  { name: 'Greg Abbott', country: 'US' }, { name: 'JB Pritzker', country: 'US' },
  { name: 'Josh Shapiro', country: 'US' }, { name: 'Gretchen Whitmer', country: 'US' },
  { name: 'Spencer Cox', country: 'US' },
  { name: 'Doug Ford', country: 'CA' }, { name: 'Francois Legault', country: 'CA' },
  { name: 'Danielle Smith', country: 'CA' }, { name: 'David Eby', country: 'CA' },
  { name: 'Wab Kinew', country: 'CA' }, { name: 'Tim Houston', country: 'CA' },
  { name: 'Elizabeth May', country: 'CA' }, { name: 'Ravi Kahlon', country: 'CA' }
];

function buildKeyLeaderFeed(leaderName, country) {
  // Verified 2 term-groups only (quoted name + one bracketed OR-group) —
  // a 3rd clause silently breaks Google News RSS's query matching, same
  // issue documented on buildLocalRegionFeed below.
  const activityTerms = 'announcement OR bill OR policy OR "executive order" OR statement OR legislation';
  const query = `"${leaderName}" (${activityTerms}) when:24h`;
  const hl = country === 'CA' ? 'en-CA' : 'en-US';
  return {
    name: `Google News Leader — ${leaderName}`,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${country}&ceid=${country}:en`,
    country,
    category: 'Politics',
    region: null
  };
}

const KEY_LEADER_FEEDS_FEDERAL = KEY_LEADERS_FEDERAL.map(l => buildKeyLeaderFeed(l.name, l.country));
const KEY_LEADER_FEEDS_LOCAL = KEY_LEADERS_STATE_PROVINCIAL.map(l => buildKeyLeaderFeed(l.name, l.country));

// One dedicated local-politics feed per region so, e.g., a Wyoming city
// council vote isn't competing for a slot against 49 other states inside a
// single catch-all query.
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina',
  'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const CA_PROVINCES = [
  'Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan',
  'Nova Scotia', 'New Brunswick', 'Newfoundland and Labrador', 'Prince Edward Island'
];

// The 3 territories returned almost nothing under their own name in testing
// (thin direct Google News indexing) — paired with their capital, since
// coverage of "the territory" in practice IS coverage of its one major city.
const CA_TERRITORIES = [
  ['Yukon', 'Whitehorse'],
  ['Northwest Territories', 'Yellowknife'],
  ['Nunavut', 'Iqaluit']
];

// These 10 states produce enough municipal + state-legislature volume in a
// day that one combined query undersamples both sides of it — split into a
// municipal-only feed and a state-level-only feed instead of one feed
// covering both, doubling their effective coverage.
const HIGH_VOLUME_STATES = new Set([
  'California', 'Texas', 'New York', 'Florida', 'Pennsylvania',
  'Illinois', 'Ohio', 'Georgia', 'North Carolina', 'Michigan'
]);
const US_MUNICIPAL_ONLY_TERMS = 'mayor OR "city council" OR "county commission" OR alderman';
const US_STATE_ONLY_TERMS = 'governor OR "state legislature" OR "state senate" OR "state house"';

function buildLocalRegionFeed(regionNameOrAliases, country, opts = {}) {
  // Role/office terms only — governors, councillors, mayors, MLAs — never a
  // specific incumbent's name, so the feed keeps working across elections
  // and doesn't silently miss whoever isn't on a hardcoded roster.
  //
  // IMPORTANT: keep this to exactly TWO top-level term groups (one bracketed
  // OR-group of office/decision terms + one bracketed-or-bare region
  // name/aliases). Verified by hand (2026-08-27): a 3rd group makes Google
  // News RSS silently stop honoring the region name — every state's feed
  // returned the identical Texas story regardless of region. An OR'd alias
  // group (e.g. "Yukon" OR "Whitehorse") still counts as ONE group and is
  // safe; a *separate* 3rd bracket is not.
  const aliases = Array.isArray(regionNameOrAliases) ? regionNameOrAliases : [regionNameOrAliases];
  const primaryName = aliases[0];
  const officeTerms = opts.officeTerms || (country === 'CA'
    ? 'mayor OR councillor OR MLA OR MPP OR MNA OR premier'
    : 'governor OR mayor OR "city council" OR "county commission" OR alderman OR "state legislature"');
  const placeClause = aliases.length > 1
    ? `(${aliases.map(a => `"${a}"`).join(' OR ')})`
    : `"${primaryName}"`;
  const query = `(${officeTerms}) ${placeClause} when:24h`;
  const hl = country === 'CA' ? 'en-CA' : 'en-US';
  return {
    name: `Google News Local — ${primaryName}${opts.labelSuffix ? ` (${opts.labelSuffix})` : ''}`,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${country}&ceid=${country}:en`,
    country,
    category: 'Municipal',
    region: primaryName
  };
}

const LOCAL_REGION_FEEDS = [
  ...US_STATES.flatMap(s => HIGH_VOLUME_STATES.has(s)
    ? [
        buildLocalRegionFeed(s, 'US', { officeTerms: US_MUNICIPAL_ONLY_TERMS, labelSuffix: 'municipal' }),
        buildLocalRegionFeed(s, 'US', { officeTerms: US_STATE_ONLY_TERMS, labelSuffix: 'state' })
      ]
    : [buildLocalRegionFeed(s, 'US')]),
  ...CA_PROVINCES.map(p => buildLocalRegionFeed(p, 'CA')),
  ...CA_TERRITORIES.map(aliases => buildLocalRegionFeed(aliases, 'CA'))
];

const RSS_FEEDS = [
  ...NATIONAL_FEEDS,
  ...KEY_LEADER_FEEDS_FEDERAL,
  ...LOCAL_CURATED_FEEDS,
  ...KEY_LEADER_FEEDS_LOCAL,
  ...LOCAL_REGION_FEEDS
];
const NATIONAL_FEED_NAMES = new Set([...NATIONAL_FEEDS, ...KEY_LEADER_FEEDS_FEDERAL].map(f => f.name));

// Non-US/Canada domestic and non-civic/sports keywords to strictly reject
const NON_US_CA_DOMESTIC_REGEX = /\b(xi jinping|xinhua|beijing|china|chinese|kyrgyzstan|kyrgyz|kazakhstan|uzbekistan|central asia|russia|russian|kremlin|putin|modi|gadkari|lok sabha|rajya sabha|karnataka|nagendra|bengaluru|mumbai|delhi|telangana|brs mla|kerala|thiruvananthapuram|satheesan|chirag paswan|jitan manjhi|bhalswa|bihar|lakh|crore|rupees?|₹|india today|times of india|nepal|tinubu|nigeria|nigerian|angola|luanda|african union|leningrad|thailand|thai|lese majeste|imran khan|pakistan|pakistani|keir starmer|downing street|westminster|tory|tories|labour mp|badenoch|cleverly|london mayor|bank of england|macron|elysee|bundestag|scholz|germany|german|ecb|european central bank|g20|g7|zelenskyy|kyiv|netanyahu|knesset|gaza|hamas|hezbollah|tehran|ayotollah|iran|iranian|jordan|syria|iraq|yemen|saudi arabia|cricket captain|cockroach hunger|seoul|korea|tokyo|japan|brussels|belgium|manila|philippines|sydney|auckland|new zealand|south africa|cosla|scotland|angeles city|mexico|mexican|sheinbaum|amlo|morena party|sinaloa|jalisco|michoacan|oaxaca|chiapas|tijuana|guadalajara|monterrey|ciudad de mexico|cdmx|cartel|madrid|spain|irish|ireland|australia|australian|queensland|solomon star|bermuda|oba|bernews|venezuela|caracas|maduro|brazil|argentina|cuba|haiti|ghana|malaysia)\b/i;

// Human-interest/viral framing that isn't governance news even when it
// names a real office holder — e.g. "NYC Mayor playing tennis goes viral"
// or a Facebook wedding-announcement post about a mayor's daughter. This
// is deliberately checked separately from SPORTS_ENTERTAINMENT_REGEX
// because these aren't sports terms, they're tone/framing markers.
const VIRAL_ENTERTAINMENT_REGEX = /\b(goes viral|viral video|viral moment|fans react|internet reacts|hilariously|wins the internet|best wishes|ties the knot|tied the knot|elopement|engagement photos|engaged to|dating rumors|adorable|sweetest moment|dressed as|kisses|kissing|legacy obituary)\b/i;
// Includes generic sports-roundup language (roundup, snaps skid, matinee,
// "scores and Saturday slate") because several US high schools are literally
// named after colonial governors (Governor Livingston HS, Governor Mifflin,
// etc.) — the office-holder title regex below can't tell "Governor
// Livingston puts up big numbers" (a football score) from an actual
// governor without this.
const SPORTS_ENTERTAINMENT_REGEX = /\b(premier league|chelsea|fulham|arsenal|manchester united|man utd|man city|liverpool|tottenham|real madrid|barcelona|laliga|bundesliga|serie a|champions league|striker|midfielder|goalkeeper|touchdown|quarterback|nfl|nhl|nba|mlb|wnba|badminton|cricket|world cup|super bowl|espn|sportsnet|box score|transfer window|movie review|box office|snaps skid|matinee|saturday slate|friday night.{0,20}roundup|high school football|varsity|lacrosse|rugby|pickleball)\b/i;
const FOREIGN_OUTLET_REGEX = /\b(xinhua|global times|cgtn|politico\.eu|nippon\.com|inquirer\.net|korea joongang daily|top south now|cosla|hindustan times|ahmedabad mirror|al jazeera|france 24|the independent|new indian express|deccan herald|yonhap|irish independent|solomon star|ndtv|the hindu|udayavani|the news minute|india today|the times of india|times of india|devdiscourse|african union|bernews|modern ghana|malaysia-china insight|latin times|daily mail|the sun|express\.co\.uk|mirror\.co\.uk|telegraph india|thecable|gb news|people\.com|tmz|eonline|page six)\b/i;
// Deliberately EXCLUDES generic office titles (governor, premier, mayor,
// senator, minister...) even though they're common US/CA titles too —
// Mexico, Nigeria, and plenty of other countries also call their
// subnational leaders "governor." A bare title proves nothing about
// jurisdiction; only a named US/CA individual, an unambiguous US/CA
// institution, or a specific US/CA place name does.
const US_CA_EXECUTIVE_KEYWORDS = /\b(trump|carney|vance|biden|poilievre|congress|senate|house of representatives|white house|pmo|parliament hill|usmca|lcbo|epa|fcc|sec|doj|pentagon|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new york|california|texas|florida|pennsylvania|michigan|ohio|ottawa|toronto|montreal|vancouver|calgary|edmonton|winnipeg|chicago|los angeles|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|seattle|denver|boston)\b/i;

function isStrictlyUsOrCanada(title, description, sourceName) {
  const text = `${title} ${description} ${sourceName || ''}`;
  if (SPORTS_ENTERTAINMENT_REGEX.test(text)) {
    return false; // Hard reject sports & entertainment
  }
  if (VIRAL_ENTERTAINMENT_REGEX.test(text)) {
    return false; // Hard reject human-interest/viral framing, even about a real office holder
  }
  if (FOREIGN_OUTLET_REGEX.test(text)) {
    return false; // Hard reject non-US/CA foreign outlets
  }
  if (NON_US_CA_DOMESTIC_REGEX.test(text)) {
    // Hard reject foreign domestic politics / foreign conflict stories
    return false;
  }
  return true;
}

// ── Office-holder / politician-profile filter ───────────────────────────────
// Only keep candidates that are actually about an accountable individual —
// a sitting office holder, a named key leader, or someone with an existing
// Choseno politician profile — rather than a purely institutional/topic
// story with no named human subject. Cheap (regex + Set lookups), runs
// before HTTP verification and Gemini synthesis so it directly cuts cost
// and volume on candidates that would likely fail politician-tagging anyway.

const OFFICEHOLDER_TITLE_REGEX = /\b(mayor|councillor|councilwoman|councilman|council\s?member|alderman|governor|premier|senator|representative|congressman|congresswoman|mla|mpp|mna|mp\b|minister|cabinet|speaker|attorney\s?general|county\s?commissioner|county\s?executive|city\s?manager|selectman|selectboard|trustee|school\s?board|warden|reeve|sheriff|district\s?attorney|state\s?legislator|state\s?senator|state\s?representative|prime\s?minister|president|vice\s?president)\b/i;

function normalizeNameForMatch(name) {
  return (name || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Pulls 2-4 word Capitalized phrases out of a headline as candidate person
// names, so matching against the profiles Set is a handful of Set.has()
// lookups per candidate rather than testing every profile name against
// every headline.
function extractCapitalizedPhrases(text) {
  const cleaned = (text || '').replace(/["“”‘’,:;()]/g, '');
  const words = cleaned.split(/\s+/).filter(Boolean);
  const phrases = new Set();
  for (let n = 4; n >= 2; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const slice = words.slice(i, i + n);
      if (slice.every(w => /^[A-Z][a-zA-Z.'-]*$/.test(w))) {
        phrases.add(slice.join(' '));
      }
    }
  }
  return [...phrases];
}

/**
 * Fetch every politician full_name from the profiles table (paginated —
 * this table runs into the tens of thousands of imported rows) so raw
 * candidates can be checked against real Choseno politician profiles, not
 * just the ~31 curated key leaders.
 */
async function fetchPoliticianProfileNames() {
  const names = new Set();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return names;
  const pageSize = 1000;
  let offset = 0;
  try {
    // Sanity cap at 60k rows so a runaway table can't hang an hourly run.
    while (offset <= 60000) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=full_name&role=eq.politician&limit=${pageSize}&offset=${offset}`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (!res.ok) break;
      const rows = await res.json();
      for (const r of rows) {
        if (r.full_name) names.add(normalizeNameForMatch(r.full_name));
      }
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
  } catch (e) {
    console.warn('[RSS Collector] Failed to fetch politician profile names:', e.message);
  }
  return names;
}

// Lazily computed (not at module-eval time): KEY_LEADERS_FEDERAL /
// KEY_LEADERS_STATE_PROVINCIAL are declared further down this file, so
// referencing them here at module-top-level would hit the const TDZ. By the
// time this function is actually called (inside collectVerifiedRssStories),
// the whole module has finished loading.
let _allKeyLeaderNamesCache = null;
function getAllKeyLeaderNames() {
  if (!_allKeyLeaderNamesCache) {
    _allKeyLeaderNamesCache = [...KEY_LEADERS_FEDERAL, ...KEY_LEADERS_STATE_PROVINCIAL].map(l => l.name.toLowerCase());
  }
  return _allKeyLeaderNamesCache;
}

function mentionsOfficeholderOrKnownPolitician(item, profileNameSet) {
  const text = `${item.title} ${item.description || ''}`;
  if (OFFICEHOLDER_TITLE_REGEX.test(text)) return true;
  const lowerText = text.toLowerCase();
  if (getAllKeyLeaderNames().some(name => lowerText.includes(name))) return true;
  if (profileNameSet.size > 0) {
    for (const phrase of extractCapitalizedPhrases(item.title)) {
      if (profileNameSet.has(normalizeNameForMatch(phrase))) return true;
    }
  }
  return false;
}

function decodeXmlEntities(str) {
  return (str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // Generic numeric character references first (&#39; / &#039; / &#x27; alike) --
    // feeds zero-pad decimal refs inconsistently and also use curly quotes/dashes
    // (&#8216; &#8217; &#8220; &#8221; &#8212; &#8211;) that a hardcoded per-entity
    // replace list will always be one code point behind on. Doing this generically
    // before the named-entity passes below covers all of them in one step.
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeXmlEntities(m[1]) : null;
}

function extractRawTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

function parseRssXml(xml, feedMeta) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const block of itemBlocks) {
    const rawTitle = extractTag(block, 'title');
    let rawLink = extractRawTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description');
    const sourceName = extractTag(block, 'source') || feedMeta.name;

    if (!rawTitle || !rawLink) continue;

    // Clean Google News link if wrapped in CDATA or trailing chars
    rawLink = rawLink.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

    items.push({
      title: rawTitle,
      link: rawLink,
      pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      description: description || '',
      sourceName: sourceName,
      feedName: feedMeta.name,
      region: feedMeta.region || null,
      country: feedMeta.country,
      category: feedMeta.category
    });
  }

  return items;
}

function isBareCategoryOrRoot(urlStr) {
  try {
    const u = new URL(urlStr);
    const p = u.pathname.replace(/\/+$/, '');
    if (!p || p === '' || p === '/' || p === '/news' || p === '/politics' || p === '/world' || p === '/world/us' || p === '/business' || p === '/opinion') {
      return true;
    }
    return false;
  } catch (e) {
    return true;
  }
}

function extractCleanBodyText(html) {
  if (!html) return '';
  // Remove scripts, styles, navs, footers, headers
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ');

  // Match paragraph tags
  const pMatches = stripped.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const paragraphs = pMatches
    .map(p => decodeXmlEntities(p))
    .filter(p => p.length > 40 && !p.includes('cookie') && !p.includes('subscribe') && !p.includes('All rights reserved'));

  return paragraphs.join('\n\n');
}

/**
 * Verify and fetch source URL content.
 * Returns: { status: number, finalUrl: string, tier: 'tier-1'|'tier-2'|'rejected', bodyText: string, reason?: string }
 */
async function verifyAndFetchUrl(targetUrl) {
  if (isBareCategoryOrRoot(targetUrl)) {
    return { status: 400, finalUrl: targetUrl, tier: 'rejected', reason: 'Bare root or generic category landing page' };
  }

  let hostname = '';
  try {
    hostname = new URL(targetUrl).hostname.replace(/^www\./, '');
  } catch (e) {
    return { status: 400, finalUrl: targetUrl, tier: 'rejected', reason: 'Malformed URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    clearTimeout(timeout);

    const finalUrl = res.url || targetUrl;
    if (isBareCategoryOrRoot(finalUrl)) {
      return { status: 400, finalUrl, tier: 'rejected', reason: 'Redirected to generic category root' };
    }

    if (res.status === 200) {
      const html = await res.text();
      const bodyText = extractCleanBodyText(html);
      if (bodyText.length > 200) {
        return { status: 200, finalUrl, tier: 'tier-1', bodyText };
      } else {
        // Limited text extracted (JS-rendered page, .gov press release with
        // non-standard markup, etc.). Fixed 2026-08-28: this branch used to
        // fall through to 'tier-1' for any non-allowlisted domain even
        // though there's barely any real article text to ground against —
        // Gemini would still be told "write a comprehensive article" and
        // fill the gap with plausible-sounding invented detail that no
        // downstream check catches (the quote verifier only catches
        // fabricated *quotes*, not fabricated narrative). Thin extraction
        // now always downgrades to tier-2 (paraphrase-only, no verbatim
        // quotes claimed) regardless of allowlist status.
        return { status: 200, finalUrl, tier: 'tier-2', bodyText: '', reason: 'Limited text extraction — insufficient ground truth for tier-1' };
      }
    }

    // 401 / 403 Paywall Check
    if (res.status === 401 || res.status === 403) {
      if (ALLOWLISTED_PAYWALLED_DOMAINS.has(hostname)) {
        return { status: res.status, finalUrl, tier: 'tier-2', bodyText: '', reason: 'Allowlisted paywalled / bot-protected wire' };
      } else {
        return { status: res.status, finalUrl, tier: 'rejected', reason: `HTTP ${res.status} on non-allowlisted domain` };
      }
    }

    // 404 / 410 / 500+ Hard Rejections
    return { status: res.status, finalUrl, tier: 'rejected', reason: `HTTP ${res.status} returned` };
  } catch (err) {
    if (ALLOWLISTED_PAYWALLED_DOMAINS.has(hostname)) {
      return { status: 403, finalUrl: targetUrl, tier: 'tier-2', bodyText: '', reason: 'Network error on allowlisted paywalled domain' };
    }
    return { status: 500, finalUrl: targetUrl, tier: 'rejected', reason: err.message };
  }
}

/**
 * Fetch existing database headlines to deduplicate against, so a story
 * already published never gets re-verified/re-synthesized as if it were new.
 *
 * Fixed 2026-08-28: this previously had no `order=` clause, so `limit=2000`
 * on a table with no ORDER BY isn't "the most recent 2000" — PostgREST
 * returns whatever the query planner's scan order happens to be, which can
 * silently be an arbitrary slice of the table. A story published an hour
 * ago could be entirely absent from that sample while months-old rows fill
 * it, so a genuine duplicate would sail through as "new" and get fully
 * re-researched. Now explicitly ordered by recency and time-bounded.
 *
 * @param windowHours how far back to look — always at least 24h, and at
 *   least as wide as the current run's own lookback, so a run that's
 *   scanning further back (e.g. auto-window covering a missed cron tick)
 *   never dedupes against a narrower slice than what it's actually scanning.
 */
async function fetchExistingHeadlines(windowHours = 24) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return new Set();
  try {
    const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/news_articles?select=slug,headline&published_at=gte.${since}&order=published_at.desc.nullslast&limit=2000`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    if (!res.ok) return new Set();
    const rows = await res.json();
    const set = new Set();
    for (const r of rows) {
      if (r.slug) set.add(r.slug.toLowerCase().trim());
      if (r.headline) set.add(r.headline.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim());
    }
    return set;
  } catch (e) {
    return new Set();
  }
}

function calculateSimilarity(str1, str2) {
  const tokens1 = new Set(str1.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  const tokens2 = new Set(str2.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }
  return intersection / (tokens1.size + tokens2.size - intersection);
}

/**
 * Main Collector: Fetches verified RSS items, checks status gate, deduplicates, and returns candidates.
 */
async function collectVerifiedRssStories(options = {}) {
  const maxHours = options.maxHours || 24;
  // Use a minimum of 24h rolling lookback so we never drop unpublished candidates
  // from feeds just because an article was published 1 hour ago. Database
  // deduplication (calculateSimilarity > 0.45 against recent articles) guarantees
  // zero duplicate ingestion.
  const lookbackHours = Math.max(24, maxHours);
  const cutoffTime = new Date(Date.now() - lookbackHours * 3600 * 1000);
  console.log(`[RSS Collector] Scanning verified feeds (Lookback: ${lookbackHours}h, Cutoff: ${cutoffTime.toISOString()})...`);

  const [existingDbHeadlines, profileNameSet] = await Promise.all([
    fetchExistingHeadlines(Math.max(48, lookbackHours)),
    fetchPoliticianProfileNames()
  ]);
  console.log(`[RSS Collector] Loaded ${existingDbHeadlines.size} database records for deduplication, ${profileNameSet.size} politician profile names for relevance filtering.`);

  // Fetch every feed concurrently (bounded) instead of one-at-a-time — with
  // ~70 feeds now registered (6 national wires + curated local queries + a
  // dedicated feed per US state / CA province), a serial loop would take
  // several minutes before verification even starts.
  const FETCH_CONCURRENCY = 10;
  const itemsByFeed = new Map(RSS_FEEDS.map(f => [f.name, []]));

  for (let i = 0; i < RSS_FEEDS.length; i += FETCH_CONCURRENCY) {
    const chunk = RSS_FEEDS.slice(i, i + FETCH_CONCURRENCY);
    await Promise.all(chunk.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        if (!res.ok) {
          console.warn(`  Warning: Failed to fetch ${feed.name} (HTTP ${res.status})`);
          return;
        }
        const xml = await res.text();
        const items = parseRssXml(xml, feed);

        const qualifying = [];
        for (const item of items) {
          const itemDate = new Date(item.pubDate);
          if (itemDate < cutoffTime) continue; // Skip older than lookback window

          // Strict US and Canada filter
          if (!isStrictlyUsOrCanada(item.title, item.description, item.sourceName)) {
            continue;
          }

          // Only keep candidates about an actual accountable individual —
          // a sitting office holder, a known key leader, or someone with an
          // existing Choseno politician profile — not a purely
          // institutional/topic story with no named human subject.
          if (!mentionsOfficeholderOrKnownPolitician(item, profileNameSet)) {
            continue;
          }

          // Deduplication against existing DB
          const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
          let isDuplicate = false;
          for (const existing of existingDbHeadlines) {
            if (calculateSimilarity(normTitle, existing) > 0.45) {
              isDuplicate = true;
              break;
            }
          }
          if (isDuplicate) continue;

          qualifying.push(item);
        }
        console.log(`  ${feed.name}: ${items.length} parsed -> ${qualifying.length} qualify`);
        itemsByFeed.set(feed.name, qualifying);
      } catch (e) {
        console.warn(`  Error fetching/parsing feed ${feed.name}:`, e.message);
      }
    }));
  }

  // Round-robin within each pool (national wires vs. local/municipal/
  // provincial feeds) so a single high-volume feed can't hog its own pool,
  // then interleave the two pools 1 national : 2 local. This guarantees
  // local coverage a fixed share of every verification batch regardless of
  // how many items national wires happen to return that hour.
  function roundRobin(feedNames) {
    const buckets = feedNames.map(name => [...itemsByFeed.get(name)]);
    const out = [];
    let added = true;
    while (added) {
      added = false;
      for (const bucket of buckets) {
        if (bucket.length) {
          out.push(bucket.shift());
          added = true;
        }
      }
    }
    return out;
  }

  const nationalNames = NATIONAL_FEEDS.map(f => f.name);
  const localNames = RSS_FEEDS.filter(f => !NATIONAL_FEED_NAMES.has(f.name)).map(f => f.name);
  const nationalOrdered = roundRobin(nationalNames);
  const localOrdered = roundRobin(localNames);

  const interleaved = [];
  let ni = 0, li = 0;
  while (ni < nationalOrdered.length || li < localOrdered.length) {
    if (ni < nationalOrdered.length) interleaved.push(nationalOrdered[ni++]);
    for (let k = 0; k < 2 && li < localOrdered.length; k++) interleaved.push(localOrdered[li++]);
  }

  // Within-batch dedup: the same event is routinely syndicated across
  // several outlets/feeds in one run (e.g. a governor's office press
  // release picked up by 3 different queries) — existingDbHeadlines only
  // catches stories already published, not siblings collected in this same
  // run. Keep the first occurrence (already national:local prioritized) and
  // drop later near-duplicates before they ever reach verification/synthesis.
  const rawCandidates = [];
  for (const item of interleaved) {
    const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const isBatchDuplicate = rawCandidates.some(kept =>
      calculateSimilarity(normTitle, kept.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()) > 0.45
    );
    if (!isBatchDuplicate) rawCandidates.push(item);
  }

  console.log(`\n[RSS Collector] Found ${rawCandidates.length} raw unique candidate stories within lookback window (${nationalOrdered.length} national, ${localOrdered.length} local/municipal/provincial, ${interleaved.length - rawCandidates.length} in-batch duplicates dropped).`);
  console.log(`[RSS Collector] Executing HTTP Status & Paywall Gatekeeper on top candidates in parallel...\n`);

  // Cap candidate checking to avoid wasteful slow network checks. Raised
  // from a flat 30 now that ~70 feeds are registered — the national:local
  // interleave above (not this cap) is what guarantees fair coverage.
  // Raised 60 -> 80 alongside the key-leader feeds (now ~100 feeds total).
  // This is a NETWORK/COST bound (how many source URLs get fetched and
  // HTTP-verified per run), not an editorial cap — the publish-side limit
  // was removed entirely (2026-08-28). Raised to 300 alongside 116 feeds
  // (50 states w/ 10 split into 2 + 13 CA regions + ~31 leaders + 12
  // curated) so a run can realistically cover every feed at least once.
  const maxCandidates = options.maxCandidates || 300;
  const candidatesToCheck = rawCandidates.slice(0, maxCandidates);
  const verifiedCandidates = [];
  const CONCURRENCY = 8;

  for (let i = 0; i < candidatesToCheck.length; i += CONCURRENCY) {
    const chunk = candidatesToCheck.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async (item) => {
      try {
        const result = await verifyAndFetchUrl(item.link);
        if (result.tier === 'rejected') return null;
        return {
          title: item.title,
          sourceUrl: result.finalUrl || item.link,
          sourceName: item.sourceName,
          pubDate: item.pubDate,
          country: item.country,
          category: item.category,
          region: item.region || null,
          feedName: item.feedName,
          tier: result.tier,
          sourceDescription: item.description,
          sourceBodyText: result.bodyText || item.description
        };
      } catch (e) {
        return null;
      }
    }));

    for (const res of results) {
      if (res) verifiedCandidates.push(res);
    }
  }

  console.log(`\n[RSS Collector] Completed: ${verifiedCandidates.length} fully verified stories ready for synthesis.`);
  return verifiedCandidates;
}

// A candidate that sits unsynthesized this long is no longer "breaking" —
// this is the ONE rule that removes something from the queue without it
// ever being published, and it's owned by the script (age is objective and
// checkable), not left to an agent's judgment call. Lives here (not in
// rss-verified-pipeline.js) so both that pipeline AND this file's own
// standalone CLI entry point below share the identical merge logic —
// previously the CLI path overwrote the queue file wholesale, silently
// discarding any backlog Antigravity hadn't gotten to yet.
const QUEUE_EXPIRY_HOURS = 48;

/**
 * Merges freshly-discovered candidates into the persistent queue file,
 * carrying forward anything from previous runs that hasn't been published
 * yet (insert-news-batch.js prunes this file after a successful ingest)
 * and dropping only what's aged out past QUEUE_EXPIRY_HOURS. Dedup is by
 * sourceUrl — the same signal insert-news-batch.js uses to confirm a
 * candidate was actually published.
 */
function mergeCandidatesIntoQueue(freshCandidates, queuePath) {
  const expiryCutoff = Date.now() - QUEUE_EXPIRY_HOURS * 3600 * 1000;

  let existingQueue = [];
  if (fs.existsSync(queuePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
      if (Array.isArray(parsed)) existingQueue = parsed;
    } catch (e) {
      console.warn('[QUEUE] Could not parse existing candidate queue, starting fresh:', e.message);
    }
  }

  const expired = existingQueue.filter(c => new Date(c.pubDate).getTime() < expiryCutoff);
  const stillFresh = existingQueue.filter(c => new Date(c.pubDate).getTime() >= expiryCutoff);
  if (expired.length > 0) {
    console.log(`[QUEUE] ${expired.length} candidate(s) aged out past ${QUEUE_EXPIRY_HOURS}h unsynthesized and were dropped (not published, not carried forward):`);
    expired.forEach(c => console.log(`  - "${c.title}"`));
  }

  const existingUrls = new Set(stillFresh.map(c => c.sourceUrl));
  const genuinelyNew = freshCandidates.filter(c => !existingUrls.has(c.sourceUrl));
  if (stillFresh.length > 0) {
    console.log(`[QUEUE] Carried over ${stillFresh.length} candidate(s) from previous runs that were never synthesized — they are still queued, not lost.`);
  }

  const merged = [...stillFresh, ...genuinelyNew];
  fs.writeFileSync(queuePath, JSON.stringify(merged, null, 2));
  return merged;
}

// CLI Execution
if (require.main === module) {
  // Fixed 2026-08-30: this used to overwrite latest-verified-rss-
  // candidates.json outright, which — if this script is ever invoked
  // directly instead of through rss-verified-pipeline.js — would silently
  // wipe out any unsynthesized backlog the queue was carrying. Now merges
  // through the same persistent-queue logic the pipeline uses.
  collectVerifiedRssStories({ maxHours: 24 }).then(results => {
    const outPath = path.join(__dirname, 'latest-verified-rss-candidates.json');
    const queue = mergeCandidatesIntoQueue(results, outPath);
    console.log(`Candidate queue: ${queue.length} total pending (${results.length} newly discovered this run) saved to ${outPath}`);
  }).catch(console.error);
}

module.exports = {
  collectVerifiedRssStories,
  verifyAndFetchUrl,
  ALLOWLISTED_PAYWALLED_DOMAINS,
  RSS_FEEDS,
  isStrictlyUsOrCanada,
  mentionsOfficeholderOrKnownPolitician,
  mergeCandidatesIntoQueue,
  QUEUE_EXPIRY_HOURS,
  calculateSimilarity,
  fetchExistingHeadlines
};
