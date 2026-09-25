// My Elections (§4.F, parent repo) — a politician's control center. Not
// yet ported: "Browse a Different Area" (needs a country → container →
// target-type search flow — a whole extra screen this app doesn't have a
// Boundary-search UI for yet, only GPS detect).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/elections/entities/election_seat_summary.dart';
import '../../../../domain/elections/entities/my_candidacy.dart';
import '../../../../domain/elections/entities/my_election_admin_application.dart';
import '../../auth/providers/auth_providers.dart';
import '../../elections/providers/elections_providers.dart';
import '../../profile/providers/profile_providers.dart';

final myElectionAdminApplicationsProvider =
    FutureProvider.autoDispose<List<MyElectionAdminApplication>>((ref) async {
      final userId = ref.watch(authStateChangesProvider).value?.id;
      if (userId == null) return const [];
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getMyElectionAdminApplications(userId);
      return result.when(
        ok: (applications) => applications,
        err: (failure) => throw failure,
      );
    });

final myCandidaciesProvider = FutureProvider.autoDispose<List<MyCandidacy>>((
  ref,
) async {
  final userId = ref.watch(authStateChangesProvider).value?.id;
  if (userId == null) return const [];
  final result = await ref
      .watch(electionsRepositoryProvider)
      .getMyCandidacies(userId);
  return result.when(
    ok: (candidacies) => candidacies,
    err: (failure) => throw failure,
  );
});

/// Reuses [ElectionsRepository.getActiveSeatsByShapeIds] — same shape of
/// query as `getOpenSeatsNearShapeIds` on web (open seats in the viewer's
/// own boundaries), close enough to not warrant a second near-duplicate
/// repository method for the one extra `election_date` filter the web
/// version adds.
final openSeatsNearYouProvider =
    FutureProvider.autoDispose<List<ElectionSeatSummary>>((ref) async {
      final userId = ref.watch(authStateChangesProvider).value?.id;
      if (userId == null) return const [];
      final membershipsResult = await ref
          .watch(profileRepositoryProvider)
          .getUserBoundaryMemberships(userId);
      final shapeIds =
          membershipsResult.valueOrNull?.map((m) => m.shapeId).toList() ??
          const [];
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getActiveSeatsByShapeIds(shapeIds);
      return result.when(ok: (seats) => seats, err: (failure) => throw failure);
    });

class MyElectionsActions {
  MyElectionsActions(this.ref);
  final Ref ref;

  Future<bool> applyForSeat(String seatId) async {
    final result = await ref
        .read(electionsRepositoryProvider)
        .applyForSeat(seatId);
    if (result.isOk) {
      ref.invalidate(myCandidaciesProvider);
      ref.invalidate(openSeatsNearYouProvider);
    }
    return result.isOk;
  }

  Future<bool> withdraw(String candidateId) async {
    final result = await ref
        .read(electionsRepositoryProvider)
        .deleteCandidacy(candidateId);
    if (result.isOk) ref.invalidate(myCandidaciesProvider);
    return result.isOk;
  }
}

final myElectionsActionsProvider = Provider((ref) => MyElectionsActions(ref));
