#!/usr/bin/env python3
"""
Builds the BC 2026 "most-discussed this week" article (Oct. 9 edition).

Source research: BC_Election_2026/party_stands_and_buzz_2026-10-09.md, section 3
(ranked by breadth of independent coverage and party response, not by measured
social-media volume).

Writes scripts/bc-election-2026-most-discussed.json and, with --sql <path>, a SQL
file that inserts the article as a DRAFT row in news_articles with politician
tags and a poll (same shape as build-bc-2026-leader-articles.py).
"""
import json, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
EBY_ID = "a730729a-0a3b-4231-b93d-9b5524f9db5e"       # David Eby, Premier
DOERKSON_ID = "67636fda-8ca6-4130-b110-e928f34462d9"  # Lorne Doerkson, MLA
BASE = "https://www.choseno.com"
SLUG = "bc-election-2026-most-discussed-this-week"

HEADLINE = "BC Election 2026: The Most-Discussed Issues This Week"
SUMMARY = (
    "ICBC, the Conservative $1,000 tax cut, the NDP top-earner tax and a dropped candidate "
    "dominated the BC election conversation this week. Here is what each fight is about."
)

BODY = """**Oct. 9, 2026 —** Eighteen days into British Columbia's snap election campaign, the stories drawing the most attention are about money and trust: a leaked Conservative letter on ICBC, two competing tax plans, and a candidate dropped over social media posts. Voting day is Saturday, Oct. 24.

## BC election 2026: key dates

- **Leaders' debate:** Wednesday, Oct. 14, 6:15–8 p.m. PT (David Eby, Lorne Doerkson and Emily Lowan only)
- **Advance voting:** Oct. 16–21
- **Election day:** Saturday, Oct. 24, 2026

Not sure who is running where you live? Use the **find your district** tool below to see every race on your ballot and the candidates in it.

## How the polls look right now

The race is close, with the Conservatives ahead in most polls. Liaison (Oct. 7–8) had the Conservatives at 43%, the NDP at 37% and the Greens at 10%. Angus Reid (Oct. 1–3) had them at 48%, 43% and 7%. Ipsos found 27% of voters undecided. Different polls ask different questions, so treat the numbers as a rough guide, not a forecast.

## 1. The Conservative ICBC letter and "hybrid" insurance plan

The most-covered story this week began on Oct. 6, when a Sept. 29 Conservative letter on auto insurance became public. The letter described replacing ICBC's no-fault system with a hybrid that lets seriously injured people sue, and said "everything's on the table, including opening auto insurance to private competition."

Doerkson's message then shifted. On Oct. 6 he said there were "no promises made by me at all." On Oct. 7 he said he was "absolutely promising" to keep rates in line, and the Conservative plan page says the party would "preserve the right to choose ICBC as a public insurance option." He has said the letter went to about 1,000 people and was never meant to be private.

What nobody has shown is the effect on premiums. The NDP says a hybrid system would double premiums or more, citing comparisons with Alberta. The Conservatives call those numbers invented. We found no independent estimate. On Oct. 8 the NDP promised to freeze basic ICBC rates for three more years and said the average driver would save about $500 a year. CentreBC leader Elenore Sturko has asked Doerkson to release his full ICBC proposal.

## 2. The Conservative $1,000 tax cut

The Conservatives promise to raise the basic personal exemption from $13,216 to $32,000. They say that is worth up to $1,000 a year per worker and about $2,000 for the average couple. The party has not published a costing.

The estimates that exist come from critics. The NDP and UBC tax expert David Duff put the cost at $3 billion to $4 billion a year. The NDP first said $2.5 billion, then corrected to "$3–4 billion" citing experts. The Canadian Taxpayers Federation called it "a big and clear tax cut." Daily Hive noted the credit is non-refundable, so people who owe no provincial tax get no direct savings.

## 3. The NDP top-earner tax, or what the Conservatives call the "doctor tax"

The NDP would raise income tax by two percentage points on the top two brackets and add a 24.5% bracket on income over $1 million, starting with the 2027 tax year. The party says it raises about $1 billion a year by 2028/29 and that more than 96% of taxpayers pay nothing more.

The revenue estimate is disputed. SFU economist David Freeman estimated it could be closer to $500 million once high earners adjust their behaviour. CCPA economist Marc Lee described it as a "tax shift" that leaves households under roughly $150,000–$160,000 better off. Doerkson said the tax "may even drive doctors from our province," and the NDP replied that an average full-time family physician, at about $385,000 a year, would pay about $3,891 more. We found no public response from Doctors of BC.

## 4. A Conservative candidate dropped

The Conservatives dropped Victoria-Beacon Hill candidate Joachim Agou on Oct. 8 over social media posts the NDP called racist. Agou apologized on Oct. 9. His name stays on the ballot, because nominations closed on Oct. 3 and he remains on Elections BC's candidate list. Eby called the posts "a disgrace" and questioned how the party vets candidates. Conservative-friendly commentators praised how quickly Doerkson acted.

## 5. The timing of the election

The decision to call a snap election is still a sore point. Ipsos found 50% of British Columbians disapprove of holding an election now and 32% approve. Mainstreet put disapproval at 59.3%. Disapproval is much higher among Conservative supporters (64%) than among NDP voters (34%). Municipal elections on Oct. 17 add to the frustration for some local candidates.

## 6. NDP grocery rules, the gas tax pause and a cancelled rebate

The NDP promises to suspend the 10-cent-a-litre provincial fuel tax and to cap retail margins on staples such as milk, eggs, cheese, butter and poultry. The party says gas could drop by up to about 30 cents a litre and groceries could be up to $700 a year cheaper. Critics point out that the NDP cancelled a $1,000 grocery rebate in February 2025. Economists have been skeptical: the Retail Council of Canada said the grocery announcement "misses the mark," and a UBC economist said global oil prices would limit the effect at the pump.

## 7. The NDP unsold condo tax

The NDP would add a tax on finished condos that sit empty for more than a year, starting at 2% and rising one percentage point a year, and raise the speculation and vacancy tax. The party says it could unlock up to 5,000 condos. Home builders and industry groups have called it punitive. The Conservatives oppose the condo tax but have not yet said what they would do about housing costs.

## 8. DRIPA and Indigenous land title

The debate over the Declaration on the Rights of Indigenous Peoples Act gets a lot of media attention. The Conservatives and OneBC would repeal it. We found no clear 2026 campaign position from the NDP, the Greens or CentreBC. The topic matters less to voters in polls: Ipsos found only 7% name land use, property rights and DRIPA as a top issue, and Angus Reid found 14%.

## Also in the conversation

- **Pacific Link pipeline and LNG:** Sharply divided, with business supportive and the Greens and several environmental voices opposed. Few voters rank energy as a top issue.
- **SOGI 123:** The Conservatives and OneBC would repeal it; the Greens support it. Parents are split, and education ranks low as a voting issue.
- **Child care:** Advocates say the $10-a-day promise has been "forgotten" on the campaign trail, and the NDP has paused new enrolment for three years.

## What voters say matters most

The loudest stories are not always the biggest voting issues. Ipsos found the top three are cost of living (56%), health care (39%) and housing (31%). Angus Reid had cost of living at 57% and health care at 42%. Two of this week's top stories, the tax plans and the ICBC fight, are really about the first of those.

## How we ranked these stories

There is no single reliable measure of "most discussed." We ranked these by how widely independent news outlets and columnists covered them from Oct. 2 to Oct. 9, whether rival parties kept responding to them, and what public reaction we could see. That is a judgment, not a measurement. Social media samples we could read were small, and we could not read Reddit comments or news-site comment sections, so we do not claim to know what most voters think. Dollar figures and savings are party claims unless an economist or news outlet is named. No party has released a full costed platform.

## Frequently asked questions

**What is the most talked-about issue in the BC election this week?**

The Conservative ICBC letter and hybrid insurance plan drew the most coverage, followed by the Conservatives' $1,000 tax cut and the NDP's top-earner tax.

**What are voters' top issues in the 2026 BC election?**

Cost of living, health care and housing. Ipsos found 56%, 39% and 31% of voters named them in their top three.

**When is the BC election and the leaders' debate?**

The election is Saturday, Oct. 24, 2026, and advance voting runs Oct. 16–21. The leaders' debate is on Wednesday, Oct. 14, from 6:15 to 8 p.m. PT.

**Who is ahead in the BC election polls?**

The Conservatives lead most polls, but the race is close and many voters are undecided. See the poll figures above for the most recent results.

## Have your say

Choseno is like Google Reviews for politicians. Vote in the poll above, then rate and review the leaders on their Choseno walls: [David Eby](/wall/david-eby-premier) and [Lorne Doerkson](/wall/lorne-doerkson-mla).

## More BC election 2026 coverage

- [BC snap election 2026: why an informed vote matters](/news/bc-provincial-snap-election-2026-informed-vote)
- [BC election 2026: where each party stands](/news/bc-election-2026-where-each-party-stands)
- [Why people support David Eby](/news/why-people-support-david-eby-bc-election-2026)
- [Why people don't support David Eby](/news/why-people-oppose-david-eby-bc-election-2026)
- [Why people support Lorne Doerkson](/news/why-people-support-lorne-doerkson-bc-election-2026)
- [Why people don't support Lorne Doerkson](/news/why-people-oppose-lorne-doerkson-bc-election-2026)
"""

