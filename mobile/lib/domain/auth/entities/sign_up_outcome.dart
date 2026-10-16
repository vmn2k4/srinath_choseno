/// What a successful email sign-up means for the app.
enum SignUpOutcome {
  /// A session already exists (email confirmation is off) — carry on.
  signedIn,

  /// The account exists but the email must be confirmed first: Supabase sent a
  /// message with a button and a 6-digit code.
  needsEmailConfirmation,
}
