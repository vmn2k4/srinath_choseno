# Choseno — Y Combinator Application (Draft)

> Draft 2026-10-17. Items in **[BRACKETS]** are numbers or facts only the founder can supply. Do not submit with brackets left in. Every claim here should be provable in an interview.

---

## Company

**Company name:** Choseno
**URL:** [choseno.com]
**One-line description (50 chars):** The anonymous social network for local politics.

*Alternates:* "Ballot box for the silent majority." / "Where quiet voters finally speak."

## What is your company going to make?

Choseno is an anonymous social network for politics, organised by electoral boundary (your council ward, school board, riding). Every post carries a rotating "Ghost ID", never a real name. Each person gets one comment per thread, there are no followers and no influencers, and nobody can build an audience. The goal is to collect one honest opinion from each verified local resident and show governments and politicians what their community actually thinks, not just what the loudest voices say.

We started as the information layer. We mapped over 120,000 electoral boundary shapes across Canada, the US, India and the UK, and built a directory of about 29,800 office holders and 6,700 election candidates, so voters can find who represents them and read their platforms. That now brings in roughly 10,000 people a week through Google, with no ad spend (we rank around 7th for local-candidate searches). We are now turning that audience into the product above: the place to speak, and for governments, the place to listen.

## Why this idea? (the insight)

1. **Local government matters most and gets the least attention.** Mayors, councillors and school trustees decide roads, zoning, schools and policing, yet have the lowest coverage and voter attention.
2. **People have stopped talking about politics in public.** On Facebook or X your audience is friends, family and coworkers, and paid trolls pile on anyone who posts a view. Reasonable people leave. The conversation that remains is the loudest, most extreme and best-funded, so politicians and journalists see a distorted picture of their communities.
3. **Existing platforms can't fix this.** Their business is engagement, and outrage drives engagement. Anonymity plus persistent identity (karma, followers) lets bots and paid actors build reputation to weaponise. We removed the reward for performing: Ghost IDs rotate, comments are limited to one per thread, and points never buy reach.

We are not building a debate platform. We are building a ballot box: one considered opinion per person, counted fairly.

## Who are your users, and how do you know they need it?

**Users:** residents of a boundary who have opinions about local politics but won't post under their real name. **Customers (later):** governments, then politicians' offices and media.

