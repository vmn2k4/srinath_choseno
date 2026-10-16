import '../../../core/errors/result.dart';
import '../entities/sign_up_outcome.dart';
import '../repositories/auth_repository.dart';

class SignUpWithPassword {
  const SignUpWithPassword(this._repository);

  final AuthRepository _repository;

  Future<Result<SignUpOutcome>> call({
    required String email,
    required String password,
  }) {
    return _repository.signUpWithPassword(email: email, password: password);
  }
}
