// Public homepage stats. Hand-maintained and deliberately rounded DOWN, so the
// page never overstates. Refresh them (and AS_OF) from GA4 + the database when
// they drift -- see the analytics how-to in the project notes for the queries.
//   visitors: GA4 activeUsers, last 90 days (42,729 on 2026-10-19)
//   boundaries: count(*) from map_shapes where retired_at is null (~123,500)
//   politicians: count(*) from profiles where role = 'politician' and not is_test (36,385)
export const AS_OF = "2026-10-19";

export const SITE_STATS = {
  visitors: 42000,
  boundaries: 120000,
  politicians: 36000,
  countries: 3,
} as const;
