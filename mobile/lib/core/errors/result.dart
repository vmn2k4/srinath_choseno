// A minimal Either-style Result type. Every repository method in this app
// returns `Future<Result<T>>` instead of throwing — mirrors the web
// service layer's `{ data, error }` return shape (docs/SERVICES.md in the
// parent repo: "thin wrappers... {data, error} passed straight through"),
// just as a sealed Dart type instead of a loosely-typed object, so a use
// case/provider can exhaustively `switch` on success vs. failure instead
// of wrapping every call in try/catch.
import 'package:flutter/foundation.dart';

import 'app_failure.dart';

@immutable
sealed class Result<T> {
  const Result();

  const factory Result.ok(T value) = Ok<T>;
  const factory Result.err(AppFailure failure) = Err<T>;

  bool get isOk => this is Ok<T>;
  bool get isErr => this is Err<T>;

  /// Returns the success value, or `null` if this is a failure.
  T? get valueOrNull => switch (this) {
    Ok<T>(:final value) => value,
    Err<T>() => null,
  };

  R when<R>({
    required R Function(T value) ok,
    required R Function(AppFailure failure) err,
  }) {
    return switch (this) {
      Ok<T>(:final value) => ok(value),
      Err<T>(:final failure) => err(failure),
    };
  }
}

final class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;
}

final class Err<T> extends Result<T> {
  const Err(this.failure);
  final AppFailure failure;
}
