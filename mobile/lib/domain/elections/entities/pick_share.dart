import 'package:flutter/foundation.dart';

@immutable
class PickShareEntry {
  const PickShareEntry({required this.candidateId, this.note});

  final String candidateId;
  final String? note;
}

/// A `race_pick_shares` row plus its ordered picks (the `/p/<code>` page).
@immutable
class PickShare {
  const PickShare({
    required this.code,
    required this.seatId,
    required this.picks,
    this.note,
    this.authorLabel,
  });

  final String code;
  final String seatId;
  final String? note;
  final String? authorLabel;
  final List<PickShareEntry> picks;
}
