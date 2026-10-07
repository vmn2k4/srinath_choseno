#!/usr/bin/env python3
"""
Builds the four BC 2026 "why people support / oppose" leader articles.

Writes scripts/bc-election-2026-leader-support-oppose.json (article source of
truth, same shape as bc-election-2026-party-standings.json plus a `polls`
array) and, with --sql <path>, a SQL file that inserts them as DRAFT rows in
news_articles with politician tags and polls.

Source research: public Reddit / X / YouTube posts collected Oct 6, 2026.
Views are attributed to online commenters in aggregate; no handles are named.
"""
import json, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
EBY_ID = "a730729a-0a3b-4231-b93d-9b5524f9db5e"       # David Eby, Premier
DOERKSON_ID = "67636fda-8ca6-4130-b110-e928f34462d9"  # Lorne Doerkson, MLA

BASE = "https://www.choseno.com"
STANDS = "/news/bc-election-2026-where-each-party-stands"
SLUG_SE = "why-people-support-david-eby-bc-election-2026"
SLUG_OE = "why-people-oppose-david-eby-bc-election-2026"
SLUG_SD = "why-people-support-lorne-doerkson-bc-election-2026"
SLUG_OD = "why-people-oppose-lorne-doerkson-bc-election-2026"
SLUG_HUB = "bc-provincial-snap-election-2026-informed-vote"

DATELINE = "**VICTORIA, B.C. — Oct. 6, 2026 —** "

KEY_DATES = """## BC election 2026: key dates

- **Election day:** Saturday, Oct. 24, 2026
- **Advance voting:** Oct. 16–21
- **Called:** Sept. 22, 2026, about two years early

Not sure who is running where you live? Use the **find your district** tool below to see every race on your ballot and the candidates in it."""

HOW_WE_KNOW = """## How we gathered this

This is a qualitative read of public posts, not a poll. Choseno reviewed public comments on Reddit (r/britishcolumbia, r/vancouver, r/BCpolitics, r/VictoriaBC and others), X and YouTube from late September to Oct. 6, 2026, and grouped the recurring arguments. Online commenters skew louder and more partisan than the average voter, and Reddit leans younger and more urban. The claims below are what commenters say, not verified findings by Choseno."""


def cross(links):
    return "\n".join(f"- [{t}]({u})" for t, u in links)


SEE_ALSO = cross([
    ("BC snap election 2026: why an informed vote matters", f"/news/{SLUG_HUB}"),
    ("BC election 2026: where each party stands", STANDS),
    ("Why people support David Eby", f"/news/{SLUG_SE}"),
    ("Why people don't support David Eby", f"/news/{SLUG_OE}"),
    ("Why people support Lorne Doerkson", f"/news/{SLUG_SD}"),
    ("Why people don't support Lorne Doerkson", f"/news/{SLUG_OD}"),
])


def faq(items):
    return "## Frequently asked questions\n\n" + "\n\n".join(f"**{q}**\n\n{a}" for q, a in items)


COMMON_SOURCES = [
    {"label": "Choseno — BC election 2026: where each party stands", "url": f"{BASE}{STANDS}"},
    {"label": "Elections BC", "url": "https://elections.bc.ca"},
]

articles = []

