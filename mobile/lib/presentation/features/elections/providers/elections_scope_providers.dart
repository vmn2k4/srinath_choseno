// Which boundaries the Elections tab is showing races for. Port of
// ElectionsPageClient.tsx's `matchedBoundaries`/`accountBoundaries` split:
// by default the signed-in account's own saved districts (never the whole
// platform — a signed-in user with no districts sees an empty list that
// prompts them to find their district, exactly like the web), with an
// optional in-session override for "what's on the ballot somewhere else".
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/boundaries/entities/matched_boundary.dart';
import '../../../../domain/elections/entities/election_seat_summary.dart';
import '../../location/providers/location_providers.dart';
import 'elections_providers.dart';

/// A location the user looked up inside the Elections tab; null means "use
/// my saved districts".
class ElectionsScopeOverride extends Notifier<List<MatchedBoundary>?> {
  @override
  List<MatchedBoundary>? build() => null;

  void set(List<MatchedBoundary> boundaries) => state = boundaries;
  void reset() => state = null;
}

final electionsScopeOverrideProvider =
    NotifierProvider<ElectionsScopeOverride, List<MatchedBoundary>?>(
      ElectionsScopeOverride.new,
    );

final electionsBoundariesProvider =
    FutureProvider.autoDispose<List<MatchedBoundary>>((ref) async {
      final override = ref.watch(electionsScopeOverrideProvider);
      if (override != null) return override;
      return ref.watch(accountDistrictsProvider.future);
    });

/// Seats in the scoped boundaries — `getActiveSeatsByShapeIds`, the same
/// query the web's `fetchSeatsForBoundaries` runs. No boundaries → no seats
/// (the web's "verified account with no memberships yet sees an empty
/// list" behaviour), never a platform-wide fallback.
final activeSeatsProvider =
    FutureProvider.autoDispose<List<ElectionSeatSummary>>((ref) async {
      final boundaries = await ref.watch(electionsBoundariesProvider.future);
      if (boundaries.isEmpty) return const [];
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getActiveSeatsByShapeIds(boundaries.map((b) => b.id).toList());
      return result.when(ok: (seats) => seats, err: (f) => throw f);
    });
