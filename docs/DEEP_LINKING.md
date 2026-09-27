# Deep Linking (Universal Links / App Links)

Goal: a `https://www.choseno.com/news/<slug>` (or `/elections/seat/<id>`,
`/wall/<slug>`, `/candidacy/<id>`) link shared anywhere — text, email,
another app — opens the Flutter app directly at that screen when the app
is installed, and falls back to the website when it isn't. The app can
also generate and share those same URLs via the OS share sheet.

## What's built (software side, no native signing needed)

- **Outgoing**: `mobile/lib/core/utils/share_link.dart` (`shareChosenoLink`)
  builds a canonical `https://www.choseno.com/...` URL for any path the app
  has a matching route for, and hands it to `share_plus`'s OS share sheet.
  Wired into the News article, Election seat, and Politician wall screens'
  app bars (share icon).
- **Incoming**: `mobile/lib/core/router/deep_link_service.dart` listens for
  both a cold-start link (`app_links`' `getInitialLink()`) and a warm one
  (`uriLinkStream`), and hands the path straight to `go_router`
  (`appRouterProvider`). Started once at boot in `app.dart`.
- **Auth-aware routing**: `mobile/lib/core/router/app_router.dart`'s
  redirect guard now carries the originally-requested location through
  sign-in via `?from=` — tapping a link while signed out lands on Sign In,
  then continues to the actual link target afterward, instead of Home.
- **Route parity fixes**: added `/wall/:id/:slug` (web's two-segment wall
  URL — the slug is decorative, routes to the same screen as the
  single-segment form) and `/elections/seat/:seatId/candidate/:candidateId`
  (routes to the same `CandidacyWallScreen` as the flat `/candidacy/:id`).
- **Android manifest**: `mobile/android/app/src/main/AndroidManifest.xml`
  has the `autoVerify="true"` App Links `<intent-filter>` for
  `https://www.choseno.com` and `https://choseno.com`.
- **Verification files** (served from the website's `public/.well-known/`):
  `apple-app-site-association` and `assetlinks.json`.

## What's still blocked — needs your input

1. **iOS: no Apple Developer Team assigned yet.** `ios/Runner.xcodeproj`
   has an empty `DEVELOPMENT_TEAM` for every build config, and no
   `Runner.entitlements` file exists. Universal Links need the Associated
   Domains capability, which Xcode wires up (creates/updates the
   entitlements file, updates the provisioning profile) the moment you:
   1. Open `mobile/ios/Runner.xcworkspace` in Xcode.
   2. Select the **Runner** target → **Signing & Capabilities**.
   3. Pick your **Team** (adds the real `DEVELOPMENT_TEAM`).
   4. Click **+ Capability** → **Associated Domains** → add
      `applinks:www.choseno.com` and `applinks:choseno.com`.
   I didn't hand-edit `project.pbxproj` myself for this — it's a fragile
   format to patch blind, and Xcode's own GUI flow does it correctly in
   30 seconds once you're signed into your Apple Developer account there.
2. **`apple-app-site-association`'s `appID` has a placeholder.** It's
   currently `TEAMID.com.choseno.chosenoMobile` — once you have your real
   10-character Team ID from step 1 (or from
   [developer.apple.com/account](https://developer.apple.com/account) →
   Membership), replace `TEAMID` with it and redeploy the site.
3. **Android: only the debug keystore's fingerprint is in
   `assetlinks.json`.** There's no release keystore in the project yet
   (`android/app/build.gradle.kts` signs release builds with the debug
   config). App Links will verify today for a debug build, but **not**
   for whatever you eventually ship to the Play Store — once a real
   release keystore exists, add its SHA-256 fingerprint (`keytool -list -v
   -keystore your-release.jks -alias your-alias`) as a second entry in
   `sha256_cert_fingerprints`.

## Known remaining gaps

A handful of web pages have no mobile screen yet, so a link to them will
open the app to a "page not found" instead of the browser once Universal
Links/App Links are verified (rather than the intended graceful fallback):
politician wall's News-mentions sub-page (`/wall/[ghostId]/news`) and the
boundary-scoped elections listing (`/elections/[boundarySlug]`). Both are
called out as "not yet ported" in `FLUTTER_MOBILE_APP_GUIDE.md` already —
building the missing screens (not just wiring the link) is the real fix,
tracked there, not here.
