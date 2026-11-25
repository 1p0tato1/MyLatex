#!/usr/bin/env python3
"""Construit src/dict/en.bin et fr.bin: filtres de Bloom des mots anglais (SCOWL ≤ 70, US+UK+CA+AU) et français (an-array-of-french-words).
Usage: python3 tools/build-dict.py <paquet npm wordlist-english> <paquet npm an-array-of-french-words>"""
import json, math, re, sys, glob
src = sys.argv[1]; frsrc = sys.argv[2]
import struct, unicodedata
words = set()
for f in glob.glob(f"{src}/*-words-*.json"):
    words |= {w.lower() for w in json.load(open(f)) if re.fullmatch(r"[A-Za-z]+", w)}
# vocabulaire technique / académique courant (absent de SCOWL ≤ 70)
extra = """hyperparameter hyperparameters preprint preprints backprop backpropagation autoencoder autoencoders autoregressive softmax logit logits tokenizer tokenizers
tokenization tokenize tokenized finetuning finetune finetuned pretrained pretraining multimodal multilingual subgradient subgradients nonconvex nonlinear nonlinearity nonzero
nonnegative nonparametric subspace subspaces eigenvalue eigenvalues eigenvector eigenvectors eigendecomposition covariance covariances hessian jacobian lagrangian lagrange
bayesian gaussian markov markovian bernoulli poisson dirichlet gibbs boltzmann kullback leibler jensen wasserstein lipschitz sobolev hilbert banach euclidean
dataset datasets workflow workflows runtime codebase github arxiv bibtex biblatex latex pdf url urls html css json api apis cpu gpu gpus lstm lstms cnn cnns rnn rnns gan gans
vae vaes llm llms nlp mlp mlps sgd adam relu gelu bert gpt transformer transformers attention embedding embeddings overfitting underfitting downstream upstream
benchmark benchmarks benchmarking ablation ablations heuristic heuristics scalable scalability interpretability explainability robustness stochasticity adversary adversaries
adversarially bandit bandits regret minimax argmax argmin infimum supremum iid isotropic anisotropic discretization discretize discretized parameterization parameterize
parameterized reparametrization reparameterization linearization linearize convex convexity concave monotone monotonic differentiable differentiability
sublinear superlinear polynomial polynomials combinatorial combinatorics stochastic hyperplane hyperplanes classifier classifiers regressor regressors clustering centroid centroids
kernel kernels tensor tensors scalar scalars vectorized vectorization minibatch minibatches mini batch batches epoch epochs backbone checkpoint checkpoints
inference inferences posterior posteriors prior priors likelihood likelihoods marginal marginals marginalization amortization amortized variational ELBO
chatbot chatbots jailbreak jailbreaks jailbreaking jailbroken prompt prompts prompting blackbox whitebox benchmarked finetunes opensource website websites webpage webpages
email emails online offline login logout username usernames password passwords smartphone smartphones app apps blog blogs internet wifi bluetooth inbox timestamp timestamps
metadata filename filenames filepath hashtag hashtags podcast podcasts livestream startup startups roadmap toolkit toolkits plugin plugins backend frontend middleware
unsupervised semisupervised multitask multiagent multiclass multilabel multiobjective crowdsourcing crowdsourced annotator annotators annotation annotations
paraphrase paraphrases paraphrased paraphrasing summarization summarizer summarize summarizes sentiment llama gemini chatgpt openai deepseek qwen mistral anthropic
theorem theorems lemma lemmas corollary corollaries proposition propositions proof proofs notation notations iff wrt resp ie eg cf et al etc""".split()
words |= {w.lower() for w in extra}

def build(words, bits_per, k, path):
    words = sorted(words)
    n = len(words); m = ((n * bits_per + 7) // 8) * 8
    def hashes(w):
        h1, h2 = 0x811c9dc5, 0x9747b28c
        data = w.encode("utf-16-le")
        for (ch,) in struct.iter_unpack("<H", data):   # unités UTF-16, comme charCodeAt en JS
            h1 = ((h1 ^ ch) * 16777619) & 0xFFFFFFFF
            h2 = ((h2 ^ ch) * 0x5bd1e995) & 0xFFFFFFFF
            h2 ^= h2 >> 15
        return h1, (h2 | 1)
    bits = bytearray(m // 8)
    for w in words:
        h1, h2 = hashes(w)
        for i in range(k):
            idx = ((h1 + ((i * h2) & 0xFFFFFFFF)) & 0xFFFFFFFF) % m
            bits[idx >> 3] |= 1 << (idx & 7)
    out = bytes([k]) + m.to_bytes(4, "little") + bytes(bits)
    open(path, "wb").write(out)
    print(f"{path}: {n} words, {len(out)/1024:.0f} KB, expected FPR≈{(1-math.exp(-k*n/m))**k:.4%}")

build(words, 14, 10, "src/dict/en.bin")

# --- français
fr = set()
for w in json.load(open(f"{frsrc}/index.json")):
    w = unicodedata.normalize("NFC", w.lower())
    for part in re.split(r"[-']", w):   # composés et élisions: on garde les morceaux (le scanner découpe de la même façon)
        if re.fullmatch(r"[a-zàâäçéèêëîïôöùûüÿœæñ]{2,}", part): fr.add(part)
fr |= set("jusqu lorsqu puisqu quoiqu presqu quelqu aujourd hui".split())
fr |= {w.lower() for w in """algorithme algorithmes hyperparamètre hyperparamètres apprentissage ordinateur ordinateurs logiciel logiciels internet courriel courriels
site sites web blog blogs chatbot chatbots jeu données jeux base bases réseau réseaux neurones neurone fonction fonctions théorème théorèmes lemme lemmes corollaire
démonstration démonstrations preuve preuves hypothèse hypothèses figure figures tableau tableaux équation équations bibliographie référence références annexe annexes
chapitre chapitres paragraphe paragraphes introduction conclusion résumé résumés mots clés""".split()}
build(fr, 13, 9, "src/dict/fr.bin")
