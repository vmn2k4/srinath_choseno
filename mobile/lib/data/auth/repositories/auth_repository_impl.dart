// Implements the domain's [AuthRepository] contract against Supabase:
// calls the data source, maps the raw SDK response to a domain [AppUser],
// and translates any thrown exception into a typed [AppFailure] — this is
// the ONE place in the whole auth feature where a try/catch around a
// Supabase call is allowed to live; every use case and provider above this
// layer works with [Result], never a thrown exception.
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/auth/entities/app_user.dart';
import '../../../domain/auth/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';
import '../models/app_user_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this._remote);

  final AuthRemoteDataSource _remote;

  @override
  AppUser? get currentUser => _remote.currentUser?.toEntity();

  @override
  Stream<AppUser?> get authStateChanges =>
      _remote.onAuthStateChange.map((state) => state.session?.user.toEntity());

  @override
  Future<Result<AppUser>> signInWithPassword({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _remote.signInWithPassword(
        email: email,
        password: password,
      );
      final user = response.user;
      if (user == null) {
        return const Result.err(
          UnknownFailure('Sign-in did not return a user.'),
        );
      }
      return Result.ok(user.toEntity());
    } on supabase.AuthRetryableFetchException catch (e) {
      // The request never reached Supabase (DNS, offline, timeout) — say so
      // plainly instead of showing a raw SocketException.
      debugPrint('[auth] signInWithPassword unreachable: ${e.message}');
      return const Result.err(
        NetworkFailure(
          "Can't reach the server. Check this device's internet connection and try again.",
        ),
      );
    } on supabase.AuthException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (e, st) {
      // The generic "network error" below hides WHY (DNS, TLS, timeout, a
      // bug) — print the real one so it shows up in the `flutter run`
      // terminal instead of vanishing.
      debugPrint('[auth] signInWithPassword failed: $e\n$st');
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<AppUser>> signUpWithPassword({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _remote.signUp(email: email, password: password);
      final user = response.user;
      if (user == null) {
        return const Result.err(
          UnknownFailure('Sign-up did not return a user.'),
        );
      }
      return Result.ok(user.toEntity());
    } on supabase.AuthRetryableFetchException {
      return const Result.err(
        NetworkFailure(
          "Can't reach the server. Check this device's internet connection and try again.",
        ),
      );
    } on supabase.AuthException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> signOut() async {
    try {
      await _remote.signOut();
      return const Result.ok(null);
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> resetPasswordForEmail(String email) async {
    try {
      await _remote.resetPasswordForEmail(email);
      return const Result.ok(null);
    } on supabase.AuthException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> updatePassword(String newPassword) async {
    try {
      await _remote.updatePassword(newPassword);
      return const Result.ok(null);
    } on supabase.AuthException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
