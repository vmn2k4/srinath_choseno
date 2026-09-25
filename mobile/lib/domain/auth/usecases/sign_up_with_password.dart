import '../../../core/errors/result.dart';
import '../entities/app_user.dart';
import '../repositories/auth_repository.dart';

class SignUpWithPassword {
  const SignUpWithPassword(this._repository);

  final AuthRepository _repository;

  Future<Result<AppUser>> call({
    required String email,
    required String password,
  }) {
    return _repository.signUpWithPassword(email: email, password: password);
  }
}
