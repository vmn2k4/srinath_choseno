# Releasing the Android app

Releases are made from this Mac with one script. (A GitHub Actions workflow was
tried and dropped: it only pays off with several releasers or releasing away
from this machine, and it would put the signing and Play keys in GitHub.)

```bash
cd mobile
scripts/release_android.sh                      # bump versionCode, test, build, upload to Internal testing
scripts/release_android.sh --no-upload          # build + verify only, upload the .aab by hand
scripts/release_android.sh --no-bump            # re-run without bumping (e.g. after a failed upload)
scripts/release_android.sh --track beta --notes "What's new"
```

What it does, in order: preflight → bump `version: x.y.z+N` in `pubspec.yaml` →
`flutter analyze` → `flutter test` → build the signed `.aab` → verify it →
upload with `fastlane supply` → tag `android-vX.Y.Z+N` (local; `--push-tag` pushes it).
Commit the `pubspec.yaml` bump afterwards.

## Production

A production release always asks you to type `production` first (`--yes` skips
the question). Prefer promoting a build testers have already used, staged:

```bash
scripts/release_android.sh --promote production --rollout 0.1   # internal -> production, 10% of users
```

Raise the percentage later in Play Console (Production → release → Update
rollout) or promote again. Without `--rollout` a release goes to 100%.
`--track production --rollout 0.1` builds and uploads straight to production.

Production needs the Play listing finished and goes through Google review, and
the service account must have the production permission (see below).

## Why the build uses a stripped `.env`

`mobile/.env` is bundled into the app as an asset. The local copy may also hold
test logins, which must never ship. The script builds with only the four keys
the app reads (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_WEB_CLIENT_ID`,
`GOOGLE_IOS_CLIENT_ID`), restores your `.env` afterwards, and **refuses to
finish if the bundle still contains `username`/`password` lines**.

## One-time setup for the upload step (done)

1. Google Cloud: enable *Google Play Android Developer API*, create a service
   account and a JSON key.
2. Play Console → Users and permissions → invite the service account's email
   with *Release to testing tracks* (add *Release to production* only for
   production releases).
3. Save the key at `~/.config/choseno/play-service-account.json`
   (`chmod 600`), or point `PLAY_JSON_KEY` at it. Never commit it.

## Back these up (this Mac holds the only copies)

- The upload keystore referenced by `android/key.properties`, and its passwords.
  Losing it means you cannot update the app without a Play key-reset request.
- `~/.config/choseno/play-service-account.json` (replaceable: create a new key).

## Rules Play enforces

- `versionCode` must be higher than every build ever uploaded (the script bumps it).
- Internal testing reaches testers within minutes to an hour; production goes through review.
- A release on a still-"draft" app must use `--status draft`.
