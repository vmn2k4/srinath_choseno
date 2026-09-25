// No separate datasource/model file for this one — a single, trivial
// read (`political_parties` table, ordered by rank) doesn't earn the extra
// file split the auth/profile/boundaries features use. Promote it to the
// full datasource+model shape if this repository ever grows a second
// method with real mapping logic.
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/political_parties/entities/political_party.dart';
import '../../../domain/political_parties/repositories/political_parties_repository.dart';

class PoliticalPartiesRepositoryImpl implements PoliticalPartiesRepository {
  const PoliticalPartiesRepositoryImpl(this._client);

  final supabase.SupabaseClient _client;

  @override
  Future<Result<List<PoliticalParty>>> getPoliticalParties({
    String? country,
  }) async {
    try {
      var query = _client.from('political_parties').select('id, name');
      if (country != null) query = query.eq('country', country);
      final rows = await query.order('rank');
      return Result.ok(
        rows
            .map(
              (r) =>
                  PoliticalParty(id: r['id'] as int, name: r['name'] as String),
            )
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
