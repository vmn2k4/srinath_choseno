// Seat Detail's "Seat Administrator" panel — self-service half of §4.I.5
// only. See `ElectionsRepository.getSeatAdminStatus`'s doc comment for
// what isn't ported (application review, the admin console itself).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/elections/entities/seat_admin_status.dart';
import '../../my_elections/providers/my_elections_providers.dart';
import 'elections_providers.dart';

final seatAdminStatusProvider = FutureProvider.autoDispose
    .family<SeatAdminStatus, String>((ref, seatId) async {
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getSeatAdminStatus(seatId);
      return result.when(ok: (s) => s, err: (f) => throw f);
    });

@immutable
class SeatAdminApplyState {
  const SeatAdminApplyState({
    this.submitting = false,
    this.submitted = false,
    this.error,
  });

  final bool submitting;
  final bool submitted;
  final String? error;

  SeatAdminApplyState copyWith({
    bool? submitting,
    bool? submitted,
    String? error,
    bool clearError = false,
  }) {
    return SeatAdminApplyState(
      submitting: submitting ?? this.submitting,
      submitted: submitted ?? this.submitted,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class SeatAdminApplyController extends Notifier<SeatAdminApplyState> {
  SeatAdminApplyController(this.seatId);

  final String seatId;

  @override
  SeatAdminApplyState build() => const SeatAdminApplyState();

  Future<void> submit({
    required String motivation,
    required String contactEmail,
    String? socialMediaInfo,
  }) async {
    state = state.copyWith(submitting: true, clearError: true);
    final result = await ref
        .read(electionsRepositoryProvider)
        .applyForElectionAdmin(
          seatId,
          motivation: motivation,
          contactEmail: contactEmail,
          socialMediaInfo: socialMediaInfo,
        );
    state = result.when(
      ok: (_) {
        ref.invalidate(seatAdminStatusProvider(seatId));
        ref.invalidate(myElectionAdminApplicationsProvider);
        return state.copyWith(submitting: false, submitted: true);
      },
      err: (f) => state.copyWith(submitting: false, error: f.message),
    );
  }
}

final seatAdminApplyControllerProvider = NotifierProvider.autoDispose
    .family<SeatAdminApplyController, SeatAdminApplyState, String>(
      (seatId) => SeatAdminApplyController(seatId),
    );