# ───────────────────────── 1. Why people support Eby ─────────────────────────
body = DATELINE + """With British Columbia heading to the polls on Oct. 24, 2026, many voters are asking the same question: why would anyone vote for Premier David Eby's BC NDP in this snap election? Public posts on Reddit, X and YouTube point to one reason far above the rest, and it isn't enthusiasm for Eby himself.

""" + KEY_DATES + """

## The short answer: "the Conservatives would be worse"

By a wide margin, the most common reason people give for backing Eby is to keep the BC Conservatives out. Supporters describe the Conservatives as chaotic or too close to the federal right, and worry about cuts or privatization in health care, changes to ICBC, and rollbacks of renter and housing rules. Many say so while openly disliking Eby, with the phrase "hold my nose" turning up again and again.

Plenty of these voters also say they are angry about the snap election call. One common version: they will vote NDP, but did not want to be asked to this early.

## Housing: zoning, Airbnb limits and vacancy taxes

The strongest argument for Eby's own record is housing. Supporters credit his government with province-wide zoning changes that allow fourplexes and multiplexes, limits on short-term rentals such as Airbnb, speculation and vacancy taxes, and rent caps tied to inflation. Several commenters call him the first premier in decades to actually take on housing costs, and fear a Conservative government would undo those rules.

Younger voters and renters are over-represented in this group. Some say the zoning changes are the first thing that gave them or their kids a realistic chance at a home.

## Health care: more family doctors, hospitals and a new med school

Supporters point to more people matched with a family doctor, new and expanded hospitals, thousands of new nurses and a new medical school at SFU. Some describe their own experience: getting a family doctor after months on a waitlist. Others, including people caring for a family member in treatment, say they fear funding cuts under a Conservative government.

Not everyone agrees. Even some supporters note that specialist access is still slow, and critics (see below) say the system still feels broken.

## Cost of living: no MSP premiums, ICBC rates and renter help

Posts in this group often take the form of a list: no MSP premiums, ICBC rate reductions and rebates, a renter's credit, an expanded BC Family Benefit, minimum wage indexed to inflation, school meals, paid sick days and interest-free student loans. For supporters, the point is stability: they say these programs add up and would be at risk under a change of government.

## A solid, competent government, with a deficit seen as investment

Some supporters argue the NDP is simply running a competent government. They accept that Eby is a weak communicator and has changed course on some decisions, but see that as a government correcting mistakes. On the deficit, they say borrowing is funding hospitals, hiring and infrastructure, and that the province is better off than when he started.

## Standing up to Trump

On X and YouTube more than Reddit, supporters back Eby's framing of this election around the Canada–U.S. trade fight, citing his pushback on U.S. tariffs and support for the forestry sector. Many Reddit supporters actually dislike that framing and want him to campaign on his record instead.

## Labour and public-sector workers

Some union and trades workers say the NDP is the only party that has stood by unions, and that austerity would hit jobs tied to public investment. This view is contested: many public-sector workers are angry about recent bargaining and say they are leaving.

## Who these supporters appear to be

Based on what posters say about themselves: progressive and Green-leaning voters voting strategically in close ridings, renters and young families, union and trades workers, patients and caregivers worried about health-care cuts, LGBTQ and minority voters concerned about the Conservatives' social agenda, and older voters who remember the BC Liberal years.

## The caveats supporters raise themselves

- **Anger at the snap election.** Nearly universal, even among supporters.
- **Party over leader.** Many say they like the NDP more than Eby, and some miss John Horgan.
- **Tax backlash.** A proposed higher tax bracket starting around $190,000 income drew a wave of "this lost my vote" replies, though a few higher earners said they would still vote NDP.
- **Left-wing complaints** that the party drifted right on drugs, resource projects and tenancy rules.

""" + faq([
    ("Why do people support David Eby?", "The most common reason is to prevent a Conservative government. Others credit his housing reforms, health-care hiring, cost-of-living programs and his stand against U.S. trade pressure."),
    ("Is David Eby popular in BC?", "Online sentiment is mixed. Reddit commenters often dislike Eby personally while still voting NDP. YouTube and X comment sections lean more strongly against him. This is not a poll, and polls have shown the race close or the Conservatives ahead."),
    ("When is the BC election?", "Saturday, Oct. 24, 2026. Advance voting runs Oct. 16–21."),
    ("What is David Eby's housing record?", "Supporters point to multiplex zoning, limits on short-term rentals, vacancy and speculation taxes, and rent caps. Critics say housing remains unaffordable."),
]) + """

## Have your say

Choseno is like Google Reviews for politicians. Vote in the polls above, then [rate and review David Eby on his Choseno wall](/wall/david-eby-premier) and see where your neighbors stand.

## More BC election 2026 coverage

""" + SEE_ALSO

articles.append(dict(
    slug=SLUG_SE,
    headline="Why People Support David Eby in the 2026 BC Snap Election",
    summary="What voters say they like about Premier David Eby and the BC NDP ahead of Oct. 24: housing, health care, cost of living and keeping the Conservatives out.",
    seoTitle="Why People Support David Eby: BC Election 2026",
    metaDescription="Why do voters back David Eby and the BC NDP in the 2026 snap election? Housing, health care, cost of living and fear of the alternative. Vote in our poll.",
    tags=["BC Election 2026", "David Eby", "BC NDP", "Housing Policy", "Health Care"],
    taggedPoliticians=["David Eby"], politicianIds=[EBY_ID],
    tweet="Why do people still back Premier David Eby in B.C.'s 2026 snap election? Housing, health care and fear of the alternative top the list. Vote in the poll.",
    tweetmedium="Do you agree with David Eby's housing and health-care record? Review him on Choseno.",
    body=body,
    polls=[
        ("What do you like most about David Eby?", [
            "His housing reforms (zoning, Airbnb limits, vacancy tax)",
            "Health care progress (family doctors, hospitals)",
            "Cost-of-living programs (no MSP, ICBC, renter credit)",
            "Standing up to Trump",
            "Not being the Conservatives",
            "Nothing, I don't like him",
        ]),
        ("Will you vote for the BC NDP on Oct. 24?", [
            "Yes, enthusiastically",
            "Yes, but holding my nose",
            "No, voting for another party",
            "Still undecided",
        ]),
    ],
))

