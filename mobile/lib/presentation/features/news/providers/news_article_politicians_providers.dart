import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/elections/entities/politician_engagement.dart';
import '../../elections/providers/elections_providers.dart';

/// Engagement summaries (avg rating, rating count) for whichever
/// politicians are tagged on the currently open article — reuses
/// `ElectionsRepository.getPoliticianEngagementSummaries`
/// (get_politician_engagement_summaries RPC) rather than duplicating it;
/// same data every other "avg rating (count)" readout in the app already
/// reads from.
final taggedPoliticiansEngagementProvider = FutureProvider.autoDispose
    .family<Map<String, PoliticianEngagement>, List<String>>((
      ref,
      politicianIds,
    ) async {
      if (politicianIds.isEmpty) return const {};
      final result = await ref
          .watch(electionsRepositoryProvider)
          .getPoliticianEngagementSummaries(politicianIds);
      return result.when(ok: (byId) => byId, err: (failure) => throw failure);
    });