SOURCES = [
    ("Choseno — BC election 2026: where each party stands", f"{BASE}/news/bc-election-2026-where-each-party-stands"),
    ("Elections BC", "https://elections.bc.ca"),
    ("Global News: B.C. Conservatives plan to repeal no-fault insurance", "https://globalnews.ca/news/12090331/bc-conservatives-plan-no-fault-insurance-repeal/"),
    ("Global News: BC NDP and Conservatives on ICBC rates", "https://globalnews.ca/news/12092908/bc-ndp-bc-conservatives-icbc-rates/"),
    ("Vancouver Sun: Vaughn Palmer on Doerkson's first big problem", "https://vancouversun.com/opinion/vaughn-palmer-bc-conservative-leader-lorne-doerkson-first-big-problem-of-campaign"),
    ("The Tyee: Doerkson stumbles into first campaign crisis", "https://thetyee.ca/Opinion/2026/10/08/Doerkson-Stumbles-into-First-Campaign-Crisis/"),
    ("Daily Hive: Conservative annual income tax cut promise", "https://dailyhive.com/vancouver/bc-conservatives-election-annual-income-tax-cut-promise"),
    ("Vancouver Sun: Conservative tax cut could blow a $4-billion hole, tax expert says", "https://vancouversun.com/news/bc-conservatives-promise-tax-cut-could-blow-4-billion-hole-provincial-budget-tax-expert"),
    ("Canadian Taxpayers Federation: B.C. Conservatives right to promise income tax cut", "https://www.taxpayer.com/newsroom/b.c.-conservatives-right-to-promise-income-tax-cut"),
    ("CBC: New millionaires tax, Eby promise", "https://www.cbc.ca/news/canada/british-columbia/new-millionaires-tax-eby-promise-9.7368961"),
    ("CHEK News: Eby defends proposed tax hike", "https://cheknews.ca/rob-shaw-eby-defends-proposed-tax-hike-as-conservatives-warn-it-could-drive-doctors-away-1351601/"),
    ("Vancouver Sun: Tax promises won't move the needle on the deficit, experts say", "https://vancouversun.com/news/bc-election-tax-promises-ndp-conservatives-wont-move-needle-on-deficit-say-experts"),
    ("BC NDP: Fact check on Conservative claims about doctors", "https://www.bcndp.ca/releases/fact-check-conservative-claims-doctors-do-not-match-reality"),
    ("The Tyee: No excuse, Doerkson fires Conservative candidate", "https://thetyee.ca/News/2026/10/08/No-Excuse-Doerkson-Fires-Conservative-Candidate/"),
    ("CityNews: Conservative candidate dropped over social media posts", "https://vancouver.citynews.ca/2026/10/09/bc-election-conservative-candidate-dropped-social-media-posts/"),
    ("Ipsos: BC poll release", "https://www.ipsos.com/sites/default/files/ct/news/documents/2026-10/BC%20Poll%201%20Release.pdf"),
    ("Retail Council of Canada: BC NDP grocery announcement misses the mark", "https://www.retailcouncil.org/bc-ndp-grocery-announcement-misses-the-mark/"),
    ("Vancouver Sun: Can the BC NDP cap industry margins on diesel and gas?", "https://vancouversun.com/news/can-bc-ndp-cap-industry-margins-on-diesel-and-gas"),
    ("The Globe and Mail: Eby's tax on unsold condos draws industry criticism", "https://www.theglobeandmail.com/real-estate/vancouver/article-david-eby-election-promise-tax-unsold-condos-industry-criticism/"),
    ("The Narwhal: DRIPA is now an election issue", "https://thenarwhal.ca/bc-election-2026-dripa/"),
    ("CBC: SOGI 123 and BC's provincial parties", "https://www.cbc.ca/news/canada/british-columbia/sogi-123-bc-provincial-parties-election-9.7359291"),
    ("CBC: Child care advocates say the universal promise is forgotten", "https://www.cbc.ca/news/canada/british-columbia/child-care-advocates-universal-promise-forgotten-9.7375230"),
]

