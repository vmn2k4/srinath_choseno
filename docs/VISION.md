# Choseno — Vision

> Status: draft for founder review (2026-10-16), revised from the 2026-10-05 draft. Sections marked **[Future]** are not built yet.

## Mission

Choseno is **the social network for politics, for the people who have gone quiet**: a place to say what you actually think about the people who govern you, without your name, your family, or your reputation attached.

## What we learned

1. **Local government gets the least attention and matters the most.** Mayors, councillors and school trustees decide roads, zoning, schools, taxes and policing, the things citizens feel every day. Coverage, candidate visibility and voter attention are lowest here.
2. **We solved a real information gap.** Choseno helped voters find low-visibility local candidates and read their platforms. We rank around **7th in Google for local candidate searches** and bring in about **2,000 users a day**. That is proven demand, and it is our distribution engine.
3. **People have stopped talking about politics in public.** On mainstream social media your audience is friends, family and coworkers, and nobody wants to be judged for their politics by them. Paid trolls and pile-ons punish anyone who posts a view. Reasonable people walk away to protect their dignity.
4. **The result is a distorted conversation.** The loudest, most extreme and best-funded voices dominate. The silent majority, the **missing middle**, is absent. Politicians, journalists and neighbours see a skewed picture of what their community thinks.

## Collecting opinions, not building conversations

Choseno is deliberately **not** a debate platform. Mainstream social media builds conversations, and conversations reward the loudest, most persistent and best-funded voices. We collect one honest opinion from each person, counted fairly, so a community's real view can be seen. The one-comment-per-thread rule, rotating Ghost IDs and no follower counts all follow from this. The product should feel like giving your view to a trusted ballot box, not entering an argument.

Implication: success is measured by how many different verified residents give an opinion, not by thread length or time on site. "Phase 2: Converse" in the roadmap below is better read as "Phase 2: Speak".

## The opportunity

Phase 1 gave us the audience: people already arriving to learn about their local candidates. Phase 2 gives them somewhere to speak. We are positioned to build the one political conversation space designed for the missing middle, anchored to real places (electoral boundaries) and real offices, not to personalities.

## Product principles for the conversation

These are the rules that make Choseno unlike mainstream social media. Each one is a design constraint, not a moderation preference.

| Principle | What it means | Why |
|---|---|---|
| **Pure politics, no influencers** | No follower counts, no audience-building, no creator tools or monetization of attention. Content is about candidates, offices, issues and boundaries. | Removes the incentive to perform. Nobody gets famous here. |
| **Ghost ID identity** | Every post is attributed to a Ghost ID, never a real name or profile. Ghost IDs are not permanent: they rotate. | You can speak freely, and there is no persistent reputation to build, buy or weaponize. |
| **One comment per thread** | A person gets a single comment on any thread. No back-and-forth. | Kills flame wars, pile-ons and troll argument loops. A comment is a considered statement, not a fight. Volume stops equalling influence. |
| **No money to play dirty** | With no permanent identity there is nothing to sell, no brand to build, no account worth buying. Coordinated paid campaigns have nothing to attach to. | Raises the cost and removes the payoff of paid trolling and astroturf. |
| **Local first** | Conversation is organised by boundary and office: your council ward, your school board, your riding. | Keeps attention on the layer of government that gets the least and affects people the most. |
| **Nonpartisan platform** | We host the conversation and take no side. Candidate information stays sourced. | Trust from every part of the spectrum. |

### Open design tension: anonymity vs. credibility

Rotating Ghost IDs mean there is no reputation, so we need other ways to keep conversation credible:

- **Verified Local badge [Future]** — anyone can post, but people who prove they live in the boundary (starting with event check-ins) get a visible **Verified Local** mark and preference in how their voice is counted and shown. Verification is never required to take part. It makes counts and sentiment more credible and limits the effect of out-of-area brigading and bots. It proves "lives in boundary X" only and never travels with a post (see below).
- **One person, one voice** — the one-comment-per-thread rule only works if one person cannot hold many identities. Verification and rotation rules must be designed together.
- **Rotation cadence** — how often Ghost IDs rotate (per thread? per day? per election cycle?) trades off privacy against being able to follow a consistent voice. To be decided.

