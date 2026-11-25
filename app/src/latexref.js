// Fiches LaTeX (menu Aide → L'essentiel du LaTeX). Chaque fiche est un document .tex autonome et compilable:
// la même source sert à l'affichage, au téléchargement et à l'ouverture dans l'éditeur.
const R = String.raw;
const doc = (title, body) => R`\documentclass[11pt]{article}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage[margin=2.5cm]{geometry}
\usepackage{hyperref}

\title{${title}}
\date{}

\begin{document}
\maketitle
${body}
\end{document}
`;

// T(français, anglais)
export const sheets = (T) => [
  ["bases", T("Les bases", "The basics"), doc(T("LaTeX : les bases", "LaTeX: the basics"), R`
\section{${T("Structure d'un document", "Document structure")}}
% \documentclass{article}   ${T("type de document (article, report, book, beamer)", "document type (article, report, book, beamer)")}
% \usepackage{...}          ${T("extensions, dans le préambule", "packages, in the preamble")}
% \begin{document} ... \end{document}   ${T("le contenu", "the content")}
${T("Une ligne vide commence un nouveau paragraphe. Le signe \\% commence un commentaire.", "A blank line starts a new paragraph. The \\% sign starts a comment.")}

\section{${T("Titres", "Headings")}}
\subsection{${T("Sous-section", "Subsection")}}
\subsubsection{${T("Sous-sous-section", "Subsubsection")}}
${T("Avec une étoile, le titre n'est pas numéroté : \\verb|\\section*{...}|.", "With a star the heading is not numbered: \\verb|\\section*{...}|.")}

\section{${T("Mise en forme", "Formatting")}}
\textbf{${T("gras", "bold")}} (\verb|\textbf|), \textit{${T("italique", "italic")}} (\verb|\textit|),
\underline{${T("souligné", "underlined")}} (\verb|\underline|), \texttt{${T("chasse fixe", "monospace")}} (\verb|\texttt|),
\emph{${T("mis en valeur", "emphasised")}} (\verb|\emph|).

{\small small} {\normalsize normalsize} {\large large} {\Large Large} {\huge huge}

\section{${T("Listes", "Lists")}}
\begin{itemize}
  \item ${T("liste à puces : \\texttt{itemize}", "bulleted list: \\texttt{itemize}")}
\end{itemize}
\begin{enumerate}
  \item ${T("liste numérotée : \\texttt{enumerate}", "numbered list: \\texttt{enumerate}")}
\end{enumerate}
\begin{description}
  \item[${T("Terme", "Term")}] ${T("liste de définitions : \\texttt{description}", "definition list: \\texttt{description}")}
\end{description}

\section{${T("Caractères spéciaux et espaces", "Special characters and spacing")}}
\% \quad \$ \quad \& \quad \# \quad \_ \quad \{ \quad \}

${T("Retour à la ligne", "Line break")} : \verb|\\|. ${T("Espace insécable", "Non-breaking space")} : \verb|~|.
${T("Nouvelle page", "New page")} : \verb|\newpage|. ${T("Espace vertical", "Vertical space")} : \verb|\vspace{1cm}|.
`)],
  ["maths", T("Mathématiques", "Mathematics"), doc(T("LaTeX : les mathématiques", "LaTeX: mathematics"), R`
\section{${T("Les deux modes", "The two modes")}}
${T("Dans le texte", "Inline")} : $a^2 + b^2 = c^2$ (\verb|$...$|).
${T("Centré", "Displayed")} (\verb|\[...\]|) :
\[ e^{i\pi} + 1 = 0 \]
${T("Numéroté", "Numbered")} (\texttt{equation}) :
\begin{equation}
  E = mc^2
\end{equation}

\section{${T("Indispensables", "Essentials")}}
\begin{tabular}{ll}
\toprule
${T("Commande", "Command")} & ${T("Résultat", "Result")} \\
\midrule
\verb|x^{2}, x_{i}| & $x^{2}, x_{i}$ \\
\verb|\frac{a}{b}| & $\frac{a}{b}$ \\
\verb|\sqrt{x}, \sqrt[3]{x}| & $\sqrt{x}, \sqrt[3]{x}$ \\
\verb|\sum_{i=1}^{n} i| & $\sum_{i=1}^{n} i$ \\
\verb|\int_{0}^{1} f(x)\,dx| & $\int_{0}^{1} f(x)\,dx$ \\
\verb|\lim_{n\to\infty}| & $\lim_{n\to\infty}$ \\
\verb|\alpha \beta \gamma \theta \lambda| & $\alpha\ \beta\ \gamma\ \theta\ \lambda$ \\
\verb|\leq \geq \neq \approx| & $\leq\ \geq\ \neq\ \approx$ \\
\verb|\in \subset \cup \cap| & $\in\ \subset\ \cup\ \cap$ \\
\verb|\to \Rightarrow \iff| & $\to\ \Rightarrow\ \iff$ \\
\verb|\mathbb{R}, \mathcal{L}| & $\mathbb{R}, \mathcal{L}$ \\
\verb|\hat{x}, \bar{x}, \vec{x}| & $\hat{x}, \bar{x}, \vec{x}$ \\
\verb|\left( \frac{1}{2} \right)| & $\left( \frac{1}{2} \right)$ \\
\bottomrule
\end{tabular}

\section{${T("Alignements, matrices, cas", "Alignment, matrices, cases")}}
% ${T("& marque le point d'alignement, \\\\ la fin de ligne", "& marks the alignment point, \\\\ ends the line")}
\begin{align}
  (a+b)^2 &= (a+b)(a+b) \\
          &= a^2 + 2ab + b^2
\end{align}
\[
  A = \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}
  \qquad
  |x| = \begin{cases} x & \text{${T("si", "if")} } x \geq 0 \\ -x & \text{${T("sinon", "otherwise")}} \end{cases}
\]
`)],
  ["figures", T("Figures et tableaux", "Figures and tables"), doc(T("LaTeX : figures et tableaux", "LaTeX: figures and tables"), R`
\section{${T("Image", "Image")}}
${T("La figure~\\ref{fig:exemple} montre un emplacement d'image.", "Figure~\\ref{fig:exemple} shows an image placeholder.")}

\begin{figure}[h]
  \centering
  % ${T("remplacez la ligne \\rule par", "replace the \\rule line with")} : \includegraphics[width=0.6\linewidth]{image.png}
  \rule{0.6\linewidth}{3cm}
  \caption{${T("Légende de la figure", "Figure caption")}}
  \label{fig:exemple}
\end{figure}

% ${T("Placement", "Placement")} : h = ${T("ici", "here")}, t = ${T("haut de page", "top of page")}, b = ${T("bas", "bottom")}, p = ${T("page à part", "separate page")}

\section{${T("Tableau", "Table")}}
% l, c, r : ${T("colonne alignée à gauche, centrée, à droite", "left, centred, right column")}
\begin{table}[h]
  \centering
  \begin{tabular}{lcr}
    \toprule
    ${T("Nom", "Name")} & ${T("Quantité", "Quantity")} & ${T("Prix", "Price")} \\
    \midrule
    ${T("Pommes", "Apples")} & 3 & 1.50 \\
    ${T("Poires", "Pears")} & 5 & 2.75 \\
    \bottomrule
  \end{tabular}
  \caption{${T("Un tableau simple", "A simple table")}}
\end{table}
`)],
  ["refs", T("Références et bibliographie", "References and bibliography"), doc(T("LaTeX : références et bibliographie", "LaTeX: references and bibliography"), R`
\tableofcontents

\section{${T("Renvois", "Cross-references")}}
\label{sec:renvois}
${T("On pose une étiquette avec \\verb|\\label{...}| et on y renvoie avec \\verb|\\ref{...}|.", "Set a label with \\verb|\\label{...}| and point to it with \\verb|\\ref{...}|.")}
${T("Voir la section", "See section")}~\ref{sec:renvois}, page~\pageref{sec:renvois}, ${T("et l'équation", "and equation")}~\eqref{eq:euler}.
\begin{equation}
  \label{eq:euler}
  e^{i\pi} = -1
\end{equation}

\section{${T("Notes et liens", "Footnotes and links")}}
${T("Une note", "A footnote")}\footnote{${T("Le texte de la note.", "The footnote text.")}}.
${T("Un lien", "A link")} : \href{https://ctan.org}{CTAN}.

\section{Citations}
${T("Knuth a créé TeX", "Knuth created TeX")}~\cite{knuth}.
% ${T("Pour un fichier .bib : \\bibliographystyle{plain} puis \\bibliography{refs}", "With a .bib file: \\bibliographystyle{plain} then \\bibliography{refs}")}

\begin{thebibliography}{9}
  \bibitem{knuth} D.~E. Knuth, \emph{The TeXbook}, Addison-Wesley, 1984.
\end{thebibliography}
`)],
  ["pratique", T("Astuces et erreurs courantes", "Tips and common errors"), doc(T("LaTeX : astuces et erreurs courantes", "LaTeX: tips and common errors"), R`
\newcommand{\R}{\mathbb{R}}
\newcommand{\norm}[1]{\left\lVert #1 \right\rVert}

\section{${T("Vos propres commandes", "Your own commands")}}
% \newcommand{\nom}[${T("nombre d'arguments", "number of arguments")}]{${T("définition", "definition")}}
$x \in \R^n, \quad \norm{x} \geq 0$

\section{${T("Erreurs courantes", "Common errors")}}
\begin{description}
  \item[Undefined control sequence] ${T("commande mal écrite ou extension manquante.", "misspelled command or missing package.")}
  \item[Missing \$ inserted] ${T("symbole mathématique (\\_, \\textasciicircum) hors du mode maths.", "math symbol (\\_, \\textasciicircum) outside math mode.")}
  \item[Runaway argument] ${T("accolade fermante oubliée.", "missing closing brace.")}
  \item[Environment undefined] ${T("environnement inconnu : vérifiez le \\texttt{usepackage}.", "unknown environment: check your \\texttt{usepackage}.")}
  \item[??] ${T("référence introuvable : vérifiez le nom du \\texttt{label}.", "unresolved reference: check the \\texttt{label} name.")}
\end{description}

\section{${T("Extensions utiles", "Useful packages")}}
\begin{tabular}{ll}
\toprule
\texttt{amsmath, amssymb} & ${T("mathématiques", "mathematics")} \\
\texttt{graphicx} & images \\
\texttt{booktabs} & ${T("beaux tableaux", "nice tables")} \\
\texttt{geometry} & ${T("marges", "margins")} \\
\texttt{hyperref} & ${T("liens cliquables", "clickable links")} \\
\texttt{xcolor} & ${T("couleurs", "colours")} \\
\bottomrule
\end{tabular}
`)],
];