# ───────────────────────── 2. Why people oppose Eby ─────────────────────────
body = DATELINE + """Premier David Eby called a snap election for Oct. 24, 2026, and a lot of British Columbians are not happy about it. Public posts on Reddit, X and YouTube show a wave of anger aimed at Eby personally, much of it from people who say they voted NDP before. Here are the most common reasons voters say they don't want him re-elected.

""" + KEY_DATES + """

## 1. The snap election itself

The single biggest source of anger after Sept. 22 is the election call. Critics say Eby still had roughly two years and a majority, and called the vote right after Conservative leader Kerry-Lynne Findlay resigned, while the opposition was in disarray. Common complaints:

- It looks like political opportunism, and some call it incompetence for letting the Conservatives regroup.
- It costs taxpayers tens of millions of dollars (some posts say far more, but those figures are unverified).
- It pushed aside municipal issues and left people feeling forced to vote.
- Framing it as a fight with Donald Trump, critics say, dodges BC's own problems.

Even some NDP supporters say they will vote for the party "but hate Eby for making me do this."

## 2. The "millionaire tax" that starts near $190,000

In the days around Oct. 4–5, a proposed higher tax bracket starting at about $190,000 of income set off a flood of posts. The argument isn't mainly about the policy. It's about the label: commenters say calling it a tax on millionaires is misleading, since it hits doctors, tech workers, specialists, dual-income households and some trades, while people holding millions in assets are untouched.

Several people who say they voted NDP last time wrote that this "lost my vote." Others said they would sit the election out or vote Conservative or Green.

## 3. Deficit and debt

Critics blame Eby's government for moving from a surplus to multi-billion-dollar deficits and rising provincial debt, and say tax increases are cleaning up mismanagement rather than paying for better services. A recurring contrast is with former premier John Horgan, who many describe as more measured. (Dollar figures in these posts are commenters' claims, not Choseno's.)

## 4. Drugs, "safe supply" and public disorder

A durable theme from the 2024 election carried into this one. Opponents link Eby-era drug policy, including decriminalization and safe supply, to visible disorder, overdoses and theft, and say his later "get tough" turn came too late. Some lifelong NDP voters say the flip-flopping eroded their trust.

## 5. Leadership: "I liked Horgan, I don't like Eby"

Many posts aren't about one policy at all. They describe Eby as having poor political instincts, weak messaging and unclear direction. Some say they want the NDP to win but Eby to step aside afterward, while others on the left say he has pushed the party to the right.

## 6. Property rights, DRIPA and housing

Homeowners and right-leaning voters cite concerns about property rights, Indigenous title uncertainty under the Declaration on the Rights of Indigenous Peoples Act (DRIPA), and density rules. Others say housing is still unaffordable despite years of NDP action.

## 7. Health care still feels broken

Unlike supporters who credit new family doctors, opponents say wait times and the number of people without a family doctor prove the government has failed, and that higher taxes won't fix it.

## Who these critics appear to be

High earners and professionals in Metro Vancouver near the $190,000 line; blue-collar workers who reject being called millionaires; homeowners in areas affected by crime and disorder; interior and rural voters; lifelong NDP supporters now leaning Green or staying home; and committed Conservatives who want him out.

## What critics say they will do

- **Vote Conservative to remove Eby,** sometimes while disliking the party's chaos.
- **Switch to the Greens** (a lifelong-NDP pattern).
- **Sit it out.**
- **Vote NDP anyway** because they see the Conservatives as worse. This is common on Reddit, and it is the other side of the coin of the support case.

""" + HOW_WE_KNOW + """

""" + faq([
    ("Why don't people want David Eby re-elected?", "The most cited reasons are the snap election call, a proposed higher tax bracket starting near $190,000, the deficit and debt, drug and public-safety policy, and doubts about his leadership compared with John Horgan."),
    ("Why did Eby call an early election?", "Eby called the vote on Sept. 22, 2026, about two years early, arguing voters deserve a say amid the Canada–U.S. trade fight. Critics call it opportunistic."),
    ("What is the BC millionaire tax?", "A proposed higher income tax bracket announced around Oct. 4–5, 2026 that starts at roughly $190,000. Critics say that threshold hits professionals, not just millionaires."),
    ("Who could replace Eby?", "Polls have shown the BC Conservatives, led on an interim basis by Lorne Doerkson, competitive or ahead. See our [explainer on why people oppose Doerkson](/news/" + SLUG_OD + ") and [why people support him](/news/" + SLUG_SD + ")."),
]) + """

## Have your say

Tell us what you think. Vote in the polls above, then [rate and review David Eby on his Choseno wall](/wall/david-eby-premier).

## More BC election 2026 coverage

""" + SEE_ALSO

