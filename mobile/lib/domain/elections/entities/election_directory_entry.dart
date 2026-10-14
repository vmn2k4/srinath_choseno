import 'package:flutter/foundation.dart';

/// A place (boundary) with approved candidates in a live election — the
/// "browse who's running by place" chips (get_public_election_places).
@immutable
class ElectionPlace {
  const ElectionPlace({
    required this.shapeId,
    required this.name,
    required this.candidateCount,
  });

  final int shapeId;
  final String name;
  final int candidateCount;
}

/// One live election with its race / candidate counts
/// (get_public_election_directory) plus its top places.
@immutable
class ElectionDirectoryEntry {
  const ElectionDirectoryEntry({
    required this.id,
    required this.name,
    required this.seatCount,
    required this.candidateCount,
    this.electionDate,
    this.places = const [],
  });

  final String id;
  final String name;
  final DateTime? electionDate;
  final int seatCount;
  final int candidateCount;
  final List<ElectionPlace> places;
}
