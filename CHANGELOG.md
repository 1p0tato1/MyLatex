# Changelog

## 0.4.0

### New
- **Open a folder** (File → Open Folder…, ⇧⌘O): the folder's files appear as tabs under the top bar, you can browse into subfolders, and the main document is picked automatically when only one `.tex` file has a `\documentclass`. Images and PDFs are revealed in Finder.
- **Select and copy text in the PDF preview.**
- **Stop a compilation** with the Stop button or ⌘. — it appears when a compile takes more than 1.5 s.
- **Update notification:** MyLatex tells you when a newer version is published on GitHub, with a Download button. It checks at launch and once a day, and can be turned off in Preferences.

### Safer
- **Files changed outside the app** (another editor, `git pull`…) are reloaded when you come back to MyLatex. If you also have unsaved changes, you choose between Overwrite and Reload; saving and auto-save never silently overwrite them.
- **Compilations that loop forever are stopped** after 3 minutes (15 minutes when packages are being downloaded).

### Changed
- The Compile button is hidden while Autocompile is on.
- Save As keeps the extension of non-`.tex` files (`.bib`, `.sty`…), and those files no longer start a compilation on their own.
- Automated tests now run on every build.

## 0.3.0
- Renamed from Plume to MyLatex, with a new icon (settings from Plume are not carried over automatically)
- Help → LaTeX Essentials: five downloadable cheat sheets
- Enter creates a new `\item`; Tab accepts autocompletion
- Hidden title bar
- Fixed Visual mode: crash on empty commands, overlapping math in lists, clicks on formulas
- Error banner can be dismissed

## 0.2.0
- Preferences window (⌘,), 4 UI languages (EN/FR/ES/DE), guides in EN/FR
- English + French spell checking (Bloom-filter dictionaries, automatic or manual language)
- Auto-close brackets/`$`/`\begin…\end`, move/duplicate line
- 7 built-in templates (article, ICML, NeurIPS, IEEE, beamer, CV, letter)
- Collapsible PDF pane, new icon, `.dmg` installer

## 0.1.0
- First release: Tectonic compile with progress, tabs, SyncTeX, Visual mode, themes, autocomplete, outline
