// Correcteur orthographique (anglais + français): filtres de Bloom (src/dict/{en,fr}.bin) + soulignement rouge des mots inconnus.
// Ne vérifie que le texte visible; ignore commandes, maths, commentaires, URLs, acronymes, CamelCase, noms propres en milieu de phrase.
// Langue: "auto" (babel/polyglossia ou mots courants du début du document), "en" ou "fr". Un seul dictionnaire est chargé à la fois si possible.
import { ViewPlugin, Decoration, EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";

const dicts = {}, loading = {}; // lang -> { bits, K, M }
const user = new Set(JSON.parse(localStorage.userDict || "[]")), session = new Set();
let mode = "auto", onLang = () => {}, lastLang = "";
export const refresh = StateEffect.define();

export async function loadDict(lang) {
  if (dicts[lang]) return;
  loading[lang] ??= fetch(`dict/${lang}.bin`).then((r) => r.arrayBuffer()).then((buf) => {
    const b = new Uint8Array(buf);
    dicts[lang] = { K: b[0], M: (b[1] | (b[2] << 8) | (b[3] << 16) | (b[4] << 24)) >>> 0, bits: b.subarray(5) };
  });
  await loading[lang];
}
export const setMode = (m) => { mode = m; lastLang = ""; };
export const setHandlers = (h) => { onLang = h.onLang || onLang; };

// mêmes fonctions de hachage que tools/build-dict.py (unités UTF-16)
function has(lang, w) {
  const d = dicts[lang]; let h1 = 0x811c9dc5, h2 = 0x9747b28c;
  for (let i = 0; i < w.length; i++) {
    const c = w.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0; h2 = (h2 ^ (h2 >>> 15)) >>> 0;
  }
  h2 = (h2 | 1) >>> 0;
  for (let i = 0; i < d.K; i++) {
    const idx = ((h1 + (Math.imul(i, h2) >>> 0)) >>> 0) % d.M;
    if (!(d.bits[idx >> 3] & (1 << (idx & 7)))) return false;
  }
  return true;
}
// formes dérivées plausibles (anglais): pluriels, -ed, -ing, -ly… pour éviter les fausses alertes sur les mots rares
function known(lang, lw) {
  if (has(lang, lw) || user.has(lw) || session.has(lw)) return true;
  if (lang !== "en" || lw.length < 5) return false;
  const tries = [];
  if (lw.endsWith("s")) tries.push(lw.slice(0, -1));
  if (lw.endsWith("es")) tries.push(lw.slice(0, -2));
  if (lw.endsWith("ies")) tries.push(lw.slice(0, -3) + "y");
  if (lw.endsWith("ed")) tries.push(lw.slice(0, -2), lw.slice(0, -1));
  if (lw.endsWith("ing")) tries.push(lw.slice(0, -3), lw.slice(0, -3) + "e");
  if (lw.endsWith("ly")) tries.push(lw.slice(0, -2));
  if (/ers?$/.test(lw)) tries.push(lw.replace(/ers?$/, ""));
  return tries.some((t) => t.length >= 4 && (has("en", t) || user.has(t)));
}

// langue du document: option babel/polyglossia (la dernière est la principale), sinon mots outils du début du texte
const FR_OPT = /\b(french|francais|français|frenchb|acadian)\b/i, EN_OPT = /\b(english|american|british|usenglish|ukenglish|canadian|australian)\b/i;
function detect(head) {
  let m, last = "";
  const re = /\\(?:usepackage\[([^\]]*)\]\{(?:babel|polyglossia)\}|documentclass\[([^\]]*)\]|setmainlanguage\{([^}]*)\}|selectlanguage\{([^}]*)\})/g;
  while ((m = re.exec(head))) { const o = m[1] ?? m[2] ?? m[3] ?? m[4] ?? ""; const parts = o.split(","); for (const p of parts) { if (FR_OPT.test(p)) last = "fr"; else if (EN_OPT.test(p)) last = "en"; } }
  if (last) return last;
  const body = head.slice(head.indexOf("\\begin{document}") + 1).toLowerCase(), words = body.match(/[a-zàâçéèêëîïôùûü]+/g) || [];
  let fr = 0, en = 0;
  const F = new Set(["le", "la", "les", "des", "est", "une", "que", "qui", "dans", "pour", "avec", "sur", "pas", "sont", "nous", "vous", "cette", "ces", "aux", "du", "au", "et", "en", "un"]);
  const E = new Set(["the", "and", "of", "to", "is", "that", "for", "with", "this", "are", "was", "which", "from", "by", "on", "as", "in", "an", "be", "we", "it"]);
  for (const w of words) { if (F.has(w)) fr++; if (E.has(w)) en++; }
  return fr > en * 1.2 ? "fr" : "en";
}