**Evidence of demand (Phase 1):**
- **31,600 unique users in about 90 days** (GA4), essentially all of it since August 2026, with **no ad spend**. 28,800 in the last 30 days and about 10,200 in the last 7 days (about 1,450/day and rising). 84% came from Google organic search.
- Roughly **603,000 Google impressions and 31,200 clicks** in 90 days (5.2% CTR, average position 8.3). 94% of users are in Canada, mostly from searches for individual local candidates by name; US is next (about 1,800 users/30d).
- We have helped **over 31,000 people** look up their local candidates and office holders, across 6,740 candidates in 8 elections plus 29,800 office holders, backed by 5,500+ news articles.
- 962 anonymous "supporter" actions and 62 politician ratings already, from visitors who weren't asked to register.
- [Still to add: returning-user rate, and any user emails or quotes saying they'd never post on Facebook.]

**Honest gap:** under 0.5% of these visitors are registered (155 of 31,600). They see Choseno as an info site. Our current work is converting readers into registered members and first-time posters, and we track visitor-to-registration and registration-to-first-post from day one.

## How far along are you?

- **Built and live:** web app (Next.js, Supabase/PostGIS), boundary engine that maps a user to every jurisdiction they live in, candidate and office-holder directory, politician walls, ratings, Ghost ID system with burn/rotate, moderation queue, news pipeline, Android app [on internal testing, build 9].
- **Data:** 124,000+ boundary shapes, 29,800 office holders, 6,740 election candidates, US House primary data reconciled for all but 3 states, BC voting-place lookup.
- **Traction:** 31,600 users in 90 days from SEO alone; 10,000+ per week. **155 real registered sign-ups, 106 of them in the last 30 days.** About 65 user posts and 23 comments so far. We are at the very start of Phase 2, so this part is early.
- **Not built yet:** Verified Local (event check-in), clustered issue reports for government, the paid products. I'd rather say this plainly.

## How will you make money?

Citizens are never the product: no ads, no selling data or attention.

1. **Governments (primary).** Councils, school boards and ministries pay a subscription for the listening platform: resident voices clustered into issues with verified counts (never names), sentiment by ward and topic, and issue tickets routed to the right department with status tracking. Priced by population served.
2. **Politicians.** A press-office toolkit: AI-assisted drafting reviewed by the official, distribution to media, and a verified named channel. Same price for every party.
3. **Media.** Verified, timestamped statements from the source, as a wire/API feed.
4. **Optional citizen supporter tier** (later). Saved issues, alerts, private history. It never buys voice, ranking or verified status.

Sequencing: revenue follows users. We sell nothing to institutions until a boundary has enough verified residents for the numbers to be credible. **Market size (bottom-up; verify figures before submitting):** the US has about 90,000 local governments (about 19,000 municipalities, 16,000 townships, 13,000 school districts, plus counties and special districts; US Census of Governments), and Canada has roughly 3,500 municipalities plus about 600 school boards and districts. If only 10,000 of the larger ones (cities over about 10,000 people, counties and large school boards) pay $10,000 a year for the listening platform, that is about $100M ARR. At $25,000 for larger cities and counties, the top 2,000 customers alone are about $50M. Politicians' offices (over 500,000 elected officials in the US alone) and media are additional markets. *These prices are assumptions; the first pilots will test them.*

## Why will this work? (what's hard, and our advantage)

- **Distribution already exists.** Phase 1 gives us a free, compounding SEO audience of exactly the people we need, already looking for their local races. Most social networks fail at cold start. We start with traffic and seed conversation in boundaries where we already have candidates.
- **The structure is the moat.** Boundary data for 120k+ shapes, a Ghost ID system designed so even we cannot link posts to people after a burn, and the aggregation rules that make the product safe to sell to governments.
- **Trust architecture.** Customers get aggregates only. They cannot see who posted, remove posts or affect ranking. That separation is what makes a product sold to officials credible with residents.

## Competition

- **Facebook/X/Reddit/Nextdoor:** real-name or persistent-identity, engagement-driven, and dominated by loud voices. Nextdoor is local but identity-based and known for neighbourhood conflict.
- **Civic tech (CitizenLab, Granicus, Open Town Hall, SeeClickFix):** sell to governments but their participants are self-selected, often named, and they have no organic consumer audience. We start with the audience.
- **Voter-information sites (Ballotpedia, Vote411, BallotReady):** inform voters but do not give them somewhere to speak. We began there and kept going.

**Why we're different:** none of them combine an existing consumer audience, anonymity by design and sales to government. Civic-tech vendors have the buyers but no organic participants; consumer platforms have the audience but no incentive to protect the quiet majority. [Add 1-2 things you've learned from actually using each, and any pilot conversations. YC will probe this.]

## Why us? Founder

**Murugappan Valliyappan ("Muru")**, solo founder and the only person working on Choseno. AI engineer with 10+ years at Snap, Qualcomm and AMD (per LinkedIn: [confirm exact roles and years]), Illinois Institute of Technology. Based in the San Francisco Bay Area. LinkedIn: linkedin.com/in/muruvalliyappan. [GitHub link.]

