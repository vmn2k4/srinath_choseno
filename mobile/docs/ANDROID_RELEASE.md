# Releasing the Android app

One command builds a signed bundle and publishes it to Google Play:

```bash
cd mobile
scripts/release_android.sh                      # bump versionCode, test, build, upload to Internal testing
scripts/release_android.sh --no-upload          # build + verify only, upload the .aab by hand
scripts/release_android.sh --track beta --notes "What's new"
```

What the script does, in order: preflight → bump `version: x.y.z+N` in
`pubspec.yaml` → `flutter analyze` → `flutter test` → build the signed
`.aab` → verify it → upload with `fastlane supply` → tag `android-vX.Y.Z+N`.

## Why the build uses a stripped `.env`

`mobile/.env` is bundled into the app as an asset. The local copy may also hold
test logins, which must never ship. The script builds with only the four keys
the app reads (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_WEB_CLIENT_ID`,
`GOOGLE_IOS_CLIENT_ID`), restores your `.env` afterwards, and **refuses to
finish if the bundle still contains `username`/`password` lines**.

## One-time setup for the upload step

The upload uses the Play Developer API, which needs a service account:

1. **Google Cloud** (any project): enable *Google Play Android Developer API*,
   create a service account, create a JSON key.
2. **Play Console → Users and permissions → Invite new users**: invite the
   service account's email, and grant it *Release to testing tracks* (add
   *Release to production* only if you want it to publish to production) for
   the Choseno app.
3. Save the key outside the repo and lock it down:
   ```bash
   mkdir -p ~/.config/choseno
   mv ~/Downloads/<key>.json ~/.config/choseno/play-service-account.json
   chmod 600 ~/.config/choseno/play-service-account.json
   ```
   (or point `PLAY_JSON_KEY` at it). Never commit it.
4. `brew install fastlane` if it isn't installed.

Until step 1–3 are done the script still builds and verifies the bundle, then
stops and tells you where the `.aab` is.

## Releasing from CI instead

`.github/workflows/android-release.yml` does the same on GitHub when you push a
tag like `android-v1.0.0+3` (or run it from the Actions tab). Commit the version
bump first — CI uses the versionCode in `pubspec.yaml`.

Repository secrets to add (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i <upload keystore>.jks \| pbcopy` |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` | from `android/key.properties` |
| `PLAY_SERVICE_ACCOUNT_JSON` | the whole JSON key file |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | same as `.env` |
| `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` | same as `.env` |

## Rules Play enforces

- `versionCode` must be higher than every build ever uploaded (the script bumps it).
- Internal testing releases are available to testers within minutes; production goes through review.
- Releases to a still-"draft" app must use `--status draft`.
