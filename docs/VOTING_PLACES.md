# Voting places (BC 2026 general local election)

Advance + election-day voting places live in their own tables, tagged by election:

- `voting_places` — `election_name` + `election_date` tag, `map_shape_id` (the municipality), name, address, `lat`/`lng`, `source_url`, `last_checked_at`.
- `voting_place_schedules` — one row per place per day: `voting_type` (`advance` | `general` | `special`), `vote_date`, `opens_at`, `closes_at`.

Migration: `supabase/migrations/20261008000005_voting_places.sql` (public read, no client write policy; writes via service role / `supabase db query --linked`).

## UI
`VotingPlacesSection` (rendered under the candidate list on `/elections/seat/[seatId]`) fetches via `getVotingPlacesForShape` (`src/lib/services/votingPlaces.ts`), matching the seat's `map_shape_id` + election date. It renders nothing when a municipality has no rows. Nearest-first sorting uses a location the visitor already shared (`guestLocation`) or an explicit "Find closest to me" button — GPS is never requested on page load. Days already past (America/Vancouver) are hidden.

## Loading data
`scripts/voting_places/` — `helpers.py` (compact builders), `data_*.py` (researched data per municipality, source URL recorded), `load_voting_places.py` (geocodes addresses via Nominatim, accepts a hit only within 60 km of the municipality centroid, replaces that municipality's rows, applies via `supabase db query --linked`). `missing.txt` lists municipalities with no data yet.

Re-run `python3 scripts/voting_places/load_voting_places.py data/<file>.json` after correcting a file. Hours/locations change late — recheck `source_url` before the election.
