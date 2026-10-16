// go_router config + the redirect guards described in
// docs/FLUTTER_MOBILE_APP_GUIDE.md §1 (parent repo). All three guard
// layers are wired up now:
//   1. Signed-in vs. signed-out → /auth.                              ✅
//   2. `profiles.onboarding_completed` → /onboarding.                 ✅
//   3. `LocationRequiredGate` → /set-location (a politician account   ✅
//      claimed via interview invite with zero boundary memberships,
//      §1/§4.I.8). Checked via `needsLocationProvider`
//      (boundaries_providers.dart), which itself only re-runs when the
//      profile/membership data actually changes — not per navigation —
//      matching the guide's note on the redirect-loop bug this exact
//      naive-recompute mistake caused on web.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'deep_link_service.dart';

import '../../presentation/common/widgets/app_shell.dart';
import '../../presentation/features/auth/providers/auth_providers.dart';
import '../../presentation/features/candidacy/screens/candidacy_wall_screen.dart';
import '../../presentation/features/candidacy/screens/candidate_application_screen.dart';
import '../../presentation/features/auth/screens/confirm_email_screen.dart';
import '../../presentation/features/auth/screens/forgot_password_screen.dart';
import '../../presentation/features/auth/screens/new_password_screen.dart';
import '../../presentation/features/auth/screens/reset_password_screen.dart';
import '../../presentation/features/auth/screens/sign_in_screen.dart';
import '../../presentation/features/boundaries/providers/boundaries_providers.dart';
import '../../presentation/features/elections/screens/elections_list_screen.dart';
import '../../presentation/features/elections/screens/pick_share_screen.dart';
import '../../presentation/features/feed/screens/post_detail_screen.dart';
import '../../presentation/features/elections/screens/race_list_screen.dart';
import '../../presentation/features/elections/screens/seat_detail_screen.dart';
import '../../presentation/features/feed/screens/feed_screen.dart';
import '../../presentation/features/find_my_district/screens/find_my_district_screen.dart';
import '../../presentation/features/legal/screens/static_content_screen.dart';
import '../../presentation/features/my_elections/screens/my_elections_screen.dart';
import '../../presentation/features/news/screens/news_article_screen.dart';
import '../../presentation/features/news/screens/news_list_screen.dart';
import '../../presentation/features/onboarding/screens/onboarding_screen.dart';
import '../../presentation/features/politician_wall/screens/my_wall_screen.dart';
import '../../presentation/features/politician_wall/screens/politician_wall_screen.dart';
import '../../presentation/features/profile/providers/profile_providers.dart';
import '../../presentation/features/profile/screens/edit_profile_screen.dart';
import '../../presentation/features/profile/screens/profile_screen.dart';
import '../../presentation/features/set_location/screens/set_location_screen.dart';
import '../../presentation/features/splash/screens/splash_screen.dart';

abstract final class AppRoutes {
  static const splash = '/';
  static const auth = '/auth';
  static const confirmEmail = '/auth/confirm-email';
  static const forgotPassword = '/auth/forgot-password';
  static const resetPassword = '/auth/reset-password';
  static const newPassword = '/auth/new-password';

  /// Password reset step 2 (enter the emailed code).
  static String resetPasswordFor(String email) =>
      '$resetPassword?email=${Uri.encodeComponent(email)}';

  /// The "enter your 6-digit code" screen. [resend] sends a fresh email as it
  /// opens (used when a login hit an unconfirmed email).
  static String confirmEmailFor(String email, {bool resend = false}) =>
      '$confirmEmail?email=${Uri.encodeComponent(email)}${resend ? '&resend=1' : ''}';
  static const onboarding = '/onboarding';
  static const home = '/home';
  static const myWall = '/my-wall';
  static const findMyDistrict = '/find-my-district';
  static const elections = '/elections';
  static const profile = '/profile';
  static const profileEdit = '/profile/edit';
  static const setLocation = '/set-location';
  static const news = '/news';
  static const myElections = '/politician/elections';
  static const about = '/about';
  static const privacy = '/privacy';
  static const terms = '/terms';

