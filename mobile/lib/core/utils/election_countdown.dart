/// "Voting today" / "Tomorrow" / "in N days" — only for upcoming dates close
/// enough to create urgency (port of electionCountdown in
/// DistrictSeatCards.tsx); null otherwise.
String? electionCountdown(DateTime? date) {
  if (date == null) return null;
  final now = DateTime.now();
  final days = DateTime(
    date.year,
    date.month,
    date.day,
  ).difference(DateTime(now.year, now.month, now.day)).inDays;
  if (days < 0 || days > 60) return null;
  if (days == 0) return 'Voting today';
  if (days == 1) return 'Tomorrow';
  return 'in $days days';
}
