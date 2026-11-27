#!/bin/bash
# Publie dist/MyLatex.dmg (+ .zip de l'app) dans une Release GitHub. Usage: tools/publish-release.sh v0.2.0
# Nécessite `gh auth login` et un dépôt GitHub avec remote "origin".
set -euo pipefail
cd "$(dirname "$0")/../.."
TAG="${1:?usage: publish-release.sh vX.Y.Z}"
VERSION="${TAG#v}" app/tools/release.sh
(cd dist && ditto -c -k --keepParent MyLatex.app MyLatex-app.zip)
gh release create "$TAG" dist/MyLatex.dmg dist/MyLatex-app.zip --title "MyLatex $TAG" --notes-file <(sed -n "/^## ${TAG#v}/,/^## /p" CHANGELOG.md | sed '$d')
