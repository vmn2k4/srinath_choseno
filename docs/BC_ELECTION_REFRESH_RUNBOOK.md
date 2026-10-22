# BC Local Election Refresh Runbook (mayors, councillors, school trustees)

Repeat after every BC general local election (fixed 4-year cycle: Oct 2026 → Oct 2030 → ...), and
after by-elections if a seat matters. First executed **2026-10-21** for the Oct 17, 2026 election.

Related: [OFFICE_HOLDERS_DATA_GUIDE.md](../OFFICE_HOLDERS_DATA_GUIDE.md) (data model, other provinces),
script: [scripts/sync-bc-election-results.py](../scripts/sync-bc-election-results.py).

## How "removing the old tags" works
Nothing is deleted. Anyone not re-elected is **retired in place** (`office_holders.is_current = false`,
`term_ended_at` = run date). The Politician Wall then shows `[FORMER MAYOR]` / `[FORMER COUNCILLOR]`
instead of the current-office badge (derived in `src/lib/services/politicianWall.ts`). Re-elected people keep
the same row, `linked_profile_id`, and wall. New winners get a ghost profile + wall automatically.

## Steps

1. **Wait for official results.** Local election officers declare official results a few days after
   election day (2026: by 4pm Oct 21). Judicial recounts can follow within ~a week. Running earlier is
   fine for a first pass, but re-run after declaration (the script is idempotent).

2. **Use the right source — do NOT trust `--year`.**
   - Current cycle: `--source localelections` scrapes CivicInfo's results site
     (`https://localelections.ca/results/index_m.html` and `index_sd.html`; per-jurisdiction pages are
     `/election_results/<n>_<year>_results.html`; the "Elected" column is a check icon).
   - `candidates-and-results.php?year=YYYY` only has past cycles and **silently falls back to 2018** for a
     year it hasn't archived (seen with `year=2026`). The script now aborts if the feed has no data for the
     requested year. Use `--source archive --year YYYY` only for cycles CivicInfo has archived.
   - The URL year in `_2026_results` is hard-coded in `fetch_localelections_rows()` — **update it to the new
     election year** next cycle (and check the index page paths still exist).

3. **Dry run** (writes SQL for review, touches nothing):
   ```bash
   python3 scripts/sync-bc-election-results.py --source localelections
   ```
   Read the output:
   - `MANUAL:` lines = jurisdictions skipped because of a tie/undeclared race (not exactly 1 mayor, or elected
     councillors ≠ seats). Their current holders are **left untouched**. Resolve by hand (step 6).
   - `note:` lines on school districts are informational (ward seats, acclamations, vacancies).
   - "could not be matched" list = winners with no `map_shapes` row. Fix aliases (step 5) or add the boundary.
   - `name reconcile` / `Reconciled names` = incumbents matched to their on-file spelling.

4. **Verify accuracy independently before `--apply`.** Spot-check at least: the ~15 biggest cities' mayors
   against news (CBC, Daily Hive, Capital Daily live-results pages) and 2–3 small towns against their own
   municipal site. 2026 check: all 16 news-reported mayors matched the feed. Also confirm the jurisdiction
   count (162 municipal pages incl. 1 "Advisory Body" that is skipped, 60 school districts) is plausible.

5. **Back up, then apply:**
   ```bash
   # backup current BC rows for rollback (id, shape, role, name, linked profile) -> scripts/data/
   # (see scripts/data/bc-office-holders-backup-pre-2026-10-21.csv for the format)
   python3 scripts/sync-bc-election-results.py --source localelections --apply
   ```
   `--apply` runs psql with `ON_ERROR_STOP=1`. (Before that was added, a unique-key error rolled the whole
   transaction back and the script still printed "Done." — always verify with step 7.)
   Fix recurring matching gaps in the script, not in the DB:
   - `MUNICIPAL_ALIASES` — renamed municipalities (100 Mile House → One Hundred Mile House, Daajing Giids →
     Queen Charlotte, Sun Peaks → Sun Peaks Mountain).
   - `map_shapes` uses `"Name (City)"` / `"Name (Township)"` when two places share a name (Langley,
     North Vancouver, Esquimalt, Alert Bay); `lookup_municipal_shape()` tries that form first.
   - School districts match on the **SD number** (`"SD42 - ..."`), not the name (names change: qathet,
     Sea to Sky (Howe Sound)).

6. **Manual follow-ups** (2026 examples):
   - Tie or pending: Princeton councillors (4th seat tied 391–391, Shackleton/Willis), Lytton mayor
     (45–45). Once resolved, either re-run (the page will show check marks) or fix via
     `/admin/office-holders`.
   - No boundary: Okanagan Falls (newly incorporated municipality) and Conseil scolaire francophone (SD 93,
     province-wide). Import the boundary into `map_shapes` first, then re-run.
   - **School board chairs**: boards elect their chair at the first meeting after the election, so the
     script promotes **nobody** to Board Chair for `--source localelections` (all 52 old chairs were
     retired). In Nov/Dec, verify each board's chair on its own site, update `CHAIR_OVERRIDES`
     (district code → name), and re-run with `--source archive` once CivicInfo archives, or set the role
     via `/admin/office-holders`.
   - Odd ballot names (e.g. Kimberley "Powder Matt Mosteller") are kept as printed on the ballot; edit in
     admin if the person is known by another name.

7. **Verify in the DB** after applying:
   - current counts per role (Mayor ≈ one per municipality, no shape with ≠ 1 mayor, no duplicate current rows);
   - known changes landed (2026: Vancouver Pete Fry, Surrey Doug McCallum, Richmond Rob Howard, ...);
   - old holders show `is_current = false` with today's `term_ended_at`;
   - every new current row has `linked_profile_id`.

8. **Other things that go stale after an election** (not covered by this script): mayoral/council "party"
   standings and civic-party contact CSVs in `scripts/` (`bc-civic-parties-contacts.csv`, etc.),
   outreach CSVs (`bc-mayors-*.csv`, `bc-councillors-*.csv`, `bc-municipal-outreach.csv`), email/phone for
   new winners (re-run the municipal contact enrichment), news/election pages that say "current mayor", and
   the headline counts in OFFICE_HOLDERS_DATA_GUIDE.md section 1.

## Name normalization (why incumbents keep their rows)
`clean_name()` strips `(legal name)` annotations, un-shouts ALL-CAPS and `O'REILLY` tokens, flips
`SURNAME I. First` ordering (Grand Forks style), and drops single-letter middle initials. Then each winner is
reconciled against rows already on file: case-only differences rename the old row; same surname + same first
three letters of the first name keep the on-file spelling (Phil/Phillip, Doug/Douglas). Anyone else is a new
person.

## 2026 run record (2026-10-21)
Source: localelections.ca, "Last Updated Oct 21, 2026 10:10 pm" (unofficial until declared). 1,421 winners
loaded across 217 BC shapes; ~885 prior holders retired; 158 new walls created, 663 linked to existing
profiles. Backup of pre-run state: `scripts/data/bc-office-holders-backup-pre-2026-10-21.csv`.