articles.append(dict(
    slug=SLUG_OE,
    headline="Why People Don't Want David Eby Re-elected in BC's 2026 Snap Election",
    summary="From the snap election call to a $190K tax bracket, deficits and drug policy: the most common reasons voters say they won't back Premier David Eby on Oct. 24.",
    seoTitle="Why People Don't Support David Eby: BC Election 2026",
    metaDescription="Why do some BC voters oppose David Eby in the 2026 snap election? The snap call, the $190K tax bracket, deficit, drugs and leadership. Vote in our poll.",
    tags=["BC Election 2026", "David Eby", "BC NDP", "BC Taxes", "Snap Election"],
    taggedPoliticians=["David Eby"], politicianIds=[EBY_ID],
    tweet="Why are so many B.C. voters angry at Premier David Eby? The snap election, a $190K tax bracket and the deficit lead the list. Tell us what bothers you most.",
    tweetmedium="Do you agree with David Eby's call for a snap election and new tax bracket? Review him on Choseno.",
    body=body,
    polls=[
        ("What do you dislike most about David Eby?", [
            "Calling the snap election",
            "The tax bracket starting around $190K",
            "The deficit and debt",
            "Drug policy and public disorder",
            "His leadership and messaging",
            "Property rights and DRIPA",
            "Health care still feels broken",
            "Nothing, I'm fine with him",
        ]),
        ("What will you do on Oct. 24?", [
            "Vote NDP anyway",
            "Vote Conservative to get Eby out",
            "Vote Green or another party",
            "Sit this one out",
            "Still undecided",
        ]),
    ],
))

# ──────────────────────── 3. Why people support Doerkson ────────────────────────
body = DATELINE + """Lorne Doerkson became interim leader of the BC Conservatives after Kerry-Lynne Findlay resigned on Sept. 20, 2026, just two days before Premier David Eby called a snap election for Oct. 24. Polls have shown the Conservatives competitive or ahead. So why are some British Columbians planning to vote for him? Public posts on Reddit, X and YouTube give a clear answer, and it is mostly about Eby.

""" + KEY_DATES + """

## 1. "Anyone but Eby"

By far the loudest pro-Conservative reason is wanting the NDP out. Many supporters barely mention Doerkson, and instead cite:

- The provincial deficit and debt.
- The Oct. 4–5 proposed tax bracket starting around $190,000, which several commenters said pushed them to switch.
- Anger at the snap election.
- Drug policy, crime and public disorder.

Some say they usually don't vote Conservative but are willing to "give them a shot." A few say they don't even know their local candidate and will vote Conservative regardless.

## 2. Doerkson as the "normal, steady" alternative

After the turmoil that ended Findlay's leadership, supporters and some fence-sitters describe Doerkson as calm, moderate and premier-like. Commenters said they were surprised at how quickly he looked like a credible leader, and some described him as a decent person who "only needs to look stable." Others are more cautious, saying a "wolf in sheep's clothing" is preferable to the current government. Doerkson is a former rodeo rider and the Cariboo-Chilcotin MLA.

## 3. Fiscal restraint, resources and property rights

Supporters point to the party's pledge to balance the budget through deregulation and productivity rather than cuts (Doerkson has said he has no detailed path yet), its support for resource industries including energy, and its position on repealing the Declaration on the Rights of Indigenous Peoples Act (DRIPA), which Doerkson has called his top priority. Some commenters frame the choice simply as "if you're anti private property, vote NDP."

## 4. ICBC and no-fault insurance

A smaller group argues that opening ICBC to competition or changing no-fault rules would help crash victims. Others defend the idea, saying Doerkson is not proposing to double rates but to change no-fault laws.

## 5. "The interim-leader arguments don't matter"

Opponents have questioned whether an interim leader can stay on. Supporters answer that if the Conservatives win, Doerkson remains premier as long as he has the confidence of the legislature, whether or not he is party leader. The party's board has said he'd remain if elected.

## Who the supporters appear to be

- **Anti-Eby switchers**, including higher earners hit by the proposed tax bracket.
- **Centrists** who disliked the Findlay-era culture-war brand but find Doerkson palatable.
- **Interior and small-city voters**, and resource-sector supporters.
- **True-right voters** who may prefer OneBC but will vote Conservative where OneBC has no candidate.

## Caveats

- **Much of the support is anti-NDP, not pro-Doerkson.** Direct praise for him by name is thinner than for the party.
- **He is new and relatively unknown.** Many voters are judging the party, not the man.
- **Split on the right.** Some Conservatives and OneBC voters call him too much of a "rebadged Liberal."
- **Reddit under-represents these voters.** YouTube and X carry more raw Conservative enthusiasm.

""" + HOW_WE_KNOW + """

""" + faq([
    ("Who is Lorne Doerkson?", "Lorne Doerkson is the MLA for Cariboo-Chilcotin and the interim leader of the BC Conservatives after Kerry-Lynne Findlay resigned on Sept. 20, 2026."),
    ("Why do people support Lorne Doerkson?", "Mostly to remove David Eby and the NDP over the deficit, taxes and public safety. Others like his calm, steady image and the party's focus on fiscal restraint and resources."),
    ("Could Lorne Doerkson become premier?", "If the Conservatives win the most seats and have the confidence of the legislature, he would be premier. Opponents dispute whether he can stay leader long term; see our [explainer](/news/" + SLUG_OD + ")."),
    ("When is the BC election?", "Saturday, Oct. 24, 2026. Advance voting runs Oct. 16–21."),
]) + """

## Have your say

Vote in the polls above, then [rate and review Lorne Doerkson on his Choseno wall](/wall/lorne-doerkson-mla) and see where your neighbors stand.

## More BC election 2026 coverage

""" + SEE_ALSO

