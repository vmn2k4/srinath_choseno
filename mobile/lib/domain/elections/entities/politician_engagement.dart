import 'package:flutter/foundation.dart';

/// Port of `get_politician_engagement_summaries`'s row shape — `supporterCount`
/// already combines authenticated + anonymous supporters server-side
/// (docs/FLUTTER_MOBILE_APP_GUIDE.md §4.I.7 in the parent repo — never sum
/// another source on top of this number).
@immutable
class PoliticianEngagement {
  const PoliticianEngagement({
    required this.politicianId,
    this.supporterCount = 0,
    this.avgRating = 0,
    this.ratingCount = 0,
    this.commentCount = 0,
  });

  final String politicianId;
  final int supporterCount;
  final double avgRating;
  final int ratingCount;
  final int commentCount;
}
