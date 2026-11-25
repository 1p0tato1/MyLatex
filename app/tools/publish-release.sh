#!/bin/bash
# Publie dist/Plume.dmg (+ .zip de l'app) dans une Release GitHub. Usage: tools/publish-release.sh v0.2.0
# Nécessite `gh auth login` et un dépôt GitHub avec remote "origin".
set -euo pipefail
cd "$(dirname "$0")/../.."
TAG="${1:?usage: publish-release.sh vX.Y.Z}"
[ -f dist/Plume.dmg ] || VERSION="${TAG#v}" app/tools/release.sh
(cd dist && ditto -c -k --keepParent Plume.app Plume-app.zip)
gh release create "$TAG" dist/Plume.dmg dist/Plume-app.zip --title "Plume $TAG" --notes-file <(sed -n "/^## ${TAG#v}/,/^## /p" CHANGELOG.md | sed '$d')