## Verifying locals: events and check-ins **[Future]**

Choseno hosts or lists local events (issue meetups, candidate forums, town-hall watch parties) where residents talk face to face. Checking in at an event proves a real person physically showed up in the boundary, which gives a trust signal that is very hard for bots or paid trolls to fake at scale.

### How it works

- Attendee checks in on site (for example a rotating QR code shown by the host, with location matching the venue).
- Check-in earns a **verified-local** status for that boundary on their account.
- The status attaches to the account's Ghost ID as a flag only: "verified local". It never records which event, when, or who else was there.

### Privacy rules (must hold, or it breaks the no-retribution promise)

- **Attendance is stored separately from posts**, with minimal retention. Keep only "verified for boundary X until date Y", then delete the event link.
- **Not reversible from the public side.** Nobody, including hosts, candidates and officials, can see who attended or link an attendee to a Ghost ID. Hosts see headcounts only.
- **Physical presence is visible to others in the room.** Anonymous online does not mean anonymous in person. Events should not be advertised as political-side gatherings that could expose someone's views, and attending must never be published.

### Limits to plan for

- **Presence is not residency.** Someone from the next town can attend. Check-in is a strong authenticity signal, but a second source (address or ID check, utility or mail verification, or repeated check-ins) is still needed for an exact boundary claim.
- **Doesn't scale alone.** Events reach a small share of users and exclude people with limited mobility, shift work or childcare duties. It cannot be the only path.
- **Gaming.** A coordinated group could attend and check in, then rotate IDs. Pair with rate limits and one-person-one-voice checks.

### Layered trust, not one gate

| Level | How earned | What it unlocks |
|---|---|---|
| Registered | Email/phone sign-up | Read, limited posting |
| Located | Self-declared or device-based boundary | Post in own boundary, flagged as unverified |
| Verified local | Event check-in and/or address/ID verification | Counts in sentiment and issue clusters, shown to officials |

Only verified locals count in the numbers shown to government. Unverified voices can still speak but are not counted as residents.

### Bonus

Events also seed conversation (fixing the cold start), give local candidates and councils a legitimate way to meet constituents, and could become a government-funded engagement format. They make Choseno real in the community, not just online.

## Points: rewarding real participation **[Future]**

Verified attendees earn extra points. Points attract people who genuinely care about politics, and make showing up worth the effort.

### What earns points

- Event check-ins (the largest reward, since presence is the hardest thing to fake).
- Completing verification.
- Reading candidate information before voting, and voting-day actions.
- A comment that others mark as helpful or considered (not popular or angry).

### Guardrails, so points don't undo our principles

- **Points never buy reach.** They don't boost a post, change ranking or add voting weight. Otherwise we rebuild the loudest-voice problem with a score.
- **Not public.** Points belong to the account, not the Ghost ID, and are never shown next to a post. A visible score would become permanent reputation, which is what rotating IDs exist to prevent.
- **Don't reward volume.** No points per post or per comment. Posting for points is the engagement-farming path we reject (see "Dignity over engagement").
- **Reward effort and quality, not outrage.** Helpful-marking must be hard to brigade, and rate-limited.
- **Can't be bought or sold.** Accounts and points are non-transferable, to stop a points market for paid actors.

### What points can be redeemed for

Non-political perks only: early access to features, recognition as a "verified local", local-business or civic-organisation rewards, entry into community draws, and a say in what we build. Any reward that touches the conversation itself, or that officials could fund to sway sentiment, is off the table.

### Open

- Do points create an "interested in politics" crowd that skews the missing middle toward the already engaged, the opposite of who we want to hear? Consider rewards for first-time participants and for quiet areas.
- Who funds rewards, and does a government or politician sponsor create a conflict of interest?

## What "missing middle" means in the product

The goal is not just a place to post. It is to **make the quiet majority visible**:

- Show sentiment by boundary and by issue, based on verified residents, so the moderate majority is counted, not drowned out.
- Surface considered, representative comments rather than the most inflammatory ones. Ranking must never reward outrage.
- Give candidates and officials a true read of their community, which is the answer to "who do I actually represent?"

## Phases