articles.append(dict(
    slug=SLUG_SD,
    headline="Why People Support Lorne Doerkson in the 2026 BC Snap Election",
    summary="Why some B.C. voters plan to back interim Conservative leader Lorne Doerkson on Oct. 24: anger at the NDP, a steady image and a push for fiscal restraint.",
    seoTitle="Why People Support Lorne Doerkson: BC Election 2026",
    metaDescription="Why do voters back Lorne Doerkson and the BC Conservatives in the 2026 snap election? Anti-Eby sentiment, a steady image, fiscal restraint. Vote in our poll.",
    tags=["BC Election 2026", "Lorne Doerkson", "BC Conservatives", "David Eby", "DRIPA"],
    taggedPoliticians=["Lorne Doerkson"], politicianIds=[DOERKSON_ID],
    tweet="Why are B.C. voters backing interim Conservative leader Lorne Doerkson in the 2026 snap election? Mostly anger at the NDP, but also his steady image. Vote in the poll.",
    tweetmedium="Do you agree with Lorne Doerkson's plan to repeal DRIPA and balance the budget? Review him on Choseno.",
    body=body,
    polls=[
        ("What do you like most about Lorne Doerkson and the BC Conservatives?", [
            "Time for a change from Eby and the NDP",
            "Doerkson's calm, steady image",
            "Balancing the budget and fiscal restraint",
            "Repealing DRIPA and property-rights stance",
            "Resource and energy development",
            "ICBC reform",
            "Nothing, I don't support him",
        ]),
        ("Will you vote for the BC Conservatives on Oct. 24?", [
            "Yes, enthusiastically",
            "Yes, mainly to remove the NDP",
            "No, voting for another party",
            "Still undecided",
        ]),
    ],
))

