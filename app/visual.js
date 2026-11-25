// Mode "Visual" (façon Overleaf): le LaTeX reste du texte éditable, mais le balisage est masqué/stylé
// et les formules sont rendues avec KaTeX tant que le curseur n'est pas dessus.
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { StateField, Prec } from "@codemirror/state";
import katex from "katex";

const HEADS = { title: "vis-title", author: "vis-author", date: "vis-author", chapter: "vis-h1", section: "vis-h1", subsection: "vis-h2", subsubsection: "vis-h3", paragraph: "vis-h4" };
const MARKS = { textbf: "vis-b", textit: "vis-i", emph: "vis-i", texttt: "vis-tt", underline: "vis-u", textsc: "vis-sc", textsl: "vis-i", textrm: "" };
const MATH_ENVS = /^(equation|align|alignat|gather|multline|eqnarray|flalign)\*?$/;

// ---- widgets
class MathW extends WidgetType {
  constructor(tex, display, macros) { super(); this.tex = tex; this.display = display; this.macros = macros; }
  eq(o) { return o.tex === this.tex && o.display === this.display; }
  toDOM() {
    const el = document.createElement(this.display ? "div" : "span");
    el.className = this.display ? "vis-math vis-dmath" : "vis-math";
    try { katex.render(this.tex, el, { displayMode: this.display, throwOnError: false, macros: { ...this.macros }, strict: "ignore", trust: false }); }
    catch { el.textContent = this.tex; }
    return el;
  }
}
class TextW extends WidgetType {
  constructor(text, cls) { super(); this.text = text; this.cls = cls; }
  eq(o) { return o.text === this.text && o.cls === this.cls; }
  toDOM() { const s = document.createElement("span"); s.className = this.cls; s.textContent = this.text; return s; }
}

