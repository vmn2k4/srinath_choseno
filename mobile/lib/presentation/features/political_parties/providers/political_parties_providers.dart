import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/political_parties/repositories/political_parties_repository_impl.dart';
import '../../../../domain/political_parties/repositories/political_parties_repository.dart';
import '../../../common/providers/supabase_provider.dart';

final politicalPartiesRepositoryProvider = Provider<PoliticalPartiesRepository>(
  (ref) {
    return PoliticalPartiesRepositoryImpl(ref.watch(supabaseClientProvider));
  },
);
