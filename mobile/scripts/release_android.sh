#!/usr/bin/env bash
# One command from "code is ready" to "new build on a Play track":
#   bump versionCode -> analyze + test -> build a SIGNED release .aab
#   (with a stripped .env) -> verify it -> upload to Google Play.
#
#   scripts/release_android.sh                          # bump, test, build, upload to internal testing
#   scripts/release_android.sh --no-upload              # build + verify only (upload by hand)
#   scripts/release_android.sh --track beta --notes "What's new"
#   scripts/release_android.sh --promote production --rollout 0.1
#       # no build: take what is already on internal testing to production,
#       # staged to 10% of users (raise it later in Play Console)
#   scripts/release_android.sh --track production --rollout 0.1 --notes "..."
#       # build + upload straight to production, staged
#
# A production release always asks you to type "production" first (--yes skips
# that for automation). One-time Play setup is in docs/ANDROID_RELEASE.md.
set -euo pipefail

PACKAGE="com.choseno.choseno_mobile"
TRACK="internal"
STATUS="completed"
BUMP=1
UPLOAD=1
TESTS=1
NOTES="Bug fixes and improvements."
PUSH_TAG=0
ROLLOUT=""
PROMOTE=""
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --track) TRACK="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --notes) NOTES="$2"; shift 2 ;;
    --no-bump) BUMP=0; shift ;;
    --no-upload) UPLOAD=0; shift ;;
    --skip-tests) TESTS=0; shift ;;
    --push-tag) PUSH_TAG=1; shift ;;
    --rollout) ROLLOUT="$2"; shift 2 ;;
    --promote) PROMOTE="$2"; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

if [[ -n "$ROLLOUT" ]]; then
  [[ "$ROLLOUT" =~ ^0\.[0-9]+$|^1(\.0+)?$ ]] && awk "BEGIN{exit !($ROLLOUT>0 && $ROLLOUT<=1)}" \
    || { echo "--rollout must be a fraction above 0 and up to 1 (e.g. 0.1 = 10%)" >&2; exit 2; }
fi
DEST="${PROMOTE:-$TRACK}"
case "$DEST" in internal|alpha|beta|production) ;; *) echo "Unknown track: $DEST" >&2; exit 2 ;; esac
[[ -z "$PROMOTE" || "$PROMOTE" != "internal" ]] || { echo "--promote takes the DESTINATION track (e.g. production)" >&2; exit 2; }

confirm_production() {
  [[ "$DEST" == "production" && "$ASSUME_YES" != 1 ]] || return 0
  printf '\n\033[1;31mThis releases to PRODUCTION%s.\033[0m Type "production" to continue: ' "${ROLLOUT:+ ($(awk "BEGIN{print $ROLLOUT*100}")% staged)}"
  read -r answer
  [[ "$answer" == "production" ]] || { echo "Cancelled." >&2; exit 1; }
}

load_play_key() {
  KEY="${PLAY_JSON_KEY:-$HOME/.config/choseno/play-service-account.json}"
  [[ -f "$KEY" ]] || die "No Play service-account key at $KEY (or \$PLAY_JSON_KEY). See docs/ANDROID_RELEASE.md."
  command -v fastlane >/dev/null || die "fastlane not installed (brew install fastlane)"
}

# ------------------------------------------------------- promote (no build)
if [[ -n "$PROMOTE" ]]; then
  confirm_production
  load_play_key
  say "Promoting internal testing -> '$PROMOTE'${ROLLOUT:+ at $ROLLOUT}"
  LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 fastlane supply \
    --package_name "$PACKAGE" --json_key "$KEY" \
    --track internal --track_promote_to "$PROMOTE" \
    ${ROLLOUT:+--rollout "$ROLLOUT"} \
    --skip_upload_aab --skip_upload_apk --skip_upload_metadata \
    --skip_upload_changelogs --skip_upload_images --skip_upload_screenshots
  say "Promoted to '$PROMOTE'"; exit 0
fi

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
confirm_production
load_play_key

META="$(mktemp -d)"; trap 'rm -rf "$META"' EXIT
mkdir -p "$META/android/en-US/changelogs"
printf '%s\n' "$NOTES" > "$META/android/en-US/changelogs/${BUILD}.txt"

# A staged rollout is an "inProgress" release; a full one is "completed".
RELEASE_STATUS="$STATUS"
[[ -z "$ROLLOUT" ]] || RELEASE_STATUS="inProgress"

say "Uploading to Play track '$TRACK' (status: $RELEASE_STATUS${ROLLOUT:+, rollout $ROLLOUT})"
LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 fastlane supply \
  --aab "$AAB" \
  --package_name "$PACKAGE" \
  --json_key "$KEY" \
  --track "$TRACK" \
  --release_status "$RELEASE_STATUS" \
  ${ROLLOUT:+--rollout "$ROLLOUT"} \
  --metadata_path "$META/android" \
  --skip_upload_metadata false --skip_upload_changelogs false \
  --skip_upload_images --skip_upload_screenshots --skip_upload_apk

TAG="android-v${NAME}+${BUILD}"
say "Tagging $TAG"
git tag -f "$TAG" >/dev/null && echo "tagged $TAG (commit pubspec.yaml too)"
if [[ "$PUSH_TAG" == 1 ]]; then git push origin "$TAG"; fi
say "Released $NAME+$BUILD to '$TRACK'"