// ---- utilitaires de scan
const closeBrace = (t, i) => { // i = index juste après "{"; renvoie l'index de la "}" correspondante (ou -1)
  for (let d = 1; i < t.length; i++) {
    const c = t[i];
    if (c === "\\") { i++; continue; }
    if (c === "{") d++; else if (c === "}" && --d === 0) return i;
    else if (c === "\n" && t[i + 1] === "\n") return -1; // paragraphe: on abandonne
  }
  return -1;
};
function parseMacros(t) {
  const m = {}, re = /\\(?:re)?newcommand\*?\s*\{(\\[a-zA-Z]+)\}\s*(?:\[(\d)\])?\s*\{|\\DeclareMathOperator(\*?)\s*\{(\\[a-zA-Z]+)\}\s*\{/g;
  let x;
  const pre = t.indexOf("\\begin{document}"), lim = pre < 0 ? t.length : pre;
  while ((x = re.exec(t)) && x.index < lim) {
    const e = closeBrace(t, re.lastIndex); if (e < 0) continue;
    const body = t.slice(re.lastIndex, e);
    if (x[1]) m[x[1]] = body; else m[x[4]] = `\\operatorname${x[3] ? "*" : ""}{${body}}`;
  }
  return m;
}
const mathTex = (env, inner) => {
  inner = inner.replace(/\\label\{[^}]*\}/g, "").replace(/\\(nonumber|notag)/g, "");
  if (!env) return inner;
  const e = env.replace("*", "");
  if (e === "equation") return inner;
  if (e === "multline" || e === "flalign" || e === "eqnarray") return `\\begin{aligned}${inner}\\end{aligned}`;
  return `\\begin{${env}}${inner}\\end{${env}}`; // align, alignat, gather: gérés par KaTeX
};

function build(state) {
  const t = state.doc.toString(), sel = state.selection.ranges, macros = parseMacros(t);
  const touch = (a, b) => sel.some((r) => r.from <= b && r.to >= a);
  const lineOf = (p) => state.doc.lineAt(p);
  const all = [], repl = [], taken = []; // taken: zones déjà rendues (math) où on ne cherche plus rien
  const inTaken = (p) => taken.some(([a, b]) => p >= a && p < b);
  const hide = (a, b) => { if (b > a && !touch(a, b)) repl.push([a, b, Decoration.replace({})]); };
  const add = (a, b, d) => all.push([a, b, d]);

  // commentaires: ranges à ignorer pour les formules
  const com = [], cre = /(^|[^\\])(%.*)$/gm; let m;
  while ((m = cre.exec(t))) { const a = m.index + m[1].length; com.push([a, a + m[2].length]); add(a, a + m[2].length, Decoration.mark({ class: "vis-com" })); }
  const inCom = (p) => com.some(([a, b]) => p >= a && p < b);

  // préambule
  const bd = t.indexOf("\\begin{document}");
  if (bd > 0) for (let l = 1; l <= lineOf(bd).number; l++) { const L = state.doc.line(l); add(L.from, L.from, Decoration.line({ class: "vis-pre" })); }

  // maths affichées: environnements, \[ \], $$ $$
  const dre = /\\begin\{([a-zA-Z]+\*?)\}([\s\S]*?)\\end\{\1\}|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
  while ((m = dre.exec(t))) {
    const a = m.index, b = a + m[0].length;
    if (m[1] && !MATH_ENVS.test(m[1])) { dre.lastIndex = a + m[0].indexOf("}") + 1; continue; } // autre env: on ne le consomme pas
    if (inCom(a)) continue;
    taken.push([a, b]);
    if (!touch(a, b)) repl.push([a, b, Decoration.replace({ widget: new MathW(mathTex(m[1], m[2] ?? m[3] ?? m[4]).trim(), true, macros), block: true })]);
  }
  // maths en ligne: $..$ et \(..\)
  const ire = /(?<!\\)\$([^$\n]+?)(?<!\\)\$|\\\(([\s\S]*?)\\\)/g;
  while ((m = ire.exec(t))) {
    const a = m.index, b = a + m[0].length;
    if (inTaken(a) || inCom(a)) continue;
    taken.push([a, b]);
    if (!touch(a, b)) repl.push([a, b, Decoration.replace({ widget: new MathW((m[1] ?? m[2]).trim(), false, macros) })]);
  }

  // titres / formatage: \cmd{...}
  const cre2 = /\\(title|author|date|chapter|section|subsection|subsubsection|paragraph|textbf|textit|emph|texttt|underline|textsc|textsl|cite[a-z]*|ref|eqref|cref|autoref|label|footnote)\*?(?:\[[^\]\n]*\])?\{/g;
  while ((m = cre2.exec(t))) {
    const a = m.index, o = cre2.lastIndex, c = closeBrace(t, o);
    if (c < 0 || inTaken(a) || inCom(a)) continue;
    const name = m[1];
    if (HEADS[name] !== undefined) {
      const L = lineOf(a), alone = /^\s*$/.test(t.slice(L.from, a)) && /^\s*(%.*)?$/.test(t.slice(c + 1, L.to));
      if (alone && name !== "paragraph") add(L.from, L.from, Decoration.line({ class: HEADS[name] }));
      else add(o, c, Decoration.mark({ class: "vis-hi" })); // titre "run-in" (\paragraph{..} texte...): seul le titre est stylé
      hide(a, o); hide(c, c + 1);
    } else if (name in MARKS) {
      hide(a, o); hide(c, c + 1); if (MARKS[name]) add(o, c, Decoration.mark({ class: MARKS[name] }));
    } else if (name === "label") {
      hide(a, c + 1);
    } else if (name === "footnote") {
      if (!touch(a, c + 1)) repl.push([a, c + 1, Decoration.replace({ widget: new TextW("†", "vis-chip") })]);
    } else { // cite / ref → pastille
      if (!touch(a, c + 1)) repl.push([a, c + 1, Decoration.replace({ widget: new TextW(name.startsWith("cite") ? "[" + t.slice(o, c).replace(/\s*,\s*/g, ", ") + "]" : t.slice(o, c), "vis-chip") })]);
    }
  }
  // listes
  const ire2 = /^[ \t]*(\\item)(?:\s*\[([^\]\n]*)\])?/gm;
  while ((m = ire2.exec(t))) {
    const a = m.index + m[0].indexOf("\\item"), L = lineOf(a);
    if (inCom(a)) continue;
    add(L.from, L.from, Decoration.line({ class: "vis-item" }));
    if (m[2] === undefined) { if (!touch(a, a + 5)) repl.push([a, a + 5, Decoration.replace({ widget: new TextW("•", "vis-bullet") })]); }
    else add(a, a + m[0].length - m[0].indexOf("\\item"), Decoration.mark({ class: "vis-dim" }));
  }
  // begin/end (non math) et commandes de mise en page: atténués
  const bre = /\\(?:begin|end)\{[^}\n]*\}|\\(?:maketitle|centering|noindent|newpage|clearpage|par|vspace\*?\{[^}]*\}|hspace\*?\{[^}]*\}|bigskip|medskip|smallskip)(?![a-zA-Z])/g;
  while ((m = bre.exec(t))) {
    if (inTaken(m.index) || inCom(m.index)) continue;
    const a = m.index, b = a + m[0].length, L = lineOf(a);
    if (/^\\(?:begin|end)/.test(m[0]) && /^\s*$/.test(t.slice(L.from, a)) && /^\s*(%.*)?$/.test(t.slice(b, L.to))) add(a, b, Decoration.mark({ class: "vis-dim" })); // ligne \begin{..} seule
    else hide(a, b); // en plein texte: invisible
  }

  // remplacements: pas de chevauchement
  repl.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const ok = []; let end = -1;
  for (const r of repl) if (r[0] >= end) { ok.push(r); end = r[1]; }
  const set = (arr) => Decoration.set(arr.map(([a, b, d]) => d.range(a, b)), true);
  return { deco: set([...all.filter(([a, b]) => !ok.some(([x, y]) => a > x && b <= y)), ...ok]), atomic: set(ok) };
}

