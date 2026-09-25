// Seat Detail's read side + the Community Support panel
// (docs/FLUTTER_MOBILE_APP_GUIDE.md §4.A.7/§4.I.7 in the parent repo).
// Not yet ported: the Candidate Interview tab (video question carousel —
// needs the video-playback infrastructure §8 recommends building once),
// the anonymous (signed-out) Support path (§4.I.7's `anon_id` mechanic —
// this app's current focus is the logged-in screen set), Election
// Administrator tools (§4.I.5), and "Nominate Yourself" (§4.I).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/elections/entities/election_candidate.dart';
import '../../../../domain/elections/entities/election_seat.dart';
import '../../../../domain/elections/entities/politician_engagement.dart';
import '../../auth/providers/auth_providers.dart';
import '../../politician_wall/providers/politician_wall_providers.dart';
import 'elections_providers.dart';

@immutable
class SeatDetailData {
  const SeatDetailData({
    required this.seat,
    required this.candidates,
    required this.engagementByPoliticianId,
    required this.mySupportedIds,
  });

  final ElectionSeat seat;
  final List<ElectionCandidate> candidates;
  final Map<String, PoliticianEngagement> engagementByPoliticianId;
  final Set<String> mySupportedIds;

  int supporterCountFor(String politicianId) =>
      engagementByPoliticianId[politicianId]?.supporterCount ?? 0;

  /// Candidates ranked by supporter count, highest first — the same
  /// derivation `ElectionResultsPanel.tsx` does client-side from the same
  /// batched engagement map, not a second query.
  List<ElectionCandidate> get rankedCandidates => [...candidates]
    ..sort(
      (a, b) => supporterCountFor(
        b.politicianId,
      ).compareTo(supporterCountFor(a.politicianId)),
    );

  int get totalSupport =>
      candidates.fold(0, (sum, c) => sum + supporterCountFor(c.politicianId));

  /// A single leader only exists when exactly one candidate holds the top
  /// count — anyone else matching it is tied for first (ported from
  /// ElectionResultsPanel.tsx's own fix for exactly this: a stable sort
  /// alone picks an arbitrary "winner" out of a tie).
  ElectionCandidate? get leader {
    if (totalSupport == 0 || rankedCandidates.isEmpty) return null;
    final top = supporterCountFor(rankedCandidates.first.politicianId);
    final atTop = rankedCandidates
        .where((c) => supporterCountFor(c.politicianId) == top)
        .toList();
    return atTop.length == 1 ? atTop.first : null;
  }

  bool get isTie {
    if (totalSupport == 0 || rankedCandidates.isEmpty) return false;
    final top = supporterCountFor(rankedCandidates.first.politicianId);
    return rankedCandidates
            .where((c) => supporterCountFor(c.politicianId) == top)
            .length >
        1;
  }
}

class SeatDetailController extends AsyncNotifier<SeatDetailData> {
  SeatDetailController(this.seatId);

  final String seatId;

  @override
  Future<SeatDetailData> build() async {
    final electionsRepo = ref.watch(electionsRepositoryProvider);

    final seatResult = await electionsRepo.getSeatById(seatId);
    final seat = seatResult.when(ok: (s) => s, err: (f) => throw f);

    final candidatesResult = await electionsRepo.getCandidatesForSeat(seatId);
    final candidates = candidatesResult.when(ok: (c) => c, err: (f) => throw f);

    final politicianIds = candidates.map((c) => c.politicianId).toList();
    final engagementResult = await electionsRepo
        .getPoliticianEngagementSummaries(politicianIds);
    final engagement = engagementResult.when(ok: (e) => e, err: (f) => throw f);

    final userId = ref.read(authStateChangesProvider).value?.id;
    var mySupportedIds = <String>{};
    if (userId != null && politicianIds.isNotEmpty) {
      final wallRepo = ref.read(politicianWallRepositoryProvider);
      final statuses = await Future.wait(
        politicianIds.map(
          (id) =>
              wallRepo.getSupportStatus(politicianId: id, supporterId: userId),
        ),
      );
      for (var i = 0; i < politicianIds.length; i++) {
        if (statuses[i].valueOrNull == true) {
          mySupportedIds.add(politicianIds[i]);
        }
      }
    }

    return SeatDetailData(
      seat: seat,
      candidates: candidates,
      engagementByPoliticianId: engagement,
      mySupportedIds: mySupportedIds,
    );
  }

  Future<void> toggleSupport(String politicianId) async {
    final current = state.value;
    if (current == null) return;
    final userId = ref.read(authStateChangesProvider).value?.id;
    if (userId == null) return;

    final wasSupporting = current.mySupportedIds.contains(politicianId);
    final optimisticIds = Set<String>.from(current.mySupportedIds);
    final currentEngagement =
        current.engagementByPoliticianId[politicianId] ??
        PoliticianEngagement(politicianId: politicianId);
    final delta = wasSupporting ? -1 : 1;
    final optimisticEngagement = Map<String, PoliticianEngagement>.from(
      current.engagementByPoliticianId,
    );
    optimisticEngagement[politicianId] = PoliticianEngagement(
      politicianId: politicianId,
      supporterCount: (currentEngagement.supporterCount + delta).clamp(
        0,
        1 << 31,
      ),
      avgRating: currentEngagement.avgRating,
      ratingCount: currentEngagement.ratingCount,
      commentCount: currentEngagement.commentCount,
    );
    if (wasSupporting) {
      optimisticIds.remove(politicianId);
    } else {
      optimisticIds.add(politicianId);
    }
    state = AsyncData(
      SeatDetailData(
        seat: current.seat,
        candidates: current.candidates,
        engagementByPoliticianId: optimisticEngagement,
        mySupportedIds: optimisticIds,
      ),
    );

    final wallRepo = ref.read(politicianWallRepositoryProvider);
    final result = wasSupporting
        ? await wallRepo.withdrawSupport(
            politicianId: politicianId,
            supporterId: userId,
          )
        : await wallRepo.addSupport(
            politicianId: politicianId,
            supporterId: userId,
          );

    if (result.isErr) {
      // Roll back to the pre-optimistic state on failure.
      state = AsyncData(current);
    }
  }
}

final seatDetailControllerProvider = AsyncNotifierProvider.autoDispose
    .family<SeatDetailController, SeatDetailData, String>(
      (seatId) => SeatDetailController(seatId),
    );
