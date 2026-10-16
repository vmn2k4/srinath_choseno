#!/usr/bin/env bash
# One command from "code is ready" to "new build on a Play track":
#   bump versionCode -> analyze + test -> build a SIGNED release .aab
#   (with a stripped .env) -> verify it -> upload to Google Play.
#
#   scripts/release_android.sh                 # bump, test, build, upload to internal testing
#   scripts/release_android.sh --no-upload     # build + verify only (upload by hand)
#   scripts/release_android.sh --track beta --notes "What's new"
#
# One-time Play setup for the upload step is in docs/ANDROID_RELEASE.md.
set -euo pipefail

PACKAGE="com.choseno.choseno_mobile"
TRACK="internal"
STATUS="completed"
BUMP=1
UPLOAD=1
TESTS=1
NOTES="Bug fixes and improvements."
PUSH_TAG=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --track) TRACK="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --notes) NOTES="$2"; shift 2 ;;
    --no-bump) BUMP=0; shift ;;
    --no-upload) UPLOAD=0; shift ;;
    --skip-tests) TESTS=0; shift ;;
    --push-tag) PUSH_TAG=1; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------- preflight
say "Preflight"
command -v flutter >/dev/null || die "flutter not on PATH"
command -v jarsigner >/dev/null || die "jarsigner (JDK) not on PATH"
[[ -f android/key.properties ]] || die "android/key.properties missing — the upload keystore isn't configured"
[[ -f .env ]] || die ".env missing"
REQUIRED_KEYS=(SUPABASE_URL SUPABASE_ANON_KEY)
OPTIONAL_KEYS=(GOOGLE_WEB_CLIENT_ID GOOGLE_IOS_CLIENT_ID)
for k in "${REQUIRED_KEYS[@]}"; do
  grep -qE "^${k}=.+" .env || die ".env is missing $k"
done

# ------------------------------------------------------------------ version
CURRENT="$(grep -E '^version:' pubspec.yaml | head -1 | awk '{print $2}')"
NAME="${CURRENT%%+*}"; BUILD="${CURRENT##*+}"
if [[ "$BUMP" == 1 ]]; then
  BUILD=$((BUILD + 1))
  say "Version $CURRENT -> $NAME+$BUILD"
  sed -i.bak -E "s/^version: .*/version: ${NAME}+${BUILD}/" pubspec.yaml && rm -f pubspec.yaml.bak
else
  say "Keeping version $NAME+$BUILD"
fi

# -------------------------------------------------------------------- gates
say "flutter pub get"; flutter pub get >/dev/null
say "flutter analyze"; flutter analyze
if [[ "$TESTS" == 1 ]]; then say "flutter test"; flutter test; fi

# ------------------------------------------------------------- stripped .env
# .env is bundled into the app as an asset. The developer's local copy can also
# hold test logins, which must never ship — build with only the keys the app reads.
cp .env .env.release-backup
restore_env() { [[ -f .env.release-backup ]] && mv -f .env.release-backup .env; }
trap restore_env EXIT
{
  for k in "${REQUIRED_KEYS[@]}" "${OPTIONAL_KEYS[@]}"; do grep -E "^${k}=" .env || true; done
} > .env.stripped && mv .env.stripped .env

# -------------------------------------------------------------------- build
say "Building signed release bundle"
flutter build appbundle --release
AAB="build/app/outputs/bundle/release/app-release.aab"
[[ -f "$AAB" ]] || die "build produced no .aab"
restore_env; trap - EXIT

# ------------------------------------------------------------------- verify
say "Verifying bundle"
jarsigner -verify "$AAB" | head -1
keytool -printcert -jarfile "$AAB" | grep -E "Owner|SHA256"
LEAKED="$(unzip -p "$AAB" base/assets/flutter_assets/.env | grep -ciE 'username|password' || true)"
[[ "$LEAKED" == 0 ]] || die "bundled .env still contains login lines — refusing to continue"
echo "OK  $(du -h "$AAB" | cut -f1)  $AAB  (versionCode $BUILD, versionName $NAME)"

if [[ "$UPLOAD" == 0 ]]; then
  say "Done (--no-upload). Bundle: $PWD/$AAB"; exit 0
fi

# ------------------------------------------------------------------- upload
KEY="${PLAY_JSON_KEY:-$HOME/.config/choseno/play-service-account.json}"
[[ -f "$KEY" ]] || die "No Play service-account key at $KEY (or \$PLAY_JSON_KEY). See docs/ANDROID_RELEASE.md. The bundle is built: $PWD/$AAB"
command -v fastlane >/dev/null || die "fastlane not installed (brew install fastlane)"

META="$(mktemp -d)"; trap 'rm -rf "$META"' EXIT
mkdir -p "$META/android/en-US/changelogs"
printf '%s\n' "$NOTES" > "$META/android/en-US/changelogs/${BUILD}.txt"

say "Uploading to Play track '$TRACK' (status: $STATUS)"
fastlane supply \
  --aab "$AAB" \
  --package_name "$PACKAGE" \
  --json_key "$KEY" \
  --track "$TRACK" \
  --release_status "$STATUS" \
  --release_name "${NAME} (${BUILD})" \
  --metadata_path "$META/android" \
  --skip_upload_metadata false --skip_upload_changelogs false \
  --skip_upload_images --skip_upload_screenshots --skip_upload_apk

TAG="android-v${NAME}+${BUILD}"
say "Tagging $TAG"
git tag -f "$TAG" >/dev/null && echo "tagged $TAG (commit pubspec.yaml too)"
if [[ "$PUSH_TAG" == 1 ]]; then git push origin "$TAG"; fi
say "Released $NAME+$BUILD to '$TRACK'"
