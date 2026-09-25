import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/feed/datasources/feed_remote_data_source.dart';
import '../../../../data/feed/repositories/feed_repository_impl.dart';
import '../../../../domain/feed/repositories/feed_repository.dart';
import '../../../common/providers/supabase_provider.dart';

final feedRemoteDataSourceProvider = Provider(
  (ref) => FeedRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final feedRepositoryProvider = Provider<FeedRepository>((ref) {
  return FeedRepositoryImpl(ref.watch(feedRemoteDataSourceProvider));
});
