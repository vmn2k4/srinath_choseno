import '../../../core/errors/result.dart';
import '../entities/political_party.dart';

abstract interface class PoliticalPartiesRepository {
  Future<Result<List<PoliticalParty>>> getPoliticalParties({String? country});
}
