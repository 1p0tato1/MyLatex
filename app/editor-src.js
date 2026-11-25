import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, Decoration } from "@codemirror/view";
import { EditorState, Prec, Compartment, StateField, StateEffect, EditorSelection } from "@codemirror/state";
import { autocompletion, snippet, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { latexSource, data as completionData } from "./complete.js";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, toggleComment, moveLineUp, moveLineDown, copyLineDown } from "@codemirror/commands";
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching, indentUnit } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { searchKeymap, highlightSelectionMatches, openSearchPanel, findNext, findPrevious, gotoLine } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";

const hl = HighlightStyle.define([
  { tag: t.tagName, color: "var(--c-cmd)" },
  { tag: t.keyword, color: "var(--c-cmd)" },
  { tag: t.standard(t.variableName), color: "var(--c-env)" },
  { tag: t.comment, color: "var(--c-com)", fontStyle: "italic" },
  { tag: [t.string, t.number, t.atom], color: "var(--c-math)" },
  { tag: t.bracket, color: "var(--c-br)" },
  { tag: t.invalid, color: "var(--c-err)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", background: "var(--ed)", color: "var(--fg)" },
  ".cm-scroller": { fontVariantLigatures: "var(--lig, normal)", fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: "var(--fs, 13px)", lineHeight: "1.6" },
  ".cm-content": { padding: "10px 0", caretColor: "var(--fg)" },
  ".cm-gutters": { background: "var(--ed)", color: "var(--gut)", border: "0" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 14px 0 18px" },
  ".cm-activeLine": { background: "var(--lineh)" },
  ".cm-activeLineGutter": { background: "var(--lineh)", color: "var(--fg)" },
  ".cm-selectionMatch": { background: "color-mix(in srgb, var(--accent) 22%, transparent)" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { background: "var(--sel) !important" },
  ".cm-cursor": { borderLeftColor: "var(--fg)", borderLeftWidth: "2px" },
  ".cm-panels": { background: "var(--bg)", color: "var(--fg)", borderColor: "var(--line)", fontFamily: "Inter, system-ui, sans-serif" },
  ".cm-panels input, .cm-panels button": { background: "var(--ed)", color: "var(--fg)", border: "1px solid var(--line)", borderRadius: "4px", font: "inherit" },
  ".cm-tooltip": { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "8px", boxShadow: "0 8px 28px #0005", overflow: "hidden" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "12.5px", maxHeight: "260px" },
  ".cm-tooltip-autocomplete ul li": { padding: "2px 10px", color: "var(--fg)" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { background: "color-mix(in srgb, var(--accent) 28%, transparent)", color: "var(--fg)" },
  ".cm-completionDetail": { color: "var(--muted)", fontStyle: "normal", marginLeft: "1em", fontFamily: "Inter, system-ui, sans-serif", fontSize: "11px" },
  ".cm-completionMatchedText": { textDecoration: "none", color: "var(--accent)", fontWeight: "600" },
  ".cm-misspell": { textDecoration: "underline wavy #f75464", textDecorationThickness: "1px", textUnderlineOffset: "2px", textDecorationSkipInk: "none" },
  ".cm-diag-error": { textDecoration: "underline wavy #f75464", textDecorationSkipInk: "none", textUnderlineOffset: "3px", background: "color-mix(in srgb, #f75464 9%, transparent)", boxShadow: "inset 3px 0 0 #f75464" },
  ".cm-diag-warn": { textDecoration: "underline dotted #e5a50a", textUnderlineOffset: "3px", boxShadow: "inset 3px 0 0 #e5a50a55" },
  ".cm-searchMatch": { background: "color-mix(in srgb, #f5c542 35%, transparent)", outline: "1px solid #f5c542" },
  ".cm-searchMatch-selected": { background: "color-mix(in srgb, #f5c542 65%, transparent)" },
});

// Marques de diagnostics (lignes en erreur / warning), suivies lors des éditions.
// entoure la sélection (ou insère la paire avec le curseur dedans); ré-applique pour retirer l'enveloppe
function wrap(view, b, a) {
  view.dispatch(view.state.changeByRange((r) => {
    const d = view.state.doc, txt = d.sliceString(r.from, r.to);
    if (d.sliceString(Math.max(0, r.from - b.length), r.from) === b && d.sliceString(r.to, r.to + a.length) === a)
      return { changes: [{ from: r.from - b.length, to: r.from }, { from: r.to, to: r.to + a.length }], range: EditorSelection.range(r.from - b.length, r.to - b.length) };
    return { changes: { from: r.from, to: r.to, insert: b + txt + a }, range: EditorSelection.range(r.from + b.length, r.from + b.length + txt.length) };
  }));
  view.focus();
}
const setMarks = StateEffect.define();
const marksField = StateField.define({
  create: () => Decoration.none,
  update(v, tr) {
    v = v.map(tr.changes);
    for (const ef of tr.effects) if (ef.is(setMarks)) {
      const d = tr.state.doc, seen = new Set(), arr = [];
      for (const m of ef.value) {
        if (m.line < 1 || m.line > d.lines || seen.has(m.line + m.kind)) continue; seen.add(m.line + m.kind);
        arr.push(Decoration.line({ class: m.kind === "error" ? "cm-diag-error" : "cm-diag-warn", attributes: { title: m.msg } }).range(d.line(m.line).from));
      }
      v = Decoration.set(arr, true);
    }
    return v;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Tape "\begin{env}" puis "}" : insère le corps indenté et "\end{env}" (la "}" auto-fermée par closeBrackets est réutilisée)
function beginEnd(view, from, to, text) {
  if (text !== "}" || from !== to) return false;
  const d = view.state.doc, line = d.lineAt(from), m = /\\begin\{([A-Za-z*]+)$/.exec(d.sliceString(line.from, from)); if (!m) return false;
  const name = m[1], skip = d.sliceString(to, to + 1) === "}" ? 1 : 0, rest = d.sliceString(to + skip, Math.min(d.length, to + skip + 300));
  if (new RegExp("^\\s*\\\\end\\{" + name.replace("*", "\\*") + "\\}").test(rest)) return false; // \end déjà présent juste après
  const ind = /^\s*/.exec(line.text)[0];
  view.dispatch({ changes: { from: to + skip, insert: (skip ? "" : "}") + `\n${ind}  \n${ind}\\end{${name}}` }, selection: { anchor: to + 2 + ind.length + 2 }, userEvent: "input" });
  return true;
}
const pairs = [closeBrackets(), Prec.highest(EditorView.inputHandler.of(beginEnd)), keymap.of(closeBracketsKeymap)];

// Un EditorState par onglet; une seule vue (setState pour changer d'onglet).
export function createEditor(parent, { onChange, onCursor, onSync }) {
  const vc = new Compartment(), sc = new Compartment(), cb = new Compartment(), pc = new Compartment(); let visual = false, visualExt = null, spellMod = null, spellExt = [], spellOn = false, autoClose = true, prefs = { tab: 4, wrap: true }, spellModeVal = "auto", spellCb = () => {};
  const prefExt = () => [EditorState.tabSize.of(prefs.tab), indentUnit.of(" ".repeat(Math.min(prefs.tab, 4))), ...(prefs.wrap ? [EditorView.lineWrapping] : [])]; // visual.js (+ KaTeX) chargé à la demande
  const exts = [
    vc.of([]), sc.of([]), cb.of(pairs), pc.of([EditorState.tabSize.of(4), indentUnit.of("  "), EditorView.lineWrapping]), marksField,
    EditorState.languageData.of(() => [{ closeBrackets: { brackets: ["(", "[", "{", "$"] } }]),
    autocompletion({ override: [latexSource], icons: false, activateOnTyping: true, maxRenderedOptions: 60 }),
    Prec.high(keymap.of([
      { key: "Mod-b", run: (v) => (wrap(v, "\\textbf{", "}"), true) },
      { key: "Mod-i", run: (v) => (wrap(v, "\\textit{", "}"), true) },
      { key: "Mod-u", run: (v) => (wrap(v, "\\underline{", "}"), true) },
    ])),
    EditorView.clickAddsSelectionRange.of(() => false), // ⌘-clic = "montrer dans le PDF", pas de multi-curseur
    EditorView.domEventHandlers({ click: (e) => { if (e.metaKey) setTimeout(() => onSync?.(), 0); } }),
    lineNumbers(), history(), drawSelection(), highlightActiveLine(), bracketMatching(),
    highlightSelectionMatches(), StreamLanguage.define(stex),
    EditorState.languageData.of(() => [{ commentTokens: { line: "%" } }]),
    syntaxHighlighting(hl), theme,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab, { key: "Mod-/", run: toggleComment }]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange();
      if (u.docChanged || u.selectionSet) onCursor(u.state);
    }),
  ];
  const view = new EditorView({ parent, state: EditorState.create({ doc: "", extensions: exts }) });
  const run = (f) => () => (f(view), view.focus());
  return {
    newState: (doc) => EditorState.create({ doc, extensions: exts }),
    setState: (s) => { view.setState(s); view.dispatch({ effects: [vc.reconfigure(visual && visualExt ? visualExt : []), sc.reconfigure(spellOn ? spellExt : []), cb.reconfigure(autoClose ? pairs : []), pc.reconfigure(prefExt())] }); },
    setAutoClose(on) { autoClose = on; view.dispatch({ effects: cb.reconfigure(on ? pairs : []) }); },
    setPrefs(p) { prefs = { ...prefs, ...p }; view.dispatch({ effects: pc.reconfigure(prefExt()) }); },
    // correcteur orthographique (spell.js + dictionnaire chargés seulement à l'activation)
    setSpell: async (on, onMenu) => {
      spellOn = on;
      if (on) { spellMod ??= await import("./spell.js"); spellMod.setMode(spellModeVal); spellMod.setHandlers({ onLang: spellCb }); spellExt = [spellMod.spellPlugin, spellMod.spellMenu(onMenu)]; }
      view.dispatch({ effects: sc.reconfigure(on ? spellExt : []) });
    },
    spellLang(m) { spellModeVal = m; if (spellMod) { spellMod.setMode(m); view.dispatch({ effects: spellMod.refresh.of(null) }); } },
    onSpellLang(cb2) { spellCb = cb2; spellMod?.setHandlers({ onLang: cb2 }); },
    spellWords: () => (spellMod ? spellMod.userWords() : JSON.parse(localStorage.userDict || "[]").sort()),
    spellRemove(w) { if (spellMod) spellMod.removeWord(w); else localStorage.userDict = JSON.stringify(JSON.parse(localStorage.userDict || "[]").filter((x) => x !== w)); spellMod && view.dispatch({ effects: spellMod.refresh.of(null) }); },
    moveUp: () => { moveLineUp(view); view.focus(); }, moveDown: () => { moveLineDown(view); view.focus(); }, dupLine: () => { copyLineDown(view); view.focus(); },
    spellAdd(w) { spellMod?.addWord(w); view.dispatch({ effects: spellMod?.refresh.of(null) }); },
    spellIgnore(w) { spellMod?.ignoreWord(w); view.dispatch({ effects: spellMod?.refresh.of(null) }); },
    replace(from, to, text) { view.dispatch({ changes: { from, to, insert: text } }); view.focus(); },
    setVisual: async (on) => {
      visual = on; if (on) visualExt ??= (await import("./visual.js")).visualExt;
      view.dispatch({ effects: vc.reconfigure(on ? visualExt : []) });
    },
    state: () => view.state,
    get: () => view.state.doc.toString(),
    focus: () => view.focus(),
    // va à la ligne; si `word` est donné, le sélectionne (cherché sur les lignes voisines)
    goto(line, word) {
      const d = view.state.doc, l = d.line(Math.min(Math.max(line, 1), d.lines));
      let sel = { anchor: l.from };
      if (word) {
        const re = new RegExp("(?<![\\p{L}\\p{N}])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}\\p{N}])", "u");
        for (const n of [0, 1, -1, 2]) {
          const x = d.line(Math.min(Math.max(line + n, 1), d.lines)), m = re.exec(x.text);
          if (m) { sel = { anchor: x.from + m.index, head: x.from + m.index + word.length }; break; }
        }
      }
      view.dispatch({ selection: sel, effects: EditorView.scrollIntoView(sel.anchor, { y: "center" }) });
      view.focus();
    },
    // ligne (1-based) et mot sous le curseur
    cursor() {
      const m = view.state.selection.main, l = view.state.doc.lineAt(m.head), w = view.state.wordAt(m.head);
      const one = m.to > m.from && m.from >= l.from && m.to <= l.to; // sélection sur une seule ligne
      return { line: l.number, word: w ? view.state.sliceDoc(w.from, w.to) : "", sel: one ? view.state.sliceDoc(m.from, m.to) : "",
        before: view.state.sliceDoc(l.from, one ? m.from : w ? w.from : m.head) };
    },
    wrap: (b, a) => wrap(view, b, a),
    // transforme la ligne courante en titre `\\cmd{...}` ("" = texte normal)
    heading(cmd) {
      const l = view.state.doc.lineAt(view.state.selection.main.head), m = /^(\s*)\\(?:sub)*(?:section|paragraph|chapter)\*?\{(.*)\}\s*$/.exec(l.text);
      const inner = (m ? m[2] : l.text.trim()), ind = m ? m[1] : (/^\s*/.exec(l.text)[0]);
      const out = cmd ? `\\${cmd}{${inner}}` : inner;
      view.dispatch({ changes: { from: l.from, to: l.to, insert: ind + out }, selection: { anchor: l.from + ind.length + out.length } }); view.focus();
    },
    // liste: transforme les lignes sélectionnées (ou insère une liste vide)
    list(env) {
      const d = view.state.doc, r = view.state.selection.main, a = d.lineAt(r.from), b = d.lineAt(r.to);
      if (r.empty && !a.text.trim()) { snippet(`\\begin{${env}}\n  \\item \${}\n\\end{${env}}`)(view, null, a.from, a.to); view.focus(); return; }
      const lines = d.sliceString(a.from, b.to).split("\n").filter((x) => x.trim()).map((x) => "  \\item " + x.trim().replace(/^\\item\s*/, ""));
      view.dispatch({ changes: { from: a.from, to: b.to, insert: `\\begin{${env}}\n${lines.join("\n")}\n\\end{${env}}` } }); view.focus();
    },
    // insère un snippet CM (`${}` = champs à remplir, Tab pour avancer) à la position du curseur, début de ligne si `line`
    insert(template, line = false) {
      const p = view.state.selection.main.head, from = line ? view.state.doc.lineAt(p).from : p;
      snippet(template)(view, null, from, line ? from : view.state.selection.main.to); view.focus();
    },
    insertAt(pos, text) { view.dispatch({ changes: { from: pos, insert: text } }); },
    setMarks: (list) => view.dispatch({ effects: setMarks.of(list) }),
    setData: (d) => Object.assign(completionData, d),
    undo: run(undo), redo: run(redo), find: run(openSearchPanel), next: run(findNext), prev: run(findPrevious),
    gotoLine: run(gotoLine), comment: run(toggleComment),
  };
}