const sp = (m) => m.replace(/[^\n]/g, " ");
const NOTEXT = "usepackage|documentclass|RequirePackage|input|include|includegraphics|label|ref|eqref|cref|Cref|autoref|pageref|nameref|cite[a-zA-Z]*|bibliography|bibliographystyle|addbibresource|begin|end|url|href|newcommand|renewcommand|providecommand|DeclareMathOperator|newtheorem|theoremstyle|setlength|addtolength|vspace|hspace|color|textcolor|definecolor|pagestyle|thispagestyle|geometry|setcounter|hypersetup|usetikzlibrary|newenvironment|def|let|bibitem|lstset|setlist|captionsetup|selectlanguage|setmainlanguage|setotherlanguage";
const MATHENV = "equation|align|alignat|gather|multline|flalign|eqnarray|math|displaymath|verbatim|lstlisting|minted|tikzpicture|algorithmic|array|matrix|pmatrix|bmatrix|cases|split|axis";
// remplace par des espaces (longueur conservée) tout ce qui n'est pas du texte à vérifier
function mask(s) {
  return s
    .replace(/(?<!\\)%.*$/gm, sp)
    .replace(new RegExp(`\\\\begin\\{(${MATHENV})\\*?\\}[\\s\\S]*?\\\\end\\{\\1\\*?\\}`, "g"), sp)
    .replace(/\\\[[\s\S]*?\\\]/g, sp).replace(/\$\$[\s\S]*?\$\$/g, sp)
    .replace(/(?<!\\)\$(?:[^$\n]|\n(?!\s*\n)){0,400}?\$/g, sp).replace(/\\\([\s\S]*?\\\)/g, sp)
    .replace(/\\verb\*?(.).*?\1/g, sp).replace(/https?:\/\/\S+|\S+@\S+\.\S+/g, sp)
    .replace(new RegExp(`\\\\(?:${NOTEXT})\\*?(?:\\[[^\\]]*\\])*(?:\\{[^{}]*\\})*`, "g"), sp)
    .replace(/\\[a-zA-Z@]+\*?/g, sp).replace(/\\./g, sp);
}

