# Ballotpedia refresh of the "2026 US Midterm Elections" candidate rolls

Used 2026-10-02 to reconcile all 435 House, 35 Senate and 36 Governor seats. Full writeup,
numbers, and gotchas: [docs/CANDIDATE_DATA_PULL_LOG.md](../../docs/CANDIDATE_DATA_PULL_LOG.md)
("2026-10-02 — Ballotpedia refresh"). These files are the scripts exactly as they ran that day;
they read/write files in the current directory (the run used a scratch folder), so copy them
somewhere writable and `cd` there. **Not yet a one-command refresh** -- the browser scrape and
the file hand-off are manual steps.

Pipeline, in order:

1. `scrape_ballotpedia.js` -- paste into a browser tab on ballotpedia.org (curl/WebFetch are blocked).
2. `recv.py` -- tiny localhost receiver used to move the scraped JSON out of the browser.
3. Export current DB rows (queries are in the log section) to `db_export.txt` (House) / `db_gs.txt` (Senate+Governor).
4. `diff_house.py` -> `house_diff.json`; `build_house_sql.py` -> `house_apply.sql`.
5. `diff_senate_governor.py` -> `gs_diff.json`; `prep_senate_governor.py` + `build_senate_governor_sql.py` -> `gs_apply.sql`.
6. **Review the printed adds/removes first**, back up the rows to be deleted (`\copy ... to csv`), then
   `psql -v ON_ERROR_STOP=1 -f <apply>.sql`. Each file is one transaction.

Safety properties built into the apply SQL: only deletes rows with `added_by_election_admin_id` = the
pipeline admin and `claimed_at IS NULL`; never deletes a profile that still has another candidacy, an
`office_holders` link, a news-article link, or ratings; new parties and stub profiles are inserted
idempotently. `build_house_sql.py` has a hard-coded `HOLD` set of names to leave alone -- edit it per run.
