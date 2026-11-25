// Modèles "Nouveau à partir d'un modèle". Documents autonomes (un seul fichier), compilables avec les paquets de la distribution TeX embarquée.
const R = String.raw;
export const TEMPLATES = {
  article: R`\documentclass[11pt]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage[margin=2.5cm]{geometry}
\usepackage{hyperref}

\title{Title of the Article}
\author{Your Name}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
A short summary of the work in a few sentences.
\end{abstract}

\section{Introduction}
Write your introduction here. Equations look like $e^{i\pi}+1=0$ or
\begin{equation}
  \int_0^\infty e^{-x^2}\,dx = \frac{\sqrt\pi}{2}.
\end{equation}

\section{Method}
\subsection{Setup}
Describe the setup.

\section{Conclusion}
Summarize the results.

\begin{thebibliography}{9}
\bibitem{knuth} D.~E. Knuth. \emph{The \TeX book}. Addison-Wesley, 1984.
\end{thebibliography}
\end{document}
`,

  icml: R`% ICML-style paper (look-alike built on standard packages).
% To submit, put the official icml20XX.sty next to this file, delete the "Look-alike layout" block
% below and add:  \usepackage{icml2026}
\documentclass[10pt,twocolumn]{article}
% --- Look-alike layout -------------------------------------------------------
\usepackage[letterpaper,top=1in,bottom=1in,left=0.75in,right=0.75in,columnsep=0.25in]{geometry}
\usepackage{times}
\setlength{\parindent}{10pt}
% -----------------------------------------------------------------------------
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx,booktabs,xcolor}
\usepackage[colorlinks=true,allcolors=blue]{hyperref}
\newtheorem{theorem}{Theorem}

\begin{document}

\twocolumn[
  \centering
  \rule{\textwidth}{1.5pt}\par\vspace{6pt}
  {\LARGE\bfseries Submission and Formatting Instructions for Your Paper\par}\vspace{6pt}
  \rule{\textwidth}{0.6pt}\par\vspace{10pt}
  {\bfseries Anonymous Authors\textsuperscript{1}\par}\vspace{10pt}
  \begin{minipage}{0.85\textwidth}
  \centerline{\bfseries\large Abstract}\vspace{4pt}
  \small This document is a starting point for a two-column machine-learning paper. Replace this abstract with four to six sentences describing the problem, your approach and your main result.
  \end{minipage}
  \vspace{12pt}
]

\section{Introduction}
Machine learning papers usually start by motivating the problem and stating contributions.
We consider a function $f_\theta:\mathcal X\to\mathcal Y$ trained by minimizing
\begin{equation}
  \mathcal L(\theta)=\frac1n\sum_{i=1}^n \ell\big(f_\theta(x_i),y_i\big).
\end{equation}

\section{Method}
\subsection{Problem setting}
Describe the setting and notation.
\begin{theorem}
  Under mild assumptions, the estimator converges at rate $O(1/\sqrt n)$.
\end{theorem}

\section{Experiments}
\begin{table}[t]
  \caption{Example results.}
  \centering
  \begin{tabular}{lcc}
    \toprule Method & Accuracy & F1\\ \midrule
    Baseline & 0.71 & 0.69\\
    Ours & \textbf{0.78} & \textbf{0.76}\\ \bottomrule
  \end{tabular}
\end{table}

\section{Conclusion}
Summarize the findings and limitations.

\begin{thebibliography}{9}
\bibitem{kingma} D.~P. Kingma and J.~Ba. Adam: A method for stochastic optimization. In \emph{ICLR}, 2015.
\end{thebibliography}
\end{document}
`,

  neurips: R`% NeurIPS-style paper (look-alike built on standard packages).
% To submit, put the official neurips_20XX.sty next to this file, delete the "Look-alike layout" block
% below and add:  \usepackage{neurips_2025}
\documentclass[10pt]{article}
% --- Look-alike layout -------------------------------------------------------
\usepackage[textwidth=5.5in,textheight=9in,top=1in,centering]{geometry}
\usepackage{times}
\setlength{\parindent}{0pt}\setlength{\parskip}{5.5pt}
% -----------------------------------------------------------------------------
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx,booktabs,xcolor}
\usepackage[colorlinks=true,allcolors=blue]{hyperref}
\newtheorem{theorem}{Theorem}

\begin{document}

\begin{center}
  {\LARGE\bfseries Formatting Instructions for Your Paper}\\[14pt]
  {\bfseries Anonymous Author(s)}\\
  Affiliation\\ Address\\ \texttt{email}
\end{center}

\begin{center}\begin{minipage}{0.88\textwidth}
\centerline{\bfseries Abstract}\vspace{3pt}
\small The abstract paragraph goes here: one paragraph, no more than a dozen sentences, summarizing the question, the method and the key results.
\end{minipage}\end{center}

\section{Introduction}
Introduce the problem, related work and your contributions. A displayed equation:
\begin{equation}
  \hat\theta=\arg\min_\theta \; \mathbb E_{(x,y)}\big[\ell(f_\theta(x),y)\big].
\end{equation}

\section{Method}
Describe the method.
\begin{theorem}
  The method is consistent.
\end{theorem}

\section{Experiments}
\begin{table}[h]
  \caption{Sample table.}
  \centering
  \begin{tabular}{lcc}
    \toprule Part & Description & Size \\ \midrule
    Dendrite & Input terminal & $\sim$100 $\mu$m\\
    Axon & Output terminal & $\sim$10 $\mu$m\\ \bottomrule
  \end{tabular}
\end{table}

\section{Conclusion}
Conclude, and discuss limitations and broader impact.

\begin{thebibliography}{9}
\bibitem{lecun} Y.~LeCun, Y.~Bengio and G.~Hinton. Deep learning. \emph{Nature}, 521:436--444, 2015.
\end{thebibliography}
\end{document}
`,

  ieee: R`\documentclass[conference]{IEEEtran}
\IEEEoverridecommandlockouts
\usepackage[utf8]{inputenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{cite}
\usepackage{textcomp}

\begin{document}

\title{Title of Your Conference Paper}

\author{\IEEEauthorblockN{First Author}
\IEEEauthorblockA{\textit{Department} \\
\textit{University}\\
City, Country \\
email@example.com}
\and
\IEEEauthorblockN{Second Author}
\IEEEauthorblockA{\textit{Department} \\
\textit{Company}\\
City, Country \\
email@example.com}}

\maketitle

\begin{abstract}
This document is a model for IEEE conference papers. Summarize the problem, the approach and the results in about 150--250 words.
\end{abstract}

\begin{IEEEkeywords}
component, formatting, style, template
\end{IEEEkeywords}

\section{Introduction}
Start with the context and the contributions~\cite{ref1}. An equation:
\begin{equation}
  a+b=\gamma \label{eq:sum}
\end{equation}
Equation~(\ref{eq:sum}) is referenced like this.

\section{Method}
\subsection{Subsection}
Describe the approach.

\section{Results}
Present the results.

\section{Conclusion}
Conclude.

\begin{thebibliography}{00}
\bibitem{ref1} G.~Eason, B.~Noble, and I.~N. Sneddon, \textquotedblleft On certain integrals of Lipschitz-Hankel type,\textquotedblright{} \textit{Phil. Trans. Roy. Soc.}, vol.~247, pp.~529--551, 1955.
\end{thebibliography}

\end{document}
`,

  beamer: R`\documentclass[aspectratio=169]{beamer}
\usetheme{Madrid}
\usecolortheme{default}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}

\title{Title of the Presentation}
\subtitle{Optional subtitle}
\author{Your Name}
\institute{Your Institution}
\date{\today}

\begin{document}

\begin{frame}
  \titlepage
\end{frame}

\begin{frame}{Outline}
  \tableofcontents
\end{frame}

\section{Introduction}
\begin{frame}{Motivation}
  \begin{itemize}
    \item First key point
    \item Second key point with math: $e^{i\pi}+1=0$
    \item Third key point
  \end{itemize}
\end{frame}

\section{Method}
\begin{frame}{Two columns}
  \begin{columns}
    \column{0.5\textwidth}
      \begin{block}{A block}
        Some text in the left column.
      \end{block}
    \column{0.5\textwidth}
      \begin{equation*}
        \int_0^\infty e^{-x^2}\,dx = \frac{\sqrt\pi}{2}
      \end{equation*}
  \end{columns}
\end{frame}

\section{Conclusion}
\begin{frame}{Take-away}
  \begin{enumerate}
    \item What we did
    \item What we found
    \item What comes next
  \end{enumerate}
  \vfill\centering\textbf{Thank you!}
\end{frame}

\end{document}
`,

  cv: R`\documentclass[11pt,a4paper,sans]{moderncv}
\moderncvstyle{classic}
\moderncvcolor{blue}
\usepackage[utf8]{inputenc}
\usepackage[scale=0.8]{geometry}

\name{First}{Last}
\title{Curriculum Vitae}
\address{Street and number}{City, Country}
\phone[mobile]{+00~000~000~000}
\email{you@example.com}

\begin{document}
\makecvtitle

\section{Education}
\cventry{2021--2024}{Master's degree in Computer Science}{University}{City}{}{Thesis: title of the thesis.}
\cventry{2018--2021}{Bachelor's degree}{University}{City}{}{}

\section{Experience}
\cventry{2023}{Research intern}{Company or Lab}{City}{}{%
  \begin{itemize}
    \item Achievement or responsibility, with a measurable result.
    \item Another achievement.
  \end{itemize}}

\section{Skills}
\cvitem{Languages}{English (fluent), French (native)}
\cvitem{Programming}{Python, C++, \LaTeX}

\section{Publications}
\cvitem{2024}{Author, A., Author, B. Title of the paper. \emph{Venue}.}

\end{document}
`,

  letter: R`\documentclass[11pt]{letter}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[margin=2.5cm]{geometry}

\signature{Your Name}
\address{Your Name \\ Street and number \\ City, Country}

\begin{document}
\begin{letter}{Recipient Name \\ Company \\ Street and number \\ City, Country}
\opening{Dear Sir or Madam,}

Write the body of your letter here. State the purpose in the first sentence, give the necessary details in the next paragraph, and finish with what you expect or propose.

A second paragraph can follow. Keep each paragraph short.

\closing{Yours sincerely,}
\end{letter}
\end{document}
`,
};
