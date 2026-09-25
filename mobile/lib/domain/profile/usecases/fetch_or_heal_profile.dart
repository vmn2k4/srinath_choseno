import '../../../core/errors/result.dart';
import '../entities/user_profile.dart';
import '../repositories/profile_repository.dart';

class FetchOrHealProfile {
  const FetchOrHealProfile(this._repository);
  final ProfileRepository _repository;

  Future<Result<UserProfile>> call(String userId) =>
      _repository.fetchOrHealProfile(userId);
}
