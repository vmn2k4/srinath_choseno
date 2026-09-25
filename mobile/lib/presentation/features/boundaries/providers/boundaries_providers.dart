import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/boundaries/datasources/boundaries_remote_data_source.dart';
import '../../../../data/boundaries/repositories/boundaries_repository_impl.dart';
import '../../../../domain/boundaries/repositories/boundaries_repository.dart';
import '../../../../domain/profile/entities/user_profile.dart';
import '../../../common/providers/supabase_provider.dart';
import '../../profile/providers/profile_providers.dart';

final boundariesRemoteDataSourceProvider = Provider(
  (ref) => BoundariesRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final boundariesRepositoryProvider = Provider<BoundariesRepository>((ref) {
  return BoundariesRepositoryImpl(
    ref.watch(boundariesRemoteDataSourceProvider),
  );
});

/// Port of `LocationRequiredGate`'s check (parent repo) — true only for a
/// politician account with zero `user_boundary_memberships`, the state
/// that's only reachable via the interview-invite claim shortcut (§4.I.8).
/// The router (core/router/app_router.dart) redirects to Set Location
/// whenever this is true; `setLocationControllerProvider.finish()`
/// invalidates it on save.
final needsLocationProvider = FutureProvider.autoDispose<bool>((ref) async {
  final profile = await ref.watch(ownProfileProvider.future);
  if (profile == null || profile.role != UserRole.politician) return false;
  final result = await ref
      .watch(profileRepositoryProvider)
      .getUserBoundaryMemberships(profile.id);
  return result.when(
    ok: (memberships) => memberships.isEmpty,
    err: (_) => false,
  );
});
