// Bundles the two-or-three writes Onboarding's submit step makes into one
// call — mirrors OnboardingFlowClient's submit handler on web
// (upsertProfileCore + upsertPoliticianProfile for a politician), so the
// presentation layer fires one action instead of sequencing two repository
// calls itself.
import '../../../core/errors/result.dart';
import '../repositories/profile_repository.dart';
import '../entities/user_profile.dart';

class CompleteOnboarding {
  const CompleteOnboarding(this._repository);
  final ProfileRepository _repository;

  Future<Result<void>> call({
    required String userId,
    required UserRole role,
    String? fullName,
    String? country,
    String? constituency,
    int? politicalPartyId,
    String? education,
    String? hometown,
    String? bio,
    String? avatarUrl,
    String? targetBoundaryId,
    String? targetBoundaryName,
  }) async {
    final coreResult = await _repository.upsertProfileCore(
      userId: userId,
      role: role,
      fullName: fullName,
      country: country,
      constituency: constituency,
      onboardingCompleted: true,
    );
    if (coreResult.isErr) return coreResult;

    if (role != UserRole.politician) return const Result.ok(null);

    return _repository.upsertPoliticianProfile(
      userId: userId,
      politicalPartyId: politicalPartyId,
      education: education,
      hometown: hometown,
      bio: bio,
      avatarUrl: avatarUrl,
      targetBoundaryId: targetBoundaryId,
      targetBoundaryName: targetBoundaryName,
    );
  }
}