- **What I've shipped alone on Choseno:** a live platform serving about 10,000 users a week with no ad spend, 120k+ boundary shapes, a directory of 29,800 office holders and 6,700 candidates, a news pipeline (5,500+ articles), an anonymous Ghost ID system, a moderation queue and an Android app.
- **Relevant technical depth:** production LLM systems, RAG and voice agents (Python, FastAPI, PostgreSQL, AWS, React), including founding-AI-engineer work at WageEstate, an AI property-management platform. I use the same skills in Choseno for news ingestion, candidate summaries and moderation.
- **Founder track record:** I have launched products before (WageEstate; Mesh of Growth, a launch platform that went on Product Hunt; JournalHood, AI journaling built for FERPA/COPPA compliance). [Be ready to say what each taught you, and why you're committing to Choseno. Be honest about Mesh of Growth having pivoted.]
- **Why local politics:** *[DRAFT, edit heavily. The bracketed line must be your real story; I can't write it for you.]* [One true moment: the election, race or conversation where you saw a smart, reasonable person decline to say what they thought about politics, or couldn't find out who was running. 1-2 sentences, specific, in first person.] Most people can't name their school trustee or councillor, yet those people set their taxes, roads and schools. When I built a directory of local candidates, tens of thousands of people showed up within weeks to look them up, which told me the interest is there. What's missing is a safe place for those people to say what they think, so I'm building it.
- **One hard thing I did fast:** *[DRAFT. Check every figure and date against what really happened.]* Our first posts were in mid-July 2026 and Google began sending real traffic in early August. By October we had 31,600 users, all organic. The growth came from building one page per candidate, office holder and boundary at scale, so a search for any local candidate by name finds us. The traffic then overloaded the database. I traced the cause to row-level security policies re-evaluating the auth check on every row (not missing indexes), rewrote the policies, and added caching on candidate and politician pages, which got us through the next surge. I did this alone, in about three months, without paying for a single ad.

**I'm a solo founder and I'm looking for a co-founder.** I've built the entire product and data pipeline myself. What I need is a co-founder who can sell to governments: someone with municipal or public-sector relationships, procurement experience, or a track record of closing government contracts. I'll own product, engineering and data; they would own government partnerships and the first paying pilots. [State whether you have candidates in mind, and whether you'd use YC Co-Founder Matching.]

## Equity / legal

[Fill in: legal entity, who owns what, any funding to date. Mention the planned structure: for-profit company funding a separate non-profit foundation for debates, candidate interviews and events, as well as the governance firewall between them.]

## What are you doing in the next 3 months / what would YC change?

1. Convert readers to members: sign-up prompts on candidate pages, Android launch, first-post flow. Target: raise visitor→registered from 0.5% to 3% (about 300 sign-ups a week at today's traffic), reach 100 weekly verified posters, in 3 pilot boundaries (for example Oshawa, Saanich and Greater Victoria, where we already rank for candidate names).
2. Ship **Verified Local** (event check-in) so counts in a boundary are credible.
3. Pitch **3 pilot councils/school boards** with real resident-sentiment data from pilot boundaries.
4. Find the co-founder.

YC's help: government go-to-market, introductions to civic-tech buyers, and a co-founder.

## Hardest questions to be ready for

- *Anonymous platforms attract abuse. Why won't this?* One comment per thread, rotating IDs, toxicity/coordination flags and verification are built to hold before growth, not after.
- *Why would governments pay?* Duplicate complaints drop, they get one clear queue and a defensible read of the community. Pitch the first pilot as free or discounted in exchange for a case study.
- *How do you sell to the people being criticised?* Customers get aggregates only; no control over moderation or ranking; equal tools and price for every party; paid press content is labelled and kept apart from resident threads.
- *Can a subpoena unmask users?* [You need a clear answer: retention, encryption and what the Ghost-ID mapping stores. Open item in VISION.md.]
- *Only 0.5% of visitors registered. Why believe in conversion?* Today it's 155 sign-ups from 31,600 users (0.5%), with 106 in the last 30 days. [Add the conversion experiments you're running.]

## 1-minute founder video script

"Hi, I'm [name], founder of Choseno. Most people have stopped talking about politics in public. Say the wrong thing and your boss, family or a troll finds you. So the loudest voices win and politicians never hear the quiet majority. We started by helping voters find their local candidates, and over thirty thousand people in three months have found us on Google to look up their local candidates, with no ads. Now we're turning that audience into the first anonymous social network for politics: one honest opinion per person, organised by ward and riding, no followers, no influencers. Governments pay to hear what their residents really think, without ever seeing a name. I built it solo. I'm looking for a co-founder who can bring in government customers. Let's talk."