  /// `wallIdOrSlug` accepts either a raw ghost id / profile id or a
  /// `wall_slug` — mirrors the website's two wall URL forms (§4.A.9).
  static String wall(String wallIdOrSlug) => '/wall/$wallIdOrSlug';

  static String seat(String seatId) => '/elections/seat/$seatId';

  static String electionHub(String electionId, {String? name}) =>
      '/elections/e/$electionId${name != null ? '?name=${Uri.encodeComponent(name)}' : ''}';

  static String place(int shapeId, {String? name}) =>
      '/elections/place-$shapeId${name != null ? '?name=${Uri.encodeComponent(name)}' : ''}';

  static String pickShare(String code) => '/p/$code';

  /// A single post (what a shared post link opens).
  static String post(String postId) => '/post/$postId';

  static String candidacy(String candidateId) => '/candidacy/$candidateId';

  static String candidateApplication(String candidateId) =>
      '/apply/$candidateId';
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final refreshListenable = _RouterRefreshListenable(ref);
  ref.onDispose(refreshListenable.dispose);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final authState = ref.read(authStateChangesProvider);
      // Still resolving the initial session — stay on the splash screen
      // rather than guessing which way to redirect.
      if (authState.isLoading && !authState.hasValue) return null;

      final isSignedIn = authState.value != null;
      final location = state.matchedLocation;

      if (!isSignedIn) {
        if (location == AppRoutes.auth ||
            location == AppRoutes.confirmEmail ||
            location == AppRoutes.forgotPassword ||
            location == AppRoutes.resetPassword) {
          return null;
        }
        // Carries the originally-requested location through sign-in (see
        // the "bounce away from Auth" branch below) — otherwise a shared
        // link tapped while signed out lands on Home after sign-in
        // instead of the article/seat/wall page the link actually pointed
        // to (see deep_link_service.dart).
        return '${AppRoutes.auth}?from=${Uri.encodeComponent(state.uri.toString())}';
      }

      // A reset code/link was accepted: hold the person on the set-new-password
      // screen (the code created a real session, so without this they'd be
      // treated as simply signed in and sent Home with the old password).
      if (ref.read(passwordRecoveryPendingProvider)) {
        return location == AppRoutes.newPassword ? null : AppRoutes.newPassword;
      }

      // Signed in — check onboarding next. `ownProfileProvider` is watched
      // (not just read) so this closure re-evaluates once the profile
      // finishes loading, without needing a second Listenable hookup for
      // that specific transition.
      final profileState = ref.read(ownProfileProvider);
      // Wait whenever the profile is (re)loading — not only on the very first
      // load. Right after sign-in Riverpod keeps the previous (signed-out,
      // null) value while the real one loads, and treating that stale null as
      // "onboarding not completed" flashed the role-selection screen and sent
      // a pending deep link astray.
      // A signed-in user always has a profile (it is healed if missing), so a
      // null here is the brief gap before the post-sign-in load starts, not
      // "no profile" — also wait through it.
      if (profileState.isLoading ||
          (profileState.value == null && !profileState.hasError)) {
        return null;
      }

      final onboardingCompleted =
          profileState.value?.onboardingCompleted ?? false;
      if (!onboardingCompleted) {
        return location == AppRoutes.onboarding ? null : AppRoutes.onboarding;
      }

      // Layer 3: LocationRequiredGate. Only ever true for a politician
      // with zero boundary memberships — see needsLocationProvider's own
      // doc comment. Still-loading is treated as "no redirect yet" (same
      // pattern as the onboarding check above), not "assume false."
      final needsLocationState = ref.read(needsLocationProvider);
      final needsLocation = needsLocationState.value ?? false;
      if (needsLocation && location != AppRoutes.setLocation) {
        return AppRoutes.setLocation;
      }