// mots mal orthographiés de `t` (texte masqué) dans [a, b): [{from, to, word}]
function scan(t, a, b, lang) {
  const out = [], re = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu; re.lastIndex = a; let m;
  while ((m = re.exec(t)) && m.index < b) {
    const raw = m[0].normalize("NFC"), i = m.index, e = i + m[0].length;
    if (/[0-9_]/.test(t[i - 1] || "") || /[0-9_]/.test(t[e] || "")) continue;      // collé à un chiffre / underscore
    const hasApo = /['’]/.test(raw);
    if (lang === "en" && (hasApo || /[^A-Za-z]/.test(raw))) continue;               // anglais: contractions et mots accentués ignorés
    if (raw === raw.toUpperCase() || /[a-zà-ÿ][A-ZÀ-Þ]/.test(raw)) continue;          // acronyme, CamelCase
    if (/^[A-ZÀ-Þ]/.test(raw)) { // majuscule: nom propre sauf en début de phrase
      let j = i - 1; while (j >= 0 && /[ \t]/.test(t[j])) j--;
      const p = t[j]; if (p !== undefined && !/[.!?:\n"“«‹({\[]/.test(p)) continue;
    }
    if (hasApo) { // français: élisions (l'homme, qu'il) → on vérifie chaque morceau
      let off = 0;
      for (const part of raw.split(/['’]/)) { if (part.length >= 3 && !known(lang, part.toLowerCase())) out.push({ from: i + off, to: i + off + part.length, word: part }); off += part.length + 1; }
      continue;
    }
    if (raw.length < 3) continue;
    if (!known(lang, raw.toLowerCase())) out.push({ from: i, to: e, word: raw });
  }
  return out;
}

// suggestions: toutes les formes à distance d'édition 1 présentes dans le dictionnaire
export function suggest(word, lang) {
  if (!dicts[lang]) return [];
  const lw = word.toLowerCase(), L = lang === "fr" ? "abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœæ" : "abcdefghijklmnopqrstuvwxyz", c = new Set(), n = lw.length;
  for (let i = 0; i <= n; i++) {
    if (i < n) c.add(lw.slice(0, i) + lw.slice(i + 1));
    if (i < n - 1) c.add(lw.slice(0, i) + lw[i + 1] + lw[i] + lw.slice(i + 2));
    for (const x of L) { if (i < n) c.add(lw.slice(0, i) + x + lw.slice(i + 1)); c.add(lw.slice(0, i) + x + lw.slice(i)); }
  }
  c.delete(lw);
  const cap = /^[A-ZÀ-Þ]/.test(word);
  return [...c].filter((x) => x.length > 1 && has(lang, x)).slice(0, 6).map((x) => (cap ? x[0].toUpperCase() + x.slice(1) : x));
}
export const addWord = (w) => { user.add(w.toLowerCase()); localStorage.userDict = JSON.stringify([...user]); };
export const removeWord = (w) => { user.delete(w); localStorage.userDict = JSON.stringify([...user]); };
export const ignoreWord = (w) => session.add(w.toLowerCase());
export const userWords = () => [...user].sort();
export const currentLang = () => lastLang || "en";

const mark = Decoration.mark({ class: "cm-misspell" });
export const spellPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view); }
  update(u) { if (u.docChanged || u.viewportChanged || u.transactions.some((t) => t.effects.some((e) => e.is(refresh)))) this.decorations = this.build(u.view); }
  build(view) {
    const d = view.state.doc;
    const lang = mode === "auto" ? detect(d.sliceString(0, Math.min(d.length, 6000))) : mode;
    if (lang !== lastLang) { lastLang = lang; onLang(lang); }
    if (!dicts[lang]) { loadDict(lang).then(() => view.dispatch({ effects: refresh.of(null) })).catch(() => {}); return Decoration.none; }
    const ranges = [];
    for (const { from, to } of view.visibleRanges) {
      const l1 = d.lineAt(from).number, l2 = d.lineAt(to).number;
      const s0 = d.line(Math.max(1, l1 - 25)).from, s1 = d.line(Math.min(d.lines, l2 + 5)).to;
      const t = mask(d.sliceString(s0, s1));
      const head = d.sliceString(0, Math.min(d.length, 30000)).indexOf("\\begin{document}"); // le préambule n'est pas du texte
      for (const w of scan(t, from - s0, to - s0, lang)) if (head < 0 || s0 + w.from > head) ranges.push(mark.range(s0 + w.from, s0 + w.to));
    }
    return Decoration.set(ranges, true);
  }
}, { decorations: (v) => v.decorations });

// clic droit sur un mot souligné → onMenu({ x, y, word, from, to, suggestions })
export const spellMenu = (onMenu) => EditorView.domEventHandlers({
  contextmenu(e, view) {
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }), pl = view.plugin(spellPlugin); if (pos == null || !pl) return false;
    let hit = null; pl.decorations.between(pos, pos, (f, t) => { hit = { from: f, to: t }; });
    if (!hit) return false;
    e.preventDefault();
    const word = view.state.sliceDoc(hit.from, hit.to);
    onMenu({ x: e.clientX, y: e.clientY, word, ...hit, suggestions: suggest(word, lastLang || "en") });
    return true;
  },
});
