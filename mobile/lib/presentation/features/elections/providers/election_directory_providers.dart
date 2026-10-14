import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/elections/entities/election_directory_entry.dart';
import '../../../../domain/elections/entities/election_seat_summary.dart';
import '../../../../domain/elections/entities/pick_share.dart';
import 'elections_providers.dart';

/// Every live election with counts + top places ("Browse every election").
final electionDirectoryProvider =
    FutureProvider.autoDispose<List<ElectionDirectoryEntry>>((ref) async {
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getElectionDirectory();
      return result.when(ok: (e) => e, err: (f) => throw f);
    });

final seatsForElectionProvider = FutureProvider.autoDispose
    .family<List<ElectionSeatSummary>, String>((ref, electionId) async {
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getSeatsForElection(electionId);
      return result.when(ok: (s) => s, err: (f) => throw f);
    });

final seatsForShapeProvider = FutureProvider.autoDispose
    .family<List<ElectionSeatSummary>, int>((ref, shapeId) async {
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getActiveSeatsByShapeIds([shapeId]);
      return result.when(ok: (s) => s, err: (f) => throw f);
    });

/// Key is the sorted, comma-joined boundary ids (a String so the family key
/// compares by value).
final votingPlaceDatesProvider = FutureProvider.autoDispose
    .family<List<({int shapeId, String electionDate})>, String>((
      ref,
      key,
    ) async {
      if (key.isEmpty) return const [];
      final ids = key.split(',').map(int.parse).toList();
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getVotingPlaceDates(ids);
      return result.when(ok: (d) => d, err: (_) => const []);
    });

final pickShareProvider = FutureProvider.autoDispose.family<PickShare?, String>(
  (ref, code) async {
    final result = await ref
        .watch(electionsRepositoryProvider)
        .getPickShareByCode(code);
    return result.when(ok: (s) => s, err: (f) => throw f);
  },
);
