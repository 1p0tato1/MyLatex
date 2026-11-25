# Contributing

Thanks for helping! Bug reports, translations and pull requests are welcome.

## Dev setup (macOS)
```bash
git clone https://github.com/1p0tato1/MyLatex.git mylatex && cd mylatex/app
npm ci && npm run build            # bundles the editor (CodeMirror, KaTeX) into src/
../app/tools/fetch-tectonic.sh     # downloads the Tectonic binary into ../bin
../app/tools/make-seed.sh          # builds the offline TeX cache (~3 min, needs Internet once)
cd src-tauri && cargo run          # launch in dev mode
```
Requirements: Rust (stable), Node 20+, Xcode command-line tools.

## Layout
- `app/src/` — front-end (vanilla JS + CodeMirror): `app.js`, `index.html`, `i18n.js`, guides
- `app/editor-src.js`, `complete.js`, `visual.js`, `spell.js` — editor modules (bundled with esbuild)
- `app/src-tauri/` — Rust backend (compile, SyncTeX, menus, files)
- `app/tools/` — dictionary / language / icon / release scripts

## Adding or fixing a translation
Edit the table in `app/tools/build-lang.py`, then `python3 app/tools/build-lang.py` regenerates `app/src/lang/*.json`. To add a language, add a column and an entry in `LANGS` (`app/src/i18n.js`).

## Releasing
`app/tools/release.sh` builds `dist/MyLatex.app` and `dist/MyLatex.dmg`. `app/tools/publish-release.sh vX.Y.Z` uploads the DMG to a GitHub Release.
Please keep the app light: RAM and startup time are features.
