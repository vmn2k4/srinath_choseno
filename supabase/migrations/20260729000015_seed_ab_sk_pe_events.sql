-- Seeds provincial_election_events rows for Alberta, Saskatchewan, and PEI --
-- all three were researched and verified as real, working sources (see
-- docs/ELECTION_DATA_SOURCES.md) but never got an event row, so admins had no
-- "view official source" link for them at all despite the URLs being known
-- since an earlier session. This was found while auditing whether every
-- researched jurisdiction actually surfaces a manual-view link in the admin
-- UI -- it didn't, for exactly these three, because
-- getCandidateSourceInfoForSeats' fallback path requires an event row to
-- exist before it will build a link.
--
-- No live-fetch Edge Function handler exists yet for any of the three
-- (fetchAb/fetchSk/fetchPe aren't built -- Alberta's is even documented as
-- "half-done": its CA_PROVINCIAL_PROPERTY_SIGNATURE entry already existed,
-- but nothing consumed it). candidateSync.js's JURISDICTIONS_WITH_FETCH set
-- correctly downgrades these to a manual-view-only link (no "Fetch
-- candidates" button) rather than offering a button that would just report
-- 'unsupported' when clicked.
--
-- Source URLs are each jurisdiction's real, human-reachable entry point from
-- research, not a raw API endpoint -- Alberta's is a search *form* (the real
-- results need a POST, not yet automated, same caveat already noted for
-- Ontario/Quebec's API-root links); Saskatchewan's is the actual rendered
-- candidates page; PEI has no single whole-province page, so this points at
-- the main site rather than a specific district (per-district URLs exist,
-- e.g. electionspei.ca/district-<N>-<year>, but map_shapes.code's exact
-- correspondence to PEI's own numbering was never confirmed -- see PEI's
-- section in docs/ELECTION_DATA_SOURCES.md).
INSERT INTO public.provincial_election_events (province, name, source_url, event_date) VALUES
  ('AB', '2023 Alberta General Election', 'https://efpublic.elections.ab.ca/efCandidatesPGE.cfm?MID=FC_2023&OFSFID=101&EDS=ALL', '2023-05-29'),
  ('SK', 'October 2024 Saskatchewan General Election', 'https://www.elections.sk.ca/electoralevents/october-2024-provincial-election/candidates/', '2024-10-28'),
  ('PE', 'Elections PEI', 'https://www.electionspei.ca/', NULL);
