import 'package:flutter/foundation.dart';

/// One day's opening hours at a [VotingPlace] (`voting_place_schedules`).
/// [votingType] is `advance`, `general` or `special`; [voteDate] is a plain
/// `YYYY-MM-DD` string and [opensAt]/[closesAt] are `HH:MM[:SS]` — kept as
/// strings, like the web, so no timezone conversion can shift them.
@immutable
class VotingPlaceSchedule {
  const VotingPlaceSchedule({
    required this.votingType,
    required this.voteDate,
    this.opensAt,
    this.closesAt,
    this.notes,
  });

  final String votingType;
  final String voteDate;
  final String? opensAt;
  final String? closesAt;
  final String? notes;

  bool get isElectionDay => votingType == 'general';
}

/// Port of `VotingPlace` (src/lib/services/votingPlaces.ts).
@immutable
class VotingPlace {
  const VotingPlace({
    required this.id,
    required this.name,
    required this.schedules,
    required this.lastCheckedAt,
    this.address,
    this.lat,
    this.lng,
    this.notes,
  });

  final String id;
  final String name;
  final String? address;
  final double? lat;
  final double? lng;
  final String? notes;
  final String lastCheckedAt;
  final List<VotingPlaceSchedule> schedules;

  VotingPlace withSchedules(List<VotingPlaceSchedule> next) => VotingPlace(
    id: id,
    name: name,
    address: address,
    lat: lat,
    lng: lng,
    notes: notes,
    lastCheckedAt: lastCheckedAt,
    schedules: next,
  );
}
