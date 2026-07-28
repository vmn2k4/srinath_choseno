-- Same fix as 20260729000015 (Alberta/Saskatchewan/PEI), applied to the three
-- provinces this pattern was originally built for: BC, Ontario, and Quebec had
-- ZERO provincial_election_events rows in production despite fetchBc/fetchOn/
-- fetchQc all being fully wired -- meaning admins had no "view official source"
-- link (and no working "Fetch candidates" button) for any of the three, found
-- while auditing every jurisdiction this app claims to support for a working
-- manual link.
--
-- Each source_url was picked to be the best URL that actually resolves
-- *right now* (confirmed live via direct curl before writing this), not just
-- a plausible guess:
--   * BC: elections.bc.ca's own 2024/2028 candidate-list pages both 404 live
--     right now (2024's already torn down per docs/ELECTION_DATA_SOURCES.md;
--     2028 hasn't been published yet) -- so this points at a confirmed-working
--     Wayback Machine snapshot of the real 2024 general election page instead,
--     same "Wayback as a legitimate recovery tool" pattern already documented
--     for Elections Canada's expired by-elections.
--   * Ontario: the live discovery endpoint (confirmed 200 right now, even with
--     no election running -- see docs/ELECTION_DATA_SOURCES.md) rather than a
--     specific past election, since this API's whole design is "poll it to see
--     if an election is currently live," not a historical archive.
--   * Quebec: the equivalent discovery endpoint, confirmed to correctly 403
--     while dormant (matches the already-documented "unavailable outside an
--     election" behavior) -- same "accurate reference link either way" logic
--     buildCandidateUrl already applies to Ontario/Quebec's API-root links.
INSERT INTO public.provincial_election_events (province, name, source_url, event_date) VALUES
  ('BC', '2024 BC General Election (archived)', 'https://web.archive.org/web/20250117055443/https://elections.bc.ca/2024-provincial-election/candidate-list/', '2024-10-19'),
  ('ON', 'Ontario Voter Information Service', 'https://voterinformationservice.elections.on.ca/api/electoral-district-search/en/all-with-election', NULL),
  ('QC', 'Élections Québec candidate search', 'https://api.electionsquebec.qc.ca/provincial/recherche/circonscriptions', NULL);