const field = StateField.define({
  create: build,
  update: (v, tr) => (tr.docChanged || tr.selection ? build(tr.state) : v),
  provide: (f) => [EditorView.decorations.from(f, (v) => v.deco), EditorView.atomicRanges.of((view) => view.state.field(f).atomic)],
});

const theme = EditorView.theme({
  ".cm-content": { fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif", fontSize: "calc(var(--fs, 13px) * 1.3)", lineHeight: "1.75", maxWidth: "780px", margin: "0 auto", padding: "24px 28px" },
  ".cm-scroller": { fontFamily: "inherit" },
  ".vis-h1": { fontSize: "1.55em", fontWeight: "700", lineHeight: "1.4", padding: "0.6em 0 0.1em", fontFamily: "Inter, system-ui, sans-serif" },
  ".vis-h2": { fontSize: "1.3em", fontWeight: "650", padding: "0.5em 0 0.05em", fontFamily: "Inter, system-ui, sans-serif" },
  ".vis-h3": { fontSize: "1.12em", fontWeight: "600", padding: "0.4em 0 0", fontFamily: "Inter, system-ui, sans-serif" },
  ".vis-h4": { fontWeight: "700", fontStyle: "italic" },
  ".vis-title": { fontSize: "2em", fontWeight: "700", textAlign: "center", padding: "0.4em 0 0.1em", lineHeight: "1.25" },
  ".vis-author": { textAlign: "center", color: "var(--muted)", fontSize: "1.05em" },
  ".vis-hi": { fontWeight: "700" },
  ".vis-b": { fontWeight: "700" }, ".vis-i": { fontStyle: "italic" }, ".vis-u": { textDecoration: "underline" },
  ".vis-sc": { fontVariantCaps: "small-caps" },
  ".vis-tt": { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "0.88em", background: "color-mix(in srgb, var(--fg) 8%, transparent)", borderRadius: "3px", padding: "0 3px" },
  ".vis-com": { color: "var(--c-com)", fontStyle: "italic", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "0.8em" },
  ".vis-dim": { color: "var(--muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "0.72em", opacity: "0.8" },
  ".vis-pre": { color: "var(--muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "0.7em", lineHeight: "1.5" },
  ".vis-item": { paddingLeft: "1.6em !important", textIndent: "-1.1em" },
  ".vis-bullet": { display: "inline-block", width: "1.1em", textIndent: "0", color: "var(--muted)" },
  ".vis-chip": { color: "var(--accent)", fontFamily: "Inter, system-ui, sans-serif", fontSize: "0.82em", background: "color-mix(in srgb, var(--accent) 14%, transparent)", borderRadius: "4px", padding: "0 5px", cursor: "pointer" },
  ".vis-math": { display: "inline-block", verticalAlign: "baseline" },
  ".vis-dmath": { display: "block", textAlign: "center", margin: "0.3em 0", overflowX: "auto", overflowY: "hidden" },
  ".katex": { fontSize: "1.05em" },
  ".katex-display": { margin: "0.2em 0" },
});

export const visualExt = [field, Prec.high(theme), EditorView.editorAttributes.of({ class: "vis" })];