      // `/my-wall` is a politician-only tab — anyone else (a deep link, a
      // stale route after their role changed) goes home rather than
      // sitting on a screen with no wall to show.
      if (location == AppRoutes.myWall &&
          profileState.value?.myWallSlug == null) {
        return AppRoutes.home;
      }

      // Fully signed in + onboarded + located: bounce away from Auth/
      // Onboarding/Splash/Set-Location toward Home — unless Auth carried a
      // `?from=` (see the sign-out branch above), in which case that's
      // where the visitor actually meant to go.
      if (location == AppRoutes.auth ||
          location == AppRoutes.confirmEmail ||
          location == AppRoutes.forgotPassword ||
          location == AppRoutes.resetPassword ||
          location == AppRoutes.newPassword ||
          location == AppRoutes.onboarding ||
          location == AppRoutes.splash ||
          (location == AppRoutes.setLocation && !needsLocation)) {
        final pending = ref.read(pendingDeepLinkProvider);
        if (pending.target != null && pending.target != location) {
          final t = pending.target!;
          pending.target = null;
          return t;
        }
        if (location == AppRoutes.auth) {
          final from = state.uri.queryParameters['from'];
          if (from != null && from.isNotEmpty && from != AppRoutes.auth) {
            return from;
          }
        }
        return AppRoutes.home;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.auth,
        builder: (context, state) => const SignInScreen(),
      ),
      GoRoute(
        path: AppRoutes.confirmEmail,
        builder: (context, state) => ConfirmEmailScreen(
          email: state.uri.queryParameters['email'] ?? '',
          autoResend: state.uri.queryParameters['resend'] == '1',
        ),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        builder: (context, state) => ResetPasswordScreen(
          email: state.uri.queryParameters['email'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.newPassword,
        builder: (context, state) => const NewPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: AppRoutes.setLocation,
        builder: (context, state) => const SetLocationScreen(),
      ),

      // The primary destinations live behind one persistent bottom
      // nav bar (presentation/common/widgets/app_shell.dart) — each branch
      // keeps its own navigation stack/scroll position when switching
      // tabs, which a plain IndexedStack driven by hand wouldn't give for
      // free. Everything else below (someone's wall, seat detail, article, edit
      // profile) is a top-level route pushed OVER the shell — it covers
      // the bottom nav while open, the standard "hide chrome on drill-down"
      // pattern, then returns to it on pop.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const FeedScreen(),
              ),
            ],
          ),
          // Politician-only tab (the nav bar only shows it when the profile
          // has a wall slug — see app_shell.dart). Always registered so the
          // branch list never depends on the signed-in user's role.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.myWall,
                builder: (context, state) => const MyWallScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.findMyDistrict,
                builder: (context, state) => const FindMyDistrictScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.elections,
                builder: (context, state) => const ElectionsListScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.news,
                builder: (context, state) => const NewsListScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      GoRoute(
        path: '/wall/:wallIdOrSlug',
        builder: (context, state) => PoliticianWallScreen(
          ghostIdOrSlug: state.pathParameters['wallIdOrSlug']!,
        ),
        routes: [
          // Web's SEO-friendly two-segment wall URL (`/wall/[ghostId]/
          // [slug]`) — the slug is decorative there (routing key is
          // always the first segment), so a link in that shape opens the
          // exact same screen as the single-segment form.
          GoRoute(
            path: ':slug',
            builder: (context, state) => PoliticianWallScreen(
              ghostIdOrSlug: state.pathParameters['wallIdOrSlug']!,
            ),
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.profileEdit,
        builder: (context, state) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/news/:slug',
        builder: (context, state) =>
            NewsArticleScreen(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/elections/seat/:seatId',
        builder: (context, state) =>
            SeatDetailScreen(seatId: state.pathParameters['seatId']!),
        routes: [
          // Web's seat-scoped candidate URL (`/elections/seat/[seatId]/
          // candidate/[candidateId]`) — same CandidacyWallScreen the flat
          // `/candidacy/:candidateId` route below renders; the seatId
          // segment is only there on web for breadcrumb context.
          GoRoute(
            path: 'candidate/:candidateId',
            builder: (context, state) => CandidacyWallScreen(
              candidateId: state.pathParameters['candidateId']!,
            ),
          ),
        ],
      ),
      // Election hub: `/elections/e/<name>-<uuid>` (web's slug shape — only
      // the trailing UUID matters).
      GoRoute(
        path: '/elections/e/:electionSlug',
        builder: (context, state) {
          final slug = state.pathParameters['electionSlug']!;
          final id = RegExp(
            r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
          ).stringMatch(slug);
          return RaceListScreen.election(
            electionId: id ?? slug,
            title: state.uri.queryParameters['name'] ?? 'Election',
          );
        },
      ),
      // Per-place page: `/elections/<name>-<shapeId>`. Registered after the
      // `/elections/seat/...` and `/elections/e/...` routes above.
      GoRoute(
        path: '/elections/:boundarySlug',
        builder: (context, state) {
          final slug = state.pathParameters['boundarySlug']!;
          final id = int.tryParse(RegExp(r'(\d+)$').stringMatch(slug) ?? '');
          if (id == null) return const ElectionsListScreen();
          return RaceListScreen.place(
            shapeId: id,
            title: state.uri.queryParameters['name'] ?? 'Who\'s running here',
          );
        },
      ),
      // A single shared post (`/post/<id>`).
      GoRoute(
        path: '/post/:id',
        builder: (context, state) =>
            PostDetailScreen(postId: state.pathParameters['id']!),
      ),
      // Shared-picks page (`/p/<code>`).
      GoRoute(
        path: '/p/:code',
        builder: (context, state) =>
            PickShareScreen(code: state.pathParameters['code']!),
      ),
      GoRoute(
        path: '/candidacy/:candidateId',
        builder: (context, state) => CandidacyWallScreen(
          candidateId: state.pathParameters['candidateId']!,
        ),
      ),
      GoRoute(
        path: '/apply/:candidateId',
        builder: (context, state) => CandidateApplicationScreen(
          candidateId: state.pathParameters['candidateId']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.myElections,
        builder: (context, state) => const MyElectionsScreen(),
      ),
      GoRoute(
        path: AppRoutes.about,
        builder: (context, state) =>
            const StaticContentScreen(page: StaticPage.about),
      ),
      GoRoute(
        path: AppRoutes.privacy,
        builder: (context, state) =>
            const StaticContentScreen(page: StaticPage.privacy),
      ),
      GoRoute(
        path: AppRoutes.terms,
        builder: (context, state) =>
            const StaticContentScreen(page: StaticPage.terms),
      ),
    ],
  );
});

/// Bridges Riverpod's `ref.listen` into the `Listenable` go_router's
/// `redirect` wants — notifies on every auth-state OR own-profile change,
/// so `redirect` re-runs without go_router needing to know Riverpod exists.
/// `ref.listen` (not `ref.watch`) is used deliberately: this class lives
/// for as long as `appRouterProvider` does and should react to changes,
/// not cause `appRouterProvider` itself (and therefore the whole `GoRouter`
/// instance) to rebuild on every auth/profile change.
class _RouterRefreshListenable extends ChangeNotifier {
  _RouterRefreshListenable(Ref ref) {
    ref.listen(authStateChangesProvider, (_, _) => notifyListeners());
    ref.listen(ownProfileProvider, (_, _) => notifyListeners());
    ref.listen(needsLocationProvider, (_, _) => notifyListeners());
    ref.listen(passwordRecoveryPendingProvider, (_, _) => notifyListeners());
  }
}