# ──────────────────────── 4. Why people oppose Doerkson ────────────────────────
body = DATELINE + """Lorne Doerkson is the interim leader of the BC Conservatives, who have been competitive or ahead in polls ahead of the Oct. 24, 2026 provincial election. But public posts on Reddit, X and YouTube show a lot of voters who say they won't back him, and the criticism comes from both the left and the right. Here are the most common reasons.

""" + KEY_DATES + """

## 1. The Human Rights Code vote

The most repeated named criticism of Doerkson on Reddit concerns a February 2026 private member's bill to repeal BC's Human Rights Code. Commenters repeatedly paste the list of 37 Conservative MLAs who voted for it, a list that includes Doerkson, and warn the party would try again with a majority. This is the issue most often cited by LGBTQ and equity-minded voters.

## 2. Candidates and the "extremist" question

Critics say Doerkson has not purged the party's right flank. They point to his refusal to fire two candidates, Heather Maahs and Anna Kindy, over comments critics describe as anti-LGBTQ and anti-vaccine. For these voters, the controversy shows the party hasn't moderated since Kerry-Lynne Findlay. (Choseno has not independently verified every statement attributed to individual candidates.)

## 3. Interim leader, unknown quantity

A large share of posts focus on the fact that Doerkson is an interim leader. Critics argue:

- Under the party's constitution an interim leader cannot simply stay on as leader, and some predict legal challenges.
- Voters may be electing a placeholder who is replaced later, sometimes naming Caroline Elliott or former BC Liberals.
- He has little name recognition and the party lacks a full platform.

Supporters dispute this (see [why people support Doerkson](/news/""" + SLUG_SD + """)); the legal questions have not been tested.

## 4. "Fake Conservative" or "Christy Clark Liberal"

Doerkson is a former BC Liberal and is criticized from both flanks at once. From the left, commenters warn a Conservative government would bring Liberal-era cuts. From the right and from OneBC supporters, he is a "leftist Liberal" or "rebadged Liberal" who distanced himself from some candidates and isn't conservative enough.

## 5. MAGA, culture-war and social-policy fears

Left-leaning critics say a Conservative government would be influenced by "MAGA-style" politics, citing past statements about SOGI 123 school resources and DRIPA. From the other side, some voters say he isn't hard-right enough on those same issues.

## 6. ICBC and public services

Critics fear privatized or more expensive auto insurance, cuts to public services and benefits for wealthy backers. They cite Doerkson's comments on changing ICBC's no-fault system.

## 7. Judgment and science

Some commenters cite a letter Doerkson wrote on MLA letterhead supporting a controversial ostrich farm in a dispute with federal authorities, arguing it shows poor judgment. Others point to his reported reluctance to take a position on human-caused climate change. These claims come from commenters; read the underlying reports for context.

## 8. Conservatives angry about how Findlay was removed

Some conservative voters say they won't vote for the party because Findlay was chosen by members while Doerkson was not, and they don't want to reward the leadership turmoil.

## Who these critics appear to be

Progressive Reddit regulars, LGBTQ and equity-minded voters, NDP-leaning voters who dislike Eby but see the Conservatives as worse, ICBC defenders, and hard-right voters on X and YouTube.

## A note on "voting Conservative only to stop Eby"

A frequent warning from opponents is that anger at Eby shouldn't lead to "teaching him a lesson" by voting for a party whose positions you don't support.

""" + HOW_WE_KNOW + """

""" + faq([
    ("Why don't people support Lorne Doerkson?", "Common reasons: the Human Rights Code repeal vote, controversial candidates, his interim-leader status, his past with the BC Liberals, and fears about ICBC and social policy. Some on the right say he isn't conservative enough."),
    ("Is Lorne Doerkson the permanent BC Conservative leader?", "No. He became interim leader on Sept. 20, 2026. Critics question what happens after the election; supporters say he would stay premier if he keeps the legislature's confidence."),
    ("What did Doerkson vote on the Human Rights Code?", "Commenters note he was among the 37 Conservative MLAs who voted for a February 2026 bill to repeal the code. Check the legislative record for the details."),
    ("When is the BC election?", "Saturday, Oct. 24, 2026. Advance voting runs Oct. 16–21."),
]) + """

## Have your say

Vote in the polls above, then [rate and review Lorne Doerkson on his Choseno wall](/wall/lorne-doerkson-mla).

## More BC election 2026 coverage

""" + SEE_ALSO

articles.append(dict(
    slug=SLUG_OD,
    headline="Why People Don't Support Lorne Doerkson in BC's 2026 Snap Election",
    summary="From the Human Rights Code vote to his interim-leader status and Liberal past: why some B.C. voters say they won't back Conservative leader Lorne Doerkson.",
    seoTitle="Why People Don't Support Lorne Doerkson: BC Election 2026",
    metaDescription="Why do some BC voters oppose Lorne Doerkson in the 2026 snap election? Human Rights Code vote, candidates, interim leadership and more. Vote in our poll.",
    tags=["BC Election 2026", "Lorne Doerkson", "BC Conservatives", "Human Rights Code", "ICBC"],
    taggedPoliticians=["Lorne Doerkson"], politicianIds=[DOERKSON_ID],
    tweet="Why are some B.C. voters refusing to back interim Conservative leader Lorne Doerkson? The Human Rights Code vote, candidate controversies and his interim status lead the list.",
    tweetmedium="Do you agree with Lorne Doerkson's handling of controversial Conservative candidates? Review him on Choseno.",
    body=body,
    polls=[
        ("What concerns you most about Lorne Doerkson and the BC Conservatives?", [
            "The Human Rights Code repeal vote",
            "Controversial candidates",
            "He's an interim leader and unknown",
            "His BC Liberal past",
            "ICBC privatization and public-service cuts",
            "Social-policy and culture-war agenda",
            "Not conservative enough",
            "Nothing, I'm fine with him",
        ]),
        ("What will you do on Oct. 24?", [
            "Vote NDP",
            "Vote Conservative anyway",
            "Vote Green, OneBC, CentreBC or another party",
            "Sit this one out",
            "Still undecided",
        ]),
    ],
))


