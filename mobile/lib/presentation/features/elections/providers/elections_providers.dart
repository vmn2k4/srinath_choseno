import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/elections/datasources/elections_remote_data_source.dart';
import '../../../../data/elections/repositories/elections_repository_impl.dart';
import '../../../../domain/elections/repositories/elections_repository.dart';
import '../../../common/providers/supabase_provider.dart';
import '../../boundaries/providers/boundaries_providers.dart';

final electionsRemoteDataSourceProvider = Provider(
  (ref) => ElectionsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final electionsRepositoryProvider = Provider<ElectionsRepository>((ref) {
  return ElectionsRepositoryImpl(
    ref.watch(electionsRemoteDataSourceProvider),
    ref.watch(boundariesRepositoryProvider),
  );
});
