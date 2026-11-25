// Autocomplétion LaTeX: commandes, environnements, paquets, clés \cite (.bib), \ref (\label) et snippets `;xx`.
import { snippetCompletion } from "@codemirror/autocomplete";

// Données dynamiques fournies par l'app: clés bibliographiques et labels.
export const data = { bib: [], labels: [] };

const S = (label, template, detail, type = "function") => snippetCompletion(template, { label, detail, type });

// --- commandes avec arguments (snippets: Tab passe au champ suivant)
const CMD_SNIPS = [
  ["\\frac", "\\frac{${}}{${}}"], ["\\dfrac", "\\dfrac{${}}{${}}"], ["\\sqrt", "\\sqrt{${}}"], ["\\binom", "\\binom{${}}{${}}"],
  ["\\sum", "\\sum_{${i=1}}^{${n}} ${}"], ["\\prod", "\\prod_{${i=1}}^{${n}} ${}"], ["\\int", "\\int_{${0}}^{${\\infty}} ${}\\,d${x}"],
  ["\\lim", "\\lim_{${n \\to \\infty}} ${}"], ["\\left(", "\\left( ${} \\right)"], ["\\left[", "\\left[ ${} \\right]"], ["\\left\\{", "\\left\\\\{ ${} \\right\\\\}"],
  ["\\textbf", "\\textbf{${}}"], ["\\textit", "\\textit{${}}"], ["\\emph", "\\emph{${}}"], ["\\texttt", "\\texttt{${}}"], ["\\underline", "\\underline{${}}"],
  ["\\mathbb", "\\mathbb{${}}"], ["\\mathcal", "\\mathcal{${}}"], ["\\mathbf", "\\mathbf{${}}"], ["\\mathrm", "\\mathrm{${}}"], ["\\text", "\\text{${}}"],
  ["\\hat", "\\hat{${}}"], ["\\bar", "\\bar{${}}"], ["\\tilde", "\\tilde{${}}"], ["\\vec", "\\vec{${}}"], ["\\overline", "\\overline{${}}"],
  ["\\section", "\\section{${}}"], ["\\subsection", "\\subsection{${}}"], ["\\subsubsection", "\\subsubsection{${}}"], ["\\paragraph", "\\paragraph{${}}"],
  ["\\chapter", "\\chapter{${}}"], ["\\title", "\\title{${}}"], ["\\author", "\\author{${}}"], ["\\footnote", "\\footnote{${}}"],
  ["\\cite", "\\cite{${}}"], ["\\citep", "\\citep{${}}"], ["\\citet", "\\citet{${}}"], ["\\ref", "\\ref{${}}"], ["\\eqref", "\\eqref{${}}"], ["\\cref", "\\cref{${}}"],
  ["\\label", "\\label{${}}"], ["\\caption", "\\caption{${}}"], ["\\includegraphics", "\\includegraphics[width=${0.8}\\linewidth]{${}}"],
  ["\\usepackage", "\\usepackage{${}}"], ["\\input", "\\input{${}}"], ["\\newcommand", "\\newcommand{\\${name}}{${}}"],
  ["\\DeclareMathOperator", "\\DeclareMathOperator{\\${name}}{${}}"], ["\\href", "\\href{${url}}{${text}}"], ["\\url", "\\url{${}}"],
  ["\\bibliography", "\\bibliography{${}}"], ["\\bibliographystyle", "\\bibliographystyle{${plain}}"], ["\\documentclass", "\\documentclass{${article}}"],
].map(([l, t]) => S(l, t, "snippet"));