# ───────────────────── 5. Why an informed vote matters (hub) ─────────────────────
body = DATELINE + """British Columbia is going to the polls on Saturday, Oct. 24, 2026, about two years earlier than scheduled. A snap election leaves less time to weigh the choices, and that makes it more important, not less, to know what you are voting on.

""" + KEY_DATES + """

## Why an informed vote matters

Democracy only works as well as the choices voters make. Every ballot decides who forms government, who sits in the legislature and who speaks for your community for the next several years. A short campaign tends to be dominated by slogans, attack lines and social media clips, and it is easy to settle on a side before looking at the details.

Voting well doesn't take hours of research. It takes a few honest steps:

- **Read about the parties, not just the leaders.** Platforms, candidates and track records are what actually govern.
- **Hear the other side's case.** Understanding why people support a party you don't, and why people reject the one you like, is the best defence against an echo chamber.
- **Be careful with slogans and shares.** A catchy line is not a fact. Check claims against a source.
- **Check your local race.** You don't vote for a premier directly. You vote for the candidate in your district.
- **Vote.** Turnout is the one thing every voter controls.

## Start here: five articles

Choseno has put together a set of explainers so you can see where the parties stand and what voters are saying on both sides. They are not endorsements.

1. [BC election 2026: where each party stands](""" + STANDS + """): the NDP, Conservatives, Greens, CentreBC and OneBC on housing, health care and energy.
2. [Why people support David Eby](/news/""" + SLUG_SE + """): what supporters say about the NDP leader.
3. [Why people don't support David Eby](/news/""" + SLUG_OE + """): what critics say.
4. [Why people support Lorne Doerkson](/news/""" + SLUG_SD + """): what supporters say about the Conservatives' interim leader.
5. [Why people don't support Lorne Doerkson](/news/""" + SLUG_OD + """): what critics say.

The four "why people" articles summarize public posts on Reddit, X and YouTube. They are not polls, online commenters skew louder and more partisan than the average voter, and the claims in them are what commenters say, not verified findings. Treat them as a map of the arguments, then check the facts that matter to you.

## Find out what is on your ballot

Many voters know the party leaders but not their own candidates. Use the **find your district** tool below to see every race you can vote in and the candidates running in it. You can also browse the [2026 BC provincial election page](/elections/e/2026-bc-provincial-election-0832d7b5-e607-4342-8eb3-8ca25db70d9a) for all parties and candidates.

For official voting details, including where and how to vote and what ID to bring, check [Elections BC](https://elections.bc.ca).

""" + faq([
    ("When is the BC election in 2026?", "Saturday, Oct. 24, 2026. Advance voting runs Oct. 16–21. Premier David Eby called the election on Sept. 22."),
    ("Why is it called a snap election?", "A snap election is one called earlier than scheduled. This one is about two years early. Eby said voters deserve a say amid the Canada–U.S. trade fight; critics call it opportunistic."),
    ("How do I find out who is running in my riding?", "Use the find your district tool on this page, or browse the Choseno 2026 BC provincial election page, to see the candidates in your district."),
    ("Where do I get official voting information?", "Elections BC at elections.bc.ca has the official details on where, when and how to vote."),
    ("Does Choseno endorse a party?", "No. These articles explain positions and summarize what voters say on both sides."),
]) + """

## Have your say

Vote in the poll above, then rate and review your candidates on their Choseno walls: [David Eby](/wall/david-eby-premier) and [Lorne Doerkson](/wall/lorne-doerkson-mla).

## More BC election 2026 coverage

""" + SEE_ALSO.split("\n", 1)[1]

articles.append(dict(
    slug=SLUG_HUB,
    headline="BC Provincial Snap Election 2026: Why an Informed Vote Matters",
    summary="B.C. votes Oct. 24 in a snap election. Why choosing carefully matters in a democracy, and where to find each party's positions and what voters say on both sides.",
    seoTitle="BC Snap Election 2026: Why an Informed Vote Matters",
    metaDescription="B.C. votes Oct. 24, 2026. Learn why an informed vote matters, where each party stands, and why people support or oppose Eby and Doerkson. Find your district.",
    tags=["BC Election 2026", "Snap Election", "Voting", "BC Politics", "Democracy"],
    taggedPoliticians=["David Eby", "Lorne Doerkson"], politicianIds=[EBY_ID, DOERKSON_ID],
    tweet="B.C. votes Oct. 24 in a snap election. Before you choose, see where each party stands and why people back or reject Eby and Doerkson. Choose wisely.",
    tweetmedium="Do you agree with David Eby's call for a snap election? Review him on Choseno.",
    body=body,
    polls=[
        ("What will matter most when you vote on Oct. 24?", [
            "Housing and cost of living",
            "Health care",
            "The economy, taxes and the deficit",
            "Public safety and drug policy",
            "Standing up to the U.S. on trade",
            "My local candidate",
            "Stopping a party I oppose",
            "Still deciding",
        ]),
    ],
))


