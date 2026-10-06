# Choseno — Vision

> Status: draft for founder review (2026-10-05). Sections marked **[Future]** are not built yet.

## Mission

Choseno is a communication platform for democracy: people communicate with people in power **without retribution**.

## Philosophy: the citizen's role is not only to vote

Democracy needs citizens to do more than cast a ballot. Choseno supports the whole loop:

| Step | Citizen role | Choseno phase |
|---|---|---|
| 1. Analyze | Understand candidates and what they stand for | Phase 1 — Elections & candidates (built) |
| 2. Choose | Vote for the right person for the job | Phase 1 |
| 3. Speak up | Say so when something goes wrong | Phase 2 — Boundary communities; Phase 3 — Issues |
| 4. Follow up | Track whether it is being handled | Phase 3 |
| 5. Hold accountable | Ensure officials do their jobs | Phase 3 |

## Phases

1. **Inform** — election, boundary and candidate information. Help people pick the right candidates.
2. **Connect** — people communicate with each other inside their electoral boundaries.
3. **Escalate [Future]** — people communicate with elected officials. Choseno becomes a ticketing platform for government.

## What "AI Operating System for Democracy" means

The phrase is only worth using if AI does specific, checkable jobs. These are the jobs **[Future]** unless noted:

| Job | What it does | Why it matters |
|---|---|---|
| **Summarize candidate positions** (partly built) | Turns sourced statements, records and answers into comparable summaries | Informed voting. Every claim must link to a source. |
| **Dedupe & cluster issues** | Groups many reports of the same problem into one issue | Officials see one issue with a size, not 400 messages |
| **Prioritize** | Ranks issues by number of reporters, severity, recency, and how long unresolved | Surfaces what matters most to the most people |
| **Route to jurisdiction & office** | Decides which level of government (municipal / regional / provincial / federal) and which office owns the issue | Most civic frustration is "I don't know who is responsible for this." Routing is the highest-value AI job. |
| **Draft tickets** | Turns a cluster into a clear, actionable ticket for the right office | Makes it cheap for government to act |

AI assists and explains. It never decides how someone should vote, and its routing and priority decisions must be explainable and correctable by a human.

## No retribution: how it is achieved

The core design choice: **people report; Choseno aggregates; officials see issues, not individuals.**

- An issue is a **cluster**, not a person. No individual's name is attached to an issue, ever.
- Officials see what the cluster says and how many residents it represents (e.g. "142 residents in this district"), never who they are.
- Priority comes from cluster size, so the system rewards agreement, not the loudest voice.

Rules that make this real, not just a promise:

1. **Minimum cluster size before an issue is shown to an official.** A cluster of one is re-identifiable. Set a threshold (to be decided) and hold small clusters back, or merge them upward (e.g. street → neighbourhood).
2. **Free text can identify people.** Raw reports are never forwarded. The ticket is an AI-drafted summary that strips names, addresses, and distinctive details.
3. **Raw reports are visible to no official.** Access to individual submissions is limited to the minimum needed for moderation, and logged.

## Verified residency **[Future]**

Reporting an issue will require **verified resident** status for the boundary. This is what makes counts credible ("142 verified residents"), and it blocks bots, astroturfing and out-of-area brigading.

Verification must not undermine the no-retribution promise. Design constraints:

- Verification proves "lives in boundary X". It does not travel with the report.
- The verification record is stored separately from issue content, with minimal retention.
- Officials and government users can never query it. Open question: legal-process exposure (see below).
- Cluster counts use verified residents; the individual is not attached.

## North star

**Issues raised by verified residents that reach a documented outcome** — resolved, declined with a reason, or unanswered past a deadline.

Why this definition:

- It does not depend on government adopting the platform. A ticket can show "reported → seen → no response after 30 days", which makes silence visible.
- **Citizen-confirmed resolution** guards against officials marking things closed when they are not fixed.
- It is hard to game by volume alone because clusters, not raw reports, are the unit.

Leading indicators by phase:

| Phase | Indicators |
|---|---|
| 1 | Candidate pages viewed, voter-info engagement, returning users |
| 2 | Verified/active users per boundary, posts and replies per boundary |
| 3 | Issues per 1,000 residents, time to acknowledgment, response rate by office, resolution rate, citizen-confirmed resolution rate |

## Principles

- **Nonpartisan.** Present, don't persuade. Source every claim.
- **Safe to speak.** Aggregation and anonymity by design, not by policy alone.
- **Credible.** Verified residents, transparent counts, explainable routing.
- **Useful to government.** Fewer duplicate complaints, clear routing, actionable tickets.

## Open questions

- Minimum cluster size, and how small clusters merge upward.
- Legal exposure: could stored verification or raw reports be compelled by subpoena or access-to-information requests? Retention and encryption policy must answer this before launch.
- Jurisdiction data: how do we maintain a reliable map of who owns what (roads, schools, health, policing) per boundary?
- First government partners: municipal, provincial or federal? Do we launch tickets with or without their participation?
- Moderation of non-issue content, defamation, and threats against officials.
- Neutrality audit: how do we show candidate summaries are even-handed?
