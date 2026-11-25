#!/bin/bash
# Construit dist/MyLatex.app et dist/MyLatex.dmg (installateur). Usage:
#   tools/release.sh                      # signature "ad hoc" (s'ouvre par clic droit → Ouvrir la 1re fois)
#   DEVELOPER_ID="Developer ID Application: Votre Nom (TEAMID)" tools/release.sh        # signature développeur
#   DEVELOPER_ID="..." NOTARY_PROFILE="mylatex-notary" tools/release.sh                   # + notarisation Apple (aucun avertissement)
# Pré-requis notarisation: compte Apple Developer (99 $/an), certificat "Developer ID Application" dans le trousseau, puis une fois:
#   xcrun notarytool store-credentials mylatex-notary --apple-id VOTRE@ID --team-id TEAMID --password MOT_DE_PASSE_SPECIFIQUE_APP
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(cd .. && pwd)"; DIST="$ROOT/dist"; APP="$DIST/MyLatex.app"; VERSION="${VERSION:-0.3.0}"; VERSION="${VERSION#v}"
ID="${DEVELOPER_ID:--}"

echo "▶ compilation (release)"; (cd src-tauri && cargo build --release)
rm -rf "$DIST"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp src-tauri/target/release/mylatex "$APP/Contents/MacOS/mylatex"
cp "$ROOT/bin/tectonic" "$APP/Contents/Resources/tectonic"
cp -R "$ROOT/bin/seed-cache" "$APP/Contents/Resources/seed-cache"
cp src-tauri/icons/icon.icns "$APP/Contents/Resources/icon.icns"
python3 - "$APP/Contents/Info.plist" "$VERSION" <<'PY'
import plistlib, sys
plistlib.dump({
  "CFBundleName": "MyLatex", "CFBundleDisplayName": "MyLatex", "CFBundleExecutable": "mylatex", "CFBundleIconFile": "icon.icns",
  "CFBundleIdentifier": "app.mylatex.desktop", "CFBundlePackageType": "APPL", "CFBundleInfoDictionaryVersion": "6.0",
  "CFBundleShortVersionString": sys.argv[2], "CFBundleVersion": sys.argv[2], "CFBundleDevelopmentRegion": "en",
  "CFBundleLocalizations": ["en", "fr", "es", "de"], "LSMinimumSystemVersion": "10.15", "NSHighResolutionCapable": True,
  "LSApplicationCategoryType": "public.app-category.productivity",
  "CFBundleDocumentTypes": [{"CFBundleTypeName": "LaTeX document", "CFBundleTypeExtensions": ["tex"], "CFBundleTypeIconFile": "icon.icns", "CFBundleTypeRole": "Editor", "LSHandlerRank": "Alternate"}],
}, open(sys.argv[1], "wb"))
PY

echo "▶ signature: $ID"
OPTS=(--force --timestamp); [ "$ID" != "-" ] && OPTS+=(--options runtime)
codesign "${OPTS[@]}" -s "$ID" "$APP/Contents/Resources/tectonic"
codesign "${OPTS[@]}" -s "$ID" "$APP"
codesign --verify --deep --strict "$APP" && echo "  signature valide"

echo "▶ image disque"
STAGE="$(mktemp -d)"; cp -R "$APP" "$STAGE/"; ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "MyLatex" -srcfolder "$STAGE" -ov -format UDZO "$DIST/MyLatex.dmg" >/dev/null
rm -rf "$STAGE"
[ "$ID" != "-" ] && codesign --force --timestamp -s "$ID" "$DIST/MyLatex.dmg"

if [ "$ID" != "-" ] && [ -n "${NOTARY_PROFILE:-}" ]; then
  echo "▶ notarisation (quelques minutes)"
  xcrun notarytool submit "$DIST/MyLatex.dmg" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$DIST/MyLatex.dmg"
else
  echo "ℹ non notarisé: au premier lancement, clic droit sur MyLatex → Ouvrir (ou Réglages Système → Confidentialité et sécurité → Ouvrir quand même)."
fi
echo "✔ $DIST/MyLatex.dmg ($(du -h "$DIST/MyLatex.dmg" | cut -f1))"