def tweetarticle(a, role):
    url = f"{BASE}/news/{a['slug']}"
    return (f"{a['headline'].upper()}\n\n{a['summary']}\n\nVoting day is Sat., Oct. 24; advance voting runs Oct. 16-21. "
            f"This is a read of public Reddit, X and YouTube posts, not a poll.\n\n"
            f"NOW YOU HAVE THE SAY -- CHOSENO:\nChoseno is like Google Reviews for politicians. Review {role} and see where your neighbors stand:\n"
            f"{BASE}/wall/{'david-eby-premier' if 'Eby' in role else 'lorne-doerkson-mla'}\n\nRead the full breakdown on Choseno:\n{url}\n\n#BCElection2026 #Choseno")


for a in articles:
    if a["slug"] == SLUG_HUB:
        a.update(
            category="Elections", country="CA", province="BC", impactArea="state",
            eventDate="2026-10-06", status="draft",
            author={"name": "Choseno Civic News Desk", "bio": "Civic and political reporting"},
            sources=COMMON_SOURCES,
        )
        a["tweetarticle"] = (f"{a['headline'].upper()}\n\n{a['summary']}\n\nVoting day is Sat., Oct. 24; advance voting runs Oct. 16-21.\n\n"
                             f"Read the full guide on Choseno:\n{BASE}/news/{a['slug']}\n\n#BCElection2026 #Choseno")
        continue
    a.update(
        category="Elections", country="CA", province="BC", impactArea="state",
        eventDate="2026-10-06", status="draft",
        author={"name": "Choseno Civic News Desk", "bio": "Civic and political reporting"},
        sources=COMMON_SOURCES,
    )
    a["tweetarticle"] = tweetarticle(a, "David Eby" if "Eby" in a["taggedPoliticians"][0] else "Lorne Doerkson")

out = os.path.join(HERE, "bc-election-2026-leader-support-oppose.json")
with open(out, "w") as f:
    json.dump(articles, f, indent=2, ensure_ascii=False)
print("wrote", out)


def q(s):
    return "$q$" + s + "$q$"


if "--sql" in sys.argv:
    path = sys.argv[sys.argv.index("--sql") + 1]
    lines = ["BEGIN;"]
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    for a in articles:
        if only and a["slug"] != only:
            continue
        content = {
            "body": a["body"], "tags": a["tags"], "tweet": a["tweet"], "tweetmedium": a["tweetmedium"],
            "tweetarticle": a["tweetarticle"], "author": a["author"], "sources": a["sources"],
            "seoTitle": a["seoTitle"], "metaDescription": a["metaDescription"], "viral_score": 9.5,
            "taggedPoliticians": a["taggedPoliticians"], "primaryPoliticianName": a["taggedPoliticians"][0],
            "breakingNews": False,
        }
        lines.append(f"""
WITH ins AS (
  INSERT INTO news_articles (slug, headline, summary, category, country, province, status, impact_area, event_date, content)
  VALUES ({q(a['slug'])}, {q(a['headline'])}, {q(a['summary'])}, 'Elections', 'CA', 'BC', 'draft', 'state', '2026-10-06', {q(json.dumps(content, ensure_ascii=False))}::jsonb)
  RETURNING id
), pol AS (
  INSERT INTO news_article_politicians (news_article_id, politician_id)
  SELECT id, pid FROM ins, (VALUES {", ".join(f"('{i}'::uuid)" for i in a['politicianIds'])}) AS v(pid)
)
SELECT id FROM ins;
""")
        # \gset inside a CTE statement isn't reliable; use a lookup by slug instead
        lines[-1] = lines[-1].replace(" \\gset art_", "")
        for si, (question, opts) in enumerate(a["polls"]):
            lines.append(f"""
WITH p AS (
  INSERT INTO news_article_polls (news_article_id, question, sort_order)
  SELECT id, {q(question)}, {si} FROM news_articles WHERE slug = {q(a['slug'])}
  RETURNING id
)
INSERT INTO news_article_poll_options (poll_id, label, sort_order)
SELECT p.id, o.label, o.ord FROM p, (VALUES {", ".join(f"({q(l)}, {i})" for i, l in enumerate(opts))}) AS o(label, ord);
""")
    lines.append("COMMIT;")
    with open(path, "w") as f:
        f.write("\n".join(lines))
    print("wrote", path)