// --- commandes simples
const PLAIN = `alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho sigma tau upsilon phi varphi chi psi omega
Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega cdot cdots ldots dots vdots ddots times div pm mp leq geq neq approx equiv sim simeq cong propto infty partial nabla
forall exists nexists in notin ni subset subseteq supset supseteq cup cap setminus emptyset varnothing to rightarrow Rightarrow leftarrow Leftarrow leftrightarrow Leftrightarrow
mapsto longrightarrow implies iff land lor lnot neg wedge vee oplus otimes odot circ bullet star ast langle rangle lceil rceil lfloor rfloor mid parallel perp angle
log ln exp sin cos tan sinh cosh tanh arcsin arccos arctan min max sup inf arg det dim ker deg gcd Pr mathbb mathcal mathfrak
newline par noindent centering raggedright raggedleft maketitle tableofcontents listoftables listoffigures appendix item hline toprule midrule bottomrule cline multicolumn multirow
today vspace hspace vfill hfill quad qquad newpage clearpage pagebreak bigskip medskip smallskip linewidth textwidth columnwidth small footnotesize large Large LARGE huge Huge tiny
normalsize bfseries itshape ttfamily scshape rmfamily sffamily bibitem printbibliography nocite pagestyle thispagestyle setlength addtolength setcounter stepcounter newtheorem
theoremstyle renewcommand providecommand def let usetikzlibrary tikz draw node fill path coordinate foreach addplot begin end
displaystyle textstyle limits nolimits operatorname underbrace overbrace underset overset stackrel xrightarrow phantom hphantom vphantom boldsymbol
Big Bigg big bigg checkmark dag ddag S P copyright pounds ell hbar Re Im aleph`.split(/\s+/);
const PLAIN_OPTS = [...new Set(PLAIN)].map((n) => ({ label: "\\" + n, type: "keyword" }));

// --- environnements
const ENVS = `document abstract itemize enumerate description equation equation* align align* alignat gather gather* multline split cases matrix pmatrix bmatrix vmatrix Vmatrix
array figure figure* table table* tabular tabularx center flushleft flushright quote quotation verse verbatim lstlisting minipage theorem lemma proposition corollary definition
proof remark example frame columns column block alertblock tikzpicture axis algorithm algorithmic thebibliography subequations wrapfigure titlepage appendix`.split(/\s+/);
const ENV_BEGIN = ENVS.map((e) => ({ label: "\\begin{" + e + "}", type: "class", detail: "environment", apply: (view, c, from, to) => {
  // remplace "\begin{…" par l'environnement complet et place le curseur à l'intérieur
  const ins = `\\begin{${e}}\n  \n\\end{${e}}`;
  view.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + ins.indexOf("\n  \n") + 3 } });
} }));

const PACKAGES = `amsmath amssymb amsthm mathtools graphicx hyperref xcolor geometry booktabs tabularx multirow longtable array enumitem fancyhdr titlesec caption subcaption float
tikz pgfplots algorithm algpseudocode algorithmic listings minted natbib biblatex cleveref siunitx microtype lmodern fontenc inputenc babel csquotes setspace parskip
bm physics cancel mathrsfs stmaryrd bbm dsfont tcolorbox mdframed framed wrapfig lipsum authblk url xspace ifthen etoolbox xparse`.split(/\s+/);
const CLASSES = ["article", "report", "book", "beamer", "amsart", "IEEEtran", "letter", "scrartcl", "memoir", "standalone"];

// --- snippets ";xx"
const SNIPS = [
  [";eq", "\\begin{equation}\n  ${}\n\\end{equation}", "equation"], [";al", "\\begin{align}\n  ${} &= ${} \\\\\n  &= ${}\n\\end{align}", "align"],
  [";ga", "\\begin{gather}\n  ${}\n\\end{gather}", "gather"], [";m", "$${}$", "inline math"], [";dm", "\\[\n  ${}\n\\]", "display math"],
  [";it", "\\begin{itemize}\n  \\item ${}\n\\end{itemize}", "itemize"], [";en", "\\begin{enumerate}\n  \\item ${}\n\\end{enumerate}", "enumerate"],
  [";fig", "\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${file}}\n  \\caption{${}}\n  \\label{fig:${}}\n\\end{figure}", "figure"],
  [";tab", "\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{${lcc}}\n    \\toprule\n    ${} & ${} & ${} \\\\\n    \\midrule\n    ${} & ${} & ${} \\\\\n    \\bottomrule\n  \\end{tabular}\n  \\caption{${}}\n  \\label{tab:${}}\n\\end{table}", "table"],
  [";sec", "\\section{${}}\n\\label{sec:${}}\n", "section"], [";ss", "\\subsection{${}}\n", "subsection"], [";sss", "\\subsubsection{${}}\n", "subsubsection"],
  [";thm", "\\begin{theorem}\n  ${}\n\\end{theorem}", "theorem"], [";lem", "\\begin{lemma}\n  ${}\n\\end{lemma}", "lemma"], [";def", "\\begin{definition}\n  ${}\n\\end{definition}", "definition"],
  [";pf", "\\begin{proof}\n  ${}\n\\end{proof}", "proof"], [";fr", "\\begin{frame}{${}}\n  ${}\n\\end{frame}", "beamer frame"],
  [";mat", "\\begin{pmatrix}\n  ${} & ${} \\\\\n  ${} & ${}\n\\end{pmatrix}", "matrix"], [";cases", "\\begin{cases}\n  ${} & \\text{if } ${} \\\\\n  ${} & \\text{otherwise}\n\\end{cases}", "cases"],
  [";fr2", "\\frac{${}}{${}}", "fraction"], [";sum", "\\sum_{${i=1}}^{${n}} ${}", "sum"], [";int", "\\int_{${}}^{${}} ${}\\,d${x}", "integral"],
].map(([l, t, d]) => S(l, t, d, "text"));