1. **Inform (built)** — election, boundary and candidate information. Help people pick the right candidates. This is our acquisition engine (search traffic, about 2,000 users/day).
2. **Converse (now: the main bet)** — the Ghost ID social network for politics. Anonymous posts, one comment per thread, organised by boundary and office. Convert candidate-page visitors into participants.
3. **Escalate [Future]** — turn community conversation into action: clustered issues routed to the right office, with documented outcomes. This is the earlier "ticketing platform for government" idea, now fed by Phase 2 conversation.

## How Choseno makes money

**Citizens are never the product.** No ads, no selling attention or data. Core participation is free for everyone. Revenue comes mainly from the institutions that need to hear and reach the public, plus an optional citizen subscription. Sequence matters: revenue follows users, so nothing is sold to institutions until a boundary has enough verified residents to be credible.

### 0. Citizen subscription (optional supporter tier)

**Timing:** introduced only once we have enough active users in a boundary for the free community to be healthy and the paid tools to be worth paying for. Until then everything stays free, so the subscription never slows growth or the first conversations.

Users can then subscribe to help run the service and to get extra tools for keeping their own civic record. Possible benefits:

- Saved and followed issues, candidates, races and boundaries, with alerts.
- A private history of what they read, followed and posted, exportable by them.
- Extra tools such as comparison views, voting guides and reminders.

**Rules so a paid tier doesn't break the platform:**

- **Paying never buys voice.** Free users post, comment and are counted exactly the same. Subscribers get no ranking boost, no extra comments per thread, and no extra weight in sentiment counts. Otherwise money becomes influence, which is the "loud voices win" problem again.
- **Verified-local status is never for sale.** It is earned through events and verification only.
- **Payment must not unmask the Ghost ID.** A subscription ties an account to a real payment identity. Use a payment processor so we hold no card data, keep billing records strictly separate from posts and the Ghost-ID mapping, and make sure no one can link a payer to a post. Without this the no-retribution promise fails.
- **Saved data is the user's.** Whatever we store for them is private to them, exportable and deletable. We still never sell it.
- **Scale expectations.** Consumer subscriptions for civic tools typically convert a small share of users. Treat this as a supplement and a signal of trust, not the main revenue, which stays with institutions.

### 1. Government: the listening platform (primary, Phase 3)

Governments that listen will win the future, and we help them hear the silent majority. Councils, school boards and ministries pay a subscription for:

- Resident voices clustered into issues, with counts ("142 verified residents") and no names.
- **Tickets routed to the right department** (public works, planning, parks, schools) with an explainable reason for the routing.
- Status tracking from reported to seen to resolved, with citizen confirmation of resolution.
- Sentiment by ward and by topic, so decisions reflect the whole community and not just the loudest.

Pricing could scale with population served. Value to government: fewer duplicate complaints, one clear queue, and a defensible read of the community.

### 2. Politicians: press office as a service (Phase 3+)

Elected officials and candidates pay for a press-secretary toolkit:

- AI-assisted drafting of press releases and statements, reviewed and approved by the official.
- Distribution to media outlets directly from the platform.
- A verified, named channel on Choseno where statements are published at the source.

### 3. Media: the primary source of politician news (Future)

Because official statements originate on Choseno, verified and timestamped, outlets get **first-hand news from the source rather than opinion about it**. Outlets could pay for a wire-style feed or API. This is the long-term bet on authoritative news. It only works if the feed stays strictly factual: statements and records, not commentary.

### Conflicts we must manage

Selling to the people being discussed is where this model can break trust. These rules are non-negotiable:

- **Paying never buys influence over the conversation.** Government and politicians cannot see who posted, remove posts, or affect ranking. Moderation is independent of customers.
- **Ghost ID protection is architectural.** Customers get aggregates only. A government customer must not be able to compel or purchase de-anonymization; the legal-exposure question must be answered first.
- **Politician content is labelled.** Paid press-office statements are clearly marked official and sit apart from resident conversation. This resolves the "no influencers" question: named official accounts publish statements, they do not build audiences or reply in resident threads.
- **Equal access across parties.** Same tools and price for every candidate and party, or we lose nonpartisanship.
- **Press content is sourced and verified.** The wire feed carries only what the official actually approved, and accuracy errors must be corrected visibly.
- **Government may refuse to participate.** Tickets must still work without them (reported, seen, no response after 30 days), which makes silence visible and creates pressure to subscribe.

