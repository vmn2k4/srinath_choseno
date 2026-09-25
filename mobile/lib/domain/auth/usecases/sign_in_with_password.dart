// A use case is a single, named application action — one class, one
// `call()` method, doing exactly what its name says. Nothing here beyond
// "delegate to the repository" yet, but this is where real business rules
// belonging on the client (as opposed to the server-side rules the parent
// repo's docs/CODE_LAYERS.md says must live in Postgres, never client code)
// would go — e.g. client-side input shape validation before ever making the
// network call. Keeping a dedicated use-case class per action, instead of
// calling the repository directly from a Riverpod notifier, is what keeps
// the "one class does one thing" property as more actions get added; skip
// this ceremony only for the simplest passthroughs if the team decides
// it's not earning its keep — see mobile/ARCHITECTURE.md's note on this
// being the one layer this project treats as optional.
import '../../../core/errors/result.dart';
import '../entities/app_user.dart';
import '../repositories/auth_repository.dart';

class SignInWithPassword {
  const SignInWithPassword(this._repository);

  final AuthRepository _repository;

  Future<Result<AppUser>> call({
    required String email,
    required String password,
  }) {
    return _repository.signInWithPassword(email: email, password: password);
  }
}
