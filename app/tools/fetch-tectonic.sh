#!/bin/bash
# Télécharge le binaire Tectonic officiel (macOS) dans bin/tectonic. Usage: tools/fetch-tectonic.sh [version]
set -euo pipefail
cd "$(dirname "$0")/../.."
V="${1:-0.17.0}"; A=$([ "$(uname -m)" = arm64 ] && echo aarch64 || echo x86_64)
mkdir -p bin && cd bin
curl -fL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40$V/tectonic-$V-$A-apple-darwin.tar.gz" | tar xz tectonic
chmod +x tectonic && ./tectonic --version
