/// Port of the relevant slice of `slugifyText`/`buildPoliticianWallSlug`
/// (src/lib/utils/slugs.ts). Two call sites: `upsertPoliticianProfile`
/// (profile_repository_impl.dart) recomputes `wall_slug` from the current
/// name/role on every save — the same "always recompute" behavior the
/// web's own `upsertPoliticianProfile` has — and `UserProfile.myWallSlug`
/// (user_profile.dart) uses it as a read-side fallback for a politician
/// who has no `wall_slug` on file yet at all, mirroring the website's
/// `profile.politician_wall_slug || buildPoliticianWallSlug(...)`
/// (NavBar.tsx) so "My Wall" doesn't simply never appear for them.
abstract final class Slugs {
  /// Doesn't port the web's `.normalize("NFD")` accent-stripping step
  /// (Dart has no built-in Unicode normalizer) — an accented name falls
  /// back further, to `getWallOwnerProfileBySlug`'s own UUID fallback,
  /// exactly as an unmatched name already does today.
  static String slugifyText(String text) {
    return text
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'(^-|-$)+'), '');
  }

  static String buildPoliticianWallSlug(String? name, String? role) {
    final base = [name, role].where((s) => s != null && s.isNotEmpty).join('-');
    return slugifyText(base.isNotEmpty ? base : 'politician');
  }
}