# The article page doesn't render content.sources, so cite them in the body too.
BODY += "\n## Sources\n\n" + "\n".join(f"- [{l}]({u})" for l, u in SOURCES)

POLL = ("Which of this week's stories matters most to your vote?", [
    "The Conservative ICBC plan",
    "The Conservative $1,000 tax cut",
    "The NDP top-earner tax",
    "The NDP grocery and gas promises",
    "The NDP unsold condo tax",
    "Candidate conduct and vetting",
    "The snap election call",
    "DRIPA and Indigenous land title",
    "None of these: it comes down to my local candidate",
])

article = dict(
    slug=SLUG, headline=HEADLINE, summary=SUMMARY, body=BODY,
    seoTitle="BC Election 2026: Most-Discussed Issues This Week",
    metaDescription="What is BC talking about in the 2026 election? The ICBC letter, two tax plans, a dropped candidate and more, ranked, with poll numbers. Vote in our poll.",
    tags=["BC Election 2026", "ICBC", "Tax Policy", "BC NDP", "BC Conservatives"],
    taggedPoliticians=["David Eby", "Lorne Doerkson"], politicianIds=[EBY_ID, DOERKSON_ID],
    tweet="What is B.C. talking about in the 2026 election? ICBC, two tax plans and a dropped candidate top the week. See what each fight is about, then vote in the poll.",
    tweetmedium="Which BC election story matters most to your vote this week? Vote on Choseno.",
    author={"name": "Choseno Civic News Desk", "bio": "Civic and political reporting"},
    sources=[{"label": l, "url": u} for l, u in SOURCES],
)
article["tweetarticle"] = (
    f"{HEADLINE.upper()}\n\n{SUMMARY}\n\nVoting day is Sat., Oct. 24; advance voting runs Oct. 16-21.\n\n"
    f"NOW YOU HAVE THE SAY -- CHOSENO:\nChoseno is like Google Reviews for politicians. Vote in the poll and see where your neighbors stand:\n"
    f"{BASE}/news/{SLUG}\n\n#BCElection2026 #Choseno"
)