## Company structure: two entities **[Future]**

Donation-funded organisations stay dependent on donors and grant cycles, which caps growth and quietly shapes what they dare to do. Our answer is to make the **commercial company the engine** that pays for independence, and keep civic work in a separate **non-profit**.

| | Choseno Inc. (for-profit) | Choseno Foundation (non-profit) |
|---|---|---|
| Owns | The software platform, brand licensing, data infrastructure | Civic programs and community work |
| Does | Builds and runs the app, sells to government, politician press offices and media, supports operations | Interviews candidates, runs debates and forums, improves participation, hosts local events, helps identify good candidates |
| Money | Subscriptions and licensing (see "How Choseno makes money") | Funded by the company (a fixed share of revenue or profit, set in advance), plus optional grants. Donations are a bonus, never a requirement |
| Accountable to | Owners and investors, within the governance rules below | Its own board and the public |

### Country teams

Each country gets an independent team of the non-profit that knows local politics: it recruits volunteers and staff, organises debates and candidate interviews, and runs the verification events. The company supplies the same platform everywhere, localised.

### Why this works

- **Self-sustaining.** Revenue from software funds civic work, so civic work isn't hostage to donors.
- **Independence from customers.** A profitable company doesn't need any one government or politician to survive.
- **Trust.** The people interviewing candidates and running debates are structurally apart from the people selling to officials.

### Risks and rules to settle with a lawyer and accountant first

Structure and tax rules vary by country, so this needs professional advice before anything is created.

- **Tax and political-activity limits.** In many countries (for example Canada, the US) charities and non-profits have strict limits on political activity. Staying clearly nonpartisan is the only safe route: no endorsements, equal treatment of candidates, and debates open to all.
- **Conflict of interest.** If the company sells to politicians while the foundation interviews and debates them, it looks like pay-to-play. A paying customer must never get better treatment, coverage or access to debates. Publish the rule and enforce it.
- **Governance firewall.** Separate boards, written conflict policies and public disclosure of how much money flows from company to foundation. The foundation's editorial independence should be protected in the agreement.
- **Related-party dealings.** The foundation using the company's platform, brand and data must be done at arm's length with clear contracts, to protect tax status and credibility.
- **Data separation.** The foundation does not get the Ghost-ID mapping or verification records. The privacy promise holds across both entities.
- **Risk of mission drift.** Investors may push the company towards engagement and ad-style growth. The charter or share structure should lock in the principles (nonpartisan, no ads, citizens never the product).
- **Consistency of brand.** One brand with two legal entities can confuse the public. Be clear who is who.

### Open

- Legal form for each entity and country (e.g. corporation + registered non-profit/charity, or a public-benefit company with a foundation as shareholder).
- What share of revenue goes to the foundation, and who decides?
- Who owns the brand and the trust relationship if the two ever disagree?
- Do investors get a say over the foundation? (Recommended: no.)

## Citizen loop

| Step | Citizen role | Choseno phase |
|---|---|---|
| 1. Analyze | Understand candidates and what they stand for | Phase 1 |
| 2. Choose | Vote for the right person for the job | Phase 1 |
| 3. Speak up | Say what you think, safely | Phase 2 |
| 4. Follow up | See whether it is being handled | Phase 3 |
| 5. Hold accountable | Ensure officials do their jobs | Phase 3 |

## No retribution: how it is achieved

The core promise is **people speak; Choseno aggregates; officials and the public see voices and trends, not individuals.**

1. **Ghost IDs, not profiles.** Public content carries a Ghost ID only. The mapping to a real account is not exposed to other users, candidates or officials.
2. **Access to the mapping is minimal and logged.** Limited to the narrowest moderation need.
3. **Aggregates over individuals.** Officials see issue clusters and counts ("142 residents in this district"), never names. A minimum cluster size applies before anything is surfaced to an official.
4. **Free text can identify people.** Anything forwarded to an official is an AI-drafted summary that strips names, addresses and distinctive details. Raw posts are not forwarded.
5. **Verification is separate from content.** The residency record is stored apart from posts with minimal retention. Officials can never query it.

