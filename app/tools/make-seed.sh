#!/bin/bash
# Fabrique bin/seed-cache : le cache Tectonic pré-rempli (fichiers TeX/polices courants) embarqué dans l'app,
# pour que la 1re compilation n'ait rien à télécharger. Nécessite Internet (une seule fois) et bin/tectonic.
set -euo pipefail
cd "$(dirname "$0")/../.."
SEED="${SEED:-$PWD/bin/seed-cache}"; T="$PWD/bin/tectonic"; W="$(mktemp -d)"
rm -rf "$SEED"; mkdir -p "$SEED"
# 1) les modèles intégrés, extraits de templates.js
node --input-type=module -e '
import { TEMPLATES } from "'"$PWD"'/app/src/templates.js";
import fs from "fs";
for (const [k, v] of Object.entries(TEMPLATES)) fs.writeFileSync(process.argv[1] + "/" + k + ".tex", typeof v === "string" ? v : v.text ?? v.tex ?? "");
' "$W"
# 2) un document avec les paquets les plus courants
cat > "$W/common.tex" <<'TEX'
\documentclass[11pt]{article}
\usepackage[utf8]{inputenc}\usepackage[T1]{fontenc}\usepackage{lmodern,amsmath,amssymb,amsthm,mathtools,graphicx,xcolor,hyperref,booktabs,tabularx,multirow,array,float,subcaption,enumitem,geometry,fancyhdr,natbib,algorithm,algorithmic,listings,tikz,pgfplots,siunitx,microtype,url,cleveref,babel,csquotes,setspace,caption,titlesec}
\begin{document}Hello $\int_0^1 x\,dx$ \textbf{bold} \emph{it}\end{document}
TEX
for f in "$W"/*.tex; do echo "▶ $(basename "$f")"; (cd "$W" && TECTONIC_CACHE_DIR="$SEED" "$T" "$f" >/dev/null 2>&1) || echo "  (échec ignoré)"; done
echo 6 > "$SEED/.seed-v"; rm -rf "$W"; du -sh "$SEED"