out = os.path.join(HERE, "bc-election-2026-most-discussed.json")
with open(out, "w") as f:
    json.dump(article, f, indent=2, ensure_ascii=False)
print("wrote", out)


def q(s):
    return "$q$" + s + "$q$"


if "--sql" in sys.argv:
    path = sys.argv[sys.argv.index("--sql") + 1]
    a = article
    content = {
        "body": a["body"], "tags": a["tags"], "tweet": a["tweet"], "tweetmedium": a["tweetmedium"],
        "tweetarticle": a["tweetarticle"], "author": a["author"], "sources": a["sources"],
        "seoTitle": a["seoTitle"], "metaDescription": a["metaDescription"], "viral_score": 9.5,
        "taggedPoliticians": a["taggedPoliticians"], "primaryPoliticianName": a["taggedPoliticians"][0],
        "breakingNews": False,
    }
    question, opts = POLL
    sql = f"""BEGIN;

WITH ins AS (
  INSERT INTO news_articles (slug, headline, summary, category, country, province, status, impact_area, event_date, content)
  VALUES ({q(a['slug'])}, {q(a['headline'])}, {q(a['summary'])}, 'Elections', 'CA', 'BC', 'draft', 'state', '2026-10-09', {q(json.dumps(content, ensure_ascii=False))}::jsonb)
  RETURNING id
), pol AS (
  INSERT INTO news_article_politicians (news_article_id, politician_id)
  SELECT id, pid FROM ins, (VALUES {", ".join(f"('{i}'::uuid)" for i in a['politicianIds'])}) AS v(pid)
)
SELECT id FROM ins;

WITH p AS (
  INSERT INTO news_article_polls (news_article_id, question, sort_order)
  SELECT id, {q(question)}, 0 FROM news_articles WHERE slug = {q(a['slug'])}
  RETURNING id
)
INSERT INTO news_article_poll_options (poll_id, label, sort_order)
SELECT p.id, o.label, o.ord FROM p, (VALUES {", ".join(f"({q(l)}, {i})" for i, l in enumerate(opts))}) AS o(label, ord);

COMMIT;
"""
    with open(path, "w") as f:
        f.write(sql)
    print("wrote", path)