## What AI does here

AI assists and explains. It never decides how someone should vote, and its decisions must be explainable and correctable by a human.

| Job | What it does |
|---|---|
| **Summarize candidate positions** (partly built) | Sourced, comparable summaries. Every claim links to a source. |
| **Moderate for toxicity and coordination [Future]** | Flags threats, doxxing, harassment and signs of coordinated paid campaigns, for human review. |
| **Surface the middle [Future]** | Summarises the range of views on an issue so moderate, considered positions are visible, not just the extremes. |
| **Dedupe, cluster, route, draft tickets [Future]** | Groups reports into issues, finds the right level of government and office, and drafts an actionable ticket (Phase 3). |

## North star

**Weekly verified residents who post or comment on a local race or issue in their own boundary**, especially those who say they would not post on mainstream social media.

Why: it measures the thing we exist to change, which is quiet people starting to speak, and it is anchored to real boundaries so it cannot be inflated by outsiders.

Phase 3 extends this to **issues that reach a documented outcome** (resolved, declined with reason, or unanswered past a deadline).

| Phase | Indicators |
|---|---|
| 1 | Candidate pages viewed, search impressions and rank, returning users |
| 2 | Visitor-to-participant conversion, first-post rate, share of participants who are first-time political posters, comments per thread, toxicity/flag rate, 30-day retention per boundary, sentiment coverage (share of verified residents in a boundary who have spoken) |
| 3 | Issues per 1,000 residents, time to acknowledgment, response rate by office, citizen-confirmed resolution rate |

## Principles

- **Nonpartisan.** Present, don't persuade. Source every claim.
- **Safe to speak.** Anonymity and aggregation by design, not by policy alone.
- **Dignity over engagement.** We will not optimise for outrage, time-on-site or virality.
- **Credible.** Verified residents, transparent counts, explainable routing.
- **Local first.** Give the offices that get the least attention a real voice.

## Risks

- **Anonymous platforms attract abuse.** The one-comment rule, rotation, moderation and verification must hold up before growth, not after.
- **Cold start.** An empty room is worse than none. Seed conversation inside boundaries and races where we already have traffic and candidates.
- **Thin conversation.** One comment per thread may feel restrictive. Needs testing to confirm it raises quality rather than lowering participation.
- **Astroturf despite rotation.** Coordinated actors can still post in volume. Verification and rate limits are the defence.
- **Brand gap (the central challenge).** About 2,000 people visit daily, but almost none are registered. They see Choseno as an information website, not a social network, so they read and leave. We are starting to promote it as the place to speak; the first job is converting readers into registered members. Track visitor-to-registration and registration-to-first-post rates from day one.

## Open questions

- Revenue: what user threshold per boundary justifies the first government pitch? What is the first paying customer (a single municipality, a school board, or a politician's office)?
- Is it credible to host anonymous criticism of politicians while selling them a press service? Does a separate brand or clear structural firewall help?
- Media: do outlets pay for a source feed, or is this a distribution benefit that drives users and credibility instead of revenue?
- Citizen subscription: what exactly do users pay for (running the service, saved data, extra tools)? What price? Does a paid tier risk looking like pay-to-play, and is it worth it versus staying fully free?
- Cost to serve: moderation, verification and AI routing need funding before revenue arrives. What is the runway?
- Ghost ID rotation cadence, and how it interacts with one-comment-per-thread and moderation history.
- How verified residency works at launch, and its cost and friction. Can we launch Phase 2 unverified in a few boundaries first?
- Events: who hosts (us, volunteers, candidates, councils)? How do we stop events being used as partisan rallies or exposing attendees' views? What second source turns "attended" into "lives in this boundary"?
- Minimum cluster size, and how small clusters merge upward.
- Legal exposure: could stored verification or the Ghost-ID mapping be compelled by subpoena or access-to-information requests? Retention and encryption policy must answer this before launch.
- Moderation of defamation and threats against officials, without destroying free speech.
- Role of candidates and officials: can they reply (as verified, named accounts), or only read? Does that break the "no influencers" rule?
- First government partners for Phase 3: municipal, provincial or federal?
- Neutrality audit: how do we show candidate summaries and conversation ranking are even-handed?