const word = (ctx, re) => { const m = ctx.matchBefore(re); return m && (m.from !== m.to || ctx.explicit) ? m : null; };

// Source principale (une seule pour toutes les situations: l'ordre compte)
export function latexSource(ctx) {
  const line = ctx.state.doc.lineAt(ctx.pos), before = line.text.slice(0, ctx.pos - line.from);
  // \cite{a,b|  → clés .bib
  let m = /\\(?:[Cc]ite[a-zA-Z]*|nocite|parencite|textcite|autocite)\*?(?:\[[^\]]*\]){0,2}\{([^{}]*)$/.exec(before);
  if (m) { const from = ctx.pos - (m[1].length - m[1].lastIndexOf(",") - 1); return { from, options: data.bib.map((b) => ({ label: b.key, detail: b.detail, type: "constant" })), validFor: /^[^,{}]*$/ }; }
  // \ref{|  → labels
  m = /\\(?:[a-zA-Z]*ref|cref|Cref|autoref|pageref|nameref|vref)\*?\{([^{}]*)$/.exec(before);
  if (m) { const from = ctx.pos - (m[1].length - m[1].lastIndexOf(",") - 1); return { from, options: data.labels.map((l) => ({ label: l, type: "variable" })), validFor: /^[^,{}]*$/ }; }
  // \begin{|  → environnements (remplacés par begin/end complet)
  m = /\\begin\{([a-zA-Z*]*)$/.exec(before);
  if (m) return { from: ctx.pos - m[0].length, options: ENV_BEGIN, validFor: /^\\begin\{[a-zA-Z*]*$/ };
  m = /\\end\{([a-zA-Z*]*)$/.exec(before);
  if (m) return { from: ctx.pos - m[1].length, options: ENVS.map((e) => ({ label: e, type: "class" })), validFor: /^[a-zA-Z*]*$/ };
  // \usepackage{|  \documentclass{|
  m = /\\usepackage(?:\[[^\]]*\])?\{([^{}]*)$/.exec(before);
  if (m) return { from: ctx.pos - (m[1].length - m[1].lastIndexOf(",") - 1), options: PACKAGES.map((p) => ({ label: p, type: "namespace" })), validFor: /^[^,{}]*$/ };
  m = /\\documentclass(?:\[[^\]]*\])?\{([^{}]*)$/.exec(before);
  if (m) return { from: ctx.pos - m[1].length, options: CLASSES.map((p) => ({ label: p, type: "namespace" })), validFor: /^[^{}]*$/ };
  // ;snippet
  m = word(ctx, /(?<![\\\w]);[a-z0-9]*/);
  if (m) return { from: m.from, options: SNIPS, validFor: /^;[a-z0-9]*$/ };
  // \commande
  m = word(ctx, /\\[a-zA-Z]*\*?/);
  if (m) return { from: m.from, options: [...CMD_SNIPS, ...PLAIN_OPTS, ...ENV_BEGIN], validFor: /^\\[a-zA-Z{}*]*$/ };
  return null;
}
